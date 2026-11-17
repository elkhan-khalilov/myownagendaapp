# MyAgenda — Agenda · Büdcə · Notlar

An offline-first Progressive Web App for personal agenda, budget and notes. It is optimized for iPhone 13 Pro Max (428×926) and can be installed to the iOS Home Screen. UI language: Azerbaijani.

**Stack:** Next.js 15 (App Router, static export) · React 19 · TypeScript · Tailwind CSS · Dexie.js (IndexedDB) · Zustand · Recharts (lazy-loaded) · Framer Motion · date-fns · Lucide · Vitest · Playwright · ESLint.

---

## 1. Install dependencies

Requires **Node.js 20+** (22 recommended).

```bash
npm install
```

## 2. Run locally

```bash
npm run dev            # http://localhost:3000
```

To test on your iPhone on the same Wi-Fi, open `http://<your-computer-ip>:3000` in Safari. The service worker and "Add to Home Screen" offline mode only work over **HTTPS**, so use the Vercel deployment for the full PWA test.

In development only, Parametrlər → Sinxronizasiya has a **"Demo məlumat yüklə"** button. It is not rendered in production builds, so production always starts empty.

## 3. Build & check

```bash
npm run lint           # ESLint (next/core-web-vitals + typescript)
npm test               # 49 unit/integration tests (Vitest, runs in Asia/Baku timezone)
npm run build          # static export → ./out, then scripts/postbuild.mjs
npm start              # serve ./out on http://localhost:3000
npm run test:e2e       # 6 Playwright tests against ./out (needs a build first)
```

`postbuild` does two things. It injects the hashed asset list and the build version into `out/sw.js` (offline precache and cache versioning). It also adds a strict per-page Content-Security-Policy `<meta>` that allows only the exact inline scripts Next.js emitted, by SHA-256 hash.

Playwright uses its own Chromium by default (`npx playwright install chromium`). To use a system Chrome instead, set `CHROME_PATH=/path/to/chrome`.

## 4. Deploy to Vercel

The repo includes a `vercel.json` with the build command, the `out` output directory, security headers and `sw.js` caching rules.

**Option A, CLI:**

```bash
npm i -g vercel
vercel login
vercel             # first run: link/create the project, accept the detected settings
vercel --prod      # production deployment → https://<project>.vercel.app
```

**Option B, dashboard:** Vercel → *Add New → Project* → import the GitHub repo (see the next section) → *Deploy*. The settings come from `vercel.json`, so nothing needs changing.

HTTPS is automatic on Vercel. There are no hardcoded URLs: everything is same-origin and relative.

**Environment variables:** none are required in v1. See `.env.example`. Never put secrets in `NEXT_PUBLIC_*` variables, because those are bundled into the browser code.

## 5. Connect GitHub

```bash
git init
git add .
git commit -m "MyAgenda v1.1"
git branch -M main
git remote add origin https://github.com/<your-user>/myagenda.git
git push -u origin main
```

Then in Vercel go to *Add New → Project → Import Git Repository* and select `myagenda`. From then on, every push to `main` deploys production, and every other branch or PR gets a preview URL.

## 6. Install the PWA on iPhone

1. Open the **HTTPS** Vercel URL in **Safari** (not Chrome or another in-app browser).
2. Tap **Share** (□↑) → **Add to Home Screen** → **Add**.
3. Launch **MyAgenda** from the Home Screen. It opens in standalone mode, without Safari UI.
4. Use it online once so the app shell is cached. After that it works offline.

The Home Screen app and Safari tabs have **separate storage**, so add your data in the installed app.

**Updates:** after a new deploy, the app downloads the new version in the background and shows *"Yeni versiya hazırdır → Yenilə"*. Your IndexedDB data is never touched by updates. Only the old app-shell cache (`myagenda-*`) is removed.

## 7. Export and restore backups

**Export:** Parametrlər → Sinxronizasiya → *Ehtiyat nüsxə çıxar / paylaş*.

- On iPhone this opens the **iOS Share Sheet**. Choose *Save to Files* (iCloud Drive), AirDrop or Mail.
- Where file sharing isn't supported, the JSON file is downloaded instead.
- The date of the last successful backup is shown in Settings. A reminder appears on the Home screen if there is data and no backup in the last 7 days.

**Restore / import:** Parametrlər → Sinxronizasiya.

