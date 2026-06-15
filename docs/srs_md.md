# SRS.md
# DisasterShield — Software Requirements Specification

**Version:** 1.0
**Date:** 2024
**Status:** Approved for Development

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) defines the complete functional and non-functional requirements for DisasterShield — a web-based disaster resilience platform for MSMEs in rural and hilly regions near Pune, Maharashtra. This document serves as the contractual baseline between stakeholders and the development team. All features built must trace back to a requirement defined here.

### 1.2 Scope
DisasterShield serves two user roles:
- **MSME Shop Owners** — small business owners in disaster-prone areas
- **LRDB Officers** — Local Disaster Resilient Government Body officials

The system provides personalised disaster alerts, inventory risk management, business continuity planning, community chat, voice/video communication, and regional disaster impact analysis.

### 1.3 Definitions & Acronyms

| Term | Definition |
|---|---|
| MSME | Micro, Small and Medium Enterprise |
| LRDB | Local Disaster Resilient Government Body |
| BCP | Business Continuity Plan |
| SOS | Emergency distress signal triggered by an MSME owner |
| UUID | Universally Unique Identifier (v4) |
| regionCode | Internal geographic key derived from district + taluka (e.g. `pune-mulshi`) |
| LLM | Large Language Model — used for AI alert generation and BCP creation |
| Stream | getstream.io — third-party SDK for chat, voice, and video |
| IMD | India Meteorological Department |
| OSM | OpenStreetMap |
| DEM | Digital Elevation Model |

### 1.4 References

| Document | Purpose |
|---|---|
| `PROJECT_OVERVIEW.md` | Technology stack and project goals |
| `ARCHITECTURE.md` | System architecture, routing, auth, and data flow |
| `DATABASE.md` | Full Prisma schema and database design decisions |
| `DESIGN_SYSTEM.md` | UI components, color tokens, and design standards |
| `COMPONENTS.md` | Reusable component inventory and prop definitions |
| `MSME_MODULE.md` | MSME page-by-page specifications |
| `LRDB_MODULE.md` | LRDB page-by-page specifications |
| `CHAT_MODULE.md` | Chat, voice, video, and SOS specifications |

---

## 2. Overall Description

### 2.1 Product Perspective
DisasterShield is a standalone web application with two tightly integrated subsystems:
1. **Remix Frontend** — Full-stack React application with SSR, serving the UI for both roles
2. **Python FastAPI Backend** — AI/ML service handling alert generation, risk scoring, BCP creation, financial forecasting, location enrichment, and trend analysis

Both subsystems share a single **MySQL 8.0** database. Real-time communication is handled by **Stream SDK**. Weather data is sourced from **Meteosource API**. Location intelligence is sourced from **Nominatim**, **Overpass API**, **Open-Elevation**, and **OpenTopoData**.

### 2.2 Product Functions Summary

| Function | MSME | LRDB |
|---|---|---|
| Google OAuth authentication | ✓ | ✓ |
| Business profile management | ✓ | — |
| GPS + manual location capture | ✓ | — |
| Location enrichment (batch) | ✓ | — |
| Inventory (stock) management | ✓ | — |
| AI-generated personalised alerts | ✓ | ✓ (create) |
| Business Continuity Plan | ✓ | — |
| Risk profiling & scoring | ✓ | — |
| Financial loss forecasting | ✓ | — |
| Local disaster trend analysis | ✓ | ✓ |
| Real-time chat | ✓ | ✓ |
| Voice & video calls | ✓ | ✓ |
| SOS emergency broadcast | ✓ (send) | ✓ (receive) |
| Shop directory | — | ✓ |
| Query management | ✓ (submit) | ✓ (manage) |
| Disaster reports | — | ✓ |
| Regional estimation | — | ✓ |
| Email notifications | ✓ | ✓ |
| Multilingual UI | ✓ | ✓ |

### 2.3 User Classes

#### MSME Owner
- Low-to-moderate tech literacy
- Primary access via mobile browser (375px viewport)
- Speaks Marathi or Hindi (primary), English (secondary)
- Needs simple, fast, action-oriented UI
- Critical journeys: Receiving alerts → Acting on them → Sending SOS

#### LRDB Officer
- Moderate-to-high tech literacy
- Primary access via desktop browser (1280px+)
- Needs data-dense, analytical UI
- Critical journeys: Monitoring shops → Managing queries → Creating alerts → Coordinating via chat

### 2.4 Operating Environment
- **Browser support:** Chrome 110+, Firefox 110+, Safari 16+, Edge 110+
- **Mobile support:** iOS Safari 16+, Android Chrome 110+
- **Network:** Minimum 3G connection for core functionality; 4G recommended for voice/video calls
- **Server:** Node.js 20+ (Remix), Python 3.11+ (FastAPI), MySQL 8.0+

### 2.5 Design & Implementation Constraints
1. All AI/ML processing runs in the Python backend — never in the browser
2. Stream SDK is initialized client-side only — never during SSR
3. UUIDs are generated server-side only — never on the client
4. All forms use Remix `<Form />` and submit to `action` functions — no client-side API calls from forms
5. All styling via Tailwind utility classes — no inline styles
6. All charts use MUI X Charts exclusively — no other charting library
7. Multilingual support (Marathi/Hindi/English) required for all user-facing text
8. MSME module must be fully functional on a 375px mobile screen

---

## 3. Functional Requirements

Requirements are identified as `FR-{MODULE}-{NUMBER}`.
- `AUTH` — Authentication
- `REG` — Registration & Onboarding
- `DASH` — Dashboard
- `STOCK` — Stock Management
- `BCP` — Business Continuity Plan
- `ALERT` — Alerts
- `CHAT` — Chat, Voice & Video
- `RISK` — Risk Profiling
- `TREND` — Trends
- `FORE` — Forecasts & Estimates
- `SET` — Settings
- `LRDB` — LRDB Module (all pages)
- `LOC` — Location Intelligence
- `NOTIF` — Notifications

---

