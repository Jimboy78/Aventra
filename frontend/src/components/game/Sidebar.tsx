"use client";

import { useMemo, useState } from "react";
import { turnCost } from "@/lib/ai/openai";
import type { GameState, Npc, PatchOp, Turn } from "@/lib/engine/types";

const TABS = [
  { id: "heroe", label: "Héroe", paths: ["/player", "/scene"] },
  { id: "mochila", label: "Mochila", paths: ["/inventory"] },
  { id: "gente", label: "Gente", paths: ["/npcs"] },
  { id: "bestiario", label: "Bestiario", paths: ["/monsters"] },
  { id: "misiones", label: "Misiones", paths: ["/quests"] },
  { id: "diario", label: "Diario", paths: ["/journal", "/chapter_summaries"] },
  { id: "memoria", label: "Memoria", paths: [] },
  { id: "motor", label: "Motor", paths: [] },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ITEM_ICONS: [RegExp, string][] = [
  [/espada|sable|hoja/, "⚔️"],
  [/daga|cuchill|puñal/, "🗡️"],
  [/arco|flecha|ballesta/, "🏹"],
  [/escudo/, "🛡️"],
  [/llave/, "🗝️"],
  [/poci|elixir|frasco|vial|tónico/, "🧪"],
  [/antorcha|vela|lámpara|linterna/, "🔥"],
  [/mapa|plano/, "🗺️"],
  [/carta|nota|pergamino|mensaje|documento/, "📜"],
  [/libro|diario|tomo|grimorio/, "📖"],
  [/moneda|oro|créditos/, "💰"],
  [/gema|cristal|joya|rubí|zafiro/, "💎"],
  [/amuleto|colgante|anillo|talismán/, "🧿"],
  [/cuerda|soga/, "➰"],
  [/pan|comida|ración|carne|fruta|queso/, "🍞"],
  [/chip|implante|tarjeta|dispositivo|módulo|drone/, "💾"],
  [/pistola|rifle|arma/, "🔫"],
  [/herramienta|ganzúa|kit/, "🧰"],
  [/brújula/, "🧭"],
];
const iconFor = (name: string) => ITEM_ICONS.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? "✦";

const ROLE_LABEL = { ally: "aliado", npc: "neutral", enemy: "enemigo" } as const;
const QUEST_ICON = { offered: "✉", accepted: "⚑", completed: "✔", failed: "✖" } as const;
const QUEST_LABEL = { offered: "Ofrecida", accepted: "En curso", completed: "Cumplida", failed: "Fallida" } as const;
const STAGE_NAME: Record<string, string> = { recall: "Recordar", narrate: "Narrar", save: "Guardar", memorize: "Memorizar", summary: "Resumir", image: "Ilustrar" };
const CONDITION_COLOR ={ wound: "var(--blood)", status: "var(--sky)", buff: "var(--jade)", debuff: "var(--ember)" } as const;

function attitude(npc: Npc) {
  if (npc.disposition <= -50) return "hostil";
  if (npc.disposition < 0) return "recelosa";
  if (npc.disposition < 25) return "neutral";
  if (npc.disposition < 60) return "amistosa";
  return "leal";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="label">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border-2 border-dashed border-[var(--line)] px-3 py-4 text-center text-sm text-[var(--faint)]">{children}</p>;
}

function Meter({ value, color, label }: { value: number; color: string; label?: string }) {
  return (
    <div className="bar" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, ["--fill" as string]: color }} />
    </div>
  );
}

function opColor(op: PatchOp["op"]) {
  return op === "add" ? "var(--jade)" : op === "remove" ? "var(--blood)" : "var(--gold)";
}

interface SidebarProps {
  state: GameState;
  turns: Turn[];
}

