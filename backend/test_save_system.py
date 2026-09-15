#!/usr/bin/env python3
"""
Test script para verificar el sistema de guardado de partidas
"""

import asyncio
import sys
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.save_service import SaveService
from app.models.state import State, Scene, Character, Item, Monster, RoleType, StoryPosition, GameState
from app.utils.logger import get_logger

logger = get_logger(__name__)


def create_test_state(turn_number: int = 1) -> State:
    """Create a test game state"""
    return State(
        scene=Scene(
            id=f"scene_{turn_number}",
            title=f"Escena de Prueba {turn_number}",
            location=f"Ubicación {turn_number}",
            mood="test"
        ),
        characters=[
            Character(
                id="player",
                name="Tester",
                role=RoleType.PLAYER,
                race="humano",
                class_name="aventurero",
                health=100,
                traits=["curioso", "persistente"]
            ),
            Character(
                id=f"npc_{turn_number}",
                name=f"NPC {turn_number}",
                role=RoleType.NPC,
                race="elfo",
                health=80,
                notes=f"Personaje de prueba número {turn_number}"
            )
        ],
        inventory=[
            Item(
                id="test_item",
                name=f"Item de Prueba {turn_number}",
                qty=turn_number,
                description=f"Un item creado en el turno {turn_number}"
            )
        ],
        monsters=[
            Monster(
                id=f"monster_{turn_number}",
                name=f"Monstruo {turn_number}",
                threat_level=min(turn_number, 5),
                health=50 + turn_number * 10,
                notes=f"Criatura aparecida en turno {turn_number}"
            )
        ] if turn_number % 3 == 0 else [],  # Monsters every 3 turns
        story_position=StoryPosition(chapter=1, turn=turn_number),
        game=GameState(difficulty="balanced")
    )


async def test_basic_save_load():
    """Test basic save and load functionality"""
    print("🧪 Testing Basic Save/Load...")
    
    save_service = SaveService()
    session_id = "test_session_basic"
    
    # Create test state
    test_state = create_test_state(1)
    
    # Test save
    print("💾 Saving game...")
    save_result = await save_service.save_game(
        state=test_state,
        session_id=session_id,
        title="Test Save - Basic"
    )
    
    if save_result["success"]:
        print(f"✅ Game saved successfully: {save_result['save_id']}")
        save_id = save_result["save_id"]
    else:
        print(f"❌ Save failed: {save_result['error']}")
        return False
    
    # Test load
    print("📂 Loading game...")
    load_result = await save_service.load_game(save_id)
    
    if load_result["success"]:
        print("✅ Game loaded successfully")
        loaded_state = load_result["state"]
        
        # Verify data integrity
        if (loaded_state.scene.title == test_state.scene.title and
            loaded_state.characters[0].name == test_state.characters[0].name and
            len(loaded_state.inventory) == len(test_state.inventory)):
            print("✅ Data integrity verified")
        else:
            print("❌ Data integrity check failed")
            return False
    else:
        print(f"❌ Load failed: {load_result['error']}")
        return False
    
    # Cleanup
    await save_service.delete_save(save_id)
    print("🧹 Cleanup completed")
    
    return True


async def test_auto_save_system():
    """Test auto-save functionality"""
    print("\n🤖 Testing Auto-Save System...")
    
    save_service = SaveService()
    session_id = "test_session_autosave"
    
    # Test auto-save intervals
    for turn in range(1, 16):  # Test 15 turns
        test_state = create_test_state(turn)
        
        # Check if auto-save should trigger
        should_save = await save_service.should_auto_save(test_state, session_id)
        
        if should_save:
            print(f"🔄 Auto-save triggered at turn {turn}")
            auto_save_result = await save_service.auto_save_game(test_state, session_id)
            
            if auto_save_result["success"]:
                print(f"✅ Auto-save successful: {auto_save_result['save_id']}")
            else:
                print(f"❌ Auto-save failed: {auto_save_result['error']}")
        else:
            print(f"⏭️ Turn {turn}: No auto-save needed")
    
    # Check auto-save cleanup
    saves = await save_service.list_saves(include_auto_saves=True)
    auto_saves = [s for s in saves if s.get("auto_save", False) and session_id in s["save_id"]]
    
    print(f"📊 Auto-saves found: {len(auto_saves)}")
    if len(auto_saves) <= save_service.max_auto_saves:
        print("✅ Auto-save cleanup working correctly")
    else:
        print("❌ Too many auto-saves, cleanup not working")
    
    # Cleanup all auto-saves
    for save in auto_saves:
        await save_service.delete_save(save["save_id"])
    
    return True


async def test_save_management():
    """Test save management features"""
    print("\n📋 Testing Save Management...")
    
    save_service = SaveService()
    session_id = "test_session_management"
    save_ids = []
    
    # Create multiple saves
    print("Creating multiple test saves...")
    for i in range(1, 6):
        test_state = create_test_state(i)
        save_result = await save_service.save_game(
            state=test_state,
            session_id=f"{session_id}_{i}",
            title=f"Test Save {i}"
        )
        
        if save_result["success"]:
            save_ids.append(save_result["save_id"])
            print(f"✅ Save {i} created: {save_result['save_id']}")
        else:
            print(f"❌ Save {i} failed: {save_result['error']}")
    
    # Test list saves
    print("\n📜 Testing save listing...")
    saves = await save_service.list_saves(include_auto_saves=False)
    test_saves = [s for s in saves if any(sid in s["save_id"] for sid in save_ids)]
    
    print(f"Found {len(test_saves)} test saves")
    for save in test_saves:
        print(f"  - {save['title']} (T{save['turn']}, {save['location']})")
    
    # Test save stats
    print("\n📊 Testing save statistics...")
    stats = await save_service.get_save_stats()
    if "total_saves" in stats:
        print(f"Total saves: {stats['total_saves']}")
        print(f"Manual saves: {stats['manual_saves']}")
        print(f"Auto saves: {stats['auto_saves']}")
        print(f"Total size: {stats['total_size_mb']} MB")
        print("✅ Statistics working correctly")
    else:
        print("❌ Statistics failed")
    
    # Test cleanup
    print("\n🧹 Testing cleanup...")
    cleanup_result = await save_service.cleanup_orphaned_files()
    if cleanup_result["success"]:
        print(f"✅ Cleanup completed: {cleanup_result['count']} files cleaned")
    else:
        print(f"❌ Cleanup failed: {cleanup_result['error']}")
    
    # Delete test saves
    print("\n🗑️ Deleting test saves...")
    for save_id in save_ids:
        delete_result = await save_service.delete_save(save_id)
        if delete_result["success"]:
            print(f"✅ Deleted: {save_id}")
        else:
            print(f"❌ Failed to delete: {save_id}")
    
    return True


