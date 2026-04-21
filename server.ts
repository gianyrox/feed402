/**
 * feed402 v0.2 — reference data provider server
 *
 * Implements SPEC.md §1 (discovery), §2 (handshake), §3 (envelope),
 * §4 (index manifest — v0.2 optional), §5 (tiers: raw, query, insight),
 * §6 (errors).
 *
 * Payment verification in v0.2 is STUBBED: presence of an `x-payment`
 * header is treated as a valid payment. A production server would plug
 * in the x402 facilitator signature check here (see §2 — unchanged from
 * stock x402).
 *
 * Ship target: <300 LOC, Hono, Node 20+, no database, in-memory index.
 *
 * Run: npm run dev
 */

import { createHash } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  SPEC_VERSION,
  type Citation,
  type CitationSource,
  type Envelope,
  type ErrorBody,
  type IndexManifest,
  type Manifest,
  type Receipt,
  type RetrievalProvenance,
  type TierName,
  type TierSpec,
} from "./types.js";

// ---------- Provider config ----------

const PROVIDER_NAME = "feed402-reference";
const PROVIDER_VERSION = "0.1.0-alpha.1";
const PROVIDER_WALLET: `0x${string}` =
  (process.env.FEED402_WALLET as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";
const CHAIN = process.env.FEED402_CHAIN ?? "base-sepolia";

const TIERS: Record<TierName, TierSpec> = {
  raw:     { path: "/raw",     price_usd: 0.05,  unit: "row" },
  query:   { path: "/query",   price_usd: 0.01,  unit: "call" },
  insight: { path: "/insight", price_usd: 0.002, unit: "call" },
};

// ---------- In-memory demo corpus ----------
// A tiny set of "papers" so raw/query/insight have something to return.
// Replace with a real upstream in a production provider.

interface Paper {
  id: string;           // e.g. "pubmed:12345678"
  title: string;
  abstract: string;
  year: number;
  canonical_url: string;
}

const CORPUS: Paper[] = [
  {
    id: "pubmed:38831607",
    title: "Caloric restriction and lifespan in mammals",
    abstract: "Review of caloric restriction effects on lifespan across mammalian species...",
    year: 2024,
    canonical_url: "https://pubmed.ncbi.nlm.nih.gov/38831607/",
  },
  {
    id: "pubmed:34588695",
    title: "Mitochondrial uncoupling and metabolic health",
    abstract: "UCP1-mediated uncoupling in brown adipose tissue and its role in thermogenesis...",
    year: 2021,
    canonical_url: "https://pubmed.ncbi.nlm.nih.gov/34588695/",
  },
  {
    id: "pubmed:31631676",
    title: "Circadian rhythm disruption and metabolic disease",
    abstract: "Epidemiological and mechanistic evidence linking circadian misalignment to obesity...",
    year: 2019,
    canonical_url: "https://pubmed.ncbi.nlm.nih.gov/31631676/",
  },
];

// ---------- §4: Index manifest (v0.2) ----------
//
// The reference server's "retrieval" is a naive substring match over the
// tiny in-memory CORPUS. That is intentionally sparse — it lets us exercise
// the §3.2 retrieval-provenance envelope without pulling in an embedding
// model. A production merchant swaps this block for its real index metadata
// (voyage-3-large, openai:text-embedding-3-small, bm25, hybrid, etc.).
//
// One chunk per paper; chunk_id format is `<source_id>#c0`.

/** Stable hex SHA-256 of the corpus — spec §4.1 `corpus_sha256`. */
function computeCorpusHash(papers: Paper[]): string {
  const sorted = [...papers].sort((a, b) => a.id.localeCompare(b.id));
  const h = createHash("sha256");
  for (const p of sorted) {
    h.update(p.id);
    h.update("\0");
    h.update(createHash("sha256").update(`${p.title}\n${p.abstract}`).digest("hex"));
    h.update("\n");
  }
  return h.digest("hex");
}

const INDEX_BUILT_AT = new Date().toISOString();
const INDEX_MODEL = "none"; // sparse substring matcher — see §4.1
const INDEX: IndexManifest = {
  type: "sparse",
  model: INDEX_MODEL,
  chunks: CORPUS.length,
  chunk_strategy: { kind: "post" }, // one chunk == one paper
  corpus_sha256: computeCorpusHash(CORPUS),
  built_at: INDEX_BUILT_AT,
};

/** §3.2 chunk id for a paper. One chunk per paper → always `#c0`. */
function chunkIdOf(paper: Paper): string {
  return `${paper.id}#c0`;
}

/** Naive substring-match "score" in [0, 1] for the reference sparse retriever. */
function substringScore(paper: Paper, q: string): number {
  if (!q) return 0;
  const hay = `${paper.title}\n${paper.abstract}`.toLowerCase();
  const needle = q.toLowerCase();
  if (!hay.includes(needle)) return 0;
  // Tiny heuristic: normalize by needle length so longer matches score lower
  // than shorter, more specific ones. Deterministic; fine for a demo.
  return Math.min(1, needle.length / Math.max(4, hay.length / 8));
}

// ---------- Helpers ----------

function traceId(): string {
  return `tr_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Build a §3 `source` citation.
 *
 * When the caller supplies a retrieval hit (`retrieval` + optional explicit
 * `chunk_id`), we attach §3.2 retrieval provenance so the envelope is
 * re-verifiable against our §4 index manifest. The `raw` tier omits both —
 * bulk fetches are not retrieval hits.
 */
function sourceCitation(
  paper: Paper,
  opts?: { retrieval?: RetrievalProvenance; chunkId?: string },
): CitationSource {
  const cit: CitationSource = {
    type: "source",
    source_id: paper.id,
    provider: PROVIDER_NAME,
    retrieved_at: now(),
    license: "CC-BY-4.0",
    canonical_url: paper.canonical_url,
  };
  if (opts?.retrieval) {
    cit.chunk_id = opts.chunkId ?? chunkIdOf(paper);
    cit.retrieval = opts.retrieval;
  }
  return cit;
}

function makeReceipt(tier: TierName, tx: string): Receipt {
  return {
    tier,
    price_usd: TIERS[tier].price_usd,
    tx,
    paid_at: now(),
  };
}

/** Stub: a real implementation validates the x402 payment header against a facilitator. */
function verifyPayment(c: Context): { ok: true; tx: string } | { ok: false } {
  const header = c.req.header("x-payment");
  if (!header) return { ok: false };
  // v0.1 stub: treat any x-payment header as a valid payment.
  // v0.2 will verify signature + amount against the facilitator.
  return { ok: true, tx: `stub:${header.slice(0, 16)}` };
}

function x402Challenge(c: Context, tier: TierName) {
  const spec = TIERS[tier];
  c.header(
    "x-payment-required",
    JSON.stringify({
      chain: CHAIN,
      wallet: PROVIDER_WALLET,
      price_usd: spec.price_usd,
      unit: spec.unit,
      tier,
    }),
  );
  return c.json<ErrorBody>(
    { error: { code: "payment_required", message: "x402 payment required" }, trace_id: traceId() },
    402,
  );
}

function handleTier(
  c: Context,
  tier: TierName,
  produce: (input: unknown) => { data: unknown; citation: Citation } | null,
) {
  const pay = verifyPayment(c);
  if (!pay.ok) return x402Challenge(c, tier);
  const input = c.req.method === "POST" ? c.req.json().catch(() => ({})) : Promise.resolve({});
  return input.then((body) => {
    const produced = produce(body);
    if (!produced) {
      return c.json<ErrorBody>(
        { error: { code: "invalid_input", message: "no matching records" }, trace_id: traceId() },
        400,
      );
    }
    const env: Envelope = {
      data: produced.data,
      citation: produced.citation,
      receipt: makeReceipt(tier, pay.tx),
    };
    return c.json(env, 200);
  });
}

// ---------- App ----------

const app = new Hono();

// §1: Discovery manifest (v0.2 — includes §4 optional `index` block)
app.get("/.well-known/feed402.json", (c) => {
  const manifest: Manifest = {
    name: PROVIDER_NAME,
    version: PROVIDER_VERSION,
    spec: SPEC_VERSION,
    chain: CHAIN,
    wallet: PROVIDER_WALLET,
    tiers: TIERS,
    citation_policy: "CC-BY-4.0",
    citation_types: ["source"],
    contact: "ops@example.com",
    index: INDEX,
  };
  return c.json(manifest);
});

// §4: /raw — bulk rows, pay per row (stub pricing = flat)
app.post("/raw", (c) =>
  handleTier(c, "raw", (body) => {
    const b = body as { ids?: string[]; limit?: number };
    const rows =
      b.ids && b.ids.length > 0
        ? CORPUS.filter((p) => b.ids!.includes(p.id))
        : CORPUS.slice(0, b.limit ?? 10);
    if (rows.length === 0) return null;
    return { data: { rows }, citation: sourceCitation(rows[0]) };
  }),
);

// §5: /query — structured filter (retrieval-backed when `contains` is present)
app.post("/query", (c) =>
  handleTier(c, "query", (body) => {
    const b = body as { year_gte?: number; contains?: string };
    let rows = CORPUS;
    if (b.year_gte) rows = rows.filter((p) => p.year >= b.year_gte!);
    if (b.contains) {
      const q = b.contains.toLowerCase();
      rows = rows.filter(
        (p) => p.title.toLowerCase().includes(q) || p.abstract.toLowerCase().includes(q),
      );
    }
    if (rows.length === 0) return null;
    // §3.2: emit retrieval provenance only when a retrieval actually happened
    // (i.e. a `contains` substring match). Year-only filters are structured,
    // not retrieval, so we omit it per "providers that do not do retrieval
    // SHOULD omit both fields."
    const retrieved = Boolean(b.contains);
    const citation = retrieved
      ? sourceCitation(rows[0], {
          retrieval: { model: INDEX_MODEL, score: substringScore(rows[0], b.contains!), rank: 0 },
        })
      : sourceCitation(rows[0]);
    return { data: { rows }, citation };
  }),
);

// §5: /insight — NL summary + top-k (reference sparse retrieval)
app.post("/insight", (c) =>
  handleTier(c, "insight", (body) => {
    const b = body as { question?: string };
    if (!b.question) return null;
    const q = b.question.toLowerCase();
    // Rank the whole corpus by substring score; fall back to CORPUS[0] if nothing hits.
    const ranked = CORPUS
      .map((p) => ({ p, score: substringScore(p, q) }))
      .sort((a, b2) => b2.score - a.score);
    const top = ranked[0]?.score > 0 ? ranked[0].p : CORPUS[0];
    const topScore = ranked[0]?.score ?? 0;
    const summary = `Based on ${top.title} (${top.year}): ${top.abstract.slice(0, 120)}...`;
    return {
      data: { summary, top_source: top.id },
      citation: sourceCitation(top, {
        retrieval: { model: INDEX_MODEL, score: topScore, rank: 0 },
      }),
    };
  }),
);

app.notFound((c) =>
  c.json<ErrorBody>(
    { error: { code: "not_found", message: "unknown route" }, trace_id: traceId() },
    404,
  ),
);

// ---------- Entrypoint ----------

const port = Number(process.env.PORT ?? 8787);

// Node serve — keep this block tiny so the module is also importable for tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { serve } = await import("@hono/node-server").catch(() => ({
    serve: (opts: { fetch: typeof app.fetch; port: number }) => {
      // Fallback when @hono/node-server isn't installed yet.
      // Demo still works by invoking via `tsx server.ts` + Node's fetch.
      console.error(
        "[feed402] @hono/node-server not installed; add it to package.json and `npm i` to run.",
      );
      console.error(`[feed402] Would have served on port ${opts.port}`);
      return null;
    },
  }));
  serve({ fetch: app.fetch, port });
  console.log(`[feed402] reference provider listening on :${port}`);
  console.log(`[feed402] manifest: http://localhost:${port}/.well-known/feed402.json`);
}

export { app };
