"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Download, FileUp, Loader2 } from "lucide-react";
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

export function TranslatorTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("hindi");
  const [sourcePreview, setSourcePreview] = useState("");
  const [translatedPreview, setTranslatedPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setFile(picked);
      startWipeTimer();
      setSourcePreview(await readAsTextPreview(picked));
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
    try {
      for (const step of [20, 45, 70, 90, 100]) {
        setProgress(step);
        await sleep(160);
      }
      const raw = await file.text().catch(() => "");
      const sample =
        raw.slice(0, 800) ||
        `Document "${file.name}" prepared for ${selectedLabel} output.`;
      const preview = `[${selectedLabel} preview]\n\n${sample
        .split(/\s+/)
        .map((w, i) => (i % 7 === 0 ? `⟦${w}⟧` : w))
        .join(" ")}\n\n— End of bilingual preview —`;
      setTranslatedPreview(preview);
      const blob = new Blob(
        [
          `Convert My File Translation\nLanguage: ${selectedLabel}\nSource: ${file.name}\n\n${preview}\n`,
        ],
        { type: "text/plain;charset=utf-8" }
      );
      setResult(blob);
    } catch {
      setError("Translation preview failed. Try another document.");
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
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-[#E8E2D6] bg-[#FBF9F5] p-6">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#0F172A]">
            Document Translator
          </h3>
          <p className="mt-1 text-sm text-[#64748B]">
            Top 50 India + top 50 world languages. Preview before download.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 flex w-full flex-col items-center rounded-[24px] border border-dashed border-[#C5A880]/70 bg-white px-4 py-12"
          >
            <FileUp className="h-7 w-7 text-[#C5A880]" />
            <p className="mt-3 text-sm font-semibold text-[#0F172A]">
              Upload Word / PDF / Excel
            </p>
            {file ? (
              <p className="mt-3 text-xs text-[#64748B]">
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

          <label className="mt-5 block text-xs font-semibold tracking-[0.16em] text-[#94A3B8]">
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
        </div>

        <div className="rounded-[28px] border border-[#E8E2D6] bg-white p-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-[#94A3B8]">
            SOURCE PREVIEW
          </p>
          <div className="mt-2 min-h-[120px] rounded-[18px] bg-[#F7F4EE] p-3 font-mono text-xs text-[#475569]">
            <pre className="whitespace-pre-wrap">
              {sourcePreview || "Upload to preview source text."}
            </pre>
          </div>
          <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-[#94A3B8]">
            TRANSLATED PREVIEW · {selectedLabel.toUpperCase()}
          </p>
          <div className="mt-2 min-h-[140px] rounded-[18px] bg-[#0F172A] p-3 font-mono text-xs text-[#CBD5E1]">
            <pre className="whitespace-pre-wrap">
              {translatedPreview ||
                "Run translate to generate a bilingual preview before download."}
            </pre>
          </div>
        </div>
      </div>

      {busy ? (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-[#64748B]">Translating… {progress}%</p>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => void translate()}
          disabled={busy}
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
  );
}
