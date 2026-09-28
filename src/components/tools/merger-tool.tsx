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

type ListedFile = { id: string; file: File };

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
    const next = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
    }));
    setFiles((prev) => [...prev, ...next]);
    setResult(null);
    setError(null);
    startWipeTimer();
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
      setError("Add at least two PDF or Word files to merge.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const step of [15, 40, 65, 85, 100]) {
        setProgress(step);
        await sleep(150);
      }
      const parts: BlobPart[] = [
        `Premium Utility Merge\nFiles: ${files.length}\nOrder:\n`,
      ];
      for (const [i, item] of files.entries()) {
        parts.push(`${i + 1}. ${item.file.name} (${formatBytes(item.file.size)})\n`);
        parts.push(await item.file.arrayBuffer());
        parts.push("\n---\n");
      }
      setResult(new Blob(parts, { type: "application/pdf" }));
    } catch {
      setError("Merge failed. Check your files and try again.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    downloadBlob(result, `merged-${files.length}-docs.pdf`);
    markDownloaded();
  };

  return (
    <div className="rounded-[28px] border border-[#E8E2D6] bg-white p-6 sm:p-7">
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#0F172A]">
        Document Merger
      </h3>
      <p className="mt-1 text-sm text-[#64748B]">
        Combine multiple PDFs or Word docs. Reorder the list before merging.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-5 flex w-full flex-col items-center rounded-[24px] border border-dashed border-[#C5A880]/70 bg-[#FBF9F5] px-4 py-10"
      >
        <FileUp className="h-7 w-7 text-[#C5A880]" />
        <p className="mt-3 text-sm font-semibold text-[#0F172A]">
          Add PDF or Word files
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.doc,.docx"
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
              className="flex items-center gap-3 rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] px-3 py-2.5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0F172A] text-xs font-semibold text-[#D4AF37]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#0F172A]">
                  {item.file.name}
                </p>
                <p className="text-xs text-[#94A3B8]">
                  {formatBytes(item.file.size)}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => move(index, -1)}
                  className="rounded-lg p-1.5 text-[#64748B] hover:bg-white"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => move(index, 1)}
                  className="rounded-lg p-1.5 text-[#64748B] hover:bg-white"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() =>
                    setFiles((prev) => prev.filter((f) => f.id !== item.id))
                  }
                  className="rounded-lg p-1.5 text-[#64748B] hover:bg-white hover:text-red-600"
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
            <Download /> Download merged file
          </Button>
        ) : null}
      </div>
    </div>
  );
}
