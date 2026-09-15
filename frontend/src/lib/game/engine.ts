import { describeError, embed, illustrate, IMAGE_PRICE, narrateTurn, summarize, turnCost } from "@/lib/ai/openai";
import { resolve, rollD20 } from "@/lib/engine/dice";
import { memoriesForTurn, memoryQuery, rankMemories } from "@/lib/engine/memory";
import { applyOps } from "@/lib/engine/patch";
import { buildTurnPrompt, chapterSummaryPrompt, NARRATOR_SYSTEM } from "@/lib/engine/prompt";
import { reduceTurn } from "@/lib/engine/reducer";
import type { TurnOutput } from "@/lib/engine/schema";
import type { Adventure, GameState, MemoryRecord, PatchOp, RetrievedMemory, Risk, StageTimings, Turn } from "@/lib/engine/types";
import { db } from "@/lib/store/db";
import { artStyleFor } from "./presets";

export const CHAPTER_EVERY = 6;
export const IMAGE_GAP = 2;
const EMBED_PRICE = 0.02 / 1_000_000;

export type Stage = "recordando" | "narrando" | "memorizando" | "resumiendo" | "ilustrando";

export interface PlaySettings {
  model: string;
  images: boolean;
}

export function createAdventure(state: GameState): Adventure {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    version: 1,
    title: `${state.player.name} en ${state.world.name}`,
    created_at: now,
    updated_at: now,
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
    initial: state,
    state,
    turns: [],
  };
}

export function imageAllowed(adventure: Adventure) {
  const last = [...adventure.turns].reverse().find((turn) => turn.image);
  return !last || adventure.turns.length - last.index > IMAGE_GAP;
}

interface PlayOptions {
  adventure: Adventure;
  input: string | null;
  chosenRisk: Risk | null;
  settings: PlaySettings;
  apiKey: string;
  signal?: AbortSignal;
  onStage: (stage: Stage | null) => void;
  onPartial: (partial: Partial<TurnOutput>) => void;
  /** Called every time the saved adventure changes (turn applied, image ready…). */
  onSaved: (adventure: Adventure) => void;
}

