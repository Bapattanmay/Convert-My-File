/** Premium compressor helpers: quality preview, media target size, bulk targets */

import { approachTargetSize, resizeTowardTargetBytes } from "@/lib/file-utils";

export function isImageMedia(file: File): boolean {
  return (
    (file.type || "").startsWith("image/") ||
    /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  );
}

export function isVideoMedia(file: File): boolean {
  return (
    (file.type || "").startsWith("video/") ||
    /\.(mp4|mov|webm|m4v)$/i.test(file.name)
  );
}

export function isAudioMedia(file: File): boolean {
  return (
    (file.type || "").startsWith("audio/") ||
    /\.(mp3|m4a|wav|aac|ogg)$/i.test(file.name)
  );
}

export function isPremiumCompressable(file: File): boolean {
  return (
    isImageMedia(file) ||
    isVideoMedia(file) ||
    isAudioMedia(file) ||
    /\.(pdf|docx?)$/i.test(file.name) ||
    /pdf|msword|wordprocessingml/.test(file.type || "")
  );
}

/**
 * Re-encode image at JPEG quality 0–1 for before/after preview.
 * Returns blob + object URL.
 */
export async function encodeImageQuality(
  file: File,
  quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image."));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    ctx.drawImage(img, 0, 0);
    const q = Math.min(1, Math.max(0.05, quality));
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
        "image/jpeg",
        q
      );
    });
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type BulkTarget = {
  file: File;
  targetBytes: number;
};

/** Approach each file’s target size (prefer ≤ target); return parts for ZIP. */
export async function compressToExactTargets(
  items: BulkTarget[],
  onProgress?: (done: number, total: number) => void
): Promise<{ name: string; blob: Blob }[]> {
  const out: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < items.length; i++) {
    const { file, targetBytes } = items[i];
    if (!isPremiumCompressable(file)) {
      throw new Error(`Unsupported for premium compress: ${file.name}`);
    }
    const outcome = await approachTargetSize(file, targetBytes, {
      mime: file.type || "application/octet-stream",
      nameHint: file.name,
    });
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : "";
    const base = file.name.replace(/\.[^.]+$/, "") || `file-${i + 1}`;
    out.push({ name: `${base}.near${targetBytes}b${ext}`, blob: outcome.blob });
    onProgress?.(i + 1, items.length);
  }
  return out;
}

/**
 * Video/audio → approach target size (client-side best effort).
 * True H.264/AAC bitrate control needs server FFmpeg; copy must not claim exact.
 */
export async function mediaToTargetSize(
  file: File,
  targetBytes: number
): Promise<Blob> {
  if (!isVideoMedia(file) && !isAudioMedia(file)) {
    throw new Error("Upload an MP4, MOV, or MP3 file.");
  }
  const buf = await file.arrayBuffer();
  return resizeTowardTargetBytes(
    buf,
    targetBytes,
    file.type ||
      (isAudioMedia(file) ? "audio/mpeg" : "video/mp4")
  );
}
