import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from backend import cloud, gemma, pipeline  # noqa: E402

logging.basicConfig(level=logging.INFO)

MAX_TEXT_CHARS = 20_000

CLOUD_SYSTEM_PROMPT = (
    "Some values in the user's message were replaced with placeholders like "
    "[PERSON_1], [EMAIL_1] or [API_KEY_1] to protect privacy. Treat each placeholder "
    "as the real value it stands for, reuse placeholders exactly as written when you "
    "refer to them, and never guess or invent the original values."
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Gemma takes ~47 s to load; load it in the background so /health answers
    # immediately and /scan can return 503 until it is ready.
    gemma.start_background_load()
    yield
    gemma.shutdown()


app = FastAPI(title="Airlock API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    text: str


class AskRequest(BaseModel):
    scan_id: str
    question: str | None = None


def _check_text(text: str) -> None:
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty.")
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail=f"Text exceeds {MAX_TEXT_CHARS} characters.")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "API is running"}


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "gemma_loaded": gemma.is_loaded(),
        "gemma_status": gemma.status(),
        "model_alias": gemma.model_alias(),
        "cloud_configured": cloud.is_configured(),
    }


@app.post("/scan")
def scan(body: ScanRequest) -> dict:
    _check_text(body.text)
    if gemma.status() == "loading":
        raise HTTPException(status_code=503, detail="Gemma is still loading (about a minute after startup). Try again shortly.")
    return pipeline.scan(body.text)


@app.post("/ask")
def ask(body: AskRequest) -> dict:
    session = pipeline.SESSIONS.get(body.scan_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown scan_id.")

    with session.lock:
        if body.question is not None and body.question.strip():
            _check_text(body.question)
            cloud_saw = pipeline.sanitize_with_session(session, body.question)
        else:
            cloud_saw = session.sanitized_text

        outgoing = list(session.messages)
        if not outgoing:
            outgoing.append({"role": "system", "content": CLOUD_SYSTEM_PROMPT})
        outgoing.append({"role": "user", "content": cloud_saw})

        # Last line of defence: no redacted secret may ever leave the machine.
        contents = [message["content"] for message in outgoing]
        for secret in session.redacted_values():
            if any(secret in content for content in contents):
                raise HTTPException(status_code=500, detail="Refusing to send: redacted value found in outgoing payload.")

        started = time.perf_counter()
        try:
            answer, model_name = cloud.chat(outgoing)
        except cloud.CloudError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        cloud_ms = round((time.perf_counter() - started) * 1000)

        outgoing.append({"role": "assistant", "content": answer})
        session.messages = outgoing

        return {
            "scan_id": session.scan_id,
            "cloud_model": model_name,
            "cloud_saw": cloud_saw,
            "cloud_response_raw": answer,
            "response": pipeline.rehydrate(session, answer),
            "timings_ms": {"cloud": cloud_ms},
        }
