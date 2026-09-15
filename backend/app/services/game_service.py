from typing import Dict, Any, Optional
import uuid
from datetime import datetime

from ..models.state import State, Scene, Character, RoleType, PlayerSetup, WorldSetup, World, StoryPosition, GameState
from ..models.output import SetupSessionResponse, GenerateStoryResponse, LLMOutput, DevTrace, RNG
from ..utils.logger import get_logger
from .ai_service import AIService
from .state_service import StateService
from .save_service import SaveService

logger = get_logger(__name__)


class GameService:
    """Main game service that orchestrates game sessions"""
    
    def __init__(self):
        self.ai_service = AIService()
        self.state_service = StateService()
        self.save_service = SaveService()
    
    async def setup_session(
        self,
        player: Dict[str, Any],
        world: Dict[str, Any],
        difficulty: Optional[str] = "balanced",
        debug: Optional[Dict[str, Any]] = None
    ) -> SetupSessionResponse:
        """Initialize a new game session"""
        
        logger.info("Setting up new game session")
        
        # Create initial state
        session_id = str(uuid.uuid4())
        
        # Create player character
        player_character = Character(
            id="player",
            name=player.get("name"),
            role=RoleType.PLAYER,
            race=player.get("race"),
            class_name=player.get("class"),
            traits=player.get("traits", []),
            health=100,
            notes=player.get("backstory", "")
        )
        
        # Create world
        world_obj = World(
            name=world.get("name"),
            genre=world.get("genre"),
            description=world.get("description"),
            rules=world.get("rules", []),
            tone=world.get("tone")
        )
        
        # Create enhanced initial scene based on world
        world_genre = world.get('genre', 'fantasía')
        world_name = world.get('name', 'Aventra')
        
        # Escena inicial placeholder - será reemplazada por la IA
        scene_title = "Escena Inicial"
        scene_location = "Un lugar que será determinado por la historia"
        scene_mood = "expectante"
        
        initial_scene = Scene(
            id="intro_scene",
            title=scene_title,
            location=scene_location,
            mood=scene_mood
        )
        
        # Create initial state
        initial_state = State(
            scene=initial_scene,
            world=world_obj,
            characters=[player_character],
            inventory=[],
            monsters=[],
            quests=[],
            journal=[],
            flags={},
            story_position=StoryPosition(chapter=1, turn=0),
            memory_summary="",
            game=GameState(difficulty=difficulty)
        )
        
        # Generate intro narrative with full AI system
        intro_prompt = f"""
        INICIO DE AVENTURA - ESCENA INICIAL
        
        Como narrador de Aventra, crea una escena inicial ÚNICA y natural para comenzar la aventura.
        
        INFORMACIÓN DEL PERSONAJE:
        - Nombre: {player.get('name')}
        - Raza: {player.get('race', 'humano')}
        - Clase: {player.get('class', 'aventurero')}
        - Trasfondo: {player.get('backstory', 'Un aventurero en busca de gloria')}
        - Rasgos: {', '.join(player.get('traits', ['valiente']))}
        
        INFORMACIÓN DEL MUNDO:
        - Género: {world.get('genre', 'fantasía épica')}
        - Descripción: {world.get('description', 'Un mundo lleno de magia y misterio')}
        - Tono: {world.get('tone', 'aventurero')}
        - Reglas especiales: {', '.join(world.get('rules', ['La magia existe', 'Los monstruos acechan']))}
        - Dificultad: {difficulty}
        
        INSTRUCCIONES PARA LA ESCENA INICIAL:
        1. VARIEDAD TOTAL: No siempre empezar en encrucijadas o situaciones críticas
        2. ESCENAS NATURALES: El jugador puede aparecer en cualquier lugar - una posada, un claro tranquilo, una ciudad, despertando, caminando por un sendero, etc.
        3. TONO VARIABLE: Puede ser tranquilo, misterioso, urgente, o normal - que la IA lo determine según el contexto
        4. SEGUNDA PERSONA: Usar "te encuentras", "observas", "sientes"
        5. INMERSIÓN: Describir el entorno, atmósfera, y situación actual del personaje
        6. FINAL ABIERTO: Terminar con una descripción envolvente que invite al jugador a actuar libremente
        7. NO INCLUIR ACCIONES PREDEFINIDAS - el jugador escribirá lo que quiere hacer
        
        EVITA:
        - Siempre empezar en encrucijadas o situaciones de "elegir camino"
        - Incluir opciones A), B), C) o acciones predefinidas
        - Preguntas directas como "¿Qué quieres hacer?"
        - Situaciones demasiado dramáticas si no encajan con el tono
        
        GENERA solo narrativa inmersiva que establezca la escena. El jugador decidirá qué hacer por texto libre.
        """
        
        try:
            # Use the full AI system for intro generation
            intro_result = await self.ai_service.generate_story_continuation(
                user_input=intro_prompt,
                current_state=initial_state,
                session_id=session_id,
                debug=debug
            )
            
            # Store session with updated state (in case AI made changes)
            await self.state_service.store_session(session_id, initial_state)
            
            return SetupSessionResponse(
                state=initial_state,
                intro=intro_result
            )
            
        except Exception as e:
            logger.error(f"Error in setup_session: {e}")
            # Enhanced fallback intro with actions
            from ..models.output import Action
            
            player_name = player.get('name')
            player_race = player.get('race', 'aventurero')
            player_class = player.get('class', '')
            world_name = world.get('name', 'Aventra')
            
            fallback_intro = f"""
Te encuentras en el corazón de {world_name}, un mundo donde la aventura aguarda en cada esquina. Como {player_name}, {player_race} {player_class}, has llegado a este lugar con un propósito claro: forjar tu propio destino.

El viento lleva consigo historias de tesoros perdidos y peligros ocultos. Ante ti se extiende un camino que se bifurca, y sabes que cada elección marcará el rumbo de tu historia.

La aventura comienza ahora. ¿Cuál será tu primer paso en este viaje épico?
            """
            
            # Create fallback actions
            fallback_actions = [
                Action(
                    id="action_1",
                    text="Explorar los alrededores en busca de pistas o información",
                    risk="bajo",
                    effect_hint="Podrías descubrir algo útil sobre la zona"
                ),
                Action(
                    id="action_2", 
                    text="Buscar una taberna o posada para obtener información local",
                    risk="bajo",
                    effect_hint="Los lugareños suelen tener noticias interesantes"
                ),
                Action(
                    id="action_3",
                    text="Dirigirte hacia el horizonte, siguiendo tu instinto aventurero",
                    risk="medio",
                    effect_hint="Lo desconocido puede traer grandes oportunidades o peligros"
                ),
                Action(
                    id="action_4",
                    text="Revisar tu equipo y prepararte mentalmente para la aventura",
                    risk="bajo",
                    effect_hint="Una buena preparación nunca está de más"
                )
            ]
            
            intro_output = LLMOutput(
                narration=fallback_intro.strip(),
                actions=fallback_actions
            )
            
            return SetupSessionResponse(
                state=initial_state,
                intro=intro_output
            )
    
    async def generate_story(
        self,
        user_input: str,
        state: State,
        session_id: Optional[str] = None,
        rng: Optional[RNG] = None,
        debug: Optional[Dict[str, Any]] = None
    ) -> GenerateStoryResponse:
        """Generate story continuation based on user input"""
        
        logger.info(f"Generating story continuation for: {user_input[:50]}...")
        
        # Update turn counter
        state.story_position.turn += 1
        
        # Generate story continuation using AI service with session ID for vector memory
        result = await self.ai_service.generate_story_continuation(
            user_input=user_input,
            current_state=state,
            debug=debug,
            session_id=session_id or "default"
        )
        
        # Update state if needed
        if session_id:
            await self.state_service.store_session(session_id, state)
            
            # Check for auto-save
            should_auto_save = await self.save_service.should_auto_save(state, session_id)
            if should_auto_save:
                auto_save_result = await self.save_service.auto_save_game(state, session_id)
                logger.info(f"Auto-save triggered for session {session_id}: {auto_save_result.get('success', False)}")
        
        return GenerateStoryResponse(
            text=result.narration,
            actions=result.actions,
            image_base64=None  # Will be handled separately
        )