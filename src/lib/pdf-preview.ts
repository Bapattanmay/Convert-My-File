/** Client-side PDF page → canvas data URL preview (pdf.js). */

export type PdfPreviewPage = {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
};

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export async function getPreviewPdfPageCount(
  data: ArrayBuffer | Uint8Array
): Promise<number> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: toBytes(data).slice(),
    useSystemFonts: true,
  }).promise;
  const n = doc.numPages;
  void doc.cleanup();
  return n;
}

/** Render a single 1-based page for prev/next browsing. */
export async function renderPdfPage(
  data: ArrayBuffer | Uint8Array,
  pageNumber: number,
  opts?: { scale?: number }
): Promise<PdfPreviewPage> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: toBytes(data).slice(),
    useSystemFonts: true,
  }).promise;
  const pageCount = doc.numPages;
  const n = Math.min(Math.max(1, Math.floor(pageNumber)), pageCount);
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: opts?.scale ?? 1.2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const out: PdfPreviewPage = {
    pageNumber: n,
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
  void doc.cleanup();
  return out;
}

export async function renderPdfPreviewPages(
  data: ArrayBuffer | Uint8Array,
  opts?: { maxPages?: number; scale?: number }
): Promise<{ pages: PdfPreviewPage[]; pageCount: number }> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: toBytes(data).slice(),
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
  void doc.cleanup();
  return { pages, pageCount };
}

export type ZipPreviewEntry = {
  name: string;
  size: number;
  kind: "pdf" | "image" | "text" | "audio" | "video" | "other";
};

export function classifyZipEntry(name: string): ZipPreviewEntry["kind"] {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return "image";
  if (/\.(txt|md|csv|json|html?|xml)$/.test(n)) return "text";
  if (/\.(mp3|m4a|wav|aac|ogg)$/.test(n)) return "audio";
  if (/\.(mp4|mov|webm|m4v)$/.test(n)) return "video";
  return "other";
}

export async function listZipPreviewEntries(
  data: ArrayBuffer | Blob
): Promise<ZipPreviewEntry[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(data);
  const entries: ZipPreviewEntry[] = [];
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    entries.push({
      name,
      size: (file as { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize ?? 0,
      kind: classifyZipEntry(name),
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readZipEntryBytes(
  data: ArrayBuffer | Blob,
  entryName: string
): Promise<Uint8Array> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(data);
  const file = zip.file(entryName);
  if (!file) throw new Error(`Missing ${entryName}`);
  return file.async("uint8array");
}
