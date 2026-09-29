/** Structured PDF extraction + DOCX builders (browser). */

export type DocBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; rows: string[][] };

type TextItem = {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

function looksLikePdfGarbage(s: string): boolean {
  return (
    /%PDF-|\/Type\s*\/|endobj|stream\b|xref\b|startxref|\/Parent\s+\d|\/Kids\s*\[/.test(
      s
    )
  );
}

function clusterLines(items: TextItem[], yTol = 3.5): TextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    if (!item.str.trim()) continue;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - item.y) <= yTol) {
      last.push(item);
      last.sort((a, b) => a.x - b.x);
    } else {
      lines.push([item]);
    }
  }
  return lines;
}

function lineText(line: TextItem[]): string {
  // Join with space when gap is large; concatenate when adjacent
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const cur = line[i];
    if (i === 0) {
      out = cur.str;
      continue;
    }
    const prev = line[i - 1];
    const gap = cur.x - (prev.x + prev.w);
    out += gap > Math.max(1.5, prev.h * 0.25) ? ` ${cur.str}` : cur.str;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Split a line into cells when multiple large horizontal gaps align like columns. */
function splitColumns(line: TextItem[]): string[] | null {
  if (line.length < 2) return null;
  const gaps: { idx: number; gap: number }[] = [];
  for (let i = 1; i < line.length; i++) {
    const gap = line[i].x - (line[i - 1].x + line[i - 1].w);
    if (gap > Math.max(12, line[i].h * 1.2)) {
      gaps.push({ idx: i, gap });
    }
  }
  if (gaps.length === 0) return null;
  const cells: string[] = [];
  let start = 0;
  for (const g of gaps) {
    cells.push(lineText(line.slice(start, g.idx)));
    start = g.idx;
  }
  cells.push(lineText(line.slice(start)));
  return cells.filter((c) => c.length > 0).length >= 2 ? cells : null;
}

function isBullet(text: string): boolean {
  return /^([•·▪◦‣*-]|\u2022|\u25CF)\s+/.test(text) || /^\d+[.)]\s+/.test(text);
}

function stripBullet(text: string): string {
  return text.replace(/^([•·▪◦‣*-]|\u2022|\u25CF)\s+/, "").replace(/^\d+[.)]\s+/, "");
}

function isOrdered(text: string): boolean {
  return /^\d+[.)]\s+/.test(text);
}

/**
 * Extract readable text/tables from a PDF using PDF.js.
 * Reconstructs lines, lists, headings, and column-aligned tables.
 */
export async function extractPdfBlocks(file: File): Promise<DocBlock[]> {
  const pdfjs = await import("pdfjs-dist");
  // Prefer same-origin worker shipped in /public
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const allItems: TextItem[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const pageOffsetY = (doc.numPages - p) * (viewport.height + 40);

    for (const raw of content.items) {
      if (!("str" in raw) || typeof raw.str !== "string") continue;
      const item = raw as {
        str: string;
        transform: number[];
        width: number;
        height: number;
      };
      const str = item.str;
      if (!str || looksLikePdfGarbage(str)) continue;
      const [, , , , e, f] = item.transform;
      allItems.push({
        str,
        x: e,
        y: f + pageOffsetY,
        w: item.width || str.length * 5,
        h: item.height || 10,
      });
    }
  }

  if (allItems.length === 0) {
    throw new Error(
      "No readable text found in this PDF. Scanned/image-only PDFs are not supported yet."
    );
  }

  const lines = clusterLines(allItems);
  const blocks: DocBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const cols = splitColumns(lines[i]);
    // Table: 2+ consecutive multi-column lines
    if (cols && cols.length >= 2) {
      const rows: string[][] = [cols];
      let j = i + 1;
      while (j < lines.length) {
        const nextCols = splitColumns(lines[j]);
        if (!nextCols || nextCols.length < 2) break;
        // Normalize column count
        while (nextCols.length < cols.length) nextCols.push("");
        rows.push(nextCols.slice(0, Math.max(cols.length, nextCols.length)));
        j++;
      }
      if (rows.length >= 2) {
        blocks.push({ type: "table", rows });
        i = j;
        continue;
      }
    }

    const text = lineText(lines[i]);
    if (!text || looksLikePdfGarbage(text)) {
      i++;
      continue;
    }

    // List run
    if (isBullet(text)) {
      const ordered = isOrdered(text);
      const items = [stripBullet(text)];
      let j = i + 1;
      while (j < lines.length) {
        const t = lineText(lines[j]);
        if (!isBullet(t) || isOrdered(t) !== ordered) break;
        items.push(stripBullet(t));
        j++;
      }
      blocks.push({ type: "list", ordered, items });
      i = j;
      continue;
    }

    // Heading heuristic: short line, larger font height, or ALL CAPS-ish title
    const avgH =
      lines[i].reduce((s, it) => s + it.h, 0) / Math.max(lines[i].length, 1);
    const next = lines[i + 1] ? lineText(lines[i + 1]) : "";
    if (
      (avgH >= 14 && text.length < 80) ||
      (/^[A-Z0-9][A-Z0-9 \-/&()]{8,}$/.test(text) && text.length < 90)
    ) {
      const level: 1 | 2 | 3 = avgH >= 18 ? 1 : avgH >= 14 ? 2 : 3;
      blocks.push({ type: "heading", level, text });
      i++;
      continue;
    }

    // Merge wrapped paragraph lines (no big y gap already clustered; continue while short gap + lowercase start)
    let para = text;
    let j = i + 1;
    while (j < lines.length) {
      const t = lineText(lines[j]);
      if (!t || isBullet(t) || splitColumns(lines[j])) break;
      const avgNext =
        lines[j].reduce((s, it) => s + it.h, 0) / Math.max(lines[j].length, 1);
      if (avgNext >= 14 && t.length < 80) break;
      // continue paragraph if previous doesn't end sentence hard OR next starts lowercase
      if (/[a-z,;:(]$/.test(para) || /^[a-z]/.test(t)) {
        para += " " + t;
        j++;
      } else if (para.length < 60 && !/[.!?]$/.test(para) && t.length < 90) {
        para += " " + t;
        j++;
      } else break;
    }
    blocks.push({ type: "paragraph", text: para });
    i = Math.max(j, i + 1);
    void next;
  }

  if (blocks.length === 0) {
    throw new Error("Could not reconstruct readable content from this PDF.");
  }
  return blocks;
}

export function blocksToPlainText(blocks: DocBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === "heading") parts.push(b.text, "");
    else if (b.type === "paragraph") parts.push(b.text, "");
    else if (b.type === "list") {
      b.items.forEach((it, idx) => {
        parts.push(b.ordered ? `${idx + 1}. ${it}` : `• ${it}`);
      });
      parts.push("");
    } else if (b.type === "table") {
      const widths = b.rows[0]?.map((_, c) =>
        Math.max(...b.rows.map((r) => (r[c] || "").length))
      ) ?? [];
      for (const row of b.rows) {
        parts.push(
          row
            .map((cell, c) => (cell || "").padEnd(widths[c] || 0))
            .join(" | ")
        );
      }
      parts.push("");
    }
  }
  return parts.join("\n").trim();
}

export function blocksToHtml(blocks: DocBlock[]): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const body: string[] = [];
  for (const b of blocks) {
    if (b.type === "heading") {
      body.push(`<h${b.level}>${esc(b.text)}</h${b.level}>`);
    } else if (b.type === "paragraph") {
      body.push(`<p>${esc(b.text)}</p>`);
    } else if (b.type === "list") {
      const tag = b.ordered ? "ol" : "ul";
      body.push(
        `<${tag}>${b.items.map((it) => `<li>${esc(it)}</li>`).join("")}</${tag}>`
      );
    } else if (b.type === "table") {
      const rows = b.rows
        .map((row, ri) => {
          const cell = ri === 0 ? "th" : "td";
          return `<tr>${row.map((c) => `<${cell}>${esc(c || "")}</${cell}>`).join("")}</tr>`;
        })
        .join("");
      body.push(
        `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">${rows}</table>`
      );
    }
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Converted Document</title></head><body>${body.join("\n")}</body></html>`;
}

/** Build a real OOXML .docx from structured blocks. */
export async function blocksToDocxBlob(blocks: DocBlock[]): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
  } = await import("docx");

  const children: InstanceType<typeof Paragraph | typeof Table>[] = [];

  for (const b of blocks) {
    if (b.type === "heading") {
      const level =
        b.level === 1
          ? HeadingLevel.HEADING_1
          : b.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
      children.push(
        new Paragraph({
          text: b.text,
          heading: level,
          spacing: { after: 200 },
        })
      );
    } else if (b.type === "paragraph") {
      children.push(
        new Paragraph({
          children: [new TextRun(b.text)],
          spacing: { after: 160 },
        })
      );
    } else if (b.type === "list") {
      b.items.forEach((item, idx) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun(
                b.ordered ? `${idx + 1}. ${item}` : `• ${item}`
              ),
            ],
            spacing: { after: 80 },
          })
        );
      });
    } else if (b.type === "table") {
      const border = {
        style: BorderStyle.SINGLE,
        size: 8,
        color: "999999",
      };
      const borders = {
        top: border,
        bottom: border,
        left: border,
        right: border,
      };
      const colCount = Math.max(...b.rows.map((r) => r.length), 1);
      const colWidth = Math.floor(9000 / colCount);
      children.push(
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          rows: b.rows.map(
            (row) =>
              new TableRow({
                children: Array.from({ length: colCount }, (_, i) => {
                  return new TableCell({
                    borders,
                    width: { size: colWidth, type: WidthType.DXA },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: row[i] || "",
                            bold: false,
                          }),
                        ],
                      }),
                    ],
                  });
                }),
              })
          ),
        })
      );
      children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  return blob;
}
