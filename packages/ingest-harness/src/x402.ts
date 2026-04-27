// x402 challenge + settlement.
//
// Production verification path delegates to a "facilitator" — a service that
// validates the signed x402 payment payload against the chain and returns
// {ok, tx_hash, payer}. This is the same shape used by x402-research-gateway
// and Coinbase's reference x402 facilitator. We support three modes:
//
//   - "off"     dev mode — skip 402 challenge, fabricate a tx string. Use --no-payment.
//   - "stub"    accept any base64 JSON body with a `tx` field (legacy). Default if no
//               FEED402_FACILITATOR_URL env var is set.
//   - "remote"  POST the raw X-PAYMENT header to FEED402_FACILITATOR_URL/verify, expect
//               { ok: bool, tx_hash?: string, payer?: string, error?: string }.
//
// The facilitator URL can point at any compliant verifier — the x402-research-gateway
// exposes one at /x402/verify. This keeps the harness chain-agnostic (Base, Base
// Sepolia, anything the facilitator supports) while still being a one-line
// production wire-up: `export FEED402_FACILITATOR_URL=https://gateway/x402`.
import type { Context } from "hono";
import type { Manifest, Tier } from "./types.js";

export type PaymentVerifier = "off" | "stub" | "remote";

export interface PaymentMode {
  enforce: boolean;
  network: string;
  verifier: PaymentVerifier;
  facilitatorUrl?: string;
}

export function paymentModeFromEnv(enforce: boolean, network: string): PaymentMode {
  if (!enforce) return { enforce: false, network, verifier: "off" };
  const url = process.env.FEED402_FACILITATOR_URL;
  if (url) return { enforce: true, network, verifier: "remote", facilitatorUrl: url };
  return { enforce: true, network, verifier: "stub" };
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
    facilitator_hint: process.env.FEED402_FACILITATOR_URL || null,
  }, 402);
}

export interface VerifyResult { paid: boolean; tx?: string; payer?: string; error?: string; }

export async function checkPayment(c: Context, mode: PaymentMode): Promise<VerifyResult> {
  if (!mode.enforce) return { paid: true, tx: "0xdev-bypass" };
  const h = c.req.header("x-payment") || c.req.header("X-PAYMENT");
  if (!h) return { paid: false, error: "missing X-PAYMENT" };

  if (mode.verifier === "stub") {
    try {
      const obj = JSON.parse(Buffer.from(h, "base64").toString());
      if (obj && typeof obj.tx === "string") return { paid: true, tx: obj.tx, payer: obj.payer };
    } catch {/* fallthrough */}
    return { paid: false, error: "stub verifier requires base64 JSON {tx}" };
  }

  // remote
  try {
    const r = await fetch(mode.facilitatorUrl! + "/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment: h,
        chain: mode.network,
        path: c.req.path,
        method: c.req.method,
      }),
    });
    if (!r.ok) return { paid: false, error: `facilitator ${r.status}` };
    const j = await r.json() as { ok: boolean; tx_hash?: string; payer?: string; error?: string };
    if (j.ok) return { paid: true, tx: j.tx_hash, payer: j.payer };
    return { paid: false, error: j.error || "facilitator rejected" };
  } catch (e: any) {
    return { paid: false, error: `facilitator fetch failed: ${e.message}` };
  }
}
