import os
import json
import uuid
import asyncio
from typing import Dict, Any, Optional, List, Union
from datetime import datetime

from langchain_openai import ChatOpenAI
from langchain.memory import ConversationSummaryBufferMemory
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.exceptions import OutputParserException
from pydantic import BaseModel, Field, ValidationError

from ..models.state import State, Character, Monster, Item, Condition
from ..models.output import LLMOutput, Action, DevTrace
from ..utils.logger import get_logger, log_debug_trace
from ..utils.debug import debug_tracer, create_debug_context, performance_monitor
from .memory_service import MemoryService
from .entity_service import EntityService

logger = get_logger(__name__)


class ActionOutput(BaseModel):
    """Structured action output"""
    text: str = Field(description="Descripción clara de la acción")
    risk: str = Field(description="Nivel de riesgo: bajo, medio, alto")
    effect_hint: Optional[str] = Field(None, description="Pista del posible resultado")
    may_end_game: bool = Field(False, description="Si la acción puede terminar el juego")

class StateChange(BaseModel):
    """Structured state change operation"""
    type: str = Field(description="Tipo de cambio: update_character, add_item, update_scene, set_flag, add_condition, remove_item, update_monster")
    target: Optional[str] = Field(None, description="ID del objetivo del cambio")
    data: Dict[str, Any] = Field(description="Datos del cambio")
    reason: Optional[str] = Field(None, description="Razón del cambio para coherencia")

class StructuredLLMOutput(BaseModel):
    """Salida estructurada robusta para respuestas del LLM"""
    narration: str = Field(description="Texto narrativo visible al jugador (2-4 párrafos)")
    actions: Optional[List[ActionOutput]] = Field(None, description="Acciones disponibles solo si hay decisión discreta")
    image_request: Optional[str] = Field(None, description="Descripción detallada para generar imagen (opcional)")
    state_changes: Optional[List[StateChange]] = Field(None, description="Cambios mínimos necesarios en el estado")
    coherence_notes: Optional[str] = Field(None, description="Notas internas sobre coherencia mantenida")
    entities_referenced: Optional[List[str]] = Field(None, description="Lista de entidades mencionadas en esta narrativa")


