# LRDB_MODULE.md
# DisasterShield — LRDB Authority Module Page Specifications

---

## Module Overview

The LRDB (Local Disaster Resilient Government Body) module serves district and taluka-level disaster management officers responsible for monitoring, coordinating, and supporting MSMEs during weather disruptions and emergencies. Every page is scoped to a specific authenticated officer via the `$officerId` URL parameter (UUIDv4). All pages are wrapped in `AppShell` with `role="lrdb"`.

**Base route:** `/lrdb/$officerId/`
**Layout shell file:** `app/routes/lrdb.$officerId.tsx`
**Primary device target:** Desktop (1280px+) with tablet support

---

## Module-Wide Data Context

Every LRDB page loader begins with:

```ts
const officer = await requireRole(request, 'lrdb')
const lrdbProfile = await db.lRDBOfficer.findUnique({
  where: { userId: officer.id },
  include: { user: true }
})
// regionCode from lrdbProfile drives all data queries
const { regionCode, district, taluka } = lrdbProfile
```

The `regionCode` scopes all queries — officers only see shops, queries, alerts, and reports within their assigned region. A super-admin role (future v2) would have access across regions.

---

## Page 1 — List of Shops

**Route file:** `app/routes/lrdb.$officerId.shops.tsx` + `app/routes/lrdb.$officerId.shops.$shopId.tsx`
**URL:** `/lrdb/$officerId/shops` + `/lrdb/$officerId/shops/$shopId`
**Auth state:** Protected (LRDB role)

---

### Purpose
Provide the LRDB officer with a centralized, live directory of all registered MSMEs within their region. Enable rapid identification of high-risk businesses, direct contact initiation, and drill-down into individual shop details.

---

### Page Sections — Shop List (`/lrdb/$officerId/shops`)

#### Section 1.1 — Page Header
- `PageHeader` title "Registered Shops" subtitle "{district}, {taluka} — {total count} businesses registered"
- Action slot: Two buttons side by side:
  - "Export List" — downloads a CSV of all shops with risk levels
  - "Send Broadcast" — opens the broadcast alert composer (navigates to `/lrdb/$officerId/alerts` with pre-selected region)

---

#### Section 1.2 — Summary Stat Tiles

Four `StatTile` components in `grid-cols-4`:

| Tile | Value | Icon | Variant |
|---|---|---|---|
| Total Registered | Count of all `ShopProfile` in `regionCode` | `Store` | `default` |
| Critical Risk | Count where `riskProfile.riskLevel = CRITICAL` | `AlertOctagon` | `danger` |
| High Risk | Count where `riskProfile.riskLevel = HIGH` | `AlertTriangle` | `warning` |
| Offline / Unreachable | Count where `user.lastLoginAt` > 72hrs ago | `WifiOff` | `default` |

---

#### Section 1.3 — Filter & Search Bar

