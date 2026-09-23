import { zipSync } from "fflate";
import {
  type DriveFile,
  downloadFile,
  exportFile,
  isGoogleNative,
} from "@/lib/drive/drive";

async function fileToBlob(token: string, file: DriveFile): Promise<{ name: string; data: Uint8Array }> {
  let blob: Blob;
  let name = file.name;
  if (isGoogleNative(file)) {
    blob = await exportFile(token, file.id, "application/pdf");
    if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf";
  } else {
    blob = await downloadFile(token, file.id);
  }
  const buf = await blob.arrayBuffer();
  return { name, data: new Uint8Array(buf) };
}

export async function downloadFilesAsZip(token: string, files: DriveFile[]): Promise<void> {
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();

  for (const file of files) {
    const { name, data } = await fileToBlob(token, file);
    let unique = name;
    let n = 1;
    while (used.has(unique)) {
      const dot = name.lastIndexOf(".");
      unique = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
      n++;
    }
    used.add(unique);
    entries[unique] = data;
  }

  const zipped = zipSync(entries);
  const blob = new Blob([zipped], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = files.length === 1 ? `${files[0].name}.zip` : "download.zip";
  a.click();
  URL.revokeObjectURL(url);
}
