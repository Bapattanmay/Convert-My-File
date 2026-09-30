# Convert My File

Secure, ephemeral file workspace for convert, translate, merge, and target-size compress/expand. **Your files stay on your device** — we don't build a document archive. Free tools work without login; Premium requires Google Login and a server entitlement.

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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Login (Premium / admin) |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Auth.js signing — **required in production** (fail-closed) |
| `SESSION_SECRET` | Session JWT signing — **required in production** (may share AUTH_SECRET) |
| `NEXTAUTH_URL` / `AUTH_URL` | Canonical URL |
| `ADMIN_EMAILS` | Comma-separated Google emails for `/admin` — **required in production** |
| `PREMIUM_EMAILS` | Comma-separated Google emails with Premium desk entitlement (server allowlist only) |
| `DATA_DIR` | Analytics JSON directory (file fallback / mirror) |
| `DATABASE_URL` | **Preferred** Postgres URL for durable admin analytics |
| `DATABASE_SSL` | Set `0` to disable TLS (default: TLS on) |
| `MYMEMORY_EMAIL` | Optional — raises MyMemory free-tier quota for Translator |
| `GOOGLE_TRANSLATE_API_KEY` | Optional — use Google Cloud Translation instead of MyMemory |

Legacy `ADMIN_USERNAME` / `ADMIN_PASSWORD` are removed. Production refuses to start (or denies admin) if Auth/Admin secrets are missing.

### Free vs Premium

| Area | Login |
| --- | --- |
| Converter, Translator, Merger, Compressor | **No login** |
| Premium desk | Google Login + `PREMIUM_EMAILS` allowlist |
| Admin `/admin` | Google Login + `ADMIN_EMAILS` |

Paid Premium checkout is **coming soon** (India next step: **Razorpay** or **Cashfree** + webhook → server entitlement). There is no mock cookie/localStorage unlock and no commercial claim of paid Premium without payment.

### Compressor UX

Target file size — get as close as possible to your requested KB/MB while preserving quality. Prefer ≤ target when compressing. Images use iterative quality/resolution; PDFs use rewrite optimization; media is best-effort until server FFmpeg. Copy never promises an exact byte size unless the output truly matches.

### Admin analytics persistence

Visitor/session/feature/audit data is stored as JSONB in Postgres when `DATABASE_URL` is set. Boot **never** drops existing rows — it only `CREATE TABLE IF NOT EXISTS` and upserts. If Postgres is empty but a local `analytics-store.json` exists, that file is migrated once into Postgres.

On Render **free** web services, local disk is ephemeral. Use a Render Postgres database and set `DATABASE_URL` to the **internal** connection string.

### Translator

Client extracts text from Word/PDF/Excel, then `POST /api/translate` calls **MyMemory** (no key) or **Google Cloud Translation** when `GOOGLE_TRANSLATE_API_KEY` is set. Free path works without Google Login.

### Admin access

1. Open `/admin` — Sign in with Google (callback returns to `/admin`).
2. Only Google emails in `ADMIN_EMAILS` see the dashboard.
3. Signed-in non-allowlisted users receive **404**.

### Google redirect URIs

- `https://convert-my-file-oo3r.onrender.com/api/auth/callback/google`
- `http://127.0.0.1:43127/api/auth/callback/google`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (port 43127) |
| `npm run build` / `start` | Production |
| `npm test` | Unit tests |
| `npm run test:e2e` | Playwright QA |

## Deploy (Render)

Set Google OAuth secrets, `ADMIN_EMAILS`, `AUTH_SECRET` / `SESSION_SECRET`, `PREMIUM_EMAILS`, then deploy. Missing Auth/Admin secrets fail closed in production.