### 3.1 Authentication Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | The system shall support Google OAuth 2.0 as the sole login method for both MSME owners and LRDB officers | Must Have |
| FR-AUTH-02 | Upon first successful Google login, the system shall generate a UUIDv4 and permanently assign it to the user record | Must Have |
| FR-AUTH-03 | The system shall create an HTTP-only, signed session cookie upon successful authentication | Must Have |
| FR-AUTH-04 | Session cookies shall expire after 7 days of inactivity | Must Have |
| FR-AUTH-05 | The system shall redirect unauthenticated users attempting to access protected routes to `/login` | Must Have |
| FR-AUTH-06 | The system shall validate that the `$userId` / `$officerId` URL parameter matches the authenticated session UUID on every protected page load | Must Have |
| FR-AUTH-07 | The system shall redirect users to their role-appropriate dashboard after login (MSME → `/msme/$userId/dashboard`, LRDB → `/lrdb/$officerId/shops`) | Must Have |
| FR-AUTH-08 | The system shall provide a logout function that destroys the session cookie and redirects to `/login` | Must Have |
| FR-AUTH-09 | The system shall upsert a corresponding Stream user record upon each successful login | Must Have |
| FR-AUTH-10 | The system shall redirect already-authenticated users away from `/login` to their dashboard | Should Have |

---

### 3.2 Registration & Onboarding Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-REG-01 | The registration flow shall consist of four sequential steps: Role Selection, Business Details, Location, Preferences & Emergency Contact | Must Have |
| FR-REG-02 | The system shall support two roles at registration: MSME Owner and LRDB Officer | Must Have |
| FR-REG-03 | The system shall collect shop name, category, owner name, and phone number during Business Details (Step 2) | Must Have |
| FR-REG-04 | The system shall request browser geolocation permission at the start of the Location step (Step 3) | Must Have |
| FR-REG-05 | On GPS success, the system shall call Nominatim reverse geocoding and display the resolved location name on a Leaflet map for user confirmation | Must Have |
| FR-REG-06 | On GPS failure or denial, the system shall provide a manual location entry option with a draggable Leaflet map pin | Must Have |
| FR-REG-07 | The system shall call Open-Elevation API to retrieve the shop's elevation in metres during the location step | Must Have |
| FR-REG-08 | The system shall collect building type, roof type, shop floor level, storage floor level, power supply type, and connectivity type during Step 3C | Must Have |
| FR-REG-09 | The system shall collect at least one emergency contact (name, phone, relationship) during Step 4 | Must Have |
| FR-REG-10 | The system shall support language selection (Marathi / Hindi / English) during Step 4 | Must Have |
| FR-REG-11 | On registration completion, the system shall trigger the location enrichment batch job (non-blocking) | Must Have |
| FR-REG-12 | On registration completion, the system shall call the Python backend to generate an initial RiskProfile, BCPPlan, and ForecastScenario set | Must Have |
| FR-REG-13 | On registration completion, the system shall assign the user to their proximity-based LOCAL_MSME Stream channel based on their regionCode | Must Have |
| FR-REG-14 | On registration completion, the system shall send a welcome email via SMTP | Must Have |
| FR-REG-15 | All registration form fields shall be validated using Zod schemas before submission | Must Have |
| FR-REG-16 | The registration step indicator shall show progress (e.g. Step 2 of 4) at all times | Should Have |
| FR-REG-17 | The system shall pre-fill the owner name field with the Google profile display name | Should Have |
| FR-REG-18 | The system shall display a `NotificationBanner` on the dashboard informing the user that location enrichment is in progress | Should Have |

---

### 3.3 Dashboard Requirements (MSME)

| ID | Requirement | Priority |
|---|---|---|
| FR-DASH-01 | The dashboard shall display the current overall risk score from the user's RiskProfile | Must Have |
| FR-DASH-02 | The dashboard shall display a count of unread alerts issued today | Must Have |
| FR-DASH-03 | The dashboard shall display the top 3 unread AlertCards in collapsed form | Must Have |
| FR-DASH-04 | The dashboard shall display an inventory safety summary with a BarChart of stock vulnerability levels | Must Have |
| FR-DASH-05 | The dashboard shall display Quick Action buttons: Send SOS, Notify Employees, View Safety Plan, Call LRDB | Must Have |
| FR-DASH-06 | The SOSButton on the dashboard shall trigger the full SOS flow defined in CHAT_MODULE.md Section 10 | Must Have |
| FR-DASH-07 | The dashboard shall display a community activity preview showing the last 2 messages from the user's LOCAL_MSME channel | Must Have |
| FR-DASH-08 | The dashboard shall display a RadarChart with 5 risk dimensions from the user's RiskProfile | Must Have |
| FR-DASH-09 | The dashboard shall display a LineChart of the last 30 days of rainfall TrendDataPoints for the user's regionCode | Must Have |
| FR-DASH-10 | The dashboard shall display an estimated potential loss figure from the top ForecastScenario | Must Have |
| FR-DASH-11 | All dashboard sections shall show LoadingSkeleton components while data is being fetched | Must Have |
| FR-DASH-12 | The dashboard greeting shall be time-aware (Good morning / afternoon / evening) | Should Have |
| FR-DASH-13 | If a critical alert is active, the dashboard shall display a full-width NotificationBanner at the top | Must Have |

---

