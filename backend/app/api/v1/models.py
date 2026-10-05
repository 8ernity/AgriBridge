"""Model Registry API endpoints for AgriBridge."""
from fastapi import APIRouter, HTTPException
from app.services.model_registry_service import model_registry_service

router = APIRouter(prefix="/models", tags=["Model Registry & Transparency"])


@router.get("", summary="List all deployed AI models in the registry")
def list_models():
    """Returns summary metadata for all registered diagnostic and embedding models."""
    return model_registry_service.list_models()


@router.get("/{model_id}/card", summary="Retrieve complete Model Card")
def get_model_card(model_id: str):
    """
    Returns full DPG-compliant Model Card: task, classes, training dataset,
    validation benchmarks (lab vs field), calibration metrics, and licenses.
    """
    card = model_registry_service.get_card(model_id)
    if not card:
        raise HTTPException(
            status_code=404,
            detail=f"Model card for '{model_id}' not found in registry."
        )
    return card
