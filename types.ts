/**
 * feed402 v0.1 — shared types
 * These mirror SPEC.md §1 (manifest) and §3 (envelope).
 * Keep this file in sync with the spec; it is intentionally small.
 */

// ---------- §1: Discovery manifest ----------

export type TierName = "raw" | "query" | "insight";

export interface TierSpec {
  path: string;
  price_usd: number;
  unit: "row" | "call";
}

export interface Manifest {
  name: string;
  version: string;
  /** Protocol version, e.g. "feed402/0.1". */
  spec: string;
  chain: "base" | "base-sepolia" | string;
  wallet: `0x${string}`;
  tiers: Partial<Record<TierName, TierSpec>>;
  schema_url?: string;
  citation_policy?: string;
  citation_types: CitationType[];
  contact?: string;
}

// ---------- §3: Response envelope ----------

export type CitationType = "source" | "vds" | string;

export interface CitationSource {
  type: "source";
  source_id: string;
  provider: string;
  retrieved_at: string; // ISO-8601
  license?: string;
  canonical_url?: string;
}

export interface CitationVDS {
  type: "vds";
  script_id: string;
  session_id: string;
  captured_by: `0x${string}`;
  captured_at: string; // ISO-8601
  verifier: string;
  verification: {
    status: "PASS" | "FAIL" | "INCONCLUSIVE";
    confidence: number;
    findings: Array<{
      kind: string;
      value: string | number;
      confidence: number;
    }>;
  };
  onchain?: string;
  signature: `0x${string}`;
}

export type Citation = CitationSource | CitationVDS;

export interface Receipt {
  tier: TierName;
  price_usd: number;
  /** Transaction hash, or "stub" in demo mode. */
  tx: string;
  paid_at: string; // ISO-8601
}

export interface Envelope<D = unknown> {
  data: D;
  citation: Citation;
  receipt: Receipt;
}

// ---------- §5: Errors ----------

export type ErrorCode =
  | "invalid_tier"
  | "invalid_input"
  | "upstream_unavailable"
  | "rate_limited"
  | "citation_unavailable";

export interface ErrorBody {
  error: { code: ErrorCode | string; message: string };
  trace_id: string;
}
