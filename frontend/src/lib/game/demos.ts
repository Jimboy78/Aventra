import type { EndingType } from "@/lib/engine/types";
import type { AdventureBundle } from "@/lib/store/db";

// Public demo = adventures really played with the engine and exported as saves. Replaying them
// needs no API key and makes no network calls besides these static files.

export interface DemoMeta {
  slug: string;
  title: string;
  world: string;
  genre: string;
  hero: string;
  turns: number;
  chapters: number;
  ending: EndingType | null;
  cover: string | null;
  excerpt: string;
  palette: [string, string];
  model: string;
  images: number;
  memories: number;
}

export async function loadDemoIndex(): Promise<DemoMeta[]> {
  try {
    const res = await fetch("/demos/index.json");
    if (!res.ok) return [];
    return ((await res.json()) as { demos: DemoMeta[] }).demos;
  } catch {
    return [];
  }
}

export async function loadDemo(slug: string): Promise<AdventureBundle> {
  const res = await fetch(`/demos/${encodeURIComponent(slug)}.json`);
  if (!res.ok) throw new Error("No se encontró esa demo.");
  return res.json();
}
