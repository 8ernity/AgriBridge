"""Local Whisper transcription endpoint for multilingual farmer queries."""
import asyncio
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Local Whisper Voice Input"])
WHISPER_MODEL_ID = "Systran/faster-whisper-small"
MAX_AUDIO_BYTES = 25 * 1024 * 1024
_whisper_model = None
_whisper_model_lock = threading.Lock()


def _configure_model_cache() -> Path:
    """Keep model downloads in the project cache unless explicitly configured."""
    configured_cache = os.environ.get("HF_HUB_CACHE") or os.environ.get("HUGGINGFACE_HUB_CACHE")
    default_cache = Path(__file__).resolve().parents[4] / "models" / "hf_cache"
    cache_path = Path(configured_cache).expanduser() if configured_cache else default_cache
    os.environ.setdefault("HF_HUB_CACHE", str(cache_path))
    return cache_path


def _get_cached_model_path(cache_path: Path) -> Optional[Path]:
    """Return the downloaded model snapshot when all required files are present."""
    repo_cache = cache_path / "models--Systran--faster-whisper-small"
    revision_file = repo_cache / "refs" / "main"
    try:
        revision = revision_file.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    snapshot = repo_cache / "snapshots" / revision
    required_files = ("model.bin", "config.json", "tokenizer.json", "vocabulary.txt")
    return snapshot if all((snapshot / name).is_file() for name in required_files) else None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        with _whisper_model_lock:
            if _whisper_model is None:
                cache_path = _configure_model_cache()
                from faster_whisper import WhisperModel
                local_model_path = _get_cached_model_path(cache_path)
                model_source = str(local_model_path) if local_model_path else WHISPER_MODEL_ID
                _whisper_model = WhisperModel(model_source, device="cpu", compute_type="int8")
    return _whisper_model


def _transcribe_file(path: str, language_hint: Optional[str]):
    model = _get_whisper_model()
    segments, info = model.transcribe(
        path,
        language=language_hint,
        beam_size=5,
        vad_filter=True
    )
    transcript = " ".join(segment.text.strip() for segment in segments).strip()
    return transcript, info.language, info.duration


@router.post("/transcribe", summary="Transcribe speech audio clip")
async def transcribe_voice(
    audio: Optional[UploadFile] = File(None, description="Recorded voice clip (WAV/WEBM/MP3, up to 25 MB)"),
    language_hint: Optional[str] = Form("en", description="Language code hint (en, hi, bn)")
):
    """
    Transcribes audio locally with the multilingual Whisper small model.
    """
    if audio is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio clip provided. Please record audio and try again."
        )

    content = await audio.read(MAX_AUDIO_BYTES + 1)
    if not content or len(content) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio clip is empty or too short for speech transcription."
        )

    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio clip exceeds the 25 MB limit."
        )

    mime_type = (audio.content_type or "audio/webm").split(";", 1)[0].lower()
    suffix = {
        "audio/webm": ".webm",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".mp4",
        "audio/ogg": ".ogg",
    }.get(mime_type, ".audio")
    language = language_hint if language_hint in {"en", "hi", "bn"} else None
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_audio:
            temp_audio.write(content)
            temp_path = temp_audio.name
        transcribed_text, detected_language, duration = await asyncio.to_thread(
            _transcribe_file, temp_path, language
        )

        if not transcribed_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not transcribe clear speech from the audio recording."
            )

        return {
            "transcript": transcribed_text,
            "language_detected": detected_language,
            "duration_seconds": round(duration, 2),
            "model": WHISPER_MODEL_ID,
            "is_demo_data": False
        }
    except HTTPException:
        raise
    except ModuleNotFoundError as exc:
        logger.exception("Whisper dependency is missing")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Whisper dependencies are missing. Install backend requirements and restart the backend."
        ) from exc
    except PermissionError as exc:
        cache_path = _configure_model_cache()
        logger.exception("Whisper cannot write to its model cache at %s", cache_path)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Whisper cannot write to its model cache ({cache_path}). Set HF_HUB_CACHE to a writable folder and restart the backend."
        ) from exc
    except Exception as exc:
        logger.exception("Local Whisper transcription failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Whisper could not load its model or process the recording. Check backend logs; first use needs internet access to download the model."
        ) from exc
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
