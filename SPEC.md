# feed402 — protocol sketch v0.0.1

One page. Built on x402 unchanged. Everything below is the delta a data
provider needs to implement on top of a standard x402 server.

---

## 1. Discovery

Every feed402 provider serves a static manifest at a fixed path:

```
GET https://<provider>/.well-known/feed402.json
```

```json
{
  "name": "example-pubmed-mirror",
  "version": "0.0.1",
  "chain": "base",
  "wallet": "0xabc...",
  "tiers": {
    "raw":     { "path": "/raw",     "price_usd": 0.05, "unit": "row" },
    "query":   { "path": "/query",   "price_usd": 0.01, "unit": "call" },
    "insight": { "path": "/insight", "price_usd": 0.002, "unit": "call" }
  },
  "schema_url": "https://<provider>/schema.json",
  "citation_policy": "CC-BY-4.0",
  "contact": "ops@example.com"
}
```

Agents crawl this once per provider, cache it, and pick the tier that fits
the budget they were given.

## 2. Handshake (stock x402, no changes)

```
POST /query                 → 402 Payment Required
                              x402 challenge header
POST /query + x402 payload  → 200 OK + envelope
```

Settlement is whatever Viatika's wallet signer does today. This spec does
not touch it.

## 3. Response envelope

Every paid response — raw, query, or insight — returns the same shape:

```json
{
  "data": <tier-specific payload>,
  "citation": {
    "source_id": "pubmed:12345678",
    "provider": "example-pubmed-mirror",
    "retrieved_at": "2026-04-15T10:30:00Z",
    "license": "CC-BY-4.0",
    "canonical_url": "https://pubmed.ncbi.nlm.nih.gov/12345678"
  },
  "receipt": {
    "tier": "query",
    "price_usd": 0.01,
    "tx": "0x...",
    "paid_at": "2026-04-15T10:30:01Z"
  }
}
```

The `citation` block is **mandatory**. No citation, not feed402.
This is the one thing Viatika's middleware can't retrofit — it has to
live inside the response envelope.

### 3.1 Citation types (extension point)

The citation block has an optional `type` field. Default is `source` (a
standard literature/record reference, shape shown above). Providers may
emit other types; agents that don't recognize a type SHOULD treat it as
`source` and use whatever fields they can.

One type is defined in v0.0.1 beyond `source`:

**`vds` — Verified Data Session.** A wallet-signed bundle produced by
running a prescribed capture script on a mobile device (phone, tablet,
wearable). Each script defines a sequence of sensor-backed steps plus
cross-step consistency rules; a verifier adjudicates and attaches a
confidence-scored finding set. Output is structured JSON designed for
agent consumption — not human display. Reference implementation:
DerbyFish's `BHRV` (Bump, Hero, Release, Validate) catch-verification
pipeline, shipping as `derbyfish.bhrv.v2`.

```json
"citation": {
  "type": "vds",
  "script_id": "derbyfish.bhrv.v2",
  "session_id": "sess_01JBX...",
  "captured_by": "0xwallet...",
  "captured_at": "2026-04-15T14:22:11Z",
  "verifier": "derbyfish-gaia-fishdection@0.6.3",
  "verification": {
    "status": "PASS",
    "confidence": 0.94,
    "findings": [
      { "kind": "species",    "value": "Morone saxatilis", "confidence": 0.98 },
      { "kind": "length_cm",  "value": 61.3,              "confidence": 0.95 }
    ]
  },
  "onchain": "flow-mainnet:FishCardV1#12891",
  "signature": "0xwallet..."
}
```

The full step array, sensor hashes, and consistency-rule results live at
`GET /vds/sessions/:session_id` on the provider (itself a feed402 endpoint).
The citation block carries only the summary an agent needs to trust and
re-cite the finding; fetching the full envelope is a separate, metered
call. This keeps `insight`-tier responses small while leaving the full
evidence chain one hop away.

Future citation types (deferred to v0.2+): `attestation` (third-party
signed claim), `measurement` (calibrated instrument reading), `observation`
(timestamped human-entered field note). All live under the same extension
rule — new `type` values are additive, never breaking.

## 4. Query tiers

| Tier | Input | Output | Price signal |
|---|---|---|---|
| `raw` | `{"ids": [...]}` or `{"limit": N}` | bulk rows | highest (pay per row) |
| `query` | `{"sql": "..."}` or structured filter | matched rows | medium (pay per call) |
| `insight` | `{"question": "..."}` | NL summary + top-k citations | lowest (pay per call) |

Providers may implement 1, 2, or all 3. The `.well-known` manifest declares
which. Agents pick the cheapest tier that answers their question.

## 5. Errors

All non-2xx responses carry `{"error": {...}, "trace_id": "..."}`.
A 402 is not an error — it's the handshake.

## 6. What's out of scope for v0.0.1

- Multi-provider federation / registry
- Streaming responses (WebSocket / SSE)
- Refunds, disputes, credit
- Caching/proxy layer
- Rate limiting semantics

All deferred to v0.1+. Covered by future amendments to this spec.

---

**That's the whole protocol.** One manifest, stock x402 handshake, one
envelope shape, three query tiers. Anything more is v0.2.
