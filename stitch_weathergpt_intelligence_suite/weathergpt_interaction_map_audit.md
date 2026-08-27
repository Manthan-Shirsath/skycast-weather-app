# WeatherGPT Interaction Audit & Master Flow Map

## 1. Global Navigation Architecture
| Target | Mobile (Bottom Nav) | Desktop (Top/Side Nav) | Interaction | Back Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Home** | Home Tab | "Home" Link | Resets scroll, updates context. | Exit App |
| **AI** | AI Tab | "WeatherGPT" | Focuses input, auto-submits chips. | Home |
| **Forecast** | More > Forecast | "Forecast" | Opens detailed breakdown. | Previous |
| **Map** | Map Tab | "Map" | Full-bleed map view. | Home |
| **Alerts** | Alerts Tab | "Alerts" | Filterable hazard list. | Home |
| **Settings** | More > Settings | "Settings" | Full-screen preferences. | Previous |

---

## 2. Core Interaction Matrix

### A. Home Screen (Command Center)
| Element | Click/Tap Action | Destination / State | Loading State | Success State |
| :--- | :--- | :--- | :--- | :--- |
| **Location Name** | Tap | Location Selector (Sheet/Modal) | Skeleton Header | Updated Context |
| **Weather Hero** | Tap | Detailed Weather Page | Page Skeleton | Full Metrics Reveal |
| **AI Search Bar** | Tap | AI Chat (Focus Input) | Inline Cursor | Conversation View |
| **Suggestion Chip** | Tap | AI Chat (Auto-submit) | Sparkle Pulse | AI Response Card |
| **Rain Chance** | Tap | Forecast (Precipitation Sec) | Section Skeleton | Rain Timeline |
| **Weather Risk** | Tap | Skycast Risk Detail Page | Page Skeleton | Risk Breakdown |
| **7-Day Item** | Tap | Daily Detail Page | Page Skeleton | 24h Timeline |
| **Alert Card** | Tap | Alert Detail Page | Page Skeleton | Hazard Details |

### B. AI Intelligence (Conversational)
| Element | Click/Tap Action | Destination / State | Thinking State | Result State |
| :--- | :--- | :--- | :--- | :--- |
| **Submit Input** | Tap/Enter | Message Bubble | "Checking forecast..." | Response + Card |
| **Weather Card** | Tap "Details" | Detailed Weather Page | Page Skeleton | Current Metrics |
| **Forecast Card** | Tap "Full View"| Detailed Forecast Page | Page Skeleton | 7-Day / Hourly |
| **Risk Card** | Tap "Learn More"| Skycast Risk Detail Page | Page Skeleton | Logic Breakdown |
| **Alert Card** | Tap "View" | Alert Detail Page | Page Skeleton | Official Warning |
| **Comparison Card**| Tap "Explore" | Comparison Detail View | Section Skeleton | Side-by-side Table |

### C. Live Weather Map (GIS)
| Element | Click/Tap Action | Destination / State | Desktop | Mobile |
| :--- | :--- | :--- | :--- | :--- |
| **Map Pin/Point** | Tap | Location Intelligence Panel | Right Side Panel | Bottom Sheet |
| **Layer Switcher** | Tap | Update Map Visualization | Fade Transition | Layer Toggle Bar |
| **"View Forecast"** | Tap | Detailed Forecast (Location) | Full Page | Full Page |
| **"Ask AI"** | Tap | AI Chat (Location Context) | Full Chat View | Full Chat View |
| **Timeline Slider** | Drag | Temporal Map Update | Live Scrim | Live Scrim |

### D. Agriculture Advisor (Intelligence)
| Element | Click/Tap Action | Destination / State | Processing State | Success State |
| :--- | :--- | :--- | :--- | :--- |
| **Crop/Stage Sel.** | Select | Dropdown Menu | - | Selection Update |
| **"Get AI Advice"** | Tap | AI Processing Overlay | "Analyzing field..." | Advisory Card |
| **Advisory Card** | Tap "Ask AI" | AI Chat (Agri Context) | Sparkle Transition | Follow-up Chat |

---

## 3. Global System States & Recovery

| State | Trigger | UI Response | Recovery Action |
| :--- | :--- | :--- | :--- |
| **Loading** | Navigation/Fetch | Skeleton Placeholders | Auto-on-complete |
| **Error** | API Failure | "Weather data is taking a break" | [Try Again] Button |
| **Offline** | No Connection | Persistent Banner | Auto-reconnect |
| **Stale Data** | >15m Cache | "Updated 24m ago" Banner | [Refresh] Icon |
| **No Results** | Empty Search | "City not found" Illustration | [Try Current Location] |
| **Permission** | Location Request | Contextual Dialog (Explanation) | [Allow] / [Manual Search] |

---

## 4. Back Navigation Logic
*   **Standard Pages**: Back button returns to the previous screen in history.
*   **Modals/Sheets**: [X] or Swipe-down closes the overlay, preserving the parent screen state.
*   **AI Chat**: Back returns to Home, but preserves the conversation thread in "Recent Chats".
*   **Map**: Back from a location panel simply deselects the location on the map.
