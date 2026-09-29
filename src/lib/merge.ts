/** Multi-format document merger → combined PDF */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type MergeKind = "pdf" | "doc" | "docx" | "ppt" | "pptx";

const EXT_MAP: Record<string, MergeKind> = {
  pdf: "pdf",
  doc: "doc",
  docx: "docx",
  ppt: "ppt",
  pptx: "pptx",
};

export function detectMergeKind(file: File): MergeKind | null {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if (EXT_MAP[ext]) return EXT_MAP[ext];
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("wordprocessingml") || mime === "application/msword")
    return mime.includes("wordprocessingml") ? "docx" : "doc";
  if (mime.includes("presentationml") || mime.includes("ms-powerpoint"))
    return mime.includes("presentationml") ? "pptx" : "ppt";
  return null;
}

export function mergeAcceptAttribute(): string {
  return ".pdf,.doc,.docx,.ppt,.pptx,application/pdf";
}

export function unsupportedMergeMessage(name: string): string {
  return `This file format is not supported for merge (${name}). Upload PDF, Word (DOC/DOCX), or PowerPoint (PPT/PPTX) only.`;
}

async function extractDocxText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) {
    // Legacy .doc — best-effort binary text scrape
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(await file.arrayBuffer())
    );
    const bits = [...raw.matchAll(/[A-Za-z0-9][A-Za-z0-9 ,.;:'"()\-\/&%]{3,}/g)]
      .map((m) => m[0])
      .filter((t) => !/^[\d\s]+$/.test(t))
      .slice(0, 400);
    return bits.join(" ") || `(No extractable text in ${file.name})`;
  }
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPptxText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = Number(/slide(\d+)/i.exec(a)?.[1] || 0);
      const nb = Number(/slide(\d+)/i.exec(b)?.[1] || 0);
      return na - nb;
    });

  if (!slides.length) {
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(await file.arrayBuffer())
    );
    const bits = [...raw.matchAll(/[A-Za-z0-9][A-Za-z0-9 ,.;:'"()\-\/&%]{3,}/g)]
      .map((m) => m[0])
      .slice(0, 300);
    return bits.join(" ") || `(No extractable text in ${file.name})`;
  }

  const parts: string[] = [];
  for (const path of slides) {
    const xml = await zip.file(path)!.async("string");
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const slideNo = /slide(\d+)/i.exec(path)?.[1] || "?";
    parts.push(`Slide ${slideNo}: ${texts.join(" ").replace(/\s+/g, " ").trim()}`);
  }
  return parts.join("\n\n");
}

async function addTextPages(
  merged: PDFDocument,
  title: string,
  body: string
): Promise<void> {
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const bold = await merged.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = 500;
  const size = 11;
  const titleSize = 14;
  const lineHeight = 14;
  const wrap = (text: string, f = font, s = size) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(trial, s) > maxWidth) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = trial;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };

  let page = merged.addPage([612, 792]);
  let y = 750;
  page.drawText(title.slice(0, 90), {
    x: 50,
    y,
    size: titleSize,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
  });
  y -= 28;

  const paragraphs = body.split(/\n+/);
  for (const para of paragraphs) {
    for (const line of wrap(para)) {
      if (y < 60) {
        page = merged.addPage([612, 792]);
        y = 750;
      }
      page.drawText(line.slice(0, 120), {
        x: 50,
        y,
        size,
        font,
        color: rgb(0.1, 0.12, 0.18),
      });
      y -= lineHeight;
    }
    y -= 6;
  }
}

export type MergeInput = { file: File; kind: MergeKind };

/** Merge PDF / Word / PowerPoint files into one usable PDF (order preserved). */
export async function mergeDocuments(inputs: MergeInput[]): Promise<Blob> {
  if (inputs.length < 2) {
    throw new Error("Add at least two supported files to merge.");
  }

  const merged = await PDFDocument.create();

  for (const { file, kind } of inputs) {
    if (kind === "pdf") {
      try {
        const src = await PDFDocument.load(await file.arrayBuffer(), {
          ignoreEncryption: true,
        });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
        continue;
      } catch {
        // Fall through to text extraction page
      }
    }

    let text = "";
    if (kind === "docx" || kind === "doc") {
      text = await extractDocxText(file);
    } else if (kind === "pptx" || kind === "ppt") {
      text = await extractPptxText(file);
    } else {
      text = `(Could not parse ${file.name})`;
    }
    await addTextPages(
      merged,
      `${file.name} (${kind.toUpperCase()})`,
      text || `(Empty extract from ${file.name})`
    );
  }

  if (merged.getPageCount() === 0) {
    throw new Error("Merge produced no pages. Check your files and try again.");
  }

  const bytes = await merged.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}