### 3.4 Stock Management Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-STOCK-01 | The system shall allow MSME owners to add stock items with name, category, quantity, unit, estimated value, and storage location | Must Have |
| FR-STOCK-02 | Each stock item shall support assignment of one or more disaster sensitivity types (water, heat, fragile, perishable, flammable, theft, humidity) | Must Have |
| FR-STOCK-03 | The system shall display a vulnerability score (0–100) for each stock item as a colour-coded Progress bar | Must Have |
| FR-STOCK-04 | The system shall support expiry date tracking for items with PERISHABLE sensitivity | Must Have |
| FR-STOCK-05 | Items with expiry within 7 days shall be highlighted with a status-critical background | Must Have |
| FR-STOCK-06 | The system shall allow MSME owners to edit and delete stock items | Must Have |
| FR-STOCK-07 | Deleting a stock item shall trigger recomputation of the shop's RiskProfile via the Python backend | Must Have |
| FR-STOCK-08 | Adding or editing a stock item shall trigger recomputation of RiskProfile and ForecastScenario via the Python backend | Must Have |
| FR-STOCK-09 | The stock list shall support filtering by category, sensitivity type, and sorting by name, value, vulnerability, and expiry | Must Have |
| FR-STOCK-10 | The stock list shall display as a Table on desktop and a card list on mobile | Must Have |
| FR-STOCK-11 | The stock item detail page shall display AI-generated storage recommendations from the Python risk package | Must Have |
| FR-STOCK-12 | The stock item detail page shall display a disaster impact simulation for flood, power outage, and windstorm scenarios | Should Have |
| FR-STOCK-13 | The system shall display total item count and total estimated inventory value as StatTile components | Must Have |
| FR-STOCK-14 | All stock forms shall validate using the Zod stockItemSchema | Must Have |

---

### 3.5 Business Continuity Plan Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-BCP-01 | The system shall generate a personalised BCP for each shop via the Python `POST /bcp/generate` endpoint | Must Have |
| FR-BCP-02 | The BCP shall contain three phases: Before Disaster, During Disaster, After Disaster | Must Have |
| FR-BCP-03 | Each BCP phase shall contain a list of BCPStep records rendered as TimelineStep components with checkboxes | Must Have |
| FR-BCP-04 | Toggling a BCP step shall persist the completion state to `BCPStep.isCompleted` in MySQL | Must Have |
| FR-BCP-05 | The system shall calculate and display overall BCP completion percentage | Must Have |
| FR-BCP-06 | The system shall display per-phase completion counts as StatTile components | Must Have |
| FR-BCP-07 | The system shall allow the user to regenerate their BCP, which calls the Python backend and replaces all existing BCPStep records | Must Have |
| FR-BCP-08 | Regenerating the BCP shall trigger a BCP ready email notification | Must Have |
| FR-BCP-09 | The BCP page shall display the user's emergency contacts with phone links | Must Have |
| FR-BCP-10 | The system shall provide a "Download as PDF" option for the BCP | Should Have |
| FR-BCP-11 | The system shall provide a "Share via WhatsApp" option for the BCP summary | Should Have |
| FR-BCP-12 | Optional BCP steps shall be clearly labelled as optional | Should Have |

---

### 3.6 Alert Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-ALERT-01 | The Python APScheduler batch job shall run every hour and call Meteosource for each distinct regionCode | Must Have |
| FR-ALERT-02 | The batch job shall generate alerts when rainfall exceeds 20mm/hr or wind exceeds 40kmph for a region | Must Have |
| FR-ALERT-03 | Each generated alert shall be personalised using the shop's LocationProfile, StockItem list, and StockSensitivity records | Must Have |
| FR-ALERT-04 | Each alert shall include a title, severity, category, AI-generated summary, and a list of affected stock items | Must Have |
| FR-ALERT-05 | Each alert shall include one or more AlertAction records that the MSME owner can complete | Must Have |
| FR-ALERT-06 | AlertAction completion shall be persisted per recipient via AlertActionResult records | Must Have |
| FR-ALERT-07 | The MSME Alerts list page shall display alerts grouped by date (Today / Yesterday / This Week / Older) | Must Have |
| FR-ALERT-08 | The MSME Alerts list shall support filtering by: All, Unread, Critical, Flood, Power, Wind, Resolved | Must Have |
| FR-ALERT-09 | Unread alerts shall be visually differentiated with a coloured left border | Must Have |
| FR-ALERT-10 | The alert detail page shall display all stock items affected by the alert with estimated damage per item | Must Have |
| FR-ALERT-11 | The alert detail page shall provide a "Request Support from LRDB" action that pre-fills a query | Must Have |
| FR-ALERT-12 | The LRDB officer shall be able to create alerts manually via the alert creation Dialog | Must Have |
| FR-ALERT-13 | The LRDB officer shall be able to use AI enhancement on their alert draft via Python `POST /alerts/generate` | Must Have |
| FR-ALERT-14 | The system shall track alert read rate and action completion rate per alert (visible to LRDB) | Must Have |
| FR-ALERT-15 | The LRDB officer shall be able to send follow-up reminders to unread alert recipients | Should Have |
| FR-ALERT-16 | Alerts shall support an optional expiry timestamp after which they are no longer active | Should Have |
| FR-ALERT-17 | The system shall display alert delivery performance as a BarChart (delivered vs failed per channel) | Should Have |
| FR-ALERT-18 | The Meteosource location ID shall be cached in LocationProfile after first lookup | Must Have |

---

### 3.7 Chat Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-CHAT-01 | All chat features shall be powered by the Stream SDK and rendered client-side only (ClientOnly wrapper) | Must Have |
| FR-CHAT-02 | Each authenticated user shall have a Stream user identity with ID equal to their MySQL UUID | Must Have |
| FR-CHAT-03 | Stream user tokens shall be generated server-side in Remix loaders and never exposed to the browser directly | Must Have |
| FR-CHAT-04 | The system shall support four channel types: LOCAL_MSME, LRDB_COORDINATION, DIRECT_MESSAGE, SOS_EMERGENCY | Must Have |
| FR-CHAT-05 | All channel IDs shall follow the naming conventions defined in CHAT_MODULE.md Section 5.2 | Must Have |
| FR-CHAT-06 | MSME owners shall be automatically added to their proximity-based LOCAL_MSME channel on registration | Must Have |
| FR-CHAT-07 | LRDB officers shall be able to create LRDB_COORDINATION groups from the Chat page | Must Have |
| FR-CHAT-08 | Direct message channels shall be created when an LRDB officer contacts an MSME owner via the Shop List | Must Have |
| FR-CHAT-09 | The system shall support message types: normal text, SOS broadcast, system event, LRDB announcement, image attachment, document attachment, location pin | Must Have |
| FR-CHAT-10 | SOS messages shall render as full-width red banners in all channels where they appear | Must Have |
| FR-CHAT-11 | LRDB announcements shall render as pinned banners and be pinned in the Stream channel | Must Have |
| FR-CHAT-12 | The ChatInput component shall support text, file attachments (images and PDFs), and typing indicators | Must Have |
| FR-CHAT-13 | Typing indicators shall be shown when other participants are composing a message | Must Have |
| FR-CHAT-14 | The chat UI shall show relative timestamps on messages (e.g. "2 min ago") | Must Have |
| FR-CHAT-15 | The LRDB Chat sidebar shall support label-based filtering (Emergency, Flood Alert, Volunteer Coordination, etc.) | Must Have |
| FR-CHAT-16 | The LRDB Chat sidebar shall include a dedicated SOS Active tab showing live SOS channels | Must Have |
| FR-CHAT-17 | User online/offline presence shall be shown via StatusIndicator in chat lists and thread headers | Should Have |
| FR-CHAT-18 | Chat group metadata (name, labels, membership) shall be persisted in MySQL ChatGroup, ChatGroupMember, ChatLabel tables | Must Have |
| FR-CHAT-19 | Stream owns all message persistence — messages are not duplicated in MySQL | Must Have |