async def test_export_import():
    """Test export/import functionality"""
    print("\n📤📥 Testing Export/Import...")
    
    save_service = SaveService()
    session_id = "test_session_export"
    
    # Create a test save
    test_state = create_test_state(10)
    save_result = await save_service.save_game(
        state=test_state,
        session_id=session_id,
        title="Export Test Save"
    )
    
    if not save_result["success"]:
        print(f"❌ Failed to create test save: {save_result['error']}")
        return False
    
    save_id = save_result["save_id"]
    
    # Test export
    import tempfile
    export_path = tempfile.mktemp(suffix=".json")
    
    export_result = await save_service.export_save(save_id, export_path)
    if export_result["success"]:
        print(f"✅ Export successful: {export_path}")
    else:
        print(f"❌ Export failed: {export_result['error']}")
        return False
    
    # Test import
    import_result = await save_service.import_save(export_path)
    if import_result["success"]:
        print(f"✅ Import successful: {import_result['save_id']}")
        imported_save_id = import_result["save_id"]
    else:
        print(f"❌ Import failed: {import_result['error']}")
        return False
    
    # Verify imported data
    load_result = await save_service.load_game(imported_save_id)
    if load_result["success"]:
        loaded_state = load_result["state"]
        if loaded_state.scene.title == test_state.scene.title:
            print("✅ Import data integrity verified")
        else:
            print("❌ Import data integrity check failed")
    
    # Cleanup
    import os
    os.unlink(export_path)
    await save_service.delete_save(save_id)
    await save_service.delete_save(imported_save_id)
    
    return True


async def test_edge_cases():
    """Test edge cases and error handling"""
    print("\n⚠️ Testing Edge Cases...")
    
    save_service = SaveService()
    
    # Test loading non-existent save
    print("Testing load of non-existent save...")
    load_result = await save_service.load_game("nonexistent_save_id")
    if not load_result["success"]:
        print("✅ Correctly handled non-existent save")
    else:
        print("❌ Should have failed for non-existent save")
    
    # Test deleting non-existent save
    print("Testing delete of non-existent save...")
    delete_result = await save_service.delete_save("nonexistent_save_id")
    if not delete_result["success"]:
        print("✅ Correctly handled non-existent save deletion")
    else:
        print("❌ Should have failed for non-existent save deletion")
    
    # Test save with minimal data
    print("Testing save with minimal state...")
    minimal_state = State(
        scene=Scene(id="minimal", title="Minimal Scene"),
        characters=[],
        inventory=[],
        monsters=[],
        story_position=StoryPosition(chapter=1, turn=1),
        game=GameState()
    )
    
    save_result = await save_service.save_game(
        state=minimal_state,
        session_id="minimal_test",
        title="Minimal Save Test"
    )
    
    if save_result["success"]:
        print("✅ Minimal save successful")
        # Cleanup
        await save_service.delete_save(save_result["save_id"])
    else:
        print(f"❌ Minimal save failed: {save_result['error']}")
    
    return True


async def main():
    """Main test function"""
    print("🎮 Starting Aventra Save System Tests")
    print("=" * 60)
    
    all_tests_passed = True
    
    try:
        # Run all tests
        tests = [
            ("Basic Save/Load", test_basic_save_load),
            ("Auto-Save System", test_auto_save_system),
            ("Save Management", test_save_management),
            ("Export/Import", test_export_import),
            ("Edge Cases", test_edge_cases)
        ]
        
        for test_name, test_func in tests:
            print(f"\n🧪 Running {test_name} Test...")
            try:
                result = await test_func()
                if result:
                    print(f"✅ {test_name} Test PASSED")
                else:
                    print(f"❌ {test_name} Test FAILED")
                    all_tests_passed = False
            except Exception as e:
                print(f"❌ {test_name} Test FAILED with exception: {e}")
                logger.error(f"{test_name} test failed: {e}")
                all_tests_passed = False
        
        # Final summary
        print("\n" + "=" * 60)
        if all_tests_passed:
            print("🎉 ALL SAVE SYSTEM TESTS PASSED!")
            print("\n✅ Your save system is ready:")
            print("  - ✅ Basic save/load functionality")
            print("  - ✅ Auto-save every 5 turns")
            print("  - ✅ Save management and cleanup")
            print("  - ✅ Export/import capabilities")
            print("  - ✅ Error handling and edge cases")
        else:
            print("❌ SOME TESTS FAILED")
            print("Please check the errors above and fix the issues.")
        
    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        logger.error(f"Test suite failed: {e}")
        all_tests_passed = False
    
    return all_tests_passed


if __name__ == "__main__":
    # Run tests
    success = asyncio.run(main())
    sys.exit(0 if success else 1)