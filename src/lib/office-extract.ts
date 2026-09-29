/** Proper Office Open XML text extraction (never UTF-8-decode ZIP/OLE binaries). */

import type { DocBlock } from "@/lib/pdf-extract";

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function isZipFile(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isOleDoc(bytes: Uint8Array): boolean {
  // Legacy .doc Compound File Binary
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}

/** True if string looks like mojibake / raw binary decoded as text. */
export function looksLikeBinaryGarbage(text: string): boolean {
  if (!text) return true;
  const sample = text.slice(0, 2000);
  if (sample.includes("\u0000")) return true;
  if (/%PDF-|PK\u0003\u0004|endobj|startxref/.test(sample)) return true;
  // High ratio of replacement / non-printable
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0xfffd || (c < 9 && c !== 10 && c !== 13) || (c > 14 && c < 32)) {
      bad++;
    }
  }
  if (sample.length > 40 && bad / sample.length > 0.08) return true;
  // Classic ZIP/XML debris when decoding OOXML as UTF-8
  if (
    /word\/_rels|\[Content_Types\]\.xml|docProps\/core\.xml|PK.+word\//.test(
      sample
    )
  ) {
    return true;
  }
  return false;
}

export type OfficeExtract = {
  text: string;
  blocks: DocBlock[];
};

/**
 * Extract readable paragraphs from a .docx (OOXML ZIP).
 * Throws on legacy binary .doc or invalid packages.
 */
export async function extractDocxContent(file: File): Promise<OfficeExtract> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  if (isOleDoc(bytes)) {
    throw new Error(
      "Legacy .doc (binary Word) isn’t supported for conversion. Re-save as .docx and try again."
    );
  }

  if (!isZipFile(bytes)) {
    throw new Error(
      `“${file.name}” is not a valid Word .docx package. Upload a .docx file.`
    );
  }

  const JSZip = (await import("jszip")).default;
  let zip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new Error(
      `Could not open “${file.name}” as a Word document (corrupt ZIP).`
    );
  }

  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) {
    throw new Error(
      `Invalid DOCX: missing word/document.xml in “${file.name}”.`
    );
  }

  const blocks: DocBlock[] = [];
  const paragraphs: string[] = [];

  // Split on paragraph marks; collect w:t runs inside each w:p
  const pChunks = xml.split(/<\/w:p>/);
  for (const chunk of pChunks) {
    if (!/<w:p[\s>]/.test(chunk) && !/<w:p>/.test(chunk)) continue;
    const runs = [...chunk.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(
      (m) => decodeXmlEntities(m[1])
    );
    const text = runs.join("").replace(/\s+/g, " ").trim();
    if (!text) continue;

    // Heading heuristic from outline / style
    const style =
      /w:pStyle\s+w:val="([^"]+)"/.exec(chunk)?.[1]?.toLowerCase() || "";
    if (/heading\s*1|title|ht1/.test(style)) {
      blocks.push({ type: "heading", level: 1, text });
    } else if (/heading\s*2|ht2/.test(style)) {
      blocks.push({ type: "heading", level: 2, text });
    } else if (/heading\s*3|ht3/.test(style)) {
      blocks.push({ type: "heading", level: 3, text });
    } else if (/^([•·▪◦‣*-]|\d+[.)])\s+/.test(text)) {
      const item = text.replace(/^([•·▪◦‣*-]|\d+[.)])\s+/, "");
      const last = blocks[blocks.length - 1];
      if (last?.type === "list") last.items.push(item);
      else
        blocks.push({
          type: "list",
          ordered: /^\d+[.)]/.test(text),
          items: [item],
        });
    } else {
      blocks.push({ type: "paragraph", text });
    }
    paragraphs.push(text);
  }

  const text = paragraphs.join("\n\n").trim();
  if (!text || looksLikeBinaryGarbage(text)) {
    throw new Error(
      `No readable text could be extracted from “${file.name}”. The file may be empty or image-only.`
    );
  }

  return { text, blocks };
}

/** PPTX slide text for merge / conversion helpers. */
export async function extractPptxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (!isZipFile(bytes)) {
    throw new Error(
      `Legacy .ppt isn’t supported. Re-save “${file.name}” as .pptx.`
    );
  }
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = Number(/slide(\d+)/i.exec(a)?.[1] || 0);
      const nb = Number(/slide(\d+)/i.exec(b)?.[1] || 0);
      return na - nb;
    });
  if (!slides.length) {
    throw new Error(`No slides found in “${file.name}”.`);
  }
  const parts: string[] = [];
  for (const path of slides) {
    const xml = await zip.file(path)!.async("string");
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) =>
      decodeXmlEntities(m[1])
    );
    const slideNo = /slide(\d+)/i.exec(path)?.[1] || "?";
    const body = texts.join(" ").replace(/\s+/g, " ").trim();
    if (body) parts.push(`Slide ${slideNo}: ${body}`);
  }
  const text = parts.join("\n\n");
  if (!text || looksLikeBinaryGarbage(text)) {
    throw new Error(`No readable text in “${file.name}”.`);
  }
  return text;
}

/** Multi-page PDF from plain text using pdf-lib (readable Helvetica). */
export async function textToPdfBlobLib(
  text: string,
  title = "Convert My File"
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxWidth = pageWidth - margin * 2;
  const size = 11;
  const lineHeight = 15;

  const wrapLine = (line: string, f = font, s = size) => {
    const words = line.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, s) > maxWidth) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const draw = (line: string, f = font, s = size) => {
    if (y < margin + lineHeight) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: s,
      font: f,
      color: rgb(0.06, 0.09, 0.16),
    });
    y -= lineHeight;
  };

  // Title
  for (const tl of wrapLine(title.slice(0, 120), bold, 14)) {
    draw(tl, bold, 14);
  }
  y -= 8;

  for (const para of text.split(/\r?\n/)) {
    if (!para.trim()) {
      y -= lineHeight * 0.5;
      continue;
    }
    for (const wl of wrapLine(para)) draw(wl);
  }

  const bytes = await doc.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}
