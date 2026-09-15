"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LogoMark } from "@/components/Logo";
import type { GameState, Turn } from "@/lib/engine/types";
import type { Stage } from "@/lib/game/engine";
import type { ImageLoader } from "./SceneImage";
import { Sidebar } from "./Sidebar";
import { StoryFeed, type StreamingTurn } from "./StoryFeed";

interface GameViewProps {
  state: GameState;
  turns: Turn[];
  streaming?: StreamingTurn | null;
  stage?: Stage | null;
  loadImage: ImageLoader;
  animateTurn: number | null;
  typingTurn?: number | null;
  headerRight?: React.ReactNode;
  banner?: React.ReactNode;
  footer?: React.ReactNode;
}

export function GameView({ state, turns, streaming = null, stage = null, loadImage, animateTurn, typingTurn, headerRight, banner, footer }: GameViewProps) {
  const [sheet, setSheet] = useState(false);

  // A chapter summary op in turn N means chapter N+1 starts after it.
  const chapterBreaks = useMemo(() => {
    const breaks = new Map<number, number>();
    for (const turn of turns) {
      const op = turn.ops.find((o) => o.path === "/chapter");
      if (op && "value" in op) breaks.set(turn.index, op.value as number);
    }
    return breaks;
  }, [turns]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b-2 border-[var(--line)] bg-[#0b0911]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4">
          <Link href="/" aria-label="Inicio" className="shrink-0">
            <LogoMark size={34} />
          </Link>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--gold-2)]">{state.scene.title}</p>
            <p className="truncate text-xs text-[var(--muted)]">
              📍 {state.scene.location} · Cap. {state.chapter} · Turno {state.turn}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {headerRight}
            <button className="btn btn-sm lg:hidden" onClick={() => setSheet(true)} data-testid="open-sheet">
              Ficha
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <main className="flex min-w-0 flex-col pt-6">
          <div className="mx-auto w-full max-w-3xl flex-1">
            {banner}
            <StoryFeed
              turns={turns}
              streaming={streaming}
              stage={stage}
              loadImage={loadImage}
              animateTurn={animateTurn}
              typingTurn={typingTurn}
              chapterBreaks={chapterBreaks}
            />
          </div>
          {footer && <div className="sticky bottom-0 z-20 mx-auto mt-6 w-full max-w-3xl bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pb-4 pt-6">{footer}</div>}
        </main>
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] py-6 lg:block">
          <Sidebar state={state} turns={turns} />
        </aside>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setSheet(false)}>
          <div className="absolute inset-x-0 bottom-0 top-14 p-3" onClick={(event) => event.stopPropagation()}>
            <div className="relative h-full">
              <button className="btn btn-sm absolute -top-11 right-0 z-10" onClick={() => setSheet(false)}>
                Cerrar ✕
              </button>
              <Sidebar state={state} turns={turns} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
