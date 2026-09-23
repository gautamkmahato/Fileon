"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw, Shuffle } from "lucide-react";
import {
  generateGradientPattern,
  generateGradientPatternBatch,
  type GradientPatternResult,
  type GradientPatternStyle,
  GRADIENT_PATTERN_STYLES,
  GRADIENT_PALETTES,
  PALETTE_NAMES,
} from "@/lib/gradients/generateGradientPattern";

const STYLE_LABELS: Record<GradientPatternStyle, string> = {
  marble: "Marble — flowing diagonal ridges",
  cloud: "Cloud — soft noise fields",
  flow: "Flow — smooth color blooms",
  silk: "Silk — diagonal wave folds",
  layers: "Layers — smooth wave blend",
  waves: "Waves — lit translucent layers",
  lowpoly: "Mesh — smooth color blobs",
};

export default function GradientLabPage() {
  const [style, setStyle] = useState<GradientPatternStyle | "random">("random");
  const [palette, setPalette] = useState<keyof typeof GRADIENT_PALETTES | "random">("random");
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [gallery, setGallery] = useState<GradientPatternResult[]>([]);
  const [active, setActive] = useState<GradientPatternResult | null>(null);
  const [generating, setGenerating] = useState(false);

  const regenerate = useCallback((nextSeed?: number) => {
    setGenerating(true);
    requestAnimationFrame(() => {
      try {
        const result = generateGradientPattern({
          width: 800,
          height: 500,
          style,
          palette,
          seed: nextSeed,
          quality: 1,
        });
        setActive(result);
        setSeed(result.seed);
      } finally {
        setGenerating(false);
      }
    });
  }, [style, palette]);

  const regenerateGallery = useCallback(() => {
    setGenerating(true);
    requestAnimationFrame(() => {
      try {
        const batch = generateGradientPatternBatch(8, {
          width: 400,
          height: 260,
          style,
          palette,
          quality: 1,
        });
        setGallery(batch);
        setActive(batch[0] ?? null);
        if (batch[0]) setSeed(batch[0].seed);
      } finally {
        setGenerating(false);
      }
    });
  }, [style, palette]);

  useEffect(() => {
    regenerateGallery();
  }, [regenerateGallery]);

  function download(result: GradientPatternResult) {
    const a = document.createElement("a");
    a.href = result.dataUrl;
    a.download = `gradient-${result.style}-${result.seed}.png`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Gradient Lab</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Procedural noise + color ramps — marble, cloud, silk, layers, low-poly
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ← Back to Drive
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <section className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Style</span>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as GradientPatternStyle | "random")}
              className="h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 min-w-[180px]"
            >
              <option value="random">Random style</option>
              {GRADIENT_PATTERN_STYLES.map((s) => (
                <option key={s} value={s}>{STYLE_LABELS[s]}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Palette</span>
            <select
              value={palette}
              onChange={(e) => setPalette(e.target.value as keyof typeof GRADIENT_PALETTES | "random")}
              className="h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 min-w-[160px]"
            >
              <option value="random">Random palette</option>
              {PALETTE_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-400">Seed</span>
            <input
              type="number"
              value={seed ?? ""}
              placeholder="random"
              onChange={(e) => {
                const v = e.target.value;
                setSeed(v === "" ? undefined : Number(v) >>> 0);
              }}
              className="h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 w-36 font-mono text-sm"
            />
          </label>

          <button
            type="button"
            disabled={generating}
            onClick={() => regenerate(seed)}
            className="h-10 px-4 rounded-lg bg-white text-zinc-900 font-medium text-sm inline-flex items-center gap-2 hover:bg-zinc-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            Generate
          </button>

          <button
            type="button"
            disabled={generating}
            onClick={() => regenerate()}
            className="h-10 px-4 rounded-lg bg-zinc-800 border border-zinc-700 text-sm inline-flex items-center gap-2 hover:bg-zinc-700 disabled:opacity-50"
          >
            <Shuffle className="w-4 h-4" />
            Random seed
          </button>

          <button
            type="button"
            disabled={generating}
            onClick={regenerateGallery}
            className="h-10 px-4 rounded-lg bg-zinc-800 border border-zinc-700 text-sm hover:bg-zinc-700 disabled:opacity-50"
          >
            Refresh gallery
          </button>
        </section>

        {active && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-zinc-400">
                <span className="text-zinc-200 font-medium capitalize">{active.style}</span>
                {" · "}
                {active.paletteName}
                {" · "}
                seed <code className="font-mono text-zinc-300">{active.seed}</code>
              </div>
              <button
                type="button"
                onClick={() => download(active)}
                className="text-sm inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden ring-1 ring-zinc-700 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.dataUrl}
                alt={`${active.style} gradient pattern`}
                className="w-full h-auto block"
              />
            </div>
            <div className="flex gap-1">
              {active.palette.map((c) => (
                <div
                  key={c}
                  className="h-6 flex-1 rounded-md ring-1 ring-white/10"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </section>
        )}

        {gallery.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Gallery</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {gallery.map((item) => (
                <button
                  key={`${item.seed}-${item.style}`}
                  type="button"
                  onClick={() => {
                    setActive(item);
                    setSeed(item.seed);
                  }}
                  className={`rounded-xl overflow-hidden ring-2 transition-all text-left ${
                    active?.seed === item.seed && active?.style === item.style
                      ? "ring-white scale-[1.02]"
                      : "ring-zinc-800 hover:ring-zinc-600"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.dataUrl} alt="" className="w-full aspect-[400/260] object-cover" />
                  <div className="px-2 py-1.5 bg-zinc-900 text-[10px] text-zinc-500 capitalize">
                    {item.style} · {item.seed}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400 space-y-2">
          <h2 className="font-semibold text-zinc-200">How it works</h2>
          <p>
            Each style combines <strong className="text-zinc-300">fractal noise</strong>,{" "}
            <strong className="text-zinc-300">color ramps</strong>, and a fine{" "}
            <strong className="text-zinc-300">grain overlay</strong> — similar to the reference textures.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Marble</strong> — domain-warped sine + FBM veins</li>
            <li><strong>Cloud</strong> — multi-octave noise, posterized into soft bands</li>
            <li><strong>Flow</strong> — stacked radial gradients with additive blending</li>
            <li><strong>Silk</strong> — directional waves + gaussian blur</li>
            <li><strong>Layers / Waves</strong> — bezier wave fills with optional highlights</li>
            <li><strong>Low-poly</strong> — jittered grid triangulation with noise-mapped colors</li>
          </ul>
          <p className="font-mono text-xs text-zinc-500 pt-2">
            import {"{ generateGradientPattern }"} from &quot;@/lib/gradients/generateGradientPattern&quot;
          </p>
        </section>
      </main>
    </div>
  );
}
