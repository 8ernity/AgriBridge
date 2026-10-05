"""Country configuration API endpoints for AgriBridge."""
from fastapi import APIRouter, HTTPException
from app.services.country_service import country_service

router = APIRouter(prefix="/config", tags=["Country Configurations & Interoperability"])


@router.get("", summary="List available configuration profiles")
def list_countries():
    """Returns the available India configuration profile."""
    return country_service.list_countries()


@router.get("/{country}", summary="Retrieve configuration for a specific country")
def get_country_config(country: str):
    """
    Returns crops, languages, default coordinates, and extension details for the specified country.
    Returns the India configuration used by this application.
    """
    cfg = country_service.get_config(country)
    if not cfg:
        raise HTTPException(
            status_code=404,
            detail=f"Country configuration for '{country}' not found. Supported: IN"
        )
    return cfg
