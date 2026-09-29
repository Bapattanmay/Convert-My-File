# Convert My File

Secure, ephemeral file workspace for convert, translate, merge, and exact-size compress/expand — with **Google Login**-gated tools, usage analytics, a 3-minute wipe timer, and zero-persistence messaging for file contents.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Auth.js (NextAuth v5) Google OAuth
- Client-side conversion engines + server usage store (JSON on disk)

## Run locally

```bash
npm install
cp .env.example .env.local   # fill Google + secrets
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

### Environment

| Variable | Default / example | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | *(required for user login)* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | *(required for user login)* | Google OAuth client secret |
| `AUTH_SECRET` or `NEXTAUTH_SECRET` | falls back to `SESSION_SECRET` | Auth.js signing secret |
| `NEXTAUTH_URL` / `AUTH_URL` | `http://127.0.0.1:43127` local; `https://convert-my-file-oo3r.onrender.com` prod | Canonical app URL |
| `ADMIN_USERNAME` | `bapattanmay@gmail.com` | Owner admin dashboard |
| `ADMIN_PASSWORD` | `Bapattanmay@12345` | Owner admin password |
| `SESSION_SECRET` | local default string | Admin JWT + Auth.js fallback |
| `DATA_DIR` | `./data` | Usage JSON directory |

### Google Cloud Console — redirect URIs

Create an OAuth 2.0 Client ID (Web application) and add:

**Authorized JavaScript origins**

- `http://127.0.0.1:43127`
- `https://convert-my-file-oo3r.onrender.com`

**Authorized redirect URIs**

- `http://127.0.0.1:43127/api/auth/callback/google`
- `https://convert-my-file-oo3r.onrender.com/api/auth/callback/google`

Without `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, the Login UI shows a configuration notice and Google sign-in cannot complete (we do not fake Google login).

## Features

- **Google Login** — Required before Converter / Translator / Merger / Compressor. Stores Google name, email, picture; time spent; features used; approximate location.
- **Admin** — `/admin` owner dashboard (separate from Google; credentials above).
- **Wipe timer** — Header countdown (3:00) after upload until download.
- **Legal** — Terms & Privacy disclose Google sign-in and analytics.

## Storage note

Usage data is written to `DATA_DIR/usage-store.json`. On Render without a persistent disk, this is **ephemeral** and resets on redeploy.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server (port 43127) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright end-to-end QA (requires `npm run dev`) |

## Deploy (Render)

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_URL=https://convert-my-file-oo3r.onrender.com`, admin vars, and optionally `DATA_DIR` on the service, then deploy.
