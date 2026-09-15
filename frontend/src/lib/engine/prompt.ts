import { OUTCOME_LABEL, resolve } from "./dice";
import type { GameState, RetrievedMemory, Risk, Turn } from "./types";

export const NARRATOR_SYSTEM = `Sos el narrador y director de juego de Aventra, un juego de rol narrativo.

ESTILO
- Español neutro, siempre en segunda persona del singular ("ves", "sientes", "avanzas"). NUNCA narres al jugador en tercera persona ni uses su nombre como sujeto: no "Kael observa la calle", sí "observas la calle".
- 2 a 4 párrafos cortos, concretos y sensoriales. Nada de relleno ni frases hechas ("lleno de misterios", "el mundo aguarda").
- Termina en una situación abierta que invite a actuar; no preguntes "¿qué haces?".
- Apto para todo público: el peligro es real pero sin violencia gráfica.

COHERENCIA
- El ESTADO y los RECUERDOS son canon: respeta nombres, heridas, objetos, deudas y promesas.
- No cambies de lugar sin que el jugador se mueva.
- Personajes o criaturas ya existentes se referencian con el mismo nombre exacto.

ESTADO (el motor solo sabe lo que pongas en los campos estructurados)
- Cada cosa que la narración cuenta debe reflejarse: si pierde salud, health_change negativo; si toma, compra, recibe o encuentra un objeto que se lleva, items_add; si lo usa, entrega o pierde, items_remove; oro ganado o pagado, gold_change.
- scene es OBLIGATORIO cuando el jugador entra a otro lugar (de un pueblo a una mina, de una calle a un edificio) o la situación cambia de forma notable; title corto y evocador.
- npcs: registra a todo personaje con quien el jugador habla, negocia, pelea o que le da información. Usa nombre propio en cuanto se sepa; si no, un apodo corto ("la anciana del pozo"). alive=false SOLO si muere de verdad: desaparecer, huir o irse no es morir.
- quests: actualiza el estado cuando se acepta, avanza (objective con el siguiente paso concreto), se cumple o se falla.
- monsters: amenazas no humanas o criaturas hostiles; known=false hasta que el jugador sepa qué son.

RIESGO Y DADOS
- El motor ya tiró un d20 real. Evalúa el riesgo de la acción del jugador (risk_assessed) y aplica EXACTAMENTE el resultado indicado para ese nivel. No lo menciones como número, cuéntalo en la ficción.
- Acciones triviales o puramente conversacionales: risk_assessed "ninguno" y la acción simplemente ocurre.
- Un fallo tiene consecuencias (heridas, pérdida, complicación). Un fallo catastrófico en riesgo alto puede terminar la historia.
- La muerte o derrota solo ante riesgo alto, malas decisiones acumuladas o salud 0.
- Si el jugador abandona la aventura (se retira, renuncia, se va o huye para siempre), la historia TERMINA en este turno: narra el cierre y completa ending ("retire" o "bittersweet") con un resumen de lo vivido.

PROGRESO
- Avanza la trama sin resolverlo todo. Siembra ganchos, misiones y personajes con motivaciones.
- actions: 2 a 4 opciones distintas y ejecutables con su riesgo y una pista del posible efecto.
- memory_facts: solo hechos nuevos importantes para el futuro, frases cortas.
- image_prompt: solo en momentos visualmente importantes (nuevo lugar, criatura o personaje clave), en inglés, describiendo composición, luz y sujetos, sin texto.`;

const RISKS: Risk[] = ["bajo", "medio", "alto"];

const DIFFICULTY_TEXT = {
  story: "historia (indulgente)",
  balanced: "equilibrada",
  hard: "difícil (letal)",
} as const;

