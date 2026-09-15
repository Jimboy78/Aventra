"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Composer } from "@/components/game/Composer";
import { GameOver } from "@/components/game/GameOver";
import { GameView } from "@/components/game/GameView";
import type { StreamingTurn } from "@/components/game/StoryFeed";
import { KeyDialog } from "@/components/KeyDialog";
import { useSettings } from "@/hooks/useSettings";
import { useVoice } from "@/hooks/useVoice";
import { describeError, keyStore } from "@/lib/ai/openai";
import type { Adventure, Risk } from "@/lib/engine/types";
import { playTurn, type Stage } from "@/lib/game/engine";
import { db, exportBundle } from "@/lib/store/db";
import { downloadJson, fileSlug } from "@/lib/store/download";

const loadImage = (id: string) => db.getImage(id).then((image) => image?.dataUrl);

export function PlayScreen() {
  const id = useSearchParams().get("id");
  const [settings, updateSettings] = useSettings();
  const speak = useVoice(settings.voice);
  const [adventure, setAdventure] = useState<Adventure | null | undefined>(undefined);
  const [hasKey, setHasKey] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [streaming, setStreaming] = useState<StreamingTurn | null>(null);
  const [error, setError] = useState<{ message: string; input: string | null; risk: Risk | null } | null>(null);
  const [freshTurn, setFreshTurn] = useState<number | null>(null);
  const [endingOpen, setEndingOpen] = useState(true);
  const abort = useRef<AbortController | null>(null);
  const introRequested = useRef(false);

  useEffect(() => setHasKey(!!keyStore.get()), []);
  useEffect(() => {
    if (!id) return setAdventure(null);
    db.getAdventure(id).then((found) => setAdventure(found ?? null));
  }, [id]);
  useEffect(() => () => abort.current?.abort(), []);

  const play = useCallback(
    async (input: string | null, risk: Risk | null) => {
      if (!adventure || busy) return;
      const apiKey = keyStore.get();
      if (!apiKey) {
        setKeyOpen(true);
        return;
      }
      const controller = new AbortController();
      abort.current = controller;
      setBusy(true);
      setError(null);
      setStreaming({ input, risk, narration: "" });
      let first = true;
      try {
        await playTurn({
          adventure,
          input,
          chosenRisk: risk,
          settings,
          apiKey,
          signal: controller.signal,
          onStage: setStage,
          onPartial: (partial) => setStreaming((s) => (s && partial.narration ? { ...s, narration: partial.narration } : s)),
          onSaved: (next) => {
            setAdventure(next);
            if (!first) return;
            first = false;
            setStreaming(null);
            const turn = next.turns[next.turns.length - 1];
            setFreshTurn(turn.index);
            speak(turn.narration);
          },
        });
      } catch (failure) {
        if (!controller.signal.aborted) setError({ message: describeError(failure), input, risk });
        setStreaming(null);
        setStage(null);
      } finally {
        setBusy(false);
      }
    },
    [adventure, busy, settings, speak],
  );

  useEffect(() => {
    if (adventure && adventure.turns.length === 0 && hasKey && !introRequested.current) {
      introRequested.current = true;
      play(null, null);
    }
  }, [adventure, hasKey, play]);

  if (adventure === undefined) {
    return <div className="grid min-h-dvh place-items-center font-pixel text-xs text-[var(--gold)]">CARGANDO…</div>;
  }
  if (adventure === null) {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <div className="frame max-w-md p-8 text-center">
          <p className="mb-4 text-lg">No encontramos esa partida en este navegador.</p>
          <Link className="btn btn-gold" href="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const exportAdventure = async () => downloadJson(`aventra-${fileSlug(adventure.title)}.json`, await exportBundle(adventure.id));
  const last = adventure.turns.at(-1);
  const total = adventure.turns.reduce((sum, t) => sum + t.cost_usd, 0);
  const over = adventure.state.game.over;

  return (
    <>
      <GameView
        state={adventure.state}
        turns={adventure.turns}
        streaming={streaming}
        stage={stage}
        loadImage={loadImage}
        animateTurn={freshTurn}
        headerRight={
          <>
            <span className="mr-2 hidden font-mono text-xs text-[var(--faint)] sm:inline" title="Gasto en tu cuenta de OpenAI" data-testid="cost">
              ${total.toFixed(3)}
            </span>
            <button className="btn btn-ghost btn-sm" aria-pressed={settings.voice} title="Narrador por voz" onClick={() => updateSettings({ voice: !settings.voice })}>
              {settings.voice ? "🔊" : "🔈"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              aria-pressed={settings.images}
              title={settings.images ? "Ilustraciones activadas" : "Ilustraciones desactivadas"}
              onClick={() => updateSettings({ images: !settings.images })}
              data-testid="toggle-images"
            >
              {settings.images ? "🖼️" : "▫️"}
            </button>
            <button className="btn btn-ghost btn-sm" title="Exportar partida" onClick={exportAdventure} data-testid="export">
              ⤓
            </button>
            <button className="btn btn-ghost btn-sm" title="Cambiar key de OpenAI" onClick={() => setKeyOpen(true)}>
              🔑
            </button>
          </>
        }
        banner={
          <>
            {!hasKey && (
              <div className="frame frame-gold mb-6 p-5" data-testid="need-key">
                <p className="mb-3">Para que el narrador continúe esta historia necesitas conectar tu key de OpenAI.</p>
                <button className="btn btn-gold" onClick={() => setKeyOpen(true)}>
                  Conectar key
                </button>
              </div>
            )}
            {error && (
              <div role="alert" className="mb-6 border-2 border-[var(--blood)] bg-[#ff5d6c12] p-4" data-testid="turn-error">
                <p className="mb-3 text-[#ffc2c8]">{error.message}</p>
                <button className="btn btn-sm" onClick={() => play(error.input, error.risk)}>
                  Reintentar
                </button>
              </div>
            )}
          </>
        }
        footer={
          over ? (
            <div className="frame p-4 text-center">
              <p className="mb-3 text-[var(--muted)]">La historia terminó.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn" onClick={() => setEndingOpen(true)}>
                  Ver final
                </button>
                <Link className="btn btn-gold" href="/new">
                  Nueva aventura
                </Link>
              </div>
            </div>
          ) : adventure.turns.length > 0 || streaming ? (
            <Composer actions={busy ? [] : last?.actions ?? []} disabled={busy || !hasKey} stage={stage} onSend={play} />
          ) : null
        }
      />
      {over && endingOpen && <GameOver state={adventure.state} turns={adventure.turns} onClose={() => setEndingOpen(false)} onExport={exportAdventure} />}
      <KeyDialog
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        onSaved={() => {
          setKeyOpen(false);
          setHasKey(true);
        }}
      />
    </>
  );
}
