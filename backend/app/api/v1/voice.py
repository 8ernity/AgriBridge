"""Local Whisper transcription endpoint for multilingual farmer queries."""
import asyncio
import logging
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


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        with _whisper_model_lock:
            if _whisper_model is None:
                from faster_whisper import WhisperModel
                _whisper_model = WhisperModel(WHISPER_MODEL_ID, device="cpu", compute_type="int8")
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
    except Exception:
        logger.exception("Local Whisper transcription failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Local Whisper is unavailable. Install backend requirements and allow the model to download on first use."
        )
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
