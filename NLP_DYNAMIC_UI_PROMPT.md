# Architecture: NLP Intent Engine → Dynamic UI (No LLM)

## Why this fits your codebase almost exactly

Your `AgentResponse` schema already returns `reply` (text) + `cards` (structured, typed UI payloads) + `sources`. The frontend already has a `cards` array in chat messages, a full Leaflet map page, a trends chart page, and an agriculture page. **The "dynamic UI" concept isn't new here — it already exists as `CardItem`.** What's currently missing is:
1. A non-LLM way to decide intent + entities from the user's sentence.
2. A wider, more deliberate card-type vocabulary that includes map/route rendering, not just data cards.
3. A template-based `reply` generator instead of Gemini writing the sentence.

So this isn't a rewrite — it's swapping the *orchestrator* (`agent.py`, which currently calls Gemini for tool-selection and reply-writing) for a deterministic NLP router, while reusing every tool in `tools.py` and the entire `CardItem` delivery mechanism as-is.

---

## Pipeline

```
User text
   │
   ▼
[1] Preprocessing (normalize, spellcheck city names against known gazetteer)
   │
   ▼
[2] Intent Classifier  →  one of a fixed intent set (below)
   │
   ▼
[3] Entity Extractor   →  locations (1 or 2, for routes/comparisons), 
   │                       timeframe, weather parameter, crop (if agri)
   ▼
[4] Intent → Tool Router → calls existing tools.py functions
   │                        (get_current_weather, get_forecast, agriculture, etc.)
   ▼
[5] Data → Template Filler → produces `reply` string (deterministic, slot-filled)
   │
   ▼
[6] Data → Card/UI Builder → produces `cards[]`, choosing card TYPE based on intent
   │                          (this is the "dynamic UI" — map, chart, dashboard, list)
   ▼
Frontend renders cards[] using a type-based component switch
```

Nothing after step 4 touches an LLM. Steps 2–3 are the only "AI" in the strict sense, and they're small classical/lightweight-ML NLP, not generative.

---

## Intent set (fixed, closed vocabulary — makes classification tractable without an LLM)

| Intent | Example utterance | Entities needed | Card(s) produced |
|---|---|---|---|
| `current_weather` | "weather in Pune" | location | `current_weather` |
| `forecast` | "will it rain tomorrow in Nashik" | location, timeframe | `forecast` |
| `route_weather` | "weather from Pune to Mumbai tomorrow" | location_from, location_to, timeframe | **`route_map`** (new) |
| `compare_locations` | "Pune vs Mumbai this weekend" | location×2, timeframe | `comparison` |
| `alert_check` | "any warnings for Nashik" | location | `alert` |
| `trend_query` | "how has rainfall changed this month" | location, timeframe | **`trend_chart`** (new, reuses TrendsPage viz) |
| `agriculture_advisory` | "should I spray my cotton crop" | location, crop | `agriculture` |
| `dashboard_request` | "give me a full weather overview for Nashik" | location | **`dashboard`** (new, composite card) |

The last three rows are genuinely new card types — everything else reuses your existing `CardItem` types already defined in `schemas.py`.

---

## New card types to add to `CardItem`

- **`route_map`**: `{ "waypoints": [{lat, lon, name, weather_summary}], "polyline": [...], "hazard_segments": [...] }` — frontend renders this inside `MapPage`'s existing Leaflet setup (or an embedded mini-map component inside the chat card), plotting the route with a weather-condition marker at each waypoint and highlighting any segment with a risk tier ≥ Yellow.
- **`trend_chart`**: `{ "metric": "rainfall", "series": [...], "range": "30d" }` — frontend renders this using whatever charting component `TrendsPage.jsx` already uses, just embedded as a card instead of a full page.
- **`dashboard`**: `{ "sections": ["current", "forecast", "risk", "agriculture"] }` — a composite card that tells the frontend "render the mini dashboard layout," pulling data already fetched via the other tool calls in the same turn.

## Frontend: card-type-to-component switch

Add a single `CardRenderer.jsx` component that maps `card.type` → component, and use it wherever `cards.map(...)` currently renders in `WeatherGPTPage.jsx`. This centralizes "what does the AI's structured intent turn into visually" in one file, which is also the cleanest thing to demo/screenshot for judges: show the router table, show a query, show it light up a specific card type.

---

# The Prompt (paste into Claude Code / your coding agent)