export async function playTurn({ adventure, input, chosenRisk, settings, apiKey, signal, onStage, onPartial, onSaved }: PlayOptions) {
  const before = adventure.state;
  if (before.game.over) throw new Error("La historia ya terminó.");
  const index = adventure.turns.length;
  const warnings: string[] = [];
  const stages: StageTimings = {};
  const timed = async <T>(name: keyof StageTimings, work: () => Promise<T>) => {
    const started = performance.now();
    try {
      return await work();
    } finally {
      stages[name] = Math.round(performance.now() - started);
    }
  };
  let cost = 0;

  let memories: RetrievedMemory[] = [];
  if (input !== null) {
    onStage("recordando");
    await timed("recall", async () => {
      try {
        const records = await db.memories(adventure.id);
        if (!records.length) return;
        const { vectors, tokens } = await embed(apiKey, [memoryQuery(before, input)]);
        cost += tokens * EMBED_PRICE;
        memories = rankMemories(records, vectors[0], index);
      } catch (error) {
        warnings.push(`Memoria no disponible: ${describeError(error)}`);
      }
    });
  }

  onStage("narrando");
  const roll = rollD20(adventure.seed, index);
  const allowImage = settings.images && imageAllowed(adventure);
  const prompt = buildTurnPrompt({
    state: before,
    input,
    chosenRisk,
    roll,
    recent: adventure.turns.slice(-3),
    memories,
    imageAllowed: allowImage,
  });
  const { object, usage, timing } = await timed("narrate", () =>
    narrateTurn({ key: apiKey, model: settings.model, system: NARRATOR_SYSTEM, prompt, signal, onPartial }),
  );
  cost += turnCost(settings.model, usage);

  const { state, ops } = reduceTurn(before, object, index);
  const risk = chosenRisk ?? (object.risk_assessed === "ninguno" ? null : object.risk_assessed);
  const turn: Turn = {
    index,
    input,
    chosen_risk: chosenRisk,
    check: input !== null && risk ? resolve(roll, risk, before) : null,
    narration: object.narration.trim(),
    actions: state.game.over ? [] : object.actions.slice(0, 4),
    ops,
    memories,
    image: null,
    image_prompt: object.image_prompt,
    usage,
    cost_usd: cost,
    timing: { ...timing, stages },
    model: settings.model,
    warnings,
    created_at: Date.now(),
  };

  let current: Adventure = { ...adventure, state, turns: [...adventure.turns, turn], updated_at: Date.now() };
  const save = async (next: Adventure) => {
    current = { ...next, updated_at: Date.now() };
    await db.putAdventure(current);
    onSaved(current);
  };
  const patchTurn = (changes: Partial<Turn>, nextState = current.state) =>
    save({ ...current, state: nextState, turns: current.turns.map((t) => (t.index === index ? { ...t, ...changes } : t)) });
  await timed("save", () => save(current));

  onStage("memorizando");
  await timed("memorize", async () => {
    const fresh = memoriesForTurn(turn, state);
    try {
      const { vectors, tokens } = await embed(apiKey, fresh.map((m) => m.text));
      const records: MemoryRecord[] = fresh.map((m, i) => ({ id: `${adventure.id}:${index}:${i}`, adventureId: adventure.id, turn: index, kind: m.kind, text: m.text, vector: vectors[i] }));
      await db.putMemories(records);
      cost += tokens * EMBED_PRICE;
    } catch (error) {
      warnings.push(`No se pudo memorizar el turno: ${describeError(error)}`);
    }
  });

  if (index > 0 && index % CHAPTER_EVERY === 0 && !state.game.over) {
    onStage("resumiendo");
    await timed("summary", async () => {
      try {
        const chapterTurns = current.turns.slice(-CHAPTER_EVERY);
        const summary = await summarize(apiKey, settings.model, chapterSummaryPrompt(state, chapterTurns));
        const chapterOps: PatchOp[] = [
          { op: "add", path: "/chapter_summaries/-", value: { chapter: state.chapter, summary: summary.text } },
          { op: "replace", path: "/chapter", value: state.chapter + 1 },
        ];
        const { vectors, tokens } = await embed(apiKey, [`Resumen del capítulo ${state.chapter}: ${summary.text}`]);
        await db.putMemories([{ id: `${adventure.id}:chapter:${state.chapter}`, adventureId: adventure.id, turn: index, kind: "chapter", text: `Capítulo ${state.chapter}: ${summary.text}`, vector: vectors[0] }]);
        cost += turnCost(settings.model, summary.usage) + tokens * EMBED_PRICE;
        await patchTurn({ ops: [...ops, ...chapterOps], cost_usd: cost }, applyOps(current.state, chapterOps));
      } catch (error) {
        warnings.push(`Resumen de capítulo fallido: ${describeError(error)}`);
      }
    });
  }

  if (allowImage && object.image_prompt) {
    onStage("ilustrando");
    await timed("image", async () => {
      try {
        const dataUrl = await illustrate(apiKey, object.image_prompt!, artStyleFor(state.world), signal);
        const id = `${adventure.id}:img:${index}`;
        await db.putImage({ id, adventureId: adventure.id, dataUrl, prompt: object.image_prompt! });
        cost += IMAGE_PRICE;
        await patchTurn({ image: { id, prompt: object.image_prompt! }, cost_usd: cost });
      } catch (error) {
        warnings.push(`Ilustración fallida: ${describeError(error)}`);
      }
    });
  }

  await patchTurn({ cost_usd: cost, warnings: [...warnings], timing: { ...timing, stages: { ...stages } } });
  onStage(null);
  return current;
}

/** Rebuilds the state after every turn from the initial state and each turn's patch. */
export function replayStates(adventure: Adventure) {
  const states: GameState[] = [];
  let state = adventure.initial;
  for (const turn of adventure.turns) {
    state = applyOps(state, turn.ops);
    states.push(state);
  }
  return states;
}
