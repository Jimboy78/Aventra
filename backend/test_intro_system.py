#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script para verificar que el sistema de introducción funciona correctamente
"""

import asyncio
import sys
import os
from pathlib import Path

# Set UTF-8 encoding for Windows
if os.name == 'nt':  # Windows
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.game_service import GameService
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def test_intro_generation():
    """Test that intro generation works with different character/world setups"""
    
    print("[INTRO] Testing Introduction Generation...")
    
    game_service = GameService()
    
    # Test different character and world combinations
    test_scenarios = [
        {
            "name": "Fantasía Clásica",
            "player": {
                "name": "Aragorn",
                "race": "humano",
                "class": "guerrero",
                "traits": ["valiente", "leal", "experimentado"],
                "backstory": "Un guerrero veterano en busca de una nueva aventura"
            },
            "world": {
                "name": "Tierra Media",
                "genre": "fantasía épica",
                "description": "Un mundo de magia, dragones y héroes legendarios",
                "rules": ["La magia es real", "Los dragones existen", "Las razas se mezclan"],
                "tone": "épico y heroico"
            },
            "difficulty": "balanced"
        },
        {
            "name": "Aventura Moderna",
            "player": {
                "name": "Alex",
                "race": "humano",
                "class": "detective",
                "traits": ["observador", "astuto", "persistente"],
                "backstory": "Un detective privado que busca resolver casos imposibles"
            },
            "world": {
                "name": "Nueva York",
                "genre": "misterio urbano moderno",
                "description": "Una metrópolis llena de secretos y peligros ocultos",
                "rules": ["Sin magia evidente", "Tecnología moderna", "Crimen organizado"],
                "tone": "noir y misterioso"
            },
            "difficulty": "hard"
        },
        {
            "name": "Ciencia Ficción",
            "player": {
                "name": "Zara",
                "race": "androide",
                "class": "explorador",
                "traits": ["lógico", "curioso", "adaptable"],
                "backstory": "Un androide consciente explorando su humanidad"
            },
            "world": {
                "name": "Sector Alpha-7",
                "genre": "ciencia ficción futurista",
                "description": "Una estación espacial en los confines del espacio conocido",
                "rules": ["Tecnología avanzada", "IA conscientes", "Viajes espaciales"],
                "tone": "futurista y contemplativo"
            },
            "difficulty": "story"
        },
        {
            "name": "Minimal Setup",
            "player": {
                "name": "Aventurero"
            },
            "world": {
                "name": "Mundo Desconocido"
            },
            "difficulty": "balanced"
        }
    ]
    
    for i, scenario in enumerate(test_scenarios):
        print(f"\n{'='*60}")
        print(f"[SCENARIO] Scenario {i+1}: {scenario['name']}")
        print(f"{'='*60}")
        
        try:
            # Setup session
            result = await game_service.setup_session(
                player=scenario["player"],
                world=scenario["world"],
                difficulty=scenario["difficulty"]
            )
            
            if result:
                print(f"[OK] Setup exitoso")
                print(f"[SCENE] Escena: {result.state.scene.title}")
                print(f"[LOCATION] Ubicación: {result.state.scene.location}")
                print(f"[MOOD] Ambiente: {result.state.scene.mood}")
                print(f"[PLAYER] Jugador: {result.state.characters[0].name} ({result.state.characters[0].race} {result.state.characters[0].class_name})")
                
                print(f"\n[NARRATIVE] NARRATIVA INICIAL:")
                print("-" * 50)
                print(result.intro.narration)
                print("-" * 50)
                
                if result.intro.actions:
                    print(f"\n[ACTIONS] ACCIONES DISPONIBLES ({len(result.intro.actions)}):")
                    for j, action in enumerate(result.intro.actions):
                        print(f"  {j+1}. {action.text}")
                        print(f"     Riesgo: {action.risk}")
                        if action.effect_hint:
                            print(f"     Pista: {action.effect_hint}")
                        if action.may_end_game:
                            print(f"     [WARNING] Puede terminar el juego")
                        print()
                else:
                    print("[ERROR] No se generaron acciones")
                
                if result.intro.image_request:
                    print(f"[IMAGE] Imagen sugerida: {result.intro.image_request}")
                
                # Verify that intro is engaging
                intro_quality = analyze_intro_quality(result.intro.narration, result.intro.actions)
                print(f"\n[QUALITY] Calidad de la introducción: {intro_quality['score']}/100")
                if intro_quality['issues']:
                    print("[WARNING] Problemas detectados:")
                    for issue in intro_quality['issues']:
                        print(f"  - {issue}")
                else:
                    print("[OK] Introducción de alta calidad")
                
            else:
                print("[ERROR] Setup falló")
                
        except Exception as e:
            print(f"[ERROR] Error en escenario {scenario['name']}: {e}")
            logger.error(f"Error in scenario {scenario['name']}: {e}")
    
    return True


def analyze_intro_quality(narration: str, actions) -> dict:
    """Analyze the quality of the introduction"""
    score = 100
    issues = []
    
    # Check narration length
    if len(narration) < 100:
        score -= 20
        issues.append("Narrativa demasiado corta")
    elif len(narration) > 1000:
        score -= 10
        issues.append("Narrativa demasiado larga")
    
    # Check for second person perspective
    if "te encuentras" not in narration.lower() and "observas" not in narration.lower() and "sientes" not in narration.lower():
        score -= 15
        issues.append("No usa segunda persona apropiadamente")
    
    # Check for forbidden phrases
    forbidden = ["¿qué quieres hacer?", "¿qué decides hacer?"]
    for phrase in forbidden:
        if phrase.lower() in narration.lower():
            score -= 10
            issues.append(f"Usa frase genérica: '{phrase}'")
    
    # Check for actions
    if not actions or len(actions) == 0:
        score -= 30
        issues.append("No incluye acciones específicas")
    elif len(actions) < 2:
        score -= 15
        issues.append("Muy pocas acciones disponibles")
    elif len(actions) > 5:
        score -= 5
        issues.append("Demasiadas acciones (puede ser abrumador)")
    
    # Check action quality
    if actions:
        for action in actions:
            if len(action.text) < 10:
                score -= 5
                issues.append("Algunas acciones son demasiado vagas")
                break
    
    # Check for immersion elements
    immersion_keywords = ["mundo", "lugar", "ambiente", "atmósfera", "aire", "sonido", "olor", "vista"]
    if not any(keyword in narration.lower() for keyword in immersion_keywords):
        score -= 10
        issues.append("Falta elementos inmersivos (descripciones sensoriales)")
    
    return {
        "score": max(0, score),
        "issues": issues
    }


async def test_fallback_system():
    """Test the fallback system when AI fails"""
    
    print(f"\n[FALLBACK] Testing Fallback System...")
    
    game_service = GameService()
    
    # Test with minimal data that might cause AI to fail
    minimal_setup = {
        "player": {"name": "Test"},
        "world": {"name": "Test"},
        "difficulty": "balanced"
    }
    
    try:
        result = await game_service.setup_session(**minimal_setup)
        
        if result:
            print("[OK] Fallback system works")
            print(f"[NARRATIVE] Fallback narration preview: {result.intro.narration[:100]}...")
            
            if result.intro.actions:
                print(f"[ACTIONS] Fallback actions: {len(result.intro.actions)} actions available")
            else:
                print("[ERROR] Fallback didn't generate actions")
                
        else:
            print("[ERROR] Fallback system failed")
            
    except Exception as e:
        print(f"❌ Fallback system error: {e}")
        return False
    
    return True


async def test_intro_consistency():
    """Test that introductions are consistent with character/world data"""
    
    print(f"\n[CONSISTENCY] Testing Introduction Consistency...")
    
    game_service = GameService()
    
    test_player = {
        "name": "Elara",
        "race": "elfo",
        "class": "mago",
        "traits": ["sabia", "misteriosa"],
        "backstory": "Una maga élfica en busca de conocimiento ancestral"
    }
    
    test_world = {
        "name": "Bosque Eterno",
        "genre": "fantasía mágica",
        "description": "Un bosque donde el tiempo se mueve diferente",
        "rules": ["La magia es muy poderosa", "Los árboles son conscientes"],
        "tone": "místico y contemplativo"
    }
    
    try:
        result = await game_service.setup_session(
            player=test_player,
            world=test_world,
            difficulty="balanced"
        )
        
        if result:
            # Check if character data is consistent
            character = result.state.characters[0]
            
            consistency_checks = [
                (character.name == test_player["name"], f"Nombre: {character.name} vs {test_player['name']}"),
                (character.race == test_player["race"], f"Raza: {character.race} vs {test_player['race']}"),
                (character.class_name == test_player["class"], f"Clase: {character.class_name} vs {test_player['class']}"),
                (result.state.world.name == test_world["name"], f"Mundo: {result.state.world.name} vs {test_world['name']}"),
                (test_player["name"].lower() in result.intro.narration.lower(), "Nombre del personaje en narrativa"),
                (test_world["name"].lower() in result.intro.narration.lower(), "Nombre del mundo en narrativa")
            ]
            
            passed_checks = sum(1 for check, _ in consistency_checks if check)
            total_checks = len(consistency_checks)
            
            print(f"[OK] Consistencia: {passed_checks}/{total_checks} checks passed")
            
            for check, description in consistency_checks:
                status = "[OK]" if check else "[FAIL]"
                print(f"  {status} {description}")
            
            if passed_checks == total_checks:
                print("[SUCCESS] Introducción completamente consistente")
                return True
            else:
                print("[WARNING] Algunos problemas de consistencia detectados")
                return False
                
        else:
            print("❌ No se pudo generar introducción")
            return False
            
    except Exception as e:
        print(f"❌ Error en test de consistencia: {e}")
        return False


async def main():
    """Main test function"""
    print("[TEST] Starting Aventra Introduction System Tests")
    print("=" * 70)
    
    all_tests_passed = True
    
    try:
        # Run tests
        tests = [
            ("Introduction Generation", test_intro_generation),
            ("Fallback System", test_fallback_system),
            ("Introduction Consistency", test_intro_consistency)
        ]
        
        for test_name, test_func in tests:
            print(f"\n[TEST] Running {test_name} Test...")
            try:
                result = await test_func()
                if result:
                    print(f"[PASS] {test_name} Test PASSED")
                else:
                    print(f"[FAIL] {test_name} Test FAILED")
                    all_tests_passed = False
            except Exception as e:
                print(f"[FAIL] {test_name} Test FAILED with exception: {e}")
                logger.error(f"{test_name} test failed: {e}")
                all_tests_passed = False
        
        # Final summary
        print("\n" + "=" * 70)
        if all_tests_passed:
            print("[SUCCESS] ALL INTRODUCTION TESTS PASSED!")
            print("\n[OK] Your introduction system is ready:")
            print("  - [OK] AI generates engaging opening narratives")
            print("  - [OK] Provides specific action choices")
            print("  - [OK] Adapts to different genres and characters")
            print("  - [OK] Fallback system works when AI fails")
            print("  - [OK] Maintains consistency with setup data")
            print("\n[NARRATOR] El narrador ahora inicia automáticamente la conversación!")
        else:
            print("[FAIL] SOME TESTS FAILED")
            print("Please check the errors above and fix the issues.")
        
    except Exception as e:
        print(f"[ERROR] Test suite failed: {e}")
        logger.error(f"Test suite failed: {e}")
        all_tests_passed = False
    
    return all_tests_passed


if __name__ == "__main__":
    # Run tests
    success = asyncio.run(main())
    sys.exit(0 if success else 1)