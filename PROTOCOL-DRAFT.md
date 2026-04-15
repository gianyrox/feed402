# PROTOCOL-DRAFT.md — v0.0.0 sketch

> Pre-PRIOR-ART version. Do not cite. Do not implement against this yet.
> Point of this document is to have *something concrete enough to argue
> about* when Lanzafame reviews. The real v0.0.1 spec gets written after
> prior art review.

**Status:** working draft, 2026-04-15
**Audience:** Lanzafame, Gian, eventual protocol reviewers
**License intent:** CC0 when promoted to `PROTOCOL.md`

---

## Goals of this draft

1. Define the **minimum wire protocol** for an AI agent to discover,
   pay for, and query a data feed over x402.
2. Define the **minimum response envelope** so that every response
   carries enough provenance to be cited later without re-fetching.
3. Define the **three query tiers** — raw, query, insight — so that
   providers can price differently for bulk data vs. structured
   queries vs. natural-language insights over their own index.
4. Do nothing else. Keep it small.

## Non-goals of this draft

- On-chain registry (v0.2+)
- Cross-chain wallet support (v0.2+)
- Multi-provider federation (v0.2+)
- Streaming / long-lived connections (v0.2+ — v0.1 is request/response)
- Reputation / rating systems (out of scope forever, not our problem)

---

## Actors

- **Provider.** Runs an HTTP server that exposes one or more *feeds*.
  Each feed is a paid data source. Provider is compensated in USDC on
  Base via x402.
- **Agent.** An AI agent (or human with a wallet) that wants data. Has
  a Base-chain wallet capable of signing x402 payment messages.
- **Registry.** Optional, off-chain in v0.1. A simple JSON file or
  HTTP endpoint listing known feeds. In v0.1 a registry is just a URL
  that returns `{"feeds": [{"url": "...", "description": "..."}]}`.
  No consensus, no crypto, no trust — just a phonebook.
- **Policy plugin.** Optional provider-side middleware that approves,
  denies, meters, or rate-limits requests. Viatika is the reference
  implementation.

## Wire protocol

### 1. Discovery

```
GET https://provider.example.com/.well-known/feed402.json
```

Returns the **feed manifest**:

```json
{
  "protocol": "feed402/0.0.0",
  "provider": {
    "name": "Example Data Co.",
    "url": "https://provider.example.com",
    "contact": "ops@provider.example.com",
    "wallet": "0xAbC...123"
  },
  "feeds": [
    {
      "id": "weather-us-hourly",
      "title": "US Hourly Weather — 2010–present",
      "description": "Station-level hourly weather data for the US.",
      "license": "CC-BY-4.0",
      "endpoints": {
        "raw":     "/feeds/weather-us-hourly/raw",
        "query":   "/feeds/weather-us-hourly/query",
        "insight": "/feeds/weather-us-hourly/insight"
      },
      "pricing": {
        "raw":     { "unit": "1000 rows",  "price_usdc": "0.01" },
        "query":   { "unit": "query",       "price_usdc": "0.005" },
        "insight": { "unit": "query",       "price_usdc": "0.02" }
      },
      "schema_url": "/feeds/weather-us-hourly/schema.json",
      "index_info": {
        "fts": true,
        "vector": true,
        "embedding_model": "text-embedding-3-small",
        "last_indexed": "2026-04-15T00:00:00Z"
      }
    }
  ]
}
```

Key rules:
- The `.well-known/feed402.json` path is the discovery convention. A
  single provider can host many feeds, all listed in one manifest.
- `protocol` field is mandatory and versioned. Clients MUST refuse to
  proceed if they don't understand the major version.
- `pricing` is always in USDC on Base for v0.1. Other currencies and
  chains are future extensions.
- `license` is a SPDX identifier where possible, or a free-text URL.
  Clients MUST surface this to the eventual consumer of the data.

### 2. Paywall handshake (x402)

Standard x402. An unauthenticated request gets a 402:

```
POST /feeds/weather-us-hourly/query HTTP/1.1
Host: provider.example.com
Content-Type: application/json

{"sql": "SELECT * FROM weather WHERE station = 'KJFK' LIMIT 10"}
```

