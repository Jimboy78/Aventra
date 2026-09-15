"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { DemoCard } from "@/components/screens/DemoScreen";
import { loadDemoIndex, type DemoMeta } from "@/lib/game/demos";
import type { Adventure } from "@/lib/engine/types";
import { db, exportBundle, importBundle, listeners } from "@/lib/store/db";
import { downloadJson, fileSlug } from "@/lib/store/download";

const FEATURES = [
  { icon: "🎲", title: "Dados d20 reales", text: "El motor tira y resuelve el riesgo con CD, dificultad y heridas. La IA narra el resultado, no lo decide." },
  { icon: "🧠", title: "Memoria vectorial", text: "Cada escena y hecho se guarda como embedding; los recuerdos lejanos relevantes vuelven al contexto." },
  { icon: "🧩", title: "Estado con JSON Patch", text: "Salud, inventario, personajes, bestiario y misiones cambian con operaciones auditables y reproducibles." },
  { icon: "🖼️", title: "Ilustraciones de escena", text: "Los momentos clave se pintan en pixel art con gpt-image-1-mini, una cada pocos turnos." },
  { icon: "🔊", title: "Narrador por voz", text: "Síntesis de voz del navegador, gratis y sin conexión extra." },
  { icon: "🔒", title: "Sin servidor", text: "Tu key, tus partidas y tus recuerdos viven en tu navegador. Exporta e importa en JSON." },
];

const PIPELINE = [
  ["Recordar", "embedding de tu acción → top 5 recuerdos por coseno"],
  ["Tirar", "d20 sembrado por partida y turno"],
  ["Narrar", "streaming de salida estructurada con esquema estricto"],
  ["Aplicar", "delta → JSON Patch → nuevo estado"],
  ["Memorizar", "escena + hechos → IndexedDB; resumen cada 6 turnos"],
];

function SavedAdventures() {
  const [adventures, setAdventures] = useState<Adventure[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => db.listAdventures().then(setAdventures).catch(() => setAdventures([]));
    refresh();
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, []);

  const onImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    try {
      await importBundle(JSON.parse(await picked.text()));
      setMessage("Partida importada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo importar.");
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-12" data-testid="saved">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Tus partidas</p>
          <h2 className="text-2xl font-semibold">Guardadas en este navegador</h2>
        </div>
        <div className="flex gap-2">
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={onImport} data-testid="import-input" />
          <button className="btn btn-sm" onClick={() => file.current?.click()}>
            ⤒ Importar JSON
          </button>
        </div>
      </div>
      {message && <p className="mb-4 text-sm text-[var(--gold)]">{message}</p>}
      {adventures.length === 0 ? (
        <p className="border-2 border-dashed border-[var(--line)] p-6 text-center text-[var(--faint)]">Todavía no empezaste ninguna aventura.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {adventures.map((a) => (
            <li key={a.id} className="frame flex flex-wrap items-center gap-3 p-4" data-testid="saved-adventure">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.title}</p>
                <p className="truncate text-sm text-[var(--muted)]">
                  {a.state.game.over ? "🏁 terminada" : `📍 ${a.state.scene.title}`} · turno {a.state.turn} · ❤ {a.state.player.health}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Link className="btn btn-sm btn-gold" href={`/play?id=${a.id}`}>
                  {a.state.game.over ? "Leer" : "Continuar"}
                </Link>
                <button className="btn btn-sm" title="Exportar" onClick={async () => downloadJson(`aventra-${fileSlug(a.title)}.json`, await exportBundle(a.id))}>
                  ⤓
                </button>
                {confirm === a.id ? (
                  <button className="btn btn-sm border-[var(--blood)] text-[var(--blood)]" onClick={() => db.deleteAdventure(a.id)} data-testid="confirm-delete">
                    ¿Borrar?
                  </button>
                ) : (
                  <button className="btn btn-sm" title="Borrar" onClick={() => setConfirm(a.id)}>
                    🗑
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Home() {
  const [demos, setDemos] = useState<DemoMeta[]>([]);
  useEffect(() => {
    loadDemoIndex().then(setDemos);
  }, []);
  const hero = demos[0];

  return (
    <div>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo size="sm" />
        <div className="flex gap-1">
          <Link className="btn btn-ghost btn-sm" href="/demo">
            Demo
          </Link>
          <a className="btn btn-ghost btn-sm" href="https://github.com/Jimboy78/Aventra" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </nav>

      <header className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="rise">
          <p className="mb-6 inline-flex items-center gap-2 border-2 border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--muted)]">
            <span className="h-2 w-2 bg-[var(--jade)] shadow-[0_0_10px_var(--jade)]" /> Rol narrativo con IA · 100% en tu navegador
          </p>
          <h1 className="mb-6 text-[2.6rem] font-bold leading-[1.05] sm:text-6xl">
            Una historia que <span className="text-[var(--gold)]">recuerda</span> cada decisión.
          </h1>
          <p className="font-story mb-8 max-w-xl text-xl leading-relaxed text-[var(--muted)]">
            Creas un héroe y un mundo; un narrador de IA dirige la partida con dados reales, un estado que no se contradice y una memoria que trae de vuelta lo
            que pasó hace veinte turnos.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="btn btn-gold px-6 py-3.5 text-lg" href="/new" data-testid="cta-new">
              ✦ Nueva aventura
            </Link>
            <Link className="btn px-6 py-3.5 text-lg" href={hero ? `/demo?s=${hero.slug}` : "/demo"} data-testid="cta-demo">
              ▶ Ver una partida real
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--faint)]">La demo no necesita key. Para jugar usas tu propia key de OpenAI: nunca pasa por un servidor nuestro.</p>
        </div>

        <div className="relative">
          {hero?.cover ? (
            <Link href={`/demo?s=${hero.slug}`} className="frame frame-gold corners float block p-2" data-testid="hero-demo">
              {/* eslint-disable-next-line @next/next/no-img-element -- static demo cover */}
              <img src={hero.cover} alt={`Ilustración de ${hero.title}`} className="aspect-[3/2] w-full object-cover" />
              <div className="p-4">
                <p className="font-pixel mb-2 text-[0.55rem] text-[var(--gold)]">{hero.world.toUpperCase()}</p>
                <p className="font-story line-clamp-3 text-lg italic text-[#e9e1d2]">“{hero.excerpt}”</p>
              </div>
            </Link>
          ) : (
            <div className="grid place-items-center py-16">
              <Logo size="xl" />
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <p className="label">Qué lo hace distinto</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="frame p-5">
              <p className="mb-3 text-3xl">{feature.icon}</p>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-[var(--muted)]">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <p className="label">Anatomía de un turno</p>
        <ol className="grid gap-3 md:grid-cols-5">
          {PIPELINE.map(([title, text], i) => (
            <li key={title} className="relative border-2 border-[var(--line)] bg-[var(--panel)] p-4">
              <span className="font-pixel text-[0.6rem] text-[var(--ember)]">0{i + 1}</span>
              <p className="mt-2 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {demos.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <p className="label">Demos</p>
          <h2 className="mb-5 text-2xl font-semibold">Partidas grabadas con el motor real</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {demos.map((demo) => (
              <DemoCard key={demo.slug} demo={demo} />
            ))}
          </div>
        </section>
      )}

      <SavedAdventures />

      <footer className="mx-auto max-w-6xl border-t-2 border-[var(--line)] px-4 py-8 text-sm text-[var(--faint)]">
        Aventra · Next.js, AI SDK, OpenAI, IndexedDB · <a className="hover:text-[var(--muted)]" href="https://github.com/Jimboy78/Aventra">código fuente</a>
      </footer>
    </div>
  );
}
