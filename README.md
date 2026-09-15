# Aventra

Rol narrativo con IA que corre entero en el navegador. Creas un héroe y un mundo; un narrador (GPT-4.1 mini) dirige la partida con **dados d20 reales**, un **estado del mundo que cambia con JSON Patch**, **memoria vectorial a largo plazo** e **ilustraciones de escena**.

**Demo:** partidas reales grabadas con el motor, reproducibles sin key y sin llamadas a la API. **Jugar:** con tu propia key de OpenAI; el navegador habla directo con OpenAI y la key nunca pasa por un servidor.

## Cómo funciona un turno

1. **Recordar** — la acción del jugador se embebe (`text-embedding-3-small`, 512 d) y se compara por coseno con los recuerdos guardados fuera de los últimos 3 turnos; los 5 más cercanos (≥ 0.3) vuelven al contexto.
2. **Tirar** — el motor tira un d20 sembrado por partida y turno, y le pasa al narrador el resultado para cada nivel de riesgo (CD por riesgo, dificultad, heridas y salud). El modelo narra el resultado; no lo decide.
3. **Narrar** — `streamObject` (AI SDK, Responses API) con un JSON Schema estricto: la narración llega en streaming y después el delta estructurado (escena, salud, oro, condiciones, objetos, personajes, criaturas, misiones, banderas, hechos, final, acciones, prompt de imagen).
4. **Aplicar** — `reduceTurn` convierte el delta en operaciones RFC 6902 que se aplican una a una. `applyOps(initial, ops…)` reproduce exactamente el estado guardado, y así funcionan las repeticiones.
5. **Memorizar** — escena y hechos canónicos se guardan como embeddings en IndexedDB; cada 6 turnos se resume el capítulo.
6. **Ilustrar** — en momentos clave (máx. 1 cada 3 turnos) `gpt-image-1-mini` pinta la escena, recodificada a WebP.

El panel **Motor** muestra por turno: tirada, tokens, costo, tiempo por etapa y el JSON Patch aplicado. **Memoria** lista los recuerdos recuperados con su similitud.

## Estructura

```
frontend/                  Next.js 15 (app estática, sin backend)
  src/lib/engine/          motor puro: tipos, schema, JSON Patch, dados, reducer, memoria, prompts
  src/lib/game/engine.ts   orquestación del turno (recordar → narrar → aplicar → memorizar → resumir → ilustrar)
  src/lib/ai/openai.ts     llamadas BYOK a OpenAI (Responses, embeddings, imágenes)
  src/lib/store/db.ts      IndexedDB: partidas, recuerdos, ilustraciones; export/import JSON
  src/components/          UI (relato, dados, panel lateral, fin de partida, repetición)
  public/demos/            partidas reales exportadas para la demo
backend/                   versión anterior en FastAPI + LangChain (referencia, no se usa)
```

## Correr localmente

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

No hace falta ningún `.env`: la key se ingresa en la app y queda en `sessionStorage` (o `localStorage` si eliges recordarla).

## Verificación

- Pruebas del motor (reducer, JSON Patch, dados, ranking de memoria, prompts y compatibilidad del schema con el modo estricto).
- E2E en Chrome real con una key real: setup, key inválida rechazada, intro en streaming, 11 turnos con tiradas, recuperación de memoria, resumen de capítulo, ilustraciones, paneles contra el estado guardado, recarga desde IndexedDB, export con re-play exacto del JSON Patch, borrar/importar, layout móvil y consola sin errores. Cada partida de prueba costó ~US$0.05.

## Stack

Next.js 15 · React 19 · TypeScript · AI SDK 5 · OpenAI (GPT-4.1 mini, text-embedding-3-small, gpt-image-1-mini) · Zod 4 · IndexedDB · Tailwind CSS 4
