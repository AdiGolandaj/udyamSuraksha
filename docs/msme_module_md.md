# MSME_MODULE.md
# DisasterShield — MSME User Module Page Specifications

---

## Module Overview

The MSME module serves small and medium business owners in disaster-prone rural and hilly regions near Pune. Every page in this module is scoped to a specific authenticated user via the `$userId` URL parameter (UUIDv4). All pages are wrapped in the `AppShell` component with `role="msme"`.

**Base route:** `/msme/$userId/`
**Layout shell file:** `app/routes/msme.$userId.tsx`
**Primary device target:** Mobile (375px) with desktop support

---

## Page 1 — Register & Login

**Route file:** `app/routes/login.tsx` + `app/routes/register.tsx`
**URL:** `/login` → `/register`
**Auth state:** Public (pre-authentication)

---

### Purpose
Onboard new MSME owners and authenticate returning users via Google OAuth. On first login, collect the business profile information required for personalised alerts, risk scoring, and BCP generation.

---

### Page Sections

#### Section 1.1 — Login Page (`/login`)

**Layout:** Centered single-column card on a light `surface-secondary` background. DisasterShield logo and tagline at top.

**Content:**
- App logo + name "DisasterShield" in `brand-primary`
- Tagline: "Protect your business. Stay ahead of disasters."
- Subtext explaining the two roles (MSME owner / LRDB officer)
- Single "Sign in with Google" button (full-width, with Google logo icon)
- Language selector (`LanguageSelector` compact variant) top-right
- Footer: "By signing in you agree to our Terms of Service"

**Components used:** `LanguageSelector`, shadcn `Button`, `Card`

**Loader behaviour:**
- If user is already authenticated → redirect to their role-appropriate dashboard immediately
- No data fetching required

**Action behaviour:**
- Button click calls `authenticator.authenticate('google', request)` from `auth.server.ts`
- Google OAuth flow begins

---

#### Section 1.2 — Register Page (`/register`)

Shown after first Google login OR when a returning user's profile is incomplete. Split into four sequential steps rendered as a stepped form. Progress shown via a step indicator at the top.

**Step 1 — Role Selection**

Content:
- Heading: "What best describes you?"
- Two large selectable cards side by side:
  - **MSME Owner** — icon `Store`, description "I own or manage a small business"
  - **LRDB Officer** — icon `Landmark`, description "I work for a local disaster management body"
- Selected card gets `brand-primary` border highlight
- "Continue" button (disabled until a role is selected)

---

**Step 2 — Business Details** (shown only if MSME Owner selected)

Fields (all use shadcn `Form` + React Hook Form + Zod):
- Shop Name `*` — text input
- Business Category `*` — `CategorySelect` component (searchable dropdown)
- Owner Full Name `*` — text input (pre-filled from Google profile)
- Phone Number `*` — text input with `+91` prefix
- GST Number — optional text input
- Year Established — optional number input

Validation (Zod `registerSchema.ts`):
- Shop name: min 2 chars, max 100 chars
- Category: must be a valid category from the constants list
- Phone: valid Indian mobile number format (10 digits)

---

**Step 3 — Location (Two-Part)**

**Part A — GPS Capture (automatic first attempt)**

On entering Step 3, the app immediately requests `navigator.geolocation.getCurrentPosition()`.

While waiting: a pulsing `MapPin` animation with text "Detecting your location..."

On **GPS success:**
- Coordinates (lat/lng) captured client-side
- Remix action `POST /register?intent=geocode` called server-side with lat/lng
- Server calls **Nominatim** reverse geocoding:
  `GET https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json`
- Returns: village, suburb, taluka (county), district, pincode
- **Confirmation screen shown:**
  - Leaflet map centred on the coordinates with a green `MapPin` marker
  - Location details card below map:
    - Village/Area name (large, prominent)
    - Taluka, District, Pincode
    - Elevation (fetched simultaneously from Open-Elevation)
  - Two buttons: **"Yes, this is correct"** | **"No, let me correct it"**

On **"Yes, this is correct":**
- `manuallySet = false`
- Coordinates + geocoded address saved
- `LocationProfile` record created with `batchStatus = PENDING`
- Background batch job triggered via `POST /location/enrich` to Python backend (non-blocking — fire and forget)
- Proceed to Step 4

On **"No, let me correct it"** OR **GPS denied/failed:**
- Falls through to Part B (manual entry)

---

**Part B — Manual Location Entry**

Shown when GPS is denied, fails, or user requests correction.

Layout:
- Full-width **Leaflet map** (height 300px on mobile, 400px on desktop)
  - Default centred on Pune district (lat: 18.5204, lng: 73.8567)
  - Draggable red `MapPin` marker
  - Instructions: "Drag the pin to your exact shop location"
  - Search bar overlay on map: "Search for your village or area" (uses Nominatim forward geocoding on search)

- Below map: Auto-filled address fields (populated when pin is dropped or search selects a result):
  - Village / Area `*` — text input
  - Taluka `*` — text input
  - District `*` — text input (default: "Pune")
  - Pincode `*` — 6-digit input