export function stateDigest(state: GameState) {
  const p = state.player;
  const lines = [
    `MUNDO: ${state.world.name} — ${state.world.genre}. ${state.world.description} Tono: ${state.world.tone}.`,
    state.world.rules.length ? `REGLAS DEL MUNDO: ${state.world.rules.join("; ")}` : "",
    `DIFICULTAD: ${DIFFICULTY_TEXT[state.difficulty]}`,
    `JUGADOR: ${p.name}, ${p.race} ${p.class}. Rasgos: ${p.traits.join(", ") || "—"}. Trasfondo: ${p.backstory || "—"}`,
    `SALUD: ${p.health}/100 · ORO: ${p.gold}`,
    `CONDICIONES: ${p.conditions.map((c) => `${c.name} (${c.type}, ${c.severity})`).join("; ") || "ninguna"}`,
    `INVENTARIO: ${state.inventory.map((i) => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ""}`).join(", ") || "vacío"}`,
    `ESCENA: ${state.scene.title} — ${state.scene.location} (ambiente: ${state.scene.mood})`,
    `PERSONAJES: ${state.npcs.map((n) => `${n.name} [${n.role}, actitud ${n.disposition}${n.alive ? "" : ", muerto"}] ${n.notes}`).join(" | ") || "ninguno"}`,
    `CRIATURAS: ${state.monsters.map((m) => `${m.name} [amenaza ${m.threat_level}, salud ${m.health}${m.defeated ? ", derrotada" : ""}${m.known ? "" : ", no identificada"}]`).join(" | ") || "ninguna"}`,
    `MISIONES: ${state.quests.map((q) => `${q.title} [${q.status}]: ${q.objective}`).join(" | ") || "ninguna"}`,
    Object.keys(state.flags).length ? `BANDERAS: ${Object.entries(state.flags).map(([k, v]) => `${k}=${v}`).join(", ")}` : "",
    `POSICIÓN: capítulo ${state.chapter}, turno ${state.turn}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function checkTable(roll: number, state: GameState, chosen: Risk | null) {
  const risks = chosen ? [chosen] : RISKS;
  return risks.map((risk) => `- riesgo ${risk}: ${OUTCOME_LABEL[resolve(roll, risk, state).outcome]}`).join("\n");
}

interface TurnPromptInput {
  state: GameState;
  input: string | null;
  chosenRisk: Risk | null;
  roll: number;
  recent: Turn[];
  memories: RetrievedMemory[];
  imageAllowed: boolean;
}

export function buildTurnPrompt({ state, input, chosenRisk, roll, recent, memories, imageAllowed }: TurnPromptInput) {
  const sections = [`ESTADO ACTUAL\n${stateDigest(state)}`];

  if (state.chapter_summaries.length) {
    sections.push(`RESUMEN DE CAPÍTULOS\n${state.chapter_summaries.map((c) => `Cap. ${c.chapter}: ${c.summary}`).join("\n")}`);
  }
  if (memories.length) {
    sections.push(`RECUERDOS RELEVANTES (memoria a largo plazo)\n${memories.map((m) => `- [turno ${m.turn}] ${m.text}`).join("\n")}`);
  }
  if (recent.length) {
    sections.push(
      `ÚLTIMOS TURNOS\n${recent
        .map((t) => `${t.input ? `Jugador: ${t.input}\n` : ""}Narrador: ${t.narration}`)
        .join("\n\n")}`,
    );
  }

  if (input === null) {
    sections.push(
      "ESCENA INICIAL\nCrea la escena de apertura para este personaje y mundo. Varía el comienzo (no siempre una encrucijada ni una taberna). Define scene con título, lugar y ambiente, siembra un gancho (una misión ofrecida o un personaje con una necesidad) y da 3 acciones. Equipa al personaje con items_add de 2 o 3 objetos iniciales coherentes con su oficio y trasfondo (incluye los que el trasfondo menciona). risk_assessed = \"ninguno\". Incluye image_prompt del lugar.",
    );
  } else {
    sections.push(
      `TIRADA DEL MOTOR (d20 = ${roll}). Resultado según el riesgo que evalúes:\n${checkTable(roll, state, chosenRisk)}${
        chosenRisk ? `\nEl jugador eligió una acción sugerida de riesgo ${chosenRisk}: usa risk_assessed = "${chosenRisk}".` : ""
      }`,
    );
    sections.push(`ACCIÓN DEL JUGADOR\n${input}`);
  }
  if (!imageAllowed) sections.push("IMAGEN: ya hubo una ilustración reciente, deja image_prompt en null.");

  return sections.join("\n\n");
}

export function chapterSummaryPrompt(state: GameState, turns: Turn[]) {
  return `Resume en 4 a 6 frases el capítulo ${state.chapter} de esta aventura para usarlo como memoria canónica. Incluye lugares, personajes con nombre, objetos únicos, heridas, promesas y conflictos abiertos. Sin adornos.

${turns.map((t) => `${t.input ? `Jugador: ${t.input}\n` : ""}Narrador: ${t.narration}`).join("\n\n")}`;
}
