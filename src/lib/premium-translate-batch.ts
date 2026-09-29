/** Premium: one document → up to 5 languages simultaneously */

import JSZip from "jszip";

export const PREMIUM_LANG_BATCH_MAX = 5;

export type LangBatchResult = {
  code: string;
  label: string;
  text: string;
  ok: boolean;
  error?: string;
};

async function translateOnce(
  text: string,
  language: string
): Promise<{ text: string; provider?: string }> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target: language, source: "en" }),
  });
  const data = (await res.json()) as {
    translatedText?: string;
    text?: string;
    error?: string;
    provider?: string;
  };
  const out = data.translatedText || data.text;
  if (!res.ok || !out) {
    throw new Error(data.error || `Translate failed (${res.status})`);
  }
  return { text: out, provider: data.provider };
}

export async function translateToManyLanguages(
  sourceText: string,
  langs: { code: string; label: string }[],
  onProgress?: (done: number, total: number) => void
): Promise<LangBatchResult[]> {
  if (!sourceText.trim()) throw new Error("No text to translate.");
  if (langs.length < 1) throw new Error("Pick at least one language.");
  if (langs.length > PREMIUM_LANG_BATCH_MAX) {
    throw new Error(`Premium batch supports up to ${PREMIUM_LANG_BATCH_MAX} languages.`);
  }

  const results: LangBatchResult[] = [];
  for (let i = 0; i < langs.length; i++) {
    const lang = langs[i];
    // Pace MyMemory free-tier to reduce 429s between languages
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 1200));
    }
    try {
      const { text } = await translateOnce(sourceText, lang.code);
      results.push({ code: lang.code, label: lang.label, text, ok: true });
    } catch (e) {
      results.push({
        code: lang.code,
        label: lang.label,
        text: "",
        ok: false,
        error: e instanceof Error ? e.message : "Failed",
      });
    }
    onProgress?.(i + 1, langs.length);
  }
  return results;
}

export async function langResultsToZip(
  results: LangBatchResult[],
  baseName = "translated"
): Promise<Blob> {
  const zip = new JSZip();
  let n = 0;
  for (const r of results) {
    if (!r.ok || !r.text) continue;
    zip.file(`${baseName}.${r.code}.txt`, r.text);
    n++;
  }
  if (!n) throw new Error("No successful translations to pack.");
  return zip.generateAsync({ type: "blob" });
}