```
Context: This is the SkyCast weather app (React+Vite frontend, FastAPI backend). It
currently has an agent (`backend/app/services/agent/agent.py`) that uses Gemini for
both tool-selection and reply-writing, calling into `tools.py`, and returning an
AgentResponse with `reply` (string) + `cards` (typed structured UI payloads, see
`schemas.py: CardItem`) + `sources`.

Goal: Replace the LLM-driven orchestration with a deterministic NLP pipeline (intent
classification + entity extraction, no generative model), while keeping every existing
tool in tools.py, the CardItem delivery mechanism, and the AgentResponse contract
UNCHANGED so the frontend integration barely has to move. The chat should still feel
conversational, but replies are template-filled from structured data, not generated.
Do this behind a feature flag (NLP_MODE=true in .env) so Gemini mode can still be
selected/compared side by side — this is useful for demoing "AI without hallucination
risk" as a contrast.

Implement in this order, stopping after each to summarize:

1. INTENT CLASSIFIER
   Create `backend/app/services/nlp/intent_classifier.py`. Support a closed intent set:
   current_weather, forecast, route_weather, compare_locations, alert_check,
   trend_query, agriculture_advisory, dashboard_request, unknown.
   Implement as a lightweight classifier — start with a rule/keyword + fuzzy-match
   baseline (fast, zero training data needed, fully explainable) using `rapidfuzz` for
   fuzzy phrase matching, structured as a scored-candidate system (not just if/elif
   chains) so it's extensible. Leave a clean interface so a trained scikit-learn or
   spaCy textcat classifier could be swapped in later without changing callers.
   Log confidence scores; if below a threshold, return `unknown` and have the reply
   template ask a clarifying question rather than guessing.

2. ENTITY EXTRACTOR
   Create `backend/app/services/nlp/entity_extractor.py` using spaCy (`en_core_web_sm`,
   or a small multilingual model if available) for location/date NER, combined with:
   - A location resolver that fuzzy-matches extracted location strings against the
     existing geocoding tool (`search_location_tool` in tools.py) rather than
     duplicating geocoding logic.
   - A regex/rule-based date-timeframe parser (today/tomorrow/this weekend/next N
     days) — `dateparser` library is fine here, don't reinvent date parsing.
   - Two-location extraction for route_weather and compare_locations intents
     (patterns like "from X to Y", "X vs Y", "X and Y").
   - Crop-name matching against the existing crop list already used in
     `agriculture_service.py`.

3. INTENT → TOOL ROUTER
   Create `backend/app/services/nlp/router.py` mapping each intent to the specific
   tools.py function(s) to call and with what extracted arguments, replacing what
   Gemini's function-calling currently decides dynamically. This is a static mapping
   table (intent -> [tool_name, arg_mapping]), reviewable as a single readable dict/
   config, not scattered logic.

4. TEMPLATE REPLY GENERATOR
   Create `backend/app/services/nlp/reply_templates.py`: for each intent, a set of
   slot-filled string templates (multiple phrasing variants per intent to avoid
   robotic repetition — pick randomly or rotate). Pull language variants from
   `src/locales/translations.js`-equivalent backend structure (create
   `backend/app/services/nlp/reply_templates_i18n.py` covering the same 11 languages
   already supported in the frontend) so replies are natively multilingual without
   any translation model call. This directly reuses the multilingual work already
   in the repo instead of introducing a new i18n system.

5. NEW CARD TYPES + BUILDER
   Extend `CardItem`'s allowed `type` values in schemas.py to add: `route_map`,
   `trend_chart`, `dashboard`. Create `backend/app/services/nlp/card_builder.py` that,
   given intent + tool results, constructs the right CardItem(s) — this is where
   "dynamic UI selection" actually happens: the function is a switch on intent that
   decides which visual the data deserves.
   For `route_weather`: call the geocoding tool for both locations, sample 2-4
   intermediate waypoints along the straight-line/routing path (a simple linear
   interpolation between coordinates is sufficient for demo purposes — note in a
   comment that a real routing API like OSRM could replace this for actual road-path
   accuracy), fetch weather at each waypoint, and flag any waypoint whose Skycast
   risk tier is Yellow or above.

6. ORCHESTRATOR SWITCH
   Modify `backend/app/services/agent/agent.py` (or add a parallel
   `nlp_agent.py` alongside it) so that when `NLP_MODE=true`, the request flow is:
   preprocess -> classify_intent -> extract_entities -> route_to_tools ->
   build_reply_from_template -> build_cards -> return AgentResponse.
   Keep the existing Gemini path fully intact and reachable when NLP_MODE=false.

7. FRONTEND: CARD RENDERER
   Create `src/components/CardRenderer.jsx` — a single switch component mapping
   `card.type` to a rendering component:
   - `route_map` -> a compact Leaflet map (reuse logic/imports from MapPage.jsx,
     factored into a shared `RouteMapMini.jsx` component) showing the route polyline,
     waypoint markers colored by risk tier, and a hover/tap popup with that
     waypoint's weather summary.
   - `trend_chart` -> reuse whatever chart library TrendsPage.jsx already uses,
     factored into a shared `TrendChartMini.jsx` component.
   - `dashboard` -> a mini grid layout combining current/forecast/risk/agriculture
     sub-cards in one card, using the SAME sub-components those individual card
     types already use (don't duplicate rendering logic — compose it).
   - Existing types (current_weather, forecast, risk, alert, historical, comparison,
     location, agriculture) should keep using whatever rendering already exists in
     WeatherGPTPage.jsx today — just move that switch logic into CardRenderer.jsx
     for a single source of truth, and call CardRenderer from WeatherGPTPage.jsx.

8. TESTS
   Add `backend/tests/test_nlp_intent_classifier.py`,
   `backend/tests/test_nlp_entity_extractor.py`, and
   `backend/tests/test_nlp_router.py`, following the existing test file conventions
   in backend/tests/. Include test cases for at least: route_weather with two cities,
   ambiguous/unknown intent, missing location (should trigger clarifying-question
   template, not crash), and each of the 11 supported languages for at least one
   intent's reply template.

9. DOCS
   Add `docs/nlp-mode-architecture.md` explaining: why NLP-mode has zero hallucination
   risk (no generative step at all — every word in the reply comes from a template
   or structured data), the intent taxonomy, and the card-type table, so this can be
   presented directly to judges as a distinct, defensible design decision versus a
   pure-LLM competitor.

Constraints:
- Do not remove or degrade the existing Gemini-based agent path.
- Do not duplicate geocoding/weather-fetch logic — the NLP layer must call the
  same tools.py functions the Gemini agent uses, so both paths stay consistent
  with weather_hub as the single source of truth.
- New Python dependencies (spacy, rapidfuzz, dateparser) must be added to
  backend/requirements.txt with pinned versions, and the spaCy model download
  step documented in backend/README.md.
- Keep response latency low — this whole pipeline should be fast enough to
  demonstrate as a genuine speed/reliability advantage over LLM-based chat in the
  metrics endpoint from the earlier plan.
```
