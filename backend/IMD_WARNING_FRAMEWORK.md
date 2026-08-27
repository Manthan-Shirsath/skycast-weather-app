# India Meteorological Department (IMD) Warning Framework & Skycast Risk Model

## 1. Document Overview & Legal Disclaimer

This document specifies the meteorological warning criteria, impact-based frameworks, and hazard classifications published by the **India Meteorological Department (IMD)**, Ministry of Earth Sciences, Government of India, and how they are utilized in the **Skycast Weather Risk Engine**.

> [!IMPORTANT]
> **DISCLAIMER**:
> - Skycast weather risks are **derived computational risk assessments** calculated from free, open numerical weather prediction (NWP) datasets (primarily Open-Meteo).
> - Skycast alerts are **NOT official IMD warnings, government advisories, or statutory emergency bulletins**.
> - Official IMD warnings can incorporate real-time radar imagery, Doppler radar velocity, satellite infrared loops, river gauge levels, soil moisture saturation models, and human forecaster expertise that are outside our open data pipeline.
> - For official civil protection and disaster response directives, always refer directly to [mausam.imd.gov.in](https://mausam.imd.gov.in) and the National Disaster Management Authority (NDMA).

---

## 2. Official IMD Source Documents

The rules and thresholds in this engine are derived strictly from published IMD documents:

1. **IMD Standard Operating Procedure (SOP) for Weather Forecasting and Warning Services**
   - Source: *India Meteorological Department, Ministry of Earth Sciences, New Delhi*
   - Document: `https://mausam.imd.gov.in/imd_latest/contents/pdf/forecasting_sop.pdf`
2. **IMD Impact-Based Forecasting (IBF) & District-Wise Warning Guidance**
   - Document: `https://mausam.imd.gov.in/imd_latest/contents/districtwise-warning_mc.php`
3. **IMD Terminology & Meteorological Glossary for Rainfall, Heatwaves, Coldwaves, Fog, and Squall**
   - Source: *IMD Numerical Weather Prediction & Public Weather Services Division*

---

## 3. Four-Colour Warning Code System

IMD uses a universal four-colour code to convey risk severity and recommended administrative/public actions:

| Colour Code | IMD Meaning | Skycast Action Directive | Semantic Definition |
| :--- | :--- | :--- | :--- |
| 🟢 **GREEN** | **No Warning** | **No Action** | Meteorological conditions are within normal climatological bounds. No severe weather expected. |
| 🟡 **YELLOW** | **Watch** | **Be Updated** | Potentially hazardous weather. The public and local authorities should keep track of weather updates. |
| 🟠 **ORANGE** | **Alert** | **Be Prepared** | Severe weather expected. Significant disruption to transport, power, and low-lying drainage possible. |
| 🔴 **RED** | **Warning** | **Take Action** | Extremely severe/dangerous weather. High threat to life and property. Immediate protective action required. |

---

## 4. IMD Meteorological Hazard Classifications & Skycast Implementation

### A. 24-Hour Rainfall Hazard Classification (IMD Standard)

According to the IMD SOP (Section 4.1):

| Category | 24-Hour Rainfall ($R_{24h}$) | IMD Hazard Classification |
| :--- | :--- | :--- |
| **Very Light Rain** | $0.1 \text{ to } 2.4 \text{ mm}$ | `very_light_rain` |
| **Light Rain** | $2.5 \text{ to } 15.5 \text{ mm}$ | `light_rain` |
| **Moderate Rain** | $15.6 \text{ to } 64.4 \text{ mm}$ | `moderate_rain` |
| **Heavy Rain** | $64.5 \text{ to } 115.5 \text{ mm}$ | `heavy_rain` |
| **Very Heavy Rain** | $115.6 \text{ to } 204.4 \text{ mm}$ | `very_heavy_rain` |
| **Extremely Heavy Rain** | $\ge 204.5 \text{ mm}$ | `extremely_heavy_rain` |

---

### B. Urban Impact-Based Rainfall Framework (Profile: `urban`)

In urban flood-prone cities (e.g., Pune, Mumbai, Delhi, Bengaluru, Chennai, Kolkata, Hyderabad, Ahmedabad), concrete surfaces and drainage limitations cause localized flash flooding at lower thresholds than rural areas:

| 24h Rainfall Accumulation | Hazard Classification | Skycast Risk Level | IMD Risk Colour |
| :--- | :--- | :--- | :--- |
| $\ge 50.0 \text{ mm}$ and $< 70.0 \text{ mm}$ | `heavy_rain` (Urban threshold) | `yellow` | 🟡 **Yellow — Be Updated** |
| $\ge 70.0 \text{ mm}$ and $< 120.0 \text{ mm}$ | `heavy_rain` / `very_heavy_rain` | `orange` | 🟠 **Orange — Be Prepared** |
| $\ge 120.0 \text{ mm}$ | `very_heavy_rain` / `extremely_heavy_rain` | `red` | 🔴 **Red — Take Action** |

*Limitations*: Localized drainage capacity, lake overflow, and sub-hourly intensity peaks ($>30\text{mm/hr}$) are not captured by standard 24h totals.

---

### C. Hilly & Landslide-Vulnerable Framework (Profile: `hilly_landslide_vulnerable`)

Applicable strictly to designated mountainous districts (e.g., Srinagar, Shimla, Darjeeling, Uttarakhand/Himachal hill tracts):

| 24h Rainfall Accumulation | Hazard Classification | Skycast Risk Level | IMD Risk Colour |
| :--- | :--- | :--- | :--- |
| $\ge 50.0 \text{ mm}$ and $< 100.0 \text{ mm}$ | `heavy_rain` | `yellow` | 🟡 **Yellow — Be Updated** |
| $\ge 100.0 \text{ mm}$ and $< 150.0 \text{ mm}$ | `very_heavy_rain` | `orange` | 🟠 **Orange — Be Prepared** |
| $\ge 150.0 \text{ mm}$ | `extremely_heavy_rain` | `red` | 🔴 **Red — Take Action** |

---

### D. Cold Desert / Ladakh Vulnerable Zone Framework (Profile: `ladakh_vulnerable`)

In arid, high-altitude cold deserts (e.g., Leh, Kargil), even low rainfall causes severe debris flows and mudslides:

| 24h Rainfall Accumulation | Hazard Classification | Skycast Risk Level | IMD Risk Colour |
| :--- | :--- | :--- | :--- |
| $= 15.0 \text{ mm}$ | `ladakh_heavy_rain` | `yellow` | 🟡 **Yellow — Be Updated** |
| $16.0 \text{ to } 30.0 \text{ mm}$ | `ladakh_very_heavy_rain` | `orange` | 🟠 **Orange — Be Prepared** |
| $> 30.0 \text{ mm}$ | `ladakh_extremely_heavy_rain`| `red` | 🔴 **Red — Take Action** |

---

### E. Wind & Squall Hazard Classification

IMD defines a **squall** as a sudden increase in wind speed of at least $29\text{ km/h}$ ($16\text{ knots}$) reaching $\ge 40\text{ km/h}$ and lasting at least one minute.

| Wind Gust Velocity ($V_{gust}$) | IMD Classification | Skycast Risk Level | Risk Colour |
| :--- | :--- | :--- | :--- |
| $41 \text{ to } 61 \text{ km/h}$ | `moderate_squall` | `yellow` | 🟡 **Yellow — Be Updated** |
| $62 \text{ to } 87 \text{ km/h}$ | `severe_squall` | `orange` | 🟠 **Orange — Be Prepared** |
| $\ge 88 \text{ km/h}$ | `very_severe_squall` | `red` | 🔴 **Red — Take Action** |

---

### F. Heat Wave Criteria

**Plains Requirement**: Maximum temperature $T_{max} \ge 40^\circ\text{C}$.
- **Departure from Normal**:
  - $+4.5^\circ\text{C} \text{ to } +6.4^\circ\text{C} \implies$ `heat_wave` (Orange)
  - $\ge +6.5^\circ\text{C} \implies$ `severe_heat_wave` (Red)
- **Absolute Maximum Temperature (Plains)**:
  - $T_{max} \ge 45.0^\circ\text{C} \implies$ `heat_wave` (Orange)
  - $T_{max} \ge 47.0^\circ\text{C} \implies$ `severe_heat_wave` (Red)
- **Coastal Stations Requirement**: $T_{max} \ge 37^\circ\text{C}$ and Departure $\ge +4.5^\circ\text{C}$.
- **Hilly Stations Requirement**: $T_{max} \ge 30^\circ\text{C}$ and Departure $\ge +4.5^\circ\text{C}$.

*Limitations*: Official IMD declaration requires criteria to be met at $\ge 2$ stations in a meteorological subdivision for $\ge 2$ consecutive days. Skycast evaluates single-station forecast values and marks departure calculations with `requires_climatology` when 30-year normal baselines are unavailable.

---

### G. Cold Wave Criteria

**Plains Requirement**: Minimum temperature $T_{min} \le 10^\circ\text{C}$.
- **Departure from Normal**:
  - $-4.5^\circ\text{C} \text{ to } -6.4^\circ\text{C} \implies$ `cold_wave` (Orange)
  - $\le -6.5^\circ\text{C} \implies$ `severe_cold_wave` (Red)
- **Absolute Minimum Temperature (Plains)**:
  - $T_{min} \le 4.0^\circ\text{C} \implies$ `cold_wave` (Orange)
  - $T_{min} \le 2.0^\circ\text{C} \implies$ `severe_cold_wave` (Red)
- **Hilly Stations Requirement**: $T_{min} \le 0^\circ\text{C}$.

---

### H. Fog & Visibility Classification

According to IMD SOP Section 4.5:

| Surface Visibility ($V$) | IMD Classification | Skycast Risk Level |
| :--- | :--- | :--- |
| $500 \text{ to } 999 \text{ m}$ | `shallow_fog` | `yellow` (Minor transit delays) |
| $200 \text{ to } 499 \text{ m}$ | `moderate_fog` | `yellow` (Airport/highway advisory) |
| $50 \text{ to } 199 \text{ m}$ | `dense_fog` | `orange` (Severe flight & rail delays) |
| $< 50 \text{ m}$ | `very_dense_fog` | `red` (Near-zero visibility / hazardous) |

---

## 5. Summary of Supported vs Unsupported Rules

| Meteorological Hazard | IMD Source Rule | Skycast Engine Status | Data Source Used |
| :--- | :--- | :--- | :--- |
| **24h Rainfall Accumulation** | IMD SOP Section 4.1 | **Supported ✅** | Open-Meteo `precipitation_sum`, `precipitation` |
| **Urban Impact Rainfall** | IMD IBF Urban Guidelines | **Supported ✅** | Open-Meteo 24h precipitation + urban profile |
| **Hilly/Landslide Rainfall** | IMD Hilly Warning SOP | **Supported ✅** | Open-Meteo 24h precipitation + hilly profile |
| **Ladakh Arid Rainfall** | IMD Ladakh Warning Guide | **Supported ✅** | Open-Meteo 24h precipitation + ladakh profile |
| **Squall & Wind Gusts** | IMD Wind Hazard Matrix | **Supported ✅** | Open-Meteo `wind_gusts_10m`, `wind_speed_10m` |
| **Absolute Heat Wave** | IMD Heatwave Protocol | **Supported ✅** | Open-Meteo `temperature_2m_max` |
| **Absolute Cold Wave** | IMD Coldwave Protocol | **Supported ✅** | Open-Meteo `temperature_2m_min` |
| **Surface Fog / Visibility** | IMD Fog Classification | **Supported ✅** | Open-Meteo `visibility` (meters) |
| **Thunderstorm Convection** | IMD Convective Weather SOP | **Supported ✅** | WMO weather codes (95, 96, 99) + gusts |
| *Departure Heat/Cold Wave* | IMD Climatological Departure | *Requires Climatology ⚠️* | Active fallback to Absolute $T_{max}/T_{min}$ |
| *Lightning Strike Density* | IMD Lightning / Damini feed | *Unsupported ❌* | No free real-time sensor API; not inferred |
| *Flash Flood Guidance (FFG)* | IMD Central Water Commission FFG | *Unsupported ❌* | Soil moisture & catchment runoff unavailable |
