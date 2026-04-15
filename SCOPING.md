# viatika-x402-data-standard — Scoping Document

> **Working title.** Real name is a decision point (see §Open Decisions).
> Do not bikeshed the name until the scope is locked.

**Engagement:** Viatika (Lanzafame) ↔ Gian
**Rate:** $60/hr (parallel to `~/freelance/viatika-platform`, same rate)
**Status:** New contract, scoping phase
**Kickoff:** 2026-04-15
**Contract file:** `CONTRACT.md` (in this folder)
**Deliverables doc:** below, §Deliverables

---

## The diagnosis (Lanzafame's framing)

Viatika has built a full policy-engine + credit-ledger + x402 wallet + Stripe
bridge for AI/data access. Everything an AI agent needs to *pay* for
data over x402 is built. Everything a data seller needs to *charge* an
AI agent over x402 is built. The middleware is complete.

**And Viatika has no market, because there are no x402 data providers
for AI agents to pay.**

Supply side is empty. Viatika is a payment rail with no merchants. It's
Stripe for a world where nobody has launched a store yet. Viatika's
entire reselling business is blocked on the existence of data providers
who are willing to expose their data via x402 and accept payments from
AI-agent wallets on Base.

> "We need to set a standard for data providers via x402 and ai agents
> with base crypto wallets to access data so viatika has a market."
> — Lanzafame, relayed 2026-04-15

This is a two-sided-marketplace cold-start. The move is well-understood:
**subsidize the side that is missing.** Ship a reference stack that
makes it trivial for any data provider to start accepting x402 payments
from AI agents, open-source it under a permissive license so providers
don't get locked into any single middleware, and let Viatika capture
value as the natural policy/wallet layer in the middle.

## The thesis in one paragraph

If we ship an open-source, MIT-licensed, drop-in reference stack that
(a) lets any data source (Postgres, JSONL, Parquet, S3, a vector DB, an
existing REST API) expose itself as an x402-compatible data provider in
under a day of integration work, (b) ships a reference AI-agent client
SDK that discovers feeds, negotiates payment over x402, pays from a Base
wallet, and consumes queries, and (c) includes a **first-party index
layer** so the data isn't just raw bytes but queryable *insights* —
then every provider built on the stack is a Viatika-shaped customer
(policy, metering, wallet ops), every agent built against the stack is
a Viatika-shaped customer, and Viatika becomes the natural middleware
for a market it previously had to beg to exist.

**This is not Bucket.** Bucket is a nonprofit canon for foundations of
AI+human research (axioms, laws, primary derivations). This is a
general-purpose open standard for any data feed sold via x402 to
agents. They are in the same x402 universe but they are different
projects with different scopes, different licenses (Bucket is
CC0-in-intent for the protocol + MIT for code; this is MIT throughout),
different governance, and different business models (Bucket is
donations-funded; this is contract work paid by Viatika).

## Non-goals

1. **Not a marketplace.** The protocol is the product, not a SaaS. No
   hosted index, no custodial wallet, no platform lock-in. If someone
   wants to build a marketplace on top, good — but not us, not here.
2. **Not a competitor to Viatika.** Every design decision should make
   Viatika a more natural default, not less. Viatika ships as a
   first-class policy/wallet plugin in the reference server.
3. **Not a rewrite of x402.** We use x402 as-is. We add discovery,
   query semantics, indexing, and provenance on top of x402.
4. **Not opinionated about what data.** Financial data, scientific
   data, real-time feeds, static datasets, image collections — the
   standard is agnostic to the payload.
5. **Not a new chain, token, or registry contract in v0.1.** Keep it
   boring. Base wallet + HTTP + x402 + standard JSON. On-chain
   discovery can come in v0.2 once the off-chain version works.

## What the reference stack contains (v0.1 MVP)

Six artifacts, all in one monorepo:

### 1. `PROTOCOL.md` — the open spec

- Data feed **discovery** (how an agent finds a feed — off-chain
  registry file + `.well-known` convention)
- **Paywall handshake** over x402 (builds directly on HTTP 402
  semantics; agent pings endpoint, gets 402 with pricing + payment
  requirements, pays from Base wallet, retries with payment proof)
- **Query interface** — the thing you pay for. Three tiers:
  - `raw` — paginated rows / binary stream (for bulk download)
  - `query` — SQL-ish or structured query against a provider-defined
    schema
  - `insight` — natural-language query against a provider-maintained
    index, returns embeddings + ranked text chunks + source citations
