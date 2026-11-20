# BreatheWise – Engineering Remediation Backlog & Roadmap

**Baseline Audit Score:** **77.3 / 100** (Code Quality: `81`, Security: `77`, Efficiency: `71`, Testing: `76`, Accessibility: `74`, Problem Statement Alignment: `85`)  
**Target:** `>= 98.5 / 100` verified internal engineering quality across all six parameters through real architectural, security, performance, accessibility, testing, and alignment fixes.

---

## 1. Gap Analysis Summary

A full repository re-inspection (`src/`, `server/`, `vite.config.ts`, `package.json`, live `http://localhost:3000`, and headless Chromium DOM/ARIA inspection) identified verified gaps across all six parameters:

1. **Data Minimization Bypass (`server/services/aiAdvisorFallback.ts:36,49`)**: `classifyQuestionTopics` matched `"today"` in `isRoutine`, setting `broadQuestion = true` for queries like `"Is it safe to jog outside today?"` and transmitting all 10 lifestyle/home/commute fields instead of only outdoor habit context.
2. **Gemini Latency Bottleneck (`server/services/geminiService.ts`)**: Live `POST /api/ai/chat` measured `31.04s` against a `35s` timeout (`<4s` margin), risking frequent `TIMEOUT` fallbacks under normal API jitter.
3. **Logger Redaction & Security Headers (`server/utils/logger.ts`, `server/providers/airliveProvider.ts`, `server/middleware/security.ts`, `server/middleware/rateLimiter.ts`)**: Logger regex scrubbed `key=...` query params but missed raw `AIza...` keys and `Bearer` tokens; upstream 503 errors forwarded `err.message`; `Content-Security-Policy` and standard `RateLimit-*` headers were missing; `npm audit` aborted (`ENOLOCK` without `package-lock.json`).
4. **Client Bundle Bloat & Missing Compression (`dist/assets/`, `src/types/breathewise.ts`, `server/app.ts`)**: `zod` added **166 KB** to the browser bundle purely for client form/`localStorage` validation; `dist/assets/` totaled **1.2 MB**; Express lacked HTTP compression (`gzip`/`br`); client city switching repeated API fetches without short-lived memory caching.
5. **WCAG 2.2 AA Accessibility Failures (`LocationSelector.tsx`, `HourlyTrendChart.tsx`, `PlannerPage.tsx`, `SustainablePage.tsx`, `ImpactPage.tsx`, `AppShell.tsx`, `RecommendationPanel.tsx`)**:
   - Four interactive button groups measured `< 24×24px` (`14×14px` search clear button; `16px`-tall `"Show data table"`, `"Mark routine block done"`, `"View impact tracker"` buttons).
   - `<svg role="img">` masked interactive `<circle role="button" tabIndex={0}>` elements in `HourlyTrendChart`.
   - `LocationSelector` dialog and `AppShell` notifications popover failed to restore trigger focus / trap `Tab` cleanly.
6. **Testing & Coverage Blind Spots (`server.test.ts`, `App.test.tsx`, `vitest.config.ts`)**: No coverage measurement tool (`@vitest/coverage-v8`); zero tests for `rateLimiter` (`429`), client `AbortController` `TIMEOUT`, raw `AIza`/`Bearer` redaction, or automated browser regression E2E scripts.
7. **Challenge 6 Community & Code Hygiene (`AirQualityPage.tsx`, `PlannerPage.tsx`, `normalizeReading.ts`, `airliveProvider.ts`, `airQualityValidators.ts`)**: Missing cleanest-city ranking toggle (despite backend `order=best` support) and shareable household/community advisory export; dead functions (`buildNormalizedAirQuality`, `fetchCurrent`, `openMeteoGeocodingSchema`) remained in production modules.

---

## 2. Prioritized Remediation Backlog

| ID | Priority | Parameter(s) | Affected Files | Difficulty | Dependencies | Planned Fix & Verification |
| :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| **REM-01** | **Critical** | Security, Alignment | `server/services/aiAdvisorFallback.ts` | Low | None | Fix `classifyQuestionTopics` so `"today"` no longer triggers `broadQuestion`; verify `minimizedFields` in `server.test.ts`. |
| **REM-02** | **Critical** | Efficiency, Alignment | `server/services/geminiService.ts`, `server/services/aiAdvisorFallback.ts`, `server/utils/cache.ts` | Medium | `REM-01` | Optimize prompt/schema size, verify `@google/genai` `ThinkingLevel.LOW` behavior, add safe normalized AI response caching (respecting AQI reading timestamp & conversation state), and measure before/after live latency. |
| **REM-03** | **High** | Security | `server/utils/logger.ts`, `server/providers/airliveProvider.ts`, `server/middleware/security.ts`, `server/middleware/rateLimiter.ts`, `package-lock.json` | Medium | None | Redact `AIza...` / `Bearer` / tokens in logger; sanitize upstream 503 messages; add `Content-Security-Policy` + `RateLimit-*` headers; generate `package-lock.json` & run `npm audit` + `bun audit`. |
| **REM-04** | **High** | Accessibility | `LocationSelector.tsx`, `HourlyTrendChart.tsx`, `PlannerPage.tsx`, `SustainablePage.tsx`, `ImpactPage.tsx`, `AppShell.tsx`, `RecommendationPanel.tsx` | Medium | None | Enforce `>=24×24px` target sizes on all standalone buttons; fix SVG chart ARIA role (`group` instead of `img`); trap `Tab` & restore trigger focus in dialogs/popovers; raise muted contrast to `slate-600+`. |
| **REM-05** | **High** | Efficiency | `src/types/breathewise.ts`, `server/validators/breathewiseSchemas.ts`, `src/state/AppStateContext.tsx`, `src/components/pages/FamilyPage.tsx`, `src/components/pages/ImpactPage.tsx`, `server/app.ts`, `vite.config.ts` | Medium | Package install (`compression`) | Move Zod schemas to `server/validators/`; replace browser validation with lightweight TS validators (eliminating `166 KB` `zod` client chunk); add Express `compression`; add client reading cache & fix `ImpactPage` effect. |
| **REM-06** | **Medium** | Testing | `vitest.config.ts`, `server/server.test.ts`, `src/components/App.test.tsx`, `src/domain/domain.test.ts`, `package.json` | Medium | `@vitest/coverage-v8`, `REM-01..05` | Run real V8 coverage; add security, rate-limit `429`, client `TIMEOUT`, data-minimization, `sanitizeHttpUrl`, and `compression` tests plus repeatable headless browser verification. |
| **REM-07** | **Medium** | Alignment | `src/components/pages/AirQualityPage.tsx`, `src/components/pages/PlannerPage.tsx`, `src/state/AppStateContext.tsx` | Low | None | Expose Worst-10 vs. Cleanest-10 city toggle via existing `/api/air-quality/ranking` `order=best|worst`; add copyable Community/Household Advisory summary with timestamp, AQI standard, and provenance. |
| **REM-08** | **Low** | Code Quality | `server/utils/normalizeReading.ts`, `server/providers/airliveProvider.ts`, `server/providers/types.ts`, `server/validators/airQualityValidators.ts`, `docs/QUALITY_REPORT.md` | Low | `REM-01..07` | Remove dead unused functions (`buildNormalizedAirQuality`, `fetchCurrent`, `openMeteoGeocodingSchema`), update documentation with verified final metrics. |

