# Memra

Self-hosted Markdown notes with keyword and semantic search, an optional AI answer over your own notes, and an offline-capable web app. Built with IBM Carbon Design System, Fastify, SQLite (FTS5 + sqlite-vec) and React.

- **Single user, hosted securely** — password login, hardened sessions, HTTPS behind a reverse proxy.
- **Runs on a small VM** — the default profile fits 1 vCPU / 1 GB RAM with a local embedding model; no data leaves your server unless you configure a remote provider.
- **Offline read-only** — the PWA keeps a copy of your notes on the device; keyword search works offline, changes sync when you reconnect.

## Requirements

- Node ≥ 26 and pnpm 12 (pnpm downloads the right Node automatically via `devEngines`).
- A reverse proxy that terminates TLS in production (Caddy, Tailscale Serve, …). Service workers, secure cookies and HSTS require HTTPS; plain HTTP is allowed only on `localhost`.

## Quick start (development)

```bash
pnpm install
cp .env.example apps/server/.env          # set MEMRA_INSECURE_DEV=1 for http://localhost
pnpm --filter server auth:set-password    # prompts for the login password
pnpm run dev                              # server on :3000, client on :5173 (proxies /api)
```

Open http://localhost:5173 and sign in. The first semantic search downloads the embedding model (~35 MB) into `apps/server/data/models`.

## Production

```bash
pnpm install
pnpm run build
cd apps/server
node dist/cli.mjs auth:set-password
node dist/index.mjs                        # serves the client and the API on $PORT
```

Put Caddy (or similar) in front — see `deploy/Caddyfile`. Set `MEMRA_PUBLIC_ORIGIN` to the public URL so cross-site requests are rejected.

### Docker

```bash
docker build -t memra .
docker run -d --name memra -p 127.0.0.1:3000:3000 -v memra-data:/data \
  -e MEMRA_PUBLIC_ORIGIN=https://notes.example.com memra
docker exec -it memra node dist/cli.mjs auth:set-password
```

Or `docker compose -f deploy/docker-compose.yml up -d`. The image is glibc-based on purpose: `onnxruntime-node` and `sqlite-vec` do not run on Alpine.

## Configuration

All settings are environment variables; see `.env.example`. Empty values are treated as unset.

| Variable                   | Default  | Purpose                                                                                                                                                                                                      |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MEMRA_PROFILE`            | `low`    | `low` (1 vCPU / 1 GB: `bge-small`, batch 4) or `standard` (`bge-base`, batch 16, warm-up).                                                                                                                   |
| `MEMRA_EMBEDDING_PROVIDER` | `local`  | `local` (ONNX on your server) or `openai-compatible` (`MEMRA_EMBEDDING_BASE_URL`, `_API_KEY`, `_MODEL`, `_DIMS`). Works with OpenAI, Ollama (`/v1`), LM Studio, vLLM. Changing the model rebuilds the index. |
| `MEMRA_LLM_PROVIDER`       | `none`   | `none` shows extractive answers (verbatim passages, no generation). `openai-compatible` streams from `MEMRA_LLM_BASE_URL` with `MEMRA_LLM_MODEL`.                                                            |
| `MEMRA_SEM_MIN_SIM`        | `0.30`   | Minimum cosine similarity for a chunk to count as a semantic match.                                                                                                                                          |
| `MEMRA_PUBLIC_ORIGIN`      | —        | Public origin used for Origin checks on mutating requests.                                                                                                                                                   |
| `MEMRA_INSECURE_DEV`       | `0`      | `1` disables Secure cookies/HSTS; only for `http://localhost`.                                                                                                                                               |
| `MEMRA_DATA_DIR`           | `./data` | SQLite files, downloaded models, backups. Treat as sensitive (contains the password hash).                                                                                                                   |

### Air-gapped hosts

The local embedding model is fetched from the Hugging Face Hub on first use. On hosts without egress, copy `<data>/models` from a machine that has run once.

## CLI

```bash
pnpm --filter server cli auth:set-password   # set or reset the password (revokes all sessions)
pnpm --filter server cli db:backup           # copy memra.sqlite into <data>/backups (keeps 14)
pnpm --filter server cli db:maintain         # purge expired tombstones, PRAGMA optimize
pnpm --filter server cli db:doctor           # integrity check and counts
```

In Docker, use `node dist/cli.mjs <command>` inside the container. Daily backups and maintenance also run automatically while the server is up, and a backup is taken before any schema migration.

## Notes as files

Upload a `.md` from the composer to preview it and save it as a note, or import a `.zip` of Markdown files from Settings (top-level directories become folders). Front matter is honoured:

```md
---
title: Banana Bread
tags: [recipe, food]
color: teal # one of the Carbon tag colours
folder: Recipes
pinned: false
---
```

Export produces the same format, grouped by folder.

## Development

```bash
pnpm exec vp check          # format, lint, type-check everything
pnpm exec vp check --fix
pnpm run build              # shared → server → client
```

Workspace layout: `packages/shared` (Zod schemas, oRPC contract, Markdown utilities), `apps/server` (Fastify, SQLite, search, index worker), `apps/client` (React + Carbon PWA). The API contract in `shared` is the single source of truth: handlers and the client are type-checked against it.
