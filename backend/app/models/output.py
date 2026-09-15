from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Literal
from .state import State, RNG


class RiskLevel(str):
    BAJO = "bajo"
    MEDIO = "medio"
    ALTO = "alto"


class Action(BaseModel):
    id: str
    text: str
    risk: Literal["bajo", "medio", "alto"]
    effect_hint: Optional[str] = None
    may_end_game: Optional[bool] = False


class LLMOutput(BaseModel):
    narration: str
    actions: Optional[List[Action]] = None
    image_request: Optional[str] = None


class DevTrace(BaseModel):
    step_id: str
    inputs: Dict[str, Any]
    prompt: Optional[Dict[str, Any]] = None
    llm_output_raw: Optional[str] = None
    parsed: Optional[Dict[str, Any]] = None
    state_patch: Optional[Dict[str, Any]] = None
    memory_ops: Optional[Dict[str, Any]] = None
    risk_resolution: Optional[Dict[str, Any]] = None
    timing: Optional[Dict[str, Any]] = None
    warnings: Optional[List[str]] = None


class ImageResponse(BaseModel):
    image_base64: str
    mime_type: str
    width: int
    height: int
    debug: Optional[DevTrace] = None


# API Request models
class SetupSessionRequest(BaseModel):
    player: Dict[str, Any]
    world: Dict[str, Any]
    difficulty: Optional[Literal["story", "balanced", "hard"]] = "balanced"
    debug: Optional[Dict[str, Any]] = None


class GenerateStoryRequest(BaseModel):
    user_input: str
    state: State
    session_id: Optional[str] = None
    rng: Optional[RNG] = None
    debug: Optional[Dict[str, Any]] = None


class UpdateStateRequest(BaseModel):
    state: State
    patch: List[Dict[str, Any]]


class GenerateImageRequest(BaseModel):
    description: str
    style: Optional[str] = None
    seed: Optional[int] = None
    aspect_ratio: Optional[str] = None


# API Response models
class SetupSessionResponse(BaseModel):
    state: State
    intro: LLMOutput
    debug: Optional[DevTrace] = None


class GenerateStoryResponse(BaseModel):
    text: str
    actions: Optional[List[Action]] = None
    image_base64: Optional[str] = None
    debug: Optional[DevTrace] = None


class UpdateStateResponse(BaseModel):
    state: State