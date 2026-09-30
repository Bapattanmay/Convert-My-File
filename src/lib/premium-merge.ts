/** Premium merge: page ranges, merge+compress, digital signature */

import {
  detectMergeKind,
  mergeDocuments,
  appendDocumentPages,
  type MergeKind,
} from "@/lib/merge";
import { resizeToExactBytes } from "@/lib/file-utils";
import {
  PDFDocument,
  PDFArray,
  PDFRawStream,
  StandardFonts,
  decodePDFRawStream,
  rgb,
  type PDFPage,
} from "pdf-lib";

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
  // Pass a copy — Uint8Array view / SharedArrayBuffer can upset Blob typings.
  return new Blob([bytes.slice()], { type: "application/pdf" });
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
  /** Optional left margin override (PDF points). Default matches common body margin. */
  x?: number;
};

/** Decode page content streams to Latin-1 text for operator scanning. */
function readPageContent(page: PDFPage): string {
  const contents = page.node.Contents();
  if (!contents) return "";
  const refs: unknown[] = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) refs.push(contents.get(i));
  } else {
    refs.push(contents);
  }
  let out = "";
  for (const ref of refs) {
    try {
      const raw = page.doc.context.lookup(ref as never, PDFRawStream);
      const decoded = decodePDFRawStream(raw).decode();
      out += new TextDecoder("latin1").decode(decoded) + "\n";
    } catch {
      /* ignore unreadable streams */
    }
  }
  return out;
}

/**
 * Lowest text baseline Y on the page (PDF space: origin bottom-left).
 * Falls back to null when the stream has no text positioning.
 */
export function findLowestTextBaselineY(
  page: PDFPage,
  pageHeight: number
): number | null {
  const content = readPageContent(page);
  if (!content.trim()) return null;

  let minY = Infinity;
  let curY = pageHeight;
  let leading = 14;
  let pendingY: number | null = null;

  // Only count Y when text is actually painted (Tj/TJ/'/").
  // pdf-lib emits a trailing T* after each drawText — that must not
  // pull the "content bottom" below the real glyphs.
  const tokens = content.match(/[^\s]+/g) || [];
  const nums: number[] = [];
  for (const tok of tokens) {
    if (Number.isFinite(Number(tok)) && /^-?\d*\.?\d+$/.test(tok)) {
      nums.push(Number(tok));
      continue;
    }
    if (tok === "TL" && nums.length >= 1) {
      leading = Math.abs(nums[nums.length - 1]);
      nums.length = 0;
      continue;
    }
    if (tok === "Tm" && nums.length >= 6) {
      curY = nums[nums.length - 1];
      pendingY = curY;
      nums.length = 0;
      continue;
    }
    if ((tok === "Td" || tok === "TD") && nums.length >= 2) {
      curY += nums[nums.length - 1];
      pendingY = curY;
      nums.length = 0;
      continue;
    }
    if (tok === "T*") {
      curY -= leading;
      pendingY = curY;
      nums.length = 0;
      continue;
    }
    if (tok === "Tj" || tok === "TJ" || tok === "'" || tok === '"') {
      if (pendingY != null) minY = Math.min(minY, pendingY);
      nums.length = 0;
      continue;
    }
    if (/^[A-Za-z'"]/.test(tok)) nums.length = 0;
  }

  return Number.isFinite(minY) ? minY : null;
}

/**
 * Visible signature as plain body text under the last content line —
 * no bordered stamp, no italic/blue chrome, no OK badge.
 */
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

  const font = await doc.embedFont(StandardFonts.Helvetica);
  // Match body text from office/PDF extract pipeline
  const bodyColor = rgb(0.06, 0.09, 0.16);
  const size = 11;
  const lineHeight = 15;
  const gapAfterContent = 18;
  const marginBottom = 48;

  let page = pages[pages.length - 1];
  let { width, height } = page.getSize();
  const x = opts.x ?? 50;

  const when = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";
  const lines = [
    `Signed: ${opts.signerName.slice(0, 64)}`,
    opts.reason?.trim() ? `Reason: ${opts.reason.trim().slice(0, 80)}` : null,
    when,
  ].filter((l): l is string => !!l);

  const contentBottom =
    findLowestTextBaselineY(page, height) ?? height - 72;

  // Place first signature baseline just below content (PDF y grows upward).
  let y = contentBottom - gapAfterContent;
  // If not enough room above the bottom margin, continue on a new page
  // so we never overlap existing glyphs.
  if (y - (lines.length - 1) * lineHeight < marginBottom) {
    page = doc.addPage([width, height]);
    ({ width, height } = page.getSize());
    y = height - 72;
  }

  for (const line of lines) {
    page.drawText(line, {
      x,
      y,
      size,
      font,
      color: bodyColor,
    });
    y -= lineHeight;
  }

  const out = await doc.save();
  return new Blob([out.slice()], { type: "application/pdf" });
}
