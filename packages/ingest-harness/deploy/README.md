# Deploying feed402 endpoints at *.feed402.dev

Two paths, pick one.

## Path A — Docker Compose (single VM)

Best for the Hetzner CPX42 box that already runs Caddy + the x402 gateway.

```bash
cd packages/ingest-harness/deploy
cat > .env <<EOF
CLOUDFLARE_API_TOKEN=<token-with-zone:read+dns:edit on feed402.dev>
FEED402_FACILITATOR_URL=https://gateway.feed402.dev/x402
EOF
docker compose up -d --build
```

DNS prerequisites:
1. `feed402.dev` and `*.feed402.dev` A/AAAA records → the box's public IP.
2. CF API token scoped to `feed402.dev` zone DNS edit (DNS-01 challenge).

Verify:
```bash
curl https://feed402.dev/                                   # provider index
curl https://world-history.feed402.dev/.well-known/feed402.json
curl https://world-history.feed402.dev/query?bbox=-15,35,40,60&limit=5  # 402
```

## Path B — K3s (AGFarms standard)

```bash
cd packages/ingest-harness
docker buildx build -t farmera/feed402-ingest-harness:0.1.0 --push .

kubectl apply -f deploy/k8s.yaml

# secret for facilitator URL (optional)
kubectl create secret generic feed402-secrets \
  --namespace feed402 \
  --from-literal=facilitator_url=https://gateway.feed402.dev/x402
```

cert-manager issues `feed402-wildcard-tls` via DNS-01 against the
`cloudflare-dns` ClusterIssuer that the rest of `*.nucleus.agfarms.dev` uses.

## What you get

- `https://feed402.dev/` — JSON index of every provider on the host.
- `https://<provider>.feed402.dev/.well-known/feed402.json` — manifest.
- `https://<provider>.feed402.dev/raw|query|insight` — paid tiers.

11 providers ship by default:
- pharma-fda, world-history, us-history, constitutions, math-history,
  physics-history, medical-history, banking-history, world-politics,
  banking, per-nation

Add a 12th by dropping a folder under `datasets/<name>/` and rebuilding.

## Payment modes

`FEED402_FACILITATOR_URL=` (unset)        → `stub` verifier (accepts any base64 `{tx}`).
`FEED402_FACILITATOR_URL=https://...`    → POSTs the X-PAYMENT header to that URL/verify.

The default x402-research-gateway exposes `/x402/verify` with the right shape.

## Rollback

```bash
docker compose down                # path A
kubectl delete -f deploy/k8s.yaml  # path B
```

## Cost

CPU < 200m steady-state; memory ~150MB at boot for all 11 providers (~25k rows
total). Fits comfortably alongside the existing AGFarms workloads on the
shared Hetzner CPX42.
