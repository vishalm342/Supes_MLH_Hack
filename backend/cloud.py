"""Cloud model client (OpenAI-compatible chat/completions). Only ever sent sanitized text."""

import os

import httpx


class CloudError(RuntimeError):
    """Raised when the cloud provider is unconfigured or returns an error."""


def _config() -> tuple[str, str, str]:
    base_url = os.getenv("CLOUD_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    api_key = os.getenv("CLOUD_API_KEY", "")
    model = os.getenv("CLOUD_MODEL", "")
    return base_url, api_key, model


def is_configured() -> bool:
    _, api_key, model = _config()
    return bool(api_key and model)


def _post(base_url: str, api_key: str, payload: dict) -> httpx.Response:
    return httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=60,
    )


def chat(messages: list[dict]) -> tuple[str, str]:
    """Send sanitized chat messages; return (answer_text, model_name)."""

    base_url, api_key, model = _config()
    if not (api_key and model):
        raise CloudError("Cloud model is not configured (set CLOUD_API_KEY and CLOUD_MODEL).")

    payload = {"model": model, "messages": messages, "temperature": 0.3}
    try:
        response = _post(base_url, api_key, payload)
        # Some models only accept the default temperature.
        if response.status_code == 400 and "temperature" in response.text:
            payload.pop("temperature")
            response = _post(base_url, api_key, payload)
    except httpx.HTTPError as error:
        raise CloudError(f"Cloud request failed: {type(error).__name__}: {error}") from error

    if response.status_code != 200:
        raise CloudError(f"Cloud model returned HTTP {response.status_code}: {response.text[:300]}")

    try:
        data = response.json()
        answer = data["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError, TypeError) as error:
        raise CloudError("Cloud model returned an unexpected response shape.") from error

    return answer, data.get("model", model)
