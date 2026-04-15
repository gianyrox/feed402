# CONTRACT.md — viatika-x402-data-standard

**Engagement type:** Paid contract work, hourly
**Client:** Viatika (contact: Lanzafame)
**Contractor:** Gianangelo Dichio (AGFarms LLC / freelance capacity TBD)
**Rate:** $60.00 USD / hour
**Currency:** USD
**Payment method:** TBD at first invoice (likely bank transfer or USDC on Base)
**Invoice cadence:** End of each calendar week
**Status:** Kickoff — scoping phase, not yet signed off

---

## Relationship to existing Viatika contract

This is a **new, parallel engagement** with the same client at the
same rate as the existing `~/freelance/viatika-platform` contract.

| Dimension | `viatika-platform` | `viatika-x402-data-standard` (this) |
|---|---|---|
| Rate | $60/hr | $60/hr |
| Scope | Vendor source maintenance (read-only reference in AGFarms; active work in freelance) | Build open-source reference stack for x402 data providers |
| Repo | `~/freelance/viatika-platform/` | `~/freelance/viatika-x402-data-standard/` |
| Client visibility | Private vendor code | Public open-source (MIT / CC0) |
| Why separate | Clean scope boundary; different deliverables; different IP ownership | — |

The two contracts are **independently invoiced** from the kickoff of
this new contract. Do not commingle time entries, deliverables, or
invoices.

## Scope (v0.1)

See `SCOPING.md` §Deliverables for the full table. Summary:

| # | Deliverable | Estimated hours |
|---|---|---|
| 1 | Prior art review (`PRIOR-ART.md`) | 4–6 |
| 2 | Protocol spec v0.0.1 (`PROTOCOL.md`) | 8–12 |
| 3 | Reference server + 1 adapter | 12–16 |
| 4 | Reference client SDK (Node) | 8–12 |
| 5 | CLI scaffold | 6–10 |
| 6 | Example 01: static dataset | 4–6 |
| 7 | Example 03: Viatika policy plugin | 6–10 |
| 8 | Docs (quickstart + provider + consumer) | 6–10 |
| 9 | Protocol spec v0.1.0 post-review | 4–6 |
| | **v0.1 MVP total** | **58–88 hours** |
| | **v0.1 MVP cost at $60/hr** | **$3,480 – $5,280** |

## Terms

1. **Billing basis.** Hourly. Time tracked by `~/freelance/tracker/`
   tool or equivalent. Rounded to the nearest 0.1 hour.
2. **Work logging.** `TIMELOG.md` in this folder, one line per
   session, append-only, with date + start + end + hours + one-line
   summary. Full tracker export available on request.
3. **Scope changes.** Any addition, removal, or rescoping of a
   deliverable is logged as an amendment in `AMENDMENTS.md` and
   requires Lanzafame approval before hours are logged against it.
4. **Licensing.** All code is MIT, all specs are CC0 unless Lanzafame
   specifies otherwise in writing. The intent is **open source**.
   Viatika gets no exclusive IP rights beyond what MIT/CC0 confers to
   everyone. Viatika's edge is the policy/wallet layer + brand, not
   the protocol IP.
5. **Attribution.** Viatika is credited in every artifact as the
   founding sponsor. Lanzafame is credited as the engagement initiator.
   Gian is credited as the spec author and reference implementation
   author.
6. **Competitive clause.** None. Gian retains full right to work on
   Bucket Foundation, AGFarms ventures, and other engagements in
   parallel, including any that might use this standard.
7. **Termination.** Either party may terminate at any time with one
   week's notice. Final invoice is due on termination. No kill fee.
8. **Ownership on termination.** If terminated before v0.1 is shipped,
   all work-in-progress committed to the public repo remains public
   under MIT/CC0. If there is a private repo, it transfers to Viatika
   on termination.
9. **Confidentiality.** Default: open source, nothing is confidential.
   Anything Lanzafame explicitly marks confidential (e.g. Viatika
   internal pricing, customer lists, strategic roadmap) stays
   confidential indefinitely.
10. **Representation.** Work performed in Gian's freelance capacity.
    AGFarms LLC is not a party to this contract.

## Invoicing

- **Week ending:** Sunday 23:59 local time
- **Invoice format:** PDF, itemized by day, one line per session
- **Invoice folder (gdrive):**
  `gdrive:AGFarms/Nucleus/viatika/invoices-x402-data-standard/`
  (created on first invoice per AGFarms delivery convention)
- **Delivery:** Email to Lanzafame with PDF attached or gdrive link
- **Payment terms:** Net 7
- **First invoice:** End of week 2026-04-19, covering hours from
  kickoff (2026-04-15) through that Sunday

## Kickoff checklist

- [x] Folder created: `~/freelance/viatika-x402-data-standard/`
- [x] `SCOPING.md` drafted
- [x] `PROTOCOL-DRAFT.md` v0.0.0 drafted
- [x] `CONTRACT.md` drafted (this file)
- [ ] Lanzafame reviews `SCOPING.md` §Open Decisions
- [ ] Lanzafame signs off on v0.1 deliverables table
- [ ] Name finalized (current placeholder: `viatika-x402-data-standard`)
- [ ] Repo home decided (current recommendation: neutral GitHub org)
- [ ] License confirmed (current default: MIT code, CC0 spec)
- [ ] `~/freelance/tracker/config.json` reconfigured for two projects
- [ ] `TIMELOG.md` created, first entry logged
- [ ] Invoice folder created on gdrive
- [ ] First prior-art session scheduled

## Changelog

- **2026-04-15** — Contract drafted. Kickoff. Scoping phase begun.
  Source of engagement: Lanzafame flagged Viatika's supply-side
  problem to Gian; Gian agreed to scope and build the reference
  stack at $60/hr parallel to the existing viatika-platform
  contract. Not yet counter-signed.