- **Response envelope** — standardized JSON with payload, provenance
  (who, when, license, hash), citation metadata, x402 receipt
- **Versioning + supersession** — how providers evolve schemas without
  breaking downstream agents
- **Licensing + attribution** — every response carries a license
  string (MIT, CC-BY, proprietary-with-limits, etc.)

Drafted to CC0-in-intent so any provider or agent can implement it
without asking anyone. Governance lives in `GOVERNANCE.md` and is
modeled on the Bucket Foundation governance doc (credit Bucket
explicitly).

### 2. `packages/server/` — the reference provider server

Drop-in Node.js server (with a parallel Python implementation for
v0.2). Wraps an existing data source behind an x402-paywalled HTTP API
that speaks the protocol.

- **Adapters** (v0.1 ships one, v0.2 ships the rest):
  - `adapters/http-passthrough` ← v0.1 — wrap any existing REST API
  - `adapters/postgres` ← v0.2
  - `adapters/jsonl` ← v0.2
  - `adapters/parquet` ← v0.2
  - `adapters/s3` ← v0.2
  - `adapters/vector-db` (Pinecone/Qdrant/Weaviate) ← v0.2
- **x402 paywall** — `@coinbase/x402` or equivalent; configurable
  pricing per endpoint per query type
- **Minimal index** — SQLite FTS5 + a reference vector index (could
  be `sqlite-vec` or `usearch`) so `insight` queries work out of the
  box, even for providers who don't want to run their own index
- **Policy plugin interface** — Viatika is the default policy plugin.
  Providers can plug in their own or run vanilla (no lock-in).
- **Deployable anywhere** — Docker, Vercel Edge, Cloudflare Workers,
  a laptop. Zero stateful requirements beyond SQLite.

### 3. `packages/client/` — the reference consumer SDK

Node.js (v0.1) + Python (v0.2). For AI agents.

- Feed discovery (`client.discover(registryUrl)`)
- Paywall negotiation (`client.negotiate(feedUrl, query)`)
- Base wallet integration (`viem` + an account abstraction pattern;
  support for hot wallets AND delegated signing)
- Query helpers (`client.query.raw()`, `.sql()`, `.insight()`)
- Caching + provenance tracking (agents pay once, cite forever — the
  response is cached with its license + citation metadata)
- Retry + backoff + rate-limit handling

### 4. `packages/cli/` — `x402d` (working command name)

The developer ergonomics surface. Makes going from "I have a dataset"
to "I have an x402-paywalled feed" a 5-minute path.

- `x402d init` — scaffold a new provider in current directory
- `x402d serve` — run the reference server locally
- `x402d publish --registry <url>` — register with a discovery index
- `x402d test --agent` — run the reference agent against the local
  server, verify end-to-end
- `x402d doctor` — diagnostic for common setup issues (wallet not
  funded, Base RPC unreachable, Viatika creds missing, etc.)

### 5. `examples/` — end-to-end reference flows

- **`example-01-static-dataset`** — a 1000-row CSV exposed as an
  x402 feed, consumed by a reference agent that asks it a natural
  language question
- **`example-02-existing-api`** — wraps an existing unauthenticated
  REST API (PubMed? Open Meteo? a toy API) and adds an x402 paywall
- **`example-03-viatika-policy`** — full flow with Viatika as the
  policy/wallet plugin, demonstrating the intended production path

### 6. `docs/` — the narrative

- Quickstart ("from zero to paid feed in 10 minutes")
- Provider guide (how to configure pricing, caching, indexing)
- Consumer guide (how to build an AI agent that pays for data)
- Protocol spec deep-dive
- Relationship to Bucket Foundation (they are siblings, not competitors)
- Relationship to Viatika (Viatika is the default policy plugin, but
  not required)

## How this helps Viatika specifically

1. **Every provider built on the stack is a Viatika customer by
   default.** The reference server ships with the Viatika policy plugin
   enabled by default (but trivially swappable for vanilla x402). Path
   of least resistance = pays Viatika.
2. **Every agent built against the stack uses x402** — and x402 is what
   Viatika sells wallet/policy services for. More agents = more
   wallets = more ops for Viatika to charge for.
3. **The standard itself is Viatika-aligned.** The policy-plugin
   interface is modeled on Cedar (which Viatika uses). Credit-ledger
   semantics match Viatika's 1 credit = $0.001 USD convention. Agents
   that talk to the standard are already speaking a Viatika-flavored
   dialect of x402.
