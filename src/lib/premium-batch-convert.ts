/** Premium: batch convert many files → ZIP */

import JSZip from "jszip";
import {
  convertFile,
  detectFormat,
  isConversionSupported,
  type FormatId,
} from "@/lib/convert";

export const FREE_CONVERT_LIMIT = 1;
export const PREMIUM_BATCH_LIMIT = 50;

export type BatchConvertItem = {
  name: string;
  ok: boolean;
  error?: string;
};

export type BatchConvertResult = {
  zip: Blob;
  items: BatchConvertItem[];
  okCount: number;
  failCount: number;
};

export async function batchConvertToZip(
  files: File[],
  target: FormatId,
  onProgress?: (done: number, total: number) => void
): Promise<BatchConvertResult> {
  if (files.length < 1) throw new Error("Add at least one file to convert.");
  if (files.length > PREMIUM_BATCH_LIMIT) {
    throw new Error(`Batch limit is ${PREMIUM_BATCH_LIMIT} files per job.`);
  }

  const zip = new JSZip();
  const items: BatchConvertItem[] = [];
  let okCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const from = detectFormat(file);
    try {
      if (!from) throw new Error("Unsupported source format");
      if (!isConversionSupported(from, target)) {
        throw new Error(`${from.toUpperCase()} → ${target.toUpperCase()} not supported`);
      }
      const result = await convertFile(file, from, target);
      const base = file.name.replace(/\.[^.]+$/, "") || `file-${i + 1}`;
      const outName = `${base}.${result.filenameExt}`;
      zip.file(outName, result.blob);
      items.push({ name: outName, ok: true });
      okCount++;
    } catch (e) {
      failCount++;
      items.push({
        name: file.name,
        ok: false,
        error: e instanceof Error ? e.message : "Convert failed",
      });
    }
    onProgress?.(i + 1, files.length);
  }

  if (okCount === 0) {
    throw new Error(
      items.map((x) => x.error || x.name).join("; ") ||
        "No files converted successfully."
    );
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  return { zip: zipBlob, items, okCount, failCount };
}
