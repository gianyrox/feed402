// Stock x402 challenge generation. Real settlement verification is
// delegated to the x402-research-gateway middleware in production; the
// harness only emits the challenge and accepts a payload it does not
// itself validate when run with --no-payment (dev mode).
import type { Context } from "hono";
import type { Manifest, Tier } from "./types.js";

export interface PaymentMode {
  enforce: boolean;     // true = require x402 header; false = dev bypass
  network: string;      // "base" | "base-sepolia"
}

export function challenge(c: Context, manifest: Manifest, tier: Tier) {
  const t = manifest.tiers[tier];
  c.header("WWW-Authenticate",
    `x402 chain="${manifest.chain}", wallet="${manifest.wallet}", price_usd="${t.price_usd}", unit="${t.unit}", path="${t.path}"`);
  return c.json({
    error: "payment_required",
    chain: manifest.chain,
    wallet: manifest.wallet,
    tier,
    price_usd: t.price_usd,
    unit: t.unit,
    spec: manifest.spec,
  }, 402);
}

export function checkPayment(c: Context, mode: PaymentMode): { paid: boolean; tx?: string } {
  if (!mode.enforce) return { paid: true, tx: "0xdev-bypass" };
  const h = c.req.header("x-payment") || c.req.header("X-PAYMENT");
  if (!h) return { paid: false };
  // Real verification calls into x402-research-gateway. For v0 we accept any
  // non-empty signed bundle and pass the tx-id through to the receipt.
  // TODO(bkt-sno): wire gateway verification.
  try {
    const obj = JSON.parse(Buffer.from(h, "base64").toString());
    if (obj && typeof obj.tx === "string") return { paid: true, tx: obj.tx };
  } catch {/* fallthrough */}
  return { paid: false };
}
