/** Deterministic hash → [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 41.17) * 43758.5453123;
  return n - Math.floor(n);
}

export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoother quintic interpolation for value noise. */
export function smootherstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = smootherstep(xf);
  const sy = smootherstep(yf);
  const n00 = hash2(xi, yi, seed);
  const n10 = hash2(xi + 1, yi, seed);
  const n01 = hash2(xi, yi + 1, seed);
  const n11 = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

/** Fractal Brownian motion — organic cloudy noise. */
export function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise(x * frequency, y * frequency, seed + i * 19.7);
    amplitude *= 0.5;
    frequency *= 2.05;
  }
  return value;
}

/** Domain-warped noise for marble / agate veins — low frequency for smooth flow. */
export function marbleNoise(x: number, y: number, seed: number): number {
  const warpX = fbm(x * 0.004, y * 0.004, seed, 3) * 4;
  const warpY = fbm(x * 0.004 + 4, y * 0.004 + 2, seed + 11, 3) * 4;
  const v = Math.sin((x * 0.012 + warpX) + (y * 0.01 + warpY) * 1.2 + seed * 0.01);
  const soft = fbm(x * 0.006, y * 0.006, seed + 5, 4);
  return v * 0.55 + soft * 0.45;
}

export function createRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
