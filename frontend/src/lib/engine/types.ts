// Game model shared by the engine, the UI and saved/exported adventures.

export type Risk = "bajo" | "medio" | "alto";
export type Difficulty = "story" | "balanced" | "hard";
export type ConditionType = "wound" | "status" | "buff" | "debuff";
export type Severity = "minor" | "moderate" | "severe" | "critical";
export type NpcRole = "ally" | "npc" | "enemy";
export type QuestStatus = "offered" | "accepted" | "completed" | "failed";
export type EndingType = "death" | "defeat" | "retire" | "bittersweet" | "victory";

export interface Condition {
  id: string;
  name: string;
  type: ConditionType;
  severity: Severity;
  since_turn: number;
}

export interface Item {
  id: string;
  name: string;
  qty: number;
  description: string;
}

export interface Npc {
  id: string;
  name: string;
  role: NpcRole;
  /** -100 (hostile) .. 100 (devoted) */
  disposition: number;
  notes: string;
  alive: boolean;
  first_seen_turn: number;
}

export interface Monster {
  id: string;
  name: string;
  threat_level: number;
  health: number;
  notes: string;
  /** Unknown creatures are redacted in the player view. */
  known: boolean;
  defeated: boolean;
}

export interface Quest {
  id: string;
  title: string;
  status: QuestStatus;
  objective: string;
  updated_turn: number;
}

export interface JournalEntry {
  id: string;
  turn: number;
  text: string;
}

export interface Player {
  name: string;
  race: string;
  class: string;
  traits: string[];
  backstory: string;
  health: number;
  gold: number;
  conditions: Condition[];
}

export interface World {
  name: string;
  genre: string;
  description: string;
  tone: string;
  rules: string[];
}

export interface Scene {
  title: string;
  location: string;
  mood: string;
}

export interface Ending {
  type: EndingType;
  summary: string;
  cause: string;
}

export interface GameState {
  world: World;
  player: Player;
  scene: Scene;
  npcs: Npc[];
  monsters: Monster[];
  inventory: Item[];
  quests: Quest[];
  journal: JournalEntry[];
  flags: Record<string, string>;
  turn: number;
  chapter: number;
  chapter_summaries: { chapter: number; summary: string }[];
  difficulty: Difficulty;
  game: { over: boolean; ending: Ending | null };
}

export interface SuggestedAction {
  text: string;
  risk: Risk;
  effect_hint: string;
  may_end_game: boolean;
}

export type PatchOp =
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string };

export type CheckOutcome = "critical" | "success" | "partial" | "fail" | "fumble";

export interface CheckResult {
  roll: number;
  risk: Risk;
  dc: number;
  modifier: number;
  outcome: CheckOutcome;
}

export interface RetrievedMemory {
  id: string;
  turn: number;
  kind: MemoryKind;
  text: string;
  score: number;
}

export type MemoryKind = "scene" | "fact" | "chapter";

/** Wall-clock milliseconds spent in each step of a turn. */
export type StageTimings = Partial<Record<"recall" | "narrate" | "save" | "memorize" | "summary" | "image", number>>;

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface Turn {
  index: number;
  /** null for the opening scene */
  input: string | null;
  /** Risk the player picked from a suggested action, if any. */
  chosen_risk: Risk | null;
  check: CheckResult | null;
  narration: string;
  actions: SuggestedAction[];
  ops: PatchOp[];
  memories: RetrievedMemory[];
  image: { id: string; prompt: string } | null;
  image_prompt: string | null;
  usage: TurnUsage;
  /** Narration + embeddings + chapter summary + illustration, in USD. */
  cost_usd: number;
  timing: { total_ms: number; first_token_ms: number; stages?: StageTimings };
  model: string;
  warnings: string[];
  created_at: number;
}

export interface Adventure {
  id: string;
  version: 1;
  title: string;
  created_at: number;
  updated_at: number;
  seed: number;
  initial: GameState;
  state: GameState;
  turns: Turn[];
}

export interface MemoryRecord {
  id: string;
  adventureId: string;
  turn: number;
  kind: MemoryKind;
  text: string;
  vector: number[];
}
