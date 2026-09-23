"use client";

/**
 * Movie search with Jev — single-file Next.js page (app/page.tsx).
 *
 * Reads the enriched catalogue produced by enrich.py, ranks it locally, then sends a
 * shortlist to Jev in one request. Two modes:
 *   Recommend        — "good horror movies set in London"
 *   Find the one     — "an action movie in New York where the villain was a police officer"
 *
 * Put the catalogue at public/catalog.jsonl (the output of enrich.py) or load the file
 * with the picker. The Jev key is used from the browser, which is fine locally; for
 * anything public, move the fetch into a route handler.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

/* ================================================================== */
/* Config                                                              */
/* ================================================================== */

const CATALOG_URL = "/catalog.jsonl";
const PRICE_PER_M_INPUT = 0.042;
const MAX_CANDIDATES = 255; // Jev's Choice limit
const MATCH_LEVELS = [
  "Not what the person described",
  "Loosely related",
  "A close match",
  "Exactly what the person described",
];

const PROVIDERS = {
  openrouter: { label: "OpenRouter", url: "https://openrouter.ai/api/v1/systemone", model: "typesafe/jev-1.13" },
  typesafe: { label: "TypeSafe (official)", url: "https://api.typesafe.ai/v1/systemone", model: "jev-1.13.0" },
  community: { label: "Jev AI Community", url: "https://www.jevai.org/api/v1/decisions", model: "typesafe-ai/jev" },
} as const;
type ProviderId = keyof typeof PROVIDERS;

// Labels for the attributes enrich.py writes. Keep in step with the vocabularies there.
const GENRES: Record<string, string> = {
  action: "Action", thriller: "Thriller", horror: "Horror", comedy: "Comedy", drama: "Drama",
  romance: "Romance", scifi: "Science fiction", fantasy: "Fantasy", crime: "Crime", mystery: "Mystery",
  war: "War", western: "Western", animation: "Animation", family: "Family", documentary: "Documentary",
  biography: "Biography", musical: "Musical", adventure: "Adventure",
};
const PLACES: Record<string, string> = {
  new_york: "New York", los_angeles: "Los Angeles", chicago: "Chicago", other_us_city: "Another US city",
  london: "London", other_uk: "Elsewhere in the UK", paris: "Paris", other_europe: "Elsewhere in Europe",
  india: "India", japan: "Japan", china_hk: "China or Hong Kong", korea: "Korea", other_asia: "Elsewhere in Asia",
  africa: "Africa", latin_america: "Latin America", middle_east: "Middle East", australia: "Australia",
  rural_wilderness: "Countryside or wilderness", space: "Space", fictional_world: "An invented world", unclear: "Unclear",
};
const ERAS: Record<string, string> = {
  present: "Present day", near_future: "Near future", far_future: "Far future", "1990s_2000s": "1990s–2000s",
  "1960s_1980s": "1960s–80s", early_1900s: "1900–1950s", "19th_century": "1800s", historical: "Before 1800", unclear: "Unclear",
};
const VILLAINS: Record<string, string> = {
  police_or_official: "A police officer or official", criminal_boss: "A crime boss", killer: "A killer",
  monster: "A monster", supernatural: "Something supernatural", alien: "Aliens", machine: "An AI or machine",
  company: "A company", government_military: "A government or army", nature_disaster: "Nature or disaster",
  family_or_friend: "Someone close to them", self_or_society: "Themselves or society", none: "No villain", unclear: "Unclear",
};
const FACETS = [
  { key: "genre", label: "Genre", labels: GENRES },
  { key: "place", label: "Setting", labels: PLACES },
  { key: "era", label: "Era", labels: ERAS },
  { key: "villain", label: "Villain", labels: VILLAINS },
] as const;

const EXAMPLES = [
  "good horror movies set in London",
  "an action movie in New York where the main villain was a police officer",
  "slow, sad film about grief with a twist ending",
  "funny heist movie in Paris, nothing scary",
  "science fiction on a spaceship, very dark tone",
];

/* ================================================================== */
/* Types and helpers                                                   */
/* ================================================================== */

