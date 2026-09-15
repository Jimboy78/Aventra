import type { CheckOutcome, CheckResult, Difficulty, GameState, Risk } from "./types";

// Risk is resolved by a real d20 rolled by the engine, not by the model: the roll is seeded by
// the adventure seed and turn so a save replays identically, and the narrator is told the
// outcome for each risk level and must honour the one that applies.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rollD20 = (seed: number, turn: number) =>
  1 + Math.floor(mulberry32(Math.imul(seed ^ 0x9e3779b9, 31) + turn * 7919)() * 20);

export const BASE_DC: Record<Risk, number> = { bajo: 6, medio: 11, alto: 15 };
const DIFFICULTY_DC: Record<Difficulty, number> = { story: -3, balanced: 0, hard: 3 };
const SEVERITY_PENALTY = { minor: 0, moderate: 1, severe: 2, critical: 4 } as const;

/** Penalty from wounds/debuffs and low health; buffs give a bonus. */
export function modifierFor(state: GameState): number {
  let mod = 0;
  for (const c of state.player.conditions) {
    if (c.type === "buff") mod += 1;
    else if (c.type === "wound" || c.type === "debuff") mod -= SEVERITY_PENALTY[c.severity];
  }
  if (state.player.health <= 25) mod -= 2;
  else if (state.player.health <= 50) mod -= 1;
  return Math.max(-6, Math.min(3, mod));
}

export function resolve(roll: number, risk: Risk, state: GameState): CheckResult {
  const dc = BASE_DC[risk] + DIFFICULTY_DC[state.difficulty];
  const modifier = modifierFor(state);
  const total = roll + modifier;
  let outcome: CheckOutcome;
  if (roll === 20) outcome = "critical";
  else if (roll === 1) outcome = "fumble";
  else if (total >= dc) outcome = "success";
  else if (total >= dc - 4) outcome = "partial";
  else outcome = "fail";
  return { roll, risk, dc, modifier, outcome };
}

export const OUTCOME_LABEL: Record<CheckOutcome, string> = {
  critical: "éxito crítico",
  success: "éxito",
  partial: "éxito parcial con un coste",
  fail: "fallo",
  fumble: "fallo catastrófico",
};