---

### 3.8 SOS Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-SOS-01 | MSME owners shall be able to trigger an SOS from the Dashboard Quick Actions and from the ChatInput | Must Have |
| FR-SOS-02 | Triggering an SOS shall display an ActionConfirmDialog before sending | Must Have |
| FR-SOS-03 | On SOS confirmation, the system shall create a new SOS_EMERGENCY Stream channel with channel ID `sos-{regionCode}-{timestamp}` | Must Have |
| FR-SOS-04 | The SOS channel shall automatically include all LRDB officers registered for the sender's regionCode | Must Have |
| FR-SOS-05 | The SOS message shall be posted to both the SOS channel and the sender's LOCAL_MSME channel | Must Have |
| FR-SOS-06 | The SOS message shall contain shop name, owner name, location, latitude, longitude, and timestamp | Must Have |
| FR-SOS-07 | An email notification shall be sent to all LRDB officers in the regionCode upon SOS trigger | Must Have |
| FR-SOS-08 | The SOSButton shall enforce a 60-second cooldown after each SOS to prevent spam | Must Have |
| FR-SOS-09 | The LRDB SOS Active Panel shall display nearest hospital, police station, and road access from LocationProfile | Must Have |
| FR-SOS-10 | LRDB officers shall be able to acknowledge an SOS via a "Dispatch Response Team" action | Must Have |
| FR-SOS-11 | SOS channels shall be archived by APScheduler after 24 hours of inactivity | Should Have |
| FR-SOS-12 | Active SOS events shall display a pulsing red Siren indicator on all relevant nav items and chat list items | Must Have |

---

### 3.9 Voice & Video Call Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-CALL-01 | The system shall support voice calls within chat channels using the Stream Video SDK | Must Have |
| FR-CALL-02 | The system shall support video calls within chat channels using the Stream Video SDK | Must Have |
| FR-CALL-03 | Incoming calls shall display a CallBar at the top of the ChatThread with Join and Decline buttons | Must Have |
| FR-CALL-04 | The VideoCallModal shall render participant video tiles in a responsive grid (1: full, 2: side-by-side, 3+: grid) | Must Have |
| FR-CALL-05 | Voice calls shall display participant avatars with audio waveform indicators instead of video tiles | Must Have |
| FR-CALL-06 | Call controls shall include mute, camera toggle (video only), screen share (video only), and leave call | Must Have |
| FR-CALL-07 | The Stream SDK shall handle all WebRTC negotiation, ICE candidate exchange, and reconnection | Must Have |
| FR-CALL-08 | A system message shall be posted to the channel when a call ends, showing call duration | Should Have |
| FR-CALL-09 | All call components shall be wrapped in ClientOnly to prevent SSR errors | Must Have |
| FR-CALL-10 | The LRDB SOS Active Panel shall include a "Call Owner" button initiating a Stream voice call | Must Have |

---

### 3.10 Risk Profiling Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-RISK-01 | The system shall compute a risk score (0–100) for each shop via the Python `POST /risk/score` endpoint | Must Have |
| FR-RISK-02 | The risk score shall incorporate five sub-dimensions: flood, power, stock, location, and access scores | Must Have |
| FR-RISK-03 | The overall risk score shall map to a RiskLevel enum: SAFE (0–24), MODERATE (25–49), HIGH (50–74), CRITICAL (75–100) | Must Have |
| FR-RISK-04 | The system shall display a RadarChart with all five risk dimensions | Must Have |
| FR-RISK-05 | The system shall display AI-generated RiskSuggestion records ordered by impact score descending | Must Have |
| FR-RISK-06 | MSME owners shall be able to mark a RiskSuggestion as actioned, which triggers risk score recomputation | Must Have |
| FR-RISK-07 | The risk detail page shall display a Leaflet map with the shop location, flood-prone zones, and nearest LRDB office | Must Have |
| FR-RISK-08 | The risk score shall be recomputed when stock items are added, edited, or deleted | Must Have |
| FR-RISK-09 | The risk score shall be recomputed when the user actions a risk suggestion | Must Have |
| FR-RISK-10 | A risk score change notification email shall be sent when the risk level (enum) changes | Should Have |
| FR-RISK-11 | The system shall display a comparative insight: "Better than X% of shops in your area" | Should Have |

---

