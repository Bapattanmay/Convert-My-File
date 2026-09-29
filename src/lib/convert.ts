/** Smart Converter — format matrix + client-side conversions */

import {
  blocksToDocxBlob,
  blocksToHtml,
  blocksToPlainText,
  extractPdfBlocks,
  type DocBlock,
} from "@/lib/pdf-extract";
import {
  extractDocxContent,
  looksLikeBinaryGarbage,
  textToPdfBlobLib,
} from "@/lib/office-extract";

export type FormatId =
  | "pdf"
  | "docx"
  | "doc"
  | "jpg"
  | "png"
  | "webp"
  | "gif"
  | "txt"
  | "csv"
  | "xlsx"
  | "xls";

export const INPUT_FORMATS: FormatId[] = [
  "pdf",
  "docx",
  "doc",
  "jpg",
  "png",
  "webp",
  "gif",
  "txt",
  "csv",
  "xlsx",
  "xls",
];

export const OUTPUT_FORMATS: FormatId[] = [
  "pdf",
  "docx",
  "doc",
  "jpg",
  "png",
  "webp",
  "txt",
  "csv",
  "xlsx",
];

const IMAGE_FORMATS = new Set<FormatId>(["jpg", "png", "webp", "gif"]);
const TEXTISH = new Set<FormatId>(["txt", "csv"]);
const SPREADSHEET = new Set<FormatId>(["xlsx", "xls", "csv"]);
const WORDISH = new Set<FormatId>(["doc", "docx"]);

/** Supported conversion pairs. Anything else is rejected early. */
export function isConversionSupported(from: FormatId, to: FormatId): boolean {
  if (from === to) return true;

  // Image → image / PDF
  if (IMAGE_FORMATS.has(from)) {
    if (IMAGE_FORMATS.has(to) && to !== "gif") return true; // encode jpg/png/webp
    if (to === "pdf") return true;
    if (to === "txt") return false;
    return false;
  }

  // Plain text / CSV
  if (TEXTISH.has(from)) {
    if (TEXTISH.has(to)) return true;
    if (to === "pdf") return true;
    if (to === "xlsx") return true;
    if (WORDISH.has(to)) return true;
    return false;
  }

  // Spreadsheets → csv/txt/pdf/xlsx
  if (SPREADSHEET.has(from)) {
    if (to === "csv" || to === "txt" || to === "pdf" || to === "xlsx") return true;
    return false;
  }

  // Word-like → txt/pdf/docx (text extraction / wrap)
  if (WORDISH.has(from)) {
    if (to === "txt" || to === "pdf" || WORDISH.has(to)) return true;
    return false;
  }

  // PDF → txt/docx (text stub) / png/jpg not without pdf.js — allow txt/pdf only
  if (from === "pdf") {
    if (to === "txt" || to === "docx" || to === "doc" || to === "pdf") return true;
    return false;
  }

  return false;
}

export function detectFormat(file: File): FormatId | null {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  const mime = (file.type || "").toLowerCase();

  if (ext === "jpeg" || mime === "image/jpeg") return "jpg";
  if (ext === "jpg") return "jpg";
  if (ext === "png" || mime === "image/png") return "png";
  if (ext === "webp" || mime === "image/webp") return "webp";
  if (ext === "gif" || mime === "image/gif") return "gif";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "doc";
  if (ext === "txt" || mime === "text/plain") return "txt";
  if (ext === "csv" || mime === "text/csv") return "csv";
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";

  if (mime.includes("wordprocessingml")) return "docx";
  if (mime === "application/msword") return "doc";
  if (mime.includes("spreadsheetml")) return "xlsx";
  if (mime === "application/vnd.ms-excel") return "xls";

  return null;
}

export function formatLabel(f: FormatId): string {
  return f.toUpperCase();
}

