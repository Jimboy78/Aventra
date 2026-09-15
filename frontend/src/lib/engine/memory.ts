import type { GameState, MemoryRecord, RetrievedMemory, Turn } from "./types";

// Long-term memory: every turn stores an embedding of the scene and of each canonical fact.
// Before the next turn the player's intent is embedded and the closest memories that are not
// already in the recent-turns window are handed to the narrator.

export const RECENT_TURNS = 3;
export const TOP_K = 5;
export const MIN_SCORE = 0.3;

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function rankMemories(
  records: MemoryRecord[],
  query: number[],
  currentTurn: number,
  { topK = TOP_K, minScore = MIN_SCORE, recent = RECENT_TURNS } = {},
): RetrievedMemory[] {
  return records
    .filter((record) => record.kind === "chapter" || record.turn < currentTurn - recent)
    .map((record) => ({ id: record.id, turn: record.turn, kind: record.kind, text: record.text, score: cosine(record.vector, query) }))
    .filter((memory) => memory.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((memory) => ({ ...memory, score: Math.round(memory.score * 1000) / 1000 }));
}

export function memoryQuery(state: GameState, input: string) {
  const present = state.npcs.filter((npc) => npc.alive).slice(-4).map((npc) => npc.name);
  return [input, state.scene.title, state.scene.location, ...present].filter(Boolean).join(" · ");
}

const plain = (markdown: string) => markdown.replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim();

export function memoriesForTurn(turn: Turn, state: GameState) {
  const scene = plain(turn.narration);
  const entries: { kind: MemoryRecord["kind"]; text: string }[] = [
    {
      kind: "scene",
      text: `Turno ${turn.index} en ${state.scene.location || state.scene.title}. ${turn.input ? `El jugador: "${turn.input}". ` : ""}${scene.length > 480 ? `${scene.slice(0, 480)}…` : scene}`,
    },
  ];
  for (const entry of state.journal.filter((j) => j.turn === turn.index)) entries.push({ kind: "fact", text: entry.text });
  return entries;
}
