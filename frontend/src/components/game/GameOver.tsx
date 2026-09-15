"use client";

import Link from "next/link";
import type { EndingType, GameState, Turn } from "@/lib/engine/types";

const ENDINGS: Record<EndingType, { icon: string; title: string; color: string }> = {
  death: { icon: "💀", title: "Tu historia termina aquí", color: "var(--blood)" },
  defeat: { icon: "⚔️", title: "Derrota", color: "var(--ember)" },
  retire: { icon: "🏕️", title: "Te retiras del camino", color: "var(--sky)" },
  bittersweet: { icon: "🌓", title: "Un final agridulce", color: "var(--arcane)" },
  victory: { icon: "👑", title: "Victoria", color: "var(--gold)" },
};

interface GameOverProps {
  state: GameState;
  turns: Turn[];
  onClose: () => void;
  onExport?: () => void;
}

export function GameOver({ state, turns, onClose, onExport }: GameOverProps) {
  const ending = state.game.ending;
  if (!ending) return null;
  const look = ENDINGS[ending.type];
  const stats = [
    ["Turnos", turns.length],
    ["Capítulos", state.chapter],
    ["Oro", state.player.gold],
    ["Criaturas vencidas", state.monsters.filter((m) => m.defeated).length],
    ["Personajes", state.npcs.length],
    ["Misiones cumplidas", state.quests.filter((q) => q.status === "completed").length],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div className="frame frame-gold corners rise w-full max-w-xl p-6 text-center sm:p-8" role="dialog" aria-modal="true" data-testid="game-over" data-ending={ending.type}>
        <div className="float mb-4 text-6xl">{look.icon}</div>
        <p className="font-pixel mb-3 text-[0.6rem] tracking-widest" style={{ color: look.color }}>
          FIN DE LA AVENTURA
        </p>
        <h2 className="mb-4 text-3xl font-semibold">{look.title}</h2>
        <p className="font-story mx-auto mb-2 max-w-md text-lg leading-relaxed text-[#e9e1d2]">{ending.summary}</p>
        {ending.cause && <p className="mb-6 text-sm italic text-[var(--muted)]">{ending.cause}</p>}
        <div className="mb-7 grid grid-cols-3 gap-2">
          {stats.map(([label, value]) => (
            <div key={label} className="border-2 border-[var(--line)] bg-[#0f0b17] py-2.5">
              <p className="font-pixel text-sm text-[var(--gold)]">{value}</p>
              <p className="mt-1 text-xs text-[var(--faint)]">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn" onClick={onClose}>
            Releer la historia
          </button>
          {onExport && (
            <button className="btn" onClick={onExport}>
              Exportar partida
            </button>
          )}
          <Link className="btn btn-gold" href="/new">
            Nueva aventura
          </Link>
        </div>
      </div>
    </div>
  );
}