```
HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Feed402-Version: 0.0.0

{
  "protocol": "feed402/0.0.0",
  "payment_required": {
    "amount_usdc": "0.005",
    "recipient": "0xAbC...123",
    "chain": "base",
    "expires_at": "2026-04-15T12:35:00Z",
    "nonce": "f7c2...891",
    "x402": {
      "scheme": "exact",
      "network": "base-mainnet",
      "payTo": "0xAbC...123",
      "maxAmountRequired": "5000",
      "maxTimeoutSeconds": 120,
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "description": "feed402 query on weather-us-hourly"
    }
  },
  "response_estimate": {
    "rows": 10,
    "bytes": 2400
  }
}
```

Agent signs a payment authorization (EIP-3009 or equivalent; aligns
with x402 reference) and retries:

```
POST /feeds/weather-us-hourly/query HTTP/1.1
Host: provider.example.com
Content-Type: application/json
X-Payment: <base64-encoded x402 payment payload>

{"sql": "SELECT * FROM weather WHERE station = 'KJFK' LIMIT 10"}
```

Provider verifies payment (on-chain or via Viatika settlement bridge),
processes query, returns response with receipt header:

```
HTTP/1.1 200 OK
Content-Type: application/json
X-Payment-Receipt: <base64-encoded x402 settlement receipt>

{
  "protocol": "feed402/0.0.0",
  "request_id": "9c3e...",
  "served_at": "2026-04-15T12:34:17Z",
  "license": "CC-BY-4.0",
  "citation": {
    "provider": "Example Data Co.",
    "feed": "weather-us-hourly",
    "version": "2026.04.15",
    "doi": null,
    "hash": "sha256:abc123..."
  },
  "payload": { ... the actual data ... },
  "usage": {
    "charged_usdc": "0.005",
    "rows_returned": 10,
    "index_used": null
  }
}
```

### 3. The three query tiers

The single most important design decision in this draft. Providers
price differently because agents want different shapes of
interaction.

#### Tier 1: `raw`

Bulk access to the underlying data, paginated. Price by rows or
bytes. No index involvement, no query parsing — just "give me your
data starting at cursor X."

```
POST /feeds/<id>/raw
{
  "cursor": null,
  "limit": 1000
}
```

Use case: training set assembly, archival mirroring, data backup. A
research lab that wants to download all of PubChem once and cite it
forever lives in this tier.

#### Tier 2: `query`

Structured query against a provider-defined schema. Price by query.
Provider advertises a schema at `/feeds/<id>/schema.json` and accepts
queries in a well-known structured form — SQL-ish or a JSON query
DSL (TBD in v0.0.1).

```
POST /feeds/<id>/query
{
  "sql": "SELECT temperature, humidity FROM weather WHERE station='KJFK' AND ts >= '2026-04-01'"
}
```

Use case: "I need a slice of this dataset matching a condition."
Classic analytical access.

#### Tier 3: `insight`

Natural-language query against a provider-maintained index. The
provider has indexed their data with an embedding model + FTS; the
agent sends a NL question; the provider returns ranked chunks,
embeddings, and citations. The index is the value-add — this is where
providers charge most.

```
POST /feeds/<id>/insight
{
  "question": "How did JFK airport weather patterns change after 2020?",
  "top_k": 5,
  "return_embeddings": false
}
```

Returns:

```json
{
  "protocol": "feed402/0.0.0",
  "payload": {
    "chunks": [
      {
        "text": "...",
        "source_row_ids": ["w-2020-03-15-kjfk", "..."],
        "score": 0.87,
        "citation": { ... as above ... }
      }
    ],
    "summary": "JFK weather showed ... [optional, provider-generated]",
    "index_used": {
      "name": "weather-us-hourly-v1",
      "model": "text-embedding-3-small",
      "built_at": "2026-04-15T00:00:00Z"
    }
  }
}
```

Use case: RAG-style agent that wants "an answer with citations,"
not raw data. This is where most AI agent traffic will actually
live, and therefore where most of Viatika's revenue upside is.

## Provenance & citation

Every response MUST include a `citation` object with at minimum:

- `provider` — the entity being paid
- `feed` — the feed ID
- `version` — the feed version at time of query (lets clients cite
  a specific snapshot)
