"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KeyDialog } from "@/components/KeyDialog";
import { Logo } from "@/components/Logo";
import { useSettings } from "@/hooks/useSettings";
import { keyStore, MODELS } from "@/lib/ai/openai";
import type { Difficulty, World } from "@/lib/engine/types";
import { createAdventure } from "@/lib/game/engine";
import { CLASSES, DIFFICULTIES, initialState, RACES, TRAITS, WORLD_PRESETS } from "@/lib/game/presets";
import { db } from "@/lib/store/db";

const NAMES = ["Lyra Venn", "Tomás Grieta", "Ilse Morrow", "Kael Duarte", "Nadia Ferro", "Oren Salt", "Mira Kestrel", "Bruno Ceniza"];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="frame mb-6 p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center border-2 border-[var(--gold)] font-pixel text-xs text-[var(--gold)]">{n}</span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function NewAdventure() {
  const router = useRouter();
  const [settings, updateSettings] = useSettings();
  const [presetId, setPresetId] = useState<string | null>(WORLD_PRESETS[0].id);
  const [world, setWorld] = useState<World>(() => {
    const { name, genre, description, tone, rules } = WORLD_PRESETS[0];
    return { name, genre, description, tone, rules };
  });
  const [name, setName] = useState("");
  const [race, setRace] = useState(RACES[1]);
  const [klass, setKlass] = useState(CLASSES[2]);
  const [traits, setTraits] = useState<string[]>([]);
  const [backstory, setBackstory] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("balanced");
  const [keyOpen, setKeyOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => setHasKey(!!keyStore.get()), []);

  const pickPreset = (id: string | null) => {
    setPresetId(id);
    const preset = WORLD_PRESETS.find((p) => p.id === id);
    setWorld(preset ? { name: preset.name, genre: preset.genre, description: preset.description, tone: preset.tone, rules: preset.rules } : { name: "", genre: "", description: "", tone: "", rules: [] });
  };
  const editWorld = (patch: Partial<World>) => {
    setPresetId(null);
    setWorld((w) => ({ ...w, ...patch }));
  };

  const problems = [
    !name.trim() && "ponle nombre a tu héroe",
    !world.name.trim() && "nombra el mundo",
    !world.genre.trim() && "elige un género",
    world.description.trim().length < 20 && "describe el mundo en una frase",
  ].filter(Boolean) as string[];

  const start = async () => {
    if (problems.length) return;
    if (!keyStore.get()) {
      setKeyOpen(true);
      return;
    }
    setStarting(true);
    const adventure = createAdventure(
      initialState(
        { ...world, name: world.name.trim(), rules: world.rules.map((r) => r.trim()).filter(Boolean) },
        { name: name.trim(), race: race.trim() || "Humano", class: klass.trim() || "Aventurero", traits, backstory: backstory.trim() },
        difficulty,
      ),
    );
    await db.putAdventure(adventure);
    router.push(`/play?id=${adventure.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-10 flex items-center justify-between">
        <Link href="/">
          <Logo size="sm" />
        </Link>
        <Link className="btn btn-ghost btn-sm" href="/demo">
          Ver demo
        </Link>
      </div>
      <p className="label">Nueva aventura</p>
      <h1 className="mb-8 text-4xl font-semibold">Forja un mundo y a quien lo va a recorrer</h1>

      <Step n={1} title="El mundo">
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {WORLD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => pickPreset(preset.id)}
              aria-pressed={presetId === preset.id}
              data-testid={`preset-${preset.id}`}
              className="relative overflow-hidden border-2 border-[var(--line)] p-4 text-left transition hover:border-[var(--line-2)] aria-pressed:border-[var(--gold)] aria-pressed:shadow-[0_0_0_2px_var(--gold)]"
              style={{ background: `linear-gradient(135deg, ${preset.palette[0]}26, ${preset.palette[1]}14 60%, transparent)` }}
            >
              <span className="text-2xl">{preset.emoji}</span>
              <p className="mt-2 font-semibold">{preset.name}</p>
              <p className="text-xs uppercase tracking-wide" style={{ color: preset.palette[0] }}>
                {preset.genre}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{preset.description}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="world-name">
              Nombre
            </label>
            <input id="world-name" className="field" value={world.name} onChange={(e) => editWorld({ name: e.target.value })} placeholder="Las Tierras Rotas" />
          </div>
          <div>
            <label className="label" htmlFor="world-genre">
              Género
            </label>
            <input id="world-genre" className="field" value={world.genre} onChange={(e) => editWorld({ genre: e.target.value })} placeholder="Fantasía, western, horror cósmico…" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="world-desc">
              Descripción
            </label>
            <textarea id="world-desc" className="field" rows={2} value={world.description} onChange={(e) => editWorld({ description: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="world-tone">
              Tono
            </label>
            <input id="world-tone" className="field" value={world.tone} onChange={(e) => editWorld({ tone: e.target.value })} placeholder="oscuro, humorístico, épico…" />
          </div>
          <div>
            <label className="label" htmlFor="world-rules">
              Reglas (una por línea)
            </label>
            <textarea id="world-rules" className="field" rows={2} value={world.rules.join("\n")} onChange={(e) => editWorld({ rules: e.target.value.split("\n") })} />
          </div>
        </div>
      </Step>

      <Step n={2} title="Tu héroe">
        <label className="label" htmlFor="hero-name">
          Nombre
        </label>
        <div className="mb-5 flex gap-2">
          <input id="hero-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="¿Cómo te llaman?" data-testid="hero-name" maxLength={40} />
          <button type="button" className="btn" title="Sugerir nombre" onClick={() => setName(NAMES[Math.floor(Math.random() * NAMES.length)])}>
            🎲
          </button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ["Especie", RACES, race, setRace],
              ["Oficio", CLASSES, klass, setKlass],
            ] as const
          ).map(([label, options, value, set]) => (
            <div key={label}>
              <p className="label">{label}</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {options.map((option) => (
                  <button key={option} type="button" className="chip-btn" aria-pressed={value === option} onClick={() => set(option)}>
                    {option}
                  </button>
                ))}
              </div>
              <input className="field py-2 text-sm" value={value} onChange={(e) => set(e.target.value)} aria-label={`${label} personalizada`} maxLength={30} />
            </div>
          ))}
        </div>
        <p className="label mt-5">Rasgos (hasta 3)</p>
        <div className="mb-5 flex flex-wrap gap-1.5">
          {TRAITS.map((trait) => (
            <button
              key={trait}
              type="button"
              className="chip-btn"
              aria-pressed={traits.includes(trait)}
              onClick={() => setTraits((t) => (t.includes(trait) ? t.filter((x) => x !== trait) : t.length < 3 ? [...t, trait] : t))}
            >
              {trait}
            </button>
          ))}
        </div>
        <label className="label" htmlFor="hero-back">
          Trasfondo (opcional)
        </label>
        <textarea
          id="hero-back"
          className="field"
          rows={2}
          maxLength={400}
          value={backstory}
          onChange={(e) => setBackstory(e.target.value)}
          placeholder="Una deuda, un secreto, alguien a quien buscas…"
        />
      </Step>

      <Step n={3} title="Reglas de la mesa">
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={difficulty === d.id}
              onClick={() => setDifficulty(d.id)}
              className="border-2 border-[var(--line)] bg-[#0f0b17] p-3 text-left aria-pressed:border-[var(--gold)]"
            >
              <p className="font-semibold">{d.label}</p>
              <p className="text-sm text-[var(--muted)]">{d.hint}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="model">
              Modelo narrador
            </label>
            <select id="model" className="field" value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.note}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-3 self-end border-2 border-[var(--line)] bg-[#0f0b17] p-3">
            <input type="checkbox" checked={settings.images} onChange={(e) => updateSettings({ images: e.target.checked })} className="h-4 w-4 accent-[var(--gold)]" />
            <span>
              Ilustrar escenas clave
              <span className="block text-xs text-[var(--muted)]">~US$0.006 por imagen, como máximo 1 cada 3 turnos</span>
            </span>
          </label>
        </div>
      </Step>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[var(--muted)]">
          {problems.length ? `Falta: ${problems.join(", ")}.` : hasKey ? "Todo listo. El narrador está esperando." : "Al comenzar te pediremos tu key de OpenAI."}
        </p>
        <button className="btn btn-gold px-7 py-4 text-lg" disabled={problems.length > 0 || starting} onClick={start} data-testid="start-adventure">
          {starting ? "Abriendo el libro…" : "Comenzar aventura ✦"}
        </button>
      </div>

      <KeyDialog
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        onSaved={() => {
          setKeyOpen(false);
          setHasKey(true);
          start();
        }}
      />
    </div>
  );
}