---

## 3. Execution Sprints & Verified Outcomes

- **Sprint 1 — Security & Data Minimization Hardening (`REM-01`, `REM-03`):** **Completed.**
  - Fixed `classifyQuestionTopics()` (`server/services/aiAdvisorFallback.ts`) so `"today"` no longer sets `broadQuestion = true`; outdoor safety queries transmit only `members`, `sensitivities`, `outdoorActivity`, and `outdoorExerciseTime`.
  - Extended `redactSensitiveText()` (`server/utils/logger.ts`) to scrub `AIza...` API keys, `Bearer` tokens, and quoted/unquoted secret headers (`x-goog-api-key`, `authorization`, `apiKey`); sanitized upstream 503 messages in `airliveProvider.ts`.
  - Added strict `Content-Security-Policy` headers + cross-origin non-GET/HEAD `403 CORS_ORIGIN_FORBIDDEN` guard (`server/middleware/security.ts`), standard `RateLimit-*` + `Retry-After` headers (`server/middleware/rateLimiter.ts`), and `healthRateLimit` on `/api/health`.
  - Verified `bun audit`: **0 vulnerabilities across 337 packages**.
- **Sprint 2 — Efficiency, Bundle Reduction & AI Latency Optimization (`REM-02`, `REM-05`, `REM-08`):** **Completed.**
  - Replaced `zod` in browser validation (`src/types/breathewise.ts`, `src/components/pages/FamilyPage.tsx`) with zero-dependency TypeScript validators and moved server Zod schemas to `server/validators/breathewiseSchemas.ts`, eliminating the `85.46 kB` (`24.34 kB` gzip) `zod` browser chunk (`dist/assets/` reduced from `~1.2 MB` to `740K` total).
  - Enabled Express `compression()` gzip responses (`server/app.ts`), added 5-minute client reading LRU cache (`AppStateContext.tsx`), and guarded `ImpactPage.tsx` `distanceKm` against overwriting user input.
  - Switched live Gemini synthesis to `gemini-3.1-flash-lite` (`ThinkingLevel.MINIMAL`), removed redundant provenance tokens from `GEMINI_STRUCTURED_RESPONSE_SCHEMA` (injected server-side from verified AirLive telemetry), reused a singleton `GoogleGenAI` client, and added a 5-minute single-turn AI response cache + in-flight deduplication (`geminiService.ts`): cold live Gemini latency dropped from **31.04s** (and >35s timeouts) to **4.61s**, and repeat cache hits respond in **5.9ms**.
  - Removed dead unused code (`buildNormalizedAirQuality`, `fetchCurrent`, `openMeteoGeocodingSchema`, unused imports).
- **Sprint 3 — WCAG 2.2 AA Accessibility & Challenge 6 Community Features (`REM-04`, `REM-07`):** **Completed.**
  - Upgraded all standalone buttons/links (`LocationSelector`, `HourlyTrendChart`, `PlannerPage`, `SustainablePage`, `ImpactPage`, `AqiIndicator`) to `>= 24×24px`; replaced `<svg role="img">` with `role="group"` in `HourlyTrendChart`; added focus trapping + Escape trigger restoration in `LocationSelector` and `AppShell`; raised muted metadata text to `slate-600+`.
  - Added **Worst-10 vs. Cleanest Cities** India ranking toggle (`AirQualityPage.tsx`) and **Copy community advisory** plain-text bulletin export (`PlannerPage.tsx`).
- **Sprint 4 — Testing Expansion, Coverage Measurement & Final Live Verification (`REM-06`):** **Completed.**
  - Added V8 coverage via `@vitest/coverage-v8` (`vitest.config.ts`) and expanded automated tests to **43 / 43 passing** (`domain.test.ts` 16, `server.test.ts` 17, `App.test.tsx` 10; **79.15% lines / 77.40% statements / 72.81% functions / 64.44% branches**).
  - Verified live dev server (`http://localhost:3000`) via `curl` and headless Chromium (`playwright-cli`) across Desktop (`1440×900`), Tablet (`768×1024`), and Mobile (`390×844`) with **0 console errors, 0 horizontal overflow, and 0 visible standalone targets `<24px`**.