- "Confirm Location" button:
  - Saves the manually-dragged lat/lng
  - Sets `manuallySet = true`
  - Calls Nominatim with the dragged pin coordinates to fill any missing address fields
  - Creates `LocationProfile` with `batchStatus = PENDING`
  - Triggers background batch enrichment
  - Proceeds to Step 3B — Building Details

---

**Part C — Building & Infrastructure Details** (shown after location confirmed, either GPS or manual)

This sub-step collects user-provided structural data that cannot be derived from APIs.

Fields (all use shadcn `Select` or `Switch`):
- Power Supply Type `*` — `Select`: Grid / Solar / Generator / Mixed
- Mobile Connectivity `*` — `Select`: 4G / 3G / 2G / No Signal
- Shop Floor Level `*` — `Select`: Ground Floor / First Floor / Basement
- Building Construction Type `*` — `Select`: Pucca (Concrete) / Semi-Pucca / Kutcha (Mud/Bamboo)
- Roof Type `*` — `Select`: RCC Slab / Tin Sheet / Asbestos / Tiled / Thatched
- Do you have a basement? — `Switch` (Boolean)
- Stock Storage Level `*` — `Select`: Ground Level / Elevated Shelf / First Floor
- Approximate Shop Area (sq ft) — number input (optional)

Helper text shown below each field explaining why it matters (e.g. "Tin roofs are vulnerable to high winds — we use this to personalise wind damage alerts").

"Continue" button proceeds to Step 4.

---

**Step 4 — Preferences & Emergency Contact**

Fields:
- Preferred language — `LanguageSelector` full variant (3 options)
- Notification preferences — `NotificationToggleGroup` (app, email, SMS, WhatsApp)
- Emergency Contact Name `*` — text input
- Emergency Contact Phone `*` — text input
- Emergency Contact Relationship `*` — select (Spouse, Parent, Sibling, Business Partner, Employee, Other)

**Submit button:** "Complete Setup" — full-width `brand-primary` button
- Shows `Loader2` spinner on submission
- Disabled during submission to prevent double submit

**On submit:**
- Validates all fields via Zod
- Creates `ShopProfile`, `EmergencyContact`, updates `User.role` and `User.language` in MySQL via Prisma
- Generates UUIDv4 for `ShopProfile`
- `LocationProfile` already created in Step 3 — updates `batchStatus` confirmation
- Calls Python FastAPI `POST /risk/score` to generate initial `RiskProfile` (uses partial `LocationProfile` data available so far)
- Calls Python FastAPI `POST /bcp/generate` to generate initial `BCPPlan`
- Calls Python FastAPI `POST /forecasts/estimate` to generate initial `ForecastScenario` records
- Creates a `ChatGroup` record and adds user to their proximity-based local group via Stream API (proximity determined by `regionCode` derived from Nominatim `district` + `taluka`)
- Sends welcome email via `sendMail` in `mail.server.ts`
- Redirects to `/msme/$userId/dashboard`

> **Note:** The `LocationProfile` batch enrichment (Overpass amenities, elevation, terrain) runs fully in the background via APScheduler. The dashboard shows a `NotificationBanner type="info"` message: "We are enriching your location profile — this improves your alert accuracy. It will complete in a few minutes." The banner is dismissed once `locationProfile.batchStatus = COMPLETE`.

**Components used:** `LanguageSelector`, `CategorySelect`, `LocationPicker`, `NotificationToggleGroup`, shadcn `Form`, `Input`, `Select`, `Button`, `Progress`, `Card`

---

## Page 2 — Dashboard

**Route file:** `app/routes/msme.$userId.dashboard.tsx`
**URL:** `/msme/$userId/dashboard`
**Auth state:** Protected (MSME role)

---

### Purpose
Give the MSME owner an at-a-glance overview of their business safety, active disaster risks, inventory health, and immediate actions required. This is the first page seen after login and the most frequently visited page.

---

### Page Sections

#### Section 2.1 — Page Header
- `PageHeader` with title "Good morning, {firstName}" (time-based greeting)
- Subtitle: Current date + district name
- Action slot: `RiskBadge` showing current overall risk level (live, prominent)

---

#### Section 2.2 — Stat Tiles Row

Four `StatTile` components in a `grid-cols-2 lg:grid-cols-4` grid:

| Tile | Value | Icon | Variant |
|---|---|---|---|
| Risk Score | `riskProfile.overallScore` / 100 | `ShieldAlert` | Dynamic based on score |
| Stock Items | Total count of `stockItem` records | `Package` | `default` |
| Potential Loss | Estimated INR loss from top forecast | `Banknote` | `warning` or `danger` |
| Alerts Today | Count of unread alerts issued today | `BellRing` | `danger` if > 0 |

Each tile is clickable (`onClick`) — navigates to the relevant detail page.

**Loader data:** `riskProfile.overallScore`, `stockItem` count, top `forecastScenario.estimatedLossInr`, unread `alertRecipient` count for today.

---

#### Section 2.3 — Active Alerts Feed

`SectionCard` with title "Active Alerts" and a "View All" link to `/msme/$userId/alerts`.

