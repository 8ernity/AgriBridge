"""AgriBridge FastAPI Gateway Entrypoint."""
from contextlib import asynccontextmanager
import datetime
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os


load_dotenv()

from app.db import init_db
from app.api.v1.config import router as config_router
from app.api.v1.plots import router as plots_router
from app.api.v1.scans import router as scans_router
from app.api.v1.advisories import router as advisories_router
from app.api.v1.models import router as models_router
from app.api.v1.voice import router as voice_router
from app.api.v1.outbreaks import router as outbreaks_router
from app.api.v1.carbon import router as carbon_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables and cache records on application boot."""
    init_db()
    yield


app = FastAPI(
    title="🌱 AgriBridge API",
    description=(
        "Experimental India-focused agricultural software API. Disease-scan weights are disabled pending provenance verification; "
        "voice uses local Whisper, optional advisory generation uses hosted Gemma 4, and demo data is labeled."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Cross-Origin Resource Sharing (CORS) configured for mobile PWA clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health & Liveness"], summary="Check service health and version")
def health_check():
    """Liveness probe returning service status and version."""
    return {
        "status": "healthy",
        "service": "AgriBridge Backend Gateway",
        "version": "1.0.0",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "dpg_compliant": True,
        "license": "Apache-2.0"
    }


# Mount API Version 1 Routers (MUST be before catch-all route)
app.include_router(config_router, prefix="/api/v1")
app.include_router(plots_router, prefix="/api/v1")
app.include_router(scans_router, prefix="/api/v1")
app.include_router(advisories_router, prefix="/api/v1")
app.include_router(models_router, prefix="/api/v1")
app.include_router(voice_router, prefix="/api/v1")
app.include_router(outbreaks_router, prefix="/api/v1")
app.include_router(carbon_router, prefix="/api/v1")

# Serve React Frontend Static Files (catch-all MUST be last)
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'frontend', 'dist')
if os.path.isdir(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        # Serve index.html for all non-API, non-asset routes (SPA routing)
        path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(frontend_dist, 'index.html'))
    
    # Serve static files directly (not using catch-all for API routes)
    @app.get("/manifest.json", include_in_schema=False)
    async def serve_manifest():
        return FileResponse(os.path.join(frontend_dist, 'manifest.json'))
    
    @app.get("/sw.js", include_in_schema=False)
    async def serve_sw():
        return FileResponse(os.path.join(frontend_dist, 'sw.js'))
    
    @app.get("/grid.svg", include_in_schema=False)
    async def serve_grid():
        return FileResponse(os.path.join(frontend_dist, 'grid.svg'))
    
    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(os.path.join(frontend_dist, 'index.html'))
