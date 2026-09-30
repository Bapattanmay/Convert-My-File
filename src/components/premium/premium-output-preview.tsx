"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/file-utils";
import {
  classifyZipEntry,
  getPreviewPdfPageCount,
  listZipPreviewEntries,
  readZipEntryBytes,
  renderPdfPage,
  type ZipPreviewEntry,
} from "@/lib/pdf-preview";

export type PreviewKind = "pdf" | "zip" | "image" | "audio" | "video" | "auto";

type Props = {
  blob: Blob | null;
  /** Heading shown in the preview chrome */
  title?: string;
  filename?: string;
  kind?: PreviewKind;
  testId?: string;
};

function sniffKind(blob: Blob, filename?: string): Exclude<PreviewKind, "auto"> {
  const name = (filename || "").toLowerCase();
  const type = (blob.type || "").toLowerCase();
  if (name.endsWith(".zip") || type.includes("zip")) return "zip";
  if (name.endsWith(".pdf") || type.includes("pdf")) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(name))
    return "image";
  if (type.startsWith("audio/") || /\.(mp3|m4a|wav)$/.test(name)) return "audio";
  if (type.startsWith("video/") || /\.(mp4|mov|webm)$/.test(name)) return "video";
  // ZIP magic PK
  return "pdf";
}

