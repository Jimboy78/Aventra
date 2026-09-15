export const GAME_PHASES = {
  SETUP: 'setup',
  PLAYING: 'playing',
  GAME_OVER: 'game-over',
} as const;

export const DIFFICULTY_LEVELS = {
  STORY: 'story',
  BALANCED: 'balanced',
  HARD: 'hard',
} as const;

export const LETHALITY_LEVELS = {
  STORY: 'story',
  BALANCED: 'balanced',
  HARD: 'hard',
} as const;

export const ENDING_TYPES = {
  DEATH: 'death',
  DEFEAT: 'defeat',
  RETIRE: 'retire',
  BITTERSWEET: 'bittersweet',
} as const;

export const ERROR_MESSAGES = {
  API_REQUEST_FAILED: 'API request failed',
  NETWORK_ERROR: 'Network error occurred',
  PLAYER_NAME_REQUIRED: 'El nombre del personaje es requerido',
  GAME_SETUP_ERROR: 'Error al configurar el juego',
} as const;