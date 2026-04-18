# feed402 — protocol v0.1

**Author:** Gianangelo Dichio · **License:** CC0 · **Status:** Draft

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
  "version": "0.1.0",
  "spec": "feed402/0.1",
  "chain": "base",
  "wallet": "0xabc...",
  "tiers": {
    "raw":     { "path": "/raw",     "price_usd": 0.05,  "unit": "row" },
    "query":   { "path": "/query",   "price_usd": 0.01,  "unit": "call" },
    "insight": { "path": "/insight", "price_usd": 0.002, "unit": "call" }
  },
  "schema_url": "https://<provider>/schema.json",
  "citation_policy": "CC-BY-4.0",
  "citation_types": ["source", "vds"],
  "contact": "ops@example.com"
}
```

Agents crawl this once per provider, cache it, and pick the tier that fits
the budget they were given. `spec` identifies the protocol version;
`citation_types` advertises which envelope subtypes the provider emits.

## 2. Handshake (stock x402, no changes)

```
POST /query                 → 402 Payment Required
                              x402 challenge header
POST /query + x402 payload  → 200 OK + envelope
```

Settlement is whatever the x402 wallet signer does today. This spec does not
touch it.

## 3. Response envelope

Every paid response — raw, query, or insight — returns the same shape:

```json
{
  "data": <tier-specific payload>,
  "citation": {
    "type": "source",
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

The `citation` block is **mandatory**. No citation, not feed402. This is the
one thing raw x402 middleware does not enforce — it must live inside the
response envelope.

### 3.1 Citation types (extension point)

The citation block has a `type` field. The default type is `source` — a
standard literature or record reference, shape shown above. Providers MAY
emit other types; agents that do not recognize a type SHOULD treat it as
`source` and use whatever fields they can parse.

New `type` values are **additive, never breaking**. A v0.1 agent seeing a
v0.2 citation type is required to degrade gracefully, not error.

One non-default type is defined in v0.1:

**`vds` — Verified Data Session.** A wallet-signed bundle produced by running
a prescribed capture script on a mobile device (phone, tablet, wearable).
Each script defines a sequence of sensor-backed steps plus cross-step
consistency rules; a verifier adjudicates and attaches a confidence-scored
finding set. Output is structured JSON designed for agent consumption.
Reference implementation: DerbyFish `BHRV` (Bump, Hero, Release, Validate)
catch-verification pipeline, shipping as `derbyfish.bhrv.v2`.

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
      { "kind": "species",   "value": "Morone saxatilis", "confidence": 0.98 },
      { "kind": "length_cm", "value": 61.3,               "confidence": 0.95 }
    ]
  },
  "onchain": "flow-mainnet:FishCardV1#12891",
  "signature": "0xwallet..."
}
```

The full step array, sensor hashes, and consistency-rule results live at
`GET /vds/sessions/:session_id` on the provider (itself a feed402 endpoint).
The citation block carries only the summary an agent needs to trust and
re-cite the finding; fetching the full envelope is a separate, metered call.
This keeps `insight`-tier responses small while leaving the full evidence
chain one hop away.

Future citation types (deferred to v0.2+): `attestation` (third-party signed
claim), `measurement` (calibrated instrument reading), `observation`
(timestamped human-entered field note). All follow the same extension
rule — additive, never breaking.

## 4. Query tiers

| Tier | Input | Output | Price signal |
|---|---|---|---|
| `raw` | `{"ids": [...]}` or `{"limit": N}` | bulk rows | highest (pay per row) |
| `query` | `{"sql": "..."}` or structured filter | matched rows | medium (pay per call) |
| `insight` | `{"question": "..."}` | NL summary + top-k citations | lowest (pay per call) |

Providers may implement 1, 2, or all 3. The `.well-known` manifest declares
which. Agents pick the cheapest tier that answers their question.

All three tiers MUST return the envelope shape from §3. The `data` payload
differs by tier; the `citation` and `receipt` blocks are identical in shape.

## 5. Errors

All non-2xx responses carry `{"error": {"code": "...", "message": "..."}, "trace_id": "..."}`.
A 402 is not an error — it is the handshake.

Reserved error codes in v0.1: `invalid_tier`, `invalid_input`,
`upstream_unavailable`, `rate_limited`, `citation_unavailable`.

## 6. What's out of scope for v0.1

- Multi-provider federation / registry
- Streaming responses (WebSocket / SSE)
- Refunds, disputes, credit
- Caching / proxy layer semantics
- Rate limiting semantics
- Signature verification of the citation block itself (VDS uses wallet sig;
  `source` does not. v0.2 may introduce a provider signature.)

All deferred to v0.2+. Covered by future amendments to this spec.

---

**That's the whole protocol.** One manifest, stock x402 handshake, one
envelope shape, three query tiers, additive citation-type extension.
Anything more is v0.2.
