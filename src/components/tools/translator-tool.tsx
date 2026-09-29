"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Download, FileUp, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWipeTimer } from "@/components/wipe-provider";
import { TRANSLATOR_LANGUAGES } from "@/lib/languages";
import {
  downloadBlob,
  formatBytes,
  readAsTextPreview,
  sleep,
} from "@/lib/file-utils";
import { usePremium } from "@/hooks/use-premium";
import { PremiumUpgradeCard } from "@/components/premium/premium-upgrade-card";

function isTranslatorSource(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".docx") ||
    name.endsWith(".doc") ||
    name.endsWith(".pdf") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  );
}

async function extractSourceText(file: File, max = 4000): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const { extractDocxContent } = await import("@/lib/office-extract");
    const { text } = await extractDocxContent(file);
    return text.slice(0, max);
  }
  if (name.endsWith(".pdf")) {
    const { extractPdfBlocks, blocksToPlainText } = await import(
      "@/lib/pdf-extract"
    );
    const blocks = await extractPdfBlocks(file);
    return blocksToPlainText(blocks).slice(0, max);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const csv = sheet ? XLSX.utils.sheet_to_csv(sheet) : "";
    return (csv || (await readAsTextPreview(file))).slice(0, max);
  }
  throw new Error(
    `This file format is not supported (${file.name}). Upload Word, PDF, or Excel.`
  );
}

