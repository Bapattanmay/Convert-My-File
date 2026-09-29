# Convert My File

Secure, ephemeral file workspace for convert, translate, merge, and exact-size compress/expand — with **Google Login**-gated tools, usage analytics, and an allowlisted Google **Admin panel**.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Auth.js (NextAuth v5) Google OAuth
- Analytics JSON store (visitors / sessions / feature_events / admin_audit)

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
| `DATA_DIR` | Analytics JSON directory |
| `MYMEMORY_EMAIL` | Optional — raises MyMemory free-tier quota for Translator |
| `GOOGLE_TRANSLATE_API_KEY` | Optional — use Google Cloud Translation instead of MyMemory |

### Translator

Client extracts text from Word/PDF/Excel, then `POST /api/translate` calls **MyMemory** (no key) or **Google Cloud Translation** when `GOOGLE_TRANSLATE_API_KEY` is set. Free MyMemory limits apply (~500 chars/chunk, daily quota); long docs are truncated for preview. Preview and download are real target-language text (e.g. Devanagari for Hindi), not English stubs.

### Admin access

1. Sign in on the site with Google using an email in `ADMIN_EMAILS`.
2. Open `/admin`.
3. Anyone else (including signed-in non-allowlisted users) receives **404**.

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
