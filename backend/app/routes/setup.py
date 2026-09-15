from fastapi import APIRouter, HTTPException
from ..models.output import SetupSessionRequest, SetupSessionResponse
from ..services.game_service import GameService
from ..utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)
game_service = GameService()


@router.post("/setup-session", response_model=SetupSessionResponse)
async def setup_session(request: SetupSessionRequest):
    """Initialize a new game session with player and world setup"""
    try:
        logger.info(f"Setting up new session for player: {request.player.get('name', 'Unknown')}")
        
        # Initialize game session
        result = await game_service.setup_session(
            player=request.player,
            world=request.world,
            difficulty=request.difficulty,
            debug=request.debug
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error setting up session: {e}")
        raise HTTPException(status_code=500, detail=str(e))