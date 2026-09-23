export const GRADIENT_PALETTES: Record<string, string[]> = {
  peachCream: ["#fff8f3", "#f5e0d0", "#e8c4b0", "#d4a574", "#c4896a"],
  roseMauve: ["#faf0f2", "#e8d0d8", "#c9a8b4", "#9a7888", "#6e5868"],
  coralSilk: ["#fff5f0", "#fde0d6", "#f5b8a8", "#e89080", "#d07068"],
  terracotta: ["#fffaf6", "#f0ddd0", "#d4b0a0", "#b88878", "#965848", "#7a4038"],
  duskPink: ["#ffffff", "#f8e8ec", "#e8c8d4", "#c8a0b0", "#987888"],
  sageMist: ["#f4f8f4", "#d8e8dc", "#b0c8b8", "#88a898", "#688878"],
  oceanHaze: ["#f0f6fa", "#c8dce8", "#98b8d0", "#6890b0", "#406888"],
  amberGlow: ["#fffaf0", "#ffe8c8", "#f0c890", "#d8a060", "#b87840"],
};

export const PALETTE_NAMES = Object.keys(GRADIENT_PALETTES);

function paletteSmoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function pickRandomPalette(rng: () => number): { name: string; colors: string[] } {
  const name = PALETTE_NAMES[Math.floor(rng() * PALETTE_NAMES.length)];
  return { name, colors: [...GRADIENT_PALETTES[name]] };
}

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function samplePalette(t: number, colors: string[]): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(scaled));
  const f = paletteSmoothstep(scaled - i);
  const [r0, g0, b0] = parseHex(colors[i]);
  const [r1, g1, b1] = parseHex(colors[i + 1]);
  return [
    Math.round(r0 + (r1 - r0) * f),
    Math.round(g0 + (g1 - g0) * f),
    Math.round(b0 + (b1 - b0) * f),
  ];
}
