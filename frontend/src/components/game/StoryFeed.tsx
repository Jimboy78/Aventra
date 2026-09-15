"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Risk, Turn } from "@/lib/engine/types";
import type { Stage } from "@/lib/game/engine";
import { Dice } from "./Dice";
import { PaintingPlaceholder, SceneImage, type ImageLoader } from "./SceneImage";

export interface StreamingTurn {
  input: string | null;
  risk: Risk | null;
  narration: string;
}

export const STAGE_LABEL: Record<Stage, string> = {
  recordando: "Consultando la memoria del mundo…",
  narrando: "El narrador escribe…",
  memorizando: "Guardando recuerdos…",
  resumiendo: "Cerrando el capítulo…",
  ilustrando: "Pintando la escena…",
};

function PlayerLine({ input, risk }: { input: string; risk: Risk | null }) {
  return (
    <div className="rise mb-4 ml-auto w-fit max-w-[88%] border-2 border-[#3a2f52] bg-[#1d1629] px-4 py-2.5" data-testid="player-input">
      <p className="font-pixel mb-1.5 flex items-center gap-2 text-[0.52rem] text-[var(--arcane)]">
        TU ACCIÓN
        {risk && (
          <span className={`risk-${risk} inline-flex items-center gap-1.5 text-[var(--risk)]`}>
            <span className="risk-dot" /> RIESGO {risk.toUpperCase()}
          </span>
        )}
      </p>
      <p className="text-[1.02rem] leading-snug">{input}</p>
    </div>
  );
}

function Ornament({ chapter }: { chapter?: number }) {
  return (
    <div className="my-8 flex items-center gap-3 text-[var(--line-2)]" aria-hidden={!chapter}>
      <span className="h-0.5 flex-1 bg-gradient-to-r from-transparent to-[var(--line)]" />
      {chapter ? <span className="font-pixel text-[0.58rem] text-[var(--gold)]">CAPÍTULO {chapter}</span> : <span className="text-xs">✦ ✦ ✦</span>}
      <span className="h-0.5 flex-1 bg-gradient-to-l from-transparent to-[var(--line)]" />
    </div>
  );
}

interface StoryFeedProps {
  turns: Turn[];
  streaming: StreamingTurn | null;
  stage: Stage | null;
  loadImage: ImageLoader;
  /** Turn whose dice should animate (the one just played / being revealed). */
  animateTurn: number | null;
  /** Turn currently being typed out (demo replay). */
  typingTurn?: number | null;
  /** Chapter number that starts after each turn index, from the chapter summary ops. */
  chapterBreaks?: Map<number, number>;
}

export function StoryFeed({ turns, streaming, stage, loadImage, animateTurn, typingTurn = null, chapterBreaks }: StoryFeedProps) {
  const end = useRef<HTMLDivElement>(null);
  const last = turns.at(-1);
  const signal = `${turns.length}:${last?.narration.length ?? 0}:${last?.image?.id ?? ""}:${streaming?.narration.length ?? -1}:${stage ?? ""}`;

  useEffect(() => {
    const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 420;
    if (nearBottom) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [signal]);

  return (
    <div data-testid="story">
      {turns.map((turn, position) => (
        <article key={turn.index} className="rise" data-testid="turn" data-index={turn.index}>
          {position > 0 && <Ornament chapter={chapterBreaks?.get(turns[position - 1].index)} />}
          {turn.input && <PlayerLine input={turn.input} risk={turn.chosen_risk} />}
          {turn.check && (
            <div className="mb-4">
              <Dice check={turn.check} animate={animateTurn === turn.index} />
            </div>
          )}
          <div className={`story ${turn.index === 0 ? "dropcap" : ""} ${typingTurn === turn.index ? "caret" : ""}`} data-testid="narration">
            <ReactMarkdown>{turn.narration}</ReactMarkdown>
          </div>
          {(turn.image || (turn === last && stage === "ilustrando")) && (
            <div className="mt-5">
              {turn.image ? <SceneImage id={turn.image.id} prompt={turn.image.prompt} load={loadImage} /> : <PaintingPlaceholder />}
            </div>
          )}
          {turn.memories.length > 0 && (
            <p className="mt-3 text-xs text-[var(--faint)]" data-testid="memory-hint">
              🧠 El narrador recordó {turn.memories.length} {turn.memories.length === 1 ? "hecho lejano" : "hechos lejanos"}
            </p>
          )}
          {turn.warnings.map((warning) => (
            <p key={warning} className="mt-2 text-xs text-[#ffb3ba]">
              ⚠ {warning}
            </p>
          ))}
        </article>
      ))}

      {streaming && (
        <article data-testid="streaming-turn">
          {turns.length > 0 && <Ornament />}
          {streaming.input && <PlayerLine input={streaming.input} risk={streaming.risk} />}
          {streaming.narration ? (
            <div className={`story caret ${turns.length === 0 ? "dropcap" : ""}`} data-testid="streaming-narration">
              <ReactMarkdown>{streaming.narration}</ReactMarkdown>
            </div>
          ) : (
            <div className="space-y-3" aria-live="polite">
              <p className="font-pixel text-[0.6rem] text-[var(--gold)]">{STAGE_LABEL[stage ?? "narrando"]}</p>
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-11/12" />
              <div className="skeleton h-4 w-3/5" />
            </div>
          )}
        </article>
      )}
      <div ref={end} className="h-2" />
    </div>
  );
}
