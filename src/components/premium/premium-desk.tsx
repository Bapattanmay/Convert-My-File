"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Crown,
  Download,
  FileUp,
  Loader2,
  Sparkles,
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PremiumUpgradeCard } from "@/components/premium/premium-upgrade-card";
import { useAuth } from "@/components/auth-provider";
import { usePremium } from "@/hooks/use-premium";
import { useWipeTimer } from "@/components/wipe-provider";
import { downloadBlob, formatBytes, sleep } from "@/lib/file-utils";
import {
  OUTPUT_FORMATS,
  type FormatId,
  acceptAttribute,
  formatLabel,
} from "@/lib/convert";
import { batchConvertToZip } from "@/lib/premium-batch-convert";
import {
  pdfToEditableDoc,
  editedTextToPdf,
  editedDocxToPdf,
} from "@/lib/premium-pdf-editor";
import {
  translateToManyLanguages,
  langResultsToZip,
  PREMIUM_LANG_BATCH_MAX,
  type LangBatchResult,
} from "@/lib/premium-translate-batch";
import { TRANSLATOR_LANGUAGES } from "@/lib/languages";
import {
  detectMergeKind,
  mergeAcceptAttribute,
} from "@/lib/merge";
import {
  addDigitalSignature,
  getPdfPageCount,
  mergeAndCompress,
  mergeWithPageRanges,
  parsePageList,
  type RangedMergeInput,
} from "@/lib/premium-merge";
import {
  compressToExactTargets,
  encodeImageQuality,
  isAudioMedia,
  isImageMedia,
  isVideoMedia,
  mediaToTargetSize,
} from "@/lib/premium-media";

type PanelId =
  | "batch"
  | "pdf-editor"
  | "multi-lang"
  | "page-merge"
  | "merge-compress"
  | "sign"
  | "quality"
  | "media"
  | "bulk";

const PANELS: { id: PanelId; title: string; blurb: string }[] = [
  {
    id: "batch",
    title: "Batch convert → ZIP",
    blurb: "20+ files to one archive. Free: 1 file.",
  },
  {
    id: "pdf-editor",
    title: "PDF editor round-trip",
    blurb: "PDF → editable DOC → back to PDF.",
  },
  {
    id: "multi-lang",
    title: "5-language batch",
    blurb: "One doc → five languages + download pack.",
  },
  {
    id: "page-merge",
    title: "Page-range merge",
    blurb: "Pick any pages per file (e.g. 1,5,8 + 2,4,9).",
  },
  {
    id: "merge-compress",
    title: "Merge + compress",
    blurb: "Combine then hit an exact size target.",
  },
  {
    id: "sign",
    title: "Digital signature",
    blurb: "Stamp a signature block on PDF/DOC.",
  },
  {
    id: "quality",
    title: "Quality before / after",
    blurb: "Image quality slider with live preview.",
  },
  {
    id: "media",
    title: "Video & audio size",
    blurb: "MP4, MOV, MP3 to a target byte size.",
  },
  {
    id: "bulk",
    title: "Bulk per-file targets",
    blurb: "Different size limits per file in one ZIP.",
  },
];