- *İdxal et (birləşdir)* (merge): records with the same id are updated, and records with identical content under a different id are skipped as duplicates. A summary (new / updated / duplicates) is shown for confirmation first.
- *Ehtiyat nüsxədən bərpa et* (replace): after confirmation, all current data is replaced with the backup.
- Every file is validated first: format, schema version, required fields, integer amounts and field lengths. The import runs in a single transaction, so either all of it is written or none of it.

Automatic or cloud backup is **not** implemented. An offline PWA cannot write to an external location on its own.

---

## Cloud sync (private GitHub repo + passkeys)

Optional. The app stays fully local-first, and sync adds a copy of the data in a **private** GitHub repo, shared between your devices.

**How it works**
- Vercel serverless functions (`/api/*`) hold the GitHub token. The browser never sees it.
- Data lives in `data.json` in the private data repo. Every sync that changes something is a commit, so the repo history is a full versioned backup.
- Conflicts resolve per record by last-writer-wins (`updatedAt`). Deletions are tombstones, so a record deleted on one device disappears on the others, and undo brings it back everywhere.
- Sign-in uses **passkeys** (WebAuthn: Face ID / Touch ID). The server stores only public keys, in `auth.json`. A one-time **recovery code** (shown once; only its scrypt hash is stored) lets you sign in on a device without a passkey, after which you add one.
- Sessions use HttpOnly, Secure, SameSite=Strict signed cookies valid for 30 days. Every POST is protected against CSRF by an Origin check plus a custom header.
- Sync runs on app start, 2.5 s after edits, when the app returns to the foreground, when the connection comes back, and every 5 minutes.

**Environment variables (Vercel → Settings → Environment Variables)**

| Key | Value |
|---|---|
| `GITHUB_TOKEN` | Fine-grained token: *Only select repositories* → the data repo, *Contents: Read and write* |
| `DATA_REPO` | `owner/repo` of the **private** data repo |
| `SESSION_SECRET` | 32+ random characters (`openssl rand -base64 32`) |
| `DATA_BRANCH` | optional; defaults to the repo's default branch |

Changing a variable takes effect on the next deployment (Vercel → Deployments → ⋯ → Redeploy).

**First-time setup**
1. Open the app → Parametrlər → Sinxronizasiya.
2. Enter the **setup code**. It is derived from `SESSION_SECRET`: `node -e "const h=require('crypto').createHmac('sha256',process.argv[1]).update('myagenda-setup-code').digest('hex').slice(0,12).toUpperCase();console.log(h.match(/.{4}/g).join('-'))" "<SESSION_SECRET>"`
3. Tap *Face ID ilə hesab yarat*, then save the recovery code it shows.
4. On another device: *Face ID ilə daxil ol* (an iCloud Keychain passkey syncs between your Apple devices), or use the recovery code and then *Passkey əlavə et*.

**Notes:** the data in GitHub is plain JSON. GitHub encrypts it at rest and in transit, but anyone with access to the repo can read it, so keep the repo private. Passkeys are bound to the domain, so Vercel *preview* URLs need their own registration. Use the production URL.

## Features

| Area | What works |
|---|---|
| **Əsas** | Greeting with the Azerbaijani date, reminder bell, live summary cards, overdue and backup reminders, today's tasks with completion count, budget ring, next 3 events, pull-to-refresh |
| **Agenda** | Gün/Həftə/Ay, Bu gün/Sabah/Bu həftə quick ranges, today/week completion stats, overdue section with one-tap reschedule, sort by time or priority, status/category filters, search, swipe right to complete and left to move to tomorrow, conflict highlighting, task and meeting CRUD, recurring daily/weekly/monthly items (computed deterministically, never materialized, so never duplicated) |
| **Quick Add (+)** | Task, Meeting, Income, Expense, Note. Fast money entry: amount auto-focused, Enter saves, last category per type remembered, date defaults to today with Bu gün/Dünən/Srağagün chips |
| **Büdcə** | Month selector, Qalıq/Gəlir/Xərc, savings amount and rate, previous-month comparison with trend arrows, remaining daily allowance, largest categories, donut, 6-month bars, monthly goal and per-category limits with 80% warning and overspend alert, transactions CRUD with search and filters |
| **Notlar** | Pinned first, recently edited strip, category and pinned filters, full-text search (all words, any order), sort, swipe right to pin and left to delete, auto-save, word and character count, convert to task |
| **Parametrlər** | Profile, currency, categories, monthly goals, reports, backup/restore, Light/Dark/System theme |
| **UX** | Page fade transitions, bottom sheets lifted above the iOS keyboard (`visualViewport`), touch-friendly date chips with native pickers, in-app confirmation dialog for every destructive action plus undo, loading skeleton, IndexedDB error screen, offline banner, safe areas, no horizontal scroll, haptics where the browser supports them |

