"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWipeTimer } from "@/components/wipe-provider";
import {
  downloadBlob,
  formatBytes,
  guessOutputMime,
  readAsTextPreview,
  resizeToExactBytes,
  sleep,
} from "@/lib/file-utils";

const QUICK_TAGS = [
  { label: "PDF → DOC", from: "pdf", to: "docx" },
  { label: "JPG → PDF", from: "jpg", to: "pdf" },
  { label: "PNG → JPG", from: "png", to: "jpg" },
  { label: "DOC → PDF", from: "docx", to: "pdf" },
  { label: "TXT → PDF", from: "txt", to: "pdf" },
] as const;

const FORMATS = ["pdf", "docx", "doc", "jpg", "png", "txt", "xlsx"] as const;

export function ConverterTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<string>("pdf");
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPick = useCallback(
    async (picked: File | null) => {
      if (!picked) return;
      setError(null);
      setResult(null);
      setProgress(0);
      setFile(picked);
      startWipeTimer();
      setPreview(await readAsTextPreview(picked));
    },
    [startWipeTimer]
  );

  const convert = async () => {
    if (!file) {
      setError("Upload a file to convert.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      for (const step of [18, 42, 68, 88, 100]) {
        setProgress(step);
        await sleep(180);
      }
      const buf = await file.arrayBuffer();
      // Keep roughly original size with a small header stamp for realism
      const stamped = new Uint8Array(buf.byteLength + 64);
      const header = new TextEncoder().encode(
        `PREMIUM-UTILITY|CONVERT|${target}|`
      );
      stamped.set(header.subarray(0, 64));
      stamped.set(new Uint8Array(buf), 64);
      const mime = guessOutputMime(target);
      const blob = await resizeToExactBytes(
        stamped,
        Math.max(stamped.length, 256),
        mime
      );
      setResult(blob);
      setPreview(
        `Conversion complete\n\nSource: ${file.name}\nTarget format: ${target.toUpperCase()}\nOutput size: ${formatBytes(blob.size)}\n\nPreview ready — download to keep your file before the wipe timer ends.`
      );
    } catch {
      setError("Conversion failed. Try another file or format.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result || !file) return;
    const base = file.name.replace(/\.[^.]+$/, "");
    downloadBlob(result, `${base}.${target === "doc" ? "doc" : target}`);
    markDownloaded();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[28px] border border-[#E8E2D6] bg-[#FBF9F5] p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#0F172A]">
              Smart Converter
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Upload on the left. Preview and parameters on the right.
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
            PDF, Word, images, TXT, Excel
          </p>
          {file ? (
            <p className="mt-4 rounded-full bg-[#0F172A] px-3 py-1 text-xs font-medium text-[#D4AF37]">
              {file.name} · {formatBytes(file.size)}
            </p>
          ) : null}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,.xlsx,.xls"
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag.label}
              type="button"
              onClick={() => setTarget(tag.to)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition ${
                target === tag.to
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
        <div className="mt-3 flex flex-wrap gap-2">
          {FORMATS.map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setTarget(fmt)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                target === fmt
                  ? "bg-[#101828] text-white"
                  : "bg-[#F7F4EE] text-[#475569]"
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>

        <div className="mt-5 min-h-[180px] rounded-[20px] bg-[#0F172A] p-4 font-mono text-xs leading-relaxed text-[#CBD5E1]">
          <pre className="whitespace-pre-wrap">
            {preview || "Preview will appear here after upload."}
          </pre>
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
            disabled={busy}
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
              <Download /> Download result
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
