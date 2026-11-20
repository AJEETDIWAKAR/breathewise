# BreatheWise – Verification & Test Plan

BreatheWise uses a **multi-layer automated and browser verification strategy** covering pure domain math, Express API integration & security controls, React accessibility/state behavior, and real headless Chromium rendering across 4 viewports.

---

## 1. Test Stack & Commands

| Layer | File(s) | Tooling | Command |
| :--- | :--- | :--- | :--- |
| **Type Safety** | Entire repo (`tsconfig.json`) | TypeScript 7.0 (`tsc --noEmit`) | `npm run lint` |
| **Pure Domain Logic (16 tests)** | `src/domain/domain.test.ts` | Vitest 5.1 | `npm test` |
| **Backend API & Security (16 tests)** | `server/server.test.ts` | Vitest + `fetch` fixtures + Express | `npm test` |
| **UI Integration & A11y (6 tests)** | `src/components/App.test.tsx` | Vitest + React Testing Library + `jsdom` | `npm test` |
| **Production Bundle** | `vite.config.ts` | Vite 8.3 (Rolldown) | `npm run build` |
| **Browser Verification** | Live app at `http://localhost:3000` | `playwright-cli` (Headless Chromium) | `playwright-cli` |

---

## 2. Automated Test Coverage (38 / 38 Passing)

### A. Domain Logic (`src/domain/domain.test.ts` — 16 tests)
- **US EPA AQI & CPCB NAQI Math:** Verifies exact breakpoints, worst-pollutant sub-index aggregation, and rejection of fabricated zero substitutions for missing pollutants.
- **Personalized Planner Rules (`plannerRules.ts`):** Verifies time-slot classification (`Severe Pollution Day`, `Moderate`, `Better Air-Quality Period`, `missing_data`), asthma/child sensitivity protections, timezone-safe `hourLabel` parsing, and budget constraints.
- **Indoor Air & CADR (`indoorRules.ts`):** Verifies 5 ACH CADR room sizing (`Math.round((areaSqFt * 9 * 5) / 60 * 1.699)` m³/hr), ventilation windows, low-budget wet-mopping & MERV-13 DIY alternatives, and cooking fuel differentiation (`INDUCTION` vs `BIOMASS_SOLID` vs `LPG`).
- **Sustainable Alternatives & Impact Math (`sustainableRules.ts`, `impactCalculator.ts`):** Verifies `petrol_car -> metro_rail` (140 vs 35 g CO₂e/pkm, 14 km/L) and ensures `exposure_protection` logs strictly record `0 g CO₂e` and `0 L` fuel displaced.

### B. Server, AirLive, Security & Gemini (`server/server.test.ts` — 16 tests)
- **AirLive Integration & Schema Integrity:** Tests `/api/air-quality/places`, `/current`, `/ranking`, `/history`, `/search`, and `/recommendations`; preserves `null` for missing trace gases without fabricating zeros.
- **Error Handling & Resilience:** Upstream AirLive `503` returns structured `503 AQI_PROVIDER_UNAVAILABLE`; invalid slug/XSS patterns return `400 VALIDATION_ERROR`; unknown locations return `404`.
- **Staleness Flagging:** Readings older than 3 hours set `isStale: true`.
- **Gemini Grounding & Security:** Verifies server-side `GEMINI_API_KEY` isolation, household PII minimization, prompt-delimiter sanitization, `javascript:`/`data:` link stripping, source citation enforcement, and clean fallback (`rule_based_fallback`) on missing key, timeout, malformed JSON, or `429` quota exhaustion.

### C. Frontend Integration (`src/components/App.test.tsx` — 6 tests)
- Renders live AirLive US AQI, PM2.5, station count, freshness badge, clickable AirLive attribution, and live/preview mode switching in Settings.
- Navigates all 9 pages cleanly, validates empty/overlong AI Assistant questions, and renders Gemini + fallback structured responses.
- Completes Modules A–D end-to-end: Family profile edits (`localStorage`), Daily Planner, Indoor CADR/budget checks, Sustainable choice logging, Environmental Impact add/edit/remove & methodology modal.
- Verifies offline preview fallback, provider `503` recovery, manual coordinate lookup, personal profile deletion (`clearPersonalData`), and resilient recovery from corrupted `localStorage`.

---

## 3. Browser E2E & Multi-Viewport Verification (`playwright-cli`)

Verified against live Express + Vite dev server (`http://localhost:3000`):
- **4-Viewport Zero Horizontal Overflow (`scrollWidth <= innerWidth`):**
  - Desktop (`1440×900`): `scrollWidth: 1440`, `overflow: false`
  - Laptop (`1280×800`): `scrollWidth: 1280`, `overflow: false`
  - Tablet (`768×1024`): `scrollWidth: 768`, `overflow: false`
  - Mobile (`390×844`): `scrollWidth: 390`, `overflow: false`
- **Console Audit:** `playwright-cli console error` confirmed **0 console errors** and **0 warnings**.
- **Accessibility Checks:** Skip link (`#main-content`), modal focus trapping and restoration on `Escape`, keyboard-navigable hourly SVG chart points, and toggleable 24-row semantic `<table>` view verified in headless Chromium.
