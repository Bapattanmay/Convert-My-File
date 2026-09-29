/**
 * Server-side translation helpers.
 * Primary: MyMemory (no API key). Optional: Google Cloud Translation if GOOGLE_TRANSLATE_API_KEY is set.
 * Limits (MyMemory): ~500 chars/request, ~1000 words/day without email; quality varies by language pair.
 */

export type TranslateResult = {
  translatedText: string;
  provider: "mymemory" | "google" | "passthrough";
  targetLang: string;
  sourceLang: string;
  truncated: boolean;
  note?: string;
};

/** Map UI language codes (slug from label) → ISO 639-1 for translation APIs */
const LANG_ISO: Record<string, string> = {
  hindi: "hi",
  bengali: "bn",
  marathi: "mr",
  telugu: "te",
  tamil: "ta",
  gujarati: "gu",
  urdu: "ur",
  kannada: "kn",
  odia: "or",
  malayalam: "ml",
  punjabi: "pa",
  assamese: "as",
  maithili: "mai",
  santali: "sat",
  kashmiri: "ks",
  nepali: "ne",
  konkani: "gom",
  sindhi: "sd",
  dogri: "doi",
  "manipuri-meitei": "mni",
  bodo: "brx",
  sanskrit: "sa",
  "english-india": "en",
  english: "en",
  bhojpuri: "bho",
  "mandarin-chinese": "zh-CN",
  spanish: "es",
  french: "fr",
  arabic: "ar",
  portuguese: "pt",
  russian: "ru",
  japanese: "ja",
  german: "de",
  korean: "ko",
  italian: "it",
  turkish: "tr",
  vietnamese: "vi",
  thai: "th",
  polish: "pl",
  ukrainian: "uk",
  dutch: "nl",
  greek: "el",
  czech: "cs",
  romanian: "ro",
  hungarian: "hu",
  swedish: "sv",
  finnish: "fi",
  norwegian: "no",
  danish: "da",
  hebrew: "he",
  "persian-farsi": "fa",
  indonesian: "id",
  malay: "ms",
  "filipino-tagalog": "tl",
  swahili: "sw",
  amharic: "am",
  yoruba: "yo",
  igbo: "ig",
  hausa: "ha",
  zulu: "zu",
  afrikaans: "af",
  catalan: "ca",
  croatian: "hr",
  serbian: "sr",
  slovak: "sk",
  bulgarian: "bg",
  lithuanian: "lt",
  latvian: "lv",
  estonian: "et",
  slovenian: "sl",
  icelandic: "is",
  irish: "ga",
  welsh: "cy",
  basque: "eu",
};

export function resolveIsoLang(codeOrLabel: string): string | null {
  const key = codeOrLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (LANG_ISO[key]) return LANG_ISO[key];
  // Already an ISO-ish code
  if (/^[a-z]{2}(-[A-Z]{2})?$/.test(codeOrLabel)) return codeOrLabel;
  if (/^[a-z]{2,3}$/.test(codeOrLabel)) return codeOrLabel;
  return null;
}

const CHUNK = 450;
const MAX_CHARS = 3500; // keep free-tier friendly

function chunkText(text: string, size = CHUNK): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > size) {
    let cut = rest.lastIndexOf(" ", size);
    if (cut < size * 0.4) cut = size;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function translateMyMemory(
  text: string,
  source: string,
  target: string
): Promise<string> {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${source}|${target}`);
  // Slightly higher free quota when an email is registered; optional env
  const email = process.env.MYMEMORY_EMAIL;
  if (email) url.searchParams.set("de", email);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`MyMemory HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    responseStatus?: number | string;
    responseData?: { translatedText?: string };
    responseDetails?: string;
  };
  const status = Number(data.responseStatus);
  if (status !== 200 || !data.responseData?.translatedText) {
    throw new Error(
      data.responseDetails || `MyMemory failed (status ${data.responseStatus})`
    );
  }
  return data.responseData.translatedText;
}

async function translateGoogleOfficial(
  text: string,
  source: string,
  target: string,
  apiKey: string
): Promise<string> {
  const url = new URL("https://translation.googleapis.com/language/translate/v2");
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: source.split("-")[0],
      target: target.split("-")[0],
      format: "text",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Translate HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    data?: { translations?: { translatedText?: string }[] };
  };
  const out = data.data?.translations?.[0]?.translatedText;
  if (!out) throw new Error("Google Translate returned empty text");
  return out;
}

export async function translateText(opts: {
  text: string;
  targetCode: string;
  sourceCode?: string;
}): Promise<TranslateResult> {
  const raw = (opts.text || "").trim();
  if (!raw) {
    throw new Error("Nothing to translate — extract text from the document first.");
  }

  const target = resolveIsoLang(opts.targetCode);
  if (!target) {
    throw new Error(
      `Language “${opts.targetCode}” is not mapped to a translation code yet.`
    );
  }
  const source = resolveIsoLang(opts.sourceCode || "en") || "en";

  if (source === target) {
    return {
      translatedText: raw,
      provider: "passthrough",
      targetLang: target,
      sourceLang: source,
      truncated: false,
      note: "Source and target language are the same.",
    };
  }

  let truncated = false;
  let work = raw;
  if (work.length > MAX_CHARS) {
    work = work.slice(0, MAX_CHARS);
    truncated = true;
  }

  const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  const chunks = chunkText(work);
  const out: string[] = [];

  if (googleKey) {
    for (const c of chunks) {
      out.push(await translateGoogleOfficial(c, source, target, googleKey));
      await sleep(80);
    }
    return {
      translatedText: out.join("\n"),
      provider: "google",
      targetLang: target,
      sourceLang: source,
      truncated,
    };
  }

  for (const c of chunks) {
    out.push(await translateMyMemory(c, source, target));
    await sleep(120);
  }

  return {
    translatedText: out.join("\n"),
    provider: "mymemory",
    targetLang: target,
    sourceLang: source,
    truncated,
    note: truncated
      ? `Preview limited to ~${MAX_CHARS} characters (MyMemory free tier).`
      : "Translated via MyMemory free API (daily quota applies).",
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
