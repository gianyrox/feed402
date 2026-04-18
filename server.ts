/**
 * feed402 v0.1 — reference data provider server
 *
 * Implements SPEC.md §1 (discovery), §2 (handshake), §3 (envelope),
 * §4 (tiers: raw, query, insight), §5 (errors).
 *
 * Payment verification in v0.1 is STUBBED: presence of an `x-payment`
 * header is treated as a valid payment. A production server would plug
 * in the x402 facilitator signature check here (see §2 — unchanged from
 * stock x402).
 *
 * Ship target: <200 LOC, Hono, Node 20+, no database, in-memory index.
 *
 * Run: npm run dev
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type {
  Citation,
  Envelope,
  ErrorBody,
  Manifest,
  Receipt,
  TierName,
  TierSpec,
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

// ---------- Helpers ----------

function traceId(): string {
  return `tr_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function now(): string {
  return new Date().toISOString();
}

function sourceCitation(paper: Paper): Citation {
  return {
    type: "source",
    source_id: paper.id,
    provider: PROVIDER_NAME,
    retrieved_at: now(),
    license: "CC-BY-4.0",
    canonical_url: paper.canonical_url,
  };
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

// §1: Discovery manifest
app.get("/.well-known/feed402.json", (c) => {
  const manifest: Manifest = {
    name: PROVIDER_NAME,
    version: PROVIDER_VERSION,
    spec: "feed402/0.1",
    chain: CHAIN,
    wallet: PROVIDER_WALLET,
    tiers: TIERS,
    citation_policy: "CC-BY-4.0",
    citation_types: ["source"],
    contact: "ops@example.com",
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

// §4: /query — structured filter
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
    return { data: { rows }, citation: sourceCitation(rows[0]) };
  }),
);

// §4: /insight — NL summary + top-k (stub: deterministic pick)
app.post("/insight", (c) =>
  handleTier(c, "insight", (body) => {
    const b = body as { question?: string };
    if (!b.question) return null;
    const q = b.question.toLowerCase();
    const top = CORPUS.find(
      (p) => p.title.toLowerCase().includes(q) || p.abstract.toLowerCase().includes(q),
    ) ?? CORPUS[0];
    const summary = `Based on ${top.title} (${top.year}): ${top.abstract.slice(0, 120)}...`;
    return { data: { summary, top_source: top.id }, citation: sourceCitation(top) };
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