type Attrs = {
  genre?: string; genre2?: string; place?: string; era?: string; villain?: string;
  tone?: number | null; scary?: number | null; pace?: number | null;
  true_story?: number | null; twist?: number | null; kid_friendly?: number | null;
};
type Movie = {
  id: string; title: string; year?: number | null; genres?: string; rating?: string | number | null;
  overview?: string; card?: string; has_plot?: boolean; attrs?: Attrs;
};
type Indexed = Movie & { terms: Map<string, number>; length: number };
type Result = { movie: Movie; level: number | null; prob: number; local: number; isBest: boolean };
type Stats = {
  total: number; filtered: number; candidates: number; localMs: number;
  jevMs?: number; tokens?: number; cost?: number | null; questions?: number; provider?: string;
};

type Json = Record<string, unknown>;
const asObj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtMs = (ms?: number) => (ms == null ? "–" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`);
const fmtCost = (c?: number | null) => (c == null ? "–" : c < 0.0001 ? `$${c.toFixed(6)}` : `$${c.toFixed(4)}`);

const STOP = new Set(
  "a an the of in on at to for with and or but is are was were be been it its this that i me my we you he she they them his her their from about like as very really good great best some any".split(" ")
);
function tokenize(text: string): string[] {
  const words = (text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) || []).filter(
    (w) => w.length > 1 && !STOP.has(w)
  );
  return words.map(stem);
}
function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Text a search is matched against: title, attributes in words, and the overview. */
function searchableText(m: Movie): string {
  const a = m.attrs || {};
  return [
    m.title, m.year ?? "", m.genres ?? "",
    GENRES[a.genre ?? ""] ?? "", GENRES[a.genre2 ?? ""] ?? "",
    PLACES[a.place ?? ""] ?? "", ERAS[a.era ?? ""] ?? "",
    a.villain && a.villain !== "none" ? `villain ${VILLAINS[a.villain] ?? ""}` : "",
    (a.twist ?? 0) > 0.7 ? "twist ending surprise" : "",
    (a.true_story ?? 0) > 0.7 ? "based on a true story" : "",
    m.overview ?? "",
  ].join(" ");
}

function cardFor(m: Movie): string {
  if (m.card) return m.card;
  const a = m.attrs || {};
  const facts = [GENRES[a.genre ?? ""], PLACES[a.place ?? ""], ERAS[a.era ?? ""]].filter(Boolean);
  const villain = a.villain && !["none", "unclear"].includes(a.villain) ? `villain: ${VILLAINS[a.villain]}` : "";
  return `${m.title}${m.year ? ` (${m.year})` : ""}. ${[...facts, villain].filter(Boolean).join("; ")}. ${(m.overview || "").slice(0, 260)}`;
}

function badgesFor(m: Movie): string[] {
  const a = m.attrs || {};
  return [
    GENRES[a.genre ?? ""],
    a.place && a.place !== "unclear" ? PLACES[a.place] : "",
    a.era && a.era !== "unclear" ? ERAS[a.era] : "",
    a.villain && !["none", "unclear"].includes(a.villain) ? `villain: ${VILLAINS[a.villain]}` : "",
    (a.true_story ?? 0) > 0.7 ? "based on a true story" : "",
    (a.twist ?? 0) > 0.7 ? "has a twist" : "",
  ].filter(Boolean) as string[];
}

/* ================================================================== */
/* Local ranking (stage 2)                                             */
/* ================================================================== */

function buildIndex(movies: Movie[]): { rows: Indexed[]; df: Map<string, number> } {
  const rows: Indexed[] = [];
  const df = new Map<string, number>();
  for (const m of movies) {
    const terms = new Map<string, number>();
    const words = tokenize(searchableText(m));
    for (const w of words) terms.set(w, (terms.get(w) || 0) + 1);
    for (const w of terms.keys()) df.set(w, (df.get(w) || 0) + 1);
    rows.push({ ...m, terms, length: Math.max(1, words.length) });
  }
  return { rows, df };
}

/** BM25-style scoring: cheap, instant, and good enough to build a shortlist. */
function scoreLocally(rows: Indexed[], df: Map<string, number>, query: string, allowed: number[]): Float64Array {
  const qTerms = [...new Set(tokenize(query))];
  const scores = new Float64Array(rows.length);
  if (!qTerms.length) return scores;
  const N = rows.length;
  const avgLen = rows.reduce((s, r) => s + r.length, 0) / Math.max(1, N);
  const k1 = 1.2;
  const b = 0.6;
  for (const i of allowed) {
    const row = rows[i];
    let total = 0;
    for (const t of qTerms) {
      const tf = row.terms.get(t) || 0;
      if (!tf) continue;
      const idf = Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
      total += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * row.length) / avgLen)));
    }
    scores[i] = total;
  }
  return scores;
}

/* ================================================================== */
/* Jev (stage 3)                                                       */
/* ================================================================== */

type JevOutcome = {
  levels: Record<string, number>;
  probs: Record<string, number>;
  best: string | null;
  inList: number | null;
  tokens: number;
  cost: number | null;
  latencyMs: number;
  questions: number;
};

async function askJev(
  provider: ProviderId,
  apiKey: string,
  model: string,
  query: string,
  shortlist: Movie[],
  identify: boolean
): Promise<JevOutcome> {
  const state = {
    search: query,
    candidates: Object.fromEntries(shortlist.map((m) => [m.id, cardFor(m)])),
  };
  const questions: Record<string, unknown> = {};
  for (const m of shortlist) {
    questions[`m_${m.id}`] = {
      type: "score",
      instructions: `How well does \`candidates.${m.id}\` match \`search\`?`,
      criteria: MATCH_LEVELS,
    };
  }
  questions.best = {
    type: "choice",
    instructions: "Which candidate best matches `search`?",
    criteria: Object.fromEntries(shortlist.map((m) => [m.id, null])),
  };
  if (identify) {
    questions.in_list = {
      type: "noul",
      instructions: "Is the film the person is describing in `candidates`?",
      criteria: {
        true: "One candidate is the film they mean, even if some remembered details are wrong",
        false: "None of the candidates is the film they mean",
      },
    };
  }

  const t0 = performance.now();
  const res = await fetch(PROVIDERS[provider].url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, state, questions }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${PROVIDERS[provider].label} ${res.status}: ${text.slice(0, 200)}`);
  const latencyMs = performance.now() - t0;

  let data = asObj(JSON.parse(text));
  if (typeof data.code === "number" && "data" in data) {
    if (data.code !== 0) throw new Error(String(data.message || "Request failed"));
    data = asObj(data.data);
  }
  const answers = asObj(data.answers);
  const levels: Record<string, number> = {};
  for (const m of shortlist) {
    const s = num(asObj(answers[`m_${m.id}`]).score);
    if (s !== undefined) levels[m.id] = s;
  }
  const bestAnswer = asObj(answers.best);
  const probsRaw = asObj(bestAnswer.probabilities);
  const probs: Record<string, number> = {};
  for (const [k, v] of Object.entries(probsRaw)) {
    const p = num(v);
    if (p !== undefined) probs[k] = p;
  }
  const usage = asObj(data.usage);
  const tokens = num(usage.input_tokens) ?? num(usage.prompt_tokens) ?? 0;

  return {
    levels,
    probs,
    best: typeof bestAnswer.choice === "string" ? bestAnswer.choice : null,
    inList: num(asObj(answers.in_list).noul) ?? null,
    tokens,
    cost: num(usage.cost) ?? (tokens ? (tokens * PRICE_PER_M_INPUT) / 1e6 : null),
    latencyMs,
    questions: Object.keys(questions).length,
  };
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

export default function Page() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadNote, setLoadNote] = useState("Loading catalogue…");
  const [provider, setProvider] = useState<ProviderId>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState<string>(PROVIDERS.openrouter.model);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"recommend" | "identify">("recommend");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [candidates, setCandidates] = useState(50);
  const [useJev, setUseJev] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const [results, setResults] = useState<Result[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [inList, setInList] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);

  // Key stays in this browser tab only.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("jev-key");
      const savedProvider = sessionStorage.getItem("jev-provider") as ProviderId | null;
      if (saved) setApiKey(saved);
      if (savedProvider && PROVIDERS[savedProvider]) {
        setProvider(savedProvider);
        setModel(PROVIDERS[savedProvider].model);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    try {
      apiKey ? sessionStorage.setItem("jev-key", apiKey) : sessionStorage.removeItem("jev-key");
      sessionStorage.setItem("jev-provider", provider);
    } catch {
      /* storage unavailable */
    }
  }, [apiKey, provider]);

  const parseCatalog = useCallback((text: string): Movie[] => {
    const trimmed = text.trim();
    if (trimmed.startsWith("[")) return JSON.parse(trimmed) as Movie[];
    return trimmed
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Movie);
  }, []);

  // Load public/catalog.jsonl if it is there; otherwise wait for the file picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(CATALOG_URL);
        if (!res.ok) throw new Error(String(res.status));
        const rows = parseCatalog(await res.text());
        if (!cancelled) {
          setMovies(rows);
          setLoadNote("");
        }
      } catch {
        if (!cancelled) setLoadNote("No catalogue found. Put enriched.jsonl in public/catalog.jsonl, or load the file below.");
      }
    })();
    return () => { cancelled = true; };
  }, [parseCatalog]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMovies(parseCatalog(await file.text()));
      setLoadNote("");
    } catch (err) {
      setLoadNote(`Could not read that file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const index = useMemo(() => buildIndex(movies), [movies]);

  const facetCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = { genre: {}, place: {}, era: {}, villain: {} };
    for (const m of movies) {
      const a = (m.attrs || {}) as Record<string, unknown>;
      for (const key of Object.keys(counts)) {
        const v = a[key];
        if (typeof v === "string") counts[key][v] = (counts[key][v] || 0) + 1;
      }
    }
    return counts;
  }, [movies]);

  const withPlot = useMemo(() => movies.filter((m) => m.has_plot).length, [movies]);

  function allowedIndexes(): number[] {
    const from = Number(yearFrom) || 0;
    const to = Number(yearTo) || 0;
    const out: number[] = [];
    index.rows.forEach((m, i) => {
      const a = m.attrs || {};
      if (filters.genre && filters.genre !== a.genre && filters.genre !== a.genre2) return;
      if (filters.place && filters.place !== a.place) return;
      if (filters.era && filters.era !== a.era) return;
      if (filters.villain && filters.villain !== a.villain) return;
      if (filters.kids === "yes" && (a.kid_friendly ?? 0) < 0.6) return;
      const year = m.year || 0;
      if (from && year && year < from) return;
      if (to && year && year > to) return;
      out.push(i);
    });
    return out;
  }

  async function runSearch(text?: string) {
    const q = (text ?? query).trim();
    if (!q || !movies.length) return;
    const mine = ++seq.current;
    setQuery(q);
    setBusy(true);
    setError("");
    setInList(null);

    const t0 = performance.now();
    const allowed = allowedIndexes();
    const local = scoreLocally(index.rows, index.df, q, allowed);
    const n = Math.max(5, Math.min(MAX_CANDIDATES, candidates));
    const shortIdx = [...allowed].sort((a, b) => local[b] - local[a]).slice(0, n);
    const shortlist = shortIdx.map((i) => movies[i]);
    const localMs = performance.now() - t0;

    if (!useJev || !apiKey) {
      if (mine !== seq.current) return;
      setResults(shortlist.slice(0, 25).map((m, k) => ({ movie: m, level: null, prob: 0, local: local[shortIdx[k]], isBest: false })));
      setStats({ total: movies.length, filtered: allowed.length, candidates: shortlist.length, localMs });
      if (!apiKey && useJev) setError("Add your Jev API key to rank these by meaning.");
      setBusy(false);
      return;
    }

    try {
      const out = await askJev(provider, apiKey, model, q, shortlist, mode === "identify");
      if (mine !== seq.current) return;
      const ranked: Result[] = shortlist
        .map((m, k) => ({
          movie: m,
          level: out.levels[m.id] ?? null,
          prob: out.probs[m.id] ?? 0,
          local: local[shortIdx[k]],
          isBest: out.best === m.id,
        }))
        .sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || b.prob - a.prob || b.local - a.local);
      const keep = ranked.filter((r) => (r.level ?? 0) >= 1);
      setResults((keep.length ? keep : ranked.slice(0, 5)).slice(0, 25));
      setInList(out.inList);
      setStats({
        total: movies.length,
        filtered: allowed.length,
        candidates: shortlist.length,
        localMs,
        jevMs: out.latencyMs,
        tokens: out.tokens,
        cost: out.cost,
        questions: out.questions,
        provider: PROVIDERS[provider].label,
      });
    } catch (err) {
      if (mine !== seq.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setResults(shortlist.slice(0, 25).map((m, k) => ({ movie: m, level: null, prob: 0, local: local[shortIdx[k]], isBest: false })));
      setStats({ total: movies.length, filtered: allowed.length, candidates: shortlist.length, localMs });
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  const banner = (() => {
    if (mode !== "identify" || inList == null) return null;
    const pct = Math.round(inList * 100);
    const best = results.find((r) => r.isBest);
    if (inList >= 0.7) return { kind: "good", text: `Jev is ${pct}% sure your film is in this list${best ? `, most likely ${best.movie.title}` : ""}.` };
    if (inList >= 0.35) return { kind: "maybe", text: `Jev is only ${pct}% sure your film is here. Try adding a detail, or widen the filters.` };
    return { kind: "bad", text: `Jev is ${pct}% sure your film is not in this list. Try different words, or drop a detail you may be misremembering.` };
  })();

  return (
    <div className="jm">
      <style>{CSS}</style>

      <header className="head">
        <div>
          <h1>Movie search with <span>Jev</span></h1>
          <p className="sub">
            {movies.length
              ? `${fmtInt(movies.length)} titles${withPlot ? ` · ${fmtInt(withPlot)} with a full plot` : ""} · filter, shortlist, then let Jev judge`
              : loadNote}
          </p>
        </div>
        <button className="ghost" onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? "Hide settings" : "Settings"}
        </button>
      </header>

      {showSettings && (
        <section className="panel settings">
          <label className="field">
            <span>Provider</span>
            <select
              value={provider}
              onChange={(e) => {
                const p = e.target.value as ProviderId;
                setProvider(p);
                setModel(PROVIDERS[p].model);
              }}
            >
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <option key={id} value={id}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>API key</span>
            <div className="row">
              <input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value.trim())} placeholder="Your Jev key" spellCheck={false} />
              <button className="ghost" onClick={() => setShowKey((s) => !s)}>{showKey ? "Hide" : "Show"}</button>
            </div>
          </label>
          <label className="field">
            <span>Model</span>
            <input value={model} onChange={(e) => setModel(e.target.value.trim())} spellCheck={false} />
          </label>
          <label className="field">
            <span>Catalogue file (enriched.jsonl)</span>
            <input type="file" accept=".jsonl,.json,application/json" onChange={onFile} />
          </label>
          <p className="hint">The key stays in this browser tab. For anything public, call Jev from a server route instead.</p>
        </section>
      )}

      <section className="panel search">
        <div className="row">
          <input
            className="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
            placeholder="Describe what you want to watch, or the film you half-remember"
            aria-label="Search"
          />
          <button className="primary" onClick={() => runSearch()} disabled={busy || !movies.length}>
            {busy ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="row wrap gap">
          <div className="seg" role="group" aria-label="Mode">
            <button aria-pressed={mode === "recommend"} onClick={() => setMode("recommend")}>Recommend</button>
            <button aria-pressed={mode === "identify"} onClick={() => setMode("identify")}>Find the one I mean</button>
          </div>
          <span className="hint">
            {mode === "recommend"
              ? "Ranks the catalogue by how well each film fits."
              : "For a film you half-remember. Jev also says whether it thinks the film is in the list at all."}
          </span>
        </div>

        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip" onClick={() => runSearch(ex)}>{ex}</button>
          ))}
        </div>
      </section>

      <section className="panel filters">
        {FACETS.map((f) => {
          const counts = facetCounts[f.key] || {};
          const options = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
          return (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <select value={filters[f.key] || ""} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}>
                <option value="">Any</option>
                {options.map((id) => (
                  <option key={id} value={id}>{`${f.labels[id] ?? id} (${fmtInt(counts[id])})`}</option>
                ))}
              </select>
            </label>
          );
        })}
        <label className="field">
          <span>Year from</span>
          <input inputMode="numeric" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} placeholder="1950" />
        </label>
        <label className="field">
          <span>Year to</span>
          <input inputMode="numeric" value={yearTo} onChange={(e) => setYearTo(e.target.value)} placeholder="2026" />
        </label>
        <div className="tools">
          <label className="inline">
            Candidates sent to Jev
            <input type="range" min={10} max={150} step={10} value={candidates} onChange={(e) => setCandidates(Number(e.target.value))} />
            <b>{candidates}</b>
          </label>
          <label className="inline"><input type="checkbox" checked={useJev} onChange={(e) => setUseJev(e.target.checked)} /> Use Jev</label>
          <label className="inline">
            <input type="checkbox" checked={filters.kids === "yes"} onChange={(e) => setFilters({ ...filters, kids: e.target.checked ? "yes" : "" })} /> For children
          </label>
          <button className="ghost small" onClick={() => { setFilters({}); setYearFrom(""); setYearTo(""); }}>Clear filters</button>
        </div>
      </section>

      {stats && (
        <p className="stats">
          <span>catalogue <b>{fmtInt(stats.total)}</b></span>
          <span>after filters <b>{fmtInt(stats.filtered)}</b></span>
          <span>sent to Jev <b>{fmtInt(stats.candidates)}</b></span>
          <span>local <b>{fmtMs(stats.localMs)}</b></span>
          {stats.jevMs != null && <span>Jev <b>{fmtMs(stats.jevMs)}</b></span>}
          {stats.tokens != null && <span><b>{fmtInt(stats.tokens)}</b> tokens</span>}
          {stats.cost != null && <span><b>{fmtCost(stats.cost)}</b></span>}
          {stats.questions != null && <span>{stats.questions} questions in 1 request</span>}
        </p>
      )}

      {error && <p className="banner bad">{error}</p>}
      {banner && <p className={`banner ${banner.kind}`}>{banner.text}</p>}

      <div className="results">
        {results.map((r) => {
          const pct = r.level == null ? null : Math.round((r.level / (MATCH_LEVELS.length - 1)) * 100);
          return (
            <article key={r.movie.id} className={`card${r.isBest ? " best" : ""}`}>
              <h3>
                {r.movie.title} <small>{r.movie.year || ""}{r.movie.rating ? ` · ★ ${r.movie.rating}` : ""}</small>
              </h3>
              <div className="badges">
                {r.isBest && <span className="badge best">best guess</span>}
                {badgesFor(r.movie).map((b) => <span className="badge" key={b}>{b}</span>)}
              </div>
              {pct != null && (
                <div className="match">
                  <span>match</span>
                  <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                  <span>{pct}%</span>
                </div>
              )}
              <p className="ov">{r.movie.overview}</p>
            </article>
          );
        })}
        {!results.length && !busy && movies.length > 0 && (
          <p className="empty">Type what you feel like watching, or pick an example above.</p>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Styles                                                              */
/* ================================================================== */

const CSS = `
.jm { --bg:#0f1115; --panel:#171a21; --panel2:#1e222b; --line:#2a2f3a; --ink:#e8eaef; --muted:#99a1b0;
  --accent:#f0b429; --accent2:#2dd4bf; --err:#f87171;
  min-height:100vh; background:var(--bg); color:var(--ink); color-scheme:dark;
  font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  max-width:1040px; margin:0 auto; padding:28px 20px 80px; }
.jm * { box-sizing:border-box; }
.head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
.jm h1 { font-size:24px; margin:0; letter-spacing:-.02em; }
.jm h1 span { color:var(--accent); }
.sub { color:var(--muted); font-size:13.5px; margin:6px 0 0; }
.hint { color:var(--muted); font-size:12.5px; margin:0; }
.panel { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; margin-top:18px; }
.row { display:flex; gap:10px; align-items:center; }
.row.wrap { flex-wrap:wrap; }
.gap { margin-top:12px; }
.jm input, .jm select { font:inherit; color:var(--ink); background:var(--panel2); border:1px solid var(--line);
  border-radius:8px; padding:10px 12px; width:100%; }
.jm input[type=range] { padding:0; border:0; width:140px; accent-color:var(--accent); }
.jm input[type=checkbox] { width:auto; accent-color:var(--accent2); }
.jm input[type=file] { padding:7px; }
.jm input:focus, .jm select:focus, .jm button:focus-visible { outline:2px solid var(--accent2); outline-offset:1px; }
.q { font-size:16px; }
.jm button { font:inherit; font-weight:600; border:1px solid var(--line); background:var(--panel2); color:var(--ink);
  border-radius:8px; padding:10px 16px; cursor:pointer; white-space:nowrap; }
.jm button.primary { background:var(--accent); border-color:var(--accent); color:#17190f; }
.jm button.ghost { background:transparent; font-weight:500; }
.jm button.small { padding:6px 12px; font-size:13px; }
.jm button:disabled { opacity:.5; cursor:default; }
.seg { display:inline-flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
.seg button { border:0; border-radius:0; background:transparent; font-weight:500; padding:9px 14px; }
.seg button[aria-pressed=true] { background:var(--accent2); color:#08211f; font-weight:650; }
.chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
.chip { font-size:13px; padding:5px 11px; border-radius:999px; background:var(--panel2); color:var(--muted); font-weight:400; }
.chip:hover { color:var(--ink); }
.settings, .filters { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
.field { display:grid; gap:4px; font-size:12px; color:var(--muted); min-width:0; }
.settings .hint, .filters .tools { grid-column:1/-1; }
.tools { display:flex; flex-wrap:wrap; gap:16px; align-items:center; font-size:13px; color:var(--muted); }
.inline { display:flex; gap:8px; align-items:center; }
.stats { display:flex; flex-wrap:wrap; gap:6px 18px; font-size:12.5px; color:var(--muted); margin:16px 0 0; }
.stats b { color:var(--ink); font-variant-numeric:tabular-nums; }
.banner { margin-top:14px; padding:12px 14px; border-radius:10px; font-size:14px; }
.banner.good { background:rgba(52,211,153,.12); border:1px solid rgba(52,211,153,.3); }
.banner.maybe { background:rgba(251,191,36,.12); border:1px solid rgba(251,191,36,.3); }
.banner.bad { background:rgba(248,113,113,.12); border:1px solid rgba(248,113,113,.3); color:#fecaca; }
.results { display:grid; gap:12px; margin-top:16px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px 16px; display:grid; gap:8px; }
.card.best { border-color:var(--accent); }
.card h3 { margin:0; font-size:17px; font-weight:650; }
.card h3 small { color:var(--muted); font-weight:400; font-size:14px; }
.badges { display:flex; gap:8px; flex-wrap:wrap; }
.badge { font-size:12px; padding:3px 9px; border-radius:999px; background:var(--panel2); border:1px solid var(--line); color:var(--muted); }
.badge.best { background:var(--accent); color:#17190f; border-color:var(--accent); font-weight:650; }
.match { display:flex; align-items:center; gap:10px; font-size:12.5px; color:var(--muted); }
.bar { flex:1; max-width:220px; height:7px; border-radius:4px; background:var(--panel2); overflow:hidden; }
.bar > i { display:block; height:100%; background:var(--accent2); }
.ov { color:var(--muted); font-size:13.5px; margin:0; }
.empty { color:var(--muted); padding:24px 0; }
`;