import { createRng, fbm, hash2, smoothstep } from "./noise";
import { GRADIENT_PALETTES, pickRandomPalette, samplePalette } from "./palettes";

export type GradientPatternStyle =
  | "marble"
  | "cloud"
  | "flow"
  | "silk"
  | "layers"
  | "waves"
  | "lowpoly";

export const GRADIENT_PATTERN_STYLES: GradientPatternStyle[] = [
  "marble", "cloud", "flow", "silk", "layers", "waves", "lowpoly",
];

export interface GradientPatternOptions {
  width?: number;
  height?: number;
  seed?: number;
  style?: GradientPatternStyle | "random";
  palette?: string[] | keyof typeof GRADIENT_PALETTES | "random";
  /** Internal render scale (0.5–1). Defaults to 1 — always render sharp, never upscale-blur. */
  quality?: number;
}

export interface GradientPatternResult {
  dataUrl: string;
  seed: number;
  style: GradientPatternStyle;
  paletteName: string;
  palette: string[];
  width: number;
  height: number;
}

/** Render at 2× then downscale — clean anti-aliasing without canvas blur. */
const SUPERSAMPLE = 2;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function resolveSeed(seed?: number): number {
  if (seed !== undefined) return seed >>> 0;
  return (Math.random() * 0xffffffff) >>> 0;
}

function resolveStyle(style: GradientPatternOptions["style"], rng: () => number): GradientPatternStyle {
  if (style && style !== "random") return style;
  return GRADIENT_PATTERN_STYLES[Math.floor(rng() * GRADIENT_PATTERN_STYLES.length)];
}

function resolvePalette(
  palette: GradientPatternOptions["palette"],
  rng: () => number,
): { name: string; colors: string[] } {
  if (!palette || palette === "random") return pickRandomPalette(rng);
  if (typeof palette === "string" && palette in GRADIENT_PALETTES) {
    return { name: palette, colors: [...GRADIENT_PALETTES[palette]] };
  }
  if (Array.isArray(palette) && palette.length >= 2) {
    return { name: "custom", colors: palette };
  }
  return pickRandomPalette(rng);
}

/** Very fine film grain — subtle texture without muddying the image. */
function applyFineGrain(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seed: number,
  intensity: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const g = (hash2(x * 2.3 + 0.5, y * 2.3 + 0.5, seed) - 0.5) * 255 * intensity;
      data[i] = Math.max(0, Math.min(255, data[i] + g));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + g));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + g));
    }
  }
}

/** Bilinear 2×2 corner sampling for clean per-pixel color ramps. */
function sampleField(
  field: (nx: number, ny: number) => number,
  nx: number,
  ny: number,
  width: number,
  height: number,
): number {
  const px = nx * width;
  const py = ny * height;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const fx = px - x0;
  const fy = py - y0;
  const at = (x: number, y: number) => field(x / width, y / height);
  const v00 = at(x0, y0);
  const v10 = at(x0 + 1, y0);
  const v01 = at(x0, y0 + 1);
  const v11 = at(x0 + 1, y0 + 1);
  const top = v00 + (v10 - v00) * fx;
  const bot = v01 + (v11 - v01) * fx;
  return top + (bot - top) * fy;
}

function fillFromField(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  colors: string[],
  field: (nx: number, ny: number) => number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x + 0.5) / width;
      const ny = (y + 0.5) / height;
      const t = sampleField(field, nx, ny, width, height);
      const [r, g, b] = samplePalette(t, colors);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
}

function putField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  field: (nx: number, ny: number) => number,
  seed: number,
  grain = 0.018,
): void {
  const imageData = ctx.createImageData(w, h);
  fillFromField(imageData.data, w, h, colors, field);
  applyFineGrain(imageData.data, w, h, seed, grain);
  ctx.putImageData(imageData, 0, 0);
}

/** Diagonal flowing ridges — clean organic folds like sand/silk. */
function flowRidges(
  nx: number,
  ny: number,
  seed: number,
  angleOffset = 0,
): number {
  const angle = 0.52 + angleOffset + (seed % 80) / 600;
  const ca = Math.cos(angle * Math.PI);
  const sa = Math.sin(angle * Math.PI);
  const u = nx * ca + ny * sa;
  const v = -nx * sa + ny * ca;

  const warp = fbm(u * 2.2 + seed * 0.0007, v * 2.2, seed, 4);
  const warp2 = fbm(u * 1.1 + 2, v * 1.1 + 1, seed + 13, 3);

  const freq = 4.5 + (seed % 40) / 12;
  let ridge = Math.sin((u * freq + warp * 1.6) * Math.PI * 2);
  ridge = 1 - Math.abs(ridge);
  ridge = Math.pow(ridge, 1.6);

  const base = (1 - ny) * 0.38 + nx * 0.22;
  const micro = (fbm(nx * 18, ny * 18, seed + 3, 2) - 0.5) * 0.035;
  return clamp01(base + ridge * 0.42 + warp2 * 0.1 + micro);
}

