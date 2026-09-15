import { z } from "zod";

// Structured output the narrator returns every turn. Every field is required (nullable or
// empty arrays instead of optional) so it works with OpenAI strict JSON schema, and
// `narration` goes first so it can be streamed to the reader while the rest arrives.
export const turnOutputSchema = z.strictObject({
  narration: z
    .string()
    .describe("Narración visible en segunda persona, 2 a 4 párrafos cortos en Markdown simple."),
  risk_assessed: z
    .enum(["ninguno", "bajo", "medio", "alto"])
    .describe("Riesgo de la acción del jugador. 'ninguno' si no requería tirada."),
  scene: z
    .object({ title: z.string(), location: z.string(), mood: z.string() })
    .nullable()
    .describe("Nueva escena solo si el jugador cambió de lugar o la situación cambió de forma notable."),
  health_change: z.number().int().describe("Cambio de salud del jugador (-100..100). 0 si no cambia."),
  gold_change: z.number().int().describe("Oro ganado (positivo) o gastado (negativo). 0 si no cambia."),
  conditions_add: z.array(
    z.strictObject({
      name: z.string(),
      type: z.enum(["wound", "status", "buff", "debuff"]),
      severity: z.enum(["minor", "moderate", "severe", "critical"]),
    }),
  ),
  conditions_remove: z.array(z.string()).describe("Nombres exactos de condiciones que desaparecen."),
  items_add: z.array(z.strictObject({ name: z.string(), qty: z.number().int(), description: z.string() })),
  items_remove: z.array(z.strictObject({ name: z.string(), qty: z.number().int() })),
  npcs: z
    .array(
      z.strictObject({
        name: z.string(),
        role: z.enum(["ally", "npc", "enemy"]),
        disposition_change: z.number().int().describe("Cambio de actitud hacia el jugador (-50..50)."),
        notes: z.string().describe("Rasgo o dato canónico breve."),
        alive: z.boolean(),
      }),
    )
    .describe("Personajes relevantes que aparecen o cambian. Omitir figurantes."),
  monsters: z.array(
    z.strictObject({
      name: z.string(),
      threat_level: z.number().int().describe("1 a 5"),
      health: z.number().int().describe("0 a 100"),
      known: z.boolean().describe("false si el jugador aún no sabe qué criatura es."),
      notes: z.string(),
      defeated: z.boolean(),
    }),
  ),
  quests: z.array(
    z.strictObject({
      title: z.string(),
      status: z.enum(["offered", "accepted", "completed", "failed"]),
      objective: z.string(),
    }),
  ),
  flags: z.array(z.strictObject({ key: z.string(), value: z.string() })),
  memory_facts: z
    .array(z.string())
    .describe("0 a 3 hechos canónicos nuevos para recordar (nombres, promesas, deudas, secretos)."),
  ending: z
    .object({
      type: z.enum(["death", "defeat", "retire", "bittersweet", "victory"]),
      summary: z.string(),
      cause: z.string(),
    })
    .nullable()
    .describe("Solo si la historia termina en este turno."),
  actions: z
    .array(
      z.strictObject({
        text: z.string(),
        risk: z.enum(["bajo", "medio", "alto"]),
        effect_hint: z.string(),
        may_end_game: z.boolean(),
      }),
    )
    .describe("2 a 4 opciones sugeridas. Vacío si la historia terminó."),
  image_prompt: z
    .string()
    .nullable()
    .describe("Descripción visual en inglés solo para lugares, criaturas o momentos importantes."),
});

export type TurnOutput = z.infer<typeof turnOutputSchema>;

type JsonNode = { [key: string]: unknown };

// OpenAI strict mode needs `additionalProperties: false` and every key required on *every*
// object, including the ones nested inside anyOf/items, which generic converters drop.
function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: JsonNode = {};
  for (const [key, value] of Object.entries(node as JsonNode)) {
    if (key !== "$schema") out[key] = strictify(value);
  }
  if (out.type === "object" && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as JsonNode);
  }
  return out;
}

/** The exact JSON schema sent to the model. */
export const turnOutputJsonSchema = strictify(z.toJSONSchema(turnOutputSchema, { target: "draft-7" })) as JsonNode;
