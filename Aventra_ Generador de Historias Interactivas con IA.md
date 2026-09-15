## Aventra — Especificación (Generador de Historias Interactivas)

Documento fuente para que una IA actúe como narrador y orquestador de Aventra: un juego narrativo interactivo con memoria persistente, salidas estructuradas y generación opcional de imágenes.

### Tabla de contenidos

- [Arquitectura del sistema](#arquitectura-del-sistema)
- [Propósito y visión](#propósito-y-visión)
- [Stack tecnológico híbrido](#stack-tecnológico-híbrido)
- [Integración AI SDK de Vercel](#integración-ai-sdk-de-vercel)
- [Roles, tono y criterios de éxito](#roles-tono-y-criterios-de-éxito)
- [Reglas globales para la IA (instrucciones operativas)](#reglas-globales-para-la-ia-instrucciones-operativas)
- [Realismo, riesgo y finales (muerte/derrota)](#realismo-riesgo-y-finales-muertederrota)
- [Creación de personaje y mundo (setup)](#creación-de-personaje-y-mundo-setup)
- [Flujo de juego paso a paso](#flujo-de-juego-paso-a-paso)
- [Contratos de API (backend FastAPI)](#contratos-de-api-backend-fastapi)
- [Esquema de estado del juego (JSON)](#esquema-de-estado-del-juego-json)
- [Salida del LLM (texto) y tool-calls de estado/imagen](#salida-del-llm-texto-y-tool-calls-de-estadoimagen)
- [Memoria y orquestación con LangChain](#memoria-y-orquestación-con-langchain)
- [Generación y transporte de imágenes (Base64)](#generación-y-transporte-de-imágenes-base64)
- [Frontend híbrido (Next.js + AI SDK + Tailwind)](#frontend-híbrido-nextjs--ai-sdk--tailwind)
- [Consultas de estado sin IA (hojas, inventario, bestiario)](#consultas-de-estado-sin-ia-hojas-inventario-bestiario)
- [Modo desarrollo (debug) y trazas](#modo-desarrollo-debug-y-trazas)
- [Plan MVP (tareas mínimas)](#plan-mvp-tareas-mínimas)
- [Casos borde y manejo de errores](#casos-borde-y-manejo-de-errores)
- [Métricas de calidad de salida](#métricas-de-calidad-de-salida)
- [Referencias](#referencias)

---

## Arquitectura del sistema

Aventra utiliza una **arquitectura híbrida** que combina lo mejor de dos enfoques:

### Backend especializado (FastAPI + LangChain)
- **Responsabilidad**: Lógica de negocio, memoria persistente, orquestación de IA
- **Fortalezas**: Control total sobre memoria vectorial, tool calling avanzado, debugging profundo
- **Tecnologías**: Python, FastAPI, LangChain, ChromaDB

### Frontend optimizado (Next.js + AI SDK)
- **Responsabilidad**: Interfaz de usuario, comunicación optimizada, experiencia de streaming
- **Fortalezas**: UX mejorada, manejo robusto de errores, desarrollo más rápido
- **Tecnologías**: Next.js, React, TypeScript, AI SDK de Vercel, TailwindCSS

### Principio de integración
> **"Evolución, no revolución"**: Mantener toda la funcionalidad existente mientras se mejora la experiencia de usuario y desarrollo através del AI SDK como capa de comunicación.

---

## Creación de personaje y mundo (setup)

Antes del primer turno:

1. El usuario define el personaje (nombre, raza, rasgos, trasfondo breve).
2. El usuario define el mundo (género/ambientación, tono, reglas clave, restricción de tecnología/magia, facciones iniciales, nivel de letalidad deseado).
3. Con ambos insumos, el backend inicializa State coherente y el LLM genera la escena inicial.

Directrices para la IA en setup:

- Respetar literalmente nombre/raza y rasgos canónicos del jugador.
- Adaptar la letalidad a difficulty (story/balanced/hard) sin eliminar la posibilidad de derrota.
- Sembrar ganchos narrativos compatibles con el mundo y el trasfondo del personaje.

---

## Propósito y visión

Aventra es una aplicación web para crear historias interactivas generadas por IA, con un mundo coherente a lo largo del tiempo. El usuario decide acciones; la IA responde con narrativa consistente, actualiza un estado global y sugiere (o dispara) imágenes ilustrativas. La coherencia se logra con memoria conversacional resumida y salidas estructuradas en JSON.

Objetivos clave:

- Usuario protagonista, con decisiones que ramifican la historia.
- Coherencia persistente: personajes, inventario, monstruos y sucesos se recuerdan entre turnos y sesiones.
- Multimodal: texto + imágenes generadas bajo demanda, transportadas en Base64.
- UX clara en web (Next.js + React + Tailwind).

---

## Stack tecnológico híbrido

### Frontend (Experiencia de usuario optimizada)
- **Framework**: Next.js 15 con App Router + React 19
- **Estilos**: TailwindCSS v4 (Estética 16-bit gaming)
- **Comunicación IA**: AI SDK de Vercel (@ai-sdk/react, @ai-sdk/openai)
- **TypeScript**: Para type safety total
- **Streaming**: Renderizado progresivo de narrativa

### Backend (Lógica de negocio especializada)
- **Framework**: Python + FastAPI
- **Orquestación**: LangChain (memoria, chains, salidas estructuradas)
- **LLM narrativo**: GPT-4.1 mini (texto creativo, baja latencia y costo)
- **Imagen**: Gemini 2.5 Flash Image (generación/edición)
- **Memoria persistente**: ChromaDB (local) → Qdrant (escala)
- **Estado del juego**: JSON Patch + validación con Pydantic

### Comunicación entre capas
- **Protocolo**: HTTP/JSON con streaming support
- **Endpoints**: FastAPI mantiene contratos actuales
- **Streaming**: AI SDK maneja la comunicación bidireccional
- **Estado**: Sincronización automática entre frontend y backend

---

## Integración AI SDK de Vercel

### Motivación de la integración
El AI SDK de Vercel se integra como **capa de comunicación** sin reemplazar la lógica de negocio existente, proporcionando:

#### ✅ Ventajas para el desarrollo
- **Hooks especializados**: `useChat()`, `useCompletion()` para manejo de estado
- **Streaming nativo**: Renderizado progresivo sin implementación custom
- **Error handling**: Reconexión automática y estados de error consistentes
- **TypeScript**: Tipado fuerte para comunicación con IA
- **Flexibilidad**: Compatible con múltiples proveedores de IA

#### ✅ Ventajas para la experiencia de usuario
- **Responsividad**: UI actualizada en tiempo real durante generación
- **Estados visuales**: Loading, error, retry states automáticos
- **Robustez**: Manejo de desconexiones y timeouts
- **Optimización**: Menos re-renders y mejor performance

### Arquitectura de integración

```typescript
// Frontend: AI SDK como interface
const { messages, append, isLoading } = useChat({
  api: '/api/generate-story', // Endpoint FastAPI actual
  body: { 
    state: gameState,        // Estado del juego
    session_id: sessionId,   // Sesión persistente
    debug: debugConfig       // Configuración de debug
  }
});

// Backend: FastAPI + LangChain mantienen lógica
@app.post("/api/generate-story")
async def generate_story(request: GenerateStoryRequest):
    # Lógica existente de LangChain
    result = await story_chain.invoke(request)
    
    # Compatible con streaming del AI SDK
    return StreamingResponse(
        result.stream(), 
        media_type="text/plain"
    )
```

### Principios de implementación
1. **Backend intacto**: FastAPI + LangChain mantienen toda la lógica existente
2. **Frontend mejorado**: AI SDK reemplaza solo la comunicación HTTP custom
3. **Compatibilidad**: Endpoints actuales funcionan con AI SDK sin modificaciones
4. **Gradualidad**: Migración incremental, feature por feature
5. **Flexibilidad**: Posibilidad de usar ambas aproximaciones simultáneamente

---

## Roles, tono y criterios de éxito

Rol de la IA (narrador-orquestador):

- Continúa la historia en cada turno en base al estado y la entrada del usuario.
- Actualiza un objeto de estado común (JSON) con personajes, inventario, monstruos, escena y banderas.
- Sugiere acciones y, cuando corresponda, solicita generación de imagen con una descripción precisa.

Tono narrativo:

- Aventurero, descriptivo, conciso y orientado a decisiones; evita párrafos excesivamente largos.

Criterios de éxito por turno:

- La salida cumple el Formato de salida del LLM (JSON válido, sin texto extra).
- Narrativa consistente con el estado y el resumen de memoria.
- Acciones sugeridas claras y ejecutables.
- Actualizaciones de estado mínimas pero suficientes (no reescribir todo si no cambia).

---

## Reglas globales para la IA (instrucciones operativas)

1. Salida visible para el jugador: SIEMPRE texto (narración clara). Nada de JSON en la UI.
2. Actualizaciones de estado e imágenes: realizar mediante tool-calls internos del backend (no visibles). El LLM describe lo que ocurre; el backend aplica los cambios.
3. Mantén consistencia: respeta rasgos de personajes, inventario, heridas y banderas.
4. Equilibrio de ritmo: avanza la trama sin resolver todo de inmediato; cuando haya una decisión discreta (A/B/…​), ofrece 2–4 opciones. En el flujo normal, prioriza input libre del usuario.
5. Imágenes: solo solicita una imagen cuando la escena lo amerite (evento, lugar o personaje importante). No más de 1 cada 2–3 turnos salvo eventos especiales.
6. Seguridad y contenido: evita violencia gráfica y contenido sensible; mantén el juego apto para todo público.
7. Idioma: español neutral.

Presentación al jugador: la UI solo muestra texto (narration) y controles; el backend maneja JSON internamente.

---

## Realismo, riesgo y finales (muerte/derrota)

- La historia no garantiza resultados positivos. Si una acción tiene alta probabilidad de fracaso bajo las reglas del mundo, la IA puede resolver en derrota o muerte del personaje.
- No “matar” por detalles triviales. Reservar muerte/derrota para riesgos altos, acumulación de malas decisiones o situaciones extremas coherentes con el estado.
- Señalización de riesgo: cada acción sugerida incluye un campo risk (bajo/medio/alto) y una pista de posibles fallos (effect_hint).
- Finales: si corresponde, cerrar la sesión marcando game.is_game_over = true y rellenar game.ending (tipo, causa y resumen). Permitir finales como derrota, bittersweet o retiro. La victoria NO cierra la historia por sí misma.
- Persistir coherencia: heridas y consecuencias se acumulan, afectando futuras probabilidades de éxito.

Probabilidades y resolución:

- El campo risk guía la narrativa, no es determinista. Riesgo "alto" implica probabilidad elevada de fallo, no garantía.
- La IA puede simular probabilidades internamente (sin exponer números) para decidir resultados verosímiles.
- La victoria no es el único final: permitir "retire" (retiro voluntario) cuando el jugador lo indique explícitamente.

Ejemplo de acción con riesgo:

- actions[i].risk = "alto"
- actions[i].may_end_game = true

---

## Flujo de juego paso a paso

### Flujo con AI SDK integrado

0. **Setup inicial**: Crear personaje y mundo; inicializar State con FastAPI.

1. **Input del usuario**: 
   - Frontend usa `useChat()` para capturar input
   - AI SDK maneja estado de UI automáticamente

2. **Procesamiento backend**:
   - FastAPI recibe request via streaming endpoint
   - LangChain agrega memoria relevante y estado actual
   - IA genera salida estructurada: narrativa + state patches + imágenes

3. **Streaming de respuesta**:
   - Backend inicia streaming de narrativa
   - AI SDK actualiza UI progresivamente
   - Tool calls (estado/imágenes) se procesan en paralelo

4. **Actualización de estado**:
   - Backend aplica JSON patches al estado del juego
   - Frontend sincroniza estado local automáticamente

5. **Rendering final**:
   - Narrativa completa renderizada
   - Imágenes insertadas (si las hay)
   - Acciones disponibles mostradas
   - Estado del juego actualizado

### Ventajas del flujo híbrido
- **Streaming progresivo**: Usuario ve texto mientras se genera
- **Estados automáticos**: Loading, error, success sin código custom
- **Paralelización**: Estado e imágenes se procesan simultáneamente
- **Robustez**: Reconexión automática en caso de errores

---

## Contratos de API (backend FastAPI)

- POST /api/setup-session

  - input: {
    player: { name: string, race?: string, class?: string, traits?: string[], backstory?: string },
    world: { name?: string, genre?: string, description?: string, rules?: string[], tone?: string, lethality?: 'story'|'balanced'|'hard' },
    difficulty?: 'story'|'balanced'|'hard',
    debug?: { enabled?: boolean, level?: 'basic'|'verbose'|'trace', include?: { prompts?: boolean, state_patches?: boolean, memory_ops?: boolean, risk_resolution?: boolean, timing?: boolean } }
    }
  - output: { state: State, intro: LLMOutput, debug?: DevTrace }

- POST /api/generate-story

  - input: { user_input: string, state: State, session_id?: string, rng?: { seed?: number, temperature?: number, top_p?: number }, debug?: { enabled?: boolean, level?: 'basic'|'verbose'|'trace', include?: { prompts?: boolean, state_patches?: boolean, memory_ops?: boolean, risk_resolution?: boolean, timing?: boolean } } }
  - output: { text: string, actions?: Action[], debug?: DevTrace } // text es lo visible; el backend aplica patches internamente

- POST /api/update-state

  - input: { state: State, patch: JSONPatchOp[] }
  - output: { state: State }

- POST /api/generate-image
  - input: { description: string, style?: string, seed?: number, aspect_ratio?: string }
  - output: { image_base64: string, mime_type: string, width: number, height: number, debug?: DevTrace }

Nota: El backend puede combinar generate-story y update-state, pero se listan separados para claridad.

---

## Esquema de estado del juego (JSON)

State

- scene: { id: string, title: string, location?: string, mood?: string }
- world?: { name?: string, genre?: string, description?: string, rules?: string[], tone?: string }
- characters: Character[]
- inventory: Item[]
- monsters: Monster[]
- quests?: Quest[]
- journal?: JournalEntry[]
- flags: { [key: string]: boolean | number | string }
- story_position: { chapter: number, turn: number }
- memory_summary: string // resumen breve acumulado
- game: { is_game_over: boolean, ending?: Ending, difficulty?: 'story'|'balanced'|'hard' }
- schema_version?: string

Character

- id: string
- name: string
- role: 'player' | 'ally' | 'npc' | 'enemy'
- race?: string
- class?: string
- traits?: string[]
- health?: number // 0–100
- notes?: string
- conditions?: Condition[] // heridas/estados (p. ej. tobillo torcido)
- alive?: boolean
- knowledge?: { known?: boolean, revealed_fields?: string[] }

Item

- id: string
- name: string
- qty?: number
- description?: string
- knowledge?: { known?: boolean, revealed_fields?: string[] }

Monster

- id: string
- name: string
- threat_level: 1|2|3|4|5
- health?: number
- notes?: string
- knowledge?: { known: boolean, revealed_fields?: string[] } // control de lo que el jugador conoce
- conditions?: Condition[]

NPC persistente (criterios y estructura)

- Criterios para persistir un NPC (crear/guardar JSON):
  - Da misiones (quest_giver) o es fuente de progreso (p. ej. llave de una zona, información crítica).
  - Comerciante relevante (weaponsmith, apothecary, etc.) con inventario estable o reputación.
  - Relación significativa con el jugador (aliado/mentor/rival) que puede re-aparecer.
  - Apariciones repetidas o impacto directo en banderas/flags de la trama.
- No persistir NPC secundarios/efímeros (figurantes), salvo que cambie su estatus por eventos.

Campos sugeridos en Character para NPCs persistentes:

- role: 'npc'
- tags?: string[] // p. ej. ['quest_giver','merchant:weapons']
- shop?: { currency?: string, stock: Item[], restock_policy?: string }
- quests_offered?: { id: string, title: string, status: 'offered'|'accepted'|'completed'|'failed' }[]
- reputation?: { with_player: number } // -100..+100

Quest

- id: string
- title: string
- giver_id?: string // NPC
- status: 'offered' | 'accepted' | 'completed' | 'failed'
- objectives?: { id: string, text: string, done: boolean }[]
- rewards?: { xp?: number, items?: Item[], flags?: Record<string, any> }
- notes?: string

JournalEntry

- id: string
- turn: number
- text: string
- tags?: string[]

Condition

- id: string
- type: 'wound' | 'status' | 'ailment' | 'buff' | 'debuff'
- name: string
- severity?: 'minor' | 'moderate' | 'severe' | 'critical'
- since_turn?: number
- notes?: string
- mechanical_effects?: string // texto libre (p. ej. -10 a sigilo)

Ending

- type: 'death' | 'defeat' | 'retire' | 'bittersweet'
- summary: string
- cause?: string

---

## Salida del LLM (texto) y tool-calls de estado/imagen

Salida visible del LLM:

- narration: texto en 2–5 párrafos cortos (Markdown simple permitido). No exponer JSON.
- actions (opcional): 2–4 opciones SÓLO cuando exista una decisión discreta (A/B/…​) que lo amerite.
- Señalización de riesgo (cuando haya acciones): risk: 'bajo'|'medio'|'alto' y may_end_game?: boolean.

Actualizaciones internas (no visibles):

- El backend aplica cambios de estado mediante JSON Patch o un conjunto de operaciones.
- El LLM puede emitir una tool-call implícita (o el backend puede derivarla) con las operaciones necesarias.

Semántica de patch

- Estándar recomendado: JSON Patch (RFC 6902): ops: [{ op: 'add'|'remove'|'replace', path: string, value?: any }].
- Alternativa: ops extendidas: 'merge'|'upsert' para colecciones con id.
- Resolución de listas: upsert por id para characters, monsters e inventory.

Contrato de tool-call (conceptual)

- state.apply_patch(input: { ops: JSONPatchOp[], rng?: RNG, ids?: IDHints }) -> { state }
- image.generate(input: { description: string, style?: string, seed?: number, aspect_ratio?: string }) -> { image_base64, mime_type }

RNG y reproducibilidad

- RNG: { seed?: number, temperature?: number, top_p?: number } en los inputs de generación.
- DevTrace registra seed efectivo y outcome para auditoría.

IDs canónicos

- El backend asigna IDs; el LLM puede sugerir slugs/nombres. Si el LLM propone id, el backend mapea a un id canónico.

Ejemplo (salida visible al usuario — narración):

"El viento arrastra el olor a lluvia cuando llegas al umbral de la Torre de Onyx. La puerta, alta y negra, vibra con un murmullo arcano..."

---

## Memoria y orquestación con LangChain

- Memoria: ConversationSummaryBufferMemory para mantener un resumen continuo del chat, con resúmenes de capítulos recientes (5–10 turnos) y conservación de la información relevante de los últimos turnos, para reflejar con detalle lo que sucede en el momento actual de la historia.
- Chains: un LLMChain produce narrativa y state_patch con salidas estructuradas (with_structured_output).
- Resumen adicional periódico: generar un resumen de trama cada N turnos y guardarlo en state.memory_summary.
- Vector store (opcional):
  - Desarrollo local: Chroma para indexar resúmenes/escenas y facilitar recuperación.
  - Escala: Qdrant para búsquedas híbridas y filtrado avanzado.

Buenas prácticas:

- Mantener el resumen < 500–800 palabras; enfatizar hechos canónicos (nombres, heridas, objetos únicos, promesas, deudas, enemigos).
- Expirar detalles triviales con el tiempo para no saturar tokens.

---

## Generación y transporte de imágenes (Base64)

- El LLM solicita imágenes mediante image_request únicamente cuando aporten valor visual.
- El backend invoca Gemini 2.5 Flash Image con la description y style propuestos.
- La imagen se devuelve como image_base64 (p. ej. "data:image/png;base64,..." o sin prefijo, con mime_type por separado).
- Trade-off Base64: fácil de integrar en UI, pero mayor tamaño y cache limitado; generar solo cuando sea oportuno.

---

## Frontend híbrido (Next.js + AI SDK + Tailwind)

### Arquitectura del frontend

#### Integración AI SDK
```typescript
// Hook principal para comunicación con IA
const { messages, append, isLoading, error } = useChat({
  api: '/api/generate-story',
  initialMessages: [],
  body: {
    state: gameState,
    session_id: sessionId,
    debug: debugEnabled ? debugConfig : undefined
  },
  onFinish: (message) => {
    // Sincronizar estado del juego después de cada respuesta
    syncGameState(message.toolInvocations);
  },
  onError: (error) => {
    // Manejo de errores centralizado
    handleAIError(error);
  }
});
```

#### Componentes principales
- **GameChat**: Renderizado de narrativa con streaming progresivo
- **ActionButtons**: Interfaz para seleccionar acciones disponibles
- **GameState**: Visualización del estado del juego (inventario, personajes, etc.)
- **ImageDisplay**: Renderizado de imágenes Base64 con lazy loading
- **DebugPanel**: Panel de desarrollo con trazas y métricas

### Características específicas

#### Renderizado de contenido
- **Narrativa**: Markdown ligero con streaming progresivo
- **Acciones**: Botones dinámicos que se actualizan según el estado
- **Estado del juego**: Pestañas para inventario, personajes, bestiario
- **Imágenes**: Base64 insertadas con optimización de carga
- **Estética**: Gaming 16-bit con sprites y paleta de colores retro

#### Manejo de estado
```typescript
// Estado local sincronizado con backend
const [gameState, setGameState] = useState<GameState>();

// Sincronización automática después de cada turno
const syncGameState = useCallback((toolInvocations: ToolInvocation[]) => {
  const stateUpdates = toolInvocations?.find(t => t.toolName === 'updateGameState');
  if (stateUpdates) {
    setGameState(stateUpdates.result);
  }
}, []);
```

#### Experiencia de usuario optimizada
- **Loading states**: Indicadores visuales durante generación
- **Error recovery**: Botones de reintento automáticos
- **Offline support**: Cache local de estado para continuidad
- **Responsive design**: Adaptable a mobile y desktop
- **Accessibility**: ARIA labels y navegación por teclado

### Ventajas de la integración
1. **Menos boilerplate**: AI SDK maneja comunicación y estado de conexión
2. **Streaming nativo**: Narrativa aparece progresivamente
3. **Error handling robusto**: Reconexión y retry automáticos
4. **TypeScript**: Tipado fuerte para messages y tool calls
5. **Performance**: Optimizaciones automáticas de re-renders

---

## Consultas de estado sin IA (hojas, inventario, bestiario)

Objetivo: permitir al jugador consultar el estado sin invocar al LLM (sin costo ni efectos narrativos).

Principio de redacción (player view):

- El backend mantiene State completo, pero expone una “vista para jugador” con redacción de información desconocida.
- Campos no conocidos (p. ej. estadísticas de un monstruo no identificado) se muestran como "?" o se omiten.

Endpoints sugeridos (solo lectura):

- GET /api/state/player-view -> PlayerViewState
- GET /api/state/player-view/character -> ficha del personaje jugador
- GET /api/state/player-view/inventory -> inventario actual
- GET /api/state/player-view/monster/{id} -> datos del monstruo con knowledge aplicado

PlayerViewState (derivado de State):

- Igual a State, pero con knowledge.revealed_fields aplicado y redacción de secretos.

UI sugerida:

- Botones/abas: “Hoja”, “Inventario”, “Mapa/Escena”, “Bestiario”. Monstruos desconocidos muestran nombre genérico (p. ej. “Criatura desconocida”) y stats ocultas con "?".

Notas:

- Estas consultas no cambian el estado ni consumen memoria de LangChain.
- El backend puede cachear PlayerViewState por turno.

---

## Modo desarrollo (debug) y trazas

Objetivo: habilitar un toggle para visualizar qué sucede “detrás de escena” durante la generación: prompts, patches de estado, decisiones de memoria, resoluciones de riesgo/probabilidades y tiempos.

Toggles sugeridos:

- debug.enabled (global por sesión)
- debug.level: 'basic' | 'verbose' | 'trace'
- debug.include: { prompts: boolean, state_patches: boolean, memory_ops: boolean, risk_resolution: boolean, timing: boolean }

Contrato DevTrace (estructura de trazas):

- step_id: string // correlación por turno
- inputs: { user_input?: string, state_digest: string } // hash/digest de state
- prompt: { system?: string, user?: string, tools?: string[] } // si include.prompts
- llm_output_raw?: string // texto bruto del modelo (antes de parsear)
- parsed: { narration_excerpt: string, state_patch_keys: string[], actions_count?: number }
- state_patch?: Partial<State>
- memory_ops?: { summaries_updated?: boolean, tokens_before?: number, tokens_after?: number }
- risk_resolution?: { action_id?: string, risk?: 'bajo'|'medio'|'alto', outcome: 'success'|'fail'|'mixed' }
- timing?: { total_ms: number, llm_ms?: number, image_ms?: number }
- warnings?: string[] // p. ej., “JSON inválido corregido por parser”

Exposición de trazas:

- Backend: si debug.enabled, devolver DevTrace junto a LLMOutput en los endpoints que generen historia/imagen.
- Frontend: panel lateral/modal “Debug” con pestañas: Trace, Prompt, Memoria, Patches, Tiempos.
- Persistencia opcional: imprimir en consola cuando debug.level >= basic, y enviar a un endpoint /api/dev-trace para almacenamiento temporal.

Privacidad/seguridad:

- No exponer claves ni datos sensibles en prompts o trazas.
- Desactivar completamente en producción; el toggle desaparece en builds productivos.

Ejemplo de respuesta con debug (solo para desarrollo):

- output: { data: LLMOutput, debug?: DevTrace }

UI sugerida:

- Un botón “Modo debug” que activa el panel. Un badge por turno indica si hubo warnings.

Notas:

- Las trazas no alteran el estado del juego. Son solo lectura.

---

## Plan MVP (tareas mínimas)

### Fase 1: Backend foundation (Completado ✅)
1. ✅ Integrar LangChain en FastAPI y validar chain contra GPT-4.1 mini
2. ✅ Definir esquema State y LLMOutput con parser estructurado
3. ✅ Implementar `/api/setup-session` y persistencia de State
4. ✅ Implementar `/api/generate-story` con memoria y JSON estructurado
5. ✅ Implementar `/api/generate-image` con Gemini 2.5 y Base64

### Fase 2: Integración AI SDK (En progreso 🔄)
6. 🔄 **Instalar y configurar AI SDK de Vercel**
   - `npm install @ai-sdk/react @ai-sdk/openai`
   - Configurar providers y tipos TypeScript
   
7. 🔄 **Migrar comunicación frontend**
   - Reemplazar `api.ts` custom con hooks de AI SDK
   - Implementar `useChat()` para `/api/generate-story`
   - Mantener compatibilidad con endpoints FastAPI existentes

8. 🔄 **Optimizar streaming y estado**
   - Configurar streaming de narrativa progresivo
   - Sincronizar estado del juego automáticamente
   - Implementar manejo de errores robusto

### Fase 3: Frontend híbrido (Pendiente 🔲)
9. 🔲 **Componentes optimizados**
   - GameChat con streaming progressivo
   - ActionButtons con estados automáticos
   - GameState con sincronización en tiempo real

10. 🔲 **Endpoints de consulta sin IA**
    - Implementar player-view con redacción por knowledge
    - Pestañas de inventario, personajes, bestiario

### Fase 4: Testing E2E (Pendiente 🔲)
11. 🔲 **Validación completa**
    - 10 turnos de prueba con AI SDK
    - Verificar coherencia, ritmo y streaming
    - Validar manejo de errores y reconexión
    - Métricas de performance y UX

### Criterios de éxito del MVP híbrido
- ✅ **Backend**: Toda funcionalidad LangChain preservada
- 🔄 **Comunicación**: AI SDK mejora UX sin cambiar lógica
- 🔲 **Frontend**: Streaming progresivo y estados automáticos
- 🔲 **Performance**: Latencia < 2s para primer token
- 🔲 **Robustez**: Manejo de errores y reconexión automática

---

## Casos borde y manejo de errores

- Entrada vacía o ambigua: pedir clarificación concisa dentro de narration y proponer acciones.
- Estado inconsistente (p. ej. personaje duplicado): preferir corrección mínima en state_patch con nota breve en narration.
- Exceso de longitud: recortar narration manteniendo información clave; no omitir acciones.
- Contenido sensible: omitir y reconducir la trama a alternativas seguras.
- Fallo al generar imagen: continuar sin imagen; incluir fallback textual breve en narration.
- Muerte/derrota: si ocurre, establecer game.is_game_over = true y rellenar game.ending; ofrecer un epílogo corto en narration.
- Conocimiento desconocido: al consultar monstruos/NPC no identificados, devolver "?" o campos omitidos; actualizar knowledge.revealed_fields cuando haya descubrimiento in‑story.
- Heridas/condiciones: usar Condition con severidad; actualizar/curar en state_patch sin sobrescribir histórico innecesario.
- Conflictos de canónicos: si el LLM intenta contradecir hechos canónicos (nombres, heridas, flags críticos), priorizar el estado y ajustar la narración para justificar o corregir.

---

## Métricas de calidad de salida

- Salida visible: texto claro, sin JSON expuesto.
- Consistencia de estado: sin contradicciones entre turnos.
- Acciones: 2–4 cuando aplique; si no hay decisión discreta, omitir actions.
- Frecuencia de imágenes: ≤ 1 cada 2–3 turnos salvo clímax.
- Longitud de narration: 120–350 palabras/turno (orientativo).
- Riesgo: acciones etiquetadas con riesgo y resultados acordes; altas conllevan derrotas/decesos ocasionales.

---

## Referencias

### Tecnologías principales
- **FastAPI**: https://fastapi.tiangolo.com/
- **LangChain**: https://python.langchain.com/
- **Next.js App Router**: https://nextjs.org/docs/app
- **AI SDK de Vercel**: https://ai-sdk.dev/docs

### Memoria y orquestación
- **Conversational Memory for LLMs with LangChain**: https://www.pinecone.io/learn/series/langchain/langchain-conversational-memory/
- **ConversationSummaryMemory**: https://python.langchain.com/api_reference/langchain/memory/
- **Structured outputs**: https://python.langchain.com/docs/concepts/structured_outputs/
- **Chroma VectorStore**: https://python.langchain.com/docs/integrations/vectorstores/chroma/
- **Qdrant VectorStore**: https://python.langchain.com/docs/integrations/vectorstores/qdrant/

### Modelos de IA
- **GPT-4.1 API**: https://openai.com/index/gpt-4-1/
- **Gemini 2.5 Flash Image**: https://developers.googleblog.com/en/introducing-gemini-2-5-flash-image/

### AI SDK específico
- **Getting Started with Next.js**: https://ai-sdk.dev/docs/getting-started/nextjs-app-router
- **Tools and Tool Calling**: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- **useChat Hook**: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
- **Streaming**: https://ai-sdk.dev/docs/ai-sdk-core/streaming

### Frontend y UX
- **Base64 images in Next.js**: https://mycleverai.com/it-questions/how-can-i-display-a-base64-image-in-nextjs
- **TailwindCSS v4**: https://tailwindcss.com/
- **React 19**: https://react.dev/

### Repositorio del proyecto
- **GitHub**: [Aventra - Generador de Historias Interactivas](repositorio-pendiente)

---

Anexo: DevTrace (tipo)

DevTrace

- step_id: string
- inputs: { user_input?: string, state_digest: string }
- prompt?: { system?: string, user?: string, tools?: string[] }
- llm_output_raw?: string
- parsed?: { narration_excerpt: string, state_patch_keys: string[], actions_count?: number }
- state_patch?: Partial<State>
- memory_ops?: { summaries_updated?: boolean, tokens_before?: number, tokens_after?: number }
- risk_resolution?: { action_id?: string, risk?: 'bajo'|'medio'|'alto', outcome: 'success'|'fail'|'mixed' }
- timing?: { total_ms: number, llm_ms?: number, image_ms?: number }
- warnings?: string[]