## Architecture

```
src/
  app/             routes, template (transitions), error & not-found pages
  features/        screens: home, agenda, finance, notes, settings
  components/      layout (AppShell, DbGate), navigation, cards, charts, forms, ui
  db/              Dexie schema (v1 → v2 migration) + seed
  repositories/    CRUD layer shaped like REST (list/get/create/update/remove)
  services/        pure logic: finance, recurrence/agenda, backup, notes
  hooks/ stores/   live queries, keyboard inset, online status, Zustand UI state
  utils/           money (integer qəpik), dates, haptics, ids
  pwa/             service-worker registration & update flow
public/            manifest, sw.js, offline.html, icons, iOS splash
scripts/           postbuild.mjs (SW precache + CSP hashes)
tests/             Vitest     e2e/   Playwright
```

**Money:** amounts are stored as integer qəpik (`12,50 ₼ → 1250`). Parsing is string-based, so no float multiplication happens, and all arithmetic is integer. Percentages use the largest-remainder method, and the daily allowance is floored.

**Backend readiness:** screens use `repositories/*`, which map 1:1 to REST endpoints. To add FastAPI and PostgreSQL, implement the same interface over `fetch`, keep Dexie as the offline cache and add a sync queue. Records already carry UUIDs and `createdAt`/`updatedAt` timestamps.

## Security

- **CSP:** a per-page `<meta>` with SHA-256 hashes for inline scripts (no `'unsafe-inline'` for scripts), plus HTTP headers from `vercel.json`: `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`. Styles allow inline `style` attributes because React and Framer Motion set them.
- **No raw HTML rendering:** all user text is rendered through React escaping. The only `dangerouslySetInnerHTML` is a static, build-time theme script, and it is lint-guarded.
- **Inputs:** length limits on all fields, string-based money parsing and strict import validation.
- **Logs:** errors log only the operation and error type, never record contents.
- **No secrets, accounts or passwords** are stored anywhere.
- **IndexedDB is not encrypted.** Anyone with access to the unlocked device and browser profile can read it, so rely on the iPhone passcode. There is no Face ID lock: it is not available to PWAs. Real authentication will come with the backend, through secure HTTP-only sessions.

## Testing status

- **Unit/integration (Vitest), 49 passing:** money parsing and formatting, exact sums of 1,000 small amounts, daily allowance, previous-month comparison, savings rate, monthly rollover across a year boundary, timezone handling (Asia/Baku, UTC vs local date keys), overdue logic, conflict detection, priority sort, deterministic recurrence without duplicates, completion stats, CRUD for every entity, undo/restore, persistence after DB reopen, merge-import duplicate detection, idempotent import, replace restore, backup validation, backup reminder, notes word count, full-text search, recently edited, and UI components.
- **E2E (Playwright, production build, Chromium at 428×926), 6 passing:** every screen renders without console errors, CSP violations or horizontal overflow; task create, reload, complete and persist; expense quick entry with Enter, remembered category and exact qəpik total after reload; note auto-save, word count and delete confirmation; offline loading of all screens and data, including the `offline.html` fallback; service worker update offered, applied, data kept and old cache removed.
- **Not tested on a real iPhone or iOS Safari:** no device or simulator was available. Keyboard handling, the Share Sheet, standalone mode and safe areas are implemented to iOS specifications but still need checking on a device.

## Known limitations

- Cloud sync uses a GitHub repo as storage: fine for personal use, but not built for many users or very large data (> a few MB).
- Reminders only fire while the app is open (toast, plus a system notification if permitted). Background push on iOS needs a Home Screen install on iOS 16.4+ and a Web Push backend, which is not part of v1.
- Haptic feedback uses the Vibration API, which iOS Safari does not support. On iPhone it does nothing; on Android it works.
- iOS may evict website storage after long inactivity. The app requests persistent storage, but iOS can still clear it, so regular backups matter.
