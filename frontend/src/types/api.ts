// Tipos para las APIs del backend y AI SDK

import { GameState, LLMOutput, DevTrace, Action } from "./game";
// AI SDK Integration Types (commented out for now)
// import { Message, ToolInvocation } from 'ai';
// export interface ChatMessage extends Message {
//   toolInvocations?: ToolInvocation[];
// }

// Temporary simple message interface
export interface ToolInvocation {
  toolName: string;
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date;
  toolInvocations?: ToolInvocation[];
}

export interface GameChatOptions {
  gameState?: GameState;
  sessionId?: string;
  debugConfig?: DebugConfig;
}

export interface ToolCallResult {
  type: "updateGameState" | "generateImage" | "debugTrace";
  result: unknown;
}

// Setup API
export interface PlayerSetup {
  name: string;
  race?: string;
  class?: string;
  traits?: string[];
  backstory?: string;
}

export interface WorldSetup {
  name?: string;
  genre?: string;
  description?: string;
  rules?: string[];
  tone?: string;
  lethality?: "story" | "balanced" | "hard";
}

export interface DebugConfig {
  enabled?: boolean;
  level?: "basic" | "verbose" | "trace";
  include?: {
    prompts?: boolean;
    state_patches?: boolean;
    memory_ops?: boolean;
    risk_resolution?: boolean;
    timing?: boolean;
  };
}

export interface SetupSessionRequest {
  player: PlayerSetup;
  world: WorldSetup;
  difficulty?: "story" | "balanced" | "hard";
  debug?: DebugConfig;
}

export interface SetupSessionResponse {
  state: GameState;
  intro: LLMOutput & {
    image_base64?: string;
    mime_type?: string;
    width?: number;
    height?: number;
  };
  debug?: DevTrace;
}

// Story generation API
export interface GenerateStoryRequest {
  user_input: string;
  state: GameState;
  session_id?: string;
  debug?: DebugConfig;
}

export interface GenerateStoryResponse {
  text: string;
  actions?: Action[];
  image_base64?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  debug?: DevTrace;
}

// ==================== SAVE SYSTEM TYPES ====================

export interface SaveGameRequest {
  state: GameState;
  session_id: string;
  title?: string;
  auto_save?: boolean;
}

export interface SaveGameResponse {
  success: boolean;
  save_id?: string;
  title?: string;
  auto_save?: boolean;
  saved_at?: string;
  error?: string;
}

export interface LoadGameResponse {
  success: boolean;
  save_id?: string;
  state?: GameState;
  session_id?: string;
  metadata?: SaveMetadata;
  loaded_at?: string;
  error?: string;
}

export interface SaveMetadata {
  save_id: string;
  title: string;
  player_name: string;
  world_name: string;
  chapter: number;
  turn: number;
  location: string;
  created_at: string;
  updated_at: string;
  playtime_minutes?: number;
  thumbnail_description?: string;
  game_over: boolean;
  auto_save: boolean;
  file_size?: number;
}

export interface DeleteSaveResponse {
  success: boolean;
  save_id?: string;
  error?: string;
}

export interface SaveStatsResponse {
  total_saves: number;
  manual_saves: number;
  auto_saves: number;
  total_size_bytes: number;
  total_size_mb: number;
  oldest_save?: string;
  newest_save?: string;
}

// ==================== IMAGE GENERATION TYPES ====================

export interface ImageGenerationRequest {
  prompt: string;
  session_id?: string;
  style?: "realistic" | "artistic" | "fantasy" | "pixel";
  aspect_ratio?: "1:1" | "16:9" | "4:3";
}

export interface ImageResponse {
  success: boolean;
  image_base64?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  prompt_used?: string;
  error?: string;
}

// ==================== MEMORY SYSTEM TYPES ====================

export interface MemorySearchRequest {
  query: string;
  session_id: string;
  limit?: number;
  threshold?: number;
  memory_types?: string[];
}

export interface MemoryResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity_score: number;
  timestamp: string;
}

export interface MemorySearchResponse {
  success: boolean;
  results: MemoryResult[];
  total_count: number;
  query_used?: string;
  error?: string;
}

export interface MemoryStatsResponse {
  total_memories: number;
  memory_types: Record<string, number>;
  oldest_memory?: string;
  newest_memory?: string;
  total_size_mb: number;
}

// ==================== STATE MANAGEMENT TYPES ====================

export interface StateUpdate {
  type: "character" | "inventory" | "scene" | "flags" | "quest";
  operation: "add" | "update" | "remove";
  data: Record<string, unknown>;
  target_id?: string;
}

export interface UpdateStateRequest {
  session_id: string;
  updates: StateUpdate[];
  reason?: string;
}

export interface UpdateStateResponse {
  success: boolean;
  updated_state?: GameState;
  changes_applied: number;
  error?: string;
}

// ==================== GAME FLOW TYPES ====================

export interface GameMenuAction {
  id: string;
  label: string;
  icon?: string;
  action: "save" | "load" | "settings" | "exit" | "new-game" | "continue";
  disabled?: boolean;
}

export interface GameSettings {
  auto_save_enabled: boolean;
  auto_save_interval: number;
  image_generation: boolean;
  debug_mode: boolean;
  sound_enabled: boolean;
  animations_enabled: boolean;
}

// Error types
export interface APIError {
  detail: string;
  status_code?: number;
}
