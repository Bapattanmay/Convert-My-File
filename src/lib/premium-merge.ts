/** Premium merge: page ranges, merge+compress, digital signature */

import {
  detectMergeKind,
  mergeDocuments,
  appendDocumentPages,
  type MergeKind,
} from "@/lib/merge";
import { resizeToExactBytes } from "@/lib/file-utils";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";


export type PageRange = { start: number; end: number }; // 1-based inclusive

export type RangedMergeInput = {
  file: File;
  kind: MergeKind;
  /** Contiguous 1-based inclusive range (used when `pages` is absent). */
  range?: PageRange;
  /**
   * Explicit 1-based pages in merge order (non-contiguous OK).
   * When set, takes precedence over `range`.
   */
  pages?: number[];
};

export async function getPdfPageCount(file: File): Promise<number> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), {
    ignoreEncryption: true,
  });
  return doc.getPageCount();
}

/** Clamp 1-based inclusive range to document bounds. */
export function normalizeRange(
  range: PageRange | undefined,
  pageCount: number
): PageRange {
  if (!range) return { start: 1, end: pageCount };
  const start = Math.max(1, Math.min(range.start, pageCount));
  const end = Math.max(start, Math.min(range.end, pageCount));
  return { start, end };
}

/** Parse "1,5, 8-10,3" → ordered unique-valid pages (duplicates kept in list order once). */
export function parsePageList(text: string, pageCount: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const parts = text.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = /^(\d+)\s*[-–]\s*(\d+)$/.exec(part);
    if (rangeMatch) {
      let a = Number(rangeMatch[1]);
      let b = Number(rangeMatch[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (a > b) [a, b] = [b, a];
      for (let p = a; p <= b; p++) {
        if (p >= 1 && p <= pageCount && !seen.has(p)) {
          seen.add(p);
          out.push(p);
        }
      }
      continue;
    }
    const n = Number(part);
    if (!Number.isFinite(n)) continue;
    const p = Math.floor(n);
    if (p >= 1 && p <= pageCount && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

/** Resolve 0-based pdf-lib indices in the order pages should appear. */
export function resolvePageIndices(
  input: Pick<RangedMergeInput, "pages" | "range">,
  pageCount: number
): number[] {
  if (input.pages && input.pages.length > 0) {
    return input.pages
      .map((p) => Math.floor(Number(p)))
      .filter((p) => p >= 1 && p <= pageCount)
      .map((p) => p - 1);
  }
  const { start, end } = normalizeRange(input.range, pageCount);
  return Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
}

/**
 * Merge with optional per-file page lists or ranges (PDF pages copied selectively;
 * Office files use full text extract when page pick isn't available).
 */
export async function mergeWithPageRanges(
  inputs: RangedMergeInput[]
): Promise<Blob> {
  if (inputs.length < 1) throw new Error("Add at least one file.");
  const merged = await PDFDocument.create();

  for (const input of inputs) {
    if (input.kind === "pdf") {
      const src = await PDFDocument.load(await input.file.arrayBuffer(), {
        ignoreEncryption: true,
      });
      const count = src.getPageCount();
      const indices = resolvePageIndices(input, count);
      if (!indices.length) {
        throw new Error(`No valid pages selected for ${input.file.name}.`);
      }
      const pages = await merged.copyPages(src, indices);
      pages.forEach((p) => merged.addPage(p));
      continue;
    }

    // Office: full extract as PDF pages (range N/A)
    await appendDocumentPages(merged, {
      file: input.file,
      kind: input.kind,
    });
  }

  if (merged.getPageCount() === 0) {
    throw new Error("Merge produced no pages.");
  }
  const bytes = await merged.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

/** Merge then resize to an exact target byte size. */
export async function mergeAndCompress(
  inputs: RangedMergeInput[],
  targetBytes: number
): Promise<Blob> {
  const merged = await mergeWithPageRanges(inputs);
  const buf = await merged.arrayBuffer();
  return resizeToExactBytes(buf, targetBytes, "application/pdf");
}

export type SignatureOptions = {
  signerName: string;
  reason?: string;
  /** 0–1 normalized position from bottom-left of last page */
  x?: number;
  y?: number;
};

/** Visual digital signature stamp on last page (client-side appearance). */
export async function addDigitalSignature(
  file: File,
  opts: SignatureOptions
): Promise<Blob> {
  const kind = detectMergeKind(file);
  let pdfBytes: ArrayBuffer;

  if (kind === "pdf") {
    pdfBytes = await file.arrayBuffer();
  } else if (kind === "docx" || kind === "doc") {
    const blob = await mergeDocuments([{ file, kind }]);
    pdfBytes = await blob.arrayBuffer();
  } else {
    throw new Error("Upload a PDF or Word document to sign.");
  }

  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  if (!pages.length) throw new Error("Document has no pages.");
  const page = pages[pages.length - 1];
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const x = (opts.x ?? 0.12) * width;
  const y = (opts.y ?? 0.08) * height;
  const boxW = Math.min(260, width * 0.45);
  const boxH = 56;

  page.drawRectangle({
    x,
    y,
    width: boxW,
    height: boxH,
    borderColor: rgb(0.12, 0.35, 0.55),
    borderWidth: 1.5,
    color: rgb(0.95, 0.97, 1),
    opacity: 0.92,
  });

  const when = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";
  page.drawText("Digitally signed", {
    x: x + 10,
    y: y + boxH - 16,
    size: 9,
    font,
    color: rgb(0.1, 0.2, 0.35),
  });
  page.drawText(opts.signerName.slice(0, 48), {
    x: x + 10,
    y: y + boxH - 32,
    size: 12,
    font: italic,
    color: rgb(0.05, 0.15, 0.3),
  });
  page.drawText(when, {
    x: x + 10,
    y: y + 10,
    size: 8,
    font,
    color: rgb(0.3, 0.35, 0.4),
  });
  if (opts.reason) {
    page.drawText(opts.reason.slice(0, 40), {
      x: x + 10,
      y: y + 22,
      size: 8,
      font,
      color: rgb(0.25, 0.3, 0.35),
    });
  }
  // Use ASCII-only mark — StandardFonts.Helvetica is WinAnsi and cannot encode ✓
  page.drawText("OK", {
    x: x + boxW - 36,
    y: y + boxH / 2 - 6,
    size: 14,
    font,
    color: rgb(0.1, 0.45, 0.25),
    rotate: degrees(-8),
  });

  const out = await doc.save();
  return new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" });
}
