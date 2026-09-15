#!/usr/bin/env python3
"""
Test script para verificar la funcionalidad mejorada de LangChain y coherencia
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.ai_service import AIService
from app.services.entity_service import EntityService
from app.models.state import State, Scene, Character, Item, Monster, RoleType, StoryPosition, GameState
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def test_enhanced_ai_service():
    """Test the enhanced AI service with coherence and entity persistence"""
    
    print("🧪 Testing Enhanced AI Service with LangChain Coherence...")
    
    # Initialize services
    ai_service = AIService()
    entity_service = EntityService()
    
    # Create test state
    test_state = State(
        scene=Scene(
            id="test_scene",
            title="Taberna del Dragón Dorado",
            location="Centro del pueblo",
            mood="acogedora"
        ),
        characters=[
            Character(
                id="player",
                name="Alaric",
                role=RoleType.PLAYER,
                race="humano",
                class_name="guerrero",
                health=100,
                traits=["valiente", "leal"]
            ),
            Character(
                id="npc_bartender",
                name="Magnus",
                role=RoleType.NPC,
                race="enano",
                health=80,
                notes="Tabernero veterano con muchas historias"
            )
        ],
        inventory=[
            Item(
                id="item_sword",
                name="Espada de acero",
                qty=1,
                description="Una espada bien balanceada"
            ),
            Item(
                id="item_coins",
                name="Monedas de oro",
                qty=50,
                description="Monedas del reino"
            )
        ],
        monsters=[],
        story_position=StoryPosition(chapter=1, turn=1),
        game=GameState()
    )
    
    session_id = "test_session_001"
    
    print(f"📋 Estado inicial:")
    print(f"  - Ubicación: {test_state.scene.title}")
    print(f"  - Personajes: {[c.name for c in test_state.characters]}")
    print(f"  - Inventario: {[f'{i.name} x{i.qty}' for i in test_state.inventory]}")
    
    # Test sequence of interactions
    test_inputs = [
        "Saludo al tabernero Magnus y le pregunto por rumores locales",
        "Le pregunto específicamente sobre aventuras en las montañas",
        "Muestro mi espada de acero y pregunto si conoce herreros",
        "Compro una cerveza con mis monedas de oro",
        "Me despido y me dirijo hacia la puerta"
    ]
    
    for i, user_input in enumerate(test_inputs):
        print(f"\n🎮 Turno {i + 1}: {user_input}")
        print("-" * 50)
        
        try:
            # Update turn
            test_state.story_position.turn = i + 1
            
            # Generate story continuation
            result = await ai_service.generate_story_continuation(
                user_input=user_input,
                current_state=test_state,
                session_id=session_id,
                debug={"enabled": True, "level": "basic"}
            )
            
            print(f"📖 Narrativa:")
            print(result.narration)
            
            if result.actions:
                print(f"\n⚔️ Acciones disponibles:")
                for action in result.actions:
                    print(f"  - {action.text} (Riesgo: {action.risk})")
            
            if result.image_request:
                print(f"\n🎨 Imagen sugerida: {result.image_request}")
            
            # Check entity persistence
            entity_stats = entity_service.get_entity_stats(session_id)
            print(f"\n📊 Entidades persistentes: {entity_stats}")
            
            # Validate consistency
            consistency = await entity_service.validate_entity_consistency(session_id, test_state)
            if consistency.get('consistent'):
                print("✅ Coherencia de entidades validada")
            else:
                print(f"⚠️ Inconsistencias: {consistency.get('inconsistencies')}")
            
            # Wait a bit to simulate real interaction
            await asyncio.sleep(0.5)
            
        except Exception as e:
            print(f"❌ Error en turno {i + 1}: {e}")
            logger.error(f"Error in turn {i + 1}: {e}")
            break
    
    print(f"\n🏁 Test completado. Limpiando entidades de sesión...")
    await entity_service.cleanup_session_entities(session_id)
    
    print("✅ Test de coherencia LangChain completado exitosamente!")


async def test_entity_persistence():
    """Test entity persistence functionality"""
    
    print("\n🗄️ Testing Entity Persistence...")
    
    entity_service = EntityService()
    session_id = "test_persistence"
    
    # Test character persistence
    test_character = Character(
        id="test_char",
        name="Gandalf",
        role=RoleType.NPC,
        race="mago",
        health=90,
        notes="Mago sabio y poderoso"
    )
    
    # Save character
    saved = await entity_service.save_character(session_id, test_character)
    print(f"Character saved: {saved}")
    
    # Load character
    loaded_char = await entity_service.load_character(session_id, "test_char")
    if loaded_char:
        print(f"Character loaded: {loaded_char.name} ({loaded_char.race})")
    
    # Test item persistence
    test_item = Item(
        id="test_item",
        name="Anillo Mágico",
        qty=1,
        description="Un anillo con poderes místicos"
    )
    
    saved_item = await entity_service.save_item(session_id, test_item)
    print(f"Item saved: {saved_item}")
    
    # Test search functionality
    found_chars = await entity_service.find_characters_by_name(session_id, "Gandalf")
    print(f"Found characters: {[c.name for c in found_chars]}")
    
    # Cleanup
    await entity_service.cleanup_session_entities(session_id)
    print("✅ Entity persistence test completed!")


async def main():
    """Main test function"""
    print("🚀 Starting Aventra Enhanced AI Tests")
    print("=" * 60)
    
    # Check environment
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️ OPENAI_API_KEY not set. Some tests may fail.")
    
    try:
        # Test entity persistence
        await test_entity_persistence()
        
        # Test enhanced AI service
        await test_enhanced_ai_service()
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        logger.error(f"Test failed: {e}")
        return False
    
    print("\n🎉 All tests completed successfully!")
    return True


if __name__ == "__main__":
    # Run tests
    success = asyncio.run(main())
    sys.exit(0 if success else 1)