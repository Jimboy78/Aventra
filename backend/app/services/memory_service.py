import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except Exception:
    chromadb = None
    Settings = None
    CHROMA_AVAILABLE = False

from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.schema import Document

from ..models.state import State, JournalEntry
from ..utils.logger import get_logger

logger = get_logger(__name__)


class MemoryService:
    """Service for vector-based memory management using ChromaDB"""
    
    def __init__(self):
        # Feature flag: disable vector memory if ChromaDB is not available
        self.enabled = CHROMA_AVAILABLE
        if not self.enabled:
            logger.warning("ChromaDB no está disponible. La memoria vectorial está deshabilitada.")
            return

        # Initialize ChromaDB client
        self.chroma_client = chromadb.PersistentClient(
            path="./data/chroma",
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Initialize OpenAI embeddings
        self.embeddings = OpenAIEmbeddings(
            api_key=os.getenv("OPENAI_API_KEY"),
            model="text-embedding-3-small"  # Más eficiente para resúmenes
        )
        
        # Collections for different types of memories
        self.collections = {
            "scene_memories": self._get_or_create_collection("scene_memories"),
            "character_memories": self._get_or_create_collection("character_memories"), 
            "event_memories": self._get_or_create_collection("event_memories"),
            "chapter_summaries": self._get_or_create_collection("chapter_summaries")
        }
        
        logger.info("MemoryService initialized with ChromaDB")
    
    def _get_or_create_collection(self, name: str):
        """Get or create a ChromaDB collection"""
        if not self.enabled:
            logger.debug("Memoria vectorial deshabilitada: store_scene_memory omitido")
            return
        try:
            return self.chroma_client.get_collection(name=name)
        except Exception:  # Changed from ValueError to Exception to catch ChromaDB errors
            return self.chroma_client.create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"}
            )
    
    async def store_scene_memory(
        self,
        session_id: str,
        state: State,
        narrative_text: str,
        user_input: Optional[str] = None
    ):
        """Store scene memory with vector embedding"""
        if not self.enabled:
            logger.debug("Memoria vectorial deshabilitada: store_character_memory omitido")
            return
        try:
            # Create memory document
            memory_text = f"""
            ESCENA: {state.scene.title}
            UBICACIÓN: {state.scene.location or 'Desconocida'}
            TURNO: {state.story_position.turn}
            CAPÍTULO: {state.story_position.chapter}
            
            NARRATIVA: {narrative_text}
            
            ENTRADA DEL JUGADOR: {user_input or 'N/A'}
            
            CONTEXTO:
            - Personajes activos: {', '.join([c.name for c in state.characters if c.role != 'player'])}
            - Inventario: {', '.join([f"{i.name} x{i.qty or 1}" for i in state.inventory[:5]])}
            - Banderas activas: {', '.join([k for k, v in state.flags.items() if isinstance(v, bool) and v])}
            """
            
            # Generate embedding and store
            embedding = await self._generate_embedding(memory_text)
            
            memory_id = f"{session_id}_{state.story_position.chapter}_{state.story_position.turn}"
            
            self.collections["scene_memories"].upsert(
                ids=[memory_id],
                embeddings=[embedding],
                documents=[memory_text],
                metadatas=[{
                    "session_id": session_id,
                    "chapter": state.story_position.chapter,
                    "turn": state.story_position.turn,
                    "scene_title": state.scene.title,
                    "location": state.scene.location or "",
                    "timestamp": datetime.now().isoformat(),
                    "type": "scene"
                }]
            )
            
            logger.debug(f"Stored scene memory for turn {state.story_position.turn}")
            
        except Exception as e:
            logger.error(f"Error storing scene memory: {e}")
    
    async def store_character_memory(
        self,
        session_id: str,
        character_name: str,
        character_info: str,
        interaction_context: str
    ):
        """Store character-specific memory"""
        if not self.enabled:
            logger.debug("Memoria vectorial deshabilitada: store_chapter_summary omitido")
            return
        try:
            memory_text = f"""
            PERSONAJE: {character_name}
            INFORMACIÓN: {character_info}
            CONTEXTO DE INTERACCIÓN: {interaction_context}
            """
            
            embedding = await self._generate_embedding(memory_text)
            memory_id = f"{session_id}_{character_name}_{uuid.uuid4().hex[:8]}"
            
            self.collections["character_memories"].upsert(
                ids=[memory_id],
                embeddings=[embedding],
                documents=[memory_text],
                metadatas=[{
                    "session_id": session_id,
                    "character_name": character_name,
                    "timestamp": datetime.now().isoformat(),
                    "type": "character"
                }]
            )
            
            logger.debug(f"Stored character memory for {character_name}")
            
        except Exception as e:
            logger.error(f"Error storing character memory: {e}")
    
    async def store_chapter_summary(
        self,
        session_id: str,
        chapter: int,
        summary: str,
        key_events: List[str]
    ):
        """Store chapter summary for long-term memory"""
        if not self.enabled:
            logger.debug("Memoria vectorial deshabilitada: search_relevant_memories -> []")
            return []
        try:
            memory_text = f"""
            RESUMEN DEL CAPÍTULO {chapter}:
            {summary}
            
            EVENTOS CLAVE:
            {chr(10).join([f"- {event}" for event in key_events])}
            """
            
            embedding = await self._generate_embedding(memory_text)
            memory_id = f"{session_id}_chapter_{chapter}"
            
            self.collections["chapter_summaries"].upsert(
                ids=[memory_id],
                embeddings=[embedding],
                documents=[memory_text],
                metadatas=[{
                    "session_id": session_id,
                    "chapter": chapter,
                    "timestamp": datetime.now().isoformat(),
                    "type": "chapter_summary"
                }]
            )
            
            logger.info(f"Stored chapter {chapter} summary")
            
        except Exception as e:
            logger.error(f"Error storing chapter summary: {e}")
    
    async def search_relevant_memories(
        self,
        session_id: str,
        query: str,
        memory_types: List[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Search for relevant memories using semantic similarity"""
        if not self.enabled:
            logger.debug("Memoria vectorial deshabilitada: get_recent_memories -> []")
            return []
        try:
            if memory_types is None:
                memory_types = ["scene_memories", "character_memories", "event_memories"]
            
            all_results = []
            
            # Generate embedding for query
            query_embedding = await self._generate_embedding(query)
            
            # Search in each specified collection
            for memory_type in memory_types:
                if memory_type not in self.collections:
                    continue
                
                results = self.collections[memory_type].query(
                    query_embeddings=[query_embedding],
                    n_results=limit,
                    where={"session_id": session_id}
                )
                
                # Format results
                for i, doc in enumerate(results.get("documents", [[]])[0]):
                    if doc:  # Skip empty results
                        metadata = results.get("metadatas", [[]])[0][i] if i < len(results.get("metadatas", [[]])[0]) else {}
                        distance = results.get("distances", [[]])[0][i] if i < len(results.get("distances", [[]])[0]) else 1.0
                        
                        all_results.append({
                            "content": doc,
                            "metadata": metadata,
                            "similarity": 1.0 - distance,  # Convert distance to similarity
                            "type": memory_type
                        })
            
            # Sort by similarity and return top results
            all_results.sort(key=lambda x: x["similarity"], reverse=True)
            return all_results[:limit]
            
        except Exception as e:
            logger.error(f"Error searching memories: {e}")
            return []
    
    async def get_recent_memories(
        self,
        session_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent memories chronologically"""
        if not self.enabled:
            logger.debug("Memoria vectorial deshabilitada: get_recent_memories -> []")
            return []
        try:
            # Use get() instead of query() for metadata-only filtering
            results = self.collections["scene_memories"].get(
                limit=limit,
                where={"session_id": session_id}
            )
            
            memories = []
            for i, doc in enumerate(results.get("documents", [])):
                if doc:
                    metadata = results.get("metadatas", [])[i] if i < len(results.get("metadatas", [])) else {}
                    memories.append({
                        "content": doc,
                        "metadata": metadata,
                        "type": "scene_memory"
                    })
            
            # Sort by turn number (most recent first)
            memories.sort(key=lambda x: x["metadata"].get("turn", 0), reverse=True)
            return memories
            
        except Exception as e:
            logger.error(f"Error getting recent memories: {e}")
            return []
    
    async def summarize_chapter(
        self,
        session_id: str,
        chapter: int,
        max_memories: int = 20
    ) -> str:
        """Generate a chapter summary from scene memories"""
        if not self.enabled:
            logger.debug("Memoria vectorial deshabilitada: summarize_chapter -> msg básico")
            return f"Capítulo {chapter} - Sin memorias (memoria vectorial deshabilitada)"
        try:
            # Get all memories from the chapter
            results = self.collections["scene_memories"].get(
                limit=max_memories,
                where={
                    "$and": [
                        {"session_id": session_id},
                        {"chapter": chapter}
                    ]
                }
            )
            
            if not results.get("documents"):
                return f"Capítulo {chapter} - Sin memorias registradas"
            
            # Compile chapter events
            events = []
            for doc in results["documents"][0]:
                if doc:
                    events.append(doc)
            
            # Create summary (simplified - could use LLM for better summarization)
            summary = f"Capítulo {chapter}: "
            if events:
                first_event = events[0]
                last_event = events[-1]
                summary += f"Desde {first_event.split('ESCENA:')[1].split('UBICACIÓN:')[0].strip()} "
                summary += f"hasta {last_event.split('ESCENA:')[1].split('UBICACIÓN:')[0].strip()}. "
                summary += f"Total de {len(events)} escenas registradas."
            
            return summary
            
        except Exception as e:
            logger.error(f"Error summarizing chapter {chapter}: {e}")
            return f"Error generando resumen del capítulo {chapter}"
    
    async def cleanup_session(self, session_id: str):
        """Clean up memories for a session"""
        if not self.enabled:
            logger.debug("Memoria vectorial deshabilitada: get_memory_stats -> vacíos")
            return {"total_memories": 0, "by_type": {}, "session_id": session_id}
        try:
            for collection in self.collections.values():
                # Get all IDs for the session
                results = collection.get(
                    limit=1000,  # Large number to get all
                    where={"session_id": session_id}
                )
                
                if results.get("ids"):
                    ids_to_delete = [id_list for id_list in results["ids"] if id_list]
                    if ids_to_delete:
                        flat_ids = [id_item for sublist in ids_to_delete for id_item in sublist]
                        if flat_ids:
                            collection.delete(ids=flat_ids)
            
            logger.info(f"Cleaned up memories for session {session_id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up session memories: {e}")
    
    async def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text with retry logic"""
        import asyncio
        import random
        
        max_retries = 3
        base_delay = 1.0
        
        for attempt in range(max_retries):
            try:
                # Use OpenAI embeddings
                embedding = await self.embeddings.aembed_query(text)
                return embedding
            except Exception as e:
                logger.error(f"Error generating embedding (attempt {attempt + 1}/{max_retries}): {e}")
                
                if attempt < max_retries - 1:
                    # Exponential backoff with jitter
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    await asyncio.sleep(delay)
                    continue
                    
                # Final fallback after all retries failed
                logger.warning("All embedding generation attempts failed, using zero vector fallback")
                return [0.0] * 1536  # OpenAI embedding dimension
    
    def get_memory_stats(self, session_id: str) -> Dict[str, Any]:
        """Get memory statistics for a session"""
        try:
            stats = {}
            
            for collection_name, collection in self.collections.items():
                results = collection.get(
                    limit=1000,
                    where={"session_id": session_id}
                )
                
                count = len(results.get("documents", []))
                stats[collection_name] = count
            
            return {
                "total_memories": sum(stats.values()),
                "by_type": stats,
                "session_id": session_id
            }
            
        except Exception as e:
            logger.error(f"Error getting memory stats: {e}")
            return {"error": str(e)}
    
    # ==================== MÉTODOS MEJORADOS PARA COHERENCIA ====================
    
    async def store_enhanced_scene_memory(
        self,
        session_id: str,
        state: State,
        narrative_text: str,
        user_input: Optional[str] = None,
        entities_referenced: Optional[List[str]] = None,
        coherence_notes: Optional[str] = None
    ):
        """Store enhanced scene memory with detailed entity tracking and coherence notes"""
        try:
            # Create enhanced memory document with entity tracking
            entities_str = ', '.join(entities_referenced) if entities_referenced else 'Ninguna'
            
            memory_text = f"""
            ESCENA: {state.scene.title}
            UBICACIÓN: {state.scene.location or 'Desconocida'}
            TURNO: {state.story_position.turn}
            CAPÍTULO: {state.story_position.chapter}
            
            NARRATIVA: {narrative_text}
            
            ENTRADA DEL JUGADOR: {user_input or 'N/A'}
            
            ENTIDADES REFERENCIADAS: {entities_str}
            NOTAS DE COHERENCIA: {coherence_notes or 'N/A'}
            
            CONTEXTO COMPLETO:
            - Personajes: {', '.join([f"{c.name} ({c.role})" for c in state.characters])}
            - Inventario: {', '.join([f"{i.name} x{i.qty or 1}" for i in state.inventory])}
            - Criaturas: {', '.join([f"{m.name} (Amenaza {m.threat_level})" for m in state.monsters])}
            - Banderas: {', '.join([f"{k}={v}" for k, v in state.flags.items() if v])}
            - Salud del personaje: {next((c.health for c in state.characters if c.role == 'player'), 100)}/100
            
            ESTADO NARRATIVO:
            - Ambiente: {state.scene.mood or 'neutral'}
            - Dificultad: {state.game.difficulty}
            - Juego terminado: {state.game.is_game_over}
            """
            
            # Generate embedding and store
            embedding = await self._generate_embedding(memory_text)
            
            memory_id = f"{session_id}_{state.story_position.chapter}_{state.story_position.turn}_enhanced"
            
            # Enhanced metadata with entity tracking
            metadata = {
                "session_id": session_id,
                "chapter": state.story_position.chapter,
                "turn": state.story_position.turn,
                "scene_title": state.scene.title,
                "location": state.scene.location or "",
                "timestamp": datetime.now().isoformat(),
                "type": "enhanced_scene",
                "entities_count": len(entities_referenced) if entities_referenced else 0,
                "has_coherence_notes": bool(coherence_notes),
                "character_count": len([c for c in state.characters if c.role != 'player']),
                "inventory_count": len(state.inventory),
                "monster_count": len(state.monsters),
                "player_health": next((c.health for c in state.characters if c.role == 'player'), 100)
            }
            
            # Add referenced entities as searchable metadata
            if entities_referenced:
                for i, entity in enumerate(entities_referenced[:5]):  # Limit to 5 entities
                    metadata[f"entity_{i}"] = entity.lower()
            
            self.collections["scene_memories"].upsert(
                ids=[memory_id],
                embeddings=[embedding],
                documents=[memory_text],
                metadatas=[metadata]
            )
            
            logger.debug(f"Stored enhanced scene memory for turn {state.story_position.turn} with {len(entities_referenced or [])} entities")
            
            # Also store individual entity memories if entities were referenced
            if entities_referenced:
                await self._store_entity_references(session_id, state, entities_referenced, narrative_text)
            
        except Exception as e:
            logger.error(f"Error storing enhanced scene memory: {e}")
            # Fallback to standard scene memory
            await self.store_scene_memory(session_id, state, narrative_text, user_input)
    
    async def _store_entity_references(
        self,
        session_id: str,
        state: State,
        entities_referenced: List[str],
        narrative_context: str
    ):
        """Store individual entity reference memories for better retrieval"""
        try:
            for entity in entities_referenced:
                entity_memory_text = f"""
                ENTIDAD REFERENCIADA: {entity}
                CONTEXTO: Turno {state.story_position.turn} en {state.scene.title}
                NARRATIVA: {narrative_context[:300]}...
                TIPO_REFERENCIA: Mencionada en narrativa
                UBICACIÓN: {state.scene.title}
                """
                
                embedding = await self._generate_embedding(entity_memory_text)
                memory_id = f"{session_id}_entity_{entity}_{state.story_position.turn}"
                
                # Try to determine entity type
                entity_type = "unknown"
                if any(c.name.lower() == entity.lower() for c in state.characters):
                    entity_type = "character"
                elif any(i.name.lower() == entity.lower() for i in state.inventory):
                    entity_type = "item"
                elif any(m.name.lower() == entity.lower() for m in state.monsters):
                    entity_type = "monster"
                
                self.collections["character_memories"].upsert(
                    ids=[memory_id],
                    embeddings=[embedding],
                    documents=[entity_memory_text],
                    metadatas=[{
                        "session_id": session_id,
                        "entity_name": entity,
                        "entity_type": entity_type,
                        "chapter": state.story_position.chapter,
                        "turn": state.story_position.turn,
                        "timestamp": datetime.now().isoformat(),
                        "type": "entity_reference"
                    }]
                )
                
        except Exception as e:
            logger.error(f"Error storing entity references: {e}")
    
    async def search_entity_memories(
        self,
        session_id: str,
        entity_name: str,
        entity_type: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Search for memories related to a specific entity"""
        try:
            # Build query for entity
            query = f"entidad {entity_name}"
            if entity_type:
                query += f" {entity_type}"
            
            # Search in character memories (where entity references are stored)
            query_embedding = await self._generate_embedding(query)
            
            where_clause = {"session_id": session_id}
            if entity_type:
                where_clause["entity_type"] = entity_type
            
            results = self.collections["character_memories"].query(
                query_embeddings=[query_embedding],
                n_results=limit,
                where=where_clause
            )
            
            # Format results
            memories = []
            for i, doc in enumerate(results.get("documents", [[]])[0]):
                if doc:
                    metadata = results.get("metadatas", [[]])[0][i] if i < len(results.get("metadatas", [[]])[0]) else {}
                    distance = results.get("distances", [[]])[0][i] if i < len(results.get("distances", [[]])[0]) else 1.0
                    
                    memories.append({
                        "content": doc,
                        "metadata": metadata,
                        "similarity": 1.0 - distance,
                        "type": "entity_memory"
                    })
            
            # Sort by similarity
            memories.sort(key=lambda x: x["similarity"], reverse=True)
            return memories
            
        except Exception as e:
            logger.error(f"Error searching entity memories for {entity_name}: {e}")
            return []
    
    async def get_entity_persistence_data(
        self,
        session_id: str,
        entity_names: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        """Get persistent data for entities to maintain coherence"""
        try:
            entity_data = {}
            
            for entity_name in entity_names:
                # Search for entity memories
                memories = await self.search_entity_memories(
                    session_id=session_id,
                    entity_name=entity_name,
                    limit=10
                )
                
                if memories:
                    # Extract persistent information
                    entity_info = {
                        "name": entity_name,
                        "total_references": len(memories),
                        "first_appearance": None,
                        "last_appearance": None,
                        "characteristics": [],
                        "interactions": [],
                        "type": "unknown"
                    }
                    
                    # Analyze memories to extract persistent data
                    for memory in memories:
                        metadata = memory.get("metadata", {})
                        content = memory.get("content", "")
                        
                        # Track appearances
                        turn = metadata.get("turn", 0)
                        if entity_info["first_appearance"] is None or turn < entity_info["first_appearance"]:
                            entity_info["first_appearance"] = turn
                        if entity_info["last_appearance"] is None or turn > entity_info["last_appearance"]:
                            entity_info["last_appearance"] = turn
                        
                        # Extract entity type
                        if metadata.get("entity_type") != "unknown":
                            entity_info["type"] = metadata.get("entity_type")
                        
                        # Extract characteristics from content
                        if "NARRATIVA:" in content:
                            narrative_part = content.split("NARRATIVA:")[1].split("TIPO_REFERENCIA:")[0].strip()
                            if len(narrative_part) > 20:  # Only meaningful descriptions
                                entity_info["interactions"].append({
                                    "turn": turn,
                                    "description": narrative_part[:200] + "..." if len(narrative_part) > 200 else narrative_part
                                })
                    
                    entity_data[entity_name] = entity_info
            
            return entity_data
            
        except Exception as e:
            logger.error(f"Error getting entity persistence data: {e}")
            return {}