function waveY(x: number, w: number, amplitude: number, freq: number, phase: number, seed: number): number {
  return (
    Math.sin(x / w * Math.PI * 2 * freq + phase) * amplitude
    + Math.sin(x / w * Math.PI * 3 + phase * 1.2 + seed * 0.01) * amplitude * 0.28
    + fbm(x * 0.008, seed * 0.01, seed, 3) * amplitude * 0.35
  );
}

function renderMarble(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  seed: number,
): void {
  putField(ctx, w, h, colors, (nx, ny) => flowRidges(nx, ny, seed, 0), seed, 0.016);
}

function renderCloud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  seed: number,
): void {
  putField(ctx, w, h, colors, (nx, ny) => {
    let v = fbm(nx * 2 + seed * 0.01, ny * 2, seed, 6);
    v += fbm(nx * 4 + 1, ny * 4 + 2, seed + 3, 4) * 0.18;
    v = v * 0.72 + nx * 0.14 + (1 - ny) * 0.14;
    return clamp01(v);
  }, seed, 0.018);
}

function renderFlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  seed: number,
  rng: () => number,
): void {
  const count = 7 + Math.floor(rng() * 4);
  const anchors = Array.from({ length: count }, () => ({
    x: 0.05 + rng() * 0.9,
    y: 0.05 + rng() * 0.9,
    t: 0.15 + rng() * 0.85,
  }));

  putField(ctx, w, h, colors, (nx, ny) => {
    let sumW = 0;
    let sumT = 0;
    for (const a of anchors) {
      const dx = nx - a.x;
      const dy = ny - a.y;
      const d2 = dx * dx + dy * dy;
      const weight = 1 / (d2 + 0.035);
      sumW += weight;
      sumT += weight * a.t;
    }
    let t = sumT / sumW;
    t += (fbm(nx * 3, ny * 3, seed, 4) - 0.5) * 0.08;
    t = t * 0.82 + (1 - ny) * 0.1 + nx * 0.08;
    return clamp01(t);
  }, seed + 55, 0.015);
}

function renderSilk(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  seed: number,
): void {
  putField(ctx, w, h, colors, (nx, ny) => {
    const angle = 0.38 + (seed % 50) / 400;
    const ca = Math.cos(angle * Math.PI);
    const sa = Math.sin(angle * Math.PI);
    const u = nx * ca + ny * sa;
    const v = -nx * sa + ny * ca;
    const warp = fbm(u * 2.5, v * 2.5, seed, 4) * 1.2;
    const wave = Math.sin((u * 6 + v * 1.5 + warp) * Math.PI + seed * 0.01);
    const lit = wave * 0.5 + 0.5;
    return clamp01(lit * 0.55 + (1 - ny) * 0.25 + nx * 0.2);
  }, seed + 33, 0.016);
}

function renderLayers(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  seed: number,
): void {
  const waveAmp = 0.05 + (seed % 80) / 2000;
  const baseLine = 0.38 + ((seed >> 8) % 120) / 400;
  const freq = 0.7 + (seed % 5) * 0.12;
  const phase = (seed % 628) / 100;
  const softWidth = 0.14 + (seed % 40) / 400;

  putField(ctx, w, h, colors, (nx, ny) => {
    const wave = waveY(nx * w, w, w * waveAmp, freq, phase, seed) / h;
    const boundary = baseLine + wave * 0.32;
    const edge = (ny - boundary) / softWidth;
    let t = 1 - smoothstep(clamp01(edge * 0.5 + 0.5));
    const valley = Math.max(0, -Math.sin(nx * Math.PI * 2 * freq + phase) * 0.04);
    t = clamp01(t - valley * (1 - t) * 0.5);
    t += (fbm(nx * 2, ny * 2, seed + 5, 4) - 0.5) * 0.04;
    return clamp01(t);
  }, seed + 21, 0.016);
}

function renderWaves(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  seed: number,
): void {
  const layerCount = Math.min(colors.length, 3 + (seed % 3));

  putField(ctx, w, h, colors, (nx, ny) => {
    let t = (1 - ny) * 0.35 + nx * 0.15;
    t += fbm(nx * 2, ny * 2, seed, 5) * 0.22;

    for (let layer = 1; layer < layerCount; layer++) {
      const baseY = 0.42 + layer * 0.14;
      const amp = 0.035 + layer * 0.012;
      const wave = waveY(nx * w, w, h * amp, 0.9 + layer * 0.25, layer * 1.7, seed + layer * 7) / h;
      const boundary = baseY + wave;
      const blend = smoothstep(clamp01((ny - boundary) / 0.12 + 0.5));
      t = t * (1 - blend * 0.55) + (layer / (layerCount - 1 || 1)) * blend * 0.55;
    }

    const glow = Math.max(0, 1 - Math.hypot(nx - 0.18, ny - 0.12) * 1.8) * 0.18;
    return clamp01(t + glow);
  }, seed + 44, 0.016);
}