export function PremiumOutputPreview({
  blob,
  title = "PREVIEW",
  filename,
  kind = "auto",
  testId = "premium-preview",
}: Props) {
  const [resolved, setResolved] = useState<Exclude<PreviewKind, "auto"> | null>(
    null
  );
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zipEntries, setZipEntries] = useState<ZipPreviewEntry[]>([]);
  const [zipPick, setZipPick] = useState<string | null>(null);
  const [zipBytes, setZipBytes] = useState<ArrayBuffer | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setResolved(null);
      setPageCount(0);
      setPage(1);
      setPageUrl(null);
      setZipEntries([]);
      setZipPick(null);
      setZipBytes(null);
      setTextPreview(null);
      setError(null);
      return;
    }
    const k = kind === "auto" ? sniffKind(blob, filename) : kind;
    setResolved(k);
    setPage(1);
    setPageUrl(null);
    setZipPick(null);
    setTextPreview(null);
    setError(null);

    let cancelled = false;
    setBusy(true);
    void (async () => {
      try {
        if (k === "pdf") {
          const ab = await blob.arrayBuffer();
          const count = await getPreviewPdfPageCount(ab);
          if (cancelled) return;
          setPageCount(count);
          const rendered = await renderPdfPage(ab, 1);
          if (cancelled) return;
          setPageUrl(rendered.dataUrl);
        } else if (k === "zip") {
          const ab = await blob.arrayBuffer();
          const entries = await listZipPreviewEntries(ab);
          if (cancelled) return;
          setZipBytes(ab);
          setZipEntries(entries);
          const firstPreviewable = entries.find(
            (e) =>
              e.kind === "pdf" || e.kind === "image" || e.kind === "text"
          );
          if (firstPreviewable) setZipPick(firstPreviewable.name);
        } else if (k === "image" || k === "audio" || k === "video") {
          const url = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          setObjectUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Preview failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, filename, kind]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  // PDF page navigation
  useEffect(() => {
    if (!blob || resolved !== "pdf" || pageCount < 1) return;
    let cancelled = false;
    setBusy(true);
    void blob
      .arrayBuffer()
      .then((ab) => renderPdfPage(ab, page))
      .then((r) => {
        if (!cancelled) setPageUrl(r.dataUrl);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Page render failed");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [blob, resolved, page, pageCount]);

  // ZIP entry preview
  useEffect(() => {
    if (!zipBytes || !zipPick) {
      setPageUrl(null);
      setPageCount(0);
      setTextPreview(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const bytes = await readZipEntryBytes(zipBytes, zipPick);
        const entryKind = classifyZipEntry(zipPick);
        if (cancelled) return;
        if (entryKind === "pdf") {
          const count = await getPreviewPdfPageCount(bytes);
          if (cancelled) return;
          setPageCount(count);
          setPage(1);
          setPageUrl(null);
          setTextPreview(null);
        } else if (entryKind === "image") {
          const lower = zipPick.toLowerCase();
          const mime = lower.endsWith(".png")
            ? "image/png"
            : lower.endsWith(".webp")
              ? "image/webp"
              : lower.endsWith(".gif")
                ? "image/gif"
                : "image/jpeg";
          const url = URL.createObjectURL(
            new Blob([bytes.slice()], { type: mime })
          );
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          setObjectUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          setPageCount(0);
          setPageUrl(null);
          setTextPreview(null);
        } else if (entryKind === "text") {
          const text = new TextDecoder().decode(bytes).slice(0, 4000);
          if (cancelled) return;
          setTextPreview(text);
          setPageCount(0);
          setPageUrl(null);
        } else {
          setTextPreview(`Binary file (${bytes.byteLength} bytes) — download the pack to open.`);
          setPageCount(0);
          setPageUrl(null);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Entry preview failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zipBytes, zipPick]);

  // Browse pages inside a selected ZIP PDF entry
  useEffect(() => {
    if (!zipBytes || !zipPick || pageCount < 1) return;
    if (classifyZipEntry(zipPick) !== "pdf") return;
    let cancelled = false;
    setBusy(true);
    void readZipEntryBytes(zipBytes, zipPick)
      .then((bytes) => renderPdfPage(bytes, page))
      .then((r) => {
        if (!cancelled) setPageUrl(r.dataUrl);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageCount, zipBytes, zipPick]);

  if (!blob) return null;

  return (
    <div
      className="mt-4 rounded-2xl border border-[#E8E2D6] bg-white p-4"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#C5A880]">
          {title}
        </p>
        <p className="text-xs text-[#64748B]" data-testid={`${testId}-meta`}>
          {formatBytes(blob.size)}
          {filename ? ` · ${filename}` : ""}
          {resolved === "pdf" && pageCount
            ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}`
            : ""}
          {resolved === "zip" && zipEntries.length
            ? ` · ${zipEntries.length} file${zipEntries.length === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>
      <p className="mt-1 text-xs text-[#64748B]">
        Confirm the output before download
        {resolved === "pdf" && pageCount > 1
          ? " — browse every page with Previous / Next"
          : ""}
        {resolved === "zip" ? " — pick a file in the pack to preview" : ""}.
      </p>

      {resolved === "zip" && zipEntries.length ? (
        <ul
          className="mt-3 max-h-36 space-y-1 overflow-y-auto rounded-xl bg-[#F7F4EE] p-2"
          data-testid={`${testId}-zip-list`}
        >
          {zipEntries.map((e) => (
            <li key={e.name}>
              <button
                type="button"
                onClick={() => {
                  setZipPick(e.name);
                  setPage(1);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                  zipPick === e.name
                    ? "bg-[#0F172A] text-[#D4AF37]"
                    : "text-[#0F172A] hover:bg-white"
                }`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {e.name}
                </span>
                <span className="shrink-0 opacity-70">{e.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {pageCount > 1 ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          data-testid={`${testId}-pager`}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            data-testid={`${testId}-prev`}
            disabled={page <= 1 || busy}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span
            className="min-w-[7rem] text-center text-xs font-semibold text-[#0F172A]"
            data-testid={`${testId}-page-indicator`}
          >
            Page {page} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            data-testid={`${testId}-next`}
            disabled={page >= pageCount || busy}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-xl bg-[#F7F4EE] ring-1 ring-[#E8E2D6]">
        {busy ? (
          <p className="flex items-center gap-2 px-3 py-8 text-xs text-[#94A3B8]">
            <Loader2 className="h-4 w-4 animate-spin" /> Rendering preview…
          </p>
        ) : null}
        {error ? (
          <p className="px-3 py-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {pageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pageUrl}
            alt={`Preview page ${page}`}
            className="mx-auto max-h-[520px] w-full object-contain object-top"
            data-testid={`${testId}-page-image`}
          />
        ) : null}
        {!pageUrl &&
        objectUrl &&
        (resolved === "image" ||
          (resolved === "zip" &&
            zipPick &&
            classifyZipEntry(zipPick) === "image")) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={objectUrl}
            alt="Preview"
            className="mx-auto max-h-[520px] w-full object-contain"
            data-testid={`${testId}-image`}
          />
        ) : null}
        {!pageUrl && objectUrl && resolved === "audio" ? (
          <div className="p-4" data-testid={`${testId}-audio`}>
            <audio controls src={objectUrl} className="w-full" />
          </div>
        ) : null}
        {!pageUrl && objectUrl && resolved === "video" ? (
          <div className="p-2" data-testid={`${testId}-video`}>
            <video controls src={objectUrl} className="mx-auto max-h-[360px] w-full" />
          </div>
        ) : null}
        {textPreview ? (
          <pre
            className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs text-[#475569]"
            data-testid={`${testId}-text`}
          >
            {textPreview}
          </pre>
        ) : null}
        {!busy &&
        !error &&
        !pageUrl &&
        !objectUrl &&
        !textPreview &&
        resolved === "zip" &&
        !zipPick ? (
          <p className="px-3 py-6 text-xs text-[#94A3B8]">
            Select a file above to preview.
          </p>
        ) : null}
      </div>
    </div>
  );
}
