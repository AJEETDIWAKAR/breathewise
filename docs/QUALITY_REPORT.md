# BreatheWise – Independent QA, Security & Polish Report

**Audit & Verification Date:** 2026-11-20  
**Scope:** Full-stack remediation, security hardening, latency & bundle optimization, WCAG 2.2 AA accessibility verification, and headless Chromium validation of **BreatheWise – Urban Air Quality Assistant**.

---

## Executive Summary

BreatheWise is a React 19 + TypeScript + Express climate-health web application integrating live **AirLive** telemetry (`airlive.tracsa.co.in`, zero API key), modeled diurnal PM2.5 curves (**Open-Meteo / Copernicus CAMS**), deterministic household planning/indoor/sustainability rules, and server-side **Google Gemini (`gemini-3.1-flash-lite`)** advisory generation with structured rule-based fallback.

| Criterion | Verified Status | Evidence |
| :--- | :--- | :--- |
| **1. Code Quality** | **Pass** | Modular client/server/domain separation, zero-error `tsc --noEmit`, native Node `.ts` ESM imports, dead code removed (`buildNormalizedAirQuality`, `fetchCurrent`, `openMeteoGeocodingSchema`), server Zod schemas isolated from browser types. |
| **2. Security** | **Pass** | Server-only `GEMINI_API_KEY`, topic-scoped data minimization, `sanitizeHttpUrl` allowlist, untrusted prompt delimiters, `Content-Security-Policy` + `ALLOWED_ORIGINS` CORS enforcement (`403` on cross-origin POST), `RateLimit-*` + `Retry-After` headers, logger secret redaction (`AIza...`, `Bearer`, headers, query params), sanitized 503 errors, `bun audit` **0 vulnerabilities (337 packages)**. |
| **3. Efficiency** | **Pass** | Zero-Zod browser build (`dist/assets/` **740K** total, `index-*.js` **98.00 kB** / `24.56 kB` gzip), Express `compression` gzip API payloads, 5m client LRU reading cache, live Gemini cold response improved from **31.04s -> 4.61s** (**5.9ms** cached single-turn hit). |
| **4. Testing** | **Pass** | **43 / 43** automated Vitest tests passed (`domain.test.ts` 16, `server.test.ts` 17, `App.test.tsx` 10), V8 coverage (**79.15% lines, 77.40% statements, 72.81% functions, 64.44% branches**), live API + headless Chromium verification. |
| **5. Accessibility & Responsive UX** | **Pass** | Skip link (`#main-content`), modal/popover focus traps & Escape trigger restoration (`Modal`, `LocationSelector`, `AppShell`), `role="group"` accessible chart points + toggleable `<table>`, `>=24×24px` visible buttons/links across audited pages, AA contrast tokens, zero horizontal overflow across `1440×900`, `768×1024`, and `390×844` with **0 console errors**. |
| **6. Privacy & Data Credibility** | **Pass** | Optional click-triggered browser geolocation, manual coordinate entry, one-click personal data deletion (`Clear personal profile & history`), explicit US EPA AQI vs. NAQI labeling, >3h staleness flagging, zero fabrication of missing trace gases, Worst/Cleanest India city toggle, and copyable community advisory. |

---

## 1. Key Defects Resolved Across Remediation Sprints

### Security & Privacy Hardening
- **Topic-Scoped Data Minimization:** Fixed `classifyQuestionTopics()` (`server/services/aiAdvisorFallback.ts`) so `"today"` no longer triggers `broadQuestion`; outdoor safety queries omit `cookingFuel`, `hasAirPurifier`, `roomAreaSqFt`, `budgetTier`, and `primaryCommute`.
- **Logger, Upstream Errors & CSP:** Extended `redactSensitiveText()` (`server/utils/logger.ts`) for Google API keys (`AIza...`), `Bearer` tokens, and secret headers; sanitized AirLive 503 error messages; added `Content-Security-Policy` headers, cross-origin non-GET/HEAD `403` rejection, and standard `RateLimit-*` / `Retry-After` headers.

### Efficiency, Bundle & AI Latency Optimization
- **Zero-Zod Client Build:** Moved server Zod schemas to `server/validators/breathewiseSchemas.ts` and replaced browser-side Zod with zero-dependency TypeScript validators in `src/types/breathewise.ts`, removing the `85.46 kB` client `zod` chunk.
- **Live Gemini Latency (`31.04s -> 4.61s`):** Switched to `gemini-3.1-flash-lite` (`ThinkingLevel.MINIMAL`), stripped redundant provenance fields from `GEMINI_STRUCTURED_RESPONSE_SCHEMA` (injected server-side from verified AirLive data), reused a singleton `GoogleGenAI` client, and added 5-minute single-turn AI response caching + in-flight deduplication (**5.9ms** warm cache hit).
- **Compression & Client Caching:** Added Express `compression()` gzip middleware and a 5-minute client reading LRU cache in `AppStateContext.tsx`.

