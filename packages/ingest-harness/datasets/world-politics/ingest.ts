// World politics: heads-of-state terms + treaties + elections post-1945.
// License-clean (CC0/CC-BY-SA). ACLED is licensed-NC and is intentionally NOT included here.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sparql, parseCoord, csvEscape, slug, sleep } from "../_lib/wikidata.js";

const OUT = "./datasets/world-politics";

// Items with date ≥ 1945, geocoded.
const SLICES: Array<{ kind: string; qid: string; dateProp: string }> = [
  { kind: "treaty",       qid: "Q131569",   dateProp: "P585|wdt:P580" },
  { kind: "election",     qid: "Q40231",    dateProp: "P585" },
  { kind: "summit",       qid: "Q1072326",  dateProp: "P585|wdt:P580" }, // diplomatic conference
  { kind: "coup",         qid: "Q45382",    dateProp: "P585" },
  { kind: "referendum",   qid: "Q43109",    dateProp: "P585" },
];

async function runSlice(s: typeof SLICES[number], limit: number) {
  const q = `
    SELECT ?item ?itemLabel ?date ?coord ?desc WHERE {
      ?item wdt:P31/wdt:P279* wd:${s.qid} .
      ?item wdt:${s.dateProp} ?date .
      FILTER(?date >= "1945-01-01"^^xsd:dateTime)
      OPTIONAL { ?item wdt:P625 ?coord . }
      OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?date)
    LIMIT ${limit}`;
  return sparql(q);
}

async function main() {
  console.log("world-politics ingest");
  mkdirSync(OUT, { recursive: true });
  const all: any[] = [];
  for (const s of SLICES) {
    process.stdout.write(`  ${s.kind} ... `);
    try { const r = await runSlice(s, 400); for (const b of r) all.push({ b, kind: s.kind }); console.log(r.length); }
    catch (e: any) { console.log(`SKIP (${e.message.split("\n")[0]})`); }
    await sleep(800);
  }

  const cols = ["id","lat","lon","timestamp","source_url","license","title","kind","description"];
  const lines = [cols.join(",")];
  const chunks: string[] = [];
  const seen = new Set<string>();
  let kept = 0;

  for (const { b, kind } of all) {
    const qid = b.item.value.split("/").pop();
    if (seen.has(qid)) continue;
    seen.add(qid);
    const ts = b.date?.value;
    if (!ts) continue;
    const { lat, lon } = parseCoord(b.coord?.value);
    // For treaties/elections without coord, skip — politics map needs geo
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const title = b.itemLabel?.value ?? qid;
    const desc = b.desc?.value ?? "";
    const id = `wd-${qid}-${slug(title)}`.slice(0, 90);
    const url = `https://www.wikidata.org/wiki/${qid}`;
    lines.push([id, lat, lon, ts, url, "CC-BY-SA-4.0", title, kind, desc].map(csvEscape).join(","));
    if (desc.length > 15) chunks.push(JSON.stringify({
      chunk_id: `${id}#c0`,
      source_id: `world-politics:${id}`,
      text: `${title} (${kind}, ${ts.slice(0,10)}). ${desc}`,
      canonical_url: url, license: "CC-BY-SA-4.0",
    }));
    kept++;
  }
  writeFileSync(join(OUT, "data.csv"), lines.join("\n") + "\n");
  writeFileSync(join(OUT, "chunks.jsonl"), chunks.join("\n") + "\n");
  writeFileSync(join(OUT, "manifest.yaml"),
`name: world-politics
version: 0.1.0
chain: base-sepolia
wallet: 0x0000000000000000000000000000000000000000
citation_policy: CC-BY-SA-4.0
contact: ops@bucket.foundation
schema_url: https://world-politics.feed402.dev/schema.json
`);
  writeFileSync(join(OUT, "ingest.stats.json"), JSON.stringify({
    kept, chunks: chunks.length, generated_at: new Date().toISOString(),
    slices: SLICES.map(s => s.kind),
    excluded_due_to_license: ["ACLED (CC-BY-NC, blocks paid-query tier)"],
  }, null, 2));
  console.log(`✓ ${kept} post-1945 political events + ${chunks.length} chunks`);
}
main().catch(e => { console.error(e); process.exit(1); });