Horizontal filter bar:
- Search input — filters by shop name or owner name
- Risk Level filter — `Select`: All / Safe / Moderate / High / Critical / Offline
- Category filter — `Select`: All categories (from `CategorySelect` options)
- District / Taluka filter — `Select` (pre-filtered to officer's region, expandable)
- Sort by: Risk Level (default) / Shop Name / Last Active / Registration Date
- Toggle: "Show map view" — switches Section 1.4 between list and map

All filters applied via URL search params (`?risk=critical&category=pharmacy`) so they are shareable and bookmarkable. Remix `loader` reads params and applies Prisma `where` clauses.

---

#### Section 1.4 — Shop List / Map View

**List View (default):**

Desktop: shadcn `Table` with columns:
| Column | Content |
|---|---|
| Shop | Shop name + category badge |
| Owner | Owner name + phone number |
| Location | Village, Taluka |
| Risk Level | `RiskBadge` |
| Last Active | Relative timestamp + `StatusIndicator` |
| Stock Items | Count of `StockItem` records |
| Actions | "View" button + "Contact" button |

Each row is clickable → navigates to `/lrdb/$officerId/shops/$shopId`

"Contact" button on each row opens Stream direct message to that shop owner (calls `onContact` on `ShopCard`).

Mobile / Tablet: Stacked `ShopCard` components (one per shop).

**Map View (toggled):**

Full-width Leaflet map showing:
- All shops as colour-coded markers (`status-safe` green / `status-moderate` amber / `status-high` orange / `status-critical` red / `status-offline` grey)
- Clicking a marker opens a popup with shop name, owner, risk badge, and "View Details" + "Contact" buttons
- Cluster markers when zoomed out (Leaflet.markercluster)
- Layer toggle: Show flood zones / Show road network / Show relief centres

Empty state: `EmptyState icon={Store}` "No shops registered in your region yet."
Loading: `LoadingSkeleton variant="table" count={10}`

**Loader data:** All `ShopProfile` records for `regionCode` with `riskProfile`, `user` (lastLoginAt, name, phone), `locationProfile` (lat/lng, village, taluka), `_count` (stockItems).

---

### Page Sections — Shop Detail (`/lrdb/$officerId/shops/$shopId`)

#### Section 1.5 — Shop Detail Header
- `PageHeader` with shop name as title, category as subtitle
- Breadcrumb: Shops → {Shop Name}
- `RiskBadge` prominent in header
- Action slot: Two buttons:
  - "Send Message" — opens Stream direct message
  - "Create Query for Shop" — navigates to query creation pre-filled with this shop

---

#### Section 1.6 — Shop Overview Cards

Three `SectionCard` side by side (`grid-cols-3`):

**Business Profile card:**
- Owner name, phone, email
- GST number (if provided)
- Shop area, established year
- Registration date

**Location card:**
- Full address (village, taluka, district, pincode)
- Elevation, terrain type
- Leaflet mini-map (200px height) with shop pin
- Nearest reservoir, nearest water body (from `LocationProfile`)
- `LocationProfile.batchStatus` — if `PENDING` or `RUNNING`: show `StatusIndicator status="degraded"` with "Location data still being enriched"

**Risk Summary card:**
- `RiskBadge` (large, `size="lg"`)
- Overall risk score + `Progress` bar
- Top 2 risk factors listed
- Last computed timestamp

---

#### Section 1.7 — Stock Inventory Summary

`SectionCard` with title "Inventory Overview":
- Total items count + total estimated value (INR)
- MUI X `BarChart` — stock items grouped by sensitivity type (X-axis: sensitivity types, Y-axis: count)
- Table of top 5 highest-vulnerability stock items (read-only `StockItemRow` compact variant)

---

#### Section 1.8 — Location Risk Intelligence

`SectionCard` with title "Location Risk Intelligence":

Two-column layout:

**Left — Proximity Data (from `LocationProfile`):**
Key-value table:
- Nearest Hospital: {name} ({distanceKm} km)
- Nearest Police Station: {name} ({distanceKm} km)
- Nearest Fire Station: {name} ({distanceKm} km)
- Nearest Relief Centre: {name} ({distanceKm} km)
- Nearest Reservoir: {name} ({distanceKm} km)
- Nearest Dam: {name} ({distanceKm} km)
- Nearest Water Body: {name} ({distanceMetres}m) — `status-critical` if < 200m
- Road Access: {roadType} ({distanceMetres}m to paved road)
- Power Supply: {powerSupplyType}
- Connectivity: {connectivityType}

**Right — Building Profile:**
- Floor level, building type, roof type
- Has basement (Boolean → warning badge if yes)
- Storage level
- Shop area

---

#### Section 1.9 — Alert History for this Shop

`SectionCard` with title "Alert History":
- Last 5 `AlertRecipient` records for this shop owner, joined with `Alert`
- Each shown as a compact `AlertCard` (read-only, `isExpanded=false`)
- "View All Alerts" link → filters Alerts page to this shop

---

#### Section 1.10 — BCP Completion Status

`SectionCard` with title "Business Continuity Plan":
- Overall completion `Progress` bar (from `bcpPlan.completionPercent`)
- Before / During / After step completion counts as three mini `StatTile`
- Read-only view — LRDB cannot edit the BCP but can view it

---

#### Section 1.11 — Query History for this Shop

`SectionCard` with title "Support Queries":
- Table of all `Query` records where `shopProfileId` matches
- Each row: query type, priority badge, status badge, submitted date, assigned officer
- "Create New Query" button at bottom

---

## Page 2 — Queries

**Route file:** `app/routes/lrdb.$officerId.queries.tsx` + `app/routes/lrdb.$officerId.queries.$queryId.tsx`
**URL:** `/lrdb/$officerId/queries` + `/lrdb/$officerId/queries/$queryId`
**Auth state:** Protected (LRDB role)

---

### Purpose
Centrally manage all emergency assistance requests and support queries raised by MSMEs. Prioritise, assign, track resolution, and communicate directly with the requesting business.

---

### Page Sections — Queries List

#### Section 2.1 — Page Header
- `PageHeader` title "Queries" subtitle "Emergency assistance requests from businesses in your region"
- Action slot: "Create Query" button (LRDB can raise a query on behalf of a shop)

---

#### Section 2.2 — Summary Stat Tiles

Four `StatTile` in `grid-cols-4`:

| Tile | Value | Icon | Variant |
|---|---|---|---|
| Open Queries | Count where `status != RESOLVED` | `Inbox` | `default` |
| Critical | Count where `priority = CRITICAL` | `AlertOctagon` | `danger` |
| Pending Assignment | Count where `status = PENDING` | `Clock` | `warning` |
| Resolved Today | Count where `status = RESOLVED` and `resolvedAt` = today | `CheckCircle` | `success` |

---

#### Section 2.3 — Filter Bar

- Search: by shop name or query description keyword
- Status filter tabs: All | Pending | Under Review | Assigned | Escalated | Resolved
- Priority filter: `PrioritySelect` (All / Low / Medium / High / Critical)
- Query type filter: `Select` (All / Flood Assistance / Power Outage / Transport / Infrastructure / Stock Protection / Relief Support)
- Assigned to: `Select` (All / Me / Unassigned / Other Officers)
- Date range: From / To date pickers (shadcn `Calendar` via `Popover`)

Filters applied via URL search params. Loader reads and applies Prisma `where` clauses.

---

#### Section 2.4 — Queries Table

Desktop: shadcn `Table` with `QueryRow` for each record.

Columns:
| Column | Content |
|---|---|
| Query | Type label + description snippet (1 line truncated) |
| Shop | Shop name (linked to shop detail) |
| Priority | `QueryRow` priority badge |
| Status | `QueryRow` status badge |
| Assigned To | Officer name or "Unassigned" |
| Submitted | Relative timestamp |
| Actions | "View" + "Assign to Me" (if unassigned) |

"Assign to Me" button — inline action via `useFetcher`:
- Calls action `POST /lrdb/$officerId/queries` with `{ intent: 'assign', queryId, officerId }`
- Updates `Query.assignedToUserId` and `Query.status` to `UNDER_REVIEW`
- Appends `QueryStatusHistory` record
- Triggers email to shop owner via `sendQueryStatusMail`
- Row updates optimistically without page reload

Mobile: Stacked `QueryRow` card variant.

Empty state per tab:
- Pending: `EmptyState icon={Inbox}` "No pending queries. All requests have been reviewed."
- Resolved: `EmptyState icon={CheckCircle}` "No queries resolved today."

Loading: `LoadingSkeleton variant="table" count={8}`

**Loader data:** All `Query` records for shops in `regionCode` with `shopProfile` (name), `submittedBy` (name), `assignedTo` (name), `statusHistory` count.

---

### Page Sections — Query Detail (`/lrdb/$officerId/queries/$queryId`)

#### Section 2.5 — Query Detail Header
- `PageHeader` title: Query type as title, shop name as subtitle
- Breadcrumb: Queries → {Query Type} — {Shop Name}
- Priority badge + Status badge inline in header
- Action slot: Status update `Select` dropdown (Pending → Under Review → Assigned → Resolved / Escalated)
  - On change: calls action `POST /lrdb/$officerId/queries/$queryId` with `{ intent: 'update-status', newStatus }`
  - Updates `Query.status`, appends `QueryStatusHistory`, triggers email to shop owner

---

#### Section 2.6 — Query Details Card

`SectionCard` with title "Query Details":
- Full description (`@db.Text`)
- Submitted by: owner name + timestamp
- Assigned to: officer name (or "Unassigned" with "Assign to Me" button)
- Priority badge
- Resolution notes textarea (editable if status = RESOLVED):
  - shadcn `Textarea`
  - "Save Notes" button → action `intent: 'save-notes'`

---

#### Section 2.7 — Shop Context Panel

`SectionCard` with title "Shop Context":
- Shop name, category, location, risk level (`RiskBadge`)
- Relevant `LocationProfile` fields: nearest hospital, road access, connectivity
- Link: "View Full Shop Profile →"
- Current stock count + estimated total value
- Active alert count for this shop

This panel gives the officer the context they need to assess the urgency of the query without navigating away.

---

#### Section 2.8 — Status Timeline

`SectionCard` with title "Query Timeline":
- Vertical `TimelineStep` list — one step per `QueryStatusHistory` record
- Each step: status name, officer who changed it, timestamp, notes
- Most recent at top
- "Escalate Query" button at bottom (destructive variant) — sets status to ESCALATED and sends notification to senior officer (if configured)

---

#### Section 2.9 — Direct Communication

`SectionCard` with title "Message Shop Owner":
- Mini embedded chat panel showing the Stream direct message thread between this officer and the shop owner
- Uses `ChatThread` component scoped to the `dm-{officerId}-{shopOwnerId}` Stream channel
- "Open Full Chat" link → navigates to `/lrdb/$officerId/chat/$groupId`

---

## Page 3 — Chat Groups

**Route file:** `app/routes/lrdb.$officerId.chat.tsx` + `app/routes/lrdb.$officerId.chat.$groupId.tsx`
**URL:** `/lrdb/$officerId/chat` + `/lrdb/$officerId/chat/$groupId`
**Auth state:** Protected (LRDB role)

---

### Purpose
Provide LRDB officers with a centralized WhatsApp-style messaging hub to coordinate with MSMEs, volunteers, and support teams during disaster events. Includes label-based organisation, broadcast messaging, and real-time emergency prioritisation.

---

### Page Sections

#### Section 3.1 — Page Header
- `PageHeader` title "Communication Hub" subtitle "Coordinate with businesses and response teams"
- Action slot: "New Group" button — creates a new coordination group (opens `Dialog` with group name + label selector)

---

#### Section 3.2 — Chat Layout

Full-height `ChatLayout` component with `role="lrdb"`. Two-panel layout:

**Left Panel — Chat Sidebar (320px):**

Top: Search input ("Search chats...")
Below search: `ChatLabelFilter` showing all available labels. Selecting a label filters the group list.

Tabs below filter:
- **Groups** — All `ChatGroup` records where officer is a member (type: `LRDB_COORDINATION`, `LOCAL_MSME`)
- **Direct Messages** — All direct message threads with individual MSME owners (type: `DIRECT_MESSAGE`)
- **SOS Active** — Real-time filtered list of groups where an SOS has been triggered recently (type: `SOS_EMERGENCY`)

Each group rendered as `ChatGroupListItem` with labels displayed as chips.

**Right Panel — Chat Thread:**

`ChatThread` for active `$groupId`:
- Full message history via Stream
- Header: group name + label chips + participant count
- Voice call + video call buttons (for direct message threads)
- `ChatInput` at bottom (`showSOSButton=false` for LRDB — they receive SOS, they don't send them)
- Pinned messages section at top of thread (LRDB officers can pin important announcements)
- Announcement mode: "Pin as Announcement" option on message right-click context menu

**LRDB-Specific Chat Actions (available via `DropdownMenu` on each message):**
- Pin message
- Mark as action required
- Forward to another group
- Tag message with label

---

#### Section 3.3 — Broadcast Composer

Accessible via "Send Broadcast" button in the thread header (for groups of type `LOCAL_MSME`).

Opens a `Dialog`:
- Target: Region selector (defaults to officer's `regionCode`, can select sub-regions)
- Category filter: "Send to all shops" or filter by category / risk level
- Subject line input
- Message body `Textarea`
- Delivery channels: checkboxes for App, Email, SMS, WhatsApp
- Preview: "This message will be sent to {count} businesses"
- "Send Broadcast" button → calls action `POST /lrdb/$officerId/chat` with `intent: 'broadcast'`
  - Writes `Alert` record to MySQL (category: `OTHER`, severity based on content)
  - Writes `AlertRecipient` for each targeted shop owner
  - Sends via `sendBroadcastMail` for email channel
  - Posts message to all relevant Stream channels

---

#### Section 3.4 — SOS Active Panel (Right Side, 280px, Desktop Only)

Shown alongside the chat thread when `groupId` is of type `SOS_EMERGENCY`.

Content:
- SOS sender: shop name + owner name + location
- Time since SOS sent
- `RiskBadge` for that shop
- Nearest emergency services (hospital, police) from `LocationProfile`
- Quick action buttons:
  - "Dispatch Response Team" (marks SOS as acknowledged)
  - "Call Owner" → Stream voice call to the owner
  - "Get Directions" → opens Google Maps link with shop lat/lng

---

## Page 4 — Disaster Reports

**Route file:** `app/routes/lrdb.$officerId.reports.tsx` + `app/routes/lrdb.$officerId.reports.$reportId.tsx`
**URL:** `/lrdb/$officerId/reports` + `/lrdb/$officerId/reports/$reportId`
**Auth state:** Protected (LRDB role)

---

### Purpose
Generate, view, and publish post-disaster impact reports. Analyse which sectors and geographic zones suffered the most damage, track recovery progress, and identify recurring patterns to improve future preparedness.

---

### Page Sections — Reports List

#### Section 4.1 — Page Header
- `PageHeader` title "Disaster Reports" subtitle "Post-event analysis and recovery tracking"
- Action slot: "Create Report" button → opens new report creation dialog

---

#### Section 4.2 — Summary Stat Tiles

Four `StatTile` in `grid-cols-4`:

| Tile | Value | Icon | Variant |
|---|---|---|---|
| Total Reports | Count of all `DisasterReport` for `regionCode` | `FileBarChart` | `default` |
| Published | Count where `status = PUBLISHED` | `CheckCircle` | `success` |
| Drafts | Count where `status = DRAFT` | `FilePen` | `warning` |
| Total Estimated Loss | Sum of `ReportMetric.metricValue` where `metricKey = 'estimated_loss_inr'` | `Banknote` | `danger` |

---

#### Section 4.3 — Filter Bar

- Search: by report title or disaster type
- Status filter tabs: All | Draft | Published | Archived
- Disaster type filter: `Select` (Flood / Wind / Power Outage / Landslide / Other)
- Date range: From / To date pickers

---

#### Section 4.4 — Reports List

Vertical stack of `ReportSummaryCard` components.

Each card shows:
- Report title + disaster type badge
- Affected zone + report date
- Total shops affected + estimated total loss
- `RiskBadge` for severity
- Status badge (Draft / Published / Archived)
- "View" button → navigates to report detail
- "Publish" button (only on DRAFT) → `ActionConfirmDialog` → action `intent: 'publish'`

Empty state: `EmptyState icon={FileBarChart}` "No reports yet. Create your first disaster report after an event."
Loading: `LoadingSkeleton variant="card" count={5}`

**Loader data:** All `DisasterReport` records for `regionCode` with `reportMetrics`, ordered by `reportDate` desc.

---

### Page Sections — Report Detail (`/lrdb/$officerId/reports/$reportId`)

#### Section 4.5 — Report Header
- `PageHeader` with report title + status badge
- Breadcrumb: Reports → {Report Title}
- Action slot (for DRAFT reports):
  - "Edit Report" button
  - "Publish Report" button (destructive green — `ActionConfirmDialog` before publishing)

---

#### Section 4.6 — Report Overview

`SectionCard` with title "Event Overview":
- Disaster type, affected zone, report date
- Summary paragraph (`report.summary` — editable `Textarea` in edit mode)
- Publishing officer name + published date (if published)

---

#### Section 4.7 — Impact Metrics

`SectionCard` with title "Impact Summary":

Four `StatTile` in `grid-cols-4` from `ReportMetric` records:
- Total shops affected
- Total estimated loss (INR)
- Shops fully operational (recovered)
- Shops still disrupted

MUI X `BarChart` — Sector-wise damage:
- X-axis: Business categories (Grocery, Pharmacy, Hardware, etc.)
- Y-axis: Estimated loss (INR)
- Bars coloured by category

MUI X `PieChart` — Shops by recovery status:
- Fully Recovered / Partially Operating / Fully Disrupted

---

#### Section 4.8 — Geographic Impact Map

`SectionCard` with title "Geographic Impact":

Full-width Leaflet map showing:
- All affected shops as markers coloured by damage severity
- Heat map overlay showing concentration of losses
- Flood zone overlay if disaster type = FLOOD
- Relief centre locations as star markers
- Road accessibility layer showing blocked routes

---

#### Section 4.9 — Affected Shops Breakdown

`SectionCard` with title "Affected Businesses":

shadcn `Table` listing all shops included in this report:
| Column | Content |
|---|---|
| Shop | Name + category |
| Location | Village, Taluka |
| Estimated Loss | INR value |
| Primary Damage | Sensitivity type (e.g. Water-sensitive stock) |
| Recovery Status | Badge: Recovered / Partial / Disrupted |
| Query Raised | Yes/No badge |

---

#### Section 4.10 — Recurring Patterns

`SectionCard` with title "Pattern Analysis":

AI-generated (Python `GET /trends/{regionCode}`) insight panel:
- "This is the 3rd flood event in Mulshi in the last 5 years"
- "Grocery and pharmacy sectors consistently face the highest losses"
- "Average recovery time for this region is 8 days"

MUI X `LineChart` — Disaster frequency over 5 years (from `TrendDataPoint` historical data).

---

#### Section 4.11 — Add / Edit Report Metrics

In edit mode (DRAFT reports only):

`SectionCard` with title "Add Metrics":
- Form to add/edit `ReportMetric` records:
  - Metric label (e.g. "Total shops affected")
  - Metric key (auto-populated from label)
  - Metric value (number)
  - Sector breakdown (JSON editor — simplified as a key-value form with "Add sector" button)
- "Add Metric" button appends a new metric row
- "Save Metrics" button → action `intent: 'save-metrics'`

---

## Page 5 — Estimation

**Route file:** `app/routes/lrdb.$officerId.estimation.tsx`
**URL:** `/lrdb/$officerId/estimation`
**Auth state:** Protected (LRDB role)

---

### Purpose
Give LRDB officers a forward-looking financial intelligence view of potential disaster impact across the region. Helps prioritise resource deployment, identify the most vulnerable areas, and plan relief operations before or during a disaster.

---

### Page Sections

#### Section 5.1 — Page Header
- `PageHeader` title "Regional Estimation" subtitle "Financial impact forecasting for your region"
- Action slot: Disaster scenario selector (`Select`): Flood / Power Outage / Windstorm / Landslide — selecting updates all charts and metrics on the page via URL search param `?scenario=flood`

---

#### Section 5.2 — Region Overview Tiles

Six `StatTile` in `grid-cols-3 lg:grid-cols-6`:

| Tile | Value | Icon | Variant |
|---|---|---|---|
| Total Shops | Count in region | `Store` | `default` |
| Total Stock Value | Sum of all `estimatedValueInr` across region | `Package` | `default` |
| Estimated Total Loss | Sum of `forecastScenario.estimatedLossInr` for selected scenario | `Banknote` | `danger` |
| Shops at High Risk | Count where `riskLevel = HIGH or CRITICAL` | `ShieldAlert` | `warning` |
| Avg Recovery Days | Avg of `forecastScenario.recoveryTimelineDays` | `Clock` | `default` |
| Preventable Loss % | % of estimated loss that could be avoided with recommended actions | `TrendingDown` | `success` |

---

#### Section 5.3 — Loss Distribution Map

`SectionCard` with title "Loss Concentration Map":

Full-width Leaflet map (height: 400px):
- Choropleth overlay: taluka/village areas shaded by estimated total loss (darker red = higher loss)
- Shop markers coloured by individual `forecastScenario.estimatedLossInr`
- Clicking a marker shows popup: shop name, estimated loss, top affected stock type
- Supply chain route overlay: highlights roads connecting shops to major markets (coloured red if flood disruption predicted)
- Toggle overlays: Flood zones / Shop markers / Supply routes / Relief centres

---

#### Section 5.4 — Sector-Wise Loss Analysis

`SectionCard` with title "Loss by Business Sector":

MUI X `BarChart` (horizontal):
- Y-axis: Business categories
- X-axis: Estimated total loss (INR) — sum of `forecastScenario.estimatedLossInr` per category
- Bars colour-coded: red for top 3 most affected, amber for next 3, green for lowest

Below chart: Table showing the same data with extra columns:
| Category | Shop Count | Total Est. Loss | Avg Loss/Shop | Most Common Risk |
|---|---|---|---|---|

---

#### Section 5.5 — Area-Wise Breakdown

`SectionCard` with title "Loss by Area (Taluka/Village)":

MUI X `BarChart` (vertical):
- X-axis: Taluka / village names within the officer's region
- Y-axis: Total estimated loss (INR)

Sortable table below chart:
| Area | Shops | High Risk Shops | Estimated Loss | Connectivity | Road Access |
|---|---|---|---|---|---|

"Connectivity" and "Road Access" columns show aggregate `LocationProfile` data — helps identify areas that will be hardest to reach for relief operations.

---

#### Section 5.6 — Supply Chain Risk

`SectionCard` with title "Supply Chain Disruption Analysis":

MUI X `LineChart`:
- X-axis: Days post-disaster (Day 1 through Day 14)
- Y-axis: Estimated % of shops without supply access
- Two lines: Flood scenario (red) vs Power Outage scenario (amber)

Below chart: Text summary from Python `GET /trends/{regionCode}`:
- Which goods become scarce first
- Which transport routes are most critical
- Estimated time to supply chain restoration based on historical data

---

#### Section 5.7 — Resource Planning Panel

`SectionCard` with title "Resource Requirements":

Based on the selected disaster scenario and shop/location data, this panel estimates:

| Resource | Estimated Need | Basis |
|---|---|---|
| Emergency relief kits | {count} | 1 per shop with `riskLevel = CRITICAL` |
| Temporary storage capacity | {sq ft} | Sum of `shopAreaSqFt` for high-risk shops |
| Generator units needed | {count} | Shops with `powerSupplyType = GRID` in affected area |
| Medical response teams | {count} | Based on `nearestHospitalDistanceKm > 10km` shop count |
| Relief vehicle trips | {count} | Based on road accessibility scores |

"Export Resource Plan" button → generates downloadable PDF/CSV of this table.

---

## Page 6 — Alerts

**Route file:** `app/routes/lrdb.$officerId.alerts.tsx` + `app/routes/lrdb.$officerId.alerts.$alertId.tsx`
**URL:** `/lrdb/$officerId/alerts` + `/lrdb/$officerId/alerts/$alertId`
**Auth state:** Protected (LRDB role)

---

### Purpose
Allow LRDB officers to create, review, and broadcast targeted disaster alerts to MSMEs. Monitor delivery and action completion rates. Review AI-generated alerts and augment them with official guidance.

---

### Page Sections — Alerts List

#### Section 6.1 — Page Header
- `PageHeader` title "Alerts Management" subtitle "Create and monitor disaster advisories for your region"
- Action slot: "Create Alert" button → opens alert creation `Dialog`

---

#### Section 6.2 — Alert Performance Tiles

Four `StatTile` in `grid-cols-4`:

| Tile | Value | Icon | Variant |
|---|---|---|---|
| Active Alerts | Count where `isActive = true` | `BellRing` | `warning` |
| Total Recipients | Sum of `AlertRecipient` for active alerts | `Users` | `default` |
| Read Rate | % of `AlertRecipient` where `isRead = true` | `Eye` | `default` |
| Action Completion | % of `AlertActionResult` where `isCompleted = true` | `CheckCircle` | `success` |

---

#### Section 6.3 — Filter Bar

- Status tabs: All | Active | Expired | Archived
- Severity filter: All / Low / Medium / High / Critical
- Category filter: All / Flood / Wind / Power Outage / Transport / Landslide / Other
- Date range filter
- Created by: All / AI Generated / Officer Created

---

#### Section 6.4 — Alerts Table

shadcn `Table` with one row per `Alert`:

| Column | Content |
|---|---|
| Alert | Title + category badge |
| Severity | `RiskBadge` |
| Issued | Relative timestamp |
| Recipients | Count of `AlertRecipient` |
| Read Rate | % as `Progress` bar |
| Action Rate | % as `Progress` bar |
| Status | Active / Expired badge |
| Actions | "View" + "Deactivate" (if active) + "Duplicate" |

"Duplicate" — creates a copy of the alert with DRAFT status for editing and re-sending.

Empty state: `EmptyState icon={BellRing}` "No alerts have been issued yet."
Loading: `LoadingSkeleton variant="table" count={8}`

**Loader data:** All `Alert` records where `affectedRegions` contains officer's `regionCode`, with counts of `AlertRecipient` total, read, and `AlertActionResult` completed.

---

#### Section 6.5 — Create Alert Dialog

Opens as a full `Dialog` (large size):

Form fields:
- Alert Title `*` — text input
- Severity `*` — `PrioritySelect` (maps to `AlertSeverity`)
- Category `*` — `Select`: Flood / Wind / Power Outage / Transport / Landslide / Other
- Summary / Message `*` — `Textarea` (AI Assist button alongside — calls Python `POST /alerts/generate` with officer's draft text + weather context, returns an enhanced version)
- Target region — pre-filled with officer's `regionCode`, editable
- Target category filter — `CategorySelect` multiselect ("Send to all" or specific business types)
- Target risk level filter — `RiskBadge` level multiselect
- Recommended actions — repeatable field:
  - "Add Action" button appends a new `AlertAction` row
  - Each action: label input + action type `Select`
- Delivery channels — checkboxes: App / Email / SMS / WhatsApp
- Expires at — optional date-time picker
- "AI Enhance" button — sends current draft to Python `POST /alerts/generate` and replaces summary with LLM-enhanced version (with user confirmation)

Preview panel (right side of dialog on desktop):
- Live preview of the `AlertCard` as recipients will see it
- Recipient count estimate: "This alert will be sent to {count} businesses"

Buttons:
- "Send Alert" → `ActionConfirmDialog` → action `intent: 'create-alert'`
- "Save as Draft" → saves without sending

**Action on send:**
- Creates `Alert` record in MySQL
- Creates `AlertRecipient` record for each targeted shop owner
- Creates `AlertAction` records for each added action
- Sends email via `sendBroadcastMail` for email channel recipients
- Redirects to alert detail page

---

### Page Sections — Alert Detail (`/lrdb/$officerId/alerts/$alertId`)

#### Section 6.6 — Alert Detail Header
- `PageHeader` with alert title + `RiskBadge` severity
- Breadcrumb: Alerts → {Alert Title}
- Issued at + expires at + created by
- Action slot:
  - "Deactivate Alert" button (if active) → `ActionConfirmDialog`
  - "Duplicate & Edit" button

---

#### Section 6.7 — Alert Content

`SectionCard` with title "Alert Content":
- Category badge + severity badge
- Full summary text
- Recommended actions list (read-only `TimelineStep` components)
- Target regions + target categories

---

#### Section 6.8 — Delivery Analytics

`SectionCard` with title "Delivery Performance":

MUI X `BarChart`:
- X-axis: Delivery channels (App / Email / SMS / WhatsApp)
- Y-axis: Count of deliveries
- Grouped bars: Delivered (green) vs Failed (red)

Two `Progress` bars:
- Read Rate: "{readCount} of {totalRecipients} recipients have read this alert"
- Action Completion Rate: "{completedCount} of {totalActions} actions completed"

MUI X `LineChart` — Read rate over time (hours since alert issued):
- Shows adoption curve — how quickly recipients read the alert
- Useful for deciding whether to send a follow-up

---

#### Section 6.9 — Recipient List

`SectionCard` with title "Recipients" with search input:

shadcn `Table`:
| Column | Content |
|---|---|
| Shop | Name + category |
| Owner | Owner name |
| Read | Read badge (Yes/No + timestamp) |
| Actions Completed | "{completed}/{total}" |
| Last Active | Relative timestamp |

Filterable: All / Read / Unread / Actions Pending

"Send Reminder" bulk action button — sends a follow-up notification to all unread recipients via their preferred channel.

---

## Page 7 — Settings

**Route file:** `app/routes/lrdb.$officerId.settings.tsx`
**URL:** `/lrdb/$officerId/settings`
**Auth state:** Protected (LRDB role)

---

### Purpose
Allow LRDB officers to manage their administrative profile, alert system configuration, regional boundaries, notification preferences, and access controls.

---

### Page Sections

#### Section 7.1 — Page Header
- `PageHeader` title "Settings" subtitle "Administrative configuration and preferences"

---

#### Section 7.2 — Officer Profile

`SectionCard` with title "Officer Profile" and "Edit" button in header action slot.

Display mode:
- Full name, email (from Google, read-only), designation
- District, taluka, region code
- Avatar (from Google profile)

Edit mode:
- Designation `*` — text input
- District `*` — text input
- Taluka — text input
- Region Code `*` — text input (auto-derived but editable)
- "Save Changes" + "Cancel" buttons
- On submit: action `intent: 'update-officer-profile'` → updates `LRDBOfficer` record

---

#### Section 7.3 — Alert System Configuration

`SectionCard` with title "Alert Thresholds":

These thresholds control when the APScheduler batch job triggers alert generation for this region.

Fields (all numeric inputs with helper text):
- Rain threshold (mm/hr) — default: 20 — "Alerts generated when rainfall exceeds this value"
- Wind threshold (kmph) — default: 40 — "Alerts generated when wind speed exceeds this value"
- Flood risk radius (metres) — default: 500 — "Shops within this distance of a water body get flood pre-warnings"
- Alert cooldown (hours) — default: 3 — "Minimum hours between consecutive alerts for the same shop"

"Save Thresholds" button → action `intent: 'update-thresholds'` → updates environment config for this region (stored in a future `RegionConfig` table — for v1 store in `LRDBOfficer` as JSON field)

---

#### Section 7.4 — Notification Preferences

`SectionCard` with title "My Notifications":

`NotificationToggleGroup` — what the officer themselves receives:
- New query submitted in my region
- Critical alert auto-generated by system
- SOS triggered by any shop in my region
- Query escalated to me
- New shop registered in my region

Channels: App, Email only (no SMS/WhatsApp for officers in v1)

---

#### Section 7.5 — Regional Administration

`SectionCard` with title "Region Configuration":

Read-only display of the officer's configured region:
- District name
- Taluka name
- Region code
- Bounding area (described in text — e.g. "Covers Mulshi and Velhe talukas of Pune district")
- Total shops in region (count)
- Adjacent regions (list of region codes — for future cross-region coordination)

"Request Region Change" button — opens a `Dialog` with a text field to describe the change request. Submits a notification to the system administrator (email to a configured admin address via `sendMail`).

---

#### Section 7.6 — Communication Settings

`SectionCard` with title "Broadcast Settings":

- Default broadcast message signature (text input — appended to all broadcast messages)
- Default alert expiry duration (`Select`: 3 hours / 6 hours / 12 hours / 24 hours / Custom)
- Auto-send email on alert creation (toggle)
- Require confirmation before broadcast (toggle — adds `ActionConfirmDialog` step)

---

#### Section 7.7 — Account & Security

`SectionCard` with title "Account & Security":

- Email address (read-only — from Google)
- Last login: timestamp + device info
- Active sessions: count (future feature)
- "Sign out of all devices" button → destroys all sessions for this user
- Data export: "Download my data" button → generates JSON export of officer's activity log

---

## Loader Data Summary

| Page | Prisma Queries | Python API Calls |
|---|---|---|
| Shop List | `shopProfile` (all in regionCode) with `riskProfile`, `user`, `locationProfile`, `_count(stockItems)` | None |
| Shop Detail | `shopProfile` (single) with all relations + `alertRecipient` (last 5) + `query` history | None |
| Queries List | `query` (all in regionCode) with `shopProfile`, `submittedBy`, `assignedTo` | None |
| Query Detail | `query` (single) with `statusHistory`, `shopProfile` with `locationProfile`, `riskProfile` | None |
| Chat | `chatGroup` (officer's groups) with `chatGroupMember` count, `chatLabel` | Stream API (channel list) |
| Reports List | `disasterReport` (all in regionCode) with `reportMetric` | None |
| Report Detail | `disasterReport` (single) with `reportMetric`, all shop data for affected zone | `GET /trends/{regionCode}` |
| Estimation | `shopProfile` (all) with `forecastScenario`, `locationProfile`, `riskProfile` | `GET /trends/{regionCode}` |
| Alerts List | `alert` (all in regionCode) with recipient + action completion counts | None |
| Alert Detail | `alert` (single) with `alertRecipient` (all), `alertAction`, `alertActionResult` | None |
| Settings | `user` with `lrdbOfficer` | None |

---

## Action Summary

| Page | Action Intent | Prisma Operation | Python API Call | Mail Trigger |
|---|---|---|---|---|
| Shop List | `export-list` | Read all `shopProfile` in region | None | None |
| Queries List | `assign` | Update `Query.assignedToUserId` + `status`, append `QueryStatusHistory` | None | `sendQueryStatusMail` |
| Queries List | `create-query` | Create `Query` record | None | `sendQueryStatusMail` |
| Query Detail | `update-status` | Update `Query.status`, append `QueryStatusHistory` | None | `sendQueryStatusMail` |
| Query Detail | `save-notes` | Update `Query.resolutionNotes` | None | None |
| Query Detail | `escalate` | Update `Query.status = ESCALATED`, append history | None | `sendQueryStatusMail` |
| Chat | `broadcast` | Create `Alert` + `AlertRecipient` records | None | `sendBroadcastMail` |
| Chat | `create-group` | Create `ChatGroup` + `ChatGroupMember`, create Stream channel | None | None |
| Reports List | `create-report` | Create `DisasterReport` (DRAFT) | None | None |
| Reports List | `publish` | Update `DisasterReport.status = PUBLISHED`, set `publishedAt` | None | `sendBroadcastMail` (notify region) |
| Report Detail | `save-metrics` | Upsert `ReportMetric` records | None | None |
| Alerts List | `create-alert` | Create `Alert` + `AlertRecipient` + `AlertAction` records | `POST /alerts/generate` (AI enhance) | `sendBroadcastMail` |
| Alerts List | `deactivate-alert` | Update `Alert.isActive = false` | None | None |
| Alert Detail | `send-reminder` | Read unread `AlertRecipient` list | None | `sendBroadcastMail` (reminder) |
| Settings | `update-officer-profile` | Update `LRDBOfficer` fields | None | None |
| Settings | `update-thresholds` | Update threshold config | None | None |
| Settings | `update-notifications` | Update `User.notify*` fields | None | None |
