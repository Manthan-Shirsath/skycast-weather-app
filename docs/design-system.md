# SkyCast Design System: Monsoon Instrument

SkyCast now uses a visual system based on meteorological instruments in an Indian weather context. The goal is to make the product feel like a working forecast desk: calm enough for daily planning, precise enough for disaster and agriculture decisions, and visibly distinct from a generic blue dashboard.

## Design Plan

### Color

- **Monsoon Ink `#10212b`** anchors navigation, primary actions, and high-emphasis text. It is drawn from instrument-panel ink rather than startup slate.
- **Barometer Blue `#1f5f7a`** is the main structural blue for pressure, map boundaries, focus, and selected controls.
- **Radar Rain `#0f8ea8`** is the active meteorological accent for rainfall, radar, links, and focused data states.
- **Chart Paper `#f5f3e8`** replaces sterile white-gray with the warmer tone of printed IMD bulletins and field maps.
- **Monsoon Cloud `#dce6e6`** provides cloud-layer surfaces and quiet secondary panels.
- **Paddy Field `#4b8f55`** supports agriculture and safe/normal conditions without turning the whole product green.

The IMD risk system remains green, yellow, orange, and red. Exact values were tuned to sit on the new chart-paper surfaces, but the hue families and severity meaning remain instantly recognizable. These colors stay semantic, not decorative.

### Type

- **Display:** `Aptos Display`, `Bahnschrift`, then Noto display/script fallbacks. It gives headings a technical, public-information feel without relying on a Latin-only novelty font.
- **Body:** `Aptos`, `Noto Sans`, then system UI. The stack includes Noto fallbacks for Devanagari, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Gurmukhi, and Odia scripts.
- **Data:** `Cascadia Mono`, `Roboto Mono`, `Noto Sans Mono`, then Consolas. Numeric weather readouts use tabular figures so changing values align like station data.

### Layout Concept

SkyCast is laid out as a synoptic forecast workstation: the background behaves like chart paper, cards behave like station panels, and AI guidance is a separate violet-tinted forecast log.

Dashboard:

```text
[current station / temp / condition + live isobars] [rain] [sunrise]
                                                    [sunset] [pressure]
[WeatherGPT query strip]
[hourly station row] [mini map] [AQI]              [7-day forecast log]
[IMD/SkyCast safety banner]
```

WeatherGPT:

```text
[question presets / reset] [forecast log stream]
                           [SkyCast-derived cards]
                           [input + voice + send]
```

Map:

```text
[map title + live/radar/satellite/wind controls]
[layers] [India synoptic map canvas] [location inspector]
[legend]                         [zoom controls]
[precip] [wind] [AQI] [pressure] [map time]
```

### Signature Element

The signature element is an **isobar and station-plot texture system**. Pressure-line contours sit behind the app shell and hero panels, while card interiors use a faint station grid. It makes SkyCast feel like a meteorological instrument without adding decorative clutter.

## Critique And Revision

The first direction risked becoming a nicer blue weather app. I removed broad sky gradients as the dominant identity and made pressure lines, station grids, chart-paper surfaces, and monospaced data the recognizable system. I also avoided cream-serif editorial styling, near-black neon AI styling, and newspaper hairline layouts. The result keeps one bold signature element and lets the rest of the UI stay disciplined.

## Component Skinning Rules

- Standard forecast cards use `--surface-container-lowest`, `--station-grid-texture`, `--outline-variant`, and `--radius-xl`.
- WeatherGPT and model-derived cards use `--ai-violet-light`, `--ai-violet-border`, and explicit SkyCast-derived wording.
- Official or safety-related notices use darker `--primary-container` surfaces so they are visually distinct from app-native guidance.
- Severity badges and alert edges must use the four IMD-aligned `--risk-*` token groups.
- Numeric readouts should use `--font-mono` with tabular figures.
- New page sections should avoid nested cards; use full-width sections or single-layer panels.

## Accessibility Notes

The system includes visible focus rings, mobile layout constraints, and `prefers-reduced-motion` handling for animation-heavy elements. Risk colors must always be accompanied by labels or icons because severity cannot rely on color alone.
