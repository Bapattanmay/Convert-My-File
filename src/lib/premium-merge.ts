/** Premium merge: page ranges, merge+compress, digital signature */

import {
  detectMergeKind,
  mergeDocuments,
  appendDocumentPages,
  type MergeKind,
} from "@/lib/merge";
import { approachTargetSize } from "@/lib/file-utils";
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

export type MergeResult = { blob: Blob; pageCount: number };

function pdfBytesToBlob(bytes: Uint8Array): Blob {
  // Copy into a standalone ArrayBuffer so Blob/File readers always see a
  // complete PDF (TypedArray.buffer may be a larger pooled ArrayBuffer).
  const copy = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return new Blob([copy], { type: "application/pdf" });
}

/**
 * Merge with optional per-file page lists or ranges (PDF pages copied selectively;
 * Office files use full text extract when page pick isn't available).
 */
export async function mergeWithPageRanges(
  inputs: RangedMergeInput[]
): Promise<Blob> {
  return (await mergeWithPageRangesDetailed(inputs)).blob;
}

/** Same as mergeWithPageRanges but also returns the output page count. */
export async function mergeWithPageRangesDetailed(
  inputs: RangedMergeInput[]
): Promise<MergeResult> {
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

  const pageCount = merged.getPageCount();
  if (pageCount === 0) {
    throw new Error("Merge produced no pages.");
  }
  return { blob: pdfBytesToBlob(await merged.save()), pageCount };
}

/** Merge then approach a target byte size (prefer ≤ target; not guaranteed exact). */
export async function mergeAndCompress(
  inputs: RangedMergeInput[],
  targetBytes: number
): Promise<Blob> {
  const { blob: merged } = await mergeWithPageRangesDetailed(inputs);
  const outcome = await approachTargetSize(merged, targetBytes, {
    mime: "application/pdf",
    nameHint: "merged.pdf",
  });
  return outcome.blob;
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
      const looked = page.doc.context.lookup(ref as never);
      if (!(looked instanceof PDFRawStream)) continue;
      const decoded = decodePDFRawStream(looked).decode();
      out += new TextDecoder("latin1").decode(decoded) + "\n";
    } catch {
      /* ignore unreadable streams */
    }
  }
  return out;
}

/** Collect painted text baseline Y values (PDF space: origin bottom-left). */
export function collectPaintedTextYs(
  page: PDFPage,
  pageHeight: number
): number[] {
  const content = readPageContent(page);
  if (!content.trim()) return [];

  const ys: number[] = [];
  let curY = pageHeight;
  let leading = 14;
  let pendingY: number | null = null;

  // Only count Y when text is actually painted (Tj/TJ/'/").
  // pdf-lib emits a trailing T* after each drawText — that must not
  // count as a painted baseline by itself.
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
      if (pendingY != null && Number.isFinite(pendingY)) ys.push(pendingY);
      nums.length = 0;
      continue;
    }
    if (/^[A-Za-z'"]/.test(tok)) nums.length = 0;
  }
  return ys;
}

/**
 * Lowest body-text baseline Y on the page.
 * Ignores isolated footer-like lines far below the main content cluster
 * (those used to force a blank signature page).
 */
export function findLowestTextBaselineY(
  page: PDFPage,
  pageHeight: number
): number | null {
  const ys = collectPaintedTextYs(page, pageHeight);
  if (!ys.length) return null;

  // Walk from top of page downward; stop before a large gap (footer).
  const sorted = [...ys].sort((a, b) => b - a);
  let clusterLow = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (clusterLow - sorted[i] > 120) break;
    clusterLow = sorted[i];
  }
  return clusterLow;
}

/**
 * Visible signature as plain body text under the last content line on the
 * SAME page — no new blank page, no stamp box / italic / OK badge.
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
  const lineHeight = 14;
  const gapAfterContent = 14;
  const edgePad = 28;

  // Always sign the existing last content page — never invent a blank page 2.
  const page = pages[pages.length - 1];
  const { height } = page.getSize();
  const x = opts.x ?? 50;

  const when = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";
  const lines = [
    `Signed: ${opts.signerName.slice(0, 64)}`,
    opts.reason?.trim() ? `Reason: ${opts.reason.trim().slice(0, 80)}` : null,
    when,
  ].filter((l): l is string => !!l);

  const blockDepth = (lines.length - 1) * lineHeight;
  const contentBottom =
    findLowestTextBaselineY(page, height) ?? height - 72;

  // Prefer just under the last content line (minimal blank gap).
  let y = contentBottom - gapAfterContent;
  // Keep the whole block on-page without overlapping content.
  const minTopOfBlock = edgePad + blockDepth;
  if (y < minTopOfBlock) {
    // Content sits low — still stay on this page; tuck under content with a
    // tighter gap rather than jumping to a new blank page.
    y = Math.min(contentBottom - 8, minTopOfBlock);
  }
  // Hard floor: never draw above/into the last content baseline.
  if (y > contentBottom - 8) {
    y = contentBottom - 8;
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

  return pdfBytesToBlob(await doc.save());
}