### WCAG 2.2 AA & Challenge 6 Alignment
- **Target Sizes & ARIA:** Verified `>=24×24px` hit areas on interactive buttons/links (`LocationSelector`, `HourlyTrendChart`, `PlannerPage`, `SustainablePage`, `ImpactPage`, `AqiIndicator`), fixed `<svg role="group">` in `HourlyTrendChart`, added Escape focus restoration (`LocationSelector`, `AppShell`), and upgraded muted text contrast (`text-slate-600`).
- **Community & City Exploration:** Added **Most Polluted vs. Cleanest Cities** sorting (`AirQualityPage.tsx`) and **Copy community advisory** plain-text bulletin export (`PlannerPage.tsx`).

---

## 2. Production Build Metrics (`npm run build`, Vite v8.3.8)

| Asset / Chunk | Raw Size | Gzip Size | Role |
| :--- | :--- | :--- | :--- |
| `dist/assets/index-*.js` | **98.00 kB** | **24.56 kB** | Main app bootstrap & Overview page (no `zod` bundle) |
| `dist/assets/react-*.js` | 425.65 kB | 129.51 kB | Cached React 19 vendor chunk |
| `dist/assets/Card-*.js` | 30.94 kB | 10.47 kB | Shared UI primitives |
| `dist/assets/index-*.css` | 35.49 kB | 7.51 kB | Tailwind CSS v4 styles |
| 8 Lazy Route Chunks (`Indoor`, `Impact`, `Assistant`, `Sustainable`, `AirQuality`, `Planner`, `Family`, `Settings`) | `10.82 – 28.83 kB` | `3.13 – 8.80 kB` | On-demand per-route bundles |

Total `dist/assets/` directory footprint: **740K** (built in `647ms` with zero warnings).

---

## 3. Live & Automated Verification Evidence

- **Automated Suites (`npx vitest run --coverage`):** **43 / 43 passed** (`domain.test.ts` 16, `server.test.ts` 17, `App.test.tsx` 10).
- **V8 Code Coverage:** **79.15%** lines (`1830/2312`), **77.40%** statements (`1925/2487`), **72.81%** functions (`399/548`), **64.44%** branches (`1468/2278`). Core domain (`src/domain`): `88.6%` statements; server routes & validators: `100%` statements.
- **Type Check (`npm run lint` / `tsc --noEmit`):** **0 errors**.
- **Dependency Audit (`bun audit`):** **0 vulnerabilities** across 337 packages.
- **Live Server & Browser Checks (`http://localhost:3000`):**
  - `POST /api/ai/chat` (cold live `gemini-3.1-flash-lite`): **4.61s**, `responseSource: "gemini"`, `minimizedFields: ["members", "sensitivities", "outdoorActivity", "outdoorExerciseTime"]`; repeat query cache hit: **5.9ms**.
  - Headless Chromium (`playwright-cli`) across `1440×900`, `768×1024`, `390×844`: **0 horizontal overflow**, **0 console errors**, live `Gemini (gemini-3.1-flash-lite)` answer rendered, and **0 visible buttons/links `<24px`**.

---

## 4. Known Limitations

1. **Public Cloud Deployment & `npm audit` Lockfile:** Container uses `bun.lock` (`bun audit` clean, 0 vulnerabilities) without a `package-lock.json` for `npm audit`. Public Cloud Run / production domain deployment verification must be executed once hosted outside the authenticated AI Studio preview gateway.
2. **Browser-Local Persistence:** Profiles and impact logs reside in `localStorage` per browser without cross-device cloud sync.
3. **Upstream Pollutant Coverage:** AirLive feeds primarily report US AQI and PM2.5; missing gases (`PM10`, `NO2`, `O3`, `SO2`, `CO`) remain transparently marked `Unavailable`.
4. **UI Component Test Coverage:** Overall V8 coverage stands at `79.15% lines / 77.40% statements` because some interactive modals/drawer branches in `AppShell.tsx` (`36%`) and `Modal.tsx` (`51%`) were verified via `playwright-cli` rather than full unit branch exhaustion.