4. **Demand-side validation.** The reference agent exercises every
   Viatika API path, so the stack doubles as Viatika's integration
   test suite.
5. **Open-source halo.** MIT + CC0 protocol means anyone can use it,
   which means Viatika doesn't have to evangelize it directly — other
   people will, which is faster and cheaper than direct sales.

## Prior art to review (P0 before writing code)

**Estimated effort: 4–6 hours, billable.**

1. **x402 spec itself** (x402.org) — confirm we're building on the
   current version and understand current client/server reference
   implementations
2. **Coinbase x402 repo** — their reference server + client, see what
   we can reuse vs. what we need to layer on top
3. **Bucket Foundation `PROTOCOL.md`** — already in this codebase at
   `~/agfarms/bucket-foundation/PROTOCOL.md`; the bucket protocol is
   also x402-over-data, so there may be language we can lift wholesale
4. **Viatika's own `x402-research-gateway`** — at
   `~/freelance/x402-research-gateway/`; this is the one existing
   x402 data provider we know of, and we should make the reference
   stack compatible with what they already built
5. **AP2 (Agent Protocol 2) / MCP for data** — if Anthropic's MCP
   data-source pattern has become a de facto standard, we should be
   able to gateway an MCP data source through an x402 paywall; this
   is a potential killer adapter
6. **ERC-8004 / AIP-1 / similar "agent-to-service" standards** — make
   sure we're not reinventing something that already has industry
   momentum
7. **Existing data marketplaces** — Ocean Protocol, Streamr, The Graph
   Network — understand why they haven't taken over and what we can
   learn / avoid

Deliverable from this phase: `PRIOR-ART.md` in this folder,
one-paragraph summary per item + a recommendation of what to adopt,
compose with, or explicitly differentiate from.

## Deliverables (contract v0.1)

Priced as billable hours against a target scope, not fixed-price.

| # | Deliverable | Artifact | Est. hours |
|---|---|---|---|
| 1 | Prior art review | `PRIOR-ART.md` | 4–6 |
| 2 | Protocol spec v0.0.1 | `PROTOCOL.md` | 8–12 |
| 3 | Reference server (http-passthrough adapter) | `packages/server/` | 12–16 |
| 4 | Reference client SDK (Node) | `packages/client/` | 8–12 |
| 5 | CLI (`x402d init/serve/test`) | `packages/cli/` | 6–10 |
| 6 | End-to-end example #01 (static dataset) | `examples/example-01` | 4–6 |
| 7 | End-to-end example #03 (Viatika policy) | `examples/example-03` | 6–10 |
| 8 | Docs (quickstart + provider + consumer) | `docs/` | 6–10 |
| 9 | Protocol spec v0.1.0 (post-review) | `PROTOCOL.md` rev | 4–6 |
| | **Total (v0.1 MVP)** | | **58–88 hours** |

At $60/hr, v0.1 MVP is approximately **$3,480–$5,280**. Target is
4–6 weeks of part-time work against an agreed milestone schedule.

## Open decisions (ordered by blocking-ness)

1. **Name.** Placeholder is `viatika-x402-data-standard`. Real
   candidates (bikeshed together, not alone):
   - **`feed402`** — short, pronounceable, memorable, signals x402,
     signals data feeds, no conflict with Bucket. Domain availability
     TBD. Current top pick.
   - `x402data`, `x402-feeds`, `x402-kit`, `openfeed402`
   - `dataroute` (likely taken), `openmeter` (taken)
   - `rack` (market-stall vibe), `stall`, `souk` (too cute)
   - Lanzafame gets name veto.
2. **Repo home.** Three options:
   - (a) Viatika's GitHub org — signals it's a Viatika project, Viatika
     owns the IP. Cleanest from a contract-deliverables standpoint.
   - (b) A new neutral `feed402` / `x402-data` GitHub org — signals
     it's a community standard, Viatika is a contributor not an owner.
     Better for adoption, worse for Viatika's defensibility.
   - (c) AGFarms org — makes it an AGFarms venture. Probably the wrong
     home since this is contract work for Viatika, not an AGFarms
     property. Ruled out unless specifically requested.
   - **Recommendation:** (b) neutral org, Viatika listed as founding
     sponsor in README + GOVERNANCE.md. Better for market adoption.
     Ask Lanzafame.
3. **License.** MIT for code is locked. Protocol license is the
   question: CC0, CC-BY, or "public spec, no formal license"? CC0 is
   Bucket's choice and matches the spirit. Recommend CC0.
