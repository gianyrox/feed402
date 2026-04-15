#!/bin/bash
# Gmail compose URL for the feed402 review packet.
# Per AGFarms delivery pattern (CLAUDE.md §Cloud Share): compose URL
# prefills to/subject/body, user clicks Drive picker to attach PDFs.
#
# Usage: bash send-to-lanzafame.sh
# Then click the printed URL in any browser logged into gianyrox@gmail.com
# → compose opens → click Drive icon → pick the folder → send.
#
# This script DOES NOT SEND — it only prints a URL. Review before clicking.

GDRIVE_LINK="https://drive.google.com/open?id=1e1MzYcozHyU_fzTyHENA4QvBTPV9wpzH"
GDRIVE_PATH="gdrive:AGFarms/Nucleus/viatika/feed402-review-2026-04-15/"

# TODO: confirm Lanzafame's email before using. Placeholder below.
TO="REPLACE_WITH_LANZAFAME_EMAIL"

SUBJECT="feed402 — review packet (10-page fixed-bid proposal for x402 data supply)"

BODY="Hey,

Packet for the open-source x402 data reference stack we talked about — right-sized to
what you asked for. 9 pages total across three docs, fixed bid \$600 / 10 hours.

Google Drive folder (Drive picker in compose will show all 7 files):
  ${GDRIVE_LINK}

Read in order:
  1. 01-BRIEF.pdf     (3 pages) — problem, solution, what ships, budget, decisions
  2. 02-SPEC.pdf      (4 pages) — one-page protocol + §3.1 extension point (VDS)
  3. 03-CONTRACT.pdf  (2 pages) — half-page fixed-bid terms

Two things to react to:

  (a) Go / no-go on the proposal as written. Fixed \$600 / 10h. If yes, I start
      within 24 hours of your reply and ship inside one week.

  (b) Four decisions in BRIEF.md §Decisions needed:
        1. Name — 'feed402'? 'x402-data'? something else?
        2. Repo home — Viatika org, neutral org, or my personal?
        3. License — MIT code + CC0 spec (my default) — ok?
        4. Start date — today, or wait on viatika-platform queue?

One reply answering (a) + the four items IS the contract. No countersignature
ceremony. I don't need a legal review cycle for this — the terms are in
03-CONTRACT.pdf and it's half a page.

The thing I'd flag explicitly: SPEC §3.1 adds a forward-compat hook
(citation.type) that lets the same rail carry not just literature
citations but also scripted real-world capture sessions — DerbyFish's
catch-verification pipeline is the named reference merchant. That's zero
cost to v0.1 and materially widens Viatika's addressable supply side
(any data provider whose product is evidence, not rows).

Let me know.
— Gian"

# URL-encode body for Gmail compose
python3 <<PY
import urllib.parse
print("https://mail.google.com/mail/?view=cm&fs=1" +
      "&to=" + urllib.parse.quote("""${TO}""") +
      "&su=" + urllib.parse.quote("""${SUBJECT}""") +
      "&body=" + urllib.parse.quote("""${BODY}"""))
PY