class AIService:
    """Service for AI-powered narrative generation using LangChain"""
    
    def __init__(self):
        # Initialize OpenAI LLM
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",  # GPT-4.1 mini equivalent
            temperature=0.7,
            max_tokens=1500,
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Memory for conversations (basic LangChain memory)
        self.memory_store: Dict[str, ConversationSummaryBufferMemory] = {}
        
        # Vector memory service (ChromaDB)
        self.memory_service = MemoryService()
        
        # Entity persistence service
        self.entity_service = EntityService()
        
        # Output parser robusto con Pydantic
        self.output_parser = PydanticOutputParser(pydantic_object=StructuredLLMOutput)
        
        # Enhanced memory configuration
        self.enhanced_memory_config = {
            "max_token_limit": 1200,  # Increased for better context
            "return_messages": True,
            "ai_prefix": "Narrador",
            "human_prefix": "Jugador"
        }

    def _build_chat_model(self, use_fallback: bool = False) -> ChatOpenAI:
        """Build a ChatOpenAI model honoring env configuration and optional fallback.

        Primary env vars:
        - OPENAI_API_KEY (required)
        - OPENAI_MODEL (optional, default gpt-4o-mini)
        - OPENAI_BASE_URL (optional, for OpenAI-compatible APIs e.g., OpenRouter/Groq)
        - OPENAI_ORG_ID, OPENAI_PROJECT (optional)

        Fallback env vars (used only if primary fails e.g., insufficient_quota):
        - FALLBACK_API_KEY
        - FALLBACK_MODEL (defaults to OPENAI_MODEL)
        - FALLBACK_BASE_URL
        """
        if not use_fallback:
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            api_key = os.getenv("OPENAI_API_KEY")
            base_url = os.getenv("OPENAI_BASE_URL")
            organization = os.getenv("OPENAI_ORG_ID")
            project = os.getenv("OPENAI_PROJECT")
        else:
            model = os.getenv("FALLBACK_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
            api_key = os.getenv("FALLBACK_API_KEY")
            base_url = os.getenv("FALLBACK_BASE_URL")
            organization = None
            project = None

        kwargs: Dict[str, Any] = {
            "model": model,
            "temperature": 0.7,
            "max_tokens": 1500,
        }
        if api_key:
            kwargs["api_key"] = api_key
        if base_url:
            kwargs["base_url"] = base_url
        if organization:
            kwargs["organization"] = organization
        if project:
            kwargs["project"] = project

        # Add small retry/timeout safety; quota errors won't fix with retries
        kwargs["max_retries"] = 0

        return ChatOpenAI(**kwargs)

    def _is_quota_error(self, err: Exception) -> bool:
        msg = str(err).lower()
        return ("insufficient_quota" in msg) or ("error code: 429" in msg) or ("status code: 429" in msg)
    
    def get_or_create_memory(self, session_id: str = "default") -> ConversationSummaryBufferMemory:
        """Get or create enhanced conversation memory for session"""
        if session_id not in self.memory_store:
            self.memory_store[session_id] = ConversationSummaryBufferMemory(
                llm=self.llm,
                max_token_limit=self.enhanced_memory_config["max_token_limit"],
                return_messages=self.enhanced_memory_config["return_messages"],
                ai_prefix=self.enhanced_memory_config["ai_prefix"],
                human_prefix=self.enhanced_memory_config["human_prefix"]
            )
        return self.memory_store[session_id]
    
    async def generate_narrative(self, prompt: str, session_id: str = "default") -> str:
        """Generate simple narrative text"""
        try:
            memory = self.get_or_create_memory(session_id)
            
            # Create messages
            messages = [
                SystemMessage(content=self._get_system_prompt()),
                HumanMessage(content=prompt)
            ]
            
            # Add memory context
            if memory.chat_memory.messages:
                messages.insert(1, SystemMessage(content=f"Resumen de la conversación: {memory.buffer}"))
            
            # Generate response
            response = await self.llm.agenerate([messages])
            result = response.generations[0][0].text.strip()
            
            # Update memory
            memory.save_context({"input": prompt}, {"output": result})
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating narrative: {e}")
            return "El narrador se queda momentáneamente sin palabras..."
    
    async def generate_story_continuation(
        self,
        user_input: str,
        current_state: State,
        debug: Optional[Dict[str, Any]] = None,
        session_id: str = "default"
    ) -> LLMOutput:
        """Generate structured story continuation with enhanced memory and coherence"""
        
        # Create debug context
        debug_ctx = create_debug_context(debug)
        
        # Start debug trace
        trace_inputs = {
            "user_input": user_input,
            "state": current_state.model_dump() if current_state else {}
        }
        step_id = debug_tracer.start_trace(debug_ctx, trace_inputs)
        
        # Start performance timer
        timer_id = performance_monitor.start_timer("generate_story_continuation")
        
        try:
            memory = self.get_or_create_memory(session_id)
            
            # Sync entities with persistent storage for coherence
            current_state = await self.entity_service.sync_state_entities(session_id, current_state)
            
            # Enhanced memory retrieval
            relevant_memories = await self._get_enhanced_relevant_memories(session_id, user_input, current_state)
            recent_memories = await self._get_recent_context_memories(session_id, current_state, limit=5)
            entity_memories = await self._get_entity_memories(session_id, current_state)
            
            # Get entity persistence data for coherence
            entity_names = [c.name for c in current_state.characters if c.role != 'player']
            entity_names.extend([i.name for i in current_state.inventory])
            entity_names.extend([m.name for m in current_state.monsters])
            entity_persistence = await self.memory_service.get_entity_persistence_data(session_id, entity_names)
            
            # Create comprehensive coherence context with entity persistence
            coherence_context = await self._build_enhanced_coherence_context(
                current_state, memory, relevant_memories, entity_persistence
            )
            
            # Create comprehensive prompt
            system_prompt = self._get_comprehensive_system_prompt()
            state_context = self._serialize_state_for_llm(current_state)
            memory_context = self._format_memory_context(relevant_memories, recent_memories)
            
            # Build enhanced prompt with coherence validation
            user_prompt = f"""
🎯 CONTEXTO DEL ESTADO ACTUAL:
{state_context}

🧠 MEMORIA Y COHERENCIA:
{memory_context}

🔍 CONTEXTO DE COHERENCIA:
{coherence_context}

👤 ENTRADA DEL JUGADOR: {user_input}

⚠️ VALIDACIONES DE COHERENCIA CRÍTICAS:
1. UBICACIÓN ACTUAL: "{current_state.scene.title}" - NO cambiar sin movimiento explícito
2. INVENTARIO ACTUAL: {len(current_state.inventory)} items - mantener coherencia
3. PERSONAJES PRESENTES: {[c.name for c in current_state.characters if c.role != 'player']}
4. BANDERAS ACTIVAS: {[k for k, v in current_state.flags.items() if isinstance(v, bool) and v]}
5. TURNO ACTUAL: {current_state.story_position.turn} (Capítulo {current_state.story_position.chapter})

🚫 FRASES PROHIBIDAS Y CLICHÉS:
- "La brisa suave acaricia tu rostro"
- "lleno de promesas y misterios"
- "mezcla de emoción y nerviosismo" 
- "el mundo aguarda tu próxima decisión"
- "un lugar lleno de promesas y misterios por descubrir"

✅ INSTRUCCIONES CRÍTICAS DE COHERENCIA:
1. MANTÉN SEGUNDA PERSONA: "te encuentras", "caminas", "ves" - NUNCA tercera persona
2. REFERENCIA ENTIDADES EXISTENTES: Si mencionas NPCs/items/monsters, usa los del estado actual
3. ACTUALIZA COHERENTEMENTE: Los cambios de estado deben reflejar la narrativa
4. VARÍA DESCRIPCIONES: No repitas frases de turnos anteriores
5. IMAGEN SOLO SI ES RELEVANTE: Nuevo lugar importante, personaje clave, evento especial

Responde ESTRICTAMENTE en el formato estructurado JSON requerido.
"""
            
            # Add prompt info to debug trace
            debug_tracer.add_prompt_info(step_id, debug_ctx, system_prompt, user_prompt)
            
            # Enhanced chain with retry logic
            structured_response = await self._execute_llm_with_retry(
                system_prompt, user_prompt, current_state, max_retries=3
            )
            
            llm_timer = performance_monitor.start_timer("llm_call")
            llm_duration = performance_monitor.end_timer(llm_timer)
            
            # Add LLM output to debug trace
            debug_tracer.add_llm_output(step_id, debug_ctx, str(structured_response), structured_response)
            
            # Validate and parse actions with enhanced structure
            actions = None
            if structured_response.actions:
                actions = [
                    Action(
                        id=f"action_{i}",
                        text=action.text,
                        risk=action.risk,
                        effect_hint=action.effect_hint,
                        may_end_game=action.may_end_game
                    )
                    for i, action in enumerate(structured_response.actions)
                ]
            
            # Enhanced memory update with context preservation
            memory_input = f"[Turno {current_state.story_position.turn}] {user_input}"
            memory_output = f"[{current_state.scene.title}] {structured_response.narration}"
            
            memory.save_context(
                {"input": memory_input},
                {"output": memory_output}
            )
            
            # Enhanced vector memory storage with entity tracking
            await self.memory_service.store_enhanced_scene_memory(
                session_id=session_id,
                state=current_state,
                narrative_text=structured_response.narration,
                user_input=user_input,
                entities_referenced=structured_response.entities_referenced or [],
                coherence_notes=structured_response.coherence_notes
            )
            
            # Create enhanced LLM output
            result = LLMOutput(
                narration=structured_response.narration,
                actions=actions,
                image_request=structured_response.image_request
            )
            
            # Apply enhanced state changes with validation
            if structured_response.state_changes:
                state_patch_data = {"operations": [change.model_dump() for change in structured_response.state_changes]}
                debug_tracer.add_state_patch(step_id, debug_ctx, state_patch_data)
                await self._apply_enhanced_state_changes(current_state, structured_response.state_changes, session_id)
            
            # Enhanced entity memory storage
            await self._store_enhanced_entity_interactions(session_id, current_state, structured_response)
            
            # Check if we should summarize the chapter
            await self._check_and_summarize_chapter(session_id, current_state)
            
            # Enhanced memory summary with coherence tracking
            buffer_content = memory.buffer if isinstance(memory.buffer, str) else str(memory.buffer)
            
            # Add coherence information to memory summary
            coherence_summary = f"\n[COHERENCIA T{current_state.story_position.turn}]: {structured_response.coherence_notes or 'Coherencia mantenida'}"
            enhanced_summary = buffer_content + coherence_summary
            
            memory_info = {
                "summaries_updated": True,
                "tokens_before": len(buffer_content.split()),
                "tokens_after": len(enhanced_summary.split()),
                "coherence_notes": structured_response.coherence_notes
            }
            debug_tracer.add_memory_ops(step_id, debug_ctx, memory_info)
            current_state.memory_summary = enhanced_summary
            
            # Add timing information
            total_duration = performance_monitor.end_timer(timer_id)
            timing_info = {
                "total_ms": total_duration,
                "llm_ms": llm_duration
            }
            debug_tracer.add_timing(step_id, debug_ctx, timing_info)
            
            # Record performance metrics
            performance_monitor.record_metric("story_generation_ms", total_duration)
            performance_monitor.record_metric("llm_call_ms", llm_duration)
            
            return result
            
        except (OutputParserException, ValidationError) as e:
            logger.error(f"Error parsing structured output: {e}")
            # Retry with simplified prompt
            return await self._fallback_generation(user_input, current_state, session_id)
            
        except Exception as e:
            logger.error(f"Error generating story continuation: {e}")
            # Enhanced fallback with state awareness and actions
            fallback_actions = [
                Action(
                    id="fallback_action_1",
                    text="Explorar cuidadosamente los alrededores",
                    risk="bajo",
                    effect_hint="Observar el entorno puede revelar pistas útiles"
                ),
                Action(
                    id="fallback_action_2", 
                    text="Reflexionar sobre la situación actual",
                    risk="bajo",
                    effect_hint="Tomar un momento para pensar puede aclarar las opciones"
                ),
                Action(
                    id="fallback_action_3",
                    text="Continuar con determinación hacia adelante",
                    risk="medio",
                    effect_hint="Avanzar podría traer tanto oportunidades como desafíos"
                )
            ]
            
            return LLMOutput(
                narration=f"En {current_state.scene.title}, mientras reflexionas sobre {user_input.lower()}, observas tu entorno con atención, considerando tus próximas acciones.",
                actions=fallback_actions
            )
    
    def _get_system_prompt(self) -> str:
        """Get basic system prompt for narrative generation"""
        return """
Eres el narrador de Aventra, un generador de historias interactivas con IA.

REGLAS FUNDAMENTALES:
- Mantén coherencia con el estado del juego (personajes, inventario, heridas, banderas)
- Narrativa en español, tono aventurero y descriptivo
- Evita violencia gráfica, mantén contenido apropiado
- El jugador es protagonista, sus decisiones importan
- Equilibra progresión narrativa sin resolver todo inmediatamente

ESTILO:
- 2-4 párrafos cortos por respuesta
- Descriptivo pero conciso
- Orientado a decisiones del jugador
- Inmersivo y cinematográfico
"""
    
    def _get_comprehensive_system_prompt(self) -> str:
        """Get comprehensive system prompt with structured output instructions"""
        return """
Eres el narrador-orquestador de Aventra, un generador de historias interactivas con IA.

REGLAS OPERATIVAS CRÍTICAS:
1. UBICACIÓN: Mantén tracking absoluto de dónde está el jugador. Si está en "Pueblo de Rojas", SIEMPRE menciona que sigue en el pueblo hasta que EXPLÍCITAMENTE se mueva
2. CONSISTENCIA DE ESTADO: No cambies inventario, personajes o ubicaciones sin que el jugador lo haga explícitamente
3. NO REPETIR FRASES: Evita usar las mismas frases descriptivas. Varía las descripciones pero mantén coherencia
4. PERSPECTIVA ÚNICA: Mantén SIEMPRE segunda persona ("te encuentras", "caminas") - nunca cambies a tercera persona
5. Narrativa en español neutro, tono aventurero pero variado
6. El jugador protagoniza, cada decisión debe tener consecuencias claras

GESTIÓN DE RIESGO Y REALISMO:
- Las acciones pueden fallar según probabilidades realistas del mundo
- Señaliza riesgo: bajo/medio/alto con pistas de posibles consecuencias
- Muerte/derrota solo en riesgos extremos o acumulación de malas decisiones
- Heridas y consecuencias se acumulan, afectando futuras probabilidades

IMÁGENES:
- Solo solicita imagen cuando la escena lo amerite (evento importante, nuevo lugar, personaje clave)
- No más de 1 cada 2-3 turnos salvo eventos especiales
- Descripción precisa y detallada para generación

RESPUESTA ESTRUCTURADA REQUERIDA:
Responde SIEMPRE en formato JSON válido con esta estructura:
{{
  "narration": "Texto narrativo visible al jugador (2-4 párrafos)",
  "actions": [  // Solo si hay decisión discreta A/B/C, sino omitir
    {{
      "text": "Descripción de la acción",
      "risk": "bajo|medio|alto",
      "effect_hint": "Pista de posible resultado",
      "may_end_game": boolean
    }}
  ],
  "image_request": "Descripción detallada para generar imagen (opcional)",
  "state_changes": [  // Cambios mínimos necesarios
    {{
      "type": "update_character|add_item|update_scene|set_flag|add_condition",
      "target": "id_del_objetivo",
      "data": {{...}}
    }}
  ]
}}

NUNCA expongas JSON en la narrativa visible. Solo texto fluido para el jugador.
"""
    
    def _get_intro_system_prompt(self) -> str:
        """Get specialized system prompt for introduction scenes"""
        return """
Eres el NARRADOR MAESTRO DE AVENTRA especializado en crear INTRODUCCIONES ÉPICAS.

🎭 MISIÓN ESPECÍFICA: ESCENA INICIAL PERFECTA
Tu tarea es crear la escena inicial más envolvente y emocionante posible para comenzar la aventura.

📋 REGLAS CRÍTICAS PARA INTRODUCCIONES:
1. IMMERSIÓN INMEDIATA: El jugador debe sentirse transportado al mundo desde la primera frase
2. SEGUNDA PERSONA ABSOLUTA: "Te encuentras", "observas", "sientes" - NUNCA tercera persona
3. SITUACIÓN ESPECÍFICA: NO empezar genéricamente, crear una situación concreta e interesante
4. ACCIONES OBLIGATORIAS: SIEMPRE incluir 3-4 acciones específicas y atractivas
5. WORLD-BUILDING: Introducir elementos del mundo naturalmente en la narrativa
6. GANCHO NARRATIVO: Crear intrigue o tensión que haga al jugador querer continuar

🚫 PROHIBIDO EN INTRODUCCIONES:
- Frases genéricas como "¿Qué quieres hacer?"
- Empezar en lugares aburridos sin contexto
- Preguntas abiertas sin opciones específicas
- Narrativa pasiva o descriptiva sin acción
- Referencias vagas o abstractas

✅ ELEMENTOS OBLIGATORIOS:
- Descripción sensorial rica (olores, sonidos, texturas, ambiente)
- Situación que requiere decisión inmediata
- Presentación natural del personaje en acción
- Elementos únicos del mundo mostrados sutilmente
- Sense of urgency o oportunidad

🎯 ESTRUCTURA IDEAL:
1. Hook inmediato - situación intrigante
2. Descripción inmersiva del entorno
3. Contexto del personaje en la situación
4. Elemento de tensión o oportunidad
5. Acciones específicas y atractivas

RESPUESTA ESTRUCTURADA OBLIGATORIA:
{{
  "narration": "Narrativa envolvente de 2-4 párrafos que transporta al jugador",
  "actions": [  // SIEMPRE incluir 3-4 acciones específicas
    {{
      "text": "Acción específica y atractiva",
      "risk": "bajo|medio|alto",
      "effect_hint": "Consecuencia interesante y específica",
      "may_end_game": false
    }}
  ],
  "image_request": "Descripción visual épica de la escena inicial",
  "entities_referenced": ["entidades mencionadas"],
  "coherence_notes": "Notas sobre coherencia establecida"
}}

Crea una introducción que haga al jugador decir "¡WOW, quiero jugar YA!"
"""
    
    def _serialize_state_for_llm(self, state: State) -> str:
        """Serialize current state for LLM context"""
        context_parts = []
        
        # Scene information with emphasis on location tracking
        context_parts.append(f"🎯 UBICACIÓN ACTUAL: {state.scene.title}")
        if state.scene.location:
            context_parts.append(f"📍 Lugar específico: {state.scene.location}")
        if state.scene.mood:
            context_parts.append(f"🌅 Ambiente: {state.scene.mood}")
        
        # Important: Add explicit location reminder
        context_parts.append(f"⚠️ RECORDATORIO: El jugador está en '{state.scene.title}' y NO debe cambiar de ubicación sin una acción explícita de movimiento")
        
        # Characters
        if state.characters:
            context_parts.append("\nPERSONAJES:")
            for char in state.characters:
                char_info = f"- {char.name} ({char.role})"
                if char.health is not None:
                    char_info += f" - Salud: {char.health}/100"
                if char.conditions:
                    conditions = [f"{c.name} ({c.severity})" for c in char.conditions]
                    char_info += f" - Condiciones: {', '.join(conditions)}"
                context_parts.append(char_info)
        
        # Inventory
        if state.inventory:
            context_parts.append("\nINVENTARIO:")
            for item in state.inventory:
                item_info = f"- {item.name}"
                if item.qty and item.qty > 1:
                    item_info += f" x{item.qty}"
                context_parts.append(item_info)
        
        # Active monsters
        if state.monsters:
            context_parts.append("\nCRIATURAS ACTIVAS:")
            for monster in state.monsters:
                monster_info = f"- {monster.name} (Amenaza: {monster.threat_level})"
                if monster.health is not None:
                    monster_info += f" - Salud: {monster.health}"
                context_parts.append(monster_info)
        
        # Important flags
        if state.flags:
            important_flags = {k: v for k, v in state.flags.items() if isinstance(v, bool) and v}
            if important_flags:
                context_parts.append(f"\nBANDERAS ACTIVAS: {', '.join(important_flags.keys())}")
        
        # Story position and memory
        context_parts.append(f"\nPOSICIÓN: Capítulo {state.story_position.chapter}, Turno {state.story_position.turn}")
        
        if state.memory_summary:
            context_parts.append(f"\nRESUMEN ANTERIOR: {state.memory_summary}")
        
        return "\n".join(context_parts)
    
    def _apply_state_changes(self, state: State, changes: List[Dict[str, Any]]):
        """Apply state changes from LLM response"""
        for change in changes:
            try:
                change_type = change.get("type")
                target = change.get("target")
                data = change.get("data", {})
                
                if change_type == "update_character":
                    self._update_character(state, target, data)
                elif change_type == "add_item":
                    self._add_item(state, data)
                elif change_type == "update_scene":
                    self._update_scene(state, data)
                elif change_type == "set_flag":
                    state.flags[target] = data.get("value")
                elif change_type == "add_condition":
                    self._add_condition(state, target, data)
                
            except Exception as e:
                logger.error(f"Error applying state change {change}: {e}")
    
    def _update_character(self, state: State, char_id: str, data: Dict[str, Any]):
        """Update character in state"""
        char = next((c for c in state.characters if c.id == char_id), None)
        if char:
            if "health" in data:
                char.health = max(0, min(100, data["health"]))
            if "notes" in data:
                char.notes = data["notes"]
    
    def _add_item(self, state: State, data: Dict[str, Any]):
        """Add item to inventory"""
        item = Item(
            id=data.get("id", str(uuid.uuid4())),
            name=data["name"],
            qty=data.get("qty", 1),
            description=data.get("description")
        )
        
        # Check if item already exists
        existing = next((i for i in state.inventory if i.name == item.name), None)
        if existing:
            existing.qty = (existing.qty or 1) + item.qty
        else:
            state.inventory.append(item)
    
    def _update_scene(self, state: State, data: Dict[str, Any]):
        """Update current scene"""
        if "title" in data:
            state.scene.title = data["title"]
        if "location" in data:
            state.scene.location = data["location"]
        if "mood" in data:
            state.scene.mood = data["mood"]
    
    def _add_condition(self, state: State, char_id: str, data: Dict[str, Any]):
        """Add condition to character"""
        char = next((c for c in state.characters if c.id == char_id), None)
        if char:
            if not char.conditions:
                char.conditions = []
            
            condition = Condition(
                id=data.get("id", str(uuid.uuid4())),
                type=data["type"],
                name=data["name"],
                severity=data.get("severity"),
                since_turn=state.story_position.turn,
                notes=data.get("notes"),
                mechanical_effects=data.get("mechanical_effects")
            )
            char.conditions.append(condition)
    
    def _format_memory_context(self, relevant_memories: List[Dict[str, Any]], recent_memories: List[Dict[str, Any]]) -> str:
        """Format memory context for LLM prompt"""
        context_parts = []
        
        if recent_memories:
            context_parts.append("MEMORIAS RECIENTES:")
            for memory in recent_memories[:3]:  # Limit to 3 most recent
                metadata = memory.get("metadata", {})
                content_preview = memory.get("content", "")[:200] + "..." if len(memory.get("content", "")) > 200 else memory.get("content", "")
                context_parts.append(f"• Turno {metadata.get('turn', '?')}: {content_preview}")
        
        if relevant_memories:
            context_parts.append("\nMEMORIAS RELEVANTES POR SIMILITUD:")
            for i, memory in enumerate(relevant_memories[:5]):  # Top 5 relevant
                metadata = memory.get("metadata", {})
                similarity = memory.get("similarity", 0.0)
                content_preview = memory.get("content", "")[:150] + "..." if len(memory.get("content", "")) > 150 else memory.get("content", "")
                
                if similarity > 0.7:  # Only include highly relevant memories
                    context_parts.append(f"• [{similarity:.2f}] {metadata.get('type', 'memoria')}: {content_preview}")
        
        return "\n".join(context_parts) if context_parts else "Sin memorias relevantes disponibles."
    
    async def _store_character_interactions(self, session_id: str, state: State, narrative_text: str):
        """Store character interaction memories"""
        try:
            # Extract character names mentioned in the narrative
            character_names = set()
            for char in state.characters:
                if char.role != 'player' and char.name.lower() in narrative_text.lower():
                    character_names.add(char.name)
            
            # Store interaction memories for mentioned characters
            for char_name in character_names:
                await self.memory_service.store_character_memory(
                    session_id=session_id,
                    character_name=char_name,
                    character_info=f"Interacción en {state.scene.title}",
                    interaction_context=narrative_text[:500]  # First 500 chars of narrative
                )
                
        except Exception as e:
            logger.error(f"Error storing character interactions: {e}")
    
    async def _check_and_summarize_chapter(self, session_id: str, state: State):
        """Check if we should summarize the current chapter"""
        try:
            # Summarize every 15-20 turns or when chapter changes
            should_summarize = (
                state.story_position.turn % 15 == 0 or  # Every 15 turns
                (state.story_position.turn > 1 and state.story_position.chapter != getattr(self, '_last_chapter', 1))
            )
            
            if should_summarize:
                chapter_summary = await self.memory_service.summarize_chapter(
                    session_id=session_id,
                    chapter=state.story_position.chapter,
                    max_memories=20
                )
                
                # Store the chapter summary
                key_events = [f"Resumen automático del capítulo {state.story_position.chapter}"]
                await self.memory_service.store_chapter_summary(
                    session_id=session_id,
                    chapter=state.story_position.chapter,
                    summary=chapter_summary,
                    key_events=key_events
                )
                
                self._last_chapter = state.story_position.chapter
                logger.info(f"Stored chapter summary for chapter {state.story_position.chapter}")
                
        except Exception as e:
            logger.error(f"Error checking/summarizing chapter: {e}")

    # ==================== MÉTODOS MEJORADOS PARA COHERENCIA ====================
    
    async def _get_enhanced_relevant_memories(
        self, 
        session_id: str, 
        user_input: str, 
        current_state: State,
        limit: int = 8
    ) -> List[Dict[str, Any]]:
        """Get enhanced relevant memories with entity context"""
        try:
            # Build enhanced query with current context
            query_context = f"""
            Ubicación: {current_state.scene.title}
            Personajes presentes: {', '.join([c.name for c in current_state.characters if c.role != 'player'])}
            Acción del jugador: {user_input}
            Contexto actual: {current_state.scene.mood or 'neutral'}
            """
            
            # Search memories with enhanced context
            memories = await self.memory_service.search_relevant_memories(
                session_id=session_id,
                query=query_context,
                memory_types=["scene_memories", "character_memories", "event_memories"],
                limit=limit
            )
            
            # Filter by relevance threshold
            filtered_memories = [m for m in memories if m.get("similarity", 0) > 0.6]
            
            return filtered_memories
            
        except Exception as e:
            logger.error(f"Error getting enhanced relevant memories: {e}")
            return []
    
    async def _get_recent_context_memories(
        self, 
        session_id: str, 
        current_state: State, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get recent memories from the same chapter"""
        try:
            # Get recent memories from current chapter
            recent_memories = await self.memory_service.get_recent_memories(
                session_id=session_id, 
                limit=limit * 2  # Get more to filter
            )
            
            # Filter by current chapter and recent turns
            current_chapter = current_state.story_position.chapter
            current_turn = current_state.story_position.turn
            
            filtered_memories = []
            for memory in recent_memories:
                metadata = memory.get("metadata", {})
                memory_chapter = metadata.get("chapter", 0)
                memory_turn = metadata.get("turn", 0)
                
                # Include memories from current chapter or very recent
                if (memory_chapter == current_chapter or 
                    (current_turn - memory_turn) <= 3):
                    filtered_memories.append(memory)
            
            return filtered_memories[:limit]
            
        except Exception as e:
            logger.error(f"Error getting recent context memories: {e}")
            return []
    
    async def _get_entity_memories(
        self, 
        session_id: str, 
        current_state: State
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Get memories specific to entities in current state"""
        try:
            entity_memories = {
                "characters": [],
                "items": [],
                "locations": []
            }
            
            # Get character memories
            for char in current_state.characters:
                if char.role != 'player':
                    char_memories = await self.memory_service.search_relevant_memories(
                        session_id=session_id,
                        query=f"personaje {char.name}",
                        memory_types=["character_memories"],
                        limit=3
                    )
                    entity_memories["characters"].extend(char_memories)
            
            # Get location memories
            location_memories = await self.memory_service.search_relevant_memories(
                session_id=session_id,
                query=f"ubicación {current_state.scene.title}",
                memory_types=["scene_memories"],
                limit=3
            )
            entity_memories["locations"].extend(location_memories)
            
            return entity_memories
            
        except Exception as e:
            logger.error(f"Error getting entity memories: {e}")
            return {"characters": [], "items": [], "locations": []}
    
    async def _build_coherence_context(
        self, 
        current_state: State, 
        memory: ConversationSummaryBufferMemory,
        relevant_memories: List[Dict[str, Any]]
    ) -> str:
        """Build coherence validation context"""
        try:
            context_parts = []
            
            # Add turn continuity info
            context_parts.append(f"CONTINUIDAD DE TURNO:")
            context_parts.append(f"- Turno anterior: {current_state.story_position.turn - 1}")
            context_parts.append(f"- Turno actual: {current_state.story_position.turn}")
            
            # Add entity consistency requirements
            context_parts.append(f"\nCONSISTENCIA DE ENTIDADES:")
            if current_state.characters:
                context_parts.append(f"- Personajes que DEBEN mantenerse: {[c.name for c in current_state.characters]}")
            if current_state.inventory:
                context_parts.append(f"- Items que DEBEN conservarse: {[i.name for i in current_state.inventory]}")
            if current_state.monsters:
                context_parts.append(f"- Criaturas que DEBEN continuar: {[m.name for m in current_state.monsters]}")
            
            # Add recent narrative context
            if relevant_memories:
                recent_narrative = relevant_memories[0].get("content", "")
                if "NARRATIVA:" in recent_narrative:
                    narrative_part = recent_narrative.split("NARRATIVA:")[1].split("ENTRADA DEL JUGADOR:")[0].strip()
                    context_parts.append(f"\nNARRATIVA PREVIA DIRECTA:")
                    context_parts.append(f"- {narrative_part[:200]}...")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error building coherence context: {e}")
            return "Error en contexto de coherencia"
    
    async def _build_enhanced_coherence_context(
        self, 
        current_state: State, 
        memory: ConversationSummaryBufferMemory,
        relevant_memories: List[Dict[str, Any]],
        entity_persistence: Dict[str, Dict[str, Any]]
    ) -> str:
        """Build enhanced coherence validation context with entity persistence"""
        try:
            context_parts = []
            
            # Add turn continuity info
            context_parts.append(f"📋 CONTINUIDAD DE TURNO:")
            context_parts.append(f"- Turno anterior: {current_state.story_position.turn - 1}")
            context_parts.append(f"- Turno actual: {current_state.story_position.turn}")
            
            # Enhanced entity consistency with persistence data
            context_parts.append(f"\n🔗 CONSISTENCIA DE ENTIDADES PERSISTENTES:")
            
            # Characters with persistence info
            if current_state.characters:
                context_parts.append(f"- PERSONAJES ACTIVOS:")
                for char in current_state.characters:
                    char_info = f"  • {char.name} ({char.role})"
                    if char.name in entity_persistence:
                        persistence = entity_persistence[char.name]
                        char_info += f" - Apariciones: {persistence.get('total_references', 0)}"
                        if persistence.get('first_appearance'):
                            char_info += f" (Desde T{persistence['first_appearance']})"
                    context_parts.append(char_info)
            
            # Items with persistence info
            if current_state.inventory:
                context_parts.append(f"- INVENTARIO PERSISTENTE:")
                for item in current_state.inventory:
                    item_info = f"  • {item.name} x{item.qty or 1}"
                    if item.name in entity_persistence:
                        persistence = entity_persistence[item.name]
                        item_info += f" - Refs: {persistence.get('total_references', 0)}"
                    context_parts.append(item_info)
            
            # Monsters with persistence info
            if current_state.monsters:
                context_parts.append(f"- CRIATURAS PERSISTENTES:")
                for monster in current_state.monsters:
                    monster_info = f"  • {monster.name} (Amenaza {monster.threat_level})"
                    if monster.name in entity_persistence:
                        persistence = entity_persistence[monster.name]
                        monster_info += f" - Refs: {persistence.get('total_references', 0)}"
                    context_parts.append(monster_info)
            
            # Entity history and interactions
            if entity_persistence:
                context_parts.append(f"\n📚 HISTORIAL DE ENTIDADES:")
                for entity_name, data in entity_persistence.items():
                    if data.get('interactions'):
                        latest_interaction = data['interactions'][-1]
                        context_parts.append(f"- {entity_name}: Última interacción T{latest_interaction['turn']}")
                        context_parts.append(f"  {latest_interaction['description'][:100]}...")
            
            # Validate entity consistency
            consistency_check = await self.entity_service.validate_entity_consistency(
                session_id=current_state.scene.id,  # Using scene.id as session proxy
                state=current_state
            )
            
            if not consistency_check.get('consistent', True):
                context_parts.append(f"\n⚠️ INCONSISTENCIAS DETECTADAS:")
                for inconsistency in consistency_check.get('inconsistencies', []):
                    context_parts.append(f"- {inconsistency['type']}: {inconsistency['entity_id']}")
            
            # Add recent narrative context
            if relevant_memories:
                recent_narrative = relevant_memories[0].get("content", "")
                if "NARRATIVA:" in recent_narrative:
                    narrative_part = recent_narrative.split("NARRATIVA:")[1].split("ENTRADA DEL JUGADOR:")[0].strip()
                    context_parts.append(f"\n📖 NARRATIVA PREVIA DIRECTA:")
                    context_parts.append(f"- {narrative_part[:200]}...")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error building enhanced coherence context: {e}")
            return "Error en contexto de coherencia mejorado"
    
    def _format_enhanced_memory_context(
        self, 
        relevant_memories: List[Dict[str, Any]], 
        recent_memories: List[Dict[str, Any]],
        entity_memories: Dict[str, List[Dict[str, Any]]]
    ) -> str:
        """Format enhanced memory context with entity organization"""
        context_parts = []
        
        # Recent context memories (highest priority)
        if recent_memories:
            context_parts.append("🕐 MEMORIA INMEDIATA (Últimos turnos):")
            for i, memory in enumerate(recent_memories[:3]):
                metadata = memory.get("metadata", {})
                content = memory.get("content", "")
                
                # Extract key information
                if "NARRATIVA:" in content:
                    narrative_part = content.split("NARRATIVA:")[1].split("ENTRADA DEL JUGADOR:")[0].strip()
                    preview = narrative_part[:150] + "..." if len(narrative_part) > 150 else narrative_part
                    context_parts.append(f"  • T{metadata.get('turn', '?')}: {preview}")
        
        # Entity-specific memories
        if entity_memories.get("characters"):
            context_parts.append("\n👥 MEMORIA DE PERSONAJES:")
            for memory in entity_memories["characters"][:3]:
                content = memory.get("content", "")
                if "PERSONAJE:" in content:
                    char_info = content.split("PERSONAJE:")[1].split("INFORMACIÓN:")[0].strip()
                    context_parts.append(f"  • {char_info}")
        
        if entity_memories.get("locations"):
            context_parts.append("\n🗺️ MEMORIA DE UBICACIONES:")
            for memory in entity_memories["locations"][:2]:
                metadata = memory.get("metadata", {})
                location = metadata.get("scene_title", "Ubicación desconocida")
                context_parts.append(f"  • {location}")
        
        # Relevant semantic memories
        if relevant_memories:
            context_parts.append("\n🎯 MEMORIAS SEMÁNTICAMENTE RELEVANTES:")
            for memory in relevant_memories[:3]:
                metadata = memory.get("metadata", {})
                similarity = memory.get("similarity", 0.0)
                if similarity > 0.7:
                    content_preview = memory.get("content", "")[:100] + "..."
                    context_parts.append(f"  • [{similarity:.2f}] {content_preview}")
        
        return "\n".join(context_parts) if context_parts else "Sin memorias contextualmente relevantes."
    
    async def _execute_llm_with_retry(
        self, 
        system_prompt: str, 
        user_prompt: str, 
        current_state: State,
        max_retries: int = 3
    ) -> StructuredLLMOutput:
        """Execute LLM with retry logic and validation"""
        
        # Build primary LLM and keep optional fallback ready
        llm_for_call = self._build_chat_model(use_fallback=False)
        fallback_available = bool(os.getenv("FALLBACK_API_KEY") or os.getenv("FALLBACK_BASE_URL"))
        used_fallback = False

        for attempt in range(max_retries):
            try:
                prompt = ChatPromptTemplate.from_messages([
                    ("system", system_prompt),
                    ("human", user_prompt)
                ])
                
                # Enhanced chain with strict validation
                chain = prompt | llm_for_call | self.output_parser
                
                result = await chain.ainvoke({
                    "format_instructions": self.output_parser.get_format_instructions()
                })
                
                # Validate result coherence
                if self._validate_output_coherence(result, current_state):
                    return result
                else:
                    logger.warning(f"Coherence validation failed on attempt {attempt + 1}")
                    if attempt == max_retries - 1:
                        return result  # Return even if validation fails on last attempt
                        
            except (OutputParserException, ValidationError) as e:
                logger.error(f"Parsing error on attempt {attempt + 1}: {e}")
                if attempt == max_retries - 1:
                    # Create fallback structured output
                    return StructuredLLMOutput(
                        narration=f"En {current_state.scene.title}, el momento requiere tu atención cuidadosa mientras consideras tus próximas acciones.",
                        coherence_notes="Respuesta de emergencia debido a error de parsing"
                    )
                await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
            except Exception as e:
                # Try provider fallback once on quota errors
                if not used_fallback and fallback_available and self._is_quota_error(e):
                    logger.error("Quota error detected; switching to FALLBACK_* provider configuration and retrying once")
                    llm_for_call = self._build_chat_model(use_fallback=True)
                    used_fallback = True
                    # Immediate retry without increasing backoff further
                    await asyncio.sleep(0.2)
                    continue
                # Other errors or already tried fallback: propagate to outer handler
                raise
        
        # This should never be reached, but just in case
        return StructuredLLMOutput(
            narration="El mundo aguarda tu decisión...",
            coherence_notes="Respuesta de emergencia"
        )
    
    def _validate_output_coherence(self, output: StructuredLLMOutput, current_state: State) -> bool:
        """Validate output maintains coherence with current state"""
        try:
            # Basic validation checks
            if not output.narration or len(output.narration.strip()) < 10:
                return False
            
            # Check for forbidden phrases
            forbidden_phrases = [
                "la brisa suave acaricia tu rostro",
                "lleno de promesas y misterios",
                "el mundo aguarda tu próxima decisión"
            ]
            
            narration_lower = output.narration.lower()
            for phrase in forbidden_phrases:
                if phrase in narration_lower:
                    logger.warning(f"Forbidden phrase detected: {phrase}")
                    return False
            
            # Check location consistency if mentioned
            current_location = current_state.scene.title.lower()
            if current_location in narration_lower:
                # Location is mentioned, which is good for consistency
                pass
            
            # Validate state changes if present
            if output.state_changes:
                for change in output.state_changes:
                    if not change.type or not change.data:
                        logger.warning(f"Invalid state change: {change}")
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating coherence: {e}")
            return True  # Default to accepting if validation fails
    
    async def _apply_enhanced_state_changes(
        self, 
        state: State, 
        changes: List[StateChange], 
        session_id: str
    ):
        """Apply state changes with enhanced entity tracking"""
        for change in changes:
            try:
                change_type = change.type
                target = change.target
                data = change.data
                reason = change.reason
                
                logger.info(f"Applying state change: {change_type} to {target} - {reason}")
                
                if change_type == "update_character":
                    await self._update_character_enhanced(state, target, data, session_id)
                elif change_type == "add_item":
                    await self._add_item_enhanced(state, data, session_id)
                elif change_type == "remove_item":
                    await self._remove_item_enhanced(state, target, data, session_id)
                elif change_type == "update_scene":
                    self._update_scene_enhanced(state, data)
                elif change_type == "set_flag":
                    state.flags[target] = data.get("value")
                elif change_type == "add_condition":
                    await self._add_condition_enhanced(state, target, data, session_id)
                elif change_type == "update_monster":
                    await self._update_monster_enhanced(state, target, data, session_id)
                
            except Exception as e:
                logger.error(f"Error applying state change {change}: {e}")
    
    async def _update_character_enhanced(self, state: State, char_id: str, data: Dict[str, Any], session_id: str):
        """Enhanced character update with memory tracking"""
        char = next((c for c in state.characters if c.id == char_id), None)
        if char:
            original_data = char.model_dump()
            
            if "health" in data:
                char.health = max(0, min(100, data["health"]))
            if "notes" in data:
                char.notes = data["notes"]
            if "alive" in data:
                char.alive = data["alive"]
            
            # Store character update in memory
            await self.memory_service.store_character_memory(
                session_id=session_id,
                character_name=char.name,
                character_info=f"Actualización: {data}",
                interaction_context=f"Estado previo: {original_data}"
            )
    
    async def _add_item_enhanced(self, state: State, data: Dict[str, Any], session_id: str):
        """Enhanced item addition with duplicate checking"""
        from ..models.state import Item
        
        item_name = data["name"]
        
        # Check if item already exists
        existing = next((i for i in state.inventory if i.name.lower() == item_name.lower()), None)
        if existing:
            # Increase quantity instead of adding duplicate
            existing.qty = (existing.qty or 1) + data.get("qty", 1)
            logger.info(f"Increased {item_name} quantity to {existing.qty}")
        else:
            # Add new item
            item = Item(
                id=data.get("id", str(uuid.uuid4())),
                name=item_name,
                qty=data.get("qty", 1),
                description=data.get("description")
            )
            state.inventory.append(item)
            logger.info(f"Added new item: {item_name}")
    
    async def _remove_item_enhanced(self, state: State, item_id: str, data: Dict[str, Any], session_id: str):
        """Enhanced item removal with validation"""
        # Find item by ID or name
        item_to_remove = None
        for item in state.inventory:
            if item.id == item_id or item.name.lower() == item_id.lower():
                item_to_remove = item
                break
        
        if item_to_remove:
            qty_to_remove = data.get("quantity", 1)
            
            if item_to_remove.qty and item_to_remove.qty > qty_to_remove:
                # Reduce quantity
                item_to_remove.qty -= qty_to_remove
                logger.info(f"Reduced {item_to_remove.name} quantity to {item_to_remove.qty}")
            else:
                # Remove completely
                state.inventory.remove(item_to_remove)
                logger.info(f"Removed item: {item_to_remove.name}")
    
    def _update_scene_enhanced(self, state: State, data: Dict[str, Any]):
        """Enhanced scene update with validation"""
        if "title" in data:
            logger.info(f"Scene change: {state.scene.title} -> {data['title']}")
            state.scene.title = data["title"]
        if "location" in data:
            state.scene.location = data["location"]
        if "mood" in data:
            state.scene.mood = data["mood"]
    
    async def _add_condition_enhanced(self, state: State, char_id: str, data: Dict[str, Any], session_id: str):
        """Enhanced condition addition with tracking"""
        from ..models.state import Condition
        
        char = next((c for c in state.characters if c.id == char_id), None)
        if char:
            if not char.conditions:
                char.conditions = []
            
            condition = Condition(
                id=data.get("id", str(uuid.uuid4())),
                type=data["type"],
                name=data["name"],
                severity=data.get("severity"),
                since_turn=state.story_position.turn,
                notes=data.get("notes"),
                mechanical_effects=data.get("mechanical_effects")
            )
            char.conditions.append(condition)
            
            logger.info(f"Added condition {condition.name} to {char.name}")
    
    async def _update_monster_enhanced(self, state: State, monster_id: str, data: Dict[str, Any], session_id: str):
        """Enhanced monster update with memory tracking"""
        monster = next((m for m in state.monsters if m.id == monster_id), None)
        if monster:
            if "health" in data:
                monster.health = max(0, data["health"])
            if "notes" in data:
                monster.notes = data["notes"]
            
            logger.info(f"Updated monster: {monster.name}")
    
    async def _store_enhanced_entity_interactions(self, session_id: str, state: State, response: StructuredLLMOutput):
        """Store enhanced entity interactions with detailed tracking"""
        try:
            # Track all entities mentioned in the narrative
            narrative_lower = response.narration.lower()
            
            # Track character interactions
            for char in state.characters:
                if char.role != 'player' and char.name.lower() in narrative_lower:
                    await self.memory_service.store_character_memory(
                        session_id=session_id,
                        character_name=char.name,
                        character_info=f"Interacción T{state.story_position.turn} en {state.scene.title}",
                        interaction_context=response.narration[:500]
                    )
            
            # Track item usage
            for item in state.inventory:
                if item.name.lower() in narrative_lower:
                    await self.memory_service.store_scene_memory(
                        session_id=session_id,
                        state=state,
                        narrative_text=f"USO DE ITEM: {item.name} - {response.narration[:200]}",
                        user_input=f"Item usage: {item.name}"
                    )
            
            # Track monster interactions
            for monster in state.monsters:
                if monster.name.lower() in narrative_lower:
                    await self.memory_service.store_scene_memory(
                        session_id=session_id,
                        state=state,
                        narrative_text=f"ENCUENTRO: {monster.name} - {response.narration[:200]}",
                        user_input=f"Monster encounter: {monster.name}"
                    )
                    
        except Exception as e:
            logger.error(f"Error storing enhanced entity interactions: {e}")
    
    async def _fallback_generation(self, user_input: str, current_state: State, session_id: str) -> LLMOutput:
        """Fallback generation with simplified prompt when structured parsing fails"""
        try:
            simple_prompt = f"""
            Eres el narrador de Aventra. El jugador está en {current_state.scene.title}.
            
            El jugador dice: {user_input}
            
            Responde con una narrativa simple en 2-3 párrafos que:
            1. Mantenga al jugador en {current_state.scene.title}
            2. Use segunda persona
            3. Sea coherente con la situación
            
            Solo texto narrativo, sin JSON.
            """
            
            result = await self.generate_narrative(simple_prompt, session_id)
            
            # Add basic fallback actions for parsed scenarios too
            basic_actions = [
                Action(
                    id="basic_action_1",
                    text="Examinar la situación más de cerca",
                    risk="bajo",
                    effect_hint="Una observación cuidadosa podría revelar detalles importantes"
                ),
                Action(
                    id="basic_action_2",
                    text="Buscar alternativas en el entorno",
                    risk="bajo", 
                    effect_hint="Explorar puede abrir nuevas posibilidades"
                ),
                Action(
                    id="basic_action_3",
                    text="Actuar con base en tu experiencia",
                    risk="medio",
                    effect_hint="Confiar en tu instinto puede ser arriesgado pero efectivo"
                )
            ]
            
            return LLMOutput(
                narration=result,
                actions=basic_actions,
                image_request=None
            )
            
        except Exception as e:
            logger.error(f"Error in fallback generation: {e}")
            # Final fallback with actions
            final_actions = [
                Action(
                    id="final_action_1",
                    text="Permanecer alerta y observar",
                    risk="bajo",
                    effect_hint="La paciencia y observación suelen revelar oportunidades"
                ),
                Action(
                    id="final_action_2",
                    text="Tomar acción inmediata",
                    risk="medio",
                    effect_hint="Actuar rápidamente puede cambiar la situación"
                )
            ]
            
            return LLMOutput(
                narration=f"En {current_state.scene.title}, consideras cuidadosamente tu próximo movimiento después de {user_input.lower()}.",
                actions=final_actions
            )
    
    async def _store_enhanced_scene_memory(
        self,
        session_id: str,
        state: State,
        narrative_text: str,
        user_input: str,
        entities_referenced: List[str],
        coherence_notes: Optional[str]
    ):
        """Store enhanced scene memory with detailed entity tracking"""
        try:
            # Enhanced memory text with entity tracking
            memory_text = f"""
            ESCENA: {state.scene.title}
            UBICACIÓN: {state.scene.location or 'Desconocida'}
            TURNO: {state.story_position.turn}
            CAPÍTULO: {state.story_position.chapter}
            
            NARRATIVA: {narrative_text}
            
            ENTRADA DEL JUGADOR: {user_input or 'N/A'}
            
            ENTIDADES REFERENCIADAS: {', '.join(entities_referenced) if entities_referenced else 'Ninguna'}
            
            NOTAS DE COHERENCIA: {coherence_notes or 'N/A'}
            
            CONTEXTO DETALLADO:
            - Personajes activos: {', '.join([f"{c.name} ({c.role})" for c in state.characters])}
            - Inventario completo: {', '.join([f"{i.name} x{i.qty or 1}" for i in state.inventory])}
            - Criaturas presentes: {', '.join([f"{m.name} (Amenaza {m.threat_level})" for m in state.monsters])}
            - Banderas activas: {', '.join([f"{k}={v}" for k, v in state.flags.items() if v])}
            - Estado del juego: {"Activo" if not state.game.is_game_over else "Terminado"}
            """
            
            # Use enhanced memory service method if available, otherwise fall back to standard
            if hasattr(self.memory_service, 'store_enhanced_scene_memory'):
                await self.memory_service.store_enhanced_scene_memory(
                    session_id=session_id,
                    state=state,
                    narrative_text=narrative_text,
                    user_input=user_input,
                    entities_referenced=entities_referenced,
                    coherence_notes=coherence_notes
                )
            else:
                # Fallback to standard scene memory storage
                await self.memory_service.store_scene_memory(
                    session_id=session_id,
                    state=state,
                    narrative_text=memory_text,
                    user_input=user_input
                )
            
            logger.debug(f"Stored enhanced scene memory for turn {state.story_position.turn} with {len(entities_referenced)} entities")
            
        except Exception as e:
            logger.error(f"Error storing enhanced scene memory: {e}")
            # Fallback to basic storage
            try:
                await self.memory_service.store_scene_memory(
                    session_id=session_id,
                    state=state,
                    narrative_text=narrative_text,
                    user_input=user_input
                )
            except Exception as fallback_error:
                logger.error(f"Fallback memory storage also failed: {fallback_error}")