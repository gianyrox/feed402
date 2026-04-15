# viatika-x402-data-standard

> **Working title.** Real name TBD — see `SCOPING.md` §Open Decisions.
> Current top candidate: **`feed402`**.

An open-source reference stack for selling data to AI agents over x402.

## The problem

Viatika has built the middleware for AI agents to pay for data over
x402 (policy engine, credit ledger, Base wallet ops, Stripe bridging).
But the supply side is empty — there are no x402 data providers to
point those agents at. Viatika is a payment rail with no merchants.

## The solution

Ship a drop-in, MIT-licensed reference stack that lets any data source
(Postgres, JSONL, Parquet, S3, an existing REST API, a vector DB)
expose itself as an x402-paywalled data feed, with three query tiers:

1. **`raw`** — bulk, paginated, priced by rows/bytes
2. **`query`** — structured SQL against a provider-defined schema
3. **`insight`** — natural-language query against a provider-maintained
   embedding index, returns ranked chunks + citations

Every response is provenance-stamped and citable forever, so agents
can stake their outputs on paid-once, cite-forever data.

## Status

**Scoping phase.** Not yet implemented. See:

- [`SCOPING.md`](./SCOPING.md) — full thesis, deliverables, open decisions
- [`PROTOCOL-DRAFT.md`](./PROTOCOL-DRAFT.md) — v0.0.0 protocol sketch
- [`CONTRACT.md`](./CONTRACT.md) — engagement terms ($60/hr, v0.1 MVP 58–88h)
- [`TIMELOG.md`](./TIMELOG.md) — billable hours log

## Relationship to other projects

- **Viatika** — this is a paid contract for Viatika. Viatika is the
  founding sponsor and the default policy/wallet plugin, but the
  protocol and reference stack are open source and not Viatika-locked.
- **Bucket Foundation** — sibling protocol. Bucket's `PROTOCOL.md` is
  a vertical specialization of this one (foundations canon). Cross-
  referenced in both directions. Not coupled.
- **x402** — built on top of x402 as defined upstream. We add a
  data-layer convention (discovery, query tiers, response envelope,
  citation). We do not re-specify x402.

## License

MIT for code (when code exists). CC0-in-intent for the protocol spec
(when v0.1.0 is published).
