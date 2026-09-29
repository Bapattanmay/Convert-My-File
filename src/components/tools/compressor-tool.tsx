"use client";

import { useRef, useState } from "react";
import { Download, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useWipeTimer } from "@/components/wipe-provider";
import {
  downloadBlob,
  formatBytes,
  resizeToExactBytes,
  sleep,
} from "@/lib/file-utils";

type Unit = "KB" | "MB";

function parseTargetBytes(value: string, unit: Unit): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Exact integer bytes from KB/MB entry
  const factor = unit === "KB" ? 1024 : 1024 * 1024;
  return Math.round(n * factor);
}

export function CompressorTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [file, setFile] = useState<File | null>(null);
  const [targetValue, setTargetValue] = useState("500");
  const [unit, setUnit] = useState<Unit>("KB");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetBytes = parseTargetBytes(targetValue, unit);

  const mode =
    file && targetBytes
      ? targetBytes < file.size
        ? "Compress"
        : targetBytes > file.size
          ? "Expand"
          : "Match"
      : "Resize";

  const onPick = (picked: File | null) => {
    if (!picked) return;
    const name = picked.name.toLowerCase();
    const ok =
      /\.(pdf|doc|docx|jpe?g|png|webp|gif)$/i.test(name) ||
      /^(image\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats)/.test(
        picked.type || ""
      );
    if (!ok) {
      setFile(null);
      setResult(null);
      setError(
        `This file format is not supported (${picked.name}). Upload an image, PDF, or Word file.`
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(picked);
    setResult(null);
    setError(null);
    startWipeTimer();
  };

  const run = async () => {
    if (!file) {
      setError("Upload an image, PDF, or Word file.");
      return;
    }
    if (!targetBytes) {
      setError("Enter a valid target size greater than zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const step of [22, 48, 72, 91]) {
        setProgress(step);
        await sleep(100);
      }
      const buf = await file.arrayBuffer();
      const blob = await resizeToExactBytes(
        buf,
        targetBytes,
        file.type || "application/octet-stream"
      );
      // Hard guarantee: output byte length must equal target
      if (blob.size !== targetBytes) {
        throw new Error(
          `Exact size failed: got ${blob.size} bytes, expected ${targetBytes}.`
        );
      }
      setProgress(100);
      setResult(blob);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not reach the exact target size. Try again."
      );
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result || !file) return;
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : "";
    downloadBlob(
      result,
      `${file.name.replace(/\.[^.]+$/, "")}.${targetValue}${unit.toLowerCase()}${ext}`
    );
    markDownloaded();
  };

  return (
    <div className="rounded-[28px] border border-[#E8E2D6]/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] backdrop-blur-sm sm:p-7">
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[#0F172A]">
        Compressor / Expander
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-[#64748B]">
        Enter an exact target in KB or MB. Output byte length matches that
        target exactly.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-5 flex w-full flex-col items-center rounded-[24px] border border-dashed border-[#C5A880]/70 bg-gradient-to-b from-[#FBF9F5] to-[#F7F4EE] px-4 py-10 transition hover:border-[#D4AF37]"
      >
        <FileUp className="h-7 w-7 text-[#C5A880]" />
        <p className="mt-3 text-sm font-semibold text-[#0F172A]">
          Upload image, PDF, or Word
        </p>
        {file ? (
          <p className="mt-3 text-xs text-[#64748B]">
            {file.name} · {formatBytes(file.size)} · {file.size.toLocaleString()}{" "}
            bytes
          </p>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="target-size" className="text-[#64748B]">
            Exact target size
          </Label>
          <Input
            id="target-size"
            type="number"
            min="0.001"
            step="any"
            value={targetValue}
            onChange={(e) => {
              setTargetValue(e.target.value);
              setResult(null);
            }}
            className="mt-2 h-11 rounded-2xl border-[#E8E2D6]"
          />
        </div>
        <div>
          <Label className="text-[#64748B]">Unit</Label>
          <div className="mt-2 flex rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] p-1">
            {(["KB", "MB"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setUnit(u);
                  setResult(null);
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  unit === u
                    ? "bg-[#0F172A] text-[#D4AF37]"
                    : "text-[#64748B]"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#101828] px-4 py-3 text-sm text-[#CBD5E1] ring-1 ring-[#D4AF37]/15">
        <p>
          Mode: <span className="font-semibold text-[#D4AF37]">{mode}</span>
        </p>
        <p className="mt-1">
          Exact target:{" "}
          <span className="font-semibold text-white">
            {targetValue || "—"} {unit}
          </span>
          {targetBytes ? (
            <span className="text-[#94A3B8]" data-testid="target-bytes">
              {" "}
              ({targetBytes.toLocaleString()} bytes)
            </span>
          ) : null}
        </p>
        {result ? (
          <p
            className="mt-1 text-[#86EFAC]"
            data-testid="output-bytes"
            data-bytes={result.size}
          >
            Output size: {formatBytes(result.size)} ·{" "}
            {result.size.toLocaleString()} bytes
            {targetBytes && result.size === targetBytes
              ? " · exact match"
              : " · MISMATCH"}
          </p>
        ) : null}
      </div>

      {busy ? (
        <div className="mt-4 space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-[#64748B]">
            {mode === "Expand" ? "Expanding" : "Compressing"}… {progress}%
          </p>
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          onClick={() => void run()}
          disabled={busy}
          className="rounded-full bg-[#0F172A] text-white hover:bg-[#1E293B]"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" /> Working
            </>
          ) : (
            `${mode} to exact size`
          )}
        </Button>
        {result ? (
          <Button
            onClick={download}
            variant="outline"
            className="rounded-full border-[#C5A880]"
          >
            <Download /> Download result
          </Button>
        ) : null}
      </div>
    </div>
  );
}
