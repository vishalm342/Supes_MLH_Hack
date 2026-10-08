from fastapi import FastAPI

app = FastAPI(title="Supes MLH Hack API")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "API is running"}
