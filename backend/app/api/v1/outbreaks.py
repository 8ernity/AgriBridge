"""Anonymous coarse-grid outbreak reporting and surveillance API endpoints."""
import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.db import get_db
from app.models.entities import OutbreakReport

router = APIRouter(prefix="/outbreaks", tags=["Epidemiological Surveillance (Stretch)"])


class OutbreakReportIn(BaseModel):
    lat: float
    lon: float
    crop: str
    disease: str


@router.post("/report", summary="Submit anonymous outbreak report")
def submit_report(report_in: OutbreakReportIn, db: Session = Depends(get_db)):
    """
    FR-9.1: Opt-in anonymous report after a confident scan.
    Location is rounded to a coarse grid cell (0.1 degree ~ 11 km). No exact coordinates leave the client.
    """
    cell_id = f"cell_{round(report_in.lat, 1)}_{round(report_in.lon, 1)}"
    rep = OutbreakReport(
        id=f"rep_{uuid.uuid4().hex[:8]}",
        cell_id=cell_id,
        crop=report_in.crop.lower(),
        disease=report_in.disease,
        created_at=datetime.datetime.utcnow()
    )
    db.add(rep)
    db.commit()
    return {"status": "success", "cell_id": cell_id}


@router.get("", summary="Get aggregated outbreak clusters with k-anonymity privacy")
def get_outbreak_clusters(db: Session = Depends(get_db)):
    """
    FR-9.2 & FR-9.3: Shows cell counts for the last 14 days.
    Crucial privacy constraint: Show a cell only when it has at least 3 reports (k-anonymity >= 3).
    """
    two_weeks_ago = datetime.datetime.utcnow() - datetime.timedelta(days=14)

    results = (
        db.query(
            OutbreakReport.cell_id,
            OutbreakReport.crop,
            OutbreakReport.disease,
            func.count(OutbreakReport.id).label("report_count")
        )
        .filter(OutbreakReport.created_at >= two_weeks_ago)
        .group_by(OutbreakReport.cell_id, OutbreakReport.crop, OutbreakReport.disease)
        .having(func.count(OutbreakReport.id) >= 3)
        .all()
    )

    # Baseline demonstration surveillance clusters for India if empty
    if not results:
        cells = [
            {
                "cell_id": "cell_25.3_83.0",
                "center_lat": 25.35,
                "center_lon": 82.98,
                "region": "Varanasi Agricultural Cluster (Demo Baseline)",
                "crop": "tomato",
                "disease": "Early Blight (Alternaria solani)",
                "report_count": 7,
                "alert_level": "moderate",
                "advisory": "High humidity observed; inspect lower leaf canopy for concentric rings.",
                "is_demo_data": True
            },
            {
                "cell_id": "cell_20.0_73.8",
                "center_lat": 20.01,
                "center_lon": 73.82,
                "region": "Nashik Horticultural Belt (Demo Baseline)",
                "crop": "bell_pepper",
                "disease": "Bacterial Spot (Xanthomonas)",
                "report_count": 5,
                "alert_level": "moderate",
                "advisory": "Cloudy spells and moisture detected; adopt copper-free preventive bio-agents.",
                "is_demo_data": True
            }
        ]
        return cells

    output = []
    for r in results:
        parts = r.cell_id.replace("cell_", "").split("_")
        lat = float(parts[0]) if len(parts) > 0 else 0.0
        lon = float(parts[1]) if len(parts) > 1 else 0.0
        output.append({
            "cell_id": r.cell_id,
            "center_lat": lat,
            "center_lon": lon,
            "crop": r.crop,
            "disease": r.disease,
            "report_count": r.report_count,
            "alert_level": "high" if r.report_count >= 10 else "moderate",
            "advisory": f"Cluster of {r.disease} reported in this sector."
        })
    return output
