#!/usr/bin/env python3
"""
Aventra Backend Server
Generador de Historias Interactivas con IA

Para ejecutar el servidor:
python main.py

O con uvicorn directamente:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import os
import sys
import asyncio
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

import uvicorn
from dotenv import load_dotenv, dotenv_values
from app.main import app
from app.utils.logger import get_logger

logger = get_logger(__name__)


def main():
    """Main entry point for the server"""
    # Ensure .env from backend/ is loaded regardless of CWD
    try:
        env_path = Path(__file__).parent / ".env"
        load_dotenv(dotenv_path=env_path, override=False)
        # Ensure .env OPENAI_API_KEY takes precedence (user preference)
        env_values = dotenv_values(env_path)
        if env_values.get("OPENAI_API_KEY"):
            os.environ["OPENAI_API_KEY"] = env_values["OPENAI_API_KEY"]  # prefer .env key
    except Exception:
        # Non-fatal; app.main also attempts to load .env
        pass

    # Check for required environment variables
    required_env_vars = ["OPENAI_API_KEY"]
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.warning(f"Missing required environment variables: {missing_vars}")
        logger.warning("Please set them in your .env file or environment")
        logger.info("The server will start but some features may not work properly")
    
    # Configuration
    host = os.environ.get("HOST", os.getenv("HOST", "0.0.0.0"))
    port = int(os.environ.get("PORT") or os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    logger.info(f"Starting Aventra Backend Server on {host}:{port}")
    logger.info(f"Debug mode: {debug}")
    # Log masked key presence for diagnostics
    try:
        key = os.getenv("OPENAI_API_KEY")
        masked = (key[:4] + "***" + key[-4:]) if key and len(key) > 8 else ("****" if key else "Not Set")
        logger.info(f"OPENAI_API_KEY detected: {masked}")
    except Exception:
        pass
    
    # Run the server
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="debug" if debug else "info",
        access_log=debug
    )


if __name__ == "__main__":
    main()