---
name: Atmospheric Intelligence
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-temp:
    fontFamily: Geist
    fontSize: 84px
    fontWeight: '700'
    lineHeight: 90px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  numeral-data:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is built upon the concept of "Atmospheric Intelligence"—a fusion of precise scientific data and calm, human-centric clarity. The brand personality is authoritative yet approachable, moving away from sterile SaaS aesthetics toward a "Modern Meteorological" style. 

The visual language utilizes a refined **Minimalism** blended with **Glassmorphism**. High-density data is balanced by generous whitespace and soft, translucent layers that mimic the layered nature of the atmosphere. This approach ensures that even complex AI-driven forecasts feel breathable and non-threatening. The emotional response should be one of "preparedness through clarity," where users feel informed rather than overwhelmed by raw data.

## Colors
The color palette is anchored in deep slate and indigo for authority, while the semantic system uses a "gradient of concern" to represent weather severity. 

- **Primary & Neutral:** Deep Slates (`#0F172A`) for text and core structural elements, set against ultra-light gray surfaces (`#F8FAFC`) to maintain a scientific, clean aesthetic.
- **Semantic Severity:** 
  - **Normal:** Soft Emerald for safe conditions.
  - **Information:** Sky Blue for standard data.
  - **Warning/Severe/Critical:** A transition from Amber to Deep Red to communicate increasing urgency.
- **Skycast (AI Risk):** A distinct Violet (`#7C3AED`) is reserved exclusively for AI-generated insights. This ensures a clear mental model shift between deterministic government data and probabilistic AI intelligence.

## Typography
The typography system uses a dual-sans-serif pairing to distinguish between narrative AI insights and hard meteorological data. 

- **Display & Headlines:** Use **Geist** for its technical precision and tight kerning. Temperature readouts (`display-temp`) are oversized and bold to serve as the primary visual anchor of the UI.
- **Body & Captions:** Use **Inter** for its superior legibility in dense data environments and accessibility across various screen sizes.
- **Data Numerical:** Use **Geist** with tabular figures where possible to ensure that columns of weather data align perfectly for quick scanning.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a focus on "Atmospheric Breathing Room." 

- **Grid:** A 12-column grid on desktop, 6-column on tablet, and 2-column on mobile. 
- **Rhythm:** Spacing follows an 8px base unit. Components are grouped into "Atmospheric Layers"—related data points (e.g., humidity, wind, UV) are grouped with `stack-sm`, while distinct forecast blocks use `stack-lg`.
- **Responsive Behavior:** On mobile, the `display-temp` and current conditions card occupy the top 50% of the viewport, with detailed forecast lists appearing below in a scrollable vertical stack.

## Elevation & Depth
Depth is created through **Tonal Layers** and **Glassmorphism**, rather than traditional heavy shadows.

- **Background:** Solid, neutral light gray (`#F1F5F9`).
- **Cards (Tier 1):** White background with a 1px border (`#E2E8F0`). Subtle 4% opacity shadow for a "lifted" feel.
- **Overlays/Modals (Tier 2):** Frosted glass effect (Backdrop-filter: blur 12px) with a semi-transparent white fill (80% opacity).
- **AI Skycast Elements:** Use a subtle inner-glow effect in the AI Violet color to distinguish them from the physical world data.

## Shapes
The shape language is "Soft-Scientific." We avoid harsh geometric corners to keep the brand feeling accessible and calm. 

Standard components (buttons, small cards) use a **0.5rem (8px)** radius. Larger data containers and AI-insight cards use an expanded **1rem (16px)** to **1.5rem (24px)** radius, creating a distinct "capsule" look that feels modern and safe.

## Components
- **Weather Cards:** Large cards (24px radius) containing icons, temperatures, and text. Backgrounds are white, but include a thin colored "Status Bar" on the left or top edge to denote severity (WCAG compliant).
- **AI Skycast Insight:** Styled with a distinct violet border and a subtle grain texture to signify machine-learning origin.
- **Data Chips:** Small, pill-shaped labels for "Wind Speed" or "UV Index," using `label-caps` typography.
- **Action Buttons:** Primary actions are solid Slate (`#0F172A`). Secondary actions use a ghost-border style with 8px rounding.
- **Iconography:** Line-based icons with a consistent 2px stroke. Weather icons (Sun, Clouds, Rain) should use a subtle two-tone treatment, using the semantic colors defined in the palette.
- **Severity Badges:** Must include both a text label (e.g., "HIGH RISK") and a specific icon (e.g., an exclamation triangle) to ensure accessibility for color-blind users.