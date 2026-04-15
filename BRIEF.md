# feed402 — review brief for Lanzafame

**Author:** Gianangelo Dichio · **Client:** Viatika · **Date:** 2026-04-15
**Scope:** 10 hours · **Cost:** $600 fixed · **Status:** awaiting go/no-go

---

## The problem

Viatika shipped complete x402 middleware: Cedar policy, Redis ledger, wallet
signing, Stripe bridge. It works. But **there are no data providers selling
over x402**, so there is nothing for AI agents to buy. Viatika is a payment
rail with no merchants.

## The solution (10 hours, not 10 weeks)

Ship **one working proof** that an AI agent with a Base wallet can discover,
pay, and query a data endpoint over x402 — and then hand the pattern to real
data providers as a copy-paste template.

Not a framework. Not a monorepo. Not a CLI. **One repo, three files, one demo.**

## What ships

| File | ~LOC | Purpose |
|---|---|---|
| `SPEC.md` | 1 page | Protocol: discovery, handshake, response envelope, 3 query tiers |
| `server.ts` | ~200 | Reference data seller. Hono + x402 lib + in-memory sqlite index |
| `agent.ts` | ~100 | Reference buyer. viem + Base wallet + `.well-known` discovery + pay + query |
| `demo.sh` | ~20 | One command: boots server, runs agent, prints receipt + result |
| `README.md` | ½ page | What it is, how to run, how to fork |

Runs on Cloudflare Workers or any Node host. MIT code, CC0 spec.

## What this buys Viatika

1. **A merchant playbook.** Any data co. forks this repo, points it at their
   dataset, ships in a day, sells over x402 the next.
2. **A discovery pattern** (`/.well-known/feed402.json`) that agents can scan.
3. **A citation envelope** so every paid response carries provenance — the
   one thing Viatika's middleware can't bolt on after the fact.
4. **A demo to show investors and prospects** in under 60 seconds.

## What it does NOT do (deferred past v0.1)

- No CLI scaffold, no adapters, no SDK packages
- No production dataset, no real content
- No governance, no versioning, no registry
- No marketing site, no docs portal
- No legal review of citation terms

All of that is v0.2+ work, gated on whether this proof resonates.

## Architecture (one screen)

```
 AI agent (Base wallet)                 Data provider (this repo)
 ─────────────────────        HTTP      ──────────────────────────
  1. GET /.well-known/feed402.json  →   discovery (free)
  2. POST /query  (no payment)      →   402 Payment Required
     ← x402 challenge (price, address)
  3. POST /query  + x402 header     →   200 + JSON envelope
                                        { data, citation, receipt }
```

Three query tiers, same endpoint:
- `raw` — bulk rows (highest price)
- `query` — structured SQL-ish (medium)
- `insight` — NL over embedding index (lowest, fastest)

Provider picks which tiers to enable; envelope shape is identical.

## Budget

| Line | Hours | $ |
|---|---|---|
| Draft `SPEC.md` | 2 | 120 |
| `server.ts` reference seller | 3 | 180 |
| `agent.ts` reference buyer | 2 | 120 |
| `demo.sh` + README + polish | 1 | 60 |
| Lanzafame review + one revision | 2 | 120 |
| **Total** | **10** | **$600** |

Fixed bid. If I exceed 10h I eat it. No change orders unless scope grows
past v0.1 (in which case we write a new line-item).

## Decisions needed from Lanzafame before I start

1. **Name.** `feed402`? `x402-data`? Something else?
2. **Repo home.** Viatika GitHub org, neutral org, or my personal?
3. **License.** MIT code + CC0 spec (my default) — approve?
4. **Start date.** Today, or wait on the existing viatika-platform queue?

One reply is enough. I don't need a contract review — the contract is one
page and already drafted (`CONTRACT.md`).

## The ask

**Yes / no / change to ___**, plus the four answers above. I'll start within
24 hours of your reply and ship v0.1 inside the week.
