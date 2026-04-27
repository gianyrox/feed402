// Query filter compiler: bbox + time range + arbitrary equality filters.
import type { Row } from "./types.js";

export interface QueryParams {
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  from?: string;          // ISO-8601 or year string
  to?: string;
  filters?: Record<string, string>;
  limit?: number;
  offset?: number;
  order_by?: string;
  order?: "asc" | "desc";
}

export function parseQuery(qs: URLSearchParams): QueryParams {
  const out: QueryParams = {};
  const bbox = qs.get("bbox");
  if (bbox) {
    const p = bbox.split(",").map(Number);
    if (p.length === 4 && p.every(n => Number.isFinite(n))) {
      out.bbox = [p[0], p[1], p[2], p[3]];
    }
  }
  const from = qs.get("from"); if (from) out.from = from;
  const to = qs.get("to");     if (to) out.to = to;
  const limit = qs.get("limit"); if (limit) out.limit = Math.min(1000, Math.max(1, +limit));
  const offset = qs.get("offset"); if (offset) out.offset = Math.max(0, +offset);
  const ob = qs.get("order_by"); if (ob) out.order_by = ob;
  const od = qs.get("order"); if (od === "asc" || od === "desc") out.order = od;
  // any param prefixed `f.` becomes an equality filter
  const filters: Record<string, string> = {};
  for (const [k, v] of qs.entries()) {
    if (k.startsWith("f.")) filters[k.slice(2)] = v;
  }
  if (Object.keys(filters).length) out.filters = filters;
  return out;
}

function tsToMs(s: string): number {
  // Accept "1500", "1500-01-01", or full ISO. Negative-year unsupported here (BCE).
  if (/^-?\d+$/.test(s)) return Date.parse(`${s.padStart(4, "0")}-01-01T00:00:00Z`);
  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}

export function applyQuery(rows: Row[], q: QueryParams): Row[] {
  let out = rows;
  if (q.bbox) {
    const [minLon, minLat, maxLon, maxLat] = q.bbox;
    out = out.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon)
      && r.lon >= minLon && r.lon <= maxLon && r.lat >= minLat && r.lat <= maxLat);
  }
  if (q.from) {
    const t0 = tsToMs(q.from);
    if (Number.isFinite(t0)) out = out.filter(r => Date.parse(r.timestamp) >= t0);
  }
  if (q.to) {
    const t1 = tsToMs(q.to);
    if (Number.isFinite(t1)) out = out.filter(r => Date.parse(r.timestamp) <= t1);
  }
  if (q.filters) {
    out = out.filter(r => Object.entries(q.filters!).every(([k, v]) => String(r[k] ?? "") === v));
  }
  if (q.order_by) {
    const k = q.order_by;
    const dir = q.order === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      const av = a[k] as any, bv = b[k] as any;
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * dir;
    });
  }
  const off = q.offset ?? 0;
  const lim = q.limit ?? 100;
  return out.slice(off, off + lim);
}
