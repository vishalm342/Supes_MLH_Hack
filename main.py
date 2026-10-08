import atexit
import io
import time
import traceback
from pathlib import Path

import gradio as gr
from PIL import Image, ImageOps

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


MODEL_ALIAS = "gemma-4-e2b-it"
SERVER_PORT = 7860
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_MODEL_IMAGE_EDGE = 1024
TARGET_MODEL_IMAGE_BYTES = 4 * 1024 * 1024

manager = None
model = None


def extract_response_text(response) -> str:
    """Extract generated text from a Foundry Local response."""

    output_parts = []

    for item in response:
        if isinstance(item, MessageItem):
            for part in item.parts:
                if isinstance(part, TextItem):
                    output_parts.append(part.text)

        elif isinstance(item, TextItem):
            output_parts.append(item.text)

    return "".join(output_parts).strip()


def create_chat_session():
    """
    Create a fresh chat session for one request.

    Gemma remains loaded in memory, but conversation history is not
    shared between unrelated requests.
    """

    chat_session = ChatSession(model)

    chat_session.set_options(
        RequestOptions(
            search=SearchOptions(
                temperature=0.2,
                max_output_tokens=256,
            )
        )
    )

    return chat_session


def compress_image_for_model(path: Path):
    """Resize and encode an uploaded image efficiently for local inference."""

    original_size_bytes = path.stat().st_size
    if original_size_bytes > MAX_UPLOAD_BYTES:
        raise ValueError("Image exceeds the 20 MB upload limit.")

    with Image.open(path) as source:
        original_dimensions = source.size
        if original_dimensions[0] * original_dimensions[1] > MAX_IMAGE_PIXELS:
            raise ValueError("Image is over the 40 megapixel processing limit.")
        image = ImageOps.exif_transpose(source).copy()

    image.thumbnail(
        (MAX_MODEL_IMAGE_EDGE, MAX_MODEL_IMAGE_EDGE),
        Image.Resampling.LANCZOS,
    )

    if "A" in image.getbands():
        rgba_image = image.convert("RGBA")
        white_background = Image.new("RGBA", rgba_image.size, (255, 255, 255, 255))
        image = Image.alpha_composite(white_background, rgba_image).convert("RGB")
    else:
        image = image.convert("RGB")

    def encode_webp(lossless: bool, quality: int = 88) -> bytes:
        buffer = io.BytesIO()
        image.save(
            buffer,
            format="WEBP",
            lossless=lossless,
            quality=quality,
            method=6,
        )
        return buffer.getvalue()

    image_bytes = encode_webp(lossless=True)
    if len(image_bytes) > TARGET_MODEL_IMAGE_BYTES:
        image_bytes = encode_webp(lossless=False, quality=88)
    if len(image_bytes) > TARGET_MODEL_IMAGE_BYTES:
        image.thumbnail((768, 768), Image.Resampling.LANCZOS)
        image_bytes = encode_webp(lossless=False, quality=82)

    return image_bytes, original_dimensions, image.size, original_size_bytes


