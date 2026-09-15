# Memoria Vectorial en Aventra

## 🧠 Implementación de ChromaDB

La memoria vectorial permite que Aventra recuerde y recupere información contextual usando similitud semántica, creando experiencias narrativas más coherentes y consistentes.

## 🏗️ Arquitectura

### Componentes Principales

1. **MemoryService** (`app/services/memory_service.py`)
   - Gestión de embeddings con ChromaDB
   - Búsqueda semántica por similitud
   - Persistencia en `./data/chroma/`

2. **AIService** (actualizado)
   - Integración de búsqueda vectorial en generación narrativa
   - Contexto enriquecido con memorias relevantes
   - Almacenamiento automático de escenas y personajes

3. **API Endpoints** (`app/routes/memory.py`)
   - `/api/memory/search` - Búsqueda semántica
   - `/api/memory/recent/{session_id}` - Memorias recientes
   - `/api/memory/stats/{session_id}` - Estadísticas
   - `/api/memory/cleanup/{session_id}` - Limpieza

## 📊 Tipos de Memorias

### 1. **Scene Memories** (scene_memories)
Almacena información completa de cada turno:
- Narrativa generada
- Entrada del jugador
- Estado de la escena
- Contexto de personajes e inventario

### 2. **Character Memories** (character_memories)
Guarda interacciones específicas con personajes:
- NPCs mencionados en narrativas
- Contexto de interacciones
- Desarrollo de relaciones

### 3. **Event Memories** (event_memories)
Para eventos importantes del juego:
- Decisiones críticas
- Cambios significativos de estado
- Momentos narrativos clave

### 4. **Chapter Summaries** (chapter_summaries)
Resúmenes periódicos:
- Generación automática cada 15 turnos
- Compilación de eventos clave
- Memoria a largo plazo

## 🔍 Funcionamiento

### Búsqueda Semántica
```python
# El AI Service busca memorias relevantes automáticamente
relevant_memories = await memory_service.search_relevant_memories(
    session_id=session_id,
    query=f"{user_input} {scene_title} {location}",
    memory_types=["scene_memories", "character_memories"],
    limit=5
)
```

### Contexto Enriquecido
Las memorias se integran en el prompt del LLM:
```
MEMORIAS RELEVANTES:
• [0.85] Turno 12: El mercader Aldric mencionó una reliquia perdida...
• [0.78] Turno 8: Encontraste una llave extraña en la torre...
• [0.72] Turno 15: La herida en tu brazo aún te molesta...
```

### Almacenamiento Automático
- **Cada turno**: Se guarda la escena completa
- **Personajes**: Se detectan automáticamente interacciones
- **Capítulos**: Resúmenes cada 15 turnos
- **Eventos**: Cuando el estado cambia significativamente

## ⚙️ Configuración

### Variables de Entorno
```env
# ChromaDB
CHROMA_DB_PATH=./data/chroma
CHROMA_ANONYMIZED_TELEMETRY=false

# Memoria
MAX_MEMORY_CONTEXT_LENGTH=2000
CHAPTER_SUMMARY_FREQUENCY=15
RELEVANT_MEMORY_THRESHOLD=0.7
MAX_RELEVANT_MEMORIES=5
```

### Dependencias Adicionales
- `chromadb==0.4.18`
- `langchain-community==0.1.0`
- `openai==1.12.0` (para embeddings)
- `tiktoken==0.5.2`

## 🚀 Uso en Desarrollo

### Instalar Dependencias
```bash
pip install -r requirements.txt
```

### Inicializar Base de Datos
```bash
mkdir -p ./data/chroma
```

### Testing
```python
from app.services.memory_service import MemoryService

memory_service = MemoryService()

# Buscar memorias
memories = await memory_service.search_relevant_memories(
    session_id="test",
    query="dragon tower",
    limit=3
)
```

## 📈 Beneficios

### Para la Narrativa
- **Coherencia**: El LLM recuerda eventos pasados automáticamente
- **Continuidad**: Personajes y objetos persisten entre sesiones
- **Profundidad**: Referencias a decisiones anteriores

### Para el Rendimiento
- **Búsqueda eficiente**: O(log n) en lugar de búsqueda lineal
- **Contexto relevante**: Solo memorias similares, no todo el historial
- **Escalabilidad**: ChromaDB maneja millones de embeddings

### Para el Usuario
- **Experiencia inmersiva**: El mundo "recuerda" las acciones del jugador
- **Consistencia narrativa**: Sin contradicciones con eventos pasados
- **Evolución orgánica**: Los personajes reaccionan basado en historia compartida

## 🔧 Mantenimiento

### Limpieza de Memorias
```python
# Automática por sesión
await memory_service.cleanup_session(session_id)

# Manual por colección
collection.delete(ids=["memory_id_1", "memory_id_2"])
```

### Monitoreo
```python
# Estadísticas de uso
stats = memory_service.get_memory_stats(session_id)
print(f"Total memorias: {stats['total_memories']}")
```

### Optimización
- Las memorias con similitud < 0.7 se filtran automáticamente
- Los resúmenes de capítulo reducen la carga de memoria
- La persistencia permite recuperación tras reinicios

## 🎯 Próximos Pasos

1. **Embeddings personalizados**: Modelos fine-tuned para fantasía/aventura
2. **Memoria híbrida**: Combinación de vectorial + conocimiento estructurado  
3. **Análisis emocional**: Tracking de sentiment para relaciones
4. **Migración a Qdrant**: Para mayor escalabilidad en producción