4. **Relationship to Bucket's protocol.** Bucket has its own
   `PROTOCOL.md` focused on research canon. Three options:
   - Fork Bucket's language verbatim (they're siblings, different
     audiences, fine to diverge)
   - Build this spec as a *superset* Bucket can implement (Bucket =
     a specific vertical of the general standard)
   - Build this spec as a *sibling* that explicitly cites Bucket
     - **Recommendation:** sibling with cross-citation. Bucket is a
     nonprofit with a specific canon mission; this is a
     general-purpose standard with a contract-work origin. They
     should cross-reference but not be coupled.
5. **Base vs other L2s.** Base is in the contract wording ("base
   crypto wallets"). Ship Base in v0.1. Design the wallet interface
   to be chain-agnostic so Optimism, Arbitrum, and Ethereum mainnet
   can be added without breaking changes.
6. **Index layer choice.** SQLite FTS5 + `sqlite-vec` for v0.1 — no
   external dependencies, embeddable, fast enough for MVP. Move to
   Postgres + pgvector if/when providers outgrow it.
7. **Governance.** Who merges PRs? Who is the spec editor? v0.1 says
   "Gian is spec editor, Lanzafame is sponsor, decisions by rough
   consensus." v0.2+ we figure out if it needs a foundation, a
   working group, or stays a BDFL project.
8. **Tracker update.** `~/freelance/tracker/config.json` currently
   points `git_repo_path` at `viatika-platform`. Needs to be updated
   to support multiple Viatika projects OR the tracker needs to run
   separately per project. **Flagged for decision — not touching
   production billing config without explicit approval.**

## Next concrete steps (in order)

1. **Lanzafame approval call** — name, repo home, license, v0.1
   scope sign-off. Est. 30 min. *Blocks everything below.*
2. **Prior art review** — 4–6 hours, billable. Deliver `PRIOR-ART.md`
   as the first artifact of the engagement.
3. **Protocol spec v0.0.1** — 8–12 hours. Draft the wire format,
   paywall handshake, query semantics, response envelope.
4. **Reference server scaffold** — `x402d init` + http-passthrough
   adapter. Smallest possible loop that can actually take a payment
   and return a response.
5. **Reference client scaffold** — enough to hit the reference
   server and complete a full pay-and-query cycle end-to-end.
6. **Example 01: static dataset** — prove the loop works with real
   data.
7. **Example 03: Viatika policy plugin** — prove the loop works with
   Viatika in the middle.
8. **Docs pass + announce** — internal announce to Viatika, then
   public announce on the neutral GitHub org once Lanzafame is
   ready.

## Relationship to existing AGFarms work

- **Bucket Foundation** — sibling protocol, cross-reference in both
  specs, no coupling. Bucket's `PROTOCOL.md` is prior art (P0) for
  this work.
- **Viatika vendor contract (`~/freelance/viatika-platform`)** —
  strictly parallel engagement. Same client, same rate, different
  scope. Viatika platform is *maintaining vendor source*; this
  contract is *building new open-source inventory for the vendor to
  resell*. Keep the repos separate, keep the billing separate (after
  tracker reconfig), keep the invoicing separate.
- **Viatika x402-research-gateway** — at
  `~/freelance/x402-research-gateway`, this is the one existing x402
  data provider we know of. The reference stack must be backwards
  compatible with the patterns this gateway already uses, OR we need
  an explicit migration path. Prior art item #4.
- **Nucleus Brain** — not directly related. Nucleus is the AGFarms
  orchestrator; this is a Viatika engagement. Brain can track the
  contract as a work item, nothing else.

## Logging + invoicing

- Time tracking: `~/freelance/tracker/` tool (reconfigure per §Open
  Decisions #8)
- Time log: `TIMELOG.md` in this folder, append-only, one line per
  session with date + hours + summary
- Invoice cadence: end of each calendar week, PDF to Lanzafame via
  email + gdrive mirror per AGFarms delivery convention
- Invoice folder on gdrive: will be
  `gdrive:AGFarms/Nucleus/viatika/invoices-x402-data-standard/`
  (create on first invoice)

---

## Signoff

This scoping document is the v0.1 anchor. It is not a contract until
Lanzafame has reviewed and agreed to the Open Decisions and the
Deliverables table. Until then, all work is at-risk and will be
logged but not invoiced.

Once Lanzafame signs off, this document is frozen and any scope
changes become amendments tracked in `AMENDMENTS.md`.