### 3.11 Location Intelligence Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-LOC-01 | The system shall capture shop coordinates via browser geolocation API during registration | Must Have |
| FR-LOC-02 | The system shall call Nominatim to reverse geocode coordinates into village, taluka, district, and pincode | Must Have |
| FR-LOC-03 | The system shall display a Leaflet map with a confirmation pin for the user to verify their location | Must Have |
| FR-LOC-04 | The system shall provide a manual location entry option with a draggable Leaflet map pin | Must Have |
| FR-LOC-05 | The system shall call Open-Elevation API to record the shop's elevation in metres | Must Have |
| FR-LOC-06 | After registration, the system shall trigger a background batch job via APScheduler to enrich the LocationProfile | Must Have |
| FR-LOC-07 | The batch job shall execute a single Overpass API query within 10km radius to find: hospitals, police stations, fire stations, relief centres, LRDB centres, reservoirs, dams, rivers/streams, substations, and road types | Must Have |
| FR-LOC-08 | The batch job shall call OpenTopoData to retrieve terrain slope and aspect | Must Have |
| FR-LOC-09 | The batch job shall derive terrain type (HILLY/FLAT/VALLEY/SLOPE) from slope value | Must Have |
| FR-LOC-10 | The batch job shall cache the Meteosource location ID in LocationProfile after first weather fetch | Must Have |
| FR-LOC-11 | The `LocationProfile.batchStatus` field shall track batch job progress: PENDING → RUNNING → COMPLETE / FAILED | Must Have |
| FR-LOC-12 | The location enrichment batch job shall re-run every 30 days per shop via APScheduler | Must Have |
| FR-LOC-13 | The regionCode shall be derived as `{district}-{taluka}` from Nominatim response, lowercased and hyphenated | Must Have |
| FR-LOC-14 | The LRDB Shop Detail page shall display all LocationProfile amenity distances | Must Have |
| FR-LOC-15 | LocationProfile data (elevation, nearest water body, building type) shall be included in all Python AI request payloads | Must Have |

---

### 3.12 Forecast & Estimation Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-FORE-01 | The system shall generate ForecastScenario records for each shop via Python `POST /forecasts/estimate` | Must Have |
| FR-FORE-02 | Each scenario shall include disaster type, probability, estimated loss (INR), affected item count, downtime days, and recovery timeline | Must Have |
| FR-FORE-03 | Each scenario shall include an AI-generated narrative paragraph | Must Have |
| FR-FORE-04 | The Forecasts page shall display a BarChart of estimated losses by disaster type | Must Have |
| FR-FORE-05 | The Forecasts page shall display ForecastScenarioCard for each scenario, collapsed by default | Must Have |
| FR-FORE-06 | The Forecasts page shall display an Insurance Readiness Score with associated checklist | Must Have |
| FR-FORE-07 | The Forecasts page shall include a client-side Prevention vs Loss Calculator using a slider | Must Have |
| FR-FORE-08 | ForecastScenarios shall be regenerated when stock items change | Must Have |
| FR-FORE-09 | The LRDB Estimation page shall aggregate ForecastScenario data across all shops in the region | Must Have |
| FR-FORE-10 | The LRDB Estimation page shall display a choropleth Leaflet map of loss concentration by area | Must Have |
| FR-FORE-11 | The LRDB Estimation page shall display a resource planning table estimating relief kits, generators, and medical teams needed | Should Have |

---

### 3.13 Trend Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-TREND-01 | The Trends page shall display a 12-month seasonal risk heatmap as a BarChart | Must Have |
| FR-TREND-02 | The Trends page shall display four LineCharts: rainfall, power outages, transport disruptions, flood incidents | Must Have |
| FR-TREND-03 | All trend charts shall source data from TrendDataPoint records filtered by the shop's regionCode | Must Have |
| FR-TREND-04 | The Trends page shall display 3–4 AI-generated insights from Python `GET /trends/{regionCode}` | Must Have |
| FR-TREND-05 | The Trends page shall display a supply chain pattern narrative from the Python trends package | Should Have |
| FR-TREND-06 | TrendDataPoint records shall be append-only — never updated once written | Must Have |

---

### 3.14 LRDB Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-LRDB-01 | All LRDB pages shall be scoped to the officer's regionCode — no cross-region data access in v1 | Must Have |
| FR-LRDB-02 | The LRDB Shop List shall display all ShopProfile records in the officer's region with risk level, last active, and category | Must Have |
| FR-LRDB-03 | The LRDB Shop List shall support filtering by risk level, category, and sorting by multiple fields | Must Have |
| FR-LRDB-04 | The LRDB Shop List shall provide a toggle between list view (Table) and map view (Leaflet with coloured markers) | Must Have |
| FR-LRDB-05 | The LRDB Shop Detail page shall display full LocationProfile amenity data, stock summary, risk profile, BCP status, alert history, and query history | Must Have |
| FR-LRDB-06 | The LRDB officer shall be able to initiate a direct message to any shop owner from the Shop List | Must Have |
| FR-LRDB-07 | The Queries page shall display all queries from shops in the officer's region with priority, status, and type | Must Have |
| FR-LRDB-08 | The officer shall be able to assign a query to themselves with a single button click | Must Have |
| FR-LRDB-09 | Every query status change shall be recorded in QueryStatusHistory with officer ID and timestamp | Must Have |
| FR-LRDB-10 | The system shall send an email to the shop owner on every query status change | Must Have |
| FR-LRDB-11 | The Disaster Reports page shall support creating, editing (DRAFT), publishing, and archiving reports | Must Have |
| FR-LRDB-12 | Published disaster reports shall trigger a broadcast email to all shops in the affected region | Should Have |
| FR-LRDB-13 | The LRDB Estimation page shall aggregate ForecastScenario data by sector and area, displayed as BarCharts | Must Have |
| FR-LRDB-14 | The LRDB Alerts page shall display read rate and action completion rate for each alert | Must Have |
| FR-LRDB-15 | The LRDB Alert creation dialog shall support AI enhancement of the alert body | Must Have |
| FR-LRDB-16 | The LRDB Settings page shall allow officers to configure regional alert thresholds (rain mm/hr, wind kmph) | Should Have |

---