/** Smooth mesh gradient — no triangles, no blur. */
function renderLowpoly(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
  seed: number,
  rng: () => number,
): void {
  const count = 8 + (seed % 4);
  const anchors = Array.from({ length: count }, () => ({
    x: 0.08 + rng() * 0.84,
    y: 0.08 + rng() * 0.84,
    t: rng(),
  }));

  putField(ctx, w, h, colors, (nx, ny) => {
    let sumW = 0;
    let sumT = 0;
    for (const a of anchors) {
      const dx = nx - a.x;
      const dy = ny - a.y;
      const d2 = dx * dx + dy * dy;
      const weight = 1 / (d2 + 0.045);
      sumW += weight;
      sumT += weight * a.t;
    }
    let t = sumT / sumW;
    t += (fbm(nx * 2.5, ny * 2.5, seed, 4) - 0.5) * 0.06;
    t = t * 0.78 + (1 - ny) * 0.12 + nx * 0.1;
    return clamp01(t);
  }, seed + 66, 0.014);
}

function renderPattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: GradientPatternStyle,
  colors: string[],
  seed: number,
  rng: () => number,
): void {
  switch (style) {
    case "marble":
      renderMarble(ctx, w, h, colors, seed);
      break;
    case "cloud":
      renderCloud(ctx, w, h, colors, seed);
      break;
    case "flow":
      renderFlow(ctx, w, h, colors, seed, rng);
      break;
    case "silk":
      renderSilk(ctx, w, h, colors, seed);
      break;
    case "layers":
      renderLayers(ctx, w, h, colors, seed);
      break;
    case "waves":
      renderWaves(ctx, w, h, colors, seed);
      break;
    case "lowpoly":
      renderLowpoly(ctx, w, h, colors, seed, rng);
      break;
  }
}

function downscale(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const scaled = document.createElement("canvas");
  scaled.width = width;
  scaled.height = height;
  const sctx = scaled.getContext("2d");
  if (!sctx) throw new Error("Could not get canvas 2D context");
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(source, 0, 0, width, height);
  return scaled;
}

/**
 * Generate a random organic gradient pattern on a canvas.
 * Renders at 2× supersample then downscales for clean edges — no blur pass.
 */
export function generateGradientPattern(
  options: GradientPatternOptions = {},
): GradientPatternResult {
  if (typeof document === "undefined") {
    throw new Error("generateGradientPattern must run in the browser");
  }

  const width = options.width ?? 640;
  const height = options.height ?? 400;
  const seed = resolveSeed(options.seed);
  const rng = createRng(seed);
  const style = resolveStyle(options.style, rng);
  const { name: paletteName, colors } = resolvePalette(options.palette, rng);
  const quality = Math.max(0.5, Math.min(1, options.quality ?? 1));
  const rw = Math.round(width * quality * SUPERSAMPLE);
  const rh = Math.round(height * quality * SUPERSAMPLE);

  const canvas = document.createElement("canvas");
  canvas.width = rw;
  canvas.height = rh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2D context");

  renderPattern(ctx, rw, rh, style, colors, seed, rng);

  const needsDownscale = rw !== width || rh !== height;
  const output = needsDownscale ? downscale(canvas, width, height) : canvas;

  return {
    dataUrl: output.toDataURL("image/png"),
    seed,
    style,
    paletteName,
    palette: colors,
    width,
    height,
  };
}

/** Generate multiple unique patterns at once (gallery / batch preview). */
export function generateGradientPatternBatch(
  count: number,
  options: Omit<GradientPatternOptions, "seed"> = {},
): GradientPatternResult[] {
  const baseSeed = resolveSeed();
  return Array.from({ length: count }, (_, i) =>
    generateGradientPattern({ ...options, seed: (baseSeed + i * 7919) >>> 0 }),
  );
}

/** Deterministic pattern from a string id (e.g. folder id) — same input → same output. */
export function generateGradientPatternFromId(
  id: string,
  options: Omit<GradientPatternOptions, "seed"> = {},
): GradientPatternResult {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return generateGradientPattern({ ...options, seed: hash >>> 0 });
}

export { GRADIENT_PALETTES, PALETTE_NAMES } from "./palettes";
