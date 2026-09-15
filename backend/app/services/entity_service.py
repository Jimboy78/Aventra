import os
import json
import uuid
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from pathlib import Path

from ..models.state import State, Character, Item, Monster, RoleType
from ..utils.logger import get_logger

logger = get_logger(__name__)


class EntityService:
    """Service for persistent entity management (NPCs, Items, Monsters) with JSON storage"""
    
    def __init__(self):
        # Entity storage directory
        self.entities_dir = Path("./data/entities")
        self.entities_dir.mkdir(parents=True, exist_ok=True)
        
        # Entity type directories
        self.characters_dir = self.entities_dir / "characters"
        self.items_dir = self.entities_dir / "items"  
        self.monsters_dir = self.entities_dir / "monsters"
        
        for dir_path in [self.characters_dir, self.items_dir, self.monsters_dir]:
            dir_path.mkdir(exist_ok=True)
        
        # In-memory cache for quick access
        self.entity_cache: Dict[str, Dict[str, Any]] = {
            "characters": {},
            "items": {},
            "monsters": {}
        }
        
        logger.info("EntityService initialized with persistent JSON storage")
    
    # ==================== CHARACTER MANAGEMENT ====================
    
    async def save_character(self, session_id: str, character: Character) -> bool:
        """Save character to persistent JSON storage"""
        try:
            # Create character data with metadata
            character_data = {
                "id": character.id,
                "name": character.name,
                "role": character.role,
                "race": character.race,
                "class_name": character.class_name,
                "traits": character.traits or [],
                "health": character.health,
                "notes": character.notes,
                "conditions": [c.model_dump() for c in character.conditions] if character.conditions else [],
                "alive": character.alive,
                "knowledge": character.knowledge.model_dump() if character.knowledge else None,
                "tags": character.tags or [],
                "shop": character.shop,
                "quests_offered": character.quests_offered or [],
                "reputation": character.reputation,
                # Metadata
                "session_id": session_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "entity_type": "character",
                "persistence_version": "1.0"
            }
            
            # Save to file
            file_path = self.characters_dir / f"{session_id}_{character.id}.json"
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(character_data, f, indent=2, ensure_ascii=False)
            
            # Update cache
            cache_key = f"{session_id}_{character.id}"
            self.entity_cache["characters"][cache_key] = character_data
            
            logger.info(f"Saved character {character.name} ({character.id}) for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving character {character.name}: {e}")
            return False
    
    async def load_character(self, session_id: str, character_id: str) -> Optional[Character]:
        """Load character from persistent storage"""
        try:
            cache_key = f"{session_id}_{character_id}"
            
            # Check cache first
            if cache_key in self.entity_cache["characters"]:
                data = self.entity_cache["characters"][cache_key]
            else:
                # Load from file
                file_path = self.characters_dir / f"{cache_key}.json"
                if not file_path.exists():
                    return None
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Update cache
                self.entity_cache["characters"][cache_key] = data
            
            # Convert back to Character object
            from ..models.state import Condition, Knowledge
            
            conditions = []
            if data.get("conditions"):
                for cond_data in data["conditions"]:
                    conditions.append(Condition(**cond_data))
            
            knowledge = None
            if data.get("knowledge"):
                knowledge = Knowledge(**data["knowledge"])
            
            character = Character(
                id=data["id"],
                name=data["name"],
                role=RoleType(data["role"]),
                race=data.get("race"),
                class_name=data.get("class_name"),
                traits=data.get("traits"),
                health=data.get("health"),
                notes=data.get("notes"),
                conditions=conditions if conditions else None,
                alive=data.get("alive", True),
                knowledge=knowledge,
                tags=data.get("tags"),
                shop=data.get("shop"),
                quests_offered=data.get("quests_offered"),
                reputation=data.get("reputation")
            )
            
            return character
            
        except Exception as e:
            logger.error(f"Error loading character {character_id}: {e}")
            return None
    
    async def find_characters_by_name(self, session_id: str, name: str) -> List[Character]:
        """Find characters by name (supports partial matching)"""
        try:
            characters = []
            name_lower = name.lower()
            
            # Search in cache and files
            for file_path in self.characters_dir.glob(f"{session_id}_*.json"):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    if name_lower in data["name"].lower():
                        character = await self.load_character(session_id, data["id"])
                        if character:
                            characters.append(character)
                            
                except Exception as e:
                    logger.warning(f"Error reading character file {file_path}: {e}")
                    continue
            
            return characters
            
        except Exception as e:
            logger.error(f"Error finding characters by name {name}: {e}")
            return []
    
    # ==================== ITEM MANAGEMENT ====================
    
    async def save_item(self, session_id: str, item: Item) -> bool:
        """Save item to persistent JSON storage"""
        try:
            item_data = {
                "id": item.id,
                "name": item.name,
                "qty": item.qty,
                "description": item.description,
                "knowledge": item.knowledge.model_dump() if item.knowledge else None,
                # Metadata
                "session_id": session_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "entity_type": "item",
                "persistence_version": "1.0"
            }
            
            file_path = self.items_dir / f"{session_id}_{item.id}.json"
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(item_data, f, indent=2, ensure_ascii=False)
            
            # Update cache
            cache_key = f"{session_id}_{item.id}"
            self.entity_cache["items"][cache_key] = item_data
            
            logger.info(f"Saved item {item.name} ({item.id}) for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving item {item.name}: {e}")
            return False
    
    async def load_item(self, session_id: str, item_id: str) -> Optional[Item]:
        """Load item from persistent storage"""
        try:
            cache_key = f"{session_id}_{item_id}"
            
            # Check cache first
            if cache_key in self.entity_cache["items"]:
                data = self.entity_cache["items"][cache_key]
            else:
                file_path = self.items_dir / f"{cache_key}.json"
                if not file_path.exists():
                    return None
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                self.entity_cache["items"][cache_key] = data
            
            from ..models.state import Knowledge
            
            knowledge = None
            if data.get("knowledge"):
                knowledge = Knowledge(**data["knowledge"])
            
            item = Item(
                id=data["id"],
                name=data["name"],
                qty=data.get("qty"),
                description=data.get("description"),
                knowledge=knowledge
            )
            
            return item
            
        except Exception as e:
            logger.error(f"Error loading item {item_id}: {e}")
            return None
    
    async def find_items_by_name(self, session_id: str, name: str) -> List[Item]:
        """Find items by name (supports partial matching)"""
        try:
            items = []
            name_lower = name.lower()
            
            for file_path in self.items_dir.glob(f"{session_id}_*.json"):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    if name_lower in data["name"].lower():
                        item = await self.load_item(session_id, data["id"])
                        if item:
                            items.append(item)
                            
                except Exception as e:
                    continue
            
            return items
            
        except Exception as e:
            logger.error(f"Error finding items by name {name}: {e}")
            return []
    
    # ==================== MONSTER MANAGEMENT ====================
    
    async def save_monster(self, session_id: str, monster: Monster) -> bool:
        """Save monster to persistent JSON storage"""
        try:
            monster_data = {
                "id": monster.id,
                "name": monster.name,
                "threat_level": monster.threat_level,
                "health": monster.health,
                "notes": monster.notes,
                "knowledge": monster.knowledge.model_dump() if monster.knowledge else None,
                "conditions": [c.model_dump() for c in monster.conditions] if monster.conditions else [],
                # Metadata
                "session_id": session_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "entity_type": "monster",
                "persistence_version": "1.0"
            }
            
            file_path = self.monsters_dir / f"{session_id}_{monster.id}.json"
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(monster_data, f, indent=2, ensure_ascii=False)
            
            # Update cache
            cache_key = f"{session_id}_{monster.id}"
            self.entity_cache["monsters"][cache_key] = monster_data
            
            logger.info(f"Saved monster {monster.name} ({monster.id}) for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving monster {monster.name}: {e}")
            return False
    
    async def load_monster(self, session_id: str, monster_id: str) -> Optional[Monster]:
        """Load monster from persistent storage"""
        try:
            cache_key = f"{session_id}_{monster_id}"
            
            # Check cache first
            if cache_key in self.entity_cache["monsters"]:
                data = self.entity_cache["monsters"][cache_key]
            else:
                file_path = self.monsters_dir / f"{cache_key}.json"
                if not file_path.exists():
                    return None
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                self.entity_cache["monsters"][cache_key] = data
            
            from ..models.state import Condition, Knowledge
            
            conditions = []
            if data.get("conditions"):
                for cond_data in data["conditions"]:
                    conditions.append(Condition(**cond_data))
            
            knowledge = None
            if data.get("knowledge"):
                knowledge = Knowledge(**data["knowledge"])
            
            monster = Monster(
                id=data["id"],
                name=data["name"],
                threat_level=data["threat_level"],
                health=data.get("health"),
                notes=data.get("notes"),
                knowledge=knowledge,
                conditions=conditions if conditions else None
            )
            
            return monster
            
        except Exception as e:
            logger.error(f"Error loading monster {monster_id}: {e}")
            return None
    
    async def find_monsters_by_name(self, session_id: str, name: str) -> List[Monster]:
        """Find monsters by name (supports partial matching)"""
        try:
            monsters = []
            name_lower = name.lower()
            
            for file_path in self.monsters_dir.glob(f"{session_id}_*.json"):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    if name_lower in data["name"].lower():
                        monster = await self.load_monster(session_id, data["id"])
                        if monster:
                            monsters.append(monster)
                            
                except Exception as e:
                    continue
            
            return monsters
            
        except Exception as e:
            logger.error(f"Error finding monsters by name {name}: {e}")
            return []
    
    # ==================== COHERENCE AND SYNC METHODS ====================
    
    async def sync_state_entities(self, session_id: str, state: State) -> State:
        """Sync state entities with persistent storage for coherence"""
        try:
            logger.info(f"Syncing entities for session {session_id}")
            
            # Sync characters (except player)
            for i, char in enumerate(state.characters):
                if char.role != RoleType.PLAYER:
                    # Save current character state
                    await self.save_character(session_id, char)
                    
                    # Load any updates from persistent storage
                    updated_char = await self.load_character(session_id, char.id)
                    if updated_char:
                        state.characters[i] = updated_char
            
            # Sync items
            for i, item in enumerate(state.inventory):
                await self.save_item(session_id, item)
                updated_item = await self.load_item(session_id, item.id)
                if updated_item:
                    state.inventory[i] = updated_item
            
            # Sync monsters
            for i, monster in enumerate(state.monsters):
                await self.save_monster(session_id, monster)
                updated_monster = await self.load_monster(session_id, monster.id)
                if updated_monster:
                    state.monsters[i] = updated_monster
            
            logger.info(f"Entity sync completed for session {session_id}")
            return state
            
        except Exception as e:
            logger.error(f"Error syncing state entities: {e}")
            return state
    
    async def get_entity_suggestions(
        self, 
        session_id: str, 
        entity_type: str, 
        partial_name: str = ""
    ) -> List[Dict[str, Any]]:
        """Get entity suggestions for coherence (e.g., when LLM mentions an entity)"""
        try:
            suggestions = []
            
            if entity_type == "character":
                characters = await self.find_characters_by_name(session_id, partial_name)
                for char in characters:
                    suggestions.append({
                        "id": char.id,
                        "name": char.name,
                        "type": "character",
                        "role": char.role,
                        "health": char.health,
                        "alive": char.alive,
                        "summary": f"{char.name} ({char.role}) - {char.notes[:50] if char.notes else 'Sin notas'}..."
                    })
            
            elif entity_type == "item":
                items = await self.find_items_by_name(session_id, partial_name)
                for item in items:
                    suggestions.append({
                        "id": item.id,
                        "name": item.name,
                        "type": "item",
                        "qty": item.qty,
                        "summary": f"{item.name} x{item.qty or 1} - {item.description[:50] if item.description else 'Sin descripción'}..."
                    })
            
            elif entity_type == "monster":
                monsters = await self.find_monsters_by_name(session_id, partial_name)
                for monster in monsters:
                    suggestions.append({
                        "id": monster.id,
                        "name": monster.name,
                        "type": "monster",
                        "threat_level": monster.threat_level,
                        "health": monster.health,
                        "summary": f"{monster.name} (Amenaza {monster.threat_level}) - {monster.notes[:50] if monster.notes else 'Sin notas'}..."
                    })
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error getting entity suggestions: {e}")
            return []
    
    async def validate_entity_consistency(self, session_id: str, state: State) -> Dict[str, Any]:
        """Validate entity consistency between state and persistent storage"""
        try:
            inconsistencies = []
            
            # Check characters
            for char in state.characters:
                if char.role != RoleType.PLAYER:
                    stored_char = await self.load_character(session_id, char.id)
                    if stored_char:
                        if char.name != stored_char.name:
                            inconsistencies.append({
                                "type": "character_name_mismatch",
                                "entity_id": char.id,
                                "state_value": char.name,
                                "stored_value": stored_char.name
                            })
                        if char.health != stored_char.health:
                            inconsistencies.append({
                                "type": "character_health_mismatch", 
                                "entity_id": char.id,
                                "state_value": char.health,
                                "stored_value": stored_char.health
                            })
            
            # Check items
            for item in state.inventory:
                stored_item = await self.load_item(session_id, item.id)
                if stored_item and item.qty != stored_item.qty:
                    inconsistencies.append({
                        "type": "item_quantity_mismatch",
                        "entity_id": item.id,
                        "state_value": item.qty,
                        "stored_value": stored_item.qty
                    })
            
            # Check monsters
            for monster in state.monsters:
                stored_monster = await self.load_monster(session_id, monster.id)
                if stored_monster and monster.health != stored_monster.health:
                    inconsistencies.append({
                        "type": "monster_health_mismatch",
                        "entity_id": monster.id,
                        "state_value": monster.health,
                        "stored_value": stored_monster.health
                    })
            
            return {
                "consistent": len(inconsistencies) == 0,
                "inconsistencies": inconsistencies,
                "total_entities_checked": len(state.characters) + len(state.inventory) + len(state.monsters)
            }
            
        except Exception as e:
            logger.error(f"Error validating entity consistency: {e}")
            return {"consistent": False, "error": str(e)}
    
    async def cleanup_session_entities(self, session_id: str):
        """Clean up entity files for a session"""
        try:
            deleted_count = 0
            
            for entity_dir in [self.characters_dir, self.items_dir, self.monsters_dir]:
                for file_path in entity_dir.glob(f"{session_id}_*.json"):
                    try:
                        file_path.unlink()
                        deleted_count += 1
                    except Exception as e:
                        logger.warning(f"Error deleting entity file {file_path}: {e}")
            
            # Clear cache for session
            for entity_type in self.entity_cache:
                keys_to_remove = [k for k in self.entity_cache[entity_type] if k.startswith(f"{session_id}_")]
                for key in keys_to_remove:
                    del self.entity_cache[entity_type][key]
            
            logger.info(f"Cleaned up {deleted_count} entity files for session {session_id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up session entities: {e}")
    
    def get_entity_stats(self, session_id: str) -> Dict[str, Any]:
        """Get entity statistics for a session"""
        try:
            stats = {
                "characters": 0,
                "items": 0,
                "monsters": 0,
                "total": 0
            }
            
            for entity_dir, entity_type in [
                (self.characters_dir, "characters"),
                (self.items_dir, "items"),
                (self.monsters_dir, "monsters")
            ]:
                count = len(list(entity_dir.glob(f"{session_id}_*.json")))
                stats[entity_type] = count
                stats["total"] += count
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting entity stats: {e}")
            return {"error": str(e)}