export function PremiumDesk() {
  const { user, setLoginOpen, trackFeature } = useAuth();
  const { isPremium, loading } = usePremium();
  const [panel, setPanel] = useState<PanelId>("batch");

  useEffect(() => {
    if (isPremium) trackFeature("premium");
  }, [isPremium, trackFeature]);

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[#E8E2D6]/90 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37]/35">
            <Crown className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#D4AF37]">
              PREMIUM DESK
            </p>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              Batch, edit, sign, and size — beyond one file
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Free tools stay single-file. Premium workflows live here: batch
              ZIP convert, PDF editor, multi-language packs, page-range merge,
              signatures, quality previews, and media/bulk compress.
            </p>
          </div>
        </div>
      </div>

      <PremiumUpgradeCard />

      {!user ? (
        <p className="text-center text-sm text-[#64748B]">
          <button
            type="button"
            className="font-semibold text-[#0F172A] underline-offset-2 hover:underline"
            onClick={() => setLoginOpen(true)}
          >
            Sign in with Google
          </button>{" "}
          then Upgrade (or use a PREMIUM_EMAILS allowlisted account).
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#64748B]">Checking Premium…</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPanel(p.id)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              panel === p.id
                ? "border-[#0F172A] bg-[#0F172A] text-white shadow-lg"
                : "border-[#E8E2D6] bg-white/90 text-[#0F172A] hover:border-[#C5A880]"
            }`}
          >
            <p className="text-sm font-semibold">{p.title}</p>
            <p
              className={`mt-1 text-xs leading-relaxed ${
                panel === p.id ? "text-slate-300" : "text-[#64748B]"
              }`}
            >
              {p.blurb}
            </p>
          </button>
        ))}
      </div>

      <div className="rounded-[28px] border border-[#E8E2D6]/80 bg-white/95 p-5 sm:p-6">
        {!isPremium ? (
          <div className="py-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[#C5A880]" />
            <p className="mt-3 font-semibold text-[#0F172A]">
              Premium required for this workflow
            </p>
            <p className="mt-1 text-sm text-[#64748B]">
              Use Upgrade above, or sign in as an allowlisted Premium email.
            </p>
          </div>
        ) : (
          <>
            {panel === "batch" ? <BatchPanel /> : null}
            {panel === "pdf-editor" ? <PdfEditorPanel /> : null}
            {panel === "multi-lang" ? <MultiLangPanel /> : null}
            {panel === "page-merge" ? <PageMergePanel /> : null}
            {panel === "merge-compress" ? <MergeCompressPanel /> : null}
            {panel === "sign" ? <SignPanel /> : null}
            {panel === "quality" ? <QualityPanel /> : null}
            {panel === "media" ? <MediaPanel /> : null}
            {panel === "bulk" ? <BulkPanel /> : null}
          </>
        )}
      </div>
    </div>
  );
}

function BatchPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState<FormatId>("pdf");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!files.length) {
      setError("Add files to batch convert.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { zip, okCount, failCount, items } = await batchConvertToZip(
        files,
        target,
        (done, total) => setProgress(Math.round((done / total) * 100))
      );
      setResult(zip);
      setSummary(
        `${okCount} converted${failCount ? `, ${failCount} skipped` : ""} · ${items
          .filter((i) => i.ok)
          .map((i) => i.name)
          .slice(0, 4)
          .join(", ")}${okCount > 4 ? "…" : ""}`
      );
      startWipeTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Batch conversion"
      desc="Convert many files to one format and download a ZIP (Premium)."
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center rounded-[22px] border border-dashed border-[#C5A880]/70 bg-[#FBF9F5] px-4 py-7"
      >
        <FileUp className="h-6 w-6 text-[#C5A880]" />
        <p className="mt-2 text-sm font-semibold">
          {files.length
            ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
            : "Add 2–50 files"}
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={acceptAttribute()}
        onChange={(e) => {
          setFiles(Array.from(e.target.files || []));
          setResult(null);
          e.target.value = "";
        }}
      />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-[#64748B]">Output format</Label>
          <select
            className="mt-1 rounded-xl border border-[#E8E2D6] bg-white px-3 py-2 text-sm"
            value={target}
            onChange={(e) => setTarget(e.target.value as FormatId)}
          >
            {OUTPUT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {formatLabel(f)}
              </option>
            ))}
          </select>
        </div>
        <Button
          disabled={busy}
          onClick={() => void run()}
          className="rounded-full bg-[#0F172A] text-white"
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Convert to ZIP
        </Button>
        {result ? (
          <Button
            variant="outline"
            className="rounded-full border-[#C5A880]"
            onClick={() => {
              downloadBlob(result, `batch-${target}.zip`);
              markDownloaded();
            }}
          >
            <Download /> Download ZIP ({formatBytes(result.size)})
          </Button>
        ) : null}
      </div>
      {busy ? <Progress value={progress} className="mt-3 h-2" /> : null}
      {summary ? (
        <p className="mt-2 text-xs text-emerald-700">{summary}</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </PanelShell>
  );
}

function PdfEditorPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [text, setText] = useState("");
  const [docx, setDocx] = useState<Blob | null>(null);
  const [base, setBase] = useState("document");
  const [pdfOut, setPdfOut] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPdf = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPdfOut(null);
    try {
      const session = await pdfToEditableDoc(file);
      setText(session.plainText);
      setDocx(session.docxBlob);
      setBase(session.sourceName);
      startWipeTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open PDF");
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await editedTextToPdf(text, base);
      setPdfOut(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const fromEditedDocx = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await editedDocxToPdf(file);
      setPdfOut(blob);
      startWipeTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "DOCX import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="PDF editor"
      desc="Convert PDF to an editable DOC, revise text, export PDF again."
    >
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp /> Open PDF
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          data-testid="premium-pdf-open"
          onChange={(e) => {
            void openPdf(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />
        {docx ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-[#C5A880]"
            onClick={() => {
              downloadBlob(docx, `${base}.editable.docx`);
              markDownloaded();
            }}
          >
            <Download /> Download editable DOC
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => editRef.current?.click()}
        >
          Import edited DOC → PDF
        </Button>
        <input
          ref={editRef}
          type="file"
          accept=".docx,.doc"
          className="hidden"
          data-testid="premium-pdf-import-docx"
          onChange={(e) => {
            void fromEditedDocx(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />
      </div>
      {text ? (
        <textarea
          className="mt-4 h-48 w-full rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] p-3 text-sm text-[#0F172A]"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={busy || !text}
          onClick={() => void exportPdf()}
          className="rounded-full bg-[#0F172A] text-white"
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Export edited PDF
        </Button>
        {pdfOut ? (
          <Button
            variant="outline"
            className="rounded-full border-[#C5A880]"
            onClick={() => {
              downloadBlob(pdfOut, `${base}.edited.pdf`);
              markDownloaded();
            }}
          >
            <Download /> Download PDF ({formatBytes(pdfOut.size)})
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </PanelShell>
  );
}

function MultiLangPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [source, setSource] = useState("");
  const [picked, setPicked] = useState<string[]>([
    "hindi",
    "tamil",
    "spanish",
    "french",
    "german",
  ]);
  const [results, setResults] = useState<LangBatchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zip, setZip] = useState<Blob | null>(null);

  const options = useMemo(
    () =>
      TRANSLATOR_LANGUAGES.filter((l) =>
        [
          "hindi",
          "bengali",
          "tamil",
          "telugu",
          "marathi",
          "spanish",
          "french",
          "german",
          "japanese",
          "arabic",
          "portuguese",
          "english",
        ].includes(l.code)
      ),
    []
  );

  const loadFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const name = file.name.toLowerCase();
      let text = "";
      if (name.endsWith(".txt")) text = await file.text();
      else if (name.endsWith(".docx") || name.endsWith(".doc")) {
        const { extractDocxContent } = await import("@/lib/office-extract");
        text = (await extractDocxContent(file)).text;
      } else if (name.endsWith(".pdf")) {
        const { extractPdfBlocks, blocksToPlainText } = await import(
          "@/lib/pdf-extract"
        );
        text = blocksToPlainText(await extractPdfBlocks(file));
      } else {
        throw new Error("Upload TXT, Word, or PDF.");
      }
      setSource(text.slice(0, 3500));
      startWipeTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read file");
    }
  };

  const toggle = (code: string) => {
    setPicked((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= PREMIUM_LANG_BATCH_MAX) return prev;
      return [...prev, code];
    });
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setZip(null);
    try {
      const langs = picked
        .map((code) => {
          const hit = TRANSLATOR_LANGUAGES.find((l) => l.code === code);
          return hit ? { code: hit.code, label: hit.label } : null;
        })
        .filter(Boolean) as { code: string; label: string }[];
      const out = await translateToManyLanguages(source, langs, (d, t) =>
        setProgress(Math.round((d / t) * 100))
      );
      setResults(out);
      const pack = await langResultsToZip(out, "batch");
      setZip(pack);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch translate failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Multi-language batch"
      desc={`Translate one document into up to ${PREMIUM_LANG_BATCH_MAX} languages at once.`}
    >
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp /> Load document
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".txt,.pdf,.doc,.docx"
        onChange={(e) => {
          void loadFile(e.target.files?.[0] || null);
          e.target.value = "";
        }}
      />
      <textarea
        className="mt-3 h-28 w-full rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] p-3 text-sm"
        placeholder="Or paste source text…"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((l) => {
          const on = picked.includes(l.code);
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => toggle(l.code)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                on
                  ? "bg-[#0F172A] text-[#D4AF37]"
                  : "bg-[#F3EEE4] text-[#64748B]"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[#94A3B8]">
        Selected {picked.length}/{PREMIUM_LANG_BATCH_MAX}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={busy || !source.trim() || !picked.length}
          onClick={() => void run()}
          className="rounded-full bg-[#0F172A] text-white"
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Translate batch
        </Button>
        {zip ? (
          <Button
            variant="outline"
            className="rounded-full border-[#C5A880]"
            data-testid="premium-5lang-download"
            onClick={() => {
              downloadBlob(zip, "translations-pack.zip");
              markDownloaded();
            }}
          >
            <Download /> Download pack
          </Button>
        ) : null}
      </div>
      {busy ? <Progress value={progress} className="mt-3 h-2" /> : null}
      {results.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {results.map((r) => (
            <div
              key={r.code}
              className="rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] p-3"
            >
              <p className="text-xs font-semibold text-[#0F172A]">{r.label}</p>
              <p className="mt-1 max-h-24 overflow-y-auto text-xs text-[#475569] whitespace-pre-wrap">
                {r.ok ? r.text.slice(0, 400) : r.error}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </PanelShell>
  );
}

type MergeRow = {
  id: string;
  file: File;
  kind: NonNullable<ReturnType<typeof detectMergeKind>>;
  pageCount: number;
  /** Selected pages in merge order (1-based). */
  pages: number[];
  /** Draft comma list (may be mid-edit). */
  pagesText: string;
  /** Draft From/To — strings so empty/`5` typing works; commit on blur. */
  fromText: string;
  toText: string;
};

function pagesToText(pages: number[]): string {
  return pages.join(", ");
}

function applyContiguousDraft(
  fromText: string,
  toText: string,
  pageCount: number
): number[] | null {
  if (fromText.trim() === "" || toText.trim() === "") return null;
  const start = Number(fromText);
  const end = Number(toText);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const a = Math.max(1, Math.min(Math.floor(start), pageCount));
  const b = Math.max(1, Math.min(Math.floor(end), pageCount));
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

function PageMergePanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [rows, setRows] = useState<MergeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultPages, setResultPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const updateRow = (id: string, patch: Partial<MergeRow>) => {
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setResult(null);
    setResultPages(0);
  };

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const next: MergeRow[] = [];
    for (const file of Array.from(list)) {
      const kind = detectMergeKind(file);
      if (!kind) {
        setError(`Unsupported: ${file.name}`);
        continue;
      }
      let pageCount = 1;
      if (kind === "pdf") {
        try {
          pageCount = await getPdfPageCount(file);
        } catch {
          pageCount = 1;
        }
      }
      const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
      next.push({
        id: crypto.randomUUID(),
        file,
        kind,
        pageCount,
        pages,
        pagesText: pagesToText(pages),
        fromText: "1",
        toText: String(pageCount),
      });
    }
    setRows((prev) => [...prev, ...next]);
    setResult(null);
    setResultPages(0);
    startWipeTimer();
  };

  const togglePage = (id: string, page: number) => {
    setRows((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const idx = x.pages.indexOf(page);
        const pages =
          idx >= 0
            ? x.pages.filter((p) => p !== page)
            : [...x.pages, page];
        return {
          ...x,
          pages,
          pagesText: pagesToText(pages),
          fromText: pages.length ? String(Math.min(...pages)) : "",
          toText: pages.length ? String(Math.max(...pages)) : "",
        };
      })
    );
    setResult(null);
    setResultPages(0);
  };

  const commitPagesText = (id: string, pageCount: number, text: string) => {
    const pages = parsePageList(text, pageCount);
    updateRow(id, {
      pages,
      pagesText: pagesToText(pages),
      fromText: pages.length ? String(Math.min(...pages)) : "",
      toText: pages.length ? String(Math.max(...pages)) : "",
    });
  };

  const commitFromTo = (id: string, pageCount: number, fromText: string, toText: string) => {
    const pages = applyContiguousDraft(fromText, toText, pageCount);
    if (!pages) {
      // Keep draft strings; don't force `1` while empty/invalid
      updateRow(id, { fromText, toText });
      return;
    }
    updateRow(id, {
      pages,
      pagesText: pagesToText(pages),
      fromText: String(pages[0]),
      toText: String(pages[pages.length - 1]),
    });
  };

  const mergePlan = useMemo(() => {
    return rows.map((r) => ({
      id: r.id,
      name: r.file.name,
      kind: r.kind,
      pages: r.kind === "pdf" ? r.pages : null,
      label:
        r.kind === "pdf"
          ? r.pages.length
            ? r.pages.join(", ")
            : "(none selected)"
          : "full extract",
    }));
  }, [rows]);

  const totalSelected = mergePlan.reduce(
    (n, r) => n + (r.pages ? r.pages.length : 1),
    0
  );

  const run = async () => {
    if (rows.length < 1) {
      setError("Add PDF/Word/PPT files.");
      return;
    }
    for (const r of rows) {
      if (r.kind === "pdf" && r.pages.length < 1) {
        setError(`Select at least one page from ${r.file.name}.`);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const inputs: RangedMergeInput[] = rows.map((r) => ({
        file: r.file,
        kind: r.kind,
        pages: r.kind === "pdf" ? r.pages : undefined,
      }));
      const blob = await mergeWithPageRanges(inputs);
      setResult(blob);
      // Count pages in output for preview confirmation
      try {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(await blob.arrayBuffer());
        setResultPages(doc.getPageCount());
      } catch {
        setResultPages(totalSelected);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Page-range merge"
      desc="Click page chips in any order, or type a comma list (e.g. 1,5,8). From/To sets a contiguous block on blur."
    >
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp /> Add files
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={mergeAcceptAttribute()}
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] p-3"
            data-testid="page-merge-row"
          >
            <p className="truncate text-sm font-medium">{r.file.name}</p>
            <p className="text-xs text-[#94A3B8]">
              {r.kind.toUpperCase()}
              {r.kind === "pdf" ? ` · ${r.pageCount} pages` : " · full extract"}
            </p>
            {r.kind === "pdf" ? (
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    className="w-16"
                    data-testid="page-merge-from"
                    value={r.fromText}
                    onChange={(e) =>
                      updateRow(r.id, { fromText: e.target.value })
                    }
                    onBlur={() =>
                      commitFromTo(r.id, r.pageCount, r.fromText, r.toText)
                    }
                  />
                  <Label className="text-xs">To</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    className="w-16"
                    data-testid="page-merge-to"
                    value={r.toText}
                    onChange={(e) =>
                      updateRow(r.id, { toText: e.target.value })
                    }
                    onBlur={() =>
                      commitFromTo(r.id, r.pageCount, r.fromText, r.toText)
                    }
                  />
                  <span className="text-[10px] text-[#94A3B8]">
                    contiguous on blur
                  </span>
                </div>
                <div>
                  <Label className="text-xs">Pages (comma list)</Label>
                  <Input
                    className="mt-1"
                    data-testid="page-merge-list"
                    placeholder="e.g. 1,5,8 or 2-4,9"
                    value={r.pagesText}
                    onChange={(e) =>
                      updateRow(r.id, { pagesText: e.target.value })
                    }
                    onBlur={() =>
                      commitPagesText(r.id, r.pageCount, r.pagesText)
                    }
                  />
                </div>
                <div
                  className="flex flex-wrap gap-1"
                  data-testid="page-merge-chips"
                >
                  {Array.from({ length: r.pageCount }, (_, i) => {
                    const page = i + 1;
                    const order = r.pages.indexOf(page);
                    const on = order >= 0;
                    return (
                      <button
                        key={page}
                        type="button"
                        aria-pressed={on}
                        aria-label={`Page ${page}${on ? ` selected #${order + 1}` : ""}`}
                        onClick={() => togglePage(r.id, page)}
                        className={`relative flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-[11px] font-bold transition ${
                          on
                            ? "bg-[#0F172A] text-[#D4AF37]"
                            : "bg-white text-[#94A3B8] hover:border-[#C5A880] border border-[#E8E2D6]"
                        }`}
                      >
                        {page}
                        {on ? (
                          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#D4AF37] text-[8px] font-bold text-[#0F172A]">
                            {order + 1}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[#64748B]">
                  Selected order:{" "}
                  <span className="font-medium text-[#0F172A]">
                    {r.pages.length ? r.pages.join(" → ") : "none"}
                  </span>
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {rows.length ? (
        <div
          className="mt-4 rounded-2xl border border-[#E8E2D6] bg-white p-4"
          data-testid="page-merge-preview"
        >
          <p className="text-xs font-semibold tracking-[0.14em] text-[#C5A880]">
            MERGE PREVIEW
          </p>
          <ol className="mt-2 space-y-1.5 text-sm text-[#0F172A]">
            {mergePlan.map((r, i) => (
              <li key={r.id}>
                <span className="font-semibold text-[#64748B]">{i + 1}.</span>{" "}
                <span className="font-medium">{r.name}</span>
                <span className="text-[#64748B]"> — pages </span>
                <span className="font-semibold">{r.label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-[#64748B]">
            Total output pages (planned):{" "}
            <span className="font-semibold text-[#0F172A]">{totalSelected}</span>
            {result ? (
              <>
                {" "}
                · Merged file:{" "}
                <span className="font-semibold text-emerald-700">
                  {resultPages} page{resultPages === 1 ? "" : "s"} ·{" "}
                  {formatBytes(result.size)}
                </span>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={busy || !rows.length}
          onClick={() => void run()}
          className="rounded-full bg-[#0F172A] text-white"
          data-testid="page-merge-run"
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Merge selected pages
        </Button>
        {result ? (
          <Button
            variant="outline"
            className="rounded-full border-[#C5A880]"
            data-testid="premium-page-range-download"
            onClick={() => {
              downloadBlob(result, "page-range-merge.pdf");
              markDownloaded();
            }}
          >
            <Download /> Download ({formatBytes(result.size)})
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </PanelShell>
  );
}

function MergeCompressPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [files, setFiles] = useState<RangedMergeInput[]>([]);
  const [kb, setKb] = useState("400");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const target = Math.round(Number(kb) * 1024);
    if (!files.length || !(target > 0)) {
      setError("Add files and a valid KB target.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sleep(80);
      const blob = await mergeAndCompress(files, target);
      setResult(blob);
      startWipeTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Merge + compress"
      desc="One-pass: merge supported docs, then hit an exact size."
    >
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp /> Add files
      </Button>
      <input
        ref={inputRef}
        multiple
        type="file"
        className="hidden"
        accept={mergeAcceptAttribute()}
        onChange={(e) => {
          const list = Array.from(e.target.files || [])
            .map((file) => {
              const kind = detectMergeKind(file);
              return kind ? { file, kind } : null;
            })
            .filter(Boolean) as RangedMergeInput[];
          setFiles(list);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-[#64748B]">
        {files.length
          ? files.map((f) => f.file.name).join(", ")
          : "No files yet"}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Target KB</Label>
          <Input
            className="mt-1 w-28"
            data-testid="premium-merge-compress-kb"
            value={kb}
            onChange={(e) => setKb(e.target.value)}
          />
        </div>
        <Button
          disabled={busy}
          onClick={() => void run()}
          className="rounded-full bg-[#0F172A] text-white"
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Merge & compress
        </Button>
        {result ? (
          <Button
            variant="outline"
            className="rounded-full border-[#C5A880]"
            data-testid="premium-merge-compress-download"
            onClick={() => {
              downloadBlob(result, `merged-${kb}kb.pdf`);
              markDownloaded();
            }}
          >
            <Download /> {formatBytes(result.size)}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </PanelShell>
  );
}

function SignPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(user?.name || "Authorized Signer");
  const [reason, setReason] = useState("Approved");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) {
      setError("Upload a PDF or Word file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await addDigitalSignature(file, {
        signerName: name || "Signer",
        reason,
      });
      setResult(blob);
      startWipeTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Digital signature"
      desc="Insert a visible digital signature block and export PDF."
    >
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp /> {file ? file.name : "Upload PDF / DOC"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,application/pdf"
        onChange={(e) => {
          setFile(e.target.files?.[0] || null);
          setResult(null);
          e.target.value = "";
        }}
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Signer name</Label>
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Reason</Label>
          <Input
            className="mt-1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => void run()}
          className="rounded-full bg-[#0F172A] text-white"
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Apply signature
        </Button>
        {result ? (
          <Button
            variant="outline"
            className="rounded-full border-[#C5A880]"
            onClick={() => {
              downloadBlob(result, "signed.pdf");
              markDownloaded();
            }}
          >
            <Download /> Download signed PDF
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </PanelShell>
  );
}

function QualityPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [file, setFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState(0.55);
  const [afterBlob, setAfterBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      if (afterUrl) URL.revokeObjectURL(afterUrl);
    };
  }, [beforeUrl, afterUrl]);

  const onPick = (picked: File | null) => {
    if (!picked) return;
    if (!isImageMedia(picked)) {
      setError("Upload a JPG, PNG, or WebP image.");
      return;
    }
    setError(null);
    setFile(picked);
    setBeforeUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(picked);
    });
    setAfterUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAfterBlob(null);
    startWipeTimer();
  };

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setBusy(true);
      void encodeImageQuality(file, quality)
        .then(({ blob }) => {
          if (cancelled) return;
          setAfterBlob(blob);
          setAfterUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        })
        .catch((e) => {
          if (!cancelled)
            setError(e instanceof Error ? e.message : "Preview failed");
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [file, quality]);

  return (
    <PanelShell
      title="Quality before / after"
      desc="Drag the slider to preview compression quality side by side."
    >
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp /> {file ? file.name : "Upload image"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0] || null);
          e.target.value = "";
        }}
      />
      {file ? (
        <div className="mt-4">
          <Label className="text-xs">
            JPEG quality {Math.round(quality * 100)}%
            {afterBlob ? ` · after ${formatBytes(afterBlob.size)}` : ""}
            {file ? ` · before ${formatBytes(file.size)}` : ""}
          </Label>
          <input
            type="range"
            min={0.1}
            max={0.95}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <figure>
              <figcaption className="mb-1 text-xs font-semibold text-[#64748B]">
                Before
              </figcaption>
              {beforeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={beforeUrl}
                  alt="Before"
                  className="max-h-56 w-full rounded-2xl object-contain bg-[#F3EEE4]"
                />
              ) : null}
            </figure>
            <figure>
              <figcaption className="mb-1 text-xs font-semibold text-[#64748B]">
                After {busy ? "(updating…)" : ""}
              </figcaption>
              {afterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={afterUrl}
                  alt="After"
                  className="max-h-56 w-full rounded-2xl object-contain bg-[#F3EEE4]"
                />
              ) : null}
            </figure>
          </div>
          {afterBlob ? (
            <Button
              className="mt-3 rounded-full border-[#C5A880]"
              variant="outline"
              onClick={() => {
                downloadBlob(afterBlob, `${file.name.replace(/\.[^.]+$/, "")}.q${Math.round(quality * 100)}.jpg`);
                markDownloaded();
              }}
            >
              <Download /> Download after
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </PanelShell>
  );
}

function MediaPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [file, setFile] = useState<File | null>(null);
  const [mb, setMb] = useState("2");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!file) {
      setError("Upload MP4, MOV, or MP3.");
      return;
    }
    const target = Math.round(Number(mb) * 1024 * 1024);
    if (!(target > 0)) {
      setError("Enter a valid MB target.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await mediaToTargetSize(file, target);
      setResult(blob);
      startWipeTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Video & audio"
      desc="Hit an exact target size for MP4 / MOV / MP3 (client-side byte pack)."
    >
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp />{" "}
        {file
          ? `${file.name} (${isAudioMedia(file) ? "audio" : isVideoMedia(file) ? "video" : "file"})`
          : "Upload media"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".mp4,.mov,.mp3,.m4a,video/*,audio/*"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          if (f && !isVideoMedia(f) && !isAudioMedia(f)) {
            setError("Upload MP4, MOV, or MP3.");
            setFile(null);
          } else {
            setError(null);
            setFile(f);
            setResult(null);
          }
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Target MB</Label>
          <Input
            className="mt-1 w-28"
            data-testid="premium-media-mb"
            value={mb}
            onChange={(e) => setMb(e.target.value)}
          />
        </div>
        <Button
          disabled={busy}
          onClick={() => void run()}
          className="rounded-full bg-[#0F172A] text-white"
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Resize media
        </Button>
        {result ? (
          <Button
            variant="outline"
            className="rounded-full border-[#C5A880]"
            data-testid="premium-media-download"
            onClick={() => {
              const ext = file?.name.includes(".")
                ? file.name.slice(file.name.lastIndexOf("."))
                : ".bin";
              downloadBlob(result, `media-${mb}mb${ext}`);
              markDownloaded();
            }}
          >
            <Download /> {formatBytes(result.size)}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </PanelShell>
  );
}

function BulkPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startWipeTimer, markDownloaded } = useWipeTimer();
  const [items, setItems] = useState<
    { id: string; file: File; kb: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zip, setZip] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!items.length) {
      setError("Add files with per-file KB targets.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const targets = items.map((it) => ({
        file: it.file,
        targetBytes: Math.max(1, Math.round(Number(it.kb) * 1024)),
      }));
      const parts = await compressToExactTargets(targets, (d, t) =>
        setProgress(Math.round((d / t) * 100))
      );
      const archive = new JSZip();
      for (const p of parts) archive.file(p.name, p.blob);
      const blob = await archive.generateAsync({ type: "blob" });
      setZip(blob);
      startWipeTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Bulk per-file targets"
      desc="Set a different size limit for each file; download one ZIP."
    >
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp /> Add files
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.mp4,.mov,.mp3"
        onChange={(e) => {
          const next = Array.from(e.target.files || []).map((file) => ({
            id: crypto.randomUUID(),
            file,
            kb: String(Math.max(50, Math.round(file.size / 1024 / 2))),
          }));
          setItems((prev) => [...prev, ...next]);
          setZip(null);
          e.target.value = "";
        }}
      />
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E8E2D6] bg-[#FBF9F5] px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{it.file.name}</span>
            <span className="text-xs text-[#94A3B8]">
              {formatBytes(it.file.size)}
            </span>
            <Input
              className="w-24"
              value={it.kb}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((x) =>
                    x.id === it.id ? { ...x, kb: e.target.value } : x
                  )
                )
              }
            />
            <span className="text-xs text-[#64748B]">KB</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => void run()}
          className="rounded-full bg-[#0F172A] text-white"
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Compress bulk ZIP
        </Button>
        {zip ? (
          <Button
            variant="outline"
            className="rounded-full border-[#C5A880]"
            onClick={() => {
              downloadBlob(zip, "bulk-targets.zip");
              markDownloaded();
            }}
          >
            <Download /> Download ZIP
          </Button>
        ) : null}
      </div>
      {busy ? <Progress value={progress} className="mt-3 h-2" /> : null}
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </PanelShell>
  );
}

function PanelShell({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#0F172A]">
        {title}
      </h4>
      <p className="mt-1 text-sm text-[#64748B]">{desc}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
