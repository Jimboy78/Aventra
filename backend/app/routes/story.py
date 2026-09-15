from fastapi import APIRouter, HTTPException
from ..models.output import GenerateStoryRequest, GenerateStoryResponse
from ..services.game_service import GameService
from ..utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)
game_service = GameService()


@router.post("/generate-story", response_model=GenerateStoryResponse)
async def generate_story(request: GenerateStoryRequest):
    """Generate story continuation based on user input"""
    try:
        logger.info(f"Generating story for user input: {request.user_input[:50]}...")
        
        # Generate story continuation
        result = await game_service.generate_story(
            user_input=request.user_input,
            state=request.state,
            session_id=request.session_id,
            rng=request.rng,
            debug=request.debug
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating story: {e}")
        raise HTTPException(status_code=500, detail=str(e))