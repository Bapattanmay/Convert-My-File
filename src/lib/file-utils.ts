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

/** Build a result blob whose byte length matches `targetBytes` as closely as possible. */
export async function resizeToExactBytes(
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
    // Deterministic pad so expanders hit exact KB/MB targets
    for (let i = src.length; i < target; i++) {
      out[i] = (i * 31 + src[i % Math.max(src.length, 1)]) % 256;
    }
  }

  return new Blob([out], { type: mime });
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
