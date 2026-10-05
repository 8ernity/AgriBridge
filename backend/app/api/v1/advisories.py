"""RAG Advisory dialogue API endpoints with SSE streaming and feedback for AgriBridge."""
import json
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.entities import Advisory, Plot
from app.schemas.entities import (
    AdvisoryRequest,
    AdvisoryResponse,
    FeedbackRequest
)
from app.adapters.weather import get_plot_weather
from app.adapters.soil import get_plot_soil
from app.services.advisory_service import (
    generate_advisory_response,
    stream_advisory_chunks
)

router = APIRouter(prefix="/advisories", tags=["RAG Agronomic Advisory"])


async def _assemble_plot_contexts(plot_id: Optional[str], db: Session):
    plot_ctx = None
    weather_ctx = None
    soil_ctx = None

    if plot_id:
        p = db.query(Plot).filter(Plot.id == plot_id).first()
        if p:
            plot_ctx = {"id": p.id, "name": p.name, "crop": p.crop, "lat": p.lat, "lon": p.lon}
            try:
                w = await get_plot_weather(p.lat, p.lon)
                weather_ctx = w.model_dump()
            except Exception:
                pass
            try:
                s = await get_plot_soil(p.lat, p.lon)
                soil_ctx = s.model_dump()
            except Exception:
                pass

    return plot_ctx, weather_ctx, soil_ctx


@router.post("", summary="Ask agronomic advisory question (Supports SSE Streaming)")
async def ask_advisory(
    request: AdvisoryRequest,
    stream: bool = Query(False, description="Enable Server-Sent Events (SSE) token streaming"),
    db: Session = Depends(get_db)
):
    """
    Submits an agronomic question grounded in plot context, live weather, and SoilGrids data.
    Cites source documents and enforces strict safety guardrails against unvetted chemical recommendations.
    """
    plot_ctx, weather_ctx, soil_ctx = await _assemble_plot_contexts(request.plot_id, db)

    if stream:
        return StreamingResponse(
            stream_advisory_chunks(request, plot_ctx, weather_ctx, soil_ctx),
            media_type="text/event-stream"
        )

    # Standard JSON response
    res = generate_advisory_response(request, plot_ctx, weather_ctx, soil_ctx)

    # Store in database
    try:
        new_adv = Advisory(
            id=res.advisory_id,
            plot_id=request.plot_id,
            scan_id=request.scan_id,
            question=request.question,
            answer=res.answer,
            sources_json=json.dumps([s.model_dump() for s in res.sources]),
            language=res.language,
            created_at=datetime.datetime.utcnow()
        )
        db.add(new_adv)
        db.commit()
    except Exception as db_err:
        db.rollback()
        print(f"Error persisting advisory: {db_err}")

    return res


@router.post("/{advisory_id}/feedback", summary="Submit feedback for advisory answer")
def submit_feedback(
    advisory_id: str,
    feedback_in: FeedbackRequest,
    db: Session = Depends(get_db)
):
    """FR-5.6: Helpful or not-helpful feedback with optional reason for model improvement."""
    adv = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not adv:
        raise HTTPException(status_code=404, detail="Advisory interaction not found")

    adv.feedback = feedback_in.feedback
    adv.feedback_reason = feedback_in.reason
    db.commit()
    return {"status": "success", "message": "Feedback recorded. Thank you for improving AgriBridge!"}
