import { createOpenAI } from "@ai-sdk/openai";
import { generateText, jsonSchema, streamObject, type JSONSchema7 } from "ai";
import { turnOutputJsonSchema, turnOutputSchema, type TurnOutput } from "@/lib/engine/schema";

const turnSchema = jsonSchema<TurnOutput>(turnOutputJsonSchema as JSONSchema7, {
  validate: (value) => {
    const parsed = turnOutputSchema.safeParse(value);
    return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error };
  },
});

// Bring-your-own-key: the browser talks to OpenAI directly with the player's key. There is no
// Aventra server in the middle, so the key never reaches anyone else and the demo costs nothing.

const KEY = "aventra.openai-key";

export const MODELS = [
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini", note: "rápido y barato (recomendado)" },
  { id: "gpt-4.1", label: "GPT-4.1", note: "mejor prosa, ~5× costo" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 nano", note: "el más barato" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

/** USD per 1M tokens (input, output) for the cost counter. */
export const PRICES: Record<string, [number, number]> = {
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1": [2, 8],
  "gpt-4.1-nano": [0.1, 0.4],
};
export const IMAGE_MODEL = "gpt-image-1-mini";
export const IMAGE_PRICE = 0.006;

const read = (store: Storage | undefined) => {
  try {
    return store?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
};

export const keyStore = {
  get: () => (typeof window === "undefined" ? null : read(window.sessionStorage) ?? read(window.localStorage)),
  set(key: string, remember: boolean) {
    this.clear();
    try {
      (remember ? localStorage : sessionStorage).setItem(KEY, key.trim());
    } catch {
      /* storage blocked: key lives only for this page */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

export async function validateKey(key: string) {
  const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key.trim()}` } });
  if (res.status === 401) throw new Error("La key no es válida.");
  if (!res.ok) throw new Error(`OpenAI respondió ${res.status}.`);
  const { data } = (await res.json()) as { data: { id: string }[] };
  return data.some((model) => model.id === "gpt-4.1-mini");
}

const provider = (key: string) => createOpenAI({ apiKey: key });

export function describeError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (/401|invalid api key|incorrect api key/i.test(text)) return "OpenAI rechazó la key. Revísala en Ajustes.";
  if (/429|quota|rate limit/i.test(text)) return "Tu cuenta de OpenAI llegó al límite de uso o de velocidad. Espera un momento o revisa tu saldo.";
  if (/failed to fetch|network/i.test(text)) return "No se pudo conectar con OpenAI. Revisa tu conexión.";
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

export async function narrateTurn(options: {
  key: string;
  model: string;
  system: string;
  prompt: string;
  signal?: AbortSignal;
  onPartial: (partial: Partial<TurnOutput>) => void;
}) {
  const started = performance.now();
  let firstToken = 0;
  let failure: unknown = null;
  const result = streamObject({
    model: provider(options.key).responses(options.model),
    schema: turnSchema,
    schemaName: "turno_aventra",
    system: options.system,
    prompt: options.prompt,
    temperature: 0.85,
    maxRetries: 1,
    abortSignal: options.signal,
    providerOptions: { openai: { strictJsonSchema: true } },
    onError: ({ error }) => {
      failure = error;
    },
  });
  for await (const partial of result.partialObjectStream) {
    if (!firstToken) firstToken = performance.now() - started;
    options.onPartial(partial as Partial<TurnOutput>);
  }
  if (failure) throw failure;
  const object = await result.object;
  const usage = await result.usage;
  return {
    object,
    usage: { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 },
    timing: { total_ms: Math.round(performance.now() - started), first_token_ms: Math.round(firstToken) },
  };
}

export async function summarize(key: string, model: string, prompt: string) {
  const { text, usage } = await generateText({ model: provider(key).responses(model), prompt, temperature: 0.3, maxRetries: 1 });
  return { text: text.trim(), usage: { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 } };
}

export async function embed(key: string, texts: string[]) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: 512 }),
  });
  if (!res.ok) throw new Error(`Embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { data, usage } = (await res.json()) as { data: { embedding: number[]; index: number }[]; usage: { prompt_tokens: number } };
  return { vectors: data.sort((a, b) => a.index - b.index).map((d) => d.embedding), tokens: usage.prompt_tokens };
}

/** Scene illustration with gpt-image-1-mini, re-encoded to WebP so saves stay small. */
export async function illustrate(key: string, prompt: string, style: string, signal?: AbortSignal) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: `${prompt}. Style: ${style}. Wide cinematic composition, no text, no letters, no UI.`,
      size: "1536x1024",
      quality: "low",
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`Imagen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { data } = (await res.json()) as { data: { b64_json: string }[] };
  return toWebp(`data:image/png;base64,${data[0].b64_json}`, 1024);
}

async function toWebp(src: string, width: number) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((image.naturalHeight / image.naturalWidth) * width);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.82);
}

export function turnCost(model: string, usage: { inputTokens: number; outputTokens: number }) {
  const [input, output] = PRICES[model] ?? PRICES["gpt-4.1-mini"];
  return (usage.inputTokens * input + usage.outputTokens * output) / 1_000_000;
}
