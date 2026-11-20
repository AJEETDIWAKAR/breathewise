# BreatheWise Backend Architecture & AirLive + Gemini Integration

## Overview
BreatheWise runs a single-process Node.js + Express backend (`server.ts` + `server/app.ts`) serving both the `/api/*` endpoints and the React + Vite SPA on port `3000`.

## Live Air Quality Data Provider: AirLive
BreatheWise uses **[AirLive](https://airlive.tracsa.co.in)** as its primary live air-quality provider. **No AQI API keys are required.**

### Upstream Endpoints Used
1. All supported places: `https://airlive.tracsa.co.in/api/v1/aqi`
2. Individual place by slug: `https://airlive.tracsa.co.in/api/v1/aqi/{slug}`
3. Country ranking: `https://airlive.tracsa.co.in/api/v1/ranking?country=IN&order=worst&limit=10`

### Backend Endpoints Exposed
- `GET /api/health` — Service health, zero-key AirLive capability status, and Gemini configuration flag.
- `GET /api/air-quality/places?country=IN` — Cached directory of supported AirLive places for the searchable location selector.
- `GET /api/air-quality/current?slug=delhi` — Live reading normalized to the **US AQI 6-band scale** (`Good`, `Moderate`, `Unhealthy for Sensitive Groups`, `Unhealthy`, `Very Unhealthy`, `Hazardous`), PM2.5 (`null`/`Unavailable` when missing, never `0`), Ground Stations (`stationsUsed`) vs. Atmospheric Model transparency, Freshness status (`fresh`, `stale` > 3 hours, `unavailable`), and clickable AirLive attribution.
- `GET /api/air-quality/ranking?country=IN&order=worst&limit=10` — Most polluted Indian cities ranking from AirLive.
- `GET /api/air-quality/search?q=...` — Searches AirLive-supported Indian cities and localities.
- `GET /api/air-quality/history?lat=...&lon=...` — Optional Copernicus CAMS modeled 24-hour trajectory via Open-Meteo for diurnal ventilation window estimates.
- `POST /api/air-quality/recommendations` — Household safety & schedule planner grounded in live AirLive telemetry.
- `POST /api/ai/chat` — Server-side Google Gemini (`@google/genai`, `gemini-4-hydrogen`) assistant grounded in retrieved AirLive telemetry and household `FamilyProfile`.

## Caching, Timeouts & Resilience
- `AQI_CACHE_TTL_MS` defaults to `600000` (10 minutes) with a strict minimum floor of `300000` (5 minutes) to respect AirLive's rate guidance.
- `PROVIDER_TIMEOUT_MS` defaults to `10000` (10 seconds).
- Invalid upstream JSON throws `502 INVALID_PROVIDER_RESPONSE` immediately without hammering upstream.
- Unknown places return `404 LOCATION_NOT_FOUND`.
- Upstream downtime or empty place lists return `503 AQI_PROVIDER_UNAVAILABLE` — BreatheWise never fabricates live readings.
