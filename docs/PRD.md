# BreatheWise – Product Requirements Document (PRD)

**Product Name:** BreatheWise – Urban Air Quality Assistant  
**Tagline:** *Breathe better. Live smarter.*  
**Version:** 1.0 (Phase 1 Architecture & Product Specification)  
**Target Environment:** Full-stack Web Application (React + TypeScript + Vite + Tailwind CSS + Node.js/Express + Google Gemini API)

---

## 1. Executive Summary & Problem Statement

Severe winter smog and chronic urban air pollution across Indian cities (e.g., Delhi-NCR, Lucknow, Patna, Kanpur, Mumbai, Kolkata) expose millions of households to hazardous PM2.5 and PM10 concentrations for weeks at a time. Existing AQI dashboards display raw numbers without translating them into actionable, affordable, family-specific guidance, and sustainability trackers frequently conflate personal health protection with city-wide air quality improvement.

**BreatheWise** bridges this gap by combining **verified, real-time and forecast air quality data** with **context-aware GenAI guidance** tailored to a household's members, health vulnerabilities, commute patterns, daily routines, and monthly budget.

### Core Product Commitments (Non-Negotiable)
1. **Live Data Integrity:** Never fabricate live AQI numbers or mask upstream API outages. When live station data is unavailable or stale, display exact error/staleness states and clearly distinguish modeled forecasts (e.g., CAMS/Open-Meteo) from ground-station measurements (e.g., CPCB/OpenAQ/WAQI).
2. **Impact Honesty:** Strictly separate **Personal Pollution Exposure Reduction** (protecting lungs today) from **Personal Emissions Avoided** (reducing CO2e and tailpipe exhaust via modal shifts). Never claim that an individual's commute choice measurably lowers city-wide AQI.
3. **Budget & Accessibility Realism:** Recommendations must work for low-, moderate-, and higher-budget households (e.g., wet-mopping, cross-ventilation timing, DIY box-fan filters or N95 masks alongside commercial HEPA purifiers), and the UI must meet WCAG 2.1 AA standards.

---

## 2. Target User Personas & Needs

| Persona | Profile & Vulnerabilities | Core Pain Points | Primary BreatheWise Capabilities |
| :--- | :--- | :--- | :--- |
| **1. Families with Children** | Parents with infants/school-age kids (e.g., asthma-prone child, school drop-offs). | Unsure when outdoor play or school bus waiting is safe; overwhelmed by expensive purifier claims. | Household vulnerability rules, safer exercise alternatives, school-commute timing, budget-tiered indoor air tips. |
| **2. Elderly People** | Seniors (65+) with COPD, hypertension, or cardiovascular sensitivity. | Morning walks during winter inversion peaks; confusing pollutant sub-indices. | Clear plain-language risk alerts, indoor mobility routines, non-morning ventilation windows, high-contrast accessible UI. |
| **3. Students** | College/school students commuting by metro, bus, cycle, or walking. | Low disposable income; balancing physical fitness, campus travel, and exam-season smog fatigue. | Low-cost mask/route guidance, campus transit alternatives, zero-cost dorm/room air hygiene habits. |
| **4. Outdoor Workers** | Delivery riders, street vendors, construction/field staff spending 6–10 hrs outdoors. | Cannot simply "stay indoors"; need practical shift-timing, PPE, and hydration/symptom mitigation. | High-exposure shift strategies, N95 fit & reuse limits, micro-break indoor sheltering, symptom red-flag guidance. |
| **5. Daily Commuters** | Working adults traveling 10–40 km/day by car, two-wheeler, bus, or metro. | High in-traffic PM2.5 inhalation; uncertainty around carpooling vs. transit vs. cycling in Poor/Severe AQI. | Commute mode matrix (exposure vs. emissions trade-off), cabin air recirculation rules, impact tracker. |
| **6. Residents of Heavily Polluted Zones** | People living near industrial corridors, highways, or winter smog basins (AQI 300–500+). | Persistent indoor smoke/dust infiltration; lack of localized station context and cooking smoke management. | Station-level pollutant breakdown (PM2.5, PM10, NO2, CO), kitchen exhaust & sealing checklists, 48-hr forecast planning. |

---

## 3. Core Modules & Functional Requirements

### Module A: Air Quality Dashboard
- **Real-Time Metrics:** Current AQI (mapped to Indian **CPCB NAQI 0–500** 6-band scale: *Good, Satisfactory, Moderately Polluted, Poor, Very Poor, Severe*), dominant pollutant, PM2.5, PM10, and available gaseous pollutants (NO2, SO2, CO, O3, NH3).
- **Provenance & Trust:** Mandatory display of **Data Source** (e.g., *CPCB via OpenAQ v3*, *CPCB OGD*, *WAQI*, or *CAMS Modeled Forecast via Open-Meteo*), **Station Name & Distance**, **Observation Timestamp**, and **Measurement Type Badge** (`Ground Station` vs. `Modeled Forecast`).
- **Location Selection:** Searchable Indian/global cities & neighborhoods, preset quick-switch cities, and optional browser geolocation (with explicit permission).
- **Pollution Trends:** Hourly trend chart combining recent observed history (where supported) and 24–72 hr modeled hourly forecast (via Open-Meteo/CAMS) to identify cleaner midday ventilation windows vs. winter morning/night inversion spikes.
- **Resilience States:** Explicit skeleton loading, empty location prompt, offline banner (using last cached reading with clear *Offline / Stale* timestamp badge), and actionable provider error states.

