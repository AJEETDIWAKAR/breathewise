# BreatheWise – Technical Architecture

## 1. High-Level System Architecture

BreatheWise uses a **modular full-stack TypeScript architecture** combining a **React 19 + Vite 8 + Tailwind CSS v4** frontend with an **Express.js** Backend-for-Frontend (BFF) server (`server.ts` / `server/app.ts`) that runs natively on **Node.js v22+**.

### Core Architectural Principles
1. **Zero-Key Live Telemetry + Server-Side Secret Isolation:** Primary live air quality data comes from **AirLive** (`https://airlive.tracsa.co.in/`) with **zero AQI API keys required**. The only optional credential is `GEMINI_API_KEY`, which stays strictly server-side (`server/config/env.ts`) and is never bundled into `dist/` or exposed to client code.
2. **Honest Scale & Measurement Attribution:**
   - **AirLive** supplies live **US EPA AQI (0–500)** and **PM2.5 (µg/m³)** aggregated across ground stations or explicitly labeled model baselines (`source`, `stationsUsed`, `modelUsAqi`, `updated`).
   - **Open-Meteo Air Quality API** (Copernicus **CAMS Global**, CC BY 4.0) supplies hourly modeled PM2.5/PM10/NO₂/O₃ diurnal curves strictly for trend visualization and ventilation-window hints—never disguised as live ground-station readings.
   - Missing pollutants remain explicitly `Not reported` (`null`) and are **never zeroed out**.
3. **Deterministic Core + Grounded Gemini Synthesis:** Health risk bands (`src/domain/usAqi.ts`, `src/domain/naqi.ts`), daily household schedules (`src/domain/plannerRules.ts`), CADR/ventilation math (`src/domain/indoorRules.ts`), and CO₂e/fuel displacement math (`src/domain/impactCalculator.ts`) execute deterministically and are verified by automated unit tests. **Google Gemini (`gemini-4-hydrogen` via `@google/genai`)** synthesizes personalized conversational advice grounded strictly in verified AirLive telemetry and minimized household context, with a transparent `rule_based_fallback` when offline, unconfigured, or rate-limited.
4. **Privacy-First Client Persistence:** No server database or forced login is required. Household profiles, settings, and environmental impact logs live locally in browser `localStorage` (`breathewise.v1.*`), can be wiped in one click (`Settings -> Clear personal profile & history`), and browser geolocation is strictly optional and click-triggered.

---

## 2. System Architecture Diagram

```
+----------------------------------------------------------------------------------+
|                    BROWSER CLIENT (React 19 + Tailwind CSS v4)                   |
|                                                                                  |
|  +--------------+  +---------------+  +---------------+  +--------------------+  |
|  | Overview &   |  | Daily Planner |  | Indoor Air &  |  | AI Assistant &     |  |
|  | Air Quality  |  | (Schedule)    |  | Sustainable   |  | Impact Tracker     |  |
|  +------+-------+  +-------+-------+  +-------+-------+  +---------+----------+  |
|         |                  |                  |                    |             |
|  +------v------------------v------------------v--------------------v----------+  |
|  | Domain Engines (src/domain/*): US AQI, NAQI, Planner, Indoor, Impact Math  |  |
|  | State & Privacy (src/state/AppStateContext.tsx): Context + localStorage    |  |
|  +-------------------------------------+--------------------------------------+  |
+----------------------------------------|-----------------------------------------+
                                         | HTTPS JSON (/api/*)
+----------------------------------------v-----------------------------------------+
|                  NODE.JS + EXPRESS BFF SERVER (server.ts / server/app.ts)        |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  | Middleware: Security Headers (CORS, HSTS, CORP, XFO), Rate Limiter, Zod    |  |
|  +-----+-------------------------------+--------------------------------+-----+  |
|        |                               |                                |        |
|  +-----v------------------+   +--------v------------+         +---------v-----+  |
|  | AirQualityService      |   | Deterministic       |         | GeminiService |  |
|  | + Single-Flight Cache  |   | Advice & Grounding  |         | (@google/genai|  |
|  | (10m AQI / 30m Curve)  |   | Builder             |         | gemini-4-     |  |
|  +-----+------------------+   +---------------------+         | hydrogen)     |  |
|        |                                                      +---------+-----+  |
|        +---> [AirLive API]       (airlive.tracsa.co.in, no key)         |        |
|        +---> [Open-Meteo CAMS]   (Hourly curve + geocoding, CC BY 4.0)  |        |
+-------------------------------------------------------------------------|--------+
                                                                          v
                                                            [Google Gemini API]
```

---

## 3. Data Providers & Caching Strategy