def process_prompt(prompt, image_path=None):
    """
    Process either:

    1. A text-only prompt
    2. A text prompt with an uploaded or clipboard-pasted image
    """

    prompt = (prompt or "").strip()

    if not prompt and image_path is None:
        return (
            "Enter a text prompt or provide an image.",
            "No request sent",
        )

    if not prompt and image_path is not None:
        prompt = (
            "Describe this image, read any visible text, "
            "and explain the important details."
        )

    request_started = time.perf_counter()

    try:
        message_parts = [
            TextItem(prompt),
        ]

        request_type = "Text only"
        image_size_text = ""

        if image_path is not None:
            path = Path(image_path).resolve()

            if not path.exists():
                return (
                    "The image file could not be found.",
                    "Request failed",
                )

            image_format = path.suffix.lower().lstrip(".")

            supported_formats = {
                "png",
                "jpg",
                "jpeg",
                "webp",
            }

            if image_format not in supported_formats:
                return (
                    f"Unsupported image format: {image_format}. "
                    "Use PNG, JPG, JPEG, or WEBP.",
                    "Request failed",
                )

            compression_started = time.perf_counter()
            try:
                (
                    image_bytes,
                    original_dimensions,
                    model_dimensions,
                    original_size_bytes,
                ) = compress_image_for_model(path)
            except (OSError, ValueError, Image.DecompressionBombError) as error:
                return (
                    f"The image could not be prepared: {error}",
                    "Image preparation failed",
                )
            compression_elapsed = time.perf_counter() - compression_started
            original_size_mb = original_size_bytes / (1024 * 1024)
            model_size_mb = len(image_bytes) / (1024 * 1024)
            if len(image_bytes) < original_size_bytes:
                size_note = (
                    f"{(1 - len(image_bytes) / original_size_bytes) * 100:.0f}% smaller"
                )
            else:
                size_note = "no size reduction"

            message_parts.append(ImageItem("webp", image_bytes))

            request_type = "Multimodal image and text"
            image_size_text = (
                f" | Image: {original_dimensions[0]}x{original_dimensions[1]} "
                f"{original_size_mb:.2f} MB -> {model_dimensions[0]}x{model_dimensions[1]} "
                f"{model_size_mb:.2f} MB ({size_note}, prepared in "
                f"{compression_elapsed:.2f}s)"
            )

            print("\n" + "=" * 70)
            print("New Gemma multimodal request")
            print(f"Image source: {path}")
            print(f"Original dimensions: {original_dimensions}")
            print(f"Model input dimensions: {model_dimensions}")
            print(f"Original image size: {original_size_mb:.2f} MB")
            print(f"Model input format: WEBP ({model_size_mb:.2f} MB; {size_note})")
            print(f"Image preparation time: {compression_elapsed:.2f} seconds")
            print(f"Prompt: {prompt}")
            print("=" * 70)

        else:
            print("\n" + "=" * 70)
            print("New Gemma text request")
            print(f"Prompt: {prompt}")
            print("=" * 70)

        message = MessageItem.user(message_parts)

        with create_chat_session() as request_session:
            with Request().add_item(message) as request:
                with request_session.process_request(request) as response:
                    answer = extract_response_text(response)

        elapsed = time.perf_counter() - request_started

        if not answer:
            answer = "Gemma completed the request but returned no text."

        print("\nGemma response:")
        print(answer)

        print(f"\nRequest type: {request_type}")
        print(f"Response time: {elapsed:.2f} seconds")
        print("=" * 70)

        performance = (
            f"Response time: {elapsed:.2f} seconds | "
            f"Request type: {request_type}"
            f"{image_size_text} | "
            f"Model: {MODEL_ALIAS}"
        )

        return answer, performance

    except Exception as error:
        elapsed = time.perf_counter() - request_started

        print("\nGemma request failed.")
        print(f"Failure after: {elapsed:.2f} seconds")

        traceback.print_exc()

        print("=" * 70)

        error_message = (
            "Gemma failed to process the request.\n\n"
            f"Error: {type(error).__name__}: {error}\n\n"
        )

        if "E_OUTOFMEMORY" in str(error):
            error_message += (
                "The Intel Iris Xe WebGPU provider ran out of memory. "
                "Text-only prompts may still work, but image processing "
                "requires additional GPU memory. Try closing other "
                "applications, using a smaller image, restarting the app, "
                "or switching to the CPU model variant."
            )

        else:
            error_message += (
                "See the PowerShell console for the complete stack trace."
            )

        return (
            error_message,
            f"Request failed after {elapsed:.2f} seconds",
        )


def submit_request(prompt, image_path):
    """
    Route text-only and image requests.

    Leaving the image empty sends a normal text prompt.
    Providing an image sends a multimodal request.
    """

    return process_prompt(
        prompt=prompt,
        image_path=image_path,
    )


def initialize_gemma():
    """Initialize Foundry Local and load Gemma once."""

    global manager
    global model

    print("Initializing Foundry Local...")

    shared_foundry_dir = Path.home() / ".foundry"
    print(f"Foundry shared per-user data root: {shared_foundry_dir}")

    config = Configuration(
        app_name="GemmaVision",
        app_data_dir=str(shared_foundry_dir),
        disable_nonessential_telemetry=True,
    )


    FoundryLocalManager.initialize(config)
    manager = FoundryLocalManager.instance

    print("Preparing Gemma's WebGPU execution provider...")

    ep_result = manager.download_and_register_eps(
        names=["WebGpuExecutionProvider"],
    )

    print(
        f"Execution providers ready: "
        f"{ep_result.success} ({ep_result.status})"
    )

    print(f"Resolving model: {MODEL_ALIAS}")

    model = manager.catalog.get_model(MODEL_ALIAS)

    if model is None:
        raise RuntimeError(
            f"Model '{MODEL_ALIAS}' was not found "
            "in the Foundry Local catalog."
        )

    print(f"Selected model: {model.alias}")
    print(f"Model ID: {model.id}")
    print(f"Cached: {model.is_cached}")

    if not model.is_cached:
        print("Downloading Gemma...")

        model.download(
            progress_callback=lambda progress: print(
                f"\rDownload: {progress:.1f}%",
                end="",
                flush=True,
            )
        )

        print()

    load_started = time.perf_counter()

    print("Loading Gemma into memory...")

    model.load()

    load_elapsed = time.perf_counter() - load_started

    print(f"Gemma loaded in {load_elapsed:.2f} seconds.")
    print("Gemma will remain loaded while this application is running.")


