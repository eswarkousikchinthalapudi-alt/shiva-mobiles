import "server-only";
import { modelInputSchema, type ModelInput } from "@/lib/admin/catalog";
import { readGsmarenaSpecs } from "./gsmarena";
import { looksLikeLink } from "./link";
import { aiLookupEnabled, lookupWithAi } from "./openrouter";

export { aiLookupEnabled } from "./openrouter";
export { looksLikeLink } from "./link";

export type SpecsSource = "gsmarena" | "ai";
export type SpecsFound = { specs: ModelInput; source: SpecsSource };
export type SpecsOutcome = { ok: true; data: SpecsFound } | { ok: false; error: string };

/**
 * One box, two ways: a pasted GSMArena link is read directly (free);
 * a name or model number goes to the AI lookup when it is switched on.
 */
export async function lookupSpecs(query: string): Promise<SpecsOutcome> {
  const text = query.trim().slice(0, 500);
  if (text.length < 2) return { ok: false, error: "Type the phone name, or paste its GSMArena link." };

  const outcome = looksLikeLink(text)
    ? { source: "gsmarena" as const, result: await readGsmarenaSpecs(text) }
    : aiLookupEnabled()
      ? { source: "ai" as const, result: await lookupWithAi(text) }
      : null;
  if (!outcome) {
    return {
      ok: false,
      error: "Searching by name needs the AI lookup, which is off. Paste the phone's GSMArena link instead, or add the specs by hand.",
    };
  }
  if (!outcome.result.ok) return outcome.result;

  const checked = modelInputSchema.safeParse(outcome.result.specs);
  if (!checked.success) {
    console.error("[specs] unexpected shape", checked.error.issues[0]);
    return { ok: false, error: "The specs came back in an unexpected shape. Try again or add them by hand." };
  }
  return { ok: true, data: { specs: checked.data, source: outcome.source } };
}