- `hash` — sha256 of the response payload (lets clients verify the
  data wasn't tampered with downstream)
- `doi` — optional, if the provider is in a formal citation ecosystem

This is the part that makes the data *worth paying for*. Without
citation, an agent can't cite its sources, and without citable
sources the agent's output is untrustworthy. The citation object
is what turns "bytes you paid for" into "an insight you can stake
your name on."

## Versioning

- Protocol version: `feed402/MAJOR.MINOR.PATCH` (semver)
- Feed version: provider-defined, but MUST be monotonic and MUST
  appear in every response's `citation.version` field
- Schema version: separate from feed version; schemas evolve
  independently, linked from the feed manifest via `schema_url`

Clients MUST refuse to proceed on a major version mismatch.

## License

Every response carries a `license` string. This is normative and
enforced at the client SDK level — the SDK WILL reject a response
with a missing or malformed license, and WILL surface the license to
the downstream consumer. No quietly-laundering-proprietary-data use
case is supported.

## What's deliberately missing from v0.0.0

- **Streaming.** v0.1 is request/response. Streaming comes later.
- **Federation.** No cross-provider joins, no multi-provider queries,
  no universal registry.
- **Reputation.** No ratings, no provider reputation system. If a
  provider serves bad data, agents can stop querying. That's the
  only signal we need.
- **Refunds / disputes.** v0.1 is final-sale. Dispute resolution is
  a Viatika-layer problem, not a protocol-layer problem.
- **Rate limiting semantics.** Protocol-level, rate limiting is
  just 429 with a Retry-After. Providers implement whatever policy
  they want.
- **Caching semantics.** Standard HTTP Cache-Control headers. The
  protocol has an opinion: responses are cacheable by the agent
  for as long as the response says, and the cached response
  remains citable (that's the whole point of the citation object).

## Open questions for v0.0.1

1. Is the query DSL SQL, JSON, or GraphQL? **Bias: SQL subset** — it's
   universal, already-understood, and agents can generate it.
2. How does the agent prove to a third party that it paid? The x402
   payment receipt header is the answer, but we need to define how
   it's preserved + verified downstream. Needs thought.
3. Should `insight` responses include token counts (input/output)
   for pricing transparency? Probably yes, as an optional field.
4. How do we handle providers who want to charge differently per
   query complexity? v0.0.0 says flat price per query; v0.0.1 may
   need variable pricing with a pre-flight cost estimate.
5. Do we want a discovery-free mode where agents just hit a known
   URL directly without reading a manifest? Yes for testing, no for
   production. Clients should warn when operating without discovery.

---

## Appendix A — minimum-viable test vector

A provider running this protocol should be able to pass this script:

```bash
# 1. Discover
curl https://provider.example.com/.well-known/feed402.json

# 2. Hit the feed without payment → 402
curl -X POST https://provider.example.com/feeds/test/query \
     -d '{"sql":"SELECT 1"}'
# → HTTP 402 with payment_required block

# 3. Pay + retry → 200
curl -X POST https://provider.example.com/feeds/test/query \
     -H "X-Payment: $PAYMENT_PAYLOAD" \
     -d '{"sql":"SELECT 1"}'
# → HTTP 200 with payload + citation + receipt

# 4. Verify citation is present and schema-valid
curl -X POST ... | jq '.citation' | <schema-validator>
```

If this test vector passes, a provider is feed402-compliant.

---

## Appendix B — relationship to x402

We are not re-specifying x402. We are building a **data-layer
convention** on top of x402's payment layer. Everything below the
"payment_required" block in a 402 response is pure x402 as defined
upstream. Everything above it — discovery, query tiers, response
envelope, citation, license — is feed402.

If x402 changes, feed402 should track it within one minor version.

## Appendix C — relationship to Bucket Foundation's PROTOCOL.md

Bucket's protocol is a special case of this one, restricted to the
foundations-canon vertical. A Bucket provider is a feed402 provider
where:

- `feeds[].id` is a canon branch (e.g. `bucket-canon-05-biophysics`)
- `license` is always an open license (MIT, CC-BY, CC0)
- The `citation` object includes a Story Protocol IP NFT tokenId
- The `insight` tier is the primary mode; `raw` is for archival
  mirroring only

Bucket can implement feed402 as-is with zero modifications. The
cross-citation in both specs is mandatory, not optional.
