from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import os

from ..utils.debug import get_performance_stats
from ..utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/debug/performance")
async def get_performance_statistics():
    """Get performance statistics for debugging"""
    try:
        logger.info("Getting performance statistics")
        
        stats = get_performance_stats()
        
        return {
            "status": "success",
            "statistics": stats,
            "message": "Performance statistics retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error getting performance statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug/health")
async def debug_health_check():
    """Debug-specific health check with detailed information"""
    try:
        from ..services.image_service import ImageService
        
        # Check image service
        image_service = ImageService()
        image_health = await image_service.health_check()
        
        # Get basic stats
        stats = get_performance_stats()
        
        health_info = {
            "status": "healthy",
            "services": {
                "image_generation": image_health,
                "performance_monitoring": {
                    "status": "active",
                    "tracked_metrics": list(stats.keys())
                }
            },
            "metrics_summary": {
                metric: stats[metric].get("count", 0) 
                for metric in stats.keys()
            }
        }
        
        return health_info
        
    except Exception as e:
        logger.error(f"Error in debug health check: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/debug/clear-metrics")
async def clear_performance_metrics():
    """Clear all performance metrics (debug only)"""
    try:
        logger.info("Clearing performance metrics")
        
        from ..utils.debug import performance_monitor
        performance_monitor.metrics.clear()
        
        return {
            "status": "success",
            "message": "Performance metrics cleared successfully"
        }
        
    except Exception as e:
        logger.error(f"Error clearing metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug/env")
async def debug_env():
    """Return masked env info to verify configuration (safe for local use)."""
    try:
        def mask(value: str | None) -> str:
            if not value:
                return "Not Set"
            if len(value) <= 8:
                return "****"
            return value[:4] + "***" + value[-4:]

        info = {
            "openai": {
                "OPENAI_API_KEY": mask(os.getenv("OPENAI_API_KEY")),
                "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                "OPENAI_ORG_ID": os.getenv("OPENAI_ORG_ID") or "Not Set",
                "OPENAI_PROJECT": os.getenv("OPENAI_PROJECT") or "Not Set",
                "OPENAI_BASE_URL": os.getenv("OPENAI_BASE_URL") or "default",
            },
            "fallback": {
                "FALLBACK_API_KEY": mask(os.getenv("FALLBACK_API_KEY")),
                "FALLBACK_MODEL": os.getenv("FALLBACK_MODEL") or "inherit",
                "FALLBACK_BASE_URL": os.getenv("FALLBACK_BASE_URL") or "Not Set",
                "enabled": bool(os.getenv("FALLBACK_API_KEY") or os.getenv("FALLBACK_BASE_URL")),
            },
            "server": {
                "HOST": os.getenv("HOST", "0.0.0.0"),
                "PORT": os.getenv("PORT", "8000"),
                "DEBUG": os.getenv("DEBUG", "false"),
            },
            "images": {
                "GOOGLE_API_KEY": mask(os.getenv("GOOGLE_API_KEY")),
            },
        }

        return {"status": "ok", "env": info}
    except Exception as e:
        logger.error(f"Error in debug env endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))