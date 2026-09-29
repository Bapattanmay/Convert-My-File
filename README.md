# Convert My File

Secure, ephemeral file workspace for convert, translate, merge, and exact-size compress/expand — with Login-gated tools, usage analytics, a 3-minute wipe timer, and zero-persistence messaging for file contents.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Client-side conversion engines + server-side Login / usage store (JSON on disk)

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

### Environment (optional locally)

| Variable | Default (local) | Purpose |
| --- | --- | --- |
| `ADMIN_USERNAME` | `admin` | Admin dashboard login |
| `ADMIN_PASSWORD` | `ConvertMyFileAdmin2026!` | Admin dashboard password |
| `SESSION_SECRET` | `convert-my-file-dev-secret-change-me` | JWT signing secret |
| `DATA_DIR` | `./data` | Directory for usage JSON store |

Copy `.env.example` to `.env.local` to override. **Change admin credentials in production.**

## Features

- **Login** — Required before Converter / Translator / Merger / Compressor. Captures name, time spent, features used, and approximate location (browser geolocation and/or IP).
- **Admin** — `/admin` owner dashboard of usage sessions (credentials via env).
- **Converter / Translator / Merger / Compressor** — Workspace tools (gated).
- **Wipe timer** — Header countdown (3:00) after upload until download.
- **Legal** — Terms & Privacy disclose analytics collection.

## Storage note

Usage data is written to `DATA_DIR/usage-store.json`. On Render without a persistent disk, this is **ephemeral** and resets on redeploy. Attach a Render disk and set `DATA_DIR` to the mount path for durability.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server (port 43127) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright end-to-end QA (requires `npm run dev`) |

## Deploy (Render)

`render.yaml` defines a Node web service. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and optionally `DATA_DIR` in the Render dashboard or API. Connect the GitHub repo and deploy.
