import type { Difficulty, GameState, Player, World } from "@/lib/engine/types";

export interface WorldPreset extends World {
  id: string;
  emoji: string;
  art: string;
  palette: [string, string];
}

export const WORLD_PRESETS: WorldPreset[] = [
  {
    id: "ceniza",
    emoji: "🔥",
    name: "Reinos de Ceniza",
    genre: "Fantasía oscura",
    description: "Un imperio caído bajo un cielo de ceniza perpetua, donde los dioses callaron hace un siglo y las brasas aún recuerdan.",
    tone: "sombrío y épico",
    rules: ["La magia exige un precio en recuerdos", "Los muertos sin nombre no descansan"],
    art: "dark fantasy 16-bit pixel art, ember glow, muted purples and orange",
    palette: ["#f97316", "#7c3aed"],
  },
  {
    id: "neon",
    emoji: "🌃",
    name: "Neón Caído",
    genre: "Ciberpunk",
    description: "Nueva Lumen, megaciudad vertical donde las corporaciones venden recuerdos y la lluvia nunca para.",
    tone: "noir y tenso",
    rules: ["Los implantes se pueden hackear", "La policía corporativa responde en minutos"],
    art: "cyberpunk 16-bit pixel art, rain, magenta and cyan neon",
    palette: ["#ec4899", "#06b6d4"],
  },
  {
    id: "niebla",
    emoji: "🏴‍☠️",
    name: "Mar de Niebla",
    genre: "Piratas y horror",
    description: "Un archipiélago envuelto en niebla viva, donde los barcos desaparecen y los faros guían hacia algo que no es tierra.",
    tone: "misterioso y aventurero",
    rules: ["La niebla escucha los nombres", "El oro maldito vuelve a su dueño"],
    art: "eerie pirate 16-bit pixel art, fog, teal and bone white",
    palette: ["#14b8a6", "#e2e8f0"],
  },
  {
    id: "kepler",
    emoji: "🛰️",
    name: "Estación Kepler",
    genre: "Ciencia ficción",
    description: "Una estación minera en el borde del sistema que acaba de recibir una señal desde el interior del asteroide.",
    tone: "claustrofóbico y curioso",
    rules: ["El oxígeno es un recurso contado", "La IA de la estación no puede mentir, pero omite"],
    art: "retro sci-fi 16-bit pixel art, cold blue light, amber consoles",
    palette: ["#3b82f6", "#f59e0b"],
  },
];

export const RACES = ["Humano", "Elfa", "Enano", "Mediano", "Androide", "Tiefling"];
export const CLASSES = ["Guerrera", "Pícaro", "Maga", "Explorador", "Clériga", "Hacker", "Bardo"];
export const TRAITS = ["Valiente", "Curiosa", "Desconfiado", "Carismático", "Impulsiva", "Sigiloso", "Leal", "Ingeniosa"];

export const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: "story", label: "Historia", hint: "Tiradas fáciles (−3 CD). Ideal para explorar." },
  { id: "balanced", label: "Equilibrada", hint: "El riesgo es real, pero justo." },
  { id: "hard", label: "Difícil", hint: "+3 CD. Las malas decisiones matan." },
];

export function initialState(world: World, player: Omit<Player, "health" | "gold" | "conditions">, difficulty: Difficulty): GameState {
  return {
    world,
    player: { ...player, health: 100, gold: 10, conditions: [] },
    scene: { title: "Prólogo", location: world.name, mood: "expectante" },
    npcs: [],
    monsters: [],
    inventory: [],
    quests: [],
    journal: [],
    flags: {},
    turn: 0,
    chapter: 1,
    chapter_summaries: [],
    difficulty,
    game: { over: false, ending: null },
  };
}

export const artStyleFor = (world: World) =>
  WORLD_PRESETS.find((preset) => preset.name === world.name)?.art ??
  `${world.genre} 16-bit pixel art illustration, rich atmospheric lighting`;
