"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GameOver } from "@/components/game/GameOver";
import { GameView } from "@/components/game/GameView";
import { Logo } from "@/components/Logo";
import { replayStates } from "@/lib/game/engine";
import { loadDemo, loadDemoIndex, type DemoMeta } from "@/lib/game/demos";
import type { AdventureBundle } from "@/lib/store/db";

const ENDING_LABEL = { death: "muerte", defeat: "derrota", retire: "retiro", bittersweet: "agridulce", victory: "victoria" } as const;

export function DemoCard({ demo }: { demo: DemoMeta }) {
  return (
    <Link
      href={`/demo?s=${demo.slug}`}
      className="frame group block overflow-hidden transition hover:-translate-y-1 hover:border-[var(--gold)]"
      data-testid="demo-card"
      style={{ ["--a" as string]: demo.palette[0], ["--b" as string]: demo.palette[1] }}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-[linear-gradient(135deg,var(--a),var(--b))]">
        {demo.cover && (
          // eslint-disable-next-line @next/next/no-img-element -- static demo covers
          <img src={demo.cover} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        )}
        <span className="absolute left-3 top-3 border-2 border-black/40 bg-black/60 px-2 py-1 font-pixel text-[0.5rem] text-white">{demo.genre.toUpperCase()}</span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10 text-lg font-semibold">{demo.title}</span>
      </div>
      <div className="p-4">
        <p className="font-story mb-3 line-clamp-3 text-[0.98rem] italic text-[var(--muted)]">“{demo.excerpt}”</p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--faint)]">
          <span>🧙 {demo.hero}</span>
          <span>{demo.turns} turnos</span>
          <span>🖼 {demo.images}</span>
          <span>🧠 {demo.memories} recuerdos</span>
          {demo.ending && <span className="text-[var(--gold)]">final: {ENDING_LABEL[demo.ending]}</span>}
        </p>
      </div>
    </Link>
  );
}

function DemoIndex() {
  const [demos, setDemos] = useState<DemoMeta[] | null>(null);
  useEffect(() => {
    loadDemoIndex().then(setDemos);
  }, []);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/" className="mb-10 inline-block">
        <Logo size="sm" />
      </Link>
      <p className="label">Demo sin key</p>
      <h1 className="mb-3 text-4xl font-semibold">Partidas reales, reproducidas</h1>
      <p className="mb-8 max-w-2xl text-[var(--muted)]">
        Cada una se jugó de verdad con el motor de Aventra y GPT-4.1 mini. La repetición reconstruye el estado turno a turno aplicando el mismo JSON Patch
        que se guardó, con sus tiradas, recuerdos e ilustraciones. No usa la API ni gasta nada.
      </p>
      {demos === null ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton aspect-[4/5]" />
          ))}
        </div>
      ) : demos.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((demo) => (
            <DemoCard key={demo.slug} demo={demo} />
          ))}
        </div>
      ) : (
        <p className="text-[var(--muted)]">No hay demos publicadas.</p>
      )}
    </div>
  );
}

