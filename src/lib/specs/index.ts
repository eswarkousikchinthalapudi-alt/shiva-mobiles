import "server-only";
import { modelInputSchema, type ModelInput } from "@/lib/admin/catalog";
import { readGsmarenaSpecs } from "./gsmarena";
import { looksLikeLink } from "./link";
import { splitBrand } from "./normalize";
import { aiLookupEnabled, extractWithAi, lookupWithAi } from "./openrouter";
import { countFound, parseSpecsText, trimForAi } from "./text";
import { findWikipediaArticle } from "./wikipedia";

export { aiLookupEnabled } from "./openrouter";
export { looksLikeLink } from "./link";

export type SpecsSource = "gsmarena" | "wikipedia" | "ai" | "pasted";
export type SpecsFound = { specs: ModelInput; source: SpecsSource; note?: string };
export type SpecsOutcome = { ok: true; data: SpecsFound } | { ok: false; error: string };

/** Brand and name may still be empty (the owner fills them in); everything else must be in range. */
const partial = modelInputSchema.omit({ brand: true, name: true });

function checked(specs: ModelInput, source: SpecsSource, hint = "", note?: string): SpecsOutcome {
  const rest = partial.safeParse(specs);
  if (!rest.success) {
    console.error("[specs] unexpected shape", rest.error.issues[0]);
    return { ok: false, error: "The specs came back in an unexpected shape. Try again or add them by hand." };
  }
  let brand = specs.brand.trim().slice(0, 40);
  let name = specs.name.trim().slice(0, 80);
  if (!brand || !name) {
    const typed = splitBrand(hint);
    brand = brand || typed.brand.slice(0, 40);
    name = name || typed.name.slice(0, 80);
  }
  return { ok: true, data: { specs: { ...rest.data, brand, name }, source, note } };
}

/** How many fields a plain reading must yield before we're happy without the AI. */
export const GOOD_ENOUGH = 4;

const BY_HAND = "add the specs by hand, or paste them from any specs website (Paste specs).";

/**
 * The one "Get specs" button. A GSMArena link is read directly. A name or
 * model number is looked up on Wikipedia and read by the free AI (so new
 * phones work too); if Wikipedia has nothing, the free AI answers from
 * memory. Without an AI key, the Wikipedia text is read with patterns.
 */
export async function lookupSpecs(query: string): Promise<SpecsOutcome> {
  const text = query.trim().slice(0, 500);
  if (text.length < 2) return { ok: false, error: "Type the phone name or model number first." };

  if (looksLikeLink(text)) {
    const result = await readGsmarenaSpecs(text);
    return result.ok ? checked(result.specs, "gsmarena") : result;
  }

  const ai = aiLookupEnabled();
  const article = await findWikipediaArticle(text);
  if (article) {
    const withUrl = (specs: ModelInput) => ({ ...specs, sourceUrls: [article.url] });
    if (ai) {
      const read = await extractWithAi(trimForAi(article.text), text);
      if (read.ok) return checked(withUrl(read.specs), "wikipedia", text);
      // A bad key, a busy service or a missing setting: say so instead of trying the AI's memory.
      if (!/no specs for this phone/.test(read.error)) return read;
    } else {
      const plain = parseSpecsText(article.text, text);
      if (plain.found >= GOOD_ENOUGH) {
        return checked(
          withUrl(plain.specs),
          "wikipedia",
          text,
          "Read from Wikipedia without AI, so check the numbers, especially on pages that cover several models.",
        );
      }
    }
  }

  if (ai) {
    const remembered = await lookupWithAi(text);
    if (remembered.ok) return checked(remembered.specs, "ai", text);
    if (!/doesn't know this phone/.test(remembered.error)) return remembered;
    return {
      ok: false,
      error: `${article ? `Wikipedia's page (${article.title}) doesn't list this phone` : "Wikipedia has no page for this phone"}, and the free AI doesn't know it either. Check the name, or ${BY_HAND}`,
    };
  }
  return {
    ok: false,
    error: `${article ? `Wikipedia's page (${article.title}) didn't give enough specs` : "Wikipedia has no page for this phone"}. Add OPENROUTER_API_KEY on the server for better results, or ${BY_HAND}`,
  };
}

export type TextParse = { outcome: SpecsOutcome; found: number };

/** Reads pasted specs text without any network request. */
export function parseSpecsFromText(text: string, hint: string): TextParse {
  const body = text.slice(0, 200_000);
  if (body.trim().length < 20) return { outcome: { ok: false, error: "Paste the specs text first (copy the whole page from a specs site)." }, found: 0 };
  const { specs, found } = parseSpecsText(body, hint);
  if (found === 0) {
    return {
      outcome: {
        ok: false,
        error: "Couldn't find any specs in that text. Copy the whole specs page (select all, then copy) and paste it again, or add the specs by hand.",
      },
      found,
    };
  }
  return { outcome: checked(specs, "pasted", hint), found };
}

/** Asks the free AI to read pasted text. Used when the plain reading found little. */
export async function extractSpecsFromText(text: string, hint: string): Promise<SpecsOutcome> {
  const result = await extractWithAi(trimForAi(text.slice(0, 200_000)), hint);
  if (!result.ok) return result;
  return checked(result.specs, "ai", hint);
}

export { countFound };
