/**
 * Render offscreen HTML to PNG via html-to-image (lazy-loaded, client-only).
 */

export async function snapshotHtmlToPng(
  html: string,
  width: number,
  height: number
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("HTML snapshot requires a browser environment");
  }

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;opacity:0;z-index:-1;";

  const frame = document.createElement("div");
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.style.overflow = "hidden";
  frame.style.background = "#ffffff";
  frame.innerHTML = html;

  host.appendChild(frame);
  document.body.appendChild(host);

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(frame, {
      width,
      height,
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });

    if (!blob) throw new Error("html-to-image returned empty blob");
    return blob;
  } finally {
    host.remove();
  }
}