export function guessOutputMime(targetFormat: string): string {
  const f = targetFormat.toLowerCase();
  if (f === "pdf") return "application/pdf";
  if (f === "doc") return "application/msword";
  if (f === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (f === "txt") return "text/plain";
  if (f === "csv") return "text/csv";
  if (f === "jpg" || f === "jpeg") return "image/jpeg";
  if (f === "png") return "image/png";
  if (f === "webp") return "image/webp";
  if (f === "xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

export type ConvertResult = {
  blob: Blob;
  /** Object URL for image preview, or text for text preview */
  previewKind: "image" | "text" | "pdf";
  previewText?: string;
  previewUrl?: string;
  filenameExt: string;
};

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image. The file may be corrupt."));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Failed to encode image output."));
        else resolve(blob);
      },
      mime,
      quality
    );
  });
}

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Minimal single-page PDF from plain text lines */
export function textToPdfBlob(text: string, title = "Convert My File"): Blob {
  const lines = text.split(/\r?\n/).slice(0, 60);
  const contentLines = [
    "BT",
    "/F1 11 Tf",
    "50 780 Td",
    `(${escapePdfText(title)}) Tj`,
    "0 -18 Td",
    "/F1 10 Tf",
  ];
  lines.forEach((line, i) => {
    const clipped = line.slice(0, 90);
    if (i === 0) contentLines.push(`(${escapePdfText(clipped)}) Tj`);
    else contentLines.push(`0 -14 Td (${escapePdfText(clipped)}) Tj`);
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n"
  );
  objects.push(
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`
  );
  objects.push(
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n"
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

/** Wrap a raster image in a simple one-page PDF */
export async function imageToPdfBlob(file: File): Promise<Blob> {
  const img = await loadImageFromFile(file);
  const maxW = 540;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.drawImage(img, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const b64 = dataUrl.split(",")[1] ?? "";
  // Store as hex-ish length for PDF — use JPEG binary via atob
  const binary = atob(b64);
  const jpgBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) jpgBytes[i] = binary.charCodeAt(i);

  const pageW = 612;
  const pageH = 792;
  const x = Math.round((pageW - w) / 2);
  const y = Math.round((pageH - h) / 2);

  const header =
    "%PDF-1.4\n" +
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n" +
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n" +
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources<< /XObject<< /Im0 5 0 R >> >> >>endobj\n`;

  const content = `q\n${w} 0 0 ${h} ${x} ${y} cm\n/Im0 Do\nQ\n`;
  const contentObj = `4 0 obj<< /Length ${content.length} >>stream\n${content}endstream\nendobj\n`;

  // Build image object with binary stream — concatenate as Uint8Array
  const imgDict = `5 0 obj<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBytes.length} >>stream\n`;
  const imgEnd = "\nendstream\nendobj\n";
  const font = ""; // unused
  void font;

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const pushStr = (s: string) => parts.push(enc.encode(s));

  pushStr(header);
  const off4 = parts.reduce((n, p) => n + p.length, 0);
  pushStr(contentObj);
  const off5 = parts.reduce((n, p) => n + p.length, 0);
  pushStr(imgDict);
  parts.push(jpgBytes);
  pushStr(imgEnd);

  // Fix object offsets properly by rebuilding
  const objectsStr: { bytes: Uint8Array }[] = [];
  objectsStr.push({
    bytes: enc.encode(
      "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
    ),
  });
  objectsStr.push({
    bytes: enc.encode(
      "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
    ),
  });
  objectsStr.push({
    bytes: enc.encode(
      `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources<< /XObject<< /Im0 5 0 R >> >> >>endobj\n`
    ),
  });
  objectsStr.push({ bytes: enc.encode(contentObj) });
  const imgObj = new Uint8Array(
    enc.encode(imgDict).length + jpgBytes.length + enc.encode(imgEnd).length
  );
  {
    const d = enc.encode(imgDict);
    const e = enc.encode(imgEnd);
    imgObj.set(d, 0);
    imgObj.set(jpgBytes, d.length);
    imgObj.set(e, d.length + jpgBytes.length);
  }
  objectsStr.push({ bytes: imgObj });
  void off4;
  void off5;

  const outParts: Uint8Array[] = [enc.encode("%PDF-1.4\n")];
  const offsets = [0];
  let len = outParts[0].length;
  for (const obj of objectsStr) {
    offsets.push(len);
    outParts.push(obj.bytes);
    len += obj.bytes.length;
  }
  let xref = `xref\n0 ${objectsStr.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer<< /Size ${objectsStr.length + 1} /Root 1 0 R >>\nstartxref\n${len}\n%%EOF`;
  outParts.push(enc.encode(xref));

  const total = outParts.reduce((n, p) => n + p.length, 0);
  const pdfBytes = new Uint8Array(total);
  let o = 0;
  for (const p of outParts) {
    pdfBytes.set(p, o);
    o += p.length;
  }
  return new Blob([pdfBytes], { type: "application/pdf" });
}

async function convertImage(
  file: File,
  to: FormatId
): Promise<ConvertResult> {
  if (to === "pdf") {
    const blob = await imageToPdfBlob(file);
    return {
      blob,
      previewKind: "pdf",
      previewText: `PDF ready (${Math.round(blob.size / 1024)} KB)\nSource image wrapped on a letter page.\nDownload to open in a PDF viewer.`,
      filenameExt: "pdf",
    };
  }

  const mime =
    to === "jpg" ? "image/jpeg" : to === "png" ? "image/png" : "image/webp";
  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable for image conversion.");
  // JPEG has no alpha — fill white first
  if (to === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  const blob = await canvasToBlob(canvas, mime, 0.92);
  const previewUrl = URL.createObjectURL(blob);
  return {
    blob,
    previewKind: "image",
    previewUrl,
    filenameExt: to === "jpg" ? "jpg" : to,
  };
}

async function readSpreadsheetAsCsv(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return file.text();
  }
  // Dynamic SheetJS for xls/xlsx
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("Spreadsheet has no sheets.");
  return XLSX.utils.sheet_to_csv(sheet);
}

async function csvToXlsxBlob(csv: string): Promise<Blob> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const rows = csv.split(/\r?\n/).map((line) => line.split(","));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function extractTextish(file: File, from: FormatId): Promise<string> {
  if (from === "txt" || from === "csv") return file.text();
  if (from === "xlsx" || from === "xls") return readSpreadsheetAsCsv(file);
  if (from === "docx" || from === "doc") {
    const { text } = await extractDocxContent(file);
    return text;
  }
  if (from === "pdf") {
    const blocks = await extractPdfBlocks(file);
    return blocksToPlainText(blocks);
  }
  return file.text();
}

async function extractStructured(
  file: File,
  from: FormatId
): Promise<{ text: string; blocks?: DocBlock[]; html?: string }> {
  if (from === "pdf") {
    const blocks = await extractPdfBlocks(file);
    return {
      text: blocksToPlainText(blocks),
      blocks,
      html: blocksToHtml(blocks),
    };
  }
  if (from === "docx" || from === "doc") {
    const { text, blocks } = await extractDocxContent(file);
    return { text, blocks, html: blocksToHtml(blocks) };
  }
  const text = await extractTextish(file, from);
  return { text };
}

function textToDocBlob(text: string, asDocx: boolean, html?: string): Blob {
  const body =
    html ??
    `<pre>${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</pre>`;
  const docHtml = html?.includes("<html")
    ? html
    : `<html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
  if (asDocx) {
    return new Blob([docHtml], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }
  return new Blob([docHtml], { type: "application/msword" });
}

export async function convertFile(
  file: File,
  from: FormatId,
  to: FormatId
): Promise<ConvertResult> {
  if (!isConversionSupported(from, to)) {
    throw new Error(
      `Conversion not supported: ${formatLabel(from)} → ${formatLabel(to)}.`
    );
  }

  if (IMAGE_FORMATS.has(from)) {
    return convertImage(file, to);
  }

  const structured = await extractStructured(file, from);
  const text = structured.text;

  // Safety: never surface raw PDF / OOXML / binary as "text"
  if (
    /%PDF-|endobj|startxref/.test(text.slice(0, 500)) ||
    looksLikeBinaryGarbage(text)
  ) {
    throw new Error(
      "Text extraction failed (binary or unreadable content detected). Try a text-based document or .docx."
    );
  }

  if (to === "txt" || to === "csv") {
    const out =
      to === "csv" && !text.includes("|") && !text.includes(",")
        ? text
            .split(/\r?\n/)
            .filter(Boolean)
            .map((l) => `"${l.replace(/"/g, '""')}"`)
            .join("\n")
        : text.includes("|") && to === "csv"
          ? text
              .split(/\r?\n/)
              .filter(Boolean)
              .map((l) =>
                l
                  .split("|")
                  .map((c) => `"${c.trim().replace(/"/g, '""')}"`)
                  .join(",")
              )
              .join("\n")
          : text;
    const blob = new Blob([out], {
      type: to === "csv" ? "text/csv" : "text/plain;charset=utf-8",
    });
    return {
      blob,
      previewKind: "text",
      previewText: out.slice(0, 6000),
      filenameExt: to,
    };
  }

  if (to === "pdf") {
    const blob = await textToPdfBlobLib(text, file.name.replace(/\.[^.]+$/, ""));
    return {
      blob,
      previewKind: "pdf",
      previewText: text.slice(0, 6000),
      filenameExt: "pdf",
    };
  }

  if (to === "xlsx") {
    const csv =
      from === "csv" || text.includes(",")
        ? text
        : text
            .split(/\r?\n/)
            .map((l) => `"${l.replace(/"/g, '""')}"`)
            .join("\n");
    const blob = await csvToXlsxBlob(csv);
    return {
      blob,
      previewKind: "text",
      previewText: `Excel workbook ready (${Math.round(blob.size / 1024)} KB)\n\n${csv.slice(0, 1500)}`,
      filenameExt: "xlsx",
    };
  }

  if (to === "doc" || to === "docx") {
    if (to === "docx" && structured.blocks?.length) {
      const blob = await blocksToDocxBlob(structured.blocks);
      return {
        blob,
        previewKind: "text",
        previewText: text.slice(0, 6000),
        filenameExt: "docx",
      };
    }
    // Prefer real OOXML when targeting docx even without structured blocks
    if (to === "docx") {
      const blob = await blocksToDocxBlob([
        { type: "paragraph", text },
      ]);
      return {
        blob,
        previewKind: "text",
        previewText: text.slice(0, 6000),
        filenameExt: "docx",
      };
    }
    const blob = textToDocBlob(text, false, structured.html);
    return {
      blob,
      previewKind: "text",
      previewText: text.slice(0, 6000),
      filenameExt: to,
    };
  }

  throw new Error(
    `Conversion not supported: ${formatLabel(from)} → ${formatLabel(to)}.`
  );
}

export function acceptAttribute(): string {
  return ".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.xls,application/pdf,image/*";
}

export function unsupportedFileMessage(name: string): string {
  return `This file format is not supported (${name}). Upload PDF, Word, Excel, CSV, TXT, or images (JPG, PNG, WEBP, GIF).`;
}

export function unsupportedConversionMessage(
  from: FormatId,
  to: FormatId
): string {
  return `Conversion not supported: ${formatLabel(from)} → ${formatLabel(to)}. Choose a different output format.`;
}
