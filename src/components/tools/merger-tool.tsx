"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileUp,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWipeTimer } from "@/components/wipe-provider";
import { downloadBlob, formatBytes, sleep } from "@/lib/file-utils";
import {
  detectMergeKind,
  mergeAcceptAttribute,
  mergeDocuments,
  unsupportedMergeMessage,
  type MergeKind,
} from "@/lib/merge";

type ListedFile = { id: string; file: File; kind: MergeKind };

export function MergerTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [files, setFiles] = useState<ListedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const accepted: ListedFile[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      const kind = detectMergeKind(file);
      if (!kind) {
        rejected.push(file.name);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        kind,
      });
    }
    if (rejected.length) {
      setError(
        rejected.length === 1
          ? unsupportedMergeMessage(rejected[0])
          : `Unsupported formats: ${rejected.join(", ")}. Upload PDF, Word (DOC/DOCX), or PowerPoint (PPT/PPTX) only.`
      );
    } else {
      setError(null);
    }
    if (accepted.length) {
      setFiles((prev) => [...prev, ...accepted]);
      setResult(null);
      startWipeTimer();
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[index];
      copy[index] = copy[target];
      copy[target] = tmp;
      return copy;
    });
  };

  const merge = async () => {
    if (files.length < 2) {
      setError("Add at least two PDF, Word, or PowerPoint files to merge.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const step of [12, 28, 48, 72, 90]) {
        setProgress(step);
        await sleep(120);
      }
      const blob = await mergeDocuments(
        files.map(({ file, kind }) => ({ file, kind }))
      );
      setProgress(100);
      setResult(blob);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Merge failed. Check your files and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    downloadBlob(result, `merged-${files.length}-files.pdf`);
    markDownloaded();
  };

  return (
    <div className="rounded-[28px] border border-[#E8E2D6]/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] backdrop-blur-sm sm:p-7">
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[#0F172A]">
        Document Merger
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-[#64748B]">
        Merge PDF, Word (DOC/DOCX), and PowerPoint (PPT/PPTX) — reorder, then
        download one combined PDF.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-5 flex w-full flex-col items-center rounded-[24px] border border-dashed border-[#C5A880]/70 bg-gradient-to-b from-[#FBF9F5] to-[#F7F4EE] px-4 py-10 transition hover:border-[#D4AF37]"
      >
        <FileUp className="h-7 w-7 text-[#C5A880]" />
        <p className="mt-3 text-sm font-semibold text-[#0F172A]">
          Add PDF, Word, or PowerPoint
        </p>
        <p className="mt-1 text-xs text-[#94A3B8]">
          .pdf · .doc · .docx · .ppt · .pptx
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={mergeAcceptAttribute()}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length ? (
        <ol className="mt-5 space-y-2">
          {files.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-[#E8E2D6]/80 bg-[#FBF9F5]/90 px-3 py-2.5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0F172A] text-xs font-semibold text-[#D4AF37]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#0F172A]">
                  {item.file.name}
                </p>
                <p className="text-xs text-[#94A3B8]">
                  {item.kind.toUpperCase()} · {formatBytes(item.file.size)}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => move(index, -1)}
                  className="rounded-lg p-1.5 text-[#64748B] transition hover:bg-white"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => move(index, 1)}
                  className="rounded-lg p-1.5 text-[#64748B] transition hover:bg-white"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() =>
                    setFiles((prev) => prev.filter((f) => f.id !== item.id))
                  }
                  className="rounded-lg p-1.5 text-[#64748B] transition hover:bg-white hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {busy ? (
        <div className="mt-4 space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-[#64748B]">Merging… {progress}%</p>
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <p className="mt-3 text-xs font-medium text-emerald-700">
          Merged PDF ready · {formatBytes(result.size)} · {files.length} sources
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          onClick={() => void merge()}
          disabled={busy}
          className="rounded-full bg-[#0F172A] text-white hover:bg-[#1E293B]"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" /> Merging
            </>
          ) : (
            "Merge documents"
          )}
        </Button>
        {result ? (
          <Button
            onClick={download}
            variant="outline"
            className="rounded-full border-[#C5A880]"
          >
            <Download /> Download merged PDF
          </Button>
        ) : null}
      </div>
    </div>
  );
}