| Provider | Role | Auth Required | Caching / Rate Control | Attribution Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **AirLive** (`airlive.tracsa.co.in`) | Primary live places index (`/api/v1/aqi`), city/station current US AQI & PM2.5 (`/api/v1/aqi/{slug}`), and India worst/best city ranking (`/api/v1/ranking`) | **None** | **10-minute** server TTL cache (`AQI_CACHE_TTL_MS`, enforced `>= 300,000 ms`) + single-flight in-flight deduplication | `Data: AirLive (https://airlive.tracsa.co.in). Please link back when you use it.` |
| **Open-Meteo Air Quality & Geocoding** | Modeled 24–72h hourly diurnal trajectory (`pm2_5`, `pm10`, `nitrogen_dioxide`, `ozone`) & coordinate geocoding fallback | **None** | **30-minute** server TTL cache (`historyCacheTtlMs`) | `Open-Meteo / Copernicus CAMS (CC BY 4.0)` |
| **Google Gemini (`@google/genai`)** | Grounded structured advice (`gemini-4-hydrogen`) for outdoor safety, ₹500 budget actions, indoor protection, and commutes | Server `GEMINI_API_KEY` | **30 req / min** per IP (`aiRoutes.ts`), **35s** timeout (`GEMINI_TIMEOUT_MS`), automatic `rule_based_fallback` | Model provenance badge (`Gemini` vs `Rule-Based Fallback`) |

---

## 4. Repository Structure

```
breathewise/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API_DESIGN.md
│   ├── DATA_MODEL.md
│   ├── BACKEND.md
│   ├── SECURITY_PLAN.md
│   ├── TEST_PLAN.md
│   ├── QUALITY_REPORT.md
│   ├── DEMO_SCRIPT.md
│   ├── SUBMISSION_CHECKLIST.md
│   └── screenshots/                # Verified headless Chromium UI captures
├── server/
│   ├── app.ts                      # Express API composition & middleware wiring
│   ├── config/env.ts               # Env parsing, CORS origins, secret normalization
│   ├── controllers/
│   │   ├── aiController.ts
│   │   └── airQualityController.ts
│   ├── middleware/
│   │   ├── errorHandler.ts         # Structured JSON error envelope
│   │   ├── rateLimiter.ts          # Sliding-window IP limiter w/ bucket pruning
│   │   ├── security.ts             # CORS allowlist, HSTS, CORP, XFO, nosniff
│   │   └── validate.ts             # Zod query/body validation middleware
│   ├── providers/
│   │   ├── airliveProvider.ts      # AirLive /aqi, /aqi/{slug}, /ranking adapter
│   │   ├── openMeteoProvider.ts    # Open-Meteo CAMS hourly & geocoding adapter
│   │   ├── providerRegistry.ts
│   │   └── types.ts
│   ├── routes/
│   │   ├── aiRoutes.ts             # POST /api/ai/chat (30 req/min)
│   │   ├── airQualityRoutes.ts     # /api/air-quality/* (90 req/min)
│   │   └── healthRoutes.ts         # GET /api/health
│   ├── services/
│   │   ├── aiAdvisorFallback.ts    # Minimized context builder & deterministic fallback
│   │   ├── airQualityService.ts    # Caching, single-flight coalescing, nearest match
│   │   └── geminiService.ts        # @google/genai structured JSON wrapper
│   ├── utils/
│   │   ├── cache.ts
│   │   ├── geo.ts                  # Haversine distance & sanitizeHttpUrl allowlist
│   │   ├── httpClient.ts           # Timeout + retry HTTP fetch wrapper
│   │   ├── logger.ts
│   │   └── normalizeReading.ts     # AirLive mapping & >3h staleness evaluation
│   ├── validators/
│   │   └── airQualityValidators.ts # Strict Zod request & upstream API schemas
│   └── server.test.ts              # 16 API, security, AirLive & Gemini tests
├── src/
│   ├── domain/                     # Pure, framework-free engines + unit tests
│   │   ├── usAqi.ts                # US EPA AQI categories & PM2.5 conversion
│   │   ├── naqi.ts                 # Indian CPCB NAQI breakpoints & sub-indices
│   │   ├── plannerRules.ts         # Time-slot safety & mask guidance
│   │   ├── indoorRules.ts          # Ventilation, CADR 5 ACH sizing & budget tiers
│   │   ├── sustainableRules.ts     # Commute, cooking, waste & shopping advice
│   │   ├── impactCalculator.ts     # CO2e avoided & fuel displaced math
│   │   └── domain.test.ts          # 16 unit tests
│   ├── components/
│   │   ├── layout/AppShell.tsx     # Responsive sidebar, header, mobile bottom bar & skip link
│   │   ├── pages/                  # 9 pages (Overview eager; 8 routes React.lazy split)
│   │   ├── ui/                     # Accessible Chart (+ data table), Modal, LocationSelector, etc.
│   │   └── App.test.tsx            # 6 integration & UI state tests
│   ├── data/previewFixtures.ts     # Offline/preview fixtures & ANONYMOUS_MINIMAL_PROFILE
│   ├── services/airQualityApi.ts   # Typed frontend client w/ AbortController & timeouts
│   ├── state/AppStateContext.tsx   # Household profile, impact logs, settings & alerts
│   ├── types/breathewise.ts        # Shared TypeScript & Zod schemas
│   ├── utils/                      # Bounded numeric input & unique ID utilities
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                   # Tailwind CSS v4 + reduced-motion accessibility rules
├── server.ts                       # Port 3000 entrypoint (Vite dev / dist static prod)
├── vite.config.ts                  # Rolldown chunk splitting (`react`, `zod`)
├── index.html
├── metadata.json
├── package.json
├── LICENSE
├── .env.example
└── README.md
```
