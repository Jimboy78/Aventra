from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

from .routes import setup, story, state, images, debug, memory, saves
from .utils.logger import get_logger

# Load environment variables from .env without overriding existing system env vars
load_dotenv(override=False)

# Initialize logger
logger = get_logger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Aventra API",
    description="Generador de Historias Interactivas con IA",
    version="1.0.0"
)

# CORS middleware
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(setup.router, prefix="/api", tags=["setup"])
app.include_router(story.router, prefix="/api", tags=["story"])  
app.include_router(state.router, prefix="/api", tags=["state"])
app.include_router(images.router, prefix="/api", tags=["images"])
app.include_router(debug.router, prefix="/api", tags=["debug"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
app.include_router(saves.router, prefix="/api/saves", tags=["saves"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Aventra API is running", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )