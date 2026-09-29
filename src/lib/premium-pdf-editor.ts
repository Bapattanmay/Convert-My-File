/** Premium PDF editor: PDF → editable DOC → back to PDF */

import {
  blocksToDocxBlob,
  blocksToPlainText,
  extractPdfBlocks,
} from "@/lib/pdf-extract";
import { extractDocxContent, textToPdfBlobLib } from "@/lib/office-extract";

export type PdfEditorSession = {
  docxBlob: Blob;
  plainText: string;
  sourceName: string;
};

/** Upload PDF → DOC (docx) preserving extracted structure where possible. */
export async function pdfToEditableDoc(file: File): Promise<PdfEditorSession> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    throw new Error("Upload a PDF to open in the Premium editor.");
  }
  const blocks = await extractPdfBlocks(file);
  const plainText = blocksToPlainText(blocks);
  if (!plainText.trim()) {
    throw new Error(
      "No extractable text in this PDF. Try a text-based PDF (not a scanned image)."
    );
  }
  const docxBlob = await blocksToDocxBlob(blocks);
  return {
    docxBlob,
    plainText,
    sourceName: file.name.replace(/\.pdf$/i, "") || "document",
  };
}

/** Edited plain text (from DOC round-trip or textarea) → PDF. */
export async function editedTextToPdf(
  text: string,
  title = "Edited document"
): Promise<Blob> {
  const clean = text.trim();
  if (!clean) throw new Error("Nothing to export — add text first.");
  return textToPdfBlobLib(clean, title);
}

/** Re-import an edited DOCX and export PDF. */
export async function editedDocxToPdf(file: File): Promise<Blob> {
  const { text } = await extractDocxContent(file);
  if (!text.trim()) throw new Error("Edited DOC has no text to export.");
  return textToPdfBlobLib(text, file.name);
}
