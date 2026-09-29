# Convert My File

Secure, ephemeral file workspace for convert, translate, merge, and exact-size compress/expand — with **Google Login**-gated tools, usage analytics, and an allowlisted Google **Admin panel**.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Auth.js (NextAuth v5) Google OAuth
- Durable admin analytics (Postgres JSONB when `DATABASE_URL` is set; JSON file fallback under `DATA_DIR`)

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

### Environment

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | User Google Login |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Auth.js signing |
| `NEXTAUTH_URL` / `AUTH_URL` | Canonical URL |
| `ADMIN_EMAILS` | Comma-separated Google emails allowed at `/admin` (default includes `bapattanmay@gmail.com`) |
| `DATA_DIR` | Analytics JSON directory (file fallback / mirror) |
| `DATABASE_URL` | **Preferred** Postgres URL for durable admin analytics (survives web redeploys) |
| `DATABASE_SSL` | Set `0` to disable TLS (default: TLS on) |
| `MYMEMORY_EMAIL` | Optional — raises MyMemory free-tier quota for Translator |
| `GOOGLE_TRANSLATE_API_KEY` | Optional — use Google Cloud Translation instead of MyMemory |

### Admin analytics persistence

Visitor/session/feature/audit data is stored as JSONB in Postgres when `DATABASE_URL` is set. Boot **never** drops existing rows — it only `CREATE TABLE IF NOT EXISTS` and upserts. If Postgres is empty but a local `analytics-store.json` exists, that file is migrated once into Postgres.

On Render **free** web services, local disk is ephemeral and persistent disks are unavailable. Use a Render Postgres database and set `DATABASE_URL` to the **internal** connection string. Paid web plans can also attach a disk at `DATA_DIR`.

Free Render Postgres instances expire ~30 days after creation — upgrade the DB plan before expiry for long-term retention.

### Translator

Client extracts text from Word/PDF/Excel, then `POST /api/translate` calls **MyMemory** (no key) or **Google Cloud Translation** when `GOOGLE_TRANSLATE_API_KEY` is set. Free MyMemory limits apply (~500 chars/chunk, daily quota); long docs are truncated for preview. Preview and download are real target-language text (e.g. Devanagari for Hindi), not English stubs.

### Admin access

1. Open `/admin` — if signed out, use **Sign in with Google** on that page (callback returns to `/admin`).
2. Only Google emails in `ADMIN_EMAILS` (default `bapattanmay@gmail.com`) see the dashboard.
3. Signed-in non-allowlisted users receive **404**.

Password admin login has been removed.

### Google redirect URIs

- `https://convert-my-file-oo3r.onrender.com/api/auth/callback/google`
- `http://127.0.0.1:43127/api/auth/callback/google`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (port 43127) |
| `npm run build` / `start` | Production |
| `npm test` | Admin metrics unit tests |
| `npm run test:e2e` | Playwright QA |

## Deploy (Render)

Set Google OAuth secrets, `ADMIN_EMAILS=bapattanmay@gmail.com`, Auth.js URL/secrets, then deploy.