def shutdown_gemma():
    """Unload Gemma and close Foundry Local."""

    global model
    global manager

    print("\nShutting down Gemma application...")

    try:
        if model is not None:
            model.unload()
            model = None

            print("Gemma unloaded.")

    except Exception:
        print("Error while unloading Gemma:")
        traceback.print_exc()

    try:
        if manager is not None:
            manager.close()
            manager = None

            print("Foundry Local closed.")

    except Exception:
        print("Error while closing Foundry Local:")
        traceback.print_exc()


def clear_interface():
    """Clear the prompt, image, answer, and performance output."""

    return "", None, "", ""


def insert_example(example_prompt):
    """Insert a selected example into the prompt input."""

    return example_prompt


def create_ui():
    """Create the Gradio browser interface."""

    with gr.Blocks(
        title="Gemma Local Assistant",
    ) as interface:

        gr.Markdown(
            """
# Gemma Local Assistant

Send a normal text prompt, or optionally add an image for Gemma to analyze.

### Text-only usage

Enter a prompt and leave the image area empty.

### Image usage

Upload an image, choose the clipboard option, or use **Win+Shift+S**
and paste the screenshot into the image area with **Ctrl+V**.

Images up to 20 MB are accepted. The host corrects orientation, resizes images
so the longest side is at most 1024 pixels, and encodes lossless WebP first.
If that remains larger than 4 MB, it uses a smaller quality-88 WebP, then a
768-pixel fallback. The Performance box shows original and model-input sizes.

For teammates on the same network, open `http://<host IPv4>:7860`.
Requests are processed one at a time, and Gemma stays loaded between requests.
            """
        )

        with gr.Row():
            with gr.Column(scale=1):
                prompt_input = gr.Textbox(
                    label="Prompt",
                    placeholder=(
                        "Ask Gemma a general question, or ask something "
                        "about the provided image."
                    ),
                    lines=7,
                )

                image_input = gr.Image(
                    label="Optional image or screenshot (max 20 MB)",
                    type="filepath",
                    sources=[
                        "upload",
                        "clipboard",
                    ],
                    height=360,
                )

                gr.Markdown(
                    """
Leave the image empty for a normal text request.

To paste a screenshot:

1. Press **Win+Shift+S**
2. Capture the required area
3. Click the image box
4. Press **Ctrl+V**
                    """
                )

                with gr.Row():
                    submit_button = gr.Button(
                        "Send to Gemma",
                        variant="primary",
                    )

                    clear_button = gr.Button("Clear")

            with gr.Column(scale=1):
                answer_output = gr.Textbox(
                    label="Gemma response",
                    lines=22,
                    interactive=False,
                )

                performance_output = gr.Textbox(
                    label="Performance",
                    interactive=False,
                )

        gr.Markdown("## Try a text prompt")

        with gr.Row():
            example_one = gr.Button(
                "Introduce yourself",
            )

            example_two = gr.Button(
                "Explain local AI",
            )

            example_three = gr.Button(
                "Give a Python example",
            )

            example_four = gr.Button(
                "Explain LoRA",
            )

        example_one.click(
            fn=lambda: (
                "Introduce yourself in three short sentences."
            ),
            outputs=prompt_input,
        )

        example_two.click(
            fn=lambda: (
                "Explain how running an AI model locally can reduce "
                "cloud token costs. Keep the explanation practical."
            ),
            outputs=prompt_input,
        )

        example_three.click(
            fn=lambda: (
                "Write a small Python function that checks whether "
                "a string is a palindrome, and explain the code."
            ),
            outputs=prompt_input,
        )

        example_four.click(
            fn=lambda: (
                "Explain LoRA fine-tuning in plain English with "
                "a simple analogy."
            ),
            outputs=prompt_input,
        )

        submit_button.click(
            fn=submit_request,
            inputs=[
                prompt_input,
                image_input,
            ],
            outputs=[
                answer_output,
                performance_output,
            ],
        )

        prompt_input.submit(
            fn=submit_request,
            inputs=[
                prompt_input,
                image_input,
            ],
            outputs=[
                answer_output,
                performance_output,
            ],
        )

        clear_button.click(
            fn=clear_interface,
            outputs=[
                prompt_input,
                image_input,
                answer_output,
                performance_output,
            ],
        )

    return interface


if __name__ == "__main__":
    atexit.register(shutdown_gemma)

    initialize_gemma()

    app = create_ui()

    # Protect the integrated GPU by processing requests sequentially.
    app.queue(
        default_concurrency_limit=1,
    )

    print("\nStarting Gemma Local Assistant...")
    print(f"Open locally: http://127.0.0.1:{SERVER_PORT}")
    print(f"Alternative:  http://localhost:{SERVER_PORT}")
    print(
        "Run ipconfig on this PC to find its IPv4 address; teammates open: "
        f"http://<IPv4>:{SERVER_PORT}"
    )
    print("Press Ctrl+C to stop the application.\n")

    app.launch(
        server_name="0.0.0.0",
        server_port=SERVER_PORT,
        share=False,
        show_error=True,
        inbrowser=False,
        max_file_size="20mb",
    )