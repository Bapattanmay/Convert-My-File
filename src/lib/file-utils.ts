export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ApproachMethod =
  | "image-reencode"
  | "pdf-rewrite"
  | "byte-pack"
  | "unchanged";

export type ApproachTargetResult = {
  blob: Blob;
  targetBytes: number;
  achievedBytes: number;
  method: ApproachMethod;
  /** True when result size is ≤ target (preferred compress semantics). */
  atOrUnderTarget: boolean;
};

function isImageMimeOrName(mime: string, nameHint = ""): boolean {
  return (
    mime.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif)$/i.test(nameHint)
  );
}

function isPdfMimeOrName(mime: string, nameHint = ""): boolean {
  return mime === "application/pdf" || /\.pdf$/i.test(nameHint);
}

/** Deterministic pad/truncate — last resort; never marketed as “exact compression”. */
export async function resizeTowardTargetBytes(
  source: ArrayBuffer | Uint8Array,
  targetBytes: number,
  mime = "application/octet-stream"
): Promise<Blob> {
  const src =
    source instanceof Uint8Array ? source : new Uint8Array(source);
  const target = Math.max(1, Math.floor(targetBytes));
  const out = new Uint8Array(target);

  if (src.length >= target) {
    out.set(src.subarray(0, target));
  } else {
    out.set(src);
    for (let i = src.length; i < target; i++) {
      out[i] = (i * 31 + src[i % Math.max(src.length, 1)]) % 256;
    }
  }

  return new Blob([asBlobPart(out)], { type: mime });
}

/** @deprecated Prefer approachTargetSize — kept for callers mid-migration. */
export async function resizeToExactBytes(
  source: ArrayBuffer | Uint8Array,
  targetBytes: number,
  mime = "application/octet-stream"
): Promise<Blob> {
  return resizeTowardTargetBytes(source, targetBytes, mime);
}

function asBlobPart(source: ArrayBuffer | Uint8Array): BlobPart {
  if (source instanceof Uint8Array) {
    return Uint8Array.from(source) as BlobPart;
  }
  return source;
}

async function loadImageElement(
  source: Blob | ArrayBuffer | Uint8Array
): Promise<HTMLImageElement> {
  const blob =
    source instanceof Blob
      ? source
      : new Blob([asBlobPart(source)]);
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image."));
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
      mime,
      quality
    );
  });
}

/**
 * Iterative quality + resolution re-encode aiming for ≤ target when compressing.
 * Expands via quality-first encode then byte-pack only if still short.
 */
async function approachImageTarget(
  source: ArrayBuffer | Uint8Array | Blob,
  targetBytes: number,
  mimeHint: string
): Promise<ApproachTargetResult> {
  const target = Math.max(1, Math.floor(targetBytes));
  const img = await loadImageElement(source);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const outMime =
    mimeHint === "image/png" || mimeHint === "image/webp"
      ? mimeHint
      : "image/jpeg";

  let best: Blob | null = null;
  const scales = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25];
  const qualities = [0.92, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15, 0.08];

  for (const scale of scales) {
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    if (outMime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);

    for (const q of qualities) {
      const blob = await canvasToBlob(
        canvas,
        outMime === "image/png" ? "image/png" : outMime,
        q
      );
      if (!best || Math.abs(blob.size - target) < Math.abs(best.size - target)) {
        best = blob;
      }
      if (blob.size <= target) {
        // Prefer the largest ≤ target at this scale (higher quality first)
        return {
          blob,
          targetBytes: target,
          achievedBytes: blob.size,
          method: "image-reencode",
          atOrUnderTarget: true,
        };
      }
    }
  }

  // Could not get under target — return closest re-encode (honest, not truncated)
  const fallback =
    best ||
    (await (async () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(naturalW * 0.25));
      canvas.height = Math.max(1, Math.round(naturalH * 0.25));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable.");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvasToBlob(canvas, "image/jpeg", 0.08);
    })());

  if (fallback.size < target) {
    // Expand toward target with pad (size-match only; copy must not claim codec expand)
    const packed = await resizeTowardTargetBytes(
      await fallback.arrayBuffer(),
      target,
      fallback.type || outMime
    );
    return {
      blob: packed,
      targetBytes: target,
      achievedBytes: packed.size,
      method: "byte-pack",
      atOrUnderTarget: packed.size <= target,
    };
  }

  return {
    blob: fallback,
    targetBytes: target,
    achievedBytes: fallback.size,
    method: "image-reencode",
    atOrUnderTarget: fallback.size <= target,
  };
}