function Replay({ slug }: { slug: string }) {
  const [bundle, setBundle] = useState<AdventureBundle | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [chars, setChars] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [endingOpen, setEndingOpen] = useState(true);

  useEffect(() => {
    loadDemo(slug)
      .then(setBundle)
      .catch((error: Error) => setFailed(error.message));
  }, [slug]);

  const turns = useMemo(() => bundle?.adventure.turns ?? [], [bundle]);
  const states = useMemo(() => (bundle ? replayStates(bundle.adventure) : []), [bundle]);
  const images = useMemo(() => new Map(bundle?.images.map((image) => [image.id, image.dataUrl])), [bundle]);
  const loadImage = useCallback((id: string) => Promise.resolve(images.get(id)), [images]);

  const current = shown > 0 ? turns[shown - 1] : null;
  const full = current?.narration.length ?? 0;
  const typing = !!current && chars < full;

  useEffect(() => {
    if (!bundle || !playing) return;
    let timer: ReturnType<typeof setTimeout>;
    if (shown === 0) timer = setTimeout(() => setShown(1), 500);
    else if (chars === 0) timer = setTimeout(() => setChars(1), current?.check ? 1100 : 300);
    else if (chars < full) timer = setTimeout(() => setChars((c) => Math.min(full, c + 2 * speed)), 16);
    else if (shown < turns.length) {
      timer = setTimeout(() => {
        setShown((n) => n + 1);
        setChars(0);
      }, 2600 / speed);
    } else setPlaying(false);
    return () => clearTimeout(timer);
  }, [bundle, playing, shown, chars, full, speed, turns.length, current]);

  if (failed) {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <div className="frame p-8 text-center">
          <p className="mb-4">{failed}</p>
          <Link className="btn btn-gold" href="/demo">
            Ver demos
          </Link>
        </div>
      </div>
    );
  }
  if (!bundle) return <div className="grid min-h-dvh place-items-center font-pixel text-xs text-[var(--gold)]">CARGANDO PARTIDA…</div>;

  const visible = turns.slice(0, shown).map((turn) =>
    turn === current && typing ? { ...turn, narration: turn.narration.slice(0, chars), image: null, memories: [], warnings: [] } : turn,
  );
  const settled = !typing && shown > 0;
  const state = shown === 0 ? bundle.adventure.initial : settled ? states[shown - 1] : shown > 1 ? states[shown - 2] : bundle.adventure.initial;
  const finished = shown === turns.length && settled;
  const skip = () => {
    if (typing) setChars(full);
    else if (shown < turns.length) {
      setShown(shown + 1);
      setChars(0);
    }
  };

  return (
    <>
      <GameView
        state={state}
        turns={visible}
        loadImage={loadImage}
        animateTurn={chars === 0 || typing ? current?.index ?? null : null}
        typingTurn={typing ? current?.index : null}
        headerRight={
          <span className="mr-2 hidden border-2 border-[var(--arcane)] px-2 py-1 font-pixel text-[0.5rem] text-[var(--arcane)] sm:inline" data-testid="replay-badge">
            REPETICIÓN
          </span>
        }
        footer={
          <div className="frame flex flex-wrap items-center gap-2 p-3" data-testid="replay-controls">
            <button className="btn btn-sm" onClick={() => { setShown(0); setChars(0); setPlaying(true); }} aria-label="Reiniciar">
              ⏮
            </button>
            <button className="btn btn-sm btn-gold min-w-[5.5rem]" onClick={() => setPlaying((p) => !p)} data-testid="replay-toggle">
              {playing ? "❚❚ Pausa" : "▶ Seguir"}
            </button>
            <button className="btn btn-sm" onClick={skip} aria-label="Siguiente" data-testid="replay-next">
              ⏭
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setShown(turns.length);
                setChars(turns.at(-1)?.narration.length ?? 0);
                setPlaying(false);
              }}
              data-testid="replay-all"
            >
              Ver todo
            </button>
            <div className="flex gap-1">
              {[1, 2, 4].map((s) => (
                <button key={s} className="chip-btn" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>
            <span className="ml-auto font-pixel text-[0.55rem] text-[var(--muted)]" data-testid="replay-progress">
              TURNO {Math.max(0, shown - 1)}/{turns.length - 1}
            </span>
            <div className="basis-full border-t-2 border-[var(--line)] pt-2 text-sm text-[var(--muted)]">
              Partida real grabada con {turns[0]?.model}. ¿Quieres escribir la tuya?{" "}
              <Link href="/new" className="text-[var(--gold)] underline-offset-4 hover:underline">
                Crear aventura con tu key →
              </Link>
            </div>
          </div>
        }
      />
      {finished && endingOpen && state.game.over && <GameOver state={state} turns={turns} onClose={() => setEndingOpen(false)} />}
    </>
  );
}

export function DemoScreen() {
  const slug = useSearchParams().get("s");
  return slug ? <Replay key={slug} slug={slug} /> : <DemoIndex />;
}