Content:
- If alerts exist: Top 3 most recent unread `AlertCard` components (collapsed variant, `isExpanded=false`)
- If no active alerts: `EmptyState` with `ShieldCheck` icon and message "No active alerts. Your business is currently safe."
- `LoadingSkeleton variant="card" count={3}` while loading

Each `AlertCard` shows:
- Severity badge (`RiskBadge`)
- Alert title and category
- Top 2–3 affected stock items as `SensitivityTag` chips
- One-line AI summary
- Primary action button (e.g. "Secure Stock", "Notify Employees")

**Loader data:** Top 3 `alertRecipient` records for this user where `isRead=false`, joined with `alert` and `alertAction`.

---

#### Section 2.4 — Inventory Safety Summary

`SectionCard` with title "Inventory Safety" and a "Manage Stock" link to `/msme/$userId/stock`.

Content:
- Horizontal bar chart (MUI X `BarChart`) showing stock item count by vulnerability level:
  - Low (score 0–39): green
  - Medium (score 40–69): amber
  - High (score 70–100): red
- Below the chart: top 3 most vulnerable `StockItemRow` components (compact variant, read-only, no edit/delete actions)
- If no stock added yet: `EmptyState` with `Package` icon and "Add your first stock item" CTA

**Loader data:** All `stockItem` records for the shop, grouped by `vulnerabilityScore` ranges. Top 3 by highest `vulnerabilityScore`.

---

#### Section 2.5 — Quick Actions

`SectionCard` with title "Quick Actions". No header action link.

A 2×2 grid of large ghost buttons with icons:

| Button | Icon | Action |
|---|---|---|
| Send SOS | `Siren` | Opens `SOSButton` confirmation dialog |
| Notify Employees | `Users` | Opens a pre-composed WhatsApp/SMS link |
| View Safety Plan | `ClipboardList` | Navigates to `/msme/$userId/bcp` |
| Call LRDB | `Phone` | Initiates a Stream voice call to the regional LRDB officer |

`SOSButton` variant="full" shown here — triggers SOS to the user's local chat group.

---

#### Section 2.6 — Community Activity

`SectionCard` with title "Nearby Community" and a "Open Chat" link to `/msme/$userId/chat`.

Content:
- Count of active members in the user's local chat group
- Last 2 messages from the local group (read-only preview, not interactive)
- `StatusIndicator` showing group activity level (pulse if active)
- If SOS is active in the group: `NotificationBanner type="error"` at top of section

**Loader data:** `chatGroup` metadata for the user's proximity group, last 2 messages fetched from Stream API server-side via `stream.server.ts`.

---

#### Section 2.7 — Risk Snapshot

`SectionCard` with title "Risk Overview" and a "Full Profile" link to `/msme/$userId/risk`.

Content:
- MUI X `RadarChart` with 5 axes: Flood, Power, Stock, Location, Access
  - Each axis value from `riskProfile` (flood/power/stock/location/accessScore)
- Below chart: Top 2 `RiskSuggestion` items (title + description, no action controls)
- `TrendChip` showing risk score change vs last week

**Loader data:** `riskProfile` with all sub-scores and top 2 `riskSuggestion` records ordered by `impactScore` desc.

---

#### Section 2.8 — Upcoming Weather / Trend Alert

`SectionCard` with title "Local Conditions" — a compact read-only panel.

Content:
- Current season risk label (e.g. "Monsoon Season — Elevated Flood Risk")
- Last 3 `TrendDataPoint` records for the user's `regionCode` (type: rainfall) shown as a mini MUI X `LineChart`
- One-line summary from the Python trends API

**Loader data:** Last 30 days of `TrendDataPoint` records for `regionCode` where `trendType = 'rainfall'`. Summary fetched from `GET /trends/{regionCode}`.

---

## Page 3 — Stock Management

**Route file:** `app/routes/msme.$userId.stock.tsx` + `app/routes/msme.$userId.stock.$itemId.tsx`
**URL:** `/msme/$userId/stock` and `/msme/$userId/stock/$itemId`
**Auth state:** Protected (MSME role)

---

### Purpose
Allow the MSME owner to digitally catalog their inventory, classify items by disaster sensitivity, and receive AI-generated storage recommendations. The inventory data directly drives alert personalisation and financial forecasts.

---

### Page Sections — Stock List (`/msme/$userId/stock`)

#### Section 3.1 — Page Header
- `PageHeader` title "My Stock" subtitle "Manage and protect your inventory"
- Action slot: "Add Item" button → opens add item dialog

---

#### Section 3.2 — Summary Tiles

Three `StatTile` in a `grid-cols-3` row:
- Total Items (count)
- Total Estimated Value (INR, formatted as ₹X,XX,XXX)
- High Risk Items (count where `vulnerabilityScore` > 70, `variant="danger"`)

---

#### Section 3.3 — Filter & Search Bar