export function Sidebar({ state, turns }: SidebarProps) {
  const [tab, setTab] = useState<TabId>("heroe");
  const [seen, setSeen] = useState<Partial<Record<TabId, number>>>({});
  const [inspect, setInspect] = useState<number | null>(null);
  const last = turns.at(-1);
  const inspected = turns.find((t) => t.index === inspect) ?? last;
  const totals = useMemo(
    () =>
      turns.reduce(
        (acc, t) => ({ cost: acc.cost + t.cost_usd, input: acc.input + t.usage.inputTokens, output: acc.output + t.usage.outputTokens }),
        { cost: 0, input: 0, output: 0 },
      ),
    [turns],
  );

  const changed = (paths: readonly string[]) => !!last && paths.some((p) => last.ops.some((op) => op.path.startsWith(p)));
  const select = (id: TabId) => {
    setTab(id);
    if (last) setSeen((s) => ({ ...s, [id]: last.index }));
  };

  const p = state.player;
  const turnPicker = turns.length > 1 && (
    <select className="field mb-4 py-2 text-sm" value={inspected?.index} onChange={(e) => setInspect(Number(e.target.value))} aria-label="Turno a inspeccionar">
      {[...turns].reverse().map((t) => (
        <option key={t.index} value={t.index}>
          Turno {t.index}
          {t.input ? ` — ${t.input.slice(0, 40)}` : " — apertura"}
        </option>
      ))}
    </select>
  );

  return (
    <div className="frame flex h-full flex-col overflow-hidden" data-testid="sidebar">
      <div role="tablist" className="grid grid-cols-4 border-b-2 border-[var(--line)] px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => select(t.id)}
          >
            {t.label}
            {tab !== t.id && changed(t.paths) && seen[t.id] !== last?.index && <span className="ping" data-testid="tab-ping" />}
          </button>
        ))}
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-4" role="tabpanel">
        {tab === "heroe" && (
          <div data-testid="panel-heroe">
            <div className="mb-5 border-2 border-[var(--line)] bg-[#0f0b17] p-3">
              <p className="font-pixel text-[0.55rem] text-[var(--faint)]">ESCENA</p>
              <p className="mt-1.5 font-semibold text-[var(--gold-2)]" data-testid="scene-title">
                {state.scene.title}
              </p>
              <p className="text-sm text-[var(--muted)]">📍 {state.scene.location}</p>
              <p className="mt-2 inline-block border border-[var(--line-2)] px-2 py-0.5 text-xs text-[var(--muted)]">{state.scene.mood}</p>
            </div>

            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center border-2 border-[var(--gold)] bg-[#2a1d0c] font-pixel text-lg text-[var(--gold)] shadow-[4px_4px_0_#000]">
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{p.name}</p>
                <p className="text-sm text-[var(--muted)]">
                  {p.race} · {p.class}
                </p>
              </div>
            </div>

            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-[var(--muted)]">❤ Salud</span>
              <span className="font-pixel text-[0.62rem]" data-testid="health">
                {p.health}/100
              </span>
            </div>
            <Meter value={p.health} color={p.health > 60 ? "var(--jade)" : p.health > 30 ? "var(--gold)" : "var(--blood)"} label="Salud" />
            <div className="mb-6 mt-3 flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">💰 Oro</span>
              <span className="font-pixel text-[0.62rem] text-[var(--gold)]" data-testid="gold">
                {p.gold}
              </span>
            </div>

            <Section title="Condiciones">
              {p.conditions.length ? (
                <div className="flex flex-wrap gap-2" data-testid="conditions">
                  {p.conditions.map((c) => (
                    <span key={c.id} className="border-2 px-2 py-1 text-xs" style={{ borderColor: CONDITION_COLOR[c.type], color: CONDITION_COLOR[c.type] }}>
                      {c.name} · {c.severity}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--faint)]">Sin heridas ni efectos.</p>
              )}
            </Section>
            <Section title="Rasgos">
              <p className="text-sm text-[var(--muted)]">{p.traits.join(" · ") || "—"}</p>
              {p.backstory && <p className="font-story mt-2 text-[0.95rem] italic text-[var(--muted)]">“{p.backstory}”</p>}
            </Section>
            <Section title="Mundo">
              <p className="text-sm">
                <strong className="text-[var(--gold-2)]">{state.world.name}</strong> · {state.world.genre}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{state.world.description}</p>
              {state.world.rules.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                  {state.world.rules.map((rule) => (
                    <li key={rule}>▸ {rule}</li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}

        {tab === "mochila" && (
          <div data-testid="panel-mochila">
            {state.inventory.length ? (
              <ul className="grid gap-2">
                {state.inventory.map((item) => (
                  <li key={item.id} className="flex gap-3 border-2 border-[var(--line)] bg-[#0f0b17] p-2.5" data-testid="inventory-item">
                    <span className="grid h-10 w-10 shrink-0 place-items-center border-2 border-[var(--line-2)] bg-[#1b1428] text-lg">{iconFor(item.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex justify-between gap-2">
                        <span className="truncate font-medium">{item.name}</span>
                        {item.qty > 1 && <span className="font-pixel text-[0.55rem] text-[var(--gold)]">x{item.qty}</span>}
                      </p>
                      {item.description && <p className="text-xs text-[var(--muted)]">{item.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>La mochila está vacía.</Empty>
            )}
          </div>
        )}

        {tab === "gente" && (
          <div data-testid="panel-gente">
            {state.npcs.length ? (
              <ul className="grid gap-3">
                {state.npcs.map((npc) => (
                  <li key={npc.id} className={`border-2 border-[var(--line)] bg-[#0f0b17] p-3 ${npc.alive ? "" : "opacity-50"}`} data-testid="npc">
                    <p className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {npc.alive ? "" : "✝ "}
                        {npc.name}
                      </span>
                      <span className="text-xs uppercase tracking-wide" style={{ color: npc.role === "enemy" ? "var(--blood)" : npc.role === "ally" ? "var(--jade)" : "var(--muted)" }}>
                        {ROLE_LABEL[npc.role]}
                      </span>
                    </p>
                    {npc.notes && <p className="mt-1 text-sm text-[var(--muted)]">{npc.notes}</p>}
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--faint)]">
                      <div className="relative h-2 flex-1 border border-[var(--line)] bg-[#0b0812]">
                        <span className="absolute left-1/2 top-0 h-full w-px bg-[var(--line-2)]" />
                        <span
                          className="absolute top-0 h-full transition-all duration-700"
                          style={{
                            left: npc.disposition >= 0 ? "50%" : `${50 + npc.disposition / 2}%`,
                            width: `${Math.abs(npc.disposition) / 2}%`,
                            background: npc.disposition >= 0 ? "var(--jade)" : "var(--blood)",
                          }}
                        />
                      </div>
                      <span className="w-16 text-right">{attitude(npc)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Todavía no conociste a nadie importante.</Empty>
            )}
          </div>
        )}

        {tab === "bestiario" && (
          <div data-testid="panel-bestiario">
            {state.monsters.length ? (
              <ul className="grid gap-3">
                {state.monsters.map((m) => (
                  <li key={m.id} className="relative overflow-hidden border-2 border-[var(--line)] bg-[#0f0b17] p-3" data-testid="monster" data-known={m.known}>
                    <p className="flex items-center justify-between gap-2">
                      <span className="font-medium">{m.known ? m.name : "Criatura desconocida"}</span>
                      <span className="text-xs text-[var(--blood)]" title="Amenaza">
                        {m.known ? "☠".repeat(m.threat_level) : "☠ ?"}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{m.known ? m.notes || "—" : "Aún no sabes qué es. Observa, investiga o sobrevive para descubrirlo."}</p>
                    {m.known && (
                      <div className="mt-2">
                        <Meter value={m.health} color="var(--blood)" label={`Salud de ${m.name}`} />
                      </div>
                    )}
                    {m.defeated && (
                      <span className="stamp absolute right-2 top-7 border-2 border-[var(--jade)] px-2 py-0.5 font-pixel text-[0.5rem] text-[var(--jade)]">DERROTADA</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Ninguna criatura registrada… por ahora.</Empty>
            )}
          </div>
        )}

        {tab === "misiones" && (
          <div data-testid="panel-misiones">
            {state.quests.length ? (
              <ul className="grid gap-3">
                {[...state.quests]
                  .sort((a, b) => b.updated_turn - a.updated_turn)
                  .map((q) => (
                    <li key={q.id} className="border-2 border-[var(--line)] bg-[#0f0b17] p-3" data-testid="quest" data-status={q.status}>
                      <p className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${q.status === "completed" || q.status === "failed" ? "text-[var(--muted)] line-through decoration-2" : ""}`}>{q.title}</span>
                        <span className="shrink-0 text-xs text-[var(--gold)]">
                          {QUEST_ICON[q.status]} {QUEST_LABEL[q.status]}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{q.objective}</p>
                    </li>
                  ))}
              </ul>
            ) : (
              <Empty>Sin misiones. Habla con la gente o sigue un rumor.</Empty>
            )}
          </div>
        )}

        {tab === "diario" && (
          <div data-testid="panel-diario">
            {state.chapter_summaries.map((c) => (
              <Section key={c.chapter} title={`Capítulo ${c.chapter}`}>
                <p className="font-story text-[0.98rem] leading-relaxed text-[var(--muted)]">{c.summary}</p>
              </Section>
            ))}
            <Section title="Hechos recordados">
              {state.journal.length ? (
                <ol className="space-y-2">
                  {[...state.journal].reverse().map((entry) => (
                    <li key={entry.id} className="flex gap-3 text-sm" data-testid="journal-entry">
                      <span className="font-pixel mt-0.5 shrink-0 text-[0.5rem] text-[var(--faint)]">T{entry.turn}</span>
                      <span>{entry.text}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty>El diario se llena con los hechos importantes de la historia.</Empty>
              )}
            </Section>
          </div>
        )}

        {tab === "memoria" && (
          <div data-testid="panel-memoria">
            <p className="mb-4 text-sm text-[var(--muted)]">
              Cada turno se guarda como embedding. Antes de narrar, tu acción se compara por similitud coseno con los recuerdos fuera de los últimos 3 turnos y los más cercanos vuelven al contexto.
            </p>
            {turnPicker}
            {inspected && inspected.input ? (
              inspected.memories.length ? (
                <ul className="grid gap-2">
                  {inspected.memories.map((m) => (
                    <li key={m.id} className="border-2 border-[var(--line)] bg-[#0f0b17] p-2.5" data-testid="memory-item">
                      <div className="mb-1.5 flex items-center gap-2 text-xs">
                        <span className="font-pixel text-[0.5rem] text-[var(--arcane)]">{m.kind === "chapter" ? "CAPÍTULO" : m.kind === "fact" ? "HECHO" : "ESCENA"}</span>
                        <span className="text-[var(--faint)]">turno {m.turn}</span>
                        <span className="ml-auto font-mono text-[var(--gold)]">{m.score.toFixed(3)}</span>
                      </div>
                      <Meter value={m.score * 100} color="var(--arcane)" />
                      <p className="mt-2 text-sm text-[var(--muted)]">{m.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>En este turno no hizo falta memoria lejana: el contexto reciente alcanzó.</Empty>
              )
            ) : (
              <Empty>La apertura no consulta la memoria.</Empty>
            )}
          </div>
        )}

        {tab === "motor" && (
          <div data-testid="panel-motor">
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Turnos", String(turns.length)],
                ["Tokens", `${((totals.input + totals.output) / 1000).toFixed(1)}k`],
                ["Costo", `$${totals.cost.toFixed(3)}`],
              ].map(([k, v]) => (
                <div key={k} className="border-2 border-[var(--line)] bg-[#0f0b17] py-2">
                  <p className="font-pixel text-[0.62rem] text-[var(--gold)]">{v}</p>
                  <p className="mt-1 text-xs text-[var(--faint)]">{k}</p>
                </div>
              ))}
            </div>
            {turnPicker}
            {inspected ? (
              <>
                <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-[var(--faint)]">Modelo</dt>
                  <dd className="text-right">{inspected.model}</dd>
                  <dt className="text-[var(--faint)]">Tirada</dt>
                  <dd className="text-right">{inspected.check ? `${inspected.check.roll} → ${inspected.check.outcome}` : "sin tirada"}</dd>
                  <dt className="text-[var(--faint)]">Primer token</dt>
                  <dd className="text-right">{inspected.timing.first_token_ms} ms</dd>
                  <dt className="text-[var(--faint)]">Total narración</dt>
                  <dd className="text-right">{inspected.timing.total_ms} ms</dd>
                  <dt className="text-[var(--faint)]">Tokens in / out</dt>
                  <dd className="text-right">
                    {inspected.usage.inputTokens} / {inspected.usage.outputTokens}
                  </dd>
                  <dt className="text-[var(--faint)]">Costo narración</dt>
                  <dd className="text-right">${turnCost(inspected.model, inspected.usage).toFixed(4)}</dd>
                  <dt className="text-[var(--faint)]">Costo turno</dt>
                  <dd className="text-right">${inspected.cost_usd.toFixed(4)}</dd>
                </dl>
                {inspected.timing.stages && (
                  <div className="mb-4" data-testid="stage-timings">
                    <h3 className="label">Tiempo por etapa</h3>
                    {Object.entries(inspected.timing.stages).map(([name, ms]) => (
                      <div key={name} className="mb-1.5 grid grid-cols-[5.5rem_1fr_4rem] items-center gap-2 text-xs">
                        <span className="text-[var(--muted)]">{STAGE_NAME[name] ?? name}</span>
                        <Meter value={(ms / Math.max(...Object.values(inspected.timing.stages ?? {}), 1)) * 100} color="var(--sky)" />
                        <span className="text-right font-mono">{(ms / 1000).toFixed(1)} s</span>
                      </div>
                    ))}
                  </div>
                )}
                <h3 className="label">JSON Patch aplicado ({inspected.ops.length})</h3>
                {inspected.ops.length ? (
                  <ol className="scroll-thin max-h-72 space-y-1 overflow-auto border-2 border-[var(--line)] bg-[#08060c] p-2 font-mono text-[0.72rem]" data-testid="ops">
                    {inspected.ops.map((op, i) => (
                      <li key={i} className="break-all">
                        <span style={{ color: opColor(op.op) }}>{op.op.padEnd(7)}</span> <span className="text-[var(--sky)]">{op.path}</span>
                        {"value" in op && <span className="text-[var(--muted)]"> {JSON.stringify(op.value).slice(0, 90)}</span>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Empty>Este turno no cambió el estado.</Empty>
                )}
                {inspected.image_prompt && (
                  <p className="mt-3 text-xs text-[var(--faint)]">
                    <span className="text-[var(--muted)]">image_prompt:</span> {inspected.image_prompt}
                  </p>
                )}
              </>
            ) : (
              <Empty>Todavía no se jugó ningún turno.</Empty>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-[var(--muted)]">Estado completo (JSON)</summary>
              <pre className="scroll-thin mt-2 max-h-80 overflow-auto border-2 border-[var(--line)] bg-[#08060c] p-2 text-[0.7rem] text-[var(--muted)]">{JSON.stringify(state, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
