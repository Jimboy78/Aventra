import type { Adventure, MemoryRecord } from "@/lib/engine/types";

// Local-first persistence: adventures, their vector memories and scene illustrations live in
// the player's IndexedDB. Nothing is sent to a server we run.

const DB_NAME = "aventra";
const DB_VERSION = 1;

export interface StoredImage {
  id: string;
  adventureId: string;
  dataUrl: string;
  prompt: string;
}

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("adventures", { keyPath: "id" });
      db.createObjectStore("memories", { keyPath: "id" }).createIndex("adventureId", "adventureId");
      db.createObjectStore("images", { keyPath: "id" }).createIndex("adventureId", "adventureId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

type StoreName = "adventures" | "memories" | "images";

async function run<T>(store: StoreName, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = work(tx.objectStore(store));
    tx.oncomplete = () => resolve((request ? request.result : undefined) as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const byAdventure = <T>(store: StoreName, adventureId: string) =>
  run<T[]>(store, "readonly", (s) => s.index("adventureId").getAll(adventureId));

export const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const db = {
  async listAdventures() {
    const all = await run<Adventure[]>("adventures", "readonly", (s) => s.getAll());
    return all.sort((a, b) => b.updated_at - a.updated_at);
  },
  getAdventure: (id: string) => run<Adventure | undefined>("adventures", "readonly", (s) => s.get(id)),
  async putAdventure(adventure: Adventure) {
    await run("adventures", "readwrite", (s) => s.put(adventure));
    notify();
  },
  async deleteAdventure(id: string) {
    await run("adventures", "readwrite", (s) => s.delete(id));
    for (const store of ["memories", "images"] as const) {
      const rows = await byAdventure<{ id: string }>(store, id);
      await run(store, "readwrite", (s) => rows.forEach((row) => s.delete(row.id)));
    }
    notify();
  },
  memories: (adventureId: string) => byAdventure<MemoryRecord>("memories", adventureId),
  putMemories: (records: MemoryRecord[]) => run("memories", "readwrite", (s) => records.forEach((r) => s.put(r))),
  images: (adventureId: string) => byAdventure<StoredImage>("images", adventureId),
  getImage: (id: string) => run<StoredImage | undefined>("images", "readonly", (s) => s.get(id)),
  putImage: (image: StoredImage) => run("images", "readwrite", (s) => s.put(image)),
};

/** Portable save: the adventure plus its memories and illustrations in one JSON file. */
export interface AdventureBundle {
  format: "aventra-save";
  version: 1;
  adventure: Adventure;
  memories: MemoryRecord[];
  images: StoredImage[];
}

export async function exportBundle(id: string): Promise<AdventureBundle> {
  const adventure = await db.getAdventure(id);
  if (!adventure) throw new Error("Aventura no encontrada");
  return { format: "aventra-save", version: 1, adventure, memories: await db.memories(id), images: await db.images(id) };
}

export function isBundle(value: unknown): value is AdventureBundle {
  const bundle = value as AdventureBundle;
  return bundle?.format === "aventra-save" && !!bundle.adventure?.id && Array.isArray(bundle.adventure.turns);
}

export async function importBundle(bundle: AdventureBundle) {
  if (!isBundle(bundle)) throw new Error("El archivo no es una partida de Aventra");
  await db.putMemories(bundle.memories);
  for (const image of bundle.images) await db.putImage(image);
  await db.putAdventure({ ...bundle.adventure, updated_at: Date.now() });
  return bundle.adventure.id;
}
