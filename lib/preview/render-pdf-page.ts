import { loadPdfJs } from "./pdfjs-loader";

export interface RenderPdfPageOptions {
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Target render width in CSS pixels (scaled for sharp grid cards). */
  width?: number;
}

/**
 * Renders a single PDF page to a PNG blob via canvas.
 * Caller owns fetching the PDF bytes (Drive download or export).
 */
export async function renderPdfPageToPngBlob(
  pdfData: ArrayBuffer,
  options: RenderPdfPageOptions = {}
): Promise<Blob> {
  const { page = 1, width = 480 } = options;
  const pdfjs = await loadPdfJs();

  const loadingTask = pdfjs.getDocument({ data: pdfData.slice(0) });
  const pdf = await loadingTask.promise;

  try {
    const pdfPage = await pdf.getPage(page);
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const scale = width / baseViewport.width;
    const viewport = pdfPage.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await pdfPage.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to encode PNG"))),
        "image/png",
        0.92
      );
    });

    return blob;
  } finally {
    await pdf.destroy();
  }
}
