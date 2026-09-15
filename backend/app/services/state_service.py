from typing import Dict, Any, List, Optional
import json
from copy import deepcopy

from ..models.state import State, Character, Monster, Item
from ..utils.logger import get_logger
from ..utils.json_patch import JSONPatcher

logger = get_logger(__name__)


class StateService:
    """Service for managing game state operations"""
    
    def __init__(self):
        # In-memory storage for now (should be replaced with persistent storage)
        self.sessions: Dict[str, State] = {}
    
    async def store_session(self, session_id: str, state: State):
        """Store game session state"""
        self.sessions[session_id] = deepcopy(state)
        logger.debug(f"Stored session {session_id}")
    
    async def get_session(self, session_id: str) -> Optional[State]:
        """Get game session state"""
        return self.sessions.get(session_id)
    
    async def apply_patches(self, state: State, patches: List[Dict[str, Any]]) -> State:
        """Apply JSON patches to state"""
        try:
            # Convert state to dict
            state_dict = state.model_dump()
            
            # Apply patches using our custom patcher
            patched_dict = JSONPatcher.apply_patch(state_dict, patches)
            
            # Convert back to State model
            updated_state = State(**patched_dict)
            
            logger.debug(f"Applied {len(patches)} patches to state")
            return updated_state
            
        except Exception as e:
            logger.error(f"Error applying patches: {e}")
            raise
    
    async def get_player_view(self, session_id: str) -> Dict[str, Any]:
        """Get player view of state with knowledge filtering"""
        state = await self.get_session(session_id)
        if not state:
            raise ValueError(f"Session {session_id} not found")
        
        # Create player view with knowledge filtering
        player_view = self._apply_knowledge_filter(state)
        return player_view.model_dump()
    
    async def get_player_character(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get player character data"""
        state = await self.get_session(session_id)
        if not state:
            raise ValueError(f"Session {session_id} not found")
        
        # Find player character
        player_char = next(
            (char for char in state.characters if char.role == "player"), 
            None
        )
        
        return player_char.model_dump() if player_char else None
    
    async def get_inventory(self, session_id: str) -> List[Dict[str, Any]]:
        """Get player inventory"""
        state = await self.get_session(session_id)
        if not state:
            raise ValueError(f"Session {session_id} not found")
        
        # Filter inventory based on knowledge
        filtered_inventory = []
        for item in state.inventory:
            item_dict = item.model_dump()
            if item.knowledge and not item.knowledge.known:
                # Hide unknown items or show as "Unknown item"
                item_dict["name"] = "Objeto desconocido"
                item_dict["description"] = "?"
            filtered_inventory.append(item_dict)
        
        return filtered_inventory
    
    async def get_monster(self, session_id: str, monster_id: str) -> Optional[Dict[str, Any]]:
        """Get monster data with knowledge filtering"""
        state = await self.get_session(session_id)
        if not state:
            raise ValueError(f"Session {session_id} not found")
        
        # Find monster
        monster = next(
            (m for m in state.monsters if m.id == monster_id), 
            None
        )
        
        if not monster:
            return None
        
        # Apply knowledge filtering
        monster_dict = monster.model_dump()
        if monster.knowledge and not monster.knowledge.known:
            monster_dict["name"] = "Criatura desconocida"
            monster_dict["threat_level"] = "?"
            monster_dict["health"] = "?"
            monster_dict["notes"] = "?"
        
        return monster_dict
    
    def _apply_knowledge_filter(self, state: State) -> State:
        """Apply knowledge filtering to entire state"""
        filtered_state = deepcopy(state)
        
        # Filter characters
        for char in filtered_state.characters:
            if char.knowledge and not char.knowledge.known:
                char.name = "Personaje desconocido"
                char.notes = "?"
        
        # Filter monsters  
        for monster in filtered_state.monsters:
            if monster.knowledge and not monster.knowledge.known:
                monster.name = "Criatura desconocida"
                monster.threat_level = 1  # Default safe value
                monster.health = None
                monster.notes = "?"
        
        # Filter inventory
        for item in filtered_state.inventory:
            if item.knowledge and not item.knowledge.known:
                item.name = "Objeto desconocido"
                item.description = "?"
        
        return filtered_state
    
    def upsert_character(self, state: State, character: Character):
        """Add or update character in state"""
        existing_idx = next(
            (i for i, c in enumerate(state.characters) if c.id == character.id),
            None
        )
        
        if existing_idx is not None:
            state.characters[existing_idx] = character
        else:
            state.characters.append(character)
    
    def upsert_monster(self, state: State, monster: Monster):
        """Add or update monster in state"""
        existing_idx = next(
            (i for i, m in enumerate(state.monsters) if m.id == monster.id),
            None
        )
        
        if existing_idx is not None:
            state.monsters[existing_idx] = monster
        else:
            state.monsters.append(monster)
    
    def upsert_item(self, state: State, item: Item):
        """Add or update item in inventory"""
        existing_idx = next(
            (i for i, it in enumerate(state.inventory) if it.id == item.id),
            None
        )
        
        if existing_idx is not None:
            # Update quantity if same item
            if state.inventory[existing_idx].name == item.name:
                state.inventory[existing_idx].qty = (state.inventory[existing_idx].qty or 1) + (item.qty or 1)
            else:
                state.inventory[existing_idx] = item
        else:
            state.inventory.append(item)