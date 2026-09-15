from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal, Union
from enum import Enum


class RoleType(str, Enum):
    PLAYER = "player"
    ALLY = "ally" 
    NPC = "npc"
    ENEMY = "enemy"


class ConditionType(str, Enum):
    WOUND = "wound"
    STATUS = "status"
    AILMENT = "ailment"
    BUFF = "buff"
    DEBUFF = "debuff"


class ConditionSeverity(str, Enum):
    MINOR = "minor"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


class QuestStatus(str, Enum):
    OFFERED = "offered"
    ACCEPTED = "accepted"
    COMPLETED = "completed"
    FAILED = "failed"


class EndingType(str, Enum):
    DEATH = "death"
    DEFEAT = "defeat"
    RETIRE = "retire"
    BITTERSWEET = "bittersweet"


class DifficultyLevel(str, Enum):
    STORY = "story"
    BALANCED = "balanced"
    HARD = "hard"


class Knowledge(BaseModel):
    known: bool = True
    revealed_fields: Optional[List[str]] = None


class Condition(BaseModel):
    id: str
    type: ConditionType
    name: str
    severity: Optional[ConditionSeverity] = None
    since_turn: Optional[int] = None
    notes: Optional[str] = None
    mechanical_effects: Optional[str] = None


class Item(BaseModel):
    id: str
    name: str
    qty: Optional[int] = 1
    description: Optional[str] = None
    knowledge: Optional[Knowledge] = None


class Character(BaseModel):
    id: str
    name: str
    role: RoleType
    race: Optional[str] = None
    class_name: Optional[str] = Field(None, alias="class")
    traits: Optional[List[str]] = None
    health: Optional[int] = Field(None, ge=0, le=100)
    notes: Optional[str] = None
    conditions: Optional[List[Condition]] = None
    alive: Optional[bool] = True
    knowledge: Optional[Knowledge] = None
    # Campos específicos para NPCs
    tags: Optional[List[str]] = None
    shop: Optional[Dict[str, Any]] = None
    quests_offered: Optional[List[Dict[str, Any]]] = None
    reputation: Optional[Dict[str, int]] = None


class Monster(BaseModel):
    id: str
    name: str
    threat_level: Literal[1, 2, 3, 4, 5]
    health: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None
    knowledge: Optional[Knowledge] = None
    conditions: Optional[List[Condition]] = None


class QuestObjective(BaseModel):
    id: str
    text: str
    done: bool = False


class Quest(BaseModel):
    id: str
    title: str
    giver_id: Optional[str] = None
    status: QuestStatus
    objectives: Optional[List[QuestObjective]] = None
    rewards: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class JournalEntry(BaseModel):
    id: str
    turn: int
    text: str
    tags: Optional[List[str]] = None


class Scene(BaseModel):
    id: str
    title: str
    location: Optional[str] = None
    mood: Optional[str] = None


class World(BaseModel):
    name: Optional[str] = None
    genre: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[List[str]] = None
    tone: Optional[str] = None


class StoryPosition(BaseModel):
    chapter: int = 1
    turn: int = 0


class Ending(BaseModel):
    type: EndingType
    summary: str
    cause: Optional[str] = None


class GameState(BaseModel):
    is_game_over: bool = False
    ending: Optional[Ending] = None
    difficulty: Optional[DifficultyLevel] = DifficultyLevel.BALANCED


class State(BaseModel):
    scene: Scene
    world: Optional[World] = None
    characters: List[Character] = []
    inventory: List[Item] = []
    monsters: List[Monster] = []
    quests: Optional[List[Quest]] = None
    journal: Optional[List[JournalEntry]] = None
    flags: Dict[str, Union[bool, int, str]] = {}
    story_position: StoryPosition = StoryPosition()
    memory_summary: str = ""
    game: GameState = GameState()
    schema_version: Optional[str] = "1.0"


# Player setup models
class PlayerSetup(BaseModel):
    name: str
    race: Optional[str] = None
    class_name: Optional[str] = Field(None, alias="class")
    traits: Optional[List[str]] = None
    backstory: Optional[str] = None


class WorldSetup(BaseModel):
    name: Optional[str] = None
    genre: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[List[str]] = None
    tone: Optional[str] = None
    lethality: Optional[DifficultyLevel] = DifficultyLevel.BALANCED


# Debug models
class DebugConfig(BaseModel):
    enabled: Optional[bool] = False
    level: Optional[Literal["basic", "verbose", "trace"]] = "basic"
    include: Optional[Dict[str, bool]] = {
        "prompts": False,
        "state_patches": False,
        "memory_ops": False,
        "risk_resolution": False,
        "timing": False
    }


class RNG(BaseModel):
    seed: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None