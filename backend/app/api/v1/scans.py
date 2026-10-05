"""Crop disease scan and diagnostic triage API endpoints for AgriBridge."""
import json
import datetime
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.db import get_db
from app.models.entities import Scan
from app.schemas.entities import ScanResponse
from app.services.classifier_service import diagnose_leaf_image, _unknown_scan_response

router = APIRouter(prefix="/scans", tags=["AI Disease Diagnosis"])
logger = logging.getLogger(__name__)


@router.post("", response_model=ScanResponse, summary="Analyze crop leaf photo for disease diagnosis")
async def analyze_leaf(
    file: UploadFile = File(..., description="Crop leaf photo (JPEG/PNG)"),
    crop_hint: Optional[str] = Form(None, description="Optional crop hint (tomato, potato, maize, bell_pepper)"),
    plot_id: Optional[str] = Form(None, description="Optional plot identifier"),
    language: Optional[str] = Form("en", description="Client language code (en, hi, bn, sw)"),
    db: Session = Depends(get_db)
):
    """
    Runs local ONNX classification, then requests cautious Gemma 4 guidance only for confident predictions when configured.
    """
    # Max size check: 8MB limit (PRD Section 7)
    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file exceeds 8 MB maximum limit.")

    try:
        scan_result = await run_in_threadpool(
            diagnose_leaf_image,
            image_bytes=contents,
            crop_hint=crop_hint,
            plot_id=plot_id,
            language=language or "en"
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as err:
        logger.exception("Unexpected crop scan failure")
        scan_result = _unknown_scan_response(
            plot_id,
            "Unknown / Low Confidence",
            retake_guidance="The scan could not be completed reliably. Retake a clear close-up photo or consult your local KVK before acting.",
        )

    # Persist scan result to database
    try:
        new_scan = Scan(
            id=scan_result.scan_id,
            plot_id=plot_id,
            crop=scan_result.crop,
            top_disease=scan_result.top_disease,
            confidence=scan_result.confidence,
            status=scan_result.status,
            predictions_json=json.dumps([p.model_dump() for p in scan_result.predictions]),
            retake_guidance=scan_result.retake_guidance,
            management_summary=scan_result.management_summary,
            sources_json=json.dumps([s.model_dump() for s in scan_result.sources]),
            model_version=scan_result.model_version,
            created_at=datetime.datetime.utcnow()
        )
        db.add(new_scan)
        db.commit()
    except Exception as db_err:
        db.rollback()
        # Non-fatal logging to ensure scan still returns even if DB has issue
        print(f"Failed to record scan in DB: {db_err}")

    return scan_result


@router.get("/{scan_id}", response_model=ScanResponse, summary="Get stored scan result")
def get_scan(scan_id: str, db: Session = Depends(get_db)):
    """Retrieve historical scan details and management advice."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    predictions = json.loads(scan.predictions_json) if scan.predictions_json else []
    sources = json.loads(scan.sources_json) if scan.sources_json else []

    return ScanResponse(
        scan_id=scan.id,
        plot_id=scan.plot_id,
        crop=scan.crop,
        top_disease=scan.top_disease,
        confidence=scan.confidence,
        status=scan.status,
        predictions=predictions,
        symptoms=[],
        causes=[],
        management_summary=scan.management_summary or "",
        cultural_practices=[],
        chemical_warning="Consult local extension services before applying commercial treatments.",
        retake_guidance=scan.retake_guidance,
        sources=sources,
        model_version=scan.model_version,
        created_at=scan.created_at.isoformat()
    )


@router.get("", summary="List recent scans")
def list_scans(limit: int = 20, db: Session = Depends(get_db)):
    """List recent diagnoses."""
    scans = db.query(Scan).order_by(Scan.created_at.desc()).limit(limit).all()
    return [
        {
            "scan_id": s.id,
            "plot_id": s.plot_id,
            "crop": s.crop,
            "top_disease": s.top_disease,
            "confidence": s.confidence,
            "status": s.status,
            "created_at": s.created_at.isoformat()
        }
        for s in scans
    ]