Horizontal bar containing:
- Search input (filters by item name, `Input` with `Search` icon)
- Category filter (`Select` dropdown — populated from distinct categories in user's stock)
- Sensitivity filter (`SensitivityMultiSelect`)
- Sort by: Name A–Z, Value High–Low, Vulnerability High–Low, Expiry Soonest

All filters are client-side (no page reload) using React `useState`.

---

#### Section 3.4 — Stock Items Table / List

- Desktop: shadcn `Table` with `StockItemRow` for each item
- Mobile: Stacked card list with `StockItemRow` in card variant

Table columns (desktop):
| Column | Content |
|---|---|
| Name | Item name + category badge |
| Sensitivity | Up to 3 `SensitivityTag` chips |
| Quantity | Quantity + unit |
| Value | Estimated INR value |
| Vulnerability | `Progress` bar (colour-coded) |
| Expiry | Date or "N/A" (red if within 7 days) |
| Actions | Edit / Delete `DropdownMenu` |

Empty state: `EmptyState icon={Package}` with "Add your first stock item to get personalised disaster alerts" CTA.

Loading state: `LoadingSkeleton variant="table" count={8}`

---

#### Section 3.5 — Add / Edit Item Dialog

Opens as a shadcn `Dialog` (not a new page). Contains a form with:

Fields:
- Item Name `*`
- Category `*` (free text, e.g. "Medicines", "Rice Bags", "Electronic Components")
- Quantity `*` (number)
- Unit `*` (`Select`: kg, litres, units, boxes, bags, metres, other)
- Estimated Value (INR) `*` (number)
- Storage Location (text, e.g. "Back room shelf 2")
- Expiry Date (date picker — shown only if `PERISHABLE` sensitivity is selected)
- Disaster Sensitivities `*` — `SensitivityMultiSelect`
- Notes (optional `Textarea`)

On submit:
- Zod validation via `stockItemSchema.ts`
- Calls Remix action `POST /msme/$userId/stock`
- Action inserts `StockItem` + `StockSensitivity` records via Prisma
- Calls Python `POST /risk/score` to recompute `RiskProfile` (async, non-blocking)
- Calls Python `POST /forecasts/estimate` to regenerate `ForecastScenario` records
- Dialog closes, list refreshes via Remix revalidation

---

### Page Sections — Stock Item Detail (`/msme/$userId/stock/$itemId`)

#### Section 3.6 — Item Header
- `PageHeader` with item name as title, category as subtitle
- Breadcrumb: My Stock → {Item Name}
- Action slot: Edit button + Delete button (delete triggers `ActionConfirmDialog`)

---

#### Section 3.7 — Item Detail Card
Full details of the stock item in a `SectionCard`:
- All fields displayed in a two-column key-value layout
- `SensitivityTag` chips for all sensitivities
- `RiskBadge` for vulnerability level
- Coloured `Progress` bar for vulnerability score

---

#### Section 3.8 — AI Storage Recommendations
`SectionCard` with title "AI Storage Advice" and a subtle `Sparkles` icon.

Content:
- 2–4 bullet recommendations generated by Python `POST /risk/score` for this specific item
- Each recommendation is a `TimelineStep` (non-interactive, no checkbox)
- Example: "Move this item to a shelf at least 60cm above ground level to reduce flood damage risk."

---

#### Section 3.9 — Disaster Impact Simulation
`SectionCard` with title "If a Disaster Occurred..."

Content:
- Dropdown to select disaster type (Flood, Power Outage, Windstorm)
- On selection: shows estimated damage to this item specifically, pulled from `ForecastAffectedItem` records
- Estimated loss in INR with `TrendChip`

---

## Page 4 — Business Continuity Plan (BCP)

**Route file:** `app/routes/msme.$userId.bcp.tsx`
**URL:** `/msme/$userId/bcp`
**Auth state:** Protected (MSME role)

---

### Purpose
Present the AI-generated, personalised disaster response plan for the business. Owners follow this checklist before, during, and after a disaster. Completion is tracked and persisted.

---

### Page Sections

#### Section 4.1 — Page Header
- `PageHeader` title "Business Continuity Plan" subtitle "Your personalised disaster response guide"
- Action slot: "Regenerate Plan" button (calls Python `POST /bcp/generate`, updates BCP, sends email)
- Progress badge showing overall completion % (e.g. "12 of 24 steps completed")

---

#### Section 4.2 — Completion Overview

`SectionCard` with three `StatTile` in a row:
- Before Disaster steps completed (e.g. "4/8")
- During Disaster steps completed (e.g. "2/6")
- After Disaster steps completed (e.g. "6/10")

Large `Progress` bar below tiles showing overall `completionPercent`.

---

#### Section 4.3 — BCP Phases (Tabbed)

shadcn `Tabs` with three tabs: Before | During | After

Each tab renders a vertical list of `TimelineStep` components for that `BCPPhase`.

**Before tab content example steps:**
- Elevate all water-sensitive stock to shelves above 60cm
- Charge all battery-powered devices and backup inverter
- Back up digital sales records to cloud storage
- Identify nearest safe storage facility for flammable items
- Share this plan with your primary emergency contact

**During tab content example steps:**
- Do not enter flooded premises
- Document damage via photographs
- Contact your LRDB officer via the Community Chat
- Send SOS if requiring immediate assistance

**After tab content example steps:**
- Submit a damage query to LRDB via the Queries section
- Document total stock loss for insurance purposes
- Update inventory in Stock Management after recovery
- Contact your nearest government relief centre

Each `TimelineStep`:
- Has a checkbox (`onToggle`) that calls Remix action `POST /msme/$userId/bcp` with `{ stepId, isCompleted }`
- Updates `BCPStep.isCompleted` and `BCPStep.completedAt` in MySQL via Prisma
- Triggers a Remix revalidation to update the completion percentage

Optional steps rendered with a muted "Optional" label.

---

#### Section 4.4 — Emergency Contacts Quick View

`SectionCard` with title "Emergency Contacts".

Content: Card list of the user's `EmergencyContact` records. Each card shows:
- Name + relationship badge
- Phone number with a `Phone` icon button (tel: link)
- "Primary" badge for `isPrimary=true` contact

Link to Settings to manage contacts.

---

#### Section 4.5 — Download / Share Plan

`SectionCard` with title "Share Your Plan".

Two buttons:
- "Download as PDF" — triggers a Remix action that generates a simple HTML-to-PDF of the plan
- "Share via WhatsApp" — constructs a `wa.me` link with a summary of the plan

---

## Page 5 — Alerts

**Route file:** `app/routes/msme.$userId.alerts.tsx` + `app/routes/msme.$userId.alerts.$alertId.tsx`
**URL:** `/msme/$userId/alerts` + `/msme/$userId/alerts/$alertId`
**Auth state:** Protected (MSME role)

---

### Purpose
Display all disaster alerts personalised to the shop. Allow the owner to understand the threat, see which stock is affected, and complete the recommended actions.

---

### Page Sections — Alerts List

#### Section 5.1 — Page Header
- `PageHeader` title "Alerts" subtitle "Disaster warnings personalised to your shop"
- Action slot: Unread count badge (e.g. "3 unread")

---

#### Section 5.2 — Filter Bar
- Tab row: All | Unread | Critical | Flood | Power | Wind | Resolved
- Tabs are shadcn `Tabs` — filtering is done via Prisma query in the loader on tab change (via `useFetcher` or URL search params `?filter=critical`)

---

#### Section 5.3 — Alert List

Vertical stack of `AlertCard` components (collapsed variant).

Grouped by date:
- Today
- Yesterday
- This Week
- Older

Each group has a date separator line.

Unread alerts have a coloured left border. Read alerts are slightly muted.

Empty state (no alerts): `EmptyState icon={BellRing}` "No alerts yet. You will be notified when a disaster risk is detected for your shop."

Loading: `LoadingSkeleton variant="card" count={5}`

---

### Page Sections — Alert Detail (`/msme/$userId/alerts/$alertId`)

#### Section 5.4 — Alert Header
- `PageHeader` with alert title + `RiskBadge` severity
- Breadcrumb: Alerts → {Alert Title}
- Issued at timestamp + category badge

---

#### Section 5.5 — Alert Summary Card
`SectionCard` with AI-generated `summary` rendered as formatted paragraphs. This is the full LLM-generated explanation of the threat specific to this shop.

---

#### Section 5.6 — Affected Stock
`SectionCard` with title "Your Affected Stock Items".

Content: Table of stock items that match the alert's sensitivity category:
| Item Name | Sensitivity | Estimated Damage | Status |
|---|---|---|---|
| Rice Bags (50kg) | Water-sensitive | ₹12,000 | At Risk |
| Medicines | Heat-sensitive | ₹8,500 | Monitor |

Each item links to its stock detail page.

---

#### Section 5.7 — Recommended Actions
`SectionCard` with title "What To Do Now".

Vertical list of `TimelineStep` components — one per `AlertAction`.
Each step has:
- Checkbox (`onToggle`) → calls action `POST /msme/$userId/alerts/$alertId` with `{ actionId, isCompleted }`
- Updates `AlertActionResult.isCompleted` in MySQL

Progress bar showing how many actions are completed.

---

#### Section 5.8 — Request Emergency Support
`SectionCard` with title "Need Help?".

Two buttons:
- "Request Support from LRDB" → opens a pre-filled query form (navigates to create query flow)
- "Ask Community for Help" → opens `SOSButton` confirmation dialog targeting the local chat group

---

## Page 6 — Local Support Chat Groups

**Route file:** `app/routes/msme.$userId.chat.tsx` + `app/routes/msme.$userId.chat.$groupId.tsx`
**URL:** `/msme/$userId/chat` + `/msme/$userId/chat/$groupId`
**Auth state:** Protected (MSME role)

---

### Purpose
Connect the MSME owner with nearby shop owners for real-time mutual aid, resource sharing, and emergency SOS. Also displays official LRDB announcements pushed to the group.

---

### Page Sections

#### Section 6.1 — Page Header
- `PageHeader` title "Community" subtitle "Connect with nearby businesses"
- No action slot (chat is the action)

---

#### Section 6.2 — Chat Layout

Full-height `ChatLayout` component with `role="msme"`:

**Left Panel — Group List:**
- `ChatSidebar` showing user's chat groups
- MSME users typically belong to 1 local community group + possible direct message threads with LRDB officers
- Search input to filter groups by name
- Each group rendered as `ChatGroupListItem`
- `SOSButton variant="full"` pinned at bottom of the sidebar above the group list

**Right Panel — Chat Thread:**
- `ChatThread` for the active `$groupId`
- Shows message history via Stream `useChannelStateContext`
- `ChatInput` at bottom with `showSOSButton=true`
- Voice call and video call icon buttons in thread header (via `CallBar` and `VideoCallModal`)
- LRDB broadcast messages rendered as `isSystemMessage=true` full-width banners

**Mobile behaviour:**
- Group list is full screen by default
- Selecting a group pushes to the thread view
- Back button in thread header returns to group list

---

#### Section 6.3 — Group Info Panel (Desktop Only)

Right-side panel (280px) showing:
- Group name + `regionCode`
- Participant count + list of member names with `StatusIndicator`
- Active labels/tags on this group
- LRDB officer assigned to this region (name + "Call" button)

---

## Page 7 — Risk Profiling

**Route file:** `app/routes/msme.$userId.risk.tsx`
**URL:** `/msme/$userId/risk`
**Auth state:** Protected (MSME role)

---

### Purpose
Show the business owner a detailed breakdown of their disaster vulnerability, explain each risk factor, and provide AI-generated, actionable recommendations to improve their score.

---

### Page Sections

#### Section 7.1 — Page Header
- `PageHeader` title "Risk Profile" subtitle "Understand and reduce your business risk"
- Action slot: "Recalculate" button (calls Python `POST /risk/score`, updates `RiskProfile`)
- Last computed timestamp shown as caption

---

#### Section 7.2 — Overall Risk Score

`SectionCard` — prominent score display:
- Large circular score indicator (built with SVG arc + Tailwind, not a charting library)
- Score number (0–100) in the centre, large font
- `RiskBadge` level label below (Safe / Moderate / High / Critical)
- Comparison text: "Better than X% of shops in your area" (derived from all `riskProfile` records for the same `regionCode`)

---

#### Section 7.3 — Risk Category Breakdown

`SectionCard` with title "Risk Breakdown".

Left: MUI X `RadarChart` with 5 axes (Flood, Power, Stock, Location, Access) — values from `riskProfile` sub-scores.

Right: Vertical list of 5 risk categories, each showing:
- Category name + icon
- Score out of 100
- Colour-coded `Progress` bar
- One-line explanation (e.g. "Your shop is in a flood-prone zone near a seasonal stream")

---

#### Section 7.4 — Risk Suggestions

`SectionCard` with title "How to Improve Your Score".

Vertical list of all `RiskSuggestion` records ordered by `impactScore` descending.

Each suggestion rendered as a card with:
- Title
- Description (`@db.Text`)
- Impact badge: "+{impactScore} points if actioned"
- "Mark as Actioned" button → calls action `POST /msme/$userId/risk` with `{ suggestionId }` → updates `RiskSuggestion.isActioned` and triggers risk score recomputation
- Actioned suggestions show a green checkmark and are moved to the bottom of the list

---

#### Section 7.5 — Location Risk Map

`SectionCard` with title "Your Location Risk".

Leaflet map centred on the shop's `latitude`/`longitude` showing:
- Shop pin (green `brand-primary` marker)
- Flood-prone zones as a transparent overlay polygon (derived from `TrendDataPoint` historical flood incidents in the `regionCode`)
- Nearest LRDB office pin

Rendered client-side only (wrapped in `ClientOnly`) since Leaflet requires the browser `window` object.

---

#### Section 7.6 — Historical Risk Trend

`SectionCard` with title "Risk Score Over Time".

MUI X `LineChart` showing the shop's `riskProfile.overallScore` over the last 6 monthly snapshots (requires storing monthly snapshot — future implementation note: add `RiskScoreHistory` table in a future migration).

For v1: shows a static placeholder chart with a "Risk history tracking starts today" message for new shops.

---

## Page 8 — Recent Trends

**Route file:** `app/routes/msme.$userId.trends.tsx`
**URL:** `/msme/$userId/trends`
**Auth state:** Protected (MSME role)

---

### Purpose
Help the MSME owner understand recurring local disaster patterns and seasonal risks so they can prepare proactively rather than reactively.

---

### Page Sections

#### Section 8.1 — Page Header
- `PageHeader` title "Local Trends" subtitle "Disaster patterns in your area"
- Region label badge (e.g. "Mulshi, Pune District")

---

#### Section 8.2 — Seasonal Risk Calendar

`SectionCard` with title "Seasonal Risk Periods".

A 12-month horizontal calendar heatmap built with MUI X `BarChart` (one bar per month, height = aggregate risk score for that month derived from `TrendDataPoint` records):

- Jan–Feb: Low risk (blue)
- Mar–May: Moderate heat risk (amber)
- Jun–Sep: High flood/storm risk (red) — Monsoon season
- Oct–Nov: Moderate (amber)
- Dec: Low (blue)

Current month highlighted with `brand-primary` border.

---

#### Section 8.3 — Trend Charts by Category

Four `SectionCard` sections, each with a MUI X `LineChart`:

**Rainfall Trend (12 months)**
- Y-axis: Rainfall in mm
- X-axis: Month abbreviations
- Data: `TrendDataPoint` where `trendType='rainfall'` for the user's `regionCode`

**Power Outage Incidents (12 months)**
- Y-axis: Number of incidents
- Data: `TrendDataPoint` where `trendType='power_outage'`

**Transport Disruptions (12 months)**
- Y-axis: Number of disruptions
- Data: `TrendDataPoint` where `trendType='transport_disruption'`

**Flood Incidents (12 months)**
- Y-axis: Number of incidents
- Data: `TrendDataPoint` where `trendType='flood_incident'`

Each chart has `LoadingSkeleton variant="chart"` while loading. Each has `EmptyState` if no data exists for the region.

---

#### Section 8.4 — AI Trend Insights

`SectionCard` with title "AI Insights" and `Sparkles` icon.

Content: 3–4 bullet insights generated by Python `GET /trends/{regionCode}` API. Examples:
- "Flooding incidents in Mulshi peak in July–August. Begin stock elevation by end of June."
- "Power outages average 14 hours during monsoon months. Consider investing in a backup inverter."
- "Transport disruptions in this region typically resolve within 48 hours of a flood event."

Rendered as a styled list with `TrendingUp` icons.

---

#### Section 8.5 — Market Disruption Observations

`SectionCard` with title "Supply Chain Patterns".

Narrative text block (from Python AI) describing:
- When supply chains in the region historically break down
- Which goods become scarce during disaster periods
- Recommendations for pre-disaster stock buffering

---

## Page 9 — Estimates & Forecasts

**Route file:** `app/routes/msme.$userId.forecasts.tsx`
**URL:** `/msme/$userId/forecasts`
**Auth state:** Protected (MSME role)

---

### Purpose
Show the business owner a financial picture of what various disaster scenarios would cost them based on their current inventory. Drives proactive prevention and insurance decisions.

---

### Page Sections

#### Section 9.1 — Page Header
- `PageHeader` title "Estimates & Forecasts" subtitle "Financial impact of potential disasters on your business"
- Action slot: "Refresh Forecasts" button → calls Python `POST /forecasts/estimate` and updates all `ForecastScenario` records

---

#### Section 9.2 — Summary Tiles

Three `StatTile` in `grid-cols-3`:
- Worst Case Loss (highest `estimatedLossInr` across all scenarios)
- Most Likely Scenario (highest `probability='high'` scenario disaster type)
- Avg Recovery Time (average `recoveryTimelineDays` across all scenarios)

---

#### Section 9.3 — Total Loss Projection Chart

`SectionCard` with title "Potential Loss by Disaster Type".

MUI X `BarChart`:
- X-axis: Disaster types (Flood, Power Outage, Windstorm, Landslide)
- Y-axis: Estimated loss in INR (₹)
- Bars colour-coded by probability: red (high), amber (medium), green (low)
- Tooltip shows: estimated loss + affected item count + recovery days

---

#### Section 9.4 — Scenario Cards

`SectionCard` with title "Detailed Scenarios".

Vertical stack of `ForecastScenarioCard` components — one per `ForecastScenario` record.

Each card (collapsed by default, expandable):
- Disaster type + probability badge
- Estimated total loss (INR)
- Estimated downtime (days)
- Recovery timeline (days)
- Top 3 most affected stock items with individual damage estimates
- AI narrative paragraph (full text on expand)
- "Preventive Savings" callout: "Taking our recommended actions could reduce this loss by up to X%"

---

#### Section 9.5 — Insurance Readiness

`SectionCard` with title "Insurance Readiness".

Content:
- `Progress` bar showing an "Insurance Readiness Score" (0–100) based on:
  - Whether the shop has documented inventory (✓/✗)
  - Whether BCP plan exists (✓/✗)
  - Whether risk suggestions are actioned (count)
- Checklist of items needed for a typical MSME insurance claim
- "Download Inventory Report" button — generates a printable PDF summary of all stock items and values

---

#### Section 9.6 — Preventive Investment Calculator

`SectionCard` with title "Prevention vs Loss Calculator".

Interactive input:
- Slider: "How much can you invest in prevention? ₹{value}"
- Range: ₹0 to ₹50,000
- Below slider: Live-updating text showing estimated loss reduction (derived from `ForecastScenario` data)
- Example: "Investing ₹5,000 in elevated shelving could save ₹18,000 in flood damage"

This is a client-side calculation using data already loaded from the loader — no new API call.

---

## Page 10 — Settings

**Route file:** `app/routes/msme.$userId.settings.tsx`
**URL:** `/msme/$userId/settings`
**Auth state:** Protected (MSME role)

---

### Purpose
Allow the MSME owner to manage their profile, notification preferences, language, emergency contacts, and privacy settings.

---

### Page Sections

#### Section 10.1 — Page Header
- `PageHeader` title "Settings" subtitle "Manage your account and preferences"

---

#### Section 10.2 — Business Profile

`SectionCard` with title "Business Profile" and an "Edit" button in the header action slot.

Display mode (default):
- Shop name, category, address, phone, GST number, established year
- All displayed in a two-column key-value grid

Edit mode (on "Edit" click):
- Same fields become editable inputs
- "Save Changes" + "Cancel" buttons appear
- On submit: Remix action `POST /msme/$userId/settings` with `intent="update-profile"`
- Updates `ShopProfile` via Prisma

---

#### Section 10.3 — Language & Region

`SectionCard` with title "Language & Region".

- `LanguageSelector` full variant (current language pre-selected)
- On change: submits Remix `Form` with `intent="update-language"` → updates `User.language` in DB + session

---

#### Section 10.4 — Notification Preferences

`SectionCard` with title "Notifications".

`NotificationToggleGroup` with all 4 channels:
- App notifications (`notifyViaApp`)
- Email alerts (`notifyViaEmail`) — shows current email address
- SMS alerts (`notifyViaSms`) — shows current phone number
- WhatsApp alerts (`notifyViaWhatsapp`)

On any toggle change: debounced Remix `useFetcher` call with `intent="update-notifications"` → updates corresponding `User.notify*` boolean fields.

---

#### Section 10.5 — Emergency Contacts

`SectionCard` with title "Emergency Contacts" and an "Add Contact" button.

List of all `EmergencyContact` records for the user. Each row:
- Name + relationship badge
- Phone number
- Primary contact toggle
- Edit (opens inline edit) and Delete (triggers `ActionConfirmDialog`) buttons

Add Contact dialog: same fields as register Step 4 emergency contact form.

---

#### Section 10.6 — Account & Privacy

`SectionCard` with title "Account & Privacy".

- Email address (read-only — from Google profile)
- "Community Visibility" toggle — controls whether name is shown to other MSME members in local chat group or shown as "Anonymous Member"
- "Data Sharing with LRDB" toggle — controls whether the LRDB can view this shop's risk profile and stock summary
- "Delete Account" button (destructive, red) → triggers `ActionConfirmDialog` with warning text → calls action `intent="delete-account"` → deletes all user data via Prisma cascade + disconnects Stream user + redirects to `/login`

---

## Loader Data Summary

The following table maps each page to the Prisma queries and Python API calls its loader makes.

| Page | Prisma Queries | Python API Calls |
|---|---|---|
| Dashboard | `alertRecipient` (unread), `stockItem` (count + top 3 vulnerable), `riskProfile`, `forecastScenario` (top 1), `trendDataPoint` (last 30 days) | `GET /trends/{regionCode}` (summary) |
| Stock List | `stockItem` (all, with `sensitivities`) | None |
| Stock Detail | `stockItem` (single, with `sensitivities`), `forecastAffectedItem` | None |
| BCP | `bcpPlan` (with `bcpStep` all phases) | None |
| Alerts List | `alertRecipient` (all, with `alert` + `alertAction`) | None |
| Alert Detail | `alertRecipient` (single), `alert` (with `alertAction` + `alertActionResult`), `stockItem` (matching sensitivity) | None |
| Chat | `chatGroup` (user's groups), Stream API (last 2 messages) | None |
| Risk | `riskProfile` (with `riskSuggestion`), `trendDataPoint` (flood incidents) | None |
| Trends | `trendDataPoint` (all types, 12 months, by regionCode) | `GET /trends/{regionCode}` |
| Forecasts | `forecastScenario` (all, with `forecastAffectedItem`) | None |
| Settings | `user` (with `shopProfile`, `emergencyContact`) | None |

---

## Action Summary

| Page | Action Intent | Prisma Operation | Python API Call | Mail Trigger |
|---|---|---|---|---|
| Register | `complete-registration` | Create `ShopProfile`, `EmergencyContact`, update `User` | `POST /risk/score`, `POST /bcp/generate`, `POST /forecasts/estimate` | Welcome email |
| Stock | `add-item` / `edit-item` | Create/update `StockItem` + `StockSensitivity` | `POST /risk/score`, `POST /forecasts/estimate` | None |
| Stock | `delete-item` | Delete `StockItem` (cascade) | `POST /risk/score` | None |
| BCP | `toggle-step` | Update `BCPStep.isCompleted` | None | None |
| BCP | `regenerate-plan` | Delete + recreate `BCPStep` records | `POST /bcp/generate` | BCP ready email |
| Alert Detail | `complete-action` | Update `AlertActionResult.isCompleted` | None | None |
| Risk | `action-suggestion` | Update `RiskSuggestion.isActioned` | `POST /risk/score` | Risk score change email |
| Risk | `recalculate` | Update `RiskProfile` all scores | `POST /risk/score` | Conditional risk email |
| Forecasts | `refresh-forecasts` | Delete + recreate `ForecastScenario` records | `POST /forecasts/estimate` | None |
| Settings | `update-profile` | Update `ShopProfile` fields | None | None |
| Settings | `update-language` | Update `User.language` | None | None |
| Settings | `update-notifications` | Update `User.notify*` fields | None | None |
| Settings | `add-contact` / `edit-contact` | Create/update `EmergencyContact` | None | None |
| Settings | `delete-account` | Delete `User` (cascade all) | None | None |
