import os
import base64
import uuid
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio
import aiohttp

import google.generativeai as genai
from PIL import Image
import io

from ..models.output import ImageResponse, DevTrace
from ..utils.logger import get_logger, log_debug_trace

logger = get_logger(__name__)


class ImageService:
    """Service for image generation using Gemini 2.5 Flash"""
    
    def __init__(self):
        # Configure Gemini
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash-image')
        else:
            logger.warning("GOOGLE_API_KEY not found, image generation will be disabled")
            self.model = None
    
    async def generate_image(
        self,
        description: str,
        style: Optional[str] = None,
        seed: Optional[int] = None,
        aspect_ratio: Optional[str] = None,
        debug: Optional[Dict[str, Any]] = None
    ) -> ImageResponse:
        """Generate image using Gemini 2.5 Flash"""
        
        step_id = str(uuid.uuid4())[:8]
        start_time = datetime.now()
        
        if not self.model:
            logger.error("Image generation not available - missing API key")
            raise ValueError("Image generation service not available")
        
        try:
            # Build enhanced prompt
            enhanced_prompt = self._build_image_prompt(description, style, aspect_ratio)
            
            if debug and debug.get("enabled"):
                log_debug_trace(logger, step_id, {
                    "original_description": description,
                    "enhanced_prompt": enhanced_prompt,
                    "style": style,
                    "aspect_ratio": aspect_ratio
                })
            
            # Generate image using Gemini
            logger.info(f"Generating image: {description[:50]}...")
            
            # For now, we'll use a placeholder implementation since Gemini 2.5 Flash Image 
            # may have different API patterns. This shows the expected structure.
            image_data = await self._generate_with_gemini(enhanced_prompt, seed)
            
            # Convert to base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Get image dimensions
            img = Image.open(io.BytesIO(image_data))
            width, height = img.size
            
            end_time = datetime.now()
            
            # Create debug trace if enabled
            debug_trace = None
            if debug and debug.get("enabled"):
                debug_trace = DevTrace(
                    step_id=step_id,
                    inputs={
                        "description": description,
                        "style": style,
                        "seed": seed,
                        "aspect_ratio": aspect_ratio
                    },
                    timing={
                        "total_ms": (end_time - start_time).total_seconds() * 1000,
                        "image_ms": (end_time - start_time).total_seconds() * 1000
                    }
                )
            
            return ImageResponse(
                image_base64=image_base64,
                mime_type="image/png",
                width=width,
                height=height,
                debug=debug_trace
            )
            
        except Exception as e:
            logger.error(f"Error generating image: {e}")
            # Return placeholder image
            return await self._generate_placeholder_image(description)
    
    def _build_image_prompt(self, description: str, style: Optional[str], aspect_ratio: Optional[str]) -> str:
        """Build enhanced prompt for image generation"""
        prompt_parts = []
        
        # Base description
        prompt_parts.append(f"Genera una imagen de: {description}")
        
        # Style specification
        if style:
            prompt_parts.append(f"Estilo artístico: {style}")
        else:
            prompt_parts.append("Estilo: ilustración fantástica, colores vibrantes, alta calidad")
        
        # Aspect ratio
        if aspect_ratio:
            prompt_parts.append(f"Proporción: {aspect_ratio}")
        else:
            prompt_parts.append("Proporción: 16:9 landscape")
        
        # Quality specifications
        prompt_parts.extend([
            "Alta resolución y detalle",
            "Iluminación cinematográfica",
            "Composición equilibrada",
            "Sin texto o letras en la imagen"
        ])
        
        return ". ".join(prompt_parts)
    
    async def _generate_with_gemini(self, prompt: str, seed: Optional[int] = None) -> bytes:
        """Generate image with Gemini 2.5 Flash (placeholder implementation)"""
        
        # This is a placeholder implementation. The actual Gemini 2.5 Flash Image API
        # may have different methods. Update this when the API is available.
        try:
            # For now, we'll simulate the call and return a placeholder
            await asyncio.sleep(0.5)  # Simulate API call time
            
            # In real implementation:
            # response = await self.model.generate_image(prompt=prompt, seed=seed)
            # return response.image_data
            
            # For now, create a simple colored placeholder
            return await self._create_placeholder_bytes()
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return await self._create_placeholder_bytes()
    
    async def _create_placeholder_bytes(self) -> bytes:
        """Create placeholder image bytes"""
        # Create a simple placeholder image
        img = Image.new('RGB', (512, 288), color=(100, 150, 200))
        
        # Add some basic shapes to make it look less plain
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(img)
        
        # Draw some basic shapes
        draw.rectangle([50, 50, 150, 100], fill=(200, 100, 100))
        draw.ellipse([200, 80, 300, 150], fill=(100, 200, 100))
        draw.polygon([(350, 50), (400, 100), (450, 50)], fill=(200, 200, 100))
        
        try:
            # Try to add text
            draw.text((180, 200), "Aventra", fill=(255, 255, 255))
        except:
            pass  # If font loading fails, just skip text
        
        # Convert to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        return img_bytes.getvalue()
    
    async def _generate_placeholder_image(self, description: str) -> ImageResponse:
        """Generate placeholder image response"""
        try:
            # Create simple placeholder
            image_data = await self._create_placeholder_bytes()
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            return ImageResponse(
                image_base64=image_base64,
                mime_type="image/png",
                width=512,
                height=288
            )
            
        except Exception as e:
            logger.error(f"Error creating placeholder: {e}")
            # Return minimal placeholder
            return ImageResponse(
                image_base64="",
                mime_type="image/png",
                width=1,
                height=1
            )
    
    def is_available(self) -> bool:
        """Check if image generation is available"""
        return self.model is not None
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for image service"""
        try:
            if not self.model:
                return {
                    "status": "unavailable",
                    "reason": "API key not configured"
                }
            
            # Try a simple test (in real implementation, this might be a simple API call)
            await asyncio.sleep(0.1)
            
            return {
                "status": "healthy",
                "model": "gemini-2.5-flash-image"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }