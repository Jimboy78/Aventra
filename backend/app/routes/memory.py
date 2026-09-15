from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from ..services.memory_service import MemoryService
from ..utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)
memory_service = MemoryService()


class SearchMemoriesRequest(BaseModel):
    session_id: str
    query: str
    memory_types: Optional[List[str]] = None
    limit: int = 5


class MemorySearchResponse(BaseModel):
    memories: List[Dict[str, Any]]
    total_found: int


class MemoryStatsResponse(BaseModel):
    total_memories: int
    by_type: Dict[str, int]
    session_id: str


@router.post("/search", response_model=MemorySearchResponse)
async def search_memories(request: SearchMemoriesRequest):
    """Search for relevant memories using semantic similarity"""
    try:
        if not memory_service.enabled:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Memoria vectorial deshabilitada")
        logger.info(f"Searching memories for session {request.session_id}: {request.query}")
        
        memories = await memory_service.search_relevant_memories(
            session_id=request.session_id,
            query=request.query,
            memory_types=request.memory_types,
            limit=request.limit
        )
        
        return MemorySearchResponse(
            memories=memories,
            total_found=len(memories)
        )
        
    except Exception as e:
        logger.error(f"Error searching memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent/{session_id}", response_model=MemorySearchResponse)
async def get_recent_memories(
    session_id: str,
    limit: int = Query(10, ge=1, le=50)
):
    """Get recent memories chronologically"""
    try:
        if not memory_service.enabled:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Memoria vectorial deshabilitada")
        logger.info(f"Getting recent memories for session {session_id}")
        
        memories = await memory_service.get_recent_memories(
            session_id=session_id,
            limit=limit
        )
        
        return MemorySearchResponse(
            memories=memories,
            total_found=len(memories)
        )
        
    except Exception as e:
        logger.error(f"Error getting recent memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/{session_id}", response_model=MemoryStatsResponse)
async def get_memory_stats(session_id: str):
    """Get memory statistics for a session"""
    try:
        if not memory_service.enabled:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Memoria vectorial deshabilitada")
        logger.info(f"Getting memory stats for session {session_id}")
        
        stats = memory_service.get_memory_stats(session_id)
        
        return MemoryStatsResponse(
            total_memories=stats.get("total_memories", 0),
            by_type=stats.get("by_type", {}),
            session_id=session_id
        )
        
    except Exception as e:
        logger.error(f"Error getting memory stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chapter-summary/{session_id}/{chapter}")
async def get_chapter_summary(session_id: str, chapter: int):
    """Get or generate chapter summary"""
    try:
        if not memory_service.enabled:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Memoria vectorial deshabilitada")
        logger.info(f"Getting chapter {chapter} summary for session {session_id}")
        
        summary = await memory_service.summarize_chapter(
            session_id=session_id,
            chapter=chapter,
            max_memories=20
        )
        
        return {"chapter": chapter, "summary": summary}
        
    except Exception as e:
        logger.error(f"Error getting chapter summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cleanup/{session_id}")
async def cleanup_session_memories(session_id: str):
    """Clean up all memories for a session"""
    try:
        if not memory_service.enabled:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Memoria vectorial deshabilitada")
        logger.info(f"Cleaning up memories for session {session_id}")
        
        await memory_service.cleanup_session(session_id)
        
        return {"message": f"Memories cleaned up for session {session_id}"}
        
    except Exception as e:
        logger.error(f"Error cleaning up session memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))