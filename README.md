# Memra

Self-hosted Markdown notes with keyword and semantic search and an optional AI answer over your own notes. Built with IBM Carbon Design System, Fastify, SQLite (FTS5 + sqlite-vec) and React.

- **Single user, hosted securely** — password login, hardened sessions, HTTPS behind a reverse proxy.
- **Runs on a small VM** — defaults fit 1 vCPU / 1 GB RAM with a local embedding model; no data leaves your server unless you configure a remote provider in Settings.
- **Configured in the browser** — the first visit walks you through setting a password and choosing search providers; everything else lives in Settings.

## Requirements

- Node ≥ 26 and pnpm 12 (pnpm downloads the right Node automatically via `devEngines`).
- A reverse proxy that terminates TLS in production (Caddy, Tailscale Serve, …). Secure cookies and HSTS require HTTPS; plain HTTP is allowed only on `localhost`.

## Quick start (development)

```bash
pnpm install
cp .env.example apps/server/.env          # set MEMRA_INSECURE_DEV=1 for http://localhost
pnpm run dev                              # server on :3000, client on :5173 (proxies /api)
```

Open http://localhost:5173. The first visit shows the setup page: pick a password and a search provider. With the default local model, the first semantic search downloads it (~35 MB) into `apps/server/data/models`.

## Production

```bash
pnpm install
pnpm run build
cd apps/server
node dist/index.mjs                        # serves the client and the API on $PORT
```

Then open the site once to complete setup.

Put Caddy (or similar) in front — see `deploy/Caddyfile`. Set `MEMRA_PUBLIC_ORIGIN` to the public URL so cross-site requests are rejected.

### Docker

```bash
docker build -t memra .
docker run -d --name memra -p 127.0.0.1:3000:3000 -v memra-data:/data \
  -e MEMRA_PUBLIC_ORIGIN=https://notes.example.com memra
```

Or `docker compose -f deploy/docker-compose.yml up -d`. The image is glibc-based on purpose: `onnxruntime-node` and `sqlite-vec` do not run on Alpine.

## Configuration

Search providers, the answer model, API keys and the similarity threshold are set in **Settings → Search** (keys are stored encrypted with a key generated into the data directory). Only deployment concerns are environment variables; see `.env.example`.

| Variable              | Default              | Purpose                                                                                               |
| --------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- |
| `HOST` / `PORT`       | `127.0.0.1` / `3000` | Bind address. Binding to a non-loopback host requires secure cookies (i.e. not `MEMRA_INSECURE_DEV`). |
| `MEMRA_PUBLIC_ORIGIN` | —                    | Public origin used for Origin checks on mutating requests.                                            |
| `MEMRA_INSECURE_DEV`  | `0`                  | `1` disables Secure cookies/HSTS; only for `http://localhost`.                                        |
| `MEMRA_DATA_DIR`      | `./data`             | SQLite files, `secret.key`, downloaded models, backups. Treat as sensitive.                           |
| `MEMRA_LOG_LEVEL`     | `info`               | Pino log level.                                                                                       |

### Air-gapped hosts

The local embedding model is fetched from the Hugging Face Hub on first use. On hosts without egress, copy `<data>/models` from a machine that has run once.

## CLI

```bash
pnpm --filter server cli auth:set-password   # reset the password from the shell (revokes all sessions)
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

Workspace layout: `packages/shared` (Zod schemas, oRPC contract, Markdown utilities), `apps/server` (Fastify, SQLite, search, index worker), `apps/client` (React + Carbon). The API contract in `shared` is the single source of truth: handlers and the client are type-checked against it.
