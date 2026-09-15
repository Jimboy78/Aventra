from fastapi import APIRouter, HTTPException
from ..models.output import UpdateStateRequest, UpdateStateResponse
from ..models.state import State
from ..services.state_service import StateService
from ..utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)
state_service = StateService()


@router.post("/update-state", response_model=UpdateStateResponse)
async def update_state(request: UpdateStateRequest):
    """Update game state with JSON patches"""
    try:
        logger.info("Updating game state")
        
        # Apply state patches
        updated_state = await state_service.apply_patches(
            state=request.state,
            patches=request.patch
        )
        
        return UpdateStateResponse(state=updated_state)
        
    except Exception as e:
        logger.error(f"Error updating state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/player-view")
async def get_player_view_state(session_id: str):
    """Get player view of current state (with knowledge filtering)"""
    try:
        logger.info(f"Getting player view state for session: {session_id}")
        
        # Get player view state
        player_view = await state_service.get_player_view(session_id)
        
        return player_view
        
    except Exception as e:
        logger.error(f"Error getting player view state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/player-view/character")
async def get_player_character(session_id: str):
    """Get player character sheet"""
    try:
        logger.info(f"Getting player character for session: {session_id}")
        
        # Get player character
        character = await state_service.get_player_character(session_id)
        
        return character
        
    except Exception as e:
        logger.error(f"Error getting player character: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/player-view/inventory")
async def get_inventory(session_id: str):
    """Get player inventory"""
    try:
        logger.info(f"Getting inventory for session: {session_id}")
        
        # Get inventory
        inventory = await state_service.get_inventory(session_id)
        
        return inventory
        
    except Exception as e:
        logger.error(f"Error getting inventory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/player-view/monster/{monster_id}")
async def get_monster(session_id: str, monster_id: str):
    """Get monster information with knowledge filtering"""
    try:
        logger.info(f"Getting monster {monster_id} for session: {session_id}")
        
        # Get monster info
        monster = await state_service.get_monster(session_id, monster_id)
        
        return monster
        
    except Exception as e:
        logger.error(f"Error getting monster: {e}")
        raise HTTPException(status_code=500, detail=str(e))