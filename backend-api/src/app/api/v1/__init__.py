"""API v1 routes."""

from fastapi import APIRouter

from .compositions import router as compositions_router
from .config import router as config_router
from .folders import router as folders_router
from .health import router as health_router
from .jobs import router as jobs_router
from .media import router as media_router
from .projects import router as projects_router
from .prompts import router as prompts_router
from .replicate import router as replicate_router
from .test import router as test_router
from .websocket import router as websocket_router

# Create main v1 router
router = APIRouter()

# Include sub-routers
router.include_router(health_router, tags=["health"])
router.include_router(compositions_router, prefix="/compositions", tags=["compositions"])
router.include_router(folders_router, prefix="/folders", tags=["folders"])
router.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
router.include_router(media_router, prefix="/media", tags=["media"])
router.include_router(projects_router, prefix="/projects", tags=["projects"])
router.include_router(prompts_router, prefix="/prompts", tags=["prompts"])
router.include_router(config_router, prefix="/config", tags=["config"])
router.include_router(replicate_router, prefix="/replicate", tags=["replicate"])
router.include_router(test_router)  # Test routes with /test prefix
router.include_router(websocket_router)  # WebSocket routes with full paths

__all__ = ["router"]