export function TranslatorTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const { isPremium } = usePremium();
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("hindi");
  const [sourcePreview, setSourcePreview] = useState("");
  const [translatedPreview, setTranslatedPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerNote, setProviderNote] = useState<string | null>(null);

  const india = useMemo(
    () => TRANSLATOR_LANGUAGES.filter((l) => l.region === "India"),
    []
  );
  const world = useMemo(
    () => TRANSLATOR_LANGUAGES.filter((l) => l.region === "World"),
    []
  );

  const selectedLabel =
    TRANSLATOR_LANGUAGES.find((l) => l.code === language)?.label ?? language;

  const onPick = useCallback(
    async (picked: File | null) => {
      if (!picked) return;
      setError(null);
      setResult(null);
      setTranslatedPreview("");
      setProviderNote(null);
      if (!isTranslatorSource(picked)) {
        setFile(null);
        setSourcePreview("");
        setError(
          `This file format is not supported (${picked.name}). Upload Word, PDF, or Excel.`
        );
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      setFile(picked);
      startWipeTimer();
      try {
        setSourcePreview(await extractSourceText(picked, 2000));
      } catch (e) {
        setSourcePreview("");
        setFile(null);
        setError(
          e instanceof Error
            ? e.message
            : "Could not read this file. Try Word, PDF, or Excel."
        );
      }
    },
    [startWipeTimer]
  );

  const translate = async () => {
    if (!file) {
      setError("Upload a Word, PDF, or Excel file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setProviderNote(null);
    setProgress(15);
    try {
      let sample = sourcePreview;
      if (!sample || sample.startsWith("Binary preview")) {
        sample = await extractSourceText(file, 3500);
        setSourcePreview(sample.slice(0, 2000));
      }
      sample = sample.trim();
      if (!sample) {
        throw new Error("Could not extract readable text from this file.");
      }

      setProgress(40);
      await sleep(80);

      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sample.slice(0, 3500),
          target: language,
          source: "en",
        }),
      });
      setProgress(85);
      const data = (await res.json()) as {
        translatedText?: string;
        error?: string;
        provider?: string;
        note?: string;
        truncated?: boolean;
      };
      if (!res.ok || !data.translatedText) {
        throw new Error(data.error || "Translation service failed.");
      }

      const translated = data.translatedText.trim();
      // Guard against leftover stub patterns
      if (/⟦|⟧|\[\[.*\]\]/.test(translated) && !/[\u0900-\u097F]/.test(translated)) {
        throw new Error("Translation returned a stub — try again.");
      }

      const header = `${selectedLabel} translation`;
      const preview = `${header}\n\n${translated}`;
      setTranslatedPreview(preview);
      setProviderNote(
        [
          data.provider ? `Provider: ${data.provider}` : null,
          data.note || null,
          data.truncated ? "Source was truncated for free-tier limits." : null,
        ]
          .filter(Boolean)
          .join(" · ")
      );

      const blob = new Blob(
        [
          `Convert My File Translation\nLanguage: ${selectedLabel}\nSource: ${file.name}\nProvider: ${data.provider || "unknown"}\n\n${translated}\n`,
        ],
        { type: "text/plain;charset=utf-8" }
      );
      setResult(blob);
      setProgress(100);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Translation failed. Try another document or language."
      );
      setTranslatedPreview("");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result || !file) return;
    const base = file.name.replace(/\.[^.]+$/, "");
    downloadBlob(result, `${base}.${language}.txt`);
    markDownloaded();
  };

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] border border-[#E8E2D6] bg-[#FBF9F5] p-5 sm:p-6">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#0F172A]">
            Document Translator
          </h3>
          <p className="mt-1 text-sm text-[#64748B]">
            Free: one language at a time. Premium: 5-language batch on the
            Premium desk.
          </p>
          {!isPremium ? (
            <div className="mt-3">
              <PremiumUpgradeCard dense feature="Multi-language batch" />
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
              <Crown className="h-3.5 w-3.5" /> Premium — use Premium tab for
              5-language packs.
            </p>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-4 flex w-full flex-col items-center rounded-[24px] border border-dashed border-[#C5A880]/70 bg-white px-4 py-8"
          >
            <FileUp className="h-7 w-7 text-[#C5A880]" />
            <p className="mt-2 text-sm font-semibold text-[#0F172A]">
              Upload Word / PDF / Excel
            </p>
            {file ? (
              <p className="mt-2 text-xs text-[#64748B]">
                {file.name} · {formatBytes(file.size)}
              </p>
            ) : null}
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
          />

          <label className="mt-4 block text-xs font-semibold tracking-[0.16em] text-[#94A3B8]">
            OUTPUT LANGUAGE ({TRANSLATOR_LANGUAGES.length})
          </label>
          <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
            <SelectTrigger className="mt-2 h-11 rounded-2xl border-[#E8E2D6] bg-white">
              <SelectValue placeholder="Choose language" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectGroup>
                <SelectLabel>India ({india.length})</SelectLabel>
                {india.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>World ({world.length})</SelectLabel>
                {world.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {busy ? (
            <div className="mt-4 space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-[#64748B]">Translating… {progress}%</p>
            </div>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={() => void translate()}
              disabled={busy || !file}
              className="rounded-full bg-[#0F172A] text-white hover:bg-[#1E293B]"
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" /> Working
                </>
              ) : (
                "Translate & preview"
              )}
            </Button>
            {result ? (
              <Button
                onClick={download}
                variant="outline"
                className="rounded-full border-[#C5A880]"
              >
                <Download /> Download translation
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-[#E8E2D6] bg-white p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-[#94A3B8]">
            SOURCE PREVIEW
          </p>
          <div
            data-testid="source-preview"
            className="mt-2 max-h-44 min-h-[6.5rem] overflow-y-scroll overscroll-contain rounded-[18px] bg-[#F7F4EE] p-3 font-mono text-xs leading-relaxed text-[#475569]"
          >
            <pre className="whitespace-pre-wrap break-words">
              {sourcePreview || "Upload to preview source text."}
            </pre>
          </div>
          <p className="mt-3 text-xs font-semibold tracking-[0.16em] text-[#94A3B8]">
            TRANSLATED PREVIEW · {selectedLabel.toUpperCase()}
          </p>
          <div
            data-testid="translated-preview"
            className="mt-2 max-h-56 min-h-[7rem] overflow-y-scroll overscroll-contain rounded-[18px] bg-[#0F172A] p-3 font-mono text-xs leading-relaxed text-[#CBD5E1]"
          >
            <pre className="whitespace-pre-wrap break-words">
              {translatedPreview ||
                "Run translate to generate a real-language preview before download."}
            </pre>
          </div>
          {providerNote ? (
            <p className="mt-2 text-[11px] text-[#94A3B8]">{providerNote}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
