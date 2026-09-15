import { applyOps, escapePointer } from "./patch";
import type { TurnOutput } from "./schema";
import type { GameState, PatchOp } from "./types";

// Turns the narrator's structured delta into JSON Patch ops. Each op is applied to a working
// copy as soon as it is emitted, so array indices in later ops are always valid and
// `applyOps(before, ops)` reproduces `after` exactly (that is how saves are replayed).

export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slug = (text: string) => normalize(text).replace(/ /g, "-").slice(0, 40) || "x";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

function uniqueId(name: string, taken: { id: string }[]) {
  const base = slug(name);
  let id = base;
  for (let n = 2; taken.some((entry) => entry.id === id); n++) id = `${base}-${n}`;
  return id;
}

export function reduceTurn(before: GameState, out: TurnOutput, turn: number) {
  let state = before;
  const ops: PatchOp[] = [];
  const emit = (op: PatchOp) => {
    ops.push(op);
    state = applyOps(state, [op]);
  };
  const find = <T extends { name?: string; title?: string }>(list: T[], name: string) =>
    list.findIndex((entry) => normalize(entry.name ?? entry.title ?? "") === normalize(name));

  if (state.turn !== turn) emit({ op: "replace", path: "/turn", value: turn });

  if (out.scene) {
    const next = { title: out.scene.title.trim(), location: out.scene.location.trim(), mood: out.scene.mood.trim() };
    const same =
      next.title === state.scene.title && next.location === state.scene.location && next.mood === state.scene.mood;
    if (next.title && !same) emit({ op: "replace", path: "/scene", value: next });
  }

  if (out.health_change) {
    const health = clamp(state.player.health + out.health_change, 0, 100);
    if (health !== state.player.health) emit({ op: "replace", path: "/player/health", value: health });
  }
  if (out.gold_change) {
    const gold = Math.max(0, state.player.gold + Math.round(out.gold_change));
    if (gold !== state.player.gold) emit({ op: "replace", path: "/player/gold", value: gold });
  }

  // Removals first so a condition that is "replaced" by a worse one doesn't get deleted after.
  for (const name of out.conditions_remove) {
    const index = find(state.player.conditions, name);
    if (index >= 0) emit({ op: "remove", path: `/player/conditions/${index}` });
  }
  for (const condition of out.conditions_add) {
    if (!condition.name.trim()) continue;
    const index = find(state.player.conditions, condition.name);
    if (index >= 0) {
      const current = state.player.conditions[index];
      if (current.severity !== condition.severity) {
        emit({ op: "replace", path: `/player/conditions/${index}/severity`, value: condition.severity });
      }
    } else {
      emit({
        op: "add",
        path: "/player/conditions/-",
        value: {
          id: uniqueId(condition.name, state.player.conditions),
          name: condition.name.trim(),
          type: condition.type,
          severity: condition.severity,
          since_turn: turn,
        },
      });
    }
  }

  for (const item of out.items_remove) {
    const index = find(state.inventory, item.name);
    if (index < 0) continue;
    const qty = state.inventory[index].qty - Math.max(1, item.qty);
    if (qty > 0) emit({ op: "replace", path: `/inventory/${index}/qty`, value: qty });
    else emit({ op: "remove", path: `/inventory/${index}` });
  }
  for (const item of out.items_add) {
    if (!item.name.trim()) continue;
    const index = find(state.inventory, item.name);
    const qty = Math.max(1, item.qty);
    if (index >= 0) emit({ op: "replace", path: `/inventory/${index}/qty`, value: state.inventory[index].qty + qty });
    else {
      emit({
        op: "add",
        path: "/inventory/-",
        value: { id: uniqueId(item.name, state.inventory), name: item.name.trim(), qty, description: item.description.trim() },
      });
    }
  }

  for (const npc of out.npcs) {
    if (!npc.name.trim() || normalize(npc.name) === normalize(state.player.name)) continue;
    const index = find(state.npcs, npc.name);
    if (index < 0) {
      emit({
        op: "add",
        path: "/npcs/-",
        value: {
          id: uniqueId(npc.name, state.npcs),
          name: npc.name.trim(),
          role: npc.role,
          disposition: clamp(npc.disposition_change, -100, 100),
          notes: npc.notes.trim(),
          alive: npc.alive,
          first_seen_turn: turn,
        },
      });
      continue;
    }
    const current = state.npcs[index];
    const base = `/npcs/${index}`;
    const disposition = clamp(current.disposition + npc.disposition_change, -100, 100);
    if (disposition !== current.disposition) emit({ op: "replace", path: `${base}/disposition`, value: disposition });
    if (npc.role !== current.role) emit({ op: "replace", path: `${base}/role`, value: npc.role });
    if (npc.notes.trim() && npc.notes.trim() !== current.notes) emit({ op: "replace", path: `${base}/notes`, value: npc.notes.trim() });
    if (npc.alive !== current.alive) emit({ op: "replace", path: `${base}/alive`, value: npc.alive });
  }

  for (const monster of out.monsters) {
    if (!monster.name.trim()) continue;
    const index = find(state.monsters, monster.name);
    const threat = clamp(monster.threat_level, 1, 5);
    const health = clamp(monster.health, 0, 100);
    if (index < 0) {
      emit({
        op: "add",
        path: "/monsters/-",
        value: {
          id: uniqueId(monster.name, state.monsters),
          name: monster.name.trim(),
          threat_level: threat,
          health,
          notes: monster.notes.trim(),
          known: monster.known,
          defeated: monster.defeated || health === 0,
        },
      });
      continue;
    }
    const current = state.monsters[index];
    const base = `/monsters/${index}`;
    if (health !== current.health) emit({ op: "replace", path: `${base}/health`, value: health });
    if (threat !== current.threat_level) emit({ op: "replace", path: `${base}/threat_level`, value: threat });
    // Knowledge only grows: once identified, a creature stays identified.
    if (monster.known && !current.known) emit({ op: "replace", path: `${base}/known`, value: true });
    const defeated = current.defeated || monster.defeated || health === 0;
    if (defeated !== current.defeated) emit({ op: "replace", path: `${base}/defeated`, value: defeated });
    if (monster.notes.trim() && monster.notes.trim() !== current.notes) emit({ op: "replace", path: `${base}/notes`, value: monster.notes.trim() });
  }

  for (const quest of out.quests) {
    if (!quest.title.trim()) continue;
    const index = find(state.quests, quest.title);
    if (index < 0) {
      emit({
        op: "add",
        path: "/quests/-",
        value: {
          id: uniqueId(quest.title, state.quests),
          title: quest.title.trim(),
          status: quest.status,
          objective: quest.objective.trim(),
          updated_turn: turn,
        },
      });
      continue;
    }
    const current = state.quests[index];
    if (current.status === quest.status && current.objective === quest.objective.trim()) continue;
    emit({ op: "replace", path: `/quests/${index}`, value: { ...current, status: quest.status, objective: quest.objective.trim() || current.objective, updated_turn: turn } });
  }

  for (const flag of out.flags) {
    const key = flag.key.trim();
    if (!key || state.flags[key] === flag.value) continue;
    emit({ op: key in state.flags ? "replace" : "add", path: `/flags/${escapePointer(key)}`, value: flag.value });
  }

  for (const fact of out.memory_facts.slice(0, 3)) {
    if (!fact.trim()) continue;
    emit({ op: "add", path: "/journal/-", value: { id: `j${turn}-${state.journal.length}`, turn, text: fact.trim() } });
  }

  let ending = out.ending;
  if (!ending && state.player.health === 0) {
    ending = { type: "death", summary: "Tus heridas fueron demasiado graves para seguir adelante.", cause: "Salud agotada" };
  }
  if (ending && !state.game.over) emit({ op: "replace", path: "/game", value: { over: true, ending } });

  return { state, ops };
}