async function approachPdfTarget(
  source: ArrayBuffer | Uint8Array,
  targetBytes: number
): Promise<ApproachTargetResult> {
  const target = Math.max(1, Math.floor(targetBytes));
  const src =
    source instanceof Uint8Array ? source : new Uint8Array(source);

  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(src, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setProducer("Convert My File");
    doc.setCreator("Convert My File");
    const rewritten = await doc.save({ useObjectStreams: true });
    const rewriteBlob = new Blob([asBlobPart(rewritten)], {
      type: "application/pdf",
    });

    if (src.length <= target && rewriteBlob.size > target) {
      // Already under target — keep original
      return {
        blob: new Blob([asBlobPart(src)], { type: "application/pdf" }),
        targetBytes: target,
        achievedBytes: src.length,
        method: "unchanged",
        atOrUnderTarget: true,
      };
    }

    if (rewriteBlob.size <= target) {
      if (rewriteBlob.size < target * 0.95 && src.length < target) {
        // Expand toward target
        const packed = await resizeTowardTargetBytes(
          rewritten,
          target,
          "application/pdf"
        );
        return {
          blob: packed,
          targetBytes: target,
          achievedBytes: packed.size,
          method: "byte-pack",
          atOrUnderTarget: true,
        };
      }
      return {
        blob: rewriteBlob,
        targetBytes: target,
        achievedBytes: rewriteBlob.size,
        method: "pdf-rewrite",
        atOrUnderTarget: true,
      };
    }

    // Still over target — return rewritten (closest safe) without truncating PDF
    if (rewriteBlob.size < src.length) {
      return {
        blob: rewriteBlob,
        targetBytes: target,
        achievedBytes: rewriteBlob.size,
        method: "pdf-rewrite",
        atOrUnderTarget: false,
      };
    }
  } catch {
    // fall through to byte-pack
  }

  if (src.length <= target) {
    const packed = await resizeTowardTargetBytes(src, target, "application/pdf");
    return {
      blob: packed,
      targetBytes: target,
      achievedBytes: packed.size,
      method: "byte-pack",
      atOrUnderTarget: true,
    };
  }

  // Compress path without safe re-encode: return original (honest — not truncated)
  return {
    blob: new Blob([asBlobPart(src)], { type: "application/pdf" }),
    targetBytes: target,
    achievedBytes: src.length,
    method: "unchanged",
    atOrUnderTarget: src.length <= target,
  };
}

/**
 * Approach a target size. Prefer ≤ target for compress; never claim exact bytes
 * in product copy unless the achieved size truly equals the request.
 */
export async function approachTargetSize(
  source: ArrayBuffer | Uint8Array | File | Blob,
  targetBytes: number,
  options?: { mime?: string; nameHint?: string }
): Promise<ApproachTargetResult> {
  const target = Math.max(1, Math.floor(targetBytes));
  const mime =
    options?.mime ||
    (source instanceof File || source instanceof Blob
      ? source.type
      : "") ||
    "application/octet-stream";
  const nameHint =
    options?.nameHint ||
    (source instanceof File ? source.name : "") ||
    "";

  let bytes: ArrayBuffer | Uint8Array;
  if (source instanceof File || source instanceof Blob) {
    bytes = new Uint8Array(await source.arrayBuffer());
  } else {
    bytes = source;
  }

  if (typeof document !== "undefined" && isImageMimeOrName(mime, nameHint)) {
    return approachImageTarget(bytes, target, mime);
  }

  if (isPdfMimeOrName(mime, nameHint)) {
    return approachPdfTarget(bytes, target);
  }

  const srcLen =
    bytes instanceof Uint8Array ? bytes.length : bytes.byteLength;
  if (srcLen === target) {
    const exact =
      bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return {
      blob: new Blob([asBlobPart(exact)], { type: mime }),
      targetBytes: target,
      achievedBytes: srcLen,
      method: "unchanged",
      atOrUnderTarget: true,
    };
  }

  const packed = await resizeTowardTargetBytes(bytes, target, mime);
  return {
    blob: packed,
    targetBytes: target,
    achievedBytes: packed.size,
    method: "byte-pack",
    atOrUnderTarget: packed.size <= target,
  };
}

export function extensionForMime(mime: string, fallback = "bin"): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "xlsx",
    "text/plain": "txt",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] ?? fallback;
}

export function guessOutputMime(targetFormat: string): string {
  const f = targetFormat.toLowerCase();
  if (f === "pdf") return "application/pdf";
  if (f === "doc" || f === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (f === "txt") return "text/plain";
  if (f === "jpg" || f === "jpeg") return "image/jpeg";
  if (f === "png") return "image/png";
  if (f === "xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

export async function readAsTextPreview(
  file: File,
  maxChars = 1200
): Promise<string> {
  if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
    const text = await file.text();
    return text.slice(0, maxChars);
  }
  return `Binary preview · ${file.name}\nType: ${file.type || "unknown"}\nSize: ${formatBytes(file.size)}\n\nContent will be processed client-side. No bytes leave this session.`;
}
