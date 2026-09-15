import os
import json
import uuid
import shutil
from typing import Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path

from ..models.state import State
from ..utils.logger import get_logger

logger = get_logger(__name__)


class SaveGameMetadata:
    """Metadata for saved games"""
    
    def __init__(
        self,
        save_id: str,
        title: str,
        player_name: str,
        world_name: str,
        chapter: int,
        turn: int,
        location: str,
        created_at: str,
        updated_at: str,
        playtime_minutes: int = 0,
        thumbnail_description: str = "",
        game_over: bool = False,
        auto_save: bool = False
    ):
        self.save_id = save_id
        self.title = title
        self.player_name = player_name
        self.world_name = world_name
        self.chapter = chapter
        self.turn = turn
        self.location = location
        self.created_at = created_at
        self.updated_at = updated_at
        self.playtime_minutes = playtime_minutes
        self.thumbnail_description = thumbnail_description
        self.game_over = game_over
        self.auto_save = auto_save
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "save_id": self.save_id,
            "title": self.title,
            "player_name": self.player_name,
            "world_name": self.world_name,
            "chapter": self.chapter,
            "turn": self.turn,
            "location": self.location,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "playtime_minutes": self.playtime_minutes,
            "thumbnail_description": self.thumbnail_description,
            "game_over": self.game_over,
            "auto_save": self.auto_save,
            "version": "1.0"
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SaveGameMetadata':
        return cls(
            save_id=data["save_id"],
            title=data["title"],
            player_name=data["player_name"],
            world_name=data["world_name"],
            chapter=data["chapter"],
            turn=data["turn"],
            location=data["location"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            playtime_minutes=data.get("playtime_minutes", 0),
            thumbnail_description=data.get("thumbnail_description", ""),
            game_over=data.get("game_over", False),
            auto_save=data.get("auto_save", False)
        )


class SaveService:
    """Service for saving and loading game sessions with metadata"""
    
    def __init__(self):
        # Save directories
        self.saves_dir = Path("./data/saves")
        self.saves_dir.mkdir(parents=True, exist_ok=True)
        
        self.metadata_dir = self.saves_dir / "metadata"
        self.metadata_dir.mkdir(exist_ok=True)
        
        self.backups_dir = self.saves_dir / "backups"
        self.backups_dir.mkdir(exist_ok=True)
        
        # Save index file
        self.index_file = self.saves_dir / "save_index.json"
        
        # Auto-save settings
        self.auto_save_enabled = True
        self.auto_save_interval_turns = 5  # Auto-save every 5 turns
        self.max_auto_saves = 3  # Keep last 3 auto-saves
        
        logger.info("SaveService initialized")
    
    # ==================== SAVE GAME METHODS ====================
    
    async def save_game(
        self,
        state: State,
        session_id: str,
        title: Optional[str] = None,
        auto_save: bool = False
    ) -> Dict[str, Any]:
        """Save a complete game session with metadata"""
        try:
            # Generate save ID
            save_id = str(uuid.uuid4()) if not auto_save else f"autosave_{session_id}_{state.story_position.turn}"
            
            # Get player info
            player_char = next((c for c in state.characters if c.role == 'player'), None)
            player_name = player_char.name if player_char else "Jugador Desconocido"
            
            # Create metadata
            now = datetime.now().isoformat()
            metadata = SaveGameMetadata(
                save_id=save_id,
                title=title or f"{player_name} - {state.scene.title}",
                player_name=player_name,
                world_name=state.world.name if state.world else "Mundo Desconocido",
                chapter=state.story_position.chapter,
                turn=state.story_position.turn,
                location=state.scene.title,
                created_at=now,
                updated_at=now,
                thumbnail_description=f"En {state.scene.title}, con {len(state.inventory)} items",
                game_over=state.game.is_game_over,
                auto_save=auto_save
            )
            
            # Save game state
            save_data = {
                "metadata": metadata.to_dict(),
                "state": state.model_dump(),
                "session_id": session_id,
                "save_version": "1.0",
                "saved_at": now
            }
            
            # Write save file
            save_file = self.saves_dir / f"{save_id}.json"
            with open(save_file, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, indent=2, ensure_ascii=False)
            
            # Update metadata file
            metadata_file = self.metadata_dir / f"{save_id}_meta.json"
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata.to_dict(), f, indent=2, ensure_ascii=False)
            
            # Update save index
            await self._update_save_index(save_id, metadata)
            
            # Handle auto-save cleanup
            if auto_save:
                await self._cleanup_auto_saves(session_id)
            
            # Create backup if it's a manual save
            if not auto_save:
                await self._create_backup(save_id, save_data)
            
            logger.info(f"Game saved successfully: {save_id} ({'auto' if auto_save else 'manual'})")
            
            return {
                "success": True,
                "save_id": save_id,
                "title": metadata.title,
                "auto_save": auto_save,
                "saved_at": now
            }
            
        except Exception as e:
            logger.error(f"Error saving game: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def load_game(self, save_id: str) -> Dict[str, Any]:
        """Load a complete game session"""
        try:
            save_file = self.saves_dir / f"{save_id}.json"
            
            if not save_file.exists():
                return {
                    "success": False,
                    "error": f"Save file not found: {save_id}"
                }
            
            # Load save data
            with open(save_file, 'r', encoding='utf-8') as f:
                save_data = json.load(f)
            
            # Validate save data
            if not self._validate_save_data(save_data):
                return {
                    "success": False,
                    "error": "Invalid save data format"
                }
            
            # Convert state back to State object
            state_data = save_data["state"]
            state = State(**state_data)
            
            # Get metadata
            metadata = SaveGameMetadata.from_dict(save_data["metadata"])
            
            logger.info(f"Game loaded successfully: {save_id}")
            
            return {
                "success": True,
                "save_id": save_id,
                "state": state,
                "session_id": save_data["session_id"],
                "metadata": metadata.to_dict(),
                "loaded_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error loading game {save_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def list_saves(self, include_auto_saves: bool = True) -> List[Dict[str, Any]]:
        """List all available saved games"""
        try:
            saves = []
            
            # Load save index
            save_index = await self._load_save_index()
            
            for save_id, index_data in save_index.items():
                try:
                    # Load metadata
                    metadata_file = self.metadata_dir / f"{save_id}_meta.json"
                    if metadata_file.exists():
                        with open(metadata_file, 'r', encoding='utf-8') as f:
                            metadata_data = json.load(f)
                        
                        # Filter auto-saves if requested
                        if not include_auto_saves and metadata_data.get("auto_save", False):
                            continue
                        
                        # Check if save file exists
                        save_file = self.saves_dir / f"{save_id}.json"
                        if save_file.exists():
                            saves.append({
                                "save_id": save_id,
                                "title": metadata_data["title"],
                                "player_name": metadata_data["player_name"],
                                "world_name": metadata_data["world_name"],
                                "chapter": metadata_data["chapter"],
                                "turn": metadata_data["turn"],
                                "location": metadata_data["location"],
                                "created_at": metadata_data["created_at"],
                                "updated_at": metadata_data["updated_at"],
                                "thumbnail_description": metadata_data.get("thumbnail_description", ""),
                                "game_over": metadata_data.get("game_over", False),
                                "auto_save": metadata_data.get("auto_save", False),
                                "file_size": save_file.stat().st_size
                            })
                            
                except Exception as e:
                    logger.warning(f"Error loading metadata for save {save_id}: {e}")
                    continue
            
            # Sort by updated_at (most recent first)
            saves.sort(key=lambda x: x["updated_at"], reverse=True)
            
            return saves
            
        except Exception as e:
            logger.error(f"Error listing saves: {e}")
            return []
    
    async def delete_save(self, save_id: str) -> Dict[str, Any]:
        """Delete a saved game"""
        try:
            # Remove save file
            save_file = self.saves_dir / f"{save_id}.json"
            if save_file.exists():
                save_file.unlink()
            
            # Remove metadata file
            metadata_file = self.metadata_dir / f"{save_id}_meta.json"
            if metadata_file.exists():
                metadata_file.unlink()
            
            # Remove from index
            await self._remove_from_save_index(save_id)
            
            # Remove backup if exists
            backup_file = self.backups_dir / f"{save_id}_backup.json"
            if backup_file.exists():
                backup_file.unlink()
            
            logger.info(f"Save deleted: {save_id}")
            
            return {
                "success": True,
                "save_id": save_id,
                "deleted_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error deleting save {save_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    # ==================== AUTO-SAVE METHODS ====================
    
    async def should_auto_save(self, state: State, session_id: str) -> bool:
        """Check if auto-save should be triggered"""
        if not self.auto_save_enabled:
            return False
        
        # Auto-save every N turns
        return state.story_position.turn % self.auto_save_interval_turns == 0
    
    async def auto_save_game(self, state: State, session_id: str) -> Dict[str, Any]:
        """Perform auto-save"""
        return await self.save_game(
            state=state,
            session_id=session_id,
            title=f"Auto-save T{state.story_position.turn}",
            auto_save=True
        )
    
    async def _cleanup_auto_saves(self, session_id: str):
        """Clean up old auto-saves, keeping only the most recent ones"""
        try:
            # Get all auto-saves for this session
            auto_saves = []
            for save_file in self.saves_dir.glob("autosave_*.json"):
                if session_id in save_file.name:
                    auto_saves.append(save_file)
            
            # Sort by modification time (oldest first)
            auto_saves.sort(key=lambda x: x.stat().st_mtime)
            
            # Remove old auto-saves if we exceed max count
            while len(auto_saves) > self.max_auto_saves:
                old_save = auto_saves.pop(0)
                save_id = old_save.stem
                await self.delete_save(save_id)
                
        except Exception as e:
            logger.error(f"Error cleaning up auto-saves: {e}")
    
    # ==================== UTILITY METHODS ====================
    
    async def _update_save_index(self, save_id: str, metadata: SaveGameMetadata):
        """Update the save index file"""
        try:
            save_index = await self._load_save_index()
            save_index[save_id] = {
                "title": metadata.title,
                "created_at": metadata.created_at,
                "updated_at": metadata.updated_at,
                "auto_save": metadata.auto_save
            }
            
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(save_index, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            logger.error(f"Error updating save index: {e}")
    
    async def _load_save_index(self) -> Dict[str, Any]:
        """Load the save index"""
        try:
            if self.index_file.exists():
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logger.error(f"Error loading save index: {e}")
            return {}
    
    async def _remove_from_save_index(self, save_id: str):
        """Remove a save from the index"""
        try:
            save_index = await self._load_save_index()
            if save_id in save_index:
                del save_index[save_id]
                with open(self.index_file, 'w', encoding='utf-8') as f:
                    json.dump(save_index, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error removing from save index: {e}")
    
    def _validate_save_data(self, save_data: Dict[str, Any]) -> bool:
        """Validate save data format"""
        required_keys = ["metadata", "state", "session_id", "save_version"]
        return all(key in save_data for key in required_keys)
    
    async def _create_backup(self, save_id: str, save_data: Dict[str, Any]):
        """Create a backup of the save file"""
        try:
            backup_file = self.backups_dir / f"{save_id}_backup.json"
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, indent=2, ensure_ascii=False)
            
            logger.debug(f"Backup created for save {save_id}")
            
        except Exception as e:
            logger.error(f"Error creating backup for {save_id}: {e}")
    
    # ==================== MANAGEMENT METHODS ====================
    
    async def get_save_stats(self) -> Dict[str, Any]:
        """Get statistics about saved games"""
        try:
            saves = await self.list_saves(include_auto_saves=True)
            auto_saves = [s for s in saves if s.get("auto_save", False)]
            manual_saves = [s for s in saves if not s.get("auto_save", False)]
            
            total_size = sum(s.get("file_size", 0) for s in saves)
            
            return {
                "total_saves": len(saves),
                "manual_saves": len(manual_saves),
                "auto_saves": len(auto_saves),
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "oldest_save": min(saves, key=lambda x: x["created_at"])["created_at"] if saves else None,
                "newest_save": max(saves, key=lambda x: x["updated_at"])["updated_at"] if saves else None
            }
            
        except Exception as e:
            logger.error(f"Error getting save stats: {e}")
            return {"error": str(e)}
    
    async def cleanup_orphaned_files(self) -> Dict[str, Any]:
        """Clean up orphaned save files"""
        try:
            cleaned_files = []
            save_index = await self._load_save_index()
            
            # Check for save files without metadata
            for save_file in self.saves_dir.glob("*.json"):
                if save_file.name == "save_index.json":
                    continue
                
                save_id = save_file.stem
                metadata_file = self.metadata_dir / f"{save_id}_meta.json"
                
                if not metadata_file.exists() or save_id not in save_index:
                    save_file.unlink()
                    cleaned_files.append(save_id)
            
            # Check for metadata files without save files
            for metadata_file in self.metadata_dir.glob("*_meta.json"):
                save_id = metadata_file.name.replace("_meta.json", "")
                save_file = self.saves_dir / f"{save_id}.json"
                
                if not save_file.exists():
                    metadata_file.unlink()
                    cleaned_files.append(f"{save_id}_meta")
            
            logger.info(f"Cleanup completed. Removed {len(cleaned_files)} orphaned files")
            
            return {
                "success": True,
                "cleaned_files": cleaned_files,
                "count": len(cleaned_files)
            }
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def export_save(self, save_id: str, export_path: str) -> Dict[str, Any]:
        """Export a save to a specific path"""
        try:
            save_file = self.saves_dir / f"{save_id}.json"
            if not save_file.exists():
                return {"success": False, "error": "Save not found"}
            
            # Copy save file to export path
            shutil.copy2(save_file, export_path)
            
            return {
                "success": True,
                "save_id": save_id,
                "exported_to": export_path,
                "exported_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error exporting save {save_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def import_save(self, import_path: str) -> Dict[str, Any]:
        """Import a save from a file"""
        try:
            with open(import_path, 'r', encoding='utf-8') as f:
                save_data = json.load(f)
            
            if not self._validate_save_data(save_data):
                return {"success": False, "error": "Invalid save file format"}
            
            # Generate new save ID to avoid conflicts
            new_save_id = str(uuid.uuid4())
            metadata = save_data["metadata"]
            metadata["save_id"] = new_save_id
            metadata["imported_at"] = datetime.now().isoformat()
            
            # Save imported data
            save_file = self.saves_dir / f"{new_save_id}.json"
            with open(save_file, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, indent=2, ensure_ascii=False)
            
            # Update metadata and index
            metadata_obj = SaveGameMetadata.from_dict(metadata)
            await self._update_save_index(new_save_id, metadata_obj)
            
            return {
                "success": True,
                "save_id": new_save_id,
                "title": metadata["title"],
                "imported_at": metadata["imported_at"]
            }
            
        except Exception as e:
            logger.error(f"Error importing save from {import_path}: {e}")
            return {
                "success": False,
                "error": str(e)
            }