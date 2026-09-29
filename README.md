# Convert My File

Secure, ephemeral file workspace for convert, translate, merge, and exact-size compress/expand — with a 3-minute wipe timer and zero-persistence messaging.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Client-side / mock processing for conversion engines (realistic upload → progress → preview → download UX)

## Run locally

```bash
npm install
npm run dev -- --port 43127 --hostname 127.0.0.1
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Features

- **Converter** — Smart Converter upload + preview panels, quick tags (PDF→DOC, JPG→PDF, …)
- **Translator** — Word/PDF/Excel upload, ~100 languages (top 50 India + top 50 world), preview before download
- **Merger** — Multi-file PDF/Word merge with ordered list
- **Compressor / Expander** — Exact target size in KB or MB
- **Wipe timer** — Header countdown (3:00) after upload until download
- **Legal** — Terms, Privacy, Contact pages

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright end-to-end QA (requires `npm run dev`) |

## Deploy (Render)

`render.yaml` defines a Node web service (`npm run build` → `next start`). Connect a GitHub repo to Render and apply the Blueprint, or use the Render CLI with `RENDER_API_KEY`.
