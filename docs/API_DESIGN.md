# BreatheWise – API Design Specification

All backend routes are served under `/api/*` by Express (`server/app.ts`), validate inputs and upstream responses with **Zod**, enforce security headers (`server/middleware/security.ts`), and return structured JSON errors without leaking stack traces or secrets.

---

## 1. Error Envelope Convention

All `4xx` / `5xx` responses conform to:

```json
{
  "error": {
    "code": "AQI_PROVIDER_UNAVAILABLE",
    "message": "Unable to reach live AirLive air-quality telemetry.",
    "retryable": true,
    "details": {}
  }
}
```

Standard error codes:
- `VALIDATION_ERROR` (`400`) — Invalid query parameters, malformed `slug`/`country` format, or invalid JSON body.
- `NOT_FOUND` (`404`) — Unknown `/api/*` route or unrecognized location slug/query.
- `RATE_LIMITED` (`429`) — Client exceeded per-IP sliding-window limit (`90/min` for `/api/air-quality/*`, `30/min` for `/api/ai/*`).
- `AQI_PROVIDER_UNAVAILABLE` (`503`) — Upstream AirLive or Open-Meteo service timed out or returned invalid data.
- `INTERNAL_ERROR` (`500`) — Unexpected server error (sanitized message only).

---

## 2. Health & Capability Discovery

### `GET /api/health`
Reports server health and configured capabilities (boolean flags only; zero credentials).

**Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "breathewise-api",
  "timestamp": "2026-11-19T09:15:00.000Z",
  "capabilities": {
    "airlive": {
      "configured": true,
      "requiresApiKey": false
    },
    "openMeteoCams": {
      "configured": true,
      "requiresApiKey": false
    },
    "aiAssistant": {
      "geminiConfigured": true
    }
  }
}
```

---

## 3. Air Quality & Location Endpoints (`/api/air-quality/*`)

Rate limit: **90 requests / minute** per IP (`trust proxy` enabled).

### `GET /api/air-quality/places`
Returns supported AirLive locations, cached for **10 minutes** with single-flight coalescing.

**Query Params (optional):**
- `country` — 2–3 letter ISO country code (e.g., `IN`).
- `q` — Case-insensitive filter string (`max 80` chars).
- `kind` — Place type filter (e.g., `city`, `locality`).

### `GET /api/air-quality/current`
Returns normalized live US EPA AQI and PM2.5 telemetry for a slug, coordinates, or city name.

**Query Params (at least one required):**
- `slug` — Validated slug (`/^[a-z0-9][a-z0-9-]{0,119}$/i`, e.g., `delhi`, `anand-vihar`).
- `lat` (`-90..90`) & `lon` (`-180..180`) — Matches the nearest supported AirLive station via Haversine distance (`nearestMatchKm` recorded).
- `city` / `locationName` — Resolves via AirLive places index or Open-Meteo geocoding + nearest station.

**Response `200 OK`:** Normalized `AirQualityReading` containing:
- `location` (`slug`, `name`, `country`, `lat`, `lon`, `nearestMatchKm`)
- `aqi` (`value`, `scale: "US_AQI"`, `category`, `dominantPollutant`)
- `pollutants` (`pm25` + any reported metrics; unreported gases remain explicitly absent and listed in `missingPollutants`)
- `source` (`provider: "airlive"`, `sourceType`, `stationsUsed`, `modelUsAqi`, `stationToModelRatio`, `attributionText`, `attributionUrl`)
- `freshness` (`observedAt`, `fetchedAt`, `isStale` when `> 3 hours`, `cacheHit`)

### `GET /api/air-quality/ranking`
Proxies AirLive city air-quality rankings (`country` default `IN`, `order: "worst" | "best"`, `limit: 1..50`).

### `GET /api/air-quality/history`
Returns hourly modeled diurnal particulate and trace-gas curves from **Open-Meteo / Copernicus CAMS** (`CC BY 4.0`) plus computed `bestVentilationWindow`.

**Query Params:**
- `lat` (`-90..90`, required)
- `lon` (`-180..180`, required)
- `hours` (`6..72`, default `24`)

**Caching:** **30 minutes** server TTL.

### `GET /api/air-quality/search?q=<query>&limit=<1..50>`
Searches AirLive places first and augments with Open-Meteo Geocoding results when needed.

### `POST /api/air-quality/recommendations`
Accepts `{ slug | lat+lon | city, familyProfile }` and returns live AirLive context, modeled hourly trajectory, and deterministic household planner, indoor air, and sustainable choice recommendations (`Cache-Control: no-store`).

---

## 4. Gemini AI Assistant Endpoint (`/api/ai/chat`)

Rate limit: **30 requests / minute** per IP · Response header: `Cache-Control: no-store`.

### `POST /api/ai/chat`
Answers natural-language family questions grounded in live AirLive telemetry and minimized household context (`adultCount`, `childCount`, `seniorCount`, `hasRespiratorySensitivity`, `budgetTier`, `primaryCommute`, `dailyCommuteKm`, `preferredOutdoorTime`).

**Request Body:**
```json
{
  "message": "Is it safe for my child to play outside today?",
  "slug": "delhi",
  "history": [
    { "role": "user", "text": "..." },
    { "role": "assistant", "text": "..." }
  ],
  "familyProfile": { "...": "validated FamilyProfile including updatedAt" }
}
```

**Security & Reliability Guarantees:**
1. User question and history turns are wrapped in untrusted delimiter tags (`<user_question>`, `<conversation_history>`) with ASCII control characters stripped.
2. Gemini output (`gemini-4-hydrogen`, `responseMimeType: "application/json"`) is Zod-validated against `AiStructuredAdviceSchema`; unsafe URL schemes (`javascript:`, `data:`) are stripped and source links are locked to server-verified AirLive + Open-Meteo citations.
3. If `GEMINI_API_KEY` is missing, times out (`35s`), returns malformed JSON, or hits quota (`429`), the endpoint gracefully returns HTTP `200` with `responseSource: "rule_based_fallback"`, `aiAvailable: false`, an explicit `fallbackReasonCode`, and rule-based structured guidance grounded in the live reading.