### 3.15 Notification Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-NOTIF-01 | The system shall send email notifications via Nodemailer over SMTP | Must Have |
| FR-NOTIF-02 | Email notifications shall only be sent if the user has `notifyViaEmail = true` | Must Have |
| FR-NOTIF-03 | All sent notifications shall be logged in the NotificationLog table with channel, type, status, and timestamp | Must Have |
| FR-NOTIF-04 | Email notification failures shall be caught and logged — they must never cause a user-facing error | Must Have |
| FR-NOTIF-05 | The system shall send the following email types: welcome, alert, BCP ready, risk score change, query status update, broadcast, SOS received | Must Have |
| FR-NOTIF-06 | All email templates shall include the shop/officer name, a summary of the event, and a deep link back to the relevant page | Must Have |
| FR-NOTIF-07 | The LRDB broadcast mail function shall use `Promise.allSettled` to avoid failing the entire batch if one recipient address is invalid | Must Have |
| FR-NOTIF-08 | The system shall display unread alert count and unread chat message count as badge overlays in the navigation | Must Have |

---

### 3.16 Settings Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-SET-01 | MSME owners shall be able to update their shop profile (name, category, address, phone, GST) | Must Have |
| FR-SET-02 | MSME owners shall be able to switch language (Marathi / Hindi / English) at any time | Must Have |
| FR-SET-03 | Language change shall persist to the user session and MySQL User.language field | Must Have |
| FR-SET-04 | MSME owners shall be able to manage notification preferences per channel (App, Email, SMS, WhatsApp) | Must Have |
| FR-SET-05 | MSME owners shall be able to add, edit, and delete emergency contacts | Must Have |
| FR-SET-06 | MSME owners shall be able to toggle community visibility (show name vs anonymous in chat) | Should Have |
| FR-SET-07 | MSME owners shall be able to toggle LRDB data sharing permission | Should Have |
| FR-SET-08 | MSME owners shall be able to delete their account, triggering cascade deletion of all related data | Must Have |
| FR-SET-09 | LRDB officers shall be able to update their designation, district, and taluka | Must Have |
| FR-SET-10 | LRDB officers shall be able to configure alert thresholds (rain, wind, flood risk radius, cooldown) | Should Have |

---

## 4. Non-Functional Requirements

