from fastapi import APIRouter, HTTPException
from ..models.output import GenerateImageRequest, ImageResponse
from ..services.image_service import ImageService
from ..utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)
image_service = ImageService()


@router.post("/generate-image", response_model=ImageResponse)
async def generate_image(request: GenerateImageRequest):
    """Generate image using Gemini 2.5 Flash"""
    try:
        logger.info(f"Generating image: {request.description[:50]}...")
        
        # Generate image
        result = await image_service.generate_image(
            description=request.description,
            style=request.style,
            seed=request.seed,
            aspect_ratio=request.aspect_ratio
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating image: {e}")
        raise HTTPException(status_code=500, detail=str(e))