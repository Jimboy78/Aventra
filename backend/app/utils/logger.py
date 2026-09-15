import logging
import os
from typing import Dict, Any


def get_logger(name: str) -> logging.Logger:
    """Get configured logger instance"""
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        # Configure logging level
        debug = os.getenv("DEBUG", "false").lower() == "true"
        level = logging.DEBUG if debug else logging.INFO
        logger.setLevel(level)
        
        # Create console handler
        handler = logging.StreamHandler()
        handler.setLevel(level)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        
        # Add handler to logger
        logger.addHandler(handler)
    
    return logger


def log_debug_trace(logger: logging.Logger, step_id: str, data: Dict[str, Any]):
    """Log debug trace information"""
    if logger.isEnabledFor(logging.DEBUG):
        logger.debug(f"Debug trace [{step_id}]: {data}")