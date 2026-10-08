"""Download and benchmark a text-only and an image-capable Foundry model."""

from __future__ import annotations

import importlib.metadata
import struct
import tempfile
import time
import traceback
import zlib
from pathlib import Path

from foundry_local_sdk import (
    ChatSession,
    Configuration,
    FoundryLocalManager,
    ImageItem,
    MessageItem,
    Request,
    RequestOptions,
    SearchOptions,
    TextItem,
)


REQUIRED_SDK_VERSION = "2.0.1"
MODEL_SPECS = (
    {
        "alias": "qwen3-4b",
        "model_id": "qwen3-4b-generic-cpu:3",
        "device": "CPU",
        "execution_provider": "CPUExecutionProvider",
        "size_mb": 2763,
        "task": "chat-completion",
        "image_input": False,
    },
    {
        "alias": "qwen3-vl-4b-instruct",
        "model_id": "qwen3-vl-4b-instruct-generic-cpu:3",
        "device": "CPU",
        "execution_provider": "CPUExecutionProvider",
        "size_mb": 2797,
        "task": "vision-language-chat",
        "image_input": True,
    },
)
TEXT_PROMPTS = (
    "In one sentence, explain what a local language model does.",
    "A train travels 120 km in 2 hours. What is its average speed? Show the calculation.",
    "Give Python code to reverse a string and explain it briefly.",
)
IMAGE_PROMPTS = (
    "Describe the two colored panels in this image.",
    "Which panel is blue and which is orange? Describe their positions.",
    "How many colored panels are shown, and what color is the header band?",
)


def _model_device(model) -> str:
    runtime = model.info.runtime
    device = getattr(runtime, "device_type", None)
    return str(getattr(device, "value", device or "Unknown"))


def _runtime_description(model, spec: dict | None = None) -> str:
    runtime = model.info.runtime
    provider = getattr(runtime, "execution_provider", None)
    if spec is not None and not provider:
        return f"{spec['device']} / {spec['execution_provider']}"
    return f"{_model_device(model)} / {provider or model.info.provider_type}"


def _select_requested_variant(catalog, spec: dict):
    """Reuse a cached variant first, otherwise resolve its exact catalog ID."""

    alias = spec["alias"]
    cached_by_id = {
        cached_model.id: cached_model
        for cached_model in catalog.get_cached_models()
    }
    model = cached_by_id.get(spec["model_id"])
    if model is None:
        model = catalog.get_model_variant(spec["model_id"])
    if model is None:
        raise LookupError(
            f"Model '{alias}' ({spec['model_id']}) was not found in the local Foundry catalog."
        )
    model_device = _model_device(model)
    model_id = model.id.lower()
    if model_device == "Unknown":
        model_device = "GPU" if "gpu" in model_id else "CPU" if "cpu" in model_id else "Unknown"
    if model_device != spec["device"]:
        raise RuntimeError(
            f"Catalog resolved {alias} to {_runtime_description(model, spec)}; "
            f"expected {spec['device']}."
        )
    return model

    variants = model.variants
    selected = next(
        (variant for variant in variants if _model_device(variant) == preferred_device),
        None,
    )

    if selected is None:
        available = ", ".join(
            f"{variant.id} ({_runtime_description(variant)})" for variant in variants
        ) or "none"
        raise RuntimeError(
            f"No {preferred_device} variant is available for {alias}. "
            f"Catalog variants: {available}"
        )

    model.select_variant(selected)
    return model


def _response_text(response) -> str:
    output_parts = []
    for item in response:
        if isinstance(item, MessageItem):
            for part in item.parts:
                if isinstance(part, TextItem):
                    output_parts.append(part.text)
        elif isinstance(item, TextItem):
            output_parts.append(item.text)
    return "".join(output_parts).strip()


def _run_inference(model, prompt: str, image_bytes: bytes | None = None) -> str:
    parts = [TextItem(prompt)]
    if image_bytes is not None:
        parts.append(ImageItem("png", image_bytes))
    message = MessageItem.user(parts)

    with ChatSession(model) as session:
        session.set_options(
            RequestOptions(
                search=SearchOptions(
                    temperature=0.2,
                    max_output_tokens=96,
                )
            )
        )
        with Request().add_item(message) as request:
            with session.process_request(request) as response:
                return _response_text(response)


def _png_chunk(kind: bytes, data: bytes) -> bytes:
    payload = kind + data
    return (
        struct.pack(">I", len(data))
        + payload
        + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)
    )


def _create_smoke_image() -> bytes:
    """Create a 768x768 test image without adding a project dependency."""

    width = height = 768
    background = bytes((242, 244, 247))
    header = bytes((35, 82, 145))
    left_panel = bytes((76, 166, 222))
    right_panel = bytes((238, 171, 67))
    raw_pixels = bytearray()

    for y in range(height):
        if y < 100:
            row = bytearray(header * width)
        else:
            row = bytearray(background * width)
            if 150 <= y < 650:
                row[64 * 3 : 344 * 3] = left_panel * 280
                row[400 * 3 : 704 * 3] = right_panel * 304
        raw_pixels.extend(b"\x00")
        raw_pixels.extend(row)

    png = (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(
            b"IHDR",
            struct.pack(">2I5B", width, height, 8, 2, 0, 0, 0),
        )
        + _png_chunk(b"IDAT", zlib.compress(bytes(raw_pixels), level=6))
        + _png_chunk(b"IEND", b"")
    )

    return png


def _print_cached_multimodal_models(catalog) -> None:
    print("\nCached multimodal models visible to the SDK:")
    try:
        cached_models = catalog.get_cached_models()
    except Exception:
        print("Could not enumerate cached models:")
        traceback.print_exc()
        return

    multimodal_names = ("vl", "vision", "gemma-4-e2b", "qwen3.5", "whisper")
    matches = []
    for model in cached_models:
        info = model.info
        modalities = (info.input_modalities or "").lower()
        task = (info.task or "").lower()
        identifying_text = " ".join(
            str(value or "") for value in (model.alias, model.id, info.name)
        ).lower()
        if (
            any(modality in modalities for modality in ("image", "audio", "video"))
            or any(name in task for name in ("vision", "image", "audio", "speech"))
            or any(name in identifying_text for name in multimodal_names)
        ):
            matches.append(model)

    if not matches:
        print("  None found.")
        return

    for model in matches:
        info = model.info
        print(
            f"  {model.alias} | {model.id} | {_runtime_description(model)} | "
            f"{info.file_size_mb or 'unknown'} MB | "
            f"task={info.task or 'not reported'} | "
            f"modalities={info.input_modalities or 'not reported'}"
        )


def _benchmark_requests(model, prompts, image_bytes=None) -> list[dict]:
    request_results = []
    request_kind = "image" if image_bytes is not None else "text"

    for index, prompt in enumerate(prompts, start=1):
        started = time.perf_counter()
        try:
            answer = _run_inference(model, prompt, image_bytes=image_bytes)
            elapsed = time.perf_counter() - started
            if not answer:
                raise RuntimeError("The model returned an empty response.")
            print(f"{request_kind.title()} request {index} ({elapsed:.2f}s): {answer}")
            request_results.append(
                {"kind": request_kind, "seconds": elapsed, "success": True}
            )
        except Exception as error:
            elapsed = time.perf_counter() - started
            print(
                f"{request_kind.title()} request {index} failed after "
                f"{elapsed:.2f}s: {type(error).__name__}: {error}"
            )
            traceback.print_exc()
            request_results.append(
                {
                    "kind": request_kind,
                    "seconds": elapsed,
                    "success": False,
                    "error": f"{type(error).__name__}: {error}",
                }
            )

    return request_results


def main() -> int:
    results: list[dict] = []

    sdk_version = importlib.metadata.version("foundry-local-sdk")
    print(f"Foundry Local SDK: {sdk_version}")
    if sdk_version != REQUIRED_SDK_VERSION:
        print(f"This script requires SDK {REQUIRED_SDK_VERSION}; stopping.")
        return 1

    shared_foundry_dir = Path.home() / ".foundry"
    print(f"Foundry shared per-user data root: {shared_foundry_dir}")

    for spec in MODEL_SPECS:
        alias = spec["alias"]
        manager = None
        model = None
        loaded = False
        result = {
            "alias": alias,
            "download_seconds": None,
            "load_seconds": None,
            "requests": [],
            "status": "FAIL",
        }
        print(f"\n{'=' * 72}\nModel: {alias}")
        try:
            FoundryLocalManager.initialize(
                Configuration(
                    app_name="HackathonVisionAssistant",
                    app_data_dir=str(shared_foundry_dir),
                    logs_dir=tempfile.gettempdir(),
                    disable_nonessential_telemetry=True,
                )
            )
            manager = FoundryLocalManager.instance
            catalog = manager.catalog
            model = _select_requested_variant(catalog, spec)

            info = model.info
            print(f"Resolved ID: {model.id}")
            print(f"Catalog name: {info.name}")
            print(f"Device/runtime: {_runtime_description(model, spec)}")
            print(f"Task: {spec['task']}")
            print(f"Size: {info.file_size_mb or spec['size_mb']} MB")
            print(f"Cached before download: {model.is_cached}")

            if model.is_cached:
                print("Already cached; skipping download.")
                download_result = "already cached"
            else:
                print("Downloading model to Foundry Local's shared cache...")

                def show_progress(percent: float) -> None:
                    print(f"\rDownload progress: {percent:.1f}%", end="", flush=True)

                download_started = time.perf_counter()
                try:
                    model.download(progress_callback=show_progress)
                    print("\rDownload progress: 100.0%")
                except Exception:
                    print()
                    raise
                result["download_seconds"] = time.perf_counter() - download_started
                if not model.is_cached:
                    raise RuntimeError("Download returned, but model.is_cached is still false.")
                download_result = "downloaded"

            print(f"Cached path: {model.get_path()}")
            print("Loading model for timed requests...")
            load_started = time.perf_counter()
            model.load()
            loaded = True
            result["load_seconds"] = time.perf_counter() - load_started
            print(f"Load completed in {result['load_seconds']:.2f} seconds.")

            if spec["image_input"]:
                result["requests"] = _benchmark_requests(
                    model,
                    IMAGE_PROMPTS,
                    image_bytes=_create_smoke_image(),
                )
            else:
                result["requests"] = _benchmark_requests(model, TEXT_PROMPTS)

            successful_requests = sum(
                request["success"] for request in result["requests"]
            )
            result["status"] = (
                f"PASS ({download_result}; {successful_requests}/"
                f"{len(result['requests'])} requests)"
                if successful_requests == len(result["requests"])
                else f"PARTIAL ({download_result}; {successful_requests}/"
                f"{len(result['requests'])} requests)"
            )

        except Exception as error:
            print(f"FAILED: {type(error).__name__}: {error}")
            traceback.print_exc()
            result["status"] = f"FAIL ({type(error).__name__}: {error})"
        finally:
            if loaded and model is not None:
                try:
                    model.unload()
                    print("Model unloaded.")
                except Exception:
                    print("Model unload failed:")
                    traceback.print_exc()
            if manager is not None:
                try:
                    manager.close()
                except Exception:
                    print("Foundry Local shutdown failed:")
                    traceback.print_exc()

        results.append(result)

    manager = None
    try:
        FoundryLocalManager.initialize(
            Configuration(
                app_name="HackathonVisionAssistant",
                app_data_dir=str(shared_foundry_dir),
                logs_dir=tempfile.gettempdir(),
                disable_nonessential_telemetry=True,
            )
        )
        manager = FoundryLocalManager.instance
        _print_cached_multimodal_models(manager.catalog)
    except Exception:
        print("Could not print cached multimodal model list:")
        traceback.print_exc()
    finally:
        if manager is not None:
            try:
                manager.close()
            except Exception:
                traceback.print_exc()

    print("\nResults:")
    for result in results:
        print(f"  {result['alias']}: {result['status']}")
        if result["download_seconds"] is not None:
            print(f"    download: {result['download_seconds']:.2f}s")
        elif result["status"].startswith("PASS") or result["status"].startswith("PARTIAL"):
            print("    download: already cached")
        if result["load_seconds"] is not None:
            print(f"    load: {result['load_seconds']:.2f}s")
        for index, request in enumerate(result["requests"], start=1):
            state = "ok" if request["success"] else "failed"
            print(
                f"    {request['kind']} request {index}: "
                f"{request['seconds']:.2f}s ({state})"
            )
    return 0 if results and all(result["status"].startswith("PASS") for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
