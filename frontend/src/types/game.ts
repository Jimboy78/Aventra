// Tipos para el estado del juego basados en el esquema de la especificación

export interface Condition {
  id: string;
  type: 'wound' | 'status' | 'ailment' | 'buff' | 'debuff';
  name: string;
  severity?: 'minor' | 'moderate' | 'severe' | 'critical';
  since_turn?: number;
  notes?: string;
  mechanical_effects?: string;
}

export interface Knowledge {
  known?: boolean;
  revealed_fields?: string[];
}

export interface Character {
  id: string;
  name: string;
  role: 'player' | 'ally' | 'npc' | 'enemy';
  race?: string;
  class?: string;
  traits?: string[];
  health?: number; // 0-100
  notes?: string;
  conditions?: Condition[];
  alive?: boolean;
  knowledge?: Knowledge;
  // Campos adicionales para NPCs persistentes
  tags?: string[];
  shop?: {
    currency?: string;
    stock: Item[];
    restock_policy?: string;
  };
  quests_offered?: {
    id: string;
    title: string;
    status: 'offered' | 'accepted' | 'completed' | 'failed';
  }[];
  reputation?: {
    with_player: number; // -100..+100
  };
}

export interface Item {
  id: string;
  name: string;
  qty?: number;
  description?: string;
  knowledge?: Knowledge;
}

export interface Monster {
  id: string;
  name: string;
  threat_level: 1 | 2 | 3 | 4 | 5;
  health?: number;
  notes?: string;
  knowledge?: Knowledge;
  conditions?: Condition[];
}

export interface Quest {
  id: string;
  title: string;
  giver_id?: string;
  status: 'offered' | 'accepted' | 'completed' | 'failed';
  objectives?: {
    id: string;
    text: string;
    done: boolean;
  }[];
  rewards?: {
    xp?: number;
    items?: Item[];
    flags?: Record<string, unknown>;
  };
  notes?: string;
}

export interface JournalEntry {
  id: string;
  turn: number;
  text: string;
  tags?: string[];
}

export interface Scene {
  id: string;
  title: string;
  location?: string;
  mood?: string;
}

export interface World {
  name?: string;
  genre?: string;
  description?: string;
  rules?: string[];
  tone?: string;
}

export interface Ending {
  type: 'death' | 'defeat' | 'retire' | 'bittersweet';
  summary: string;
  cause?: string;
}

export interface GameState {
  scene: Scene;
  world?: World;
  characters: Character[];
  inventory: Item[];
  monsters: Monster[];
  quests?: Quest[];
  journal?: JournalEntry[];
  flags: { [key: string]: boolean | number | string };
  story_position: {
    chapter: number;
    turn: number;
  };
  memory_summary: string;
  game: {
    is_game_over: boolean;
    ending?: Ending;
    difficulty?: 'story' | 'balanced' | 'hard';
  };
  schema_version?: string;
}

export interface Action {
  id?: string;
  text: string;
  risk: 'bajo' | 'medio' | 'alto';
  effect_hint?: string;
  may_end_game?: boolean;
}

export interface LLMOutput {
  narration: string;
  actions?: Action[];
  image_request?: {
    description: string;
    style?: string;
  };
}

export interface DevTrace {
  step_id: string;
  inputs: {
    user_input?: string;
    state_digest: string;
  };
  prompt?: {
    system?: string;
    user?: string;
    tools?: string[];
  };
  llm_output_raw?: string;
  parsed?: {
    narration_excerpt: string;
    state_patch_keys: string[];
    actions_count?: number;
  };
  state_patch?: Partial<GameState>;
  memory_ops?: {
    summaries_updated?: boolean;
    tokens_before?: number;
    tokens_after?: number;
  };
  risk_resolution?: {
    action_id?: string;
    risk?: 'bajo' | 'medio' | 'alto';
    outcome: 'success' | 'fail' | 'mixed';
  };
  timing?: {
    total_ms: number;
    llm_ms?: number;
    image_ms?: number;
  };
  warnings?: string[];
}