### Module B: AI Air Quality Assistant
- **Natural-Language Q&A:** Conversational interface powered server-side by Google Gemini (`@google/genai` SDK, `gemini-4-hydrogen`).
- **Context Injection:** Every prompt automatically grounds Gemini with the user's current verified AQI payload (values, dominant pollutant, timestamp, source) and active **Family Profile** (sensitive groups, commute, budget).
- **Capabilities:** Explain *why* today's pollution is spiking (e.g., winter temperature inversion, PM2.5 vs. coarse dust PM10), answer specific family safety questions, and generate tailored daily action summaries.
- **Guardrails:** System instruction enforces factual grounding in provided AQI context, forbids inventing city-level AQI reductions from personal choices, forbids diagnosing medical conditions (includes medical disclaimer for acute symptoms), and propagates real errors if Gemini is unavailable.

### Module C: Family Profile
- **Household Composition:** Number of adults, children (with age brackets: infant/toddler, school-age), and seniors (65+).
- **Health Sensitivities:** Asthma/respiratory conditions, cardiovascular sensitivity, pregnancy, or outdoor-worker status.
- **Lifestyle & Commute:** Primary commute mode (private car, two-wheeler, metro/rail, bus, walk/cycle, WFH), typical daily commute distance (km), and usual outdoor exercise/activity schedule.
- **Monthly Budget Tier:** Low (`< ₹1,500/mo`), Moderate (`₹1,500–₹5,000/mo`), Flexible (`> ₹5,000/mo`) — used to constrain purifier, mask, and transport suggestions.
- **Optional Preferences:** Cooking fuel type (LPG, induction, solid fuel/biomass), home ventilation/AC availability, and preferred units/language tone.
- **Persistence:** Validated profile stored persistently (local browser storage + optional server/DB profile sync when configured) with clear reset/export controls.

### Module D: Smart Daily Planner
- **Personalized 24-Hour Schedule:** Time-slotted recommendations (Early Morning, Midday Window, Evening Commute, Night) adapting dynamically to current AQI + hourly forecast curve.
- **Outdoor Activity & Safer Exercise Alternatives:** Maps NAQI severity + family sensitivity to explicit activity rules (e.g., replacing 6 AM outdoor jog during AQI 380 with indoor resistance/yoga or shifting low-exertion errands to lowest-PM2.5 midday window).
- **Transportation Recommendations:** Balances **personal exposure** (e.g., avoid cycling alongside heavy traffic when PM2.5 > 150 µg/m³) with **emissions** (preferring enclosed AC metro/electric bus over single-occupancy car).
- **Low-Emission Habits:** Contextual daily micro-habits (combining errands, avoiding idling, induction/pressure-cooking efficiency).

### Module E: Indoor Air Advisor
- **Ventilation Windows:** Dynamic open-vs-seal guidance based on outdoor hourly forecast (avoiding morning/late-evening inversion hours when outdoor PM2.5 exceeds indoor levels).
- **Cooking Smoke Management:** Actionable guidance for Indian kitchens (exhaust fan operation, lid usage, wet-wiping oil/soot surfaces, avoiding incense/agarbatti/mosquito coils during Severe AQI).
- **Dust Reduction:** Wet mopping vs. dry sweeping (dry sweeping resuspends settled PM10/PM2.5), entryway shoe/coat protocols, damp-cloth window sealing.
- **Air Purifier & Budget-Friendly Guidance:**
  - *Low budget:* Wet-mopping, cross-ventilation timing, N95 mask rotation, sealed door gaps, DIY MERV-13/HEPA box-fan filter options (with electrical safety caveats).
  - *Moderate/Flexible budget:* CADR sizing formula matched to room area (`m²` / `sq ft`), True HEPA (H13/H14) vs. avoiding ozone-generating ionizers, filter replacement cadence.

### Module F: Sustainable Alternatives
- **Mode-by-Mode Guidance:** Public transport (metro, city bus), carpooling/shared rides, and walking/cycling *explicitly gated by safe AQI thresholds* (never recommending strenuous outdoor cycling in Very Poor/Severe smog).
- **Household Energy & Practices:** Avoiding waste/leaf burning, switching idle appliances off, cold-water laundry, induction cooking where feasible, and community reporting channels for open burning.
- **Trade-off Clarity:** Every card explicitly tags `[Exposure Impact]` and `[Emissions Impact]` separately.

### Module G: Environmental Impact Tracker
- **Action Logging:** Users check off or log sustainable actions and commute shifts (e.g., *"Took Metro instead of Petrol Car — 14 km"*).
- **Transparent Calculations:**
  - **Transport Emissions Avoided (`kg CO2e`):** Computed from deterministic, cited India-specific emission factors (India GHG Program / Shakti Foundation benchmarks) comparing baseline mode vs. chosen mode × distance.
  - **Estimated Fuel Savings (`Litres` / `₹`):** Computed only when shifting from a fuel-burning private vehicle (car/two-wheeler) using user-editable or disclosed baseline mileage assumptions (`km/L`) and reference fuel price.
  - **Exposure Protection Score / Actions Completed:** Counts completed indoor/health-protection actions separately from emissions-reduction actions.
- **Methodology Drawer:** Every metric exposes the exact formula, emission factor source, and explicit disclaimer: *"Personal transport shifts reduce tailpipe CO2e and local street-level exhaust, and save fuel; they do not independently alter city-wide AQI readings."*

---

## 4. User Experience (UX) Structure & Pages

### Navigation & Information Architecture
1. **`/` — Dashboard & Quick Action Overview (`DashboardView`)**
   - Location selector, current NAQI hero card (with source, station, timestamp, pollutant breakdown), 24h–48h hourly trend chart, immediate "Today's Top 3 Protective Actions" summary, and quick link to generate/view today's Daily Plan.
2. **`/planner` — Smart Daily Planner (`PlannerView`)**
   - Time-blocked daily schedule, outdoor safety matrix by family member group, commute mode trade-off advisor, and AI-enhanced daily briefing.
3. **`/indoor` — Indoor Air Advisor (`IndoorView`)**
   - Interactive room/budget-filtered indoor checklist (ventilation timer, cooking smoke, dust control, CADR purifier calculator, budget-friendly upgrades).
4. **`/assistant` — AI Air Quality Assistant (`AssistantView`)**
   - Conversational chat workspace pre-seeded with context-aware prompts (*"Is it safe for my 6-year-old to play outside at 4 PM?"*, *"How can I reduce indoor smoke under ₹1,000?"*), showing active AQI & Family Profile context chips.
5. **`/sustainability` — Sustainable Alternatives & Impact Tracker (`ImpactView`)**
   - Safe low-emission alternatives catalog + interactive Commute & Habit Logger + dual-pillar progress dashboard (**Exposure Reduction Actions** vs. **Emissions & Fuel Avoided**) + expandable Calculation Methodology modal.
6. **`/profile` — Family Profile & Settings (`ProfileView`)**
   - Structured multi-section form (Household, Health Sensitivities, Commute & Routine, Budget & Home Setup, Data/Privacy controls).

### End-to-End Primary User Journey
1. **Land & Auto-Locate/Select City:** User opens BreatheWise. If no location is saved, user selects a city (e.g., *Delhi - Anand Vihar* or *Bengaluru*) or grants geolocation.
2. **Verify Real Air Quality:** Dashboard calls `/api/aqi/current` and `/api/aqi/forecast`. UI renders live NAQI score, PM2.5/PM10 levels, provider badge, timestamp, and hourly trend.
3. **Configure Family Context:** User clicks "Personalize for Your Household" (or navigates to Family Profile), enters 1 child (age 5, mild asthma), 1 senior, daily 18 km car/metro commute, and "Low/Moderate" budget.
4. **Receive Personalized Daily Plan:** App navigates to `/planner`, combining deterministic NAQI health rules + hourly forecast window + Gemini synthesis (`/api/ai/daily-plan`) to produce a safe, time-slotted daily schedule and indoor checklist.
5. **Ask Follow-Up & Log Sustainable Shift:** User asks the AI Assistant about evening commuting, shifts one 18 km car trip to Metro in the Impact Tracker, and sees transparent CO2e & fuel savings alongside exposure-protection actions.

---

## 5. Non-Functional Requirements

- **Security:** Zero secrets in frontend bundle; all external AQI and Gemini calls proxied through Express with Zod input/output validation, rate limiting, and helmet/CORS protections.
- **Performance:** Initial bundle lightweight (< 300 KB gzipped target), repository size strictly < 10 MB, 15-minute server-side AQI response caching to protect upstream rate limits.
- **Accessibility:** Semantic HTML landmarks, keyboard navigation, ARIA live regions for AQI/chat updates, colorblind-safe NAQI indicators (text labels + icons + patterns, never color alone), >= 4.5:1 contrast.
- **Testability:** Pure calculation engines (NAQI breakpoints, emission math, ventilation window logic, schema validators) decoupled from React components and tested via Vitest/Node tests + RTL + Playwright E2E.
