from typing import Dict, Any, List, Union
import json
from copy import deepcopy

from ..utils.logger import get_logger

logger = get_logger(__name__)


class JSONPatchOperation:
    """Represents a single JSON Patch operation"""
    
    def __init__(self, op: str, path: str, value: Any = None, from_path: str = None):
        self.op = op
        self.path = path
        self.value = value
        self.from_path = from_path
    
    def to_dict(self) -> Dict[str, Any]:
        result = {"op": self.op, "path": self.path}
        if self.value is not None:
            result["value"] = self.value
        if self.from_path is not None:
            result["from"] = self.from_path
        return result


class JSONPatcher:
    """Enhanced JSON Patch implementation with Aventra-specific operations"""
    
    @staticmethod
    def apply_patch(data: Dict[str, Any], operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Apply JSON patch operations to data"""
        result = deepcopy(data)
        
        for op in operations:
            try:
                result = JSONPatcher._apply_single_operation(result, op)
            except Exception as e:
                logger.error(f"Error applying patch operation {op}: {e}")
                continue
        
        return result
    
    @staticmethod
    def _apply_single_operation(data: Dict[str, Any], operation: Dict[str, Any]) -> Dict[str, Any]:
        """Apply a single patch operation"""
        op_type = operation.get("op")
        path = operation.get("path", "")
        value = operation.get("value")
        
        if op_type == "add":
            return JSONPatcher._add_operation(data, path, value)
        elif op_type == "remove":
            return JSONPatcher._remove_operation(data, path)
        elif op_type == "replace":
            return JSONPatcher._replace_operation(data, path, value)
        elif op_type == "move":
            from_path = operation.get("from")
            return JSONPatcher._move_operation(data, from_path, path)
        elif op_type == "copy":
            from_path = operation.get("from")
            return JSONPatcher._copy_operation(data, from_path, path)
        elif op_type == "test":
            return JSONPatcher._test_operation(data, path, value)
        # Extended operations for Aventra
        elif op_type == "upsert":
            return JSONPatcher._upsert_operation(data, path, value)
        elif op_type == "merge":
            return JSONPatcher._merge_operation(data, path, value)
        else:
            raise ValueError(f"Unknown operation: {op_type}")
    
    @staticmethod
    def _get_by_path(data: Any, path: str) -> Any:
        """Get value by JSON pointer path"""
        if not path or path == "/":
            return data
        
        parts = path.strip("/").split("/")
        current = data
        
        for part in parts:
            part = part.replace("~1", "/").replace("~0", "~")  # JSON Pointer escaping
            
            if isinstance(current, dict):
                current = current[part]
            elif isinstance(current, list):
                index = int(part)
                current = current[index]
            else:
                raise ValueError(f"Cannot navigate path {path}")
        
        return current
    
    @staticmethod
    def _set_by_path(data: Any, path: str, value: Any) -> Any:
        """Set value by JSON pointer path"""
        if not path or path == "/":
            return value
        
        parts = path.strip("/").split("/")
        current = data
        
        for i, part in enumerate(parts[:-1]):
            part = part.replace("~1", "/").replace("~0", "~")
            
            if isinstance(current, dict):
                if part not in current:
                    current[part] = {}
                current = current[part]
            elif isinstance(current, list):
                index = int(part)
                current = current[index]
            else:
                raise ValueError(f"Cannot navigate path {path}")
        
        final_part = parts[-1].replace("~1", "/").replace("~0", "~")
        
        if isinstance(current, dict):
            current[final_part] = value
        elif isinstance(current, list):
            index = int(final_part)
            current[index] = value
        
        return data
    
    @staticmethod
    def _add_operation(data: Dict[str, Any], path: str, value: Any) -> Dict[str, Any]:
        """Add operation"""
        if not path or path == "/":
            if isinstance(value, dict):
                data.update(value)
            return data
        
        parts = path.strip("/").split("/")
        current = data
        
        # Navigate to parent
        for part in parts[:-1]:
            part = part.replace("~1", "/").replace("~0", "~")
            if part not in current:
                current[part] = {}
            current = current[part]
        
        final_part = parts[-1].replace("~1", "/").replace("~0", "~")
        
        if isinstance(current, dict):
            current[final_part] = value
        elif isinstance(current, list):
            if final_part == "-":
                current.append(value)
            else:
                index = int(final_part)
                current.insert(index, value)
        
        return data
    
    @staticmethod
    def _remove_operation(data: Dict[str, Any], path: str) -> Dict[str, Any]:
        """Remove operation"""
        parts = path.strip("/").split("/")
        current = data
        
        # Navigate to parent
        for part in parts[:-1]:
            part = part.replace("~1", "/").replace("~0", "~")
            current = current[part]
        
        final_part = parts[-1].replace("~1", "/").replace("~0", "~")
        
        if isinstance(current, dict):
            del current[final_part]
        elif isinstance(current, list):
            index = int(final_part)
            del current[index]
        
        return data
    
    @staticmethod
    def _replace_operation(data: Dict[str, Any], path: str, value: Any) -> Dict[str, Any]:
        """Replace operation"""
        return JSONPatcher._set_by_path(data, path, value)
    
    @staticmethod
    def _move_operation(data: Dict[str, Any], from_path: str, to_path: str) -> Dict[str, Any]:
        """Move operation"""
        value = JSONPatcher._get_by_path(data, from_path)
        data = JSONPatcher._remove_operation(data, from_path)
        data = JSONPatcher._add_operation(data, to_path, value)
        return data
    
    @staticmethod
    def _copy_operation(data: Dict[str, Any], from_path: str, to_path: str) -> Dict[str, Any]:
        """Copy operation"""
        value = JSONPatcher._get_by_path(data, from_path)
        data = JSONPatcher._add_operation(data, to_path, deepcopy(value))
        return data
    
    @staticmethod
    def _test_operation(data: Dict[str, Any], path: str, value: Any) -> Dict[str, Any]:
        """Test operation (raises exception if test fails)"""
        actual = JSONPatcher._get_by_path(data, path)
        if actual != value:
            raise ValueError(f"Test failed: expected {value}, got {actual}")
        return data
    
    @staticmethod
    def _upsert_operation(data: Dict[str, Any], path: str, value: Any) -> Dict[str, Any]:
        """Upsert operation (add if not exists, replace if exists)"""
        try:
            JSONPatcher._get_by_path(data, path)
            return JSONPatcher._replace_operation(data, path, value)
        except (KeyError, IndexError, ValueError):
            return JSONPatcher._add_operation(data, path, value)
    
    @staticmethod
    def _merge_operation(data: Dict[str, Any], path: str, value: Any) -> Dict[str, Any]:
        """Merge operation (deep merge for objects)"""
        try:
            existing = JSONPatcher._get_by_path(data, path)
            if isinstance(existing, dict) and isinstance(value, dict):
                merged = deepcopy(existing)
                merged.update(value)
                return JSONPatcher._set_by_path(data, path, merged)
            else:
                return JSONPatcher._replace_operation(data, path, value)
        except (KeyError, IndexError, ValueError):
            return JSONPatcher._add_operation(data, path, value)


class AventraStatePatches:
    """Aventra-specific state patch generators"""
    
    @staticmethod
    def update_character_health(character_id: str, new_health: int) -> Dict[str, Any]:
        """Generate patch to update character health"""
        return {
            "op": "replace",
            "path": f"/characters/{character_id}/health",
            "value": max(0, min(100, new_health))
        }
    
    @staticmethod
    def add_inventory_item(item_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate patch to add item to inventory"""
        return {
            "op": "add",
            "path": "/inventory/-",
            "value": item_data
        }
    
    @staticmethod
    def set_scene_flag(flag_name: str, value: Any) -> Dict[str, Any]:
        """Generate patch to set scene flag"""
        return {
            "op": "upsert",
            "path": f"/flags/{flag_name}",
            "value": value
        }
    
    @staticmethod
    def update_scene(scene_updates: Dict[str, Any]) -> Dict[str, Any]:
        """Generate patch to update scene properties"""
        return {
            "op": "merge",
            "path": "/scene",
            "value": scene_updates
        }
    
    @staticmethod
    def add_character_condition(character_id: str, condition_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate patch to add condition to character"""
        return {
            "op": "add",
            "path": f"/characters/{character_id}/conditions/-",
            "value": condition_data
        }
    
    @staticmethod
    def find_character_index_by_id(characters: List[Dict[str, Any]], character_id: str) -> int:
        """Find character index by ID"""
        for i, char in enumerate(characters):
            if char.get("id") == character_id:
                return i
        raise ValueError(f"Character {character_id} not found")
    
    @staticmethod
    def generate_upsert_patches_for_collections(state_data: Dict[str, Any], updates: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate upsert patches for collections like characters, monsters, inventory"""
        patches = []
        
        for collection_name in ["characters", "monsters", "inventory"]:
            if collection_name in updates:
                collection = state_data.get(collection_name, [])
                update_items = updates[collection_name]
                
                for item in update_items:
                    item_id = item.get("id")
                    if not item_id:
                        continue
                    
                    # Find existing item index
                    existing_index = None
                    for i, existing_item in enumerate(collection):
                        if existing_item.get("id") == item_id:
                            existing_index = i
                            break
                    
                    if existing_index is not None:
                        # Update existing item
                        patches.append({
                            "op": "replace",
                            "path": f"/{collection_name}/{existing_index}",
                            "value": item
                        })
                    else:
                        # Add new item
                        patches.append({
                            "op": "add",
                            "path": f"/{collection_name}/-",
                            "value": item
                        })
        
        return patches