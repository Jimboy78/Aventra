from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import Optional, List
from pydantic import BaseModel

from ..models.state import State
from ..services.save_service import SaveService
from ..utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)
save_service = SaveService()


# ==================== REQUEST/RESPONSE MODELS ====================

class SaveGameRequest(BaseModel):
    state: State
    session_id: str
    title: Optional[str] = None
    auto_save: bool = False


class SaveGameResponse(BaseModel):
    success: bool
    save_id: Optional[str] = None
    title: Optional[str] = None
    auto_save: bool = False
    saved_at: Optional[str] = None
    error: Optional[str] = None


class LoadGameResponse(BaseModel):
    success: bool
    save_id: Optional[str] = None
    state: Optional[State] = None
    session_id: Optional[str] = None
    metadata: Optional[dict] = None
    loaded_at: Optional[str] = None
    error: Optional[str] = None


class SaveMetadata(BaseModel):
    save_id: str
    title: str
    player_name: str
    world_name: str
    chapter: int
    turn: int
    location: str
    created_at: str
    updated_at: str
    thumbnail_description: str = ""
    game_over: bool = False
    auto_save: bool = False
    file_size: int = 0


class DeleteSaveResponse(BaseModel):
    success: bool
    save_id: Optional[str] = None
    deleted_at: Optional[str] = None
    error: Optional[str] = None


# ==================== SAVE/LOAD ENDPOINTS ====================

@router.post("/save-game", response_model=SaveGameResponse)
async def save_game(request: SaveGameRequest):
    """Save a game session with metadata"""
    try:
        logger.info(f"Saving game for session {request.session_id}")
        
        result = await save_service.save_game(
            state=request.state,
            session_id=request.session_id,
            title=request.title,
            auto_save=request.auto_save
        )
        
        return SaveGameResponse(**result)
        
    except Exception as e:
        logger.error(f"Error in save_game endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/load-game/{save_id}", response_model=LoadGameResponse)
async def load_game(save_id: str):
    """Load a saved game session"""
    try:
        logger.info(f"Loading game: {save_id}")
        
        result = await save_service.load_game(save_id)
        
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return LoadGameResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in load_game endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/saves", response_model=List[SaveMetadata])
async def list_saves(include_auto_saves: bool = True):
    """List all available saved games"""
    try:
        logger.info("Listing saved games")
        
        saves = await save_service.list_saves(include_auto_saves=include_auto_saves)
        
        return [SaveMetadata(**save) for save in saves]
        
    except Exception as e:
        logger.error(f"Error in list_saves endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-save/{save_id}", response_model=DeleteSaveResponse)
async def delete_save(save_id: str):
    """Delete a saved game"""
    try:
        logger.info(f"Deleting save: {save_id}")
        
        result = await save_service.delete_save(save_id)
        
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return DeleteSaveResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_save endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AUTO-SAVE ENDPOINTS ====================

@router.post("/auto-save", response_model=SaveGameResponse)
async def auto_save_game(request: SaveGameRequest):
    """Perform an auto-save"""
    try:
        logger.info(f"Auto-saving game for session {request.session_id}")
        
        # Check if auto-save should be triggered
        should_save = await save_service.should_auto_save(request.state, request.session_id)
        
        if not should_save:
            return SaveGameResponse(
                success=False,
                error="Auto-save not triggered for this turn"
            )
        
        result = await save_service.auto_save_game(request.state, request.session_id)
        
        return SaveGameResponse(**result)
        
    except Exception as e:
        logger.error(f"Error in auto_save endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MANAGEMENT ENDPOINTS ====================

@router.get("/save-stats")
async def get_save_stats():
    """Get statistics about saved games"""
    try:
        stats = await save_service.get_save_stats()
        return stats
        
    except Exception as e:
        logger.error(f"Error getting save stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup-saves")
async def cleanup_saves():
    """Clean up orphaned save files"""
    try:
        logger.info("Cleaning up orphaned save files")
        
        result = await save_service.cleanup_orphaned_files()
        return result
        
    except Exception as e:
        logger.error(f"Error cleaning up saves: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== EXPORT/IMPORT ENDPOINTS ====================

@router.get("/export-save/{save_id}")
async def export_save(save_id: str):
    """Export a save file for download"""
    try:
        logger.info(f"Exporting save: {save_id}")
        
        # Check if save exists
        result = await save_service.load_game(save_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail="Save not found")
        
        # Get the save file path
        save_file_path = save_service.saves_dir / f"{save_id}.json"
        
        # Get metadata for filename
        metadata = result["metadata"]
        filename = f"aventra_save_{metadata['player_name']}_{metadata['title']}.json".replace(" ", "_")
        
        return FileResponse(
            path=str(save_file_path),
            filename=filename,
            media_type="application/json"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting save {save_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import-save")
async def import_save(file: UploadFile = File(...)):
    """Import a save file"""
    try:
        logger.info(f"Importing save file: {file.filename}")
        
        # Read uploaded file
        content = await file.read()
        
        # Save temporarily
        import tempfile
        import json
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            temp_file.write(content.decode('utf-8'))
            temp_path = temp_file.name
        
        try:
            # Import the save
            result = await save_service.import_save(temp_path)
            
            # Clean up temp file
            import os
            os.unlink(temp_path)
            
            if not result["success"]:
                raise HTTPException(status_code=400, detail=result["error"])
            
            return result
            
        except Exception as e:
            # Clean up temp file on error
            import os
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise e
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing save: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== UTILITY ENDPOINTS ====================

@router.get("/save-details/{save_id}")
async def get_save_details(save_id: str):
    """Get detailed information about a specific save"""
    try:
        result = await save_service.load_game(save_id)
        
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        
        # Return metadata and basic state info without full state
        state = result["state"]
        
        return {
            "save_id": save_id,
            "metadata": result["metadata"],
            "state_summary": {
                "scene_title": state.scene.title,
                "location": state.scene.location,
                "mood": state.scene.mood,
                "character_count": len(state.characters),
                "inventory_count": len(state.inventory),
                "monster_count": len(state.monsters),
                "quest_count": len(state.quests) if state.quests else 0,
                "chapter": state.story_position.chapter,
                "turn": state.story_position.turn,
                "game_over": state.game.is_game_over,
                "player_health": next((c.health for c in state.characters if c.role == 'player'), 100)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting save details for {save_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rename-save/{save_id}")
async def rename_save(save_id: str, new_title: str):
    """Rename a saved game"""
    try:
        logger.info(f"Renaming save {save_id} to '{new_title}'")
        
        # Load the save
        result = await save_service.load_game(save_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail="Save not found")
        
        # Update metadata
        metadata = result["metadata"]
        metadata["title"] = new_title
        metadata["updated_at"] = datetime.now().isoformat()
        
        # Save updated metadata
        from ..services.save_service import SaveGameMetadata
        metadata_obj = SaveGameMetadata.from_dict(metadata)
        
        metadata_file = save_service.metadata_dir / f"{save_id}_meta.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            import json
            json.dump(metadata_obj.to_dict(), f, indent=2, ensure_ascii=False)
        
        # Update index
        await save_service._update_save_index(save_id, metadata_obj)
        
        return {
            "success": True,
            "save_id": save_id,
            "new_title": new_title,
            "updated_at": metadata["updated_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error renaming save {save_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))