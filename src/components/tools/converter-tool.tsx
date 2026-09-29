"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWipeTimer } from "@/components/wipe-provider";
import { downloadBlob, formatBytes, sleep } from "@/lib/file-utils";
import {
  OUTPUT_FORMATS,
  type FormatId,
  acceptAttribute,
  convertFile,
  detectFormat,
  formatLabel,
  isConversionSupported,
  unsupportedConversionMessage,
  unsupportedFileMessage,
} from "@/lib/convert";

const QUICK_TAGS: { label: string; from: FormatId; to: FormatId }[] = [
  { label: "PDF → DOC", from: "pdf", to: "docx" },
  { label: "JPG → PDF", from: "jpg", to: "pdf" },
  { label: "PNG → JPG", from: "png", to: "jpg" },
  { label: "DOC → PDF", from: "docx", to: "pdf" },
  { label: "TXT → PDF", from: "txt", to: "pdf" },
  { label: "XLSX → CSV", from: "xlsx", to: "csv" },
];

export function ConverterTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [file, setFile] = useState<File | null>(null);
  const [sourceFormat, setSourceFormat] = useState<FormatId | null>(null);
  const [target, setTarget] = useState<FormatId>("jpg");
  const [quickTag, setQuickTag] = useState<string>("PNG → JPG");
  const [previewText, setPreviewText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"image" | "text" | "pdf" | null>(
    null
  );
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultExt, setResultExt] = useState("bin");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearPreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewText("");
    setPreviewKind(null);
  }, []);

  const validatePair = useCallback(
    (from: FormatId | null, to: FormatId): string | null => {
      if (!from) return null;
      if (!isConversionSupported(from, to)) {
        return unsupportedConversionMessage(from, to);
      }
      return null;
    },
    []
  );

  const onPick = useCallback(
    async (picked: File | null) => {
      if (!picked) return;
      setError(null);
      setResult(null);
      setProgress(0);
      clearPreview();

      const detected = detectFormat(picked);
      if (!detected) {
        setFile(null);
        setSourceFormat(null);
        setError(unsupportedFileMessage(picked.name));
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      // If current output isn't valid for this source, switch to a sensible default
      // instead of rejecting the upload (default UI target is JPG).
      let nextTarget = target;
      if (!isConversionSupported(detected, target)) {
        const preferred: FormatId[] = [
          "pdf",
          "docx",
          "txt",
          "csv",
          "jpg",
          "png",
          "xlsx",
        ];
        const pick =
          preferred.find((f) => isConversionSupported(detected, f)) ||
          OUTPUT_FORMATS.find((f) => isConversionSupported(detected, f));
        if (!pick) {
          setFile(null);
          setSourceFormat(null);
          setError(
            unsupportedConversionMessage(detected, target)
          );
          if (inputRef.current) inputRef.current.value = "";
          return;
        }
        nextTarget = pick;
        setTarget(pick);
        setQuickTag("");
      }

      setFile(picked);
      setSourceFormat(detected);
      startWipeTimer();

      // Source hint before convert — output preview appears after convert
      if (
        detected === "jpg" ||
        detected === "png" ||
        detected === "webp" ||
        detected === "gif"
      ) {
        setPreviewKind("image");
        setPreviewText(
          `Source: ${picked.name} (${formatLabel(detected)})\nTarget: ${formatLabel(nextTarget)}\n\nClick Convert to generate the output preview.`
        );
        const url = URL.createObjectURL(picked);
        setPreviewUrl(url);
      } else {
        setPreviewKind("text");
        setPreviewText(
          `Source: ${picked.name} (${formatLabel(detected)})\nTarget: ${formatLabel(nextTarget)}\nSize: ${formatBytes(picked.size)}\n\nClick Convert to generate the output preview.`
        );
      }
    },
    [clearPreview, startWipeTimer, target]
  );

  const selectTarget = (fmt: FormatId, tagLabel = "") => {
    setTarget(fmt);
    setQuickTag(tagLabel);
    setResult(null);
    clearPreview();
    setError(null);

    if (file && sourceFormat) {
      const pairErr = validatePair(sourceFormat, fmt);
      if (pairErr) {
        setError(pairErr);
        setFile(null);
        setSourceFormat(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      setPreviewKind(
        ["jpg", "png", "webp", "gif"].includes(sourceFormat) ? "image" : "text"
      );
      setPreviewText(
        `Source: ${file.name} (${formatLabel(sourceFormat)})\nTarget: ${formatLabel(fmt)}\nSize: ${formatBytes(file.size)}\n\nClick Convert to generate the output preview.`
      );
      if (["jpg", "png", "webp", "gif"].includes(sourceFormat)) {
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const convert = async () => {
    if (!file || !sourceFormat) {
      setError("Upload a supported file to convert.");
      return;
    }
    const pairErr = validatePair(sourceFormat, target);
    if (pairErr) {
      setError(pairErr);
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    clearPreview();
    try {
      for (const step of [20, 45, 70, 90]) {
        setProgress(step);
        await sleep(120);
      }
      const out = await convertFile(file, sourceFormat, target);
      setProgress(100);
      setResult(out.blob);
      setResultExt(out.filenameExt);
      setPreviewKind(out.previewKind);
      if (out.previewUrl) setPreviewUrl(out.previewUrl);
      setPreviewText(
        out.previewText ??
          `Output: ${formatLabel(target)} · ${formatBytes(out.blob.size)}`
      );
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Conversion failed. Try another format.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result || !file) return;
    const base = file.name.replace(/\.[^.]+$/, "");
    downloadBlob(result, `${base}.${resultExt}`);
    markDownloaded();
  };

  const availableOutputs = sourceFormat
    ? OUTPUT_FORMATS.filter((f) => isConversionSupported(sourceFormat, f))
    : OUTPUT_FORMATS;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[28px] border border-[#E8E2D6] bg-[#FBF9F5] p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#0F172A]">
              Smart Converter
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Upload on the left. Output preview on the right.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onPick(e.dataTransfer.files?.[0] ?? null);
          }}
          className="mt-6 flex w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-[#C5A880]/70 bg-white px-4 py-14 text-center transition hover:border-[#D4AF37] hover:bg-[#FFFCF7]"
        >
          <FileUp className="h-8 w-8 text-[#C5A880]" />
          <p className="mt-3 text-sm font-semibold text-[#0F172A]">
            Drop a file or click to upload
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            PDF, Word, Excel, CSV, TXT, JPG, PNG, WEBP, GIF
          </p>
          {file && sourceFormat ? (
            <p className="mt-4 rounded-full bg-[#0F172A] px-3 py-1 text-xs font-medium text-[#D4AF37]">
              {file.name} · {formatLabel(sourceFormat)} · {formatBytes(file.size)}
            </p>
          ) : null}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={acceptAttribute()}
          onChange={(e) => {
            void onPick(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag.label}
              type="button"
              onClick={() => selectTarget(tag.to, tag.label)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition ${
                quickTag === tag.label
                  ? "bg-[#0F172A] text-[#D4AF37]"
                  : "bg-white text-[#475569] ring-1 ring-[#E8E2D6] hover:ring-[#C5A880]"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-[#E8E2D6] bg-white p-6 sm:p-7">
        <label className="text-xs font-semibold tracking-[0.16em] text-[#94A3B8]">
          OUTPUT FORMAT
        </label>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="output-formats">
          {OUTPUT_FORMATS.map((fmt) => {
            const allowed =
              !sourceFormat || isConversionSupported(sourceFormat, fmt);
            const selected = target === fmt;
            return (
              <button
                key={fmt}
                type="button"
                disabled={!allowed}
                aria-pressed={selected}
                data-allowed={allowed ? "true" : "false"}
                title={
                  allowed
                    ? `Convert to ${formatLabel(fmt)}`
                    : unsupportedConversionMessage(sourceFormat!, fmt)
                }
                onClick={() => {
                  if (!allowed) return;
                  selectTarget(fmt);
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  selected
                    ? "bg-[#0F172A] text-[#D4AF37] shadow-[0_8px_20px_rgba(15,23,42,0.18)] ring-2 ring-[#D4AF37]/50"
                    : allowed
                      ? "cursor-pointer border-2 border-[#D4AF37] bg-[#F3E0B8] text-[#0F172A] shadow-sm hover:bg-[#EBD49A]"
                      : "cursor-not-allowed border border-transparent bg-transparent text-[#C4BDB0] opacity-35 line-through decoration-[#C4BDB0]"
                }`}
              >
                {fmt}
              </button>
            );
          })}
        </div>
        {sourceFormat ? (
          <p className="mt-2 text-xs text-[#94A3B8]">
            From {formatLabel(sourceFormat)} → available:{" "}
            {availableOutputs.map(formatLabel).join(", ")}
          </p>
        ) : null}

        <div className="mt-5 min-h-[200px] overflow-hidden rounded-[20px] bg-[#0F172A] p-4 text-xs leading-relaxed text-[#CBD5E1]">
          {previewKind === "image" && previewUrl ? (
            <div className="flex flex-col gap-3">
              <p className="font-semibold tracking-wide text-[#D4AF37]">
                OUTPUT PREVIEW · {formatLabel(target)}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Converted output preview"
                className="max-h-56 w-full rounded-xl object-contain bg-[#101828]"
              />
              {previewText ? (
                <pre className="whitespace-pre-wrap font-mono text-[11px] text-[#94A3B8]">
                  {previewText}
                </pre>
              ) : null}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-mono">
              {previewText ||
                "Output preview will appear here after a successful conversion."}
            </pre>
          )}
        </div>

        {busy ? (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-[#64748B]">Converting… {progress}%</p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            onClick={() => void convert()}
            disabled={busy || !file}
            className="rounded-full bg-[#0F172A] px-5 text-white hover:bg-[#1E293B]"
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" /> Converting
              </>
            ) : (
              "Convert file"
            )}
          </Button>
          {result ? (
            <Button
              onClick={download}
              variant="outline"
              className="rounded-full border-[#C5A880] text-[#0F172A]"
            >
              <Download /> Download .{resultExt}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
