# BreatheWise – Security & Privacy Architecture Plan

## 1. Threat Model & Core Principles

BreatheWise handles sensitive health-adjacent household preferences (respiratory vulnerabilities, children/seniors in household, city location) and integrates external paid/rate-limited APIs (Google Gemini, OpenAQ, CPCB, WAQI).

### Security Objectives
1. **Zero Secret Exposure:** API keys never enter Vite client bundles (`VITE_*` variables are strictly forbidden for secrets).
2. **Input & Output Validation:** Untrusted user inputs and untrusted third-party API payloads are validated with Zod before use.
3. **Abuse & Quota Protection:** Express endpoints enforce per-IP rate limits, payload size caps, and prompt-length bounds.
4. **Data Minimization:** Family profiles stay local in the user's browser by default; server-side AI requests send only anonymous household composition flags (no names, emails, or street addresses).

---

## 2. API Key & Secret Management

| Secret Variable | Scope | Usage |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Server-only (`process.env`) | `@google/genai` SDK on `/api/ai/*` |
| `OPENAQ_API_KEY` | Server-only (`process.env`) | `X-API-Key` header in `openaqAdapter.ts` |
| `CPCB_DATA_GOV_KEY` | Server-only (`process.env`) | `api-key` param in `cpcbAdapter.ts` |
| `WAQI_API_TOKEN` | Server-only (`process.env`) | `token` param in `waqiAdapter.ts` |

- `.gitignore` blocks `.env*` while keeping `.env.example` (containing empty/placeholder keys only).
- Server startup validates environment config without logging secret values.
- Error handlers explicitly strip URL query parameters (`?api-key=...`, `?token=...`) before logging or returning error metadata.

---

## 3. Input Validation & Prompt Injection Defense

### Express Boundary Hardening
- `express.json({ limit: '32kb' })` prevents oversized request DoS.
- Zod schemas enforce numeric ranges (`lat: -90..90`, `lon: -180..180`, `dailyCommuteKm: 0..200`), strict enums (`CommuteMode`, `BudgetTier`), and max string lengths (`question <= 500 chars`, `history <= 10 turns`).

### Gemini Prompt Isolation
- User-supplied text (`question`) is passed cleanly as user message content, **never concatenated into `systemInstruction`**.
- `systemInstruction` explicitly constrains Gemini:
  - Rely only on verified `aqiContext` JSON supplied by the server.
  - Refuse to invent live AQI figures or clinical diagnoses.
  - Maintain strict distinction between exposure reduction and emissions avoided.
- Structured responses (`/api/ai/daily-plan`) use `responseSchema` + server-side Zod parsing before returning to the frontend.
- Frontend renders AI text safely via React text nodes or sanitized Markdown formatting—never via `dangerouslySetInnerHTML`.

---

## 4. Network, Transport & Browser Security

- **Security Headers:** Express sets `X-Content-Type-Options: nosniff`, `X-Frame-Options` (compatible with AI Studio preview iframe policy where applicable, using CSP `frame-ancestors` safely), `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
- **CORS:** Restricted to same-origin / configured `APP_URL` in production.
- **External Fetch Safety:** All upstream provider calls (`fetch`) enforce `AbortSignal.timeout(8000)` to prevent hung sockets or slowloris-style upstream stalls, and validate HTTP status + JSON schema before caching.
- **Offline & LocalStorage Hygiene:** Client-side `localStorage` data is parsed defensively inside `try/catch` + Zod `.safeParse()`; corrupted storage resets cleanly without crashing React.

---

## 5. Dependency & Repository Hygiene

- Run `npm audit` periodically; avoid bloated or unmaintained packages.
- Keep repository (excluding `node_modules` and `dist`) strictly under **10 MB** per hackathon rules.
- Never include hardcoded credentials, mock tokens, or personal data in git history.
