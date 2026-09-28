/** Top languages of India (by speaker population / official status) */
export const INDIA_LANGUAGES = [
  "Hindi",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Urdu",
  "Kannada",
  "Odia",
  "Malayalam",
  "Punjabi",
  "Assamese",
  "Maithili",
  "Santali",
  "Kashmiri",
  "Nepali",
  "Konkani",
  "Sindhi",
  "Dogri",
  "Manipuri (Meitei)",
  "Bodo",
  "Sanskrit",
  "English (India)",
  "Bhojpuri",
  "Rajasthani",
  "Chhattisgarhi",
  "Haryanvi",
  "Magahi",
  "Awadhi",
  "Marwari",
  "Tulu",
  "Kodava",
  "Khasi",
  "Garo",
  "Mizo",
  "Naga (Angami)",
  "Tripuri (Kokborok)",
  "Ladakhi",
  "Bhili",
  "Gondi",
  "Kurukh",
  "Ho",
  "Mundari",
  "Khandeshi",
  "Lambadi",
  "Saurashtra",
  "Pahari",
  "Garhwali",
  "Kumaoni",
  "Sikkimese",
] as const;

/** Widely spoken world languages (excluding overlaps kept via India list where needed) */
export const WORLD_LANGUAGES = [
  "English",
  "Mandarin Chinese",
  "Spanish",
  "French",
  "Arabic",
  "Portuguese",
  "Russian",
  "Japanese",
  "German",
  "Korean",
  "Italian",
  "Turkish",
  "Vietnamese",
  "Thai",
  "Polish",
  "Ukrainian",
  "Dutch",
  "Greek",
  "Czech",
  "Romanian",
  "Hungarian",
  "Swedish",
  "Finnish",
  "Norwegian",
  "Danish",
  "Hebrew",
  "Persian (Farsi)",
  "Indonesian",
  "Malay",
  "Filipino (Tagalog)",
  "Swahili",
  "Amharic",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Zulu",
  "Afrikaans",
  "Catalan",
  "Croatian",
  "Serbian",
  "Slovak",
  "Bulgarian",
  "Lithuanian",
  "Latvian",
  "Estonian",
  "Slovenian",
  "Icelandic",
  "Irish",
  "Welsh",
  "Basque",
] as const;

export type LanguageOption = {
  code: string;
  label: string;
  region: "India" | "World";
};

function toCode(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Deduped ~100 language options for the translator */
export const TRANSLATOR_LANGUAGES: LanguageOption[] = (() => {
  const seen = new Set<string>();
  const out: LanguageOption[] = [];

  for (const label of INDIA_LANGUAGES) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ code: toCode(label), label, region: "India" });
  }

  for (const label of WORLD_LANGUAGES) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ code: toCode(label), label, region: "World" });
  }

  return out;
})();
