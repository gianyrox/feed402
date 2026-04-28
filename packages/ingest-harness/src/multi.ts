// Multi-dataset host: one Node process, many feed402 providers, routed by
// either Host header (provider.feed402.dev → "provider") or path prefix
// (/p/<provider>/* → "provider"). The path prefix is for local dev / curl
// testing; the Host route is the production path behind a wildcard cert.
//
// All providers share the same `/health/global` overview, while each provider
// keeps its own `/raw`, `/query`, `/insight`, and `/.well-known/feed402.json`.
//
// Datasets are loaded from `--datasets-root <dir>` at boot. Any subdirectory
// containing a `manifest.yaml` becomes a provider whose name is the YAML's
// `name` field.
import { Hono } from "hono";
import { readdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { loadManifest } from "./manifest.js";
import { readCsv } from "./csv.js";
import { Bm25 } from "./insight.js";
import { buildServer } from "./server.js";
import { paymentModeFromEnv } from "./x402.js";

interface ProviderApp {
  name: string;
  host?: string;       // optional explicit host pattern, e.g. "pharma-fda.feed402.dev"
  app: ReturnType<typeof buildServer>;
  rows: number;
  chunks: number;
  manifestUrl: string;
}

export interface MultiOpts {
  datasetsRoot: string;
  enforce: boolean;
  hostSuffix?: string;  // e.g. "feed402.dev" → "<name>.feed402.dev"
}

export async function loadAllProviders(opts: MultiOpts): Promise<ProviderApp[]> {
  const root = opts.datasetsRoot;
  if (!existsSync(root)) throw new Error(`datasets root not found: ${root}`);
  const out: ProviderApp[] = [];
  for (const entry of readdirSync(root)) {
    if (entry.startsWith("_")) continue;
    const dir = join(root, entry);
    if (!statSync(dir).isDirectory()) continue;
    const manifestPath = join(dir, "manifest.yaml");
    const csvPath = join(dir, "data.csv");
    if (!existsSync(manifestPath) || !existsSync(csvPath)) continue;
    const manifest = loadManifest(manifestPath);
    const rows = await readCsv(csvPath);
    const chunksPath = join(dir, "chunks.jsonl");
    const bm25 = Bm25.fromJsonl(chunksPath);
    const payment = paymentModeFromEnv(opts.enforce, manifest.chain);
    const app = buildServer({
      dataset: { provider: manifest.name, defaultLicense: manifest.citation_policy, rows, chunks: [], manifest },
      bm25, payment,
    });
    out.push({
      name: manifest.name,
      host: opts.hostSuffix ? `${manifest.name}.${opts.hostSuffix}` : undefined,
      app, rows: rows.length, chunks: bm25.size,
      manifestUrl: `/.well-known/feed402.json`,
    });
  }
  return out;
}

export function buildMultiHost(providers: ProviderApp[], opts: MultiOpts) {
  const byHost = new Map<string, ProviderApp>();
  const byName = new Map<string, ProviderApp>();
  for (const p of providers) {
    byName.set(p.name, p);
    if (p.host) byHost.set(p.host, p);
  }

  const top = new Hono();

  // Permissive CORS at the multi level too (passes through to children but
  // also covers the global routes).
  top.use("*", async (c, next) => {
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Headers", "x-payment, content-type");
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Expose-Headers", "www-authenticate");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });

  // Global root: index of every provider on this host.
  top.get("/", (c) => c.json({
    spec: "feed402/0.2",
    providers: providers.map(p => ({
      name: p.name, host: p.host, rows: p.rows, chunks: p.chunks,
      manifest: p.host ? `https://${p.host}/.well-known/feed402.json` : `/p/${p.name}/.well-known/feed402.json`,
    })),
    host_suffix: opts.hostSuffix ?? null,
  }));
  top.get("/health/global", (c) => c.json({
    ok: true, providers: providers.length,
    rows_total: providers.reduce((s, p) => s + p.rows, 0),
    chunks_total: providers.reduce((s, p) => s + p.chunks, 0),
  }));

  // Path-prefix routing for local dev: /p/<name>/<rest>
  top.all("/p/:name/*", async (c) => {
    const name = c.req.param("name");
    const provider = byName.get(name);
    if (!provider) return c.json({ error: "no_such_provider", name }, 404);
    return rewriteAndDispatch(c, provider, `/p/${name}`);
  });
  top.all("/p/:name", async (c) => {
    const name = c.req.param("name");
    const provider = byName.get(name);
    if (!provider) return c.json({ error: "no_such_provider", name }, 404);
    return rewriteAndDispatch(c, provider, `/p/${name}`);
  });

  // Host routing: <name>.<suffix>/...
  top.all("*", async (c) => {
    const host = c.req.header("host") || "";
    const provider = byHost.get(host);
    if (!provider) return c.json({ error: "no_route", host, hint: "use /p/<provider>/... or set Host: <provider>.<suffix>" }, 404);
    return rewriteAndDispatch(c, provider, "");
  });

  return top;
}

async function rewriteAndDispatch(c: any, provider: ProviderApp, prefix: string) {
  // Strip prefix from path before forwarding to the provider's Hono app.
  const url = new URL(c.req.url);
  const newPath = (url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname) || "/";
  url.pathname = newPath;
  const req = new Request(url.toString(), {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.raw.clone().arrayBuffer(),
  });
  return provider.app.fetch(req);
}
