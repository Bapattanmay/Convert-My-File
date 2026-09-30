/** Client-side PDF page → canvas data URL preview (pdf.js). */

export type PdfPreviewPage = {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
};

export async function renderPdfPreviewPages(
  data: ArrayBuffer | Uint8Array,
  opts?: { maxPages?: number; scale?: number }
): Promise<{ pages: PdfPreviewPage[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const doc = await pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  }).promise;
  const pageCount = doc.numPages;
  const maxPages = Math.min(pageCount, opts?.maxPages ?? 3);
  const scale = opts?.scale ?? 1.15;
  const pages: PdfPreviewPage[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    });
  }

  return { pages, pageCount };
}