### 4.1 Performance Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-PERF-01 | Dashboard page shall load (server-rendered HTML delivered) in under 2 seconds on a 4G connection | < 2s |
| NFR-PERF-02 | All Remix loaders shall complete their Prisma queries in under 500ms under normal load | < 500ms |
| NFR-PERF-03 | Chat message delivery latency (send to visible in recipient's thread) shall not exceed 500ms | < 500ms |
| NFR-PERF-04 | The APScheduler hourly alert batch shall complete processing for all shops in a regionCode within 5 minutes | < 5min |
| NFR-PERF-05 | The location enrichment batch job (Overpass + elevation) shall complete per shop within 30 seconds | < 30s |
| NFR-PERF-06 | The Nominatim reverse geocoding call shall return within 3 seconds during registration | < 3s |
| NFR-PERF-07 | Python LLM API calls (alert generation, BCP, risk) shall complete within 10 seconds | < 10s |
| NFR-PERF-08 | Video call connection (WebRTC) shall establish within 5 seconds of joining | < 5s |
| NFR-PERF-09 | All MUI X Charts shall render within 500ms of receiving data | < 500ms |
| NFR-PERF-10 | Skeleton loaders shall be shown immediately (< 100ms) while data is fetching | < 100ms |

### 4.2 Reliability Requirements

| ID | Requirement |
|---|---|
| NFR-REL-01 | The application shall implement `ErrorBoundary` on every Remix route to prevent single-page failures from crashing the entire app |
| NFR-REL-02 | The Prisma client shall use the singleton pattern in `db.server.ts` to prevent connection pool exhaustion during hot module reloading |
| NFR-REL-03 | The APScheduler alert batch shall log every run (success or failure) to the NotificationLog table |
| NFR-REL-04 | If the Meteosource API is unavailable, the alert batch shall skip that run and log the failure — it shall not crash the scheduler |
| NFR-REL-05 | If the Overpass API times out during location enrichment, batchStatus shall be set to FAILED and the job retried on the next 30-day cycle |
| NFR-REL-06 | Email send failures shall be caught with try/catch and logged — they shall never cause a Remix action to return a 500 error |
| NFR-REL-07 | Stream SDK disconnections shall trigger automatic reconnection — the app shall not require a page reload to restore chat |
| NFR-REL-08 | The Python FastAPI server shall return structured error responses (not unhandled exceptions) for all API errors |

### 4.3 Security Requirements

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All session cookies shall be HTTP-only, Secure (in production), and SameSite=Lax |
| NFR-SEC-02 | The STREAM_API_SECRET shall never appear in client-side JavaScript bundles |
| NFR-SEC-03 | The GEMINI_API_KEY and OPENAI_API_KEY shall never be accessible from the Remix frontend |
| NFR-SEC-04 | Every protected route loader shall validate that the URL UUID matches the session UUID |
| NFR-SEC-05 | Stream channel membership shall be enforced server-side — users cannot join channels they were not added to by the server |
| NFR-SEC-06 | LRDB officers cannot access data from regionCodes other than their own |
| NFR-SEC-07 | Account deletion shall cascade-delete all user data from MySQL and disconnect the user from Stream |
| NFR-SEC-08 | All external API keys (Meteosource, Stream) shall be stored in `.env` files and never committed to version control |
| NFR-SEC-09 | The Python FastAPI CORS policy shall only allow the Remix server origin — not browser origins directly |
| NFR-SEC-10 | All Zod schema validations shall run server-side in Remix actions, not just client-side |

### 4.4 Usability Requirements

| ID | Requirement |
|---|---|
| NFR-USE-01 | The MSME module shall be fully operable on a 375px mobile screen without horizontal scrolling |
| NFR-USE-02 | All interactive elements shall have a minimum tap target of 44×44px on mobile |
| NFR-USE-03 | All text shall meet WCAG AA minimum contrast ratio (4.5:1 for normal text, 3:1 for large text) |
| NFR-USE-04 | All interactive elements shall be keyboard navigable with visible focus indicators |
| NFR-USE-05 | The application shall not require training to use — first-time MSME owners shall complete onboarding without assistance |
| NFR-USE-06 | All error messages shall be written in plain language (not technical codes) in the user's selected language |
| NFR-USE-07 | Loading states shall always show skeleton components — never blank white screens |
| NFR-USE-08 | Marathi and Hindi text shall render correctly using Noto Sans Devanagari font |
| NFR-USE-09 | The time to reach an active alert's recommended action from the dashboard shall not exceed 3 taps/clicks |
| NFR-USE-10 | The SOSButton shall be accessible within 2 taps from any page in the MSME module |

### 4.5 Maintainability Requirements

| ID | Requirement |
|---|---|
| NFR-MAIN-01 | All shared UI patterns shall be extracted into named reusable components in `app/components/shared/` — no inline duplication |
| NFR-MAIN-02 | All database schema changes shall be made via Prisma migrations — no manual SQL ALTER TABLE statements |
| NFR-MAIN-03 | All Python AI packages shall follow the `packages/{name}/router.py + service.py + schemas.py` structure |
| NFR-MAIN-04 | All TypeScript code shall compile without errors — `npm run typecheck` shall pass |
| NFR-MAIN-05 | All Zod schemas shall live in `app/lib/schemas/` — validation logic shall not be duplicated in components |
| NFR-MAIN-06 | All hardcoded strings in JSX shall be replaced with `t()` i18n function calls |
| NFR-MAIN-07 | The `app/components/shared/index.ts` barrel export shall be kept up to date as new shared components are added |
| NFR-MAIN-08 | All environment variables shall be documented in `.env.example` files in both the root and `backend/` directories |

### 4.6 Scalability Requirements

| ID | Requirement |
|---|---|
| NFR-SCALE-01 | The alert batch job shall make one Meteosource API call per regionCode per hour — not one per shop |
| NFR-SCALE-02 | The Overpass amenity query shall use a single compound query per shop — not one query per amenity type |
| NFR-SCALE-03 | The Prisma connection pool shall be configured appropriately for the expected concurrent load |
| NFR-SCALE-04 | The broadcast email function shall use `Promise.allSettled` to send to all recipients in parallel |
| NFR-SCALE-05 | Stream handles all real-time message fan-out — DisasterShield shall not implement its own WebSocket server |

---

## 5. User Stories

### 5.1 MSME Owner Stories

| ID | As a... | I want to... | So that... | Acceptance Criteria |
|---|---|---|---|---|
| US-01 | MSME owner | Sign in with my Google account | I don't need to remember a separate password | Google OAuth completes in < 3 seconds. Session cookie set. Redirected to register if new user. |
| US-02 | MSME owner | Set up my shop profile during registration | The app can personalise alerts for my business | All 4 registration steps complete. ShopProfile created in MySQL. regionCode derived from Nominatim. |
| US-03 | MSME owner | Confirm my shop location on a map | I know the app has the right location | GPS detected → Nominatim resolves name → Leaflet map shown → Confirmation accepted or manual correction made. |
| US-04 | MSME owner | Add my inventory to the app | I can receive alerts specific to my stock | Stock items added with sensitivity tags. vulnerabilityScore computed. Risk and forecast recomputed. |
| US-05 | MSME owner | Receive a personalised flood alert | I know exactly which of my products to protect | Alert contains shop-specific stock items, AI summary, and actionable steps in my language. |
| US-06 | MSME owner | See my business risk score | I understand how vulnerable my shop is | RadarChart with 5 dimensions displayed. RiskLevel badge shown. AI suggestions listed. |
| US-07 | MSME owner | Follow a checklist when a disaster happens | I don't forget important steps under pressure | BCP During phase shown as TimelineStep checkboxes. Completion persisted to MySQL. |
| US-08 | MSME owner | Send an SOS to nearby shops and LRDB | I can get help quickly in an emergency | SOS flow completes in < 3 taps. SOS channel created. LRDB officers notified by email. |
| US-09 | MSME owner | Chat with nearby shop owners | We can help each other during a disaster | LOCAL_MSME channel accessible. Messages delivered in < 500ms. |
| US-10 | MSME owner | See how much I could lose in a flood | I can decide if prevention is worth the investment | ForecastScenario for flood displayed with total loss, top affected items, and AI narrative. |
| US-11 | MSME owner | Switch the app to Marathi | I can read everything in my preferred language | Language toggle in settings changes all UI text immediately. Devanagari font renders correctly. |
| US-12 | MSME owner | Download my Business Continuity Plan | I can share it with my family and employees | PDF download triggers. Plan includes all three phases and emergency contacts. |
| US-13 | MSME owner | Get email alerts when a disaster warning is issued | I'm notified even if I'm not using the app | Email delivered within 5 minutes of alert generation. Contains deep link to alert detail page. |
| US-14 | MSME owner | See local disaster trends for my area | I can prepare before the monsoon season | Trend charts show 12 months of rainfall, power outages, and flood incidents for my regionCode. |
| US-15 | MSME owner | Video call my LRDB officer | I can get direct guidance during an emergency | Video call connects within 5 seconds. Camera, mic, and leave controls work correctly. |

### 5.2 LRDB Officer Stories

| ID | As a... | I want to... | So that... | Acceptance Criteria |
|---|---|---|---|---|
| US-16 | LRDB officer | See all shops in my region on a map | I have a geographic overview of business vulnerability | Shop markers coloured by risk level on Leaflet map. Filter by risk level works. |
| US-17 | LRDB officer | See a shop's full location intelligence | I understand their flood exposure and access to emergency services | LocationProfile amenity data (hospital, reservoir, road access) displayed on Shop Detail page. |
| US-18 | LRDB officer | Manage incoming emergency queries | I don't lose track of businesses that need help | Queries listed with priority. "Assign to Me" updates status. Email sent to shop owner. |
| US-19 | LRDB officer | Create a targeted alert for pharmacy shops in my region | Pharmacies get specific guidance, not generic advice | Alert created with category filter. AlertRecipient records created for pharmacy owners only. |
| US-20 | LRDB officer | Use AI to enhance my alert message | My alerts are more actionable and professional | "AI Enhance" button sends draft to Python, returns improved text for review before sending. |
| US-21 | LRDB officer | See which businesses haven't read my alert | I can follow up with unresponsive shops | Recipient list on Alert Detail filtered to Unread. "Send Reminder" sends follow-up notification. |
| US-22 | LRDB officer | Create a post-disaster impact report | I can document losses and plan resource allocation | DisasterReport created in DRAFT. Metrics added. Published status triggers broadcast email. |
| US-23 | LRDB officer | See estimated total losses across my region for a flood scenario | I can plan how many relief kits and vehicles to deploy | Estimation page with selected scenario shows aggregated loss by sector, area, and resource table. |
| US-24 | LRDB officer | Receive an SOS notification immediately | I can dispatch a response team quickly | Email received within 1 minute of SOS. SOS Active tab in chat shows pulsing alert. SOS panel shows nearest hospital. |
| US-25 | LRDB officer | Coordinate with volunteers via a group chat | I can manage the disaster response in real time | LRDB_COORDINATION channel created. Messages delivered in < 500ms. Broadcast composer available. |
| US-26 | LRDB officer | Track query resolution over time | I can identify bottlenecks in our response process | QueryStatusHistory shows full timeline. Officer name and timestamp on each status change. |
| US-27 | LRDB officer | Export the list of shops with their risk levels | I can share it with senior officials offline | CSV export downloads with shop name, owner, location, risk level, and last active date. |

---

## 6. Edge Cases & Exception Handling

| Scenario | Expected Behaviour |
|---|---|
| User denies GPS permission during registration | Manual Leaflet map entry shown immediately. Registration continues. LocationProfile created with `manuallySet=true`. |
| Nominatim returns no result for coordinates | Form fields left blank for manual entry. Error message displayed: "Could not resolve location name. Please enter manually." |
| Open-Elevation API returns no result | `LocationProfile.elevationMetres` stored as null. Batch job retried on next 30-day cycle. Alert generation proceeds without elevation data. |
| Overpass API timeout during batch enrichment | `batchStatus` set to FAILED. Error logged. Retried on next 30-day cycle. Dashboard shows "Location data pending" banner. |
| Meteosource API unavailable during hourly batch | Batch run skipped and logged. No alerts generated for that hour. Resumed on next scheduled run. |
| LLM API returns malformed JSON | Python service catches parsing error. Falls back to a pre-written template alert. Error logged to Python logger. |
| MSME owner deletes their account | Cascade delete: ShopProfile, StockItem, BCPPlan, RiskProfile, ForecastScenario, AlertRecipient, ChatGroupMember. Stream user disconnected. Session destroyed. |
| User attempts to access `/msme/{foreign-uuid}/dashboard` | Layout shell loader detects UUID mismatch. Redirects to `/msme/{own-uuid}/dashboard`. No data exposed. |
| Stream client fails to connect on chat page | ErrorCard shown with "Retry" button. Chat features unavailable until reconnected. |
| SOS channel creation fails | User shown error in ActionConfirmDialog: "SOS could not be sent. Please call LRDB directly: {phone number}." |
| Stock item added with no sensitivity tags | Validation error shown: "Please select at least one sensitivity type." Form not submitted. |
| BCP regeneration while previous plan is incomplete | ActionConfirmDialog warns: "This will replace your existing plan and reset all progress." Requires confirmation. |
| Alert created for region with no registered shops | System allows alert creation but shows warning: "No shops are registered in this region. 0 recipients will receive this alert." |
| LRDB officer's region has no trend data | Trend charts show EmptyState: "No historical data available for your region yet." |
| Video call drops due to network | Stream SDK attempts ICE restart. If reconnection fails after 30 seconds, CallBar shows "Connection lost." call.leave() called. |
| User submits registration form twice (double-click) | Submit button disabled on first click (isLoading=true). Remix action is idempotent — duplicate ShopProfile creation prevented by unique constraint on userId. |

---

## 7. Acceptance Criteria Summary

The following criteria define when the v1 build is considered complete and ready for release:

### 7.1 Functional Completeness
- [ ] All 10 MSME pages are built and match MSME_MODULE.md specifications
- [ ] All 7 LRDB pages are built and match LRDB_MODULE.md specifications
- [ ] All 4 Stream channel types are functional (LOCAL_MSME, LRDB_COORDINATION, DIRECT_MESSAGE, SOS_EMERGENCY)
- [ ] Voice and video calls work within chat threads
- [ ] SOS flow completes end-to-end (trigger → Stream channel → LRDB email → resolution)
- [ ] APScheduler runs hourly alert batch and 30-day location refresh
- [ ] All 5 Python packages (alerts, bcp, risk, forecasts, trends) + location package respond correctly
- [ ] All email types defined in FR-NOTIF-05 are sent correctly via Nodemailer
- [ ] Google OAuth login and registration flow works for both roles
- [ ] Multilingual UI switches correctly between Marathi, Hindi, and English

### 7.2 Data Integrity
- [ ] All UUIDs are generated server-side
- [ ] All forms validate via Zod before Prisma writes
- [ ] All cascade deletes work correctly on account deletion
- [ ] LocationProfile batch job writes all 20+ fields correctly from Overpass + elevation APIs
- [ ] QueryStatusHistory records every status change with officer ID and timestamp

### 7.3 Security
- [ ] STREAM_API_SECRET, GEMINI_API_KEY, and DATABASE_URL are never in client-side bundles
- [ ] UUID URL parameter is validated against session UUID on every protected page load
- [ ] LRDB officers cannot view data outside their regionCode

### 7.4 Performance
- [ ] Dashboard loads in < 2 seconds on 4G
- [ ] Chat messages deliver in < 500ms
- [ ] `npm run typecheck` passes with zero errors

### 7.5 Design Consistency
- [ ] All pages use components from `app/components/shared/` — no inline pattern duplication
- [ ] All charts use MUI X Charts exclusively
- [ ] All colours use the token names defined in DESIGN_SYSTEM.md Section 2
- [ ] MSME pages are fully functional at 375px viewport width
