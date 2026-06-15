# DATABASE.md
# DisasterShield — Database Architecture & Schema

---

## 1. Technology Choices

| Layer | Technology | Purpose |
|---|---|---|
| Database engine | **MySQL 8.0+** | Primary relational store for all structured application data |
| ORM (Node/Remix) | **Prisma** | Type-safe schema definition, migrations, and query client for Remix loaders/actions |
| ORM (Python/FastAPI) | **SQLAlchemy** + **PyMySQL** | Database access from the Python AI/ML backend packages |
| Migration tool (Node) | **Prisma Migrate** | Schema versioning and migration execution |
| Migration tool (Python) | **Alembic** | Schema migration management on the Python side (reads same MySQL DB) |

Both the Remix server and the Python FastAPI backend connect to the **same MySQL database instance**. Prisma is the source of truth for the schema — the Python side reads/writes the same tables using SQLAlchemy models that mirror the Prisma schema.

---

## 2. Installation & Setup

### Node / Remix Side

```bash
# Install Prisma CLI and client
npm install prisma @prisma/client

# Initialise Prisma with MySQL provider
# This creates prisma/schema.prisma and adds DATABASE_URL to .env
npx prisma init --datasource-provider mysql
```

Add to `.env`:
```env
DATABASE_URL="mysql://root:password@localhost:3306/disastershield"
```

### Python Side

```bash
cd backend
pip install sqlalchemy pymysql alembic
```

Add to `backend/.env`:
```env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/disastershield
```

---

## 3. Monorepo File Locations

```
disastershield/
├── prisma/
│   ├── schema.prisma           # Single source of truth for the DB schema
│   └── migrations/             # Auto-generated migration files (commit these)
│
├── app/
│   └── lib/
│       └── db.server.ts        # Prisma client singleton for Remix
│
└── backend/
    └── packages/
        └── core/
            └── database.py     # SQLAlchemy engine + session factory for Python
```

---

## 4. Prisma Client Singleton (`app/lib/db.server.ts`)

Remix's dev server uses hot module replacement (HMR). Without the singleton pattern, a new Prisma client is instantiated on every file change, quickly exhausting MySQL connection limits.

```ts
// app/lib/db.server.ts
import { PrismaClient } from '@prisma/client'

declare global {
  var __db__: PrismaClient | undefined
}

let db: PrismaClient

if (process.env.NODE_ENV === 'production') {
  db = new PrismaClient()
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient({
      log: ['query', 'error', 'warn'],   // Log queries in development
    })
  }
  db = global.__db__
}

export { db }
```

**Usage in a Remix loader:**
```ts
import { db } from '~/lib/db.server'

export async function loader({ params }: LoaderFunctionArgs) {
  const stock = await db.stockItem.findMany({
    where: { shopProfile: { userId: params.userId } },
    include: { sensitivities: true },
  })
  return json({ stock })
}
```

---

## 5. SQLAlchemy Session Factory (`backend/packages/core/database.py`)

```python
# backend/packages/core/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # Reconnect on stale connections
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

# Dependency for FastAPI route injection
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Usage in a FastAPI router:**
```python
from fastapi import Depends
from sqlalchemy.orm import Session
from packages.core.database import get_db

@router.get("/trends/{region}")
def get_trends(region: str, db: Session = Depends(get_db)):
    data = db.query(TrendDataPoint).filter(
        TrendDataPoint.region_code == region
    ).all()
    return data
```

---

## 6. Full Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ────────────────────────────────────────────────────────────────────

enum Role {
  MSME
  LRDB
}

enum Language {
  en
  mr
  hi
}

enum RiskLevel {
  SAFE
  MODERATE
  HIGH
  CRITICAL
  OFFLINE
}

enum SensitivityType {
  WATER
  HEAT
  FRAGILE
  PERISHABLE
  FLAMMABLE
  THEFT
  HUMIDITY
}

enum AlertSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AlertCategory {
  FLOOD
  WIND
  POWER_OUTAGE
  TRANSPORT
  LANDSLIDE
  HEATWAVE
  OTHER
}

enum BCPPhase {
  BEFORE
  DURING
  AFTER
}

enum QueryPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum QueryStatus {
  PENDING
  UNDER_REVIEW
  ASSIGNED
  RESOLVED
  ESCALATED
}

enum ReportStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum TerrainType {
  HILLY
  FLAT
  VALLEY
  SLOPE
}

enum WaterBodyType {
  RIVER
  STREAM
  LAKE
  RESERVOIR
  DAM
  NALLA
  NONE
}

enum RoadType {
  STATE_HIGHWAY
  DISTRICT_ROAD
  VILLAGE_ROAD
  KACHCHA
  NONE
}

enum PowerSupplyType {
  GRID
  SOLAR
  GENERATOR
  MIXED
}

enum ConnectivityType {
  FOUR_G
  THREE_G
  TWO_G
  NONE
}

enum ShopFloorLevel {
  GROUND
  FIRST
  BASEMENT
}

enum BuildingType {
  PUCCA
  SEMI_PUCCA
  KUTCHA
}

enum RoofType {
  RCC_SLAB
  TIN_SHEET
  ASBESTOS
  TILED
  THATCHED
}

enum StorageFloorLevel {
  GROUND_LEVEL
  ELEVATED_SHELF
  FIRST_FLOOR
}

enum LocationBatchStatus {
  PENDING
  RUNNING
  COMPLETE
  FAILED
}
  APP
  EMAIL
  SMS
  WHATSAPP
}

enum NotificationStatus {
  QUEUED
  SENT
  FAILED
}

enum ChatGroupType {
  LOCAL_MSME
  LRDB_COORDINATION
  DIRECT_MESSAGE
  SOS_EMERGENCY
}

// ─── AUTH & USERS ──────────────────────────────────────────────────────────────

model User {
  id                      String    @id @default(uuid())
  email                   String    @unique
  name                    String
  avatarUrl               String?
  role                    Role      @default(MSME)
  language                Language  @default(en)

  // Notification preferences
  notifyViaApp            Boolean   @default(true)
  notifyViaEmail          Boolean   @default(true)
  notifyViaSms            Boolean   @default(false)
  notifyViaWhatsapp       Boolean   @default(false)

  // Timestamps
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  lastLoginAt             DateTime?

  // Relations
  shopProfile             ShopProfile?
  lrdbOfficer             LRDBOfficer?
  emergencyContacts       EmergencyContact[]
  alertRecipients         AlertRecipient[]
  notificationLogs        NotificationLog[]
  chatGroupMembers        ChatGroupMember[]
  queriesSubmitted        Query[]           @relation("QuerySubmitter")
  queriesAssigned         Query[]           @relation("QueryAssignee")

// ─── MSME BUSINESS PROFILE ─────────────────────────────────────────────────────

model ShopProfile {
  id                String    @id @default(uuid())
  userId            String    @unique
  shopName          String
  category          String
  address           String
  district          String
  taluka            String
  pincode           String
  latitude          Float?
  longitude         Float?
  phoneNumber       String?
  gstNumber         String?
  establishedYear   Int?
  regionCode        String    // Used for proximity grouping and trend lookup

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  user              User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  locationProfile   LocationProfile?
  stockItems        StockItem[]
  bcpPlan           BCPPlan?
  riskProfile       RiskProfile?
  forecastScenarios ForecastScenario[]

  @@index([regionCode])
  @@index([district])
  @@map("shop_profiles")
}

model EmergencyContact {
  id           String  @id @default(uuid())
  userId       String
  name         String
  phone        String
  relationship String   // e.g. 'Spouse', 'Business Partner', 'Employee'
  isPrimary    Boolean  @default(false)

  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("emergency_contacts")
}

// ─── STOCK MANAGEMENT ──────────────────────────────────────────────────────────

model StockItem {
  id                  String    @id @default(uuid())
  shopProfileId       String
  name                String
  category            String
  quantity            Float
  unit                String    // e.g. 'kg', 'units', 'litres', 'boxes'
  estimatedValueInr   Float     // Estimated value in Indian Rupees
  storageLocation     String?   // e.g. 'Back room shelf 3', 'Refrigerator unit 1'
  expiryDate          DateTime? // For perishable items
  vulnerabilityScore  Int       @default(0)  // 0–100, computed by AI risk engine
  notes               String?

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  shopProfile         ShopProfile        @relation(fields: [shopProfileId], references: [id], onDelete: Cascade)
  sensitivities       StockSensitivity[]

  @@index([shopProfileId])
  @@index([expiryDate])
  @@map("stock_items")
}

model StockSensitivity {
  id            String          @id @default(uuid())
  stockItemId   String
  type          SensitivityType

  stockItem     StockItem       @relation(fields: [stockItemId], references: [id], onDelete: Cascade)

  @@unique([stockItemId, type])
  @@map("stock_sensitivities")
}

// ─── ALERTS ────────────────────────────────────────────────────────────────────

model Alert {
  id                String         @id @default(uuid())
  title             String
  severity          AlertSeverity
  category          AlertCategory
  summary           String         @db.Text   // AI-generated summary
  affectedRegions   String         // Comma-separated region codes
  weatherEventRef   String?        // Reference to external weather event ID (IMD)
  issuedByUserId    String?        // LRDB officer UUID (null = system generated)
  isActive          Boolean        @default(true)
  expiresAt         DateTime?

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  // Relations
  recipients        AlertRecipient[]
  actions           AlertAction[]

  @@index([severity])
  @@index([isActive])
  @@index([createdAt])
  @@map("alerts")
}

model AlertRecipient {
  id            String    @id @default(uuid())
  alertId       String
  userId        String
  isRead        Boolean   @default(false)
  readAt        DateTime?

  alert         Alert     @relation(fields: [alertId], references: [id], onDelete: Cascade)
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  actionResults AlertActionResult[]

  @@unique([alertId, userId])
  @@index([userId, isRead])
  @@map("alert_recipients")
}

model AlertAction {
  id          String    @id @default(uuid())
  alertId     String
  label       String    // e.g. 'Move water-sensitive stock to higher shelf'
  actionType  String    // e.g. 'mark-secured', 'notify-employees', 'request-support'
  orderIndex  Int       @default(0)

  alert       Alert     @relation(fields: [alertId], references: [id], onDelete: Cascade)
  results     AlertActionResult[]

  @@map("alert_actions")
}

model AlertActionResult {
  id               String        @id @default(uuid())
  alertActionId    String
  alertRecipientId String
  isCompleted      Boolean       @default(false)
  completedAt      DateTime?

  alertAction      AlertAction      @relation(fields: [alertActionId], references: [id], onDelete: Cascade)
  alertRecipient   AlertRecipient   @relation(fields: [alertRecipientId], references: [id], onDelete: Cascade)

  @@unique([alertActionId, alertRecipientId])
  @@map("alert_action_results")
}

// ─── BUSINESS CONTINUITY PLAN ──────────────────────────────────────────────────

model BCPPlan {
  id                String    @id @default(uuid())
  shopProfileId     String    @unique
  completionPercent Int       @default(0)   // 0–100
  generatedAt       DateTime  @default(now())
  lastUpdatedAt     DateTime  @updatedAt

  shopProfile       ShopProfile  @relation(fields: [shopProfileId], references: [id], onDelete: Cascade)
  steps             BCPStep[]

  @@map("bcp_plans")
}

model BCPStep {
  id          String    @id @default(uuid())
  bcpPlanId   String
  phase       BCPPhase
  title       String
  description String    @db.Text
  isCompleted Boolean   @default(false)
  completedAt DateTime?
  orderIndex  Int       @default(0)
  isOptional  Boolean   @default(false)

  bcpPlan     BCPPlan   @relation(fields: [bcpPlanId], references: [id], onDelete: Cascade)

  @@index([bcpPlanId, phase])
  @@map("bcp_steps")
}

// ─── RISK PROFILING ────────────────────────────────────────────────────────────

model RiskProfile {
  id               String    @id @default(uuid())
  shopProfileId    String    @unique
  overallScore     Int       // 0–100
  floodScore       Int       @default(0)
  powerScore       Int       @default(0)
  stockScore       Int       @default(0)
  locationScore    Int       @default(0)
  accessScore      Int       @default(0)   // Road/transport accessibility risk
  riskLevel        RiskLevel @default(MODERATE)
  lastComputedAt   DateTime  @default(now())

  shopProfile      ShopProfile     @relation(fields: [shopProfileId], references: [id], onDelete: Cascade)
  suggestions      RiskSuggestion[]

  @@map("risk_profiles")
}

model RiskSuggestion {
  id             String    @id @default(uuid())
  riskProfileId  String
  title          String
  description    String    @db.Text
  impactScore    Int       // How much this suggestion improves overall score (0–20)
  isActioned     Boolean   @default(false)
  actionedAt     DateTime?
  orderIndex     Int       @default(0)

  riskProfile    RiskProfile  @relation(fields: [riskProfileId], references: [id], onDelete: Cascade)

  @@index([riskProfileId])
  @@map("risk_suggestions")
}

// ─── FORECASTS & TRENDS ────────────────────────────────────────────────────────

model ForecastScenario {
  id                    String    @id @default(uuid())
  shopProfileId         String
  disasterType          String    // e.g. 'Flood', '3-Day Power Outage', 'Landslide'
  probability           String    // 'low' | 'medium' | 'high'
  estimatedLossInr      Float
  affectedItemCount     Int
  estimatedDowntimeDays Int
  recoveryTimelineDays  Int
  aiNarrative           String    @db.Text
  generatedAt           DateTime  @default(now())

  shopProfile           ShopProfile @relation(fields: [shopProfileId], references: [id], onDelete: Cascade)
  affectedItems         ForecastAffectedItem[]

  @@index([shopProfileId])
  @@map("forecast_scenarios")
}

model ForecastAffectedItem {
  id                  String    @id @default(uuid())
  forecastScenarioId  String
  stockItemName       String
  estimatedDamageInr  Float

  forecastScenario    ForecastScenario @relation(fields: [forecastScenarioId], references: [id], onDelete: Cascade)

  @@map("forecast_affected_items")
}

model TrendDataPoint {
  id          String    @id @default(uuid())
  regionCode  String
  trendType   String    // 'rainfall' | 'flood_incident' | 'power_outage' | 'transport_disruption' | 'customer_activity'
  value       Float     // Measurement value (mm rainfall, incident count, hours of outage, etc.)
  unit        String    // e.g. 'mm', 'incidents', 'hours', 'index'
  recordedAt  DateTime  // Date of the data point
  source      String?   // e.g. 'IMD', 'Manual', 'LRDB Report'

  @@index([regionCode, trendType])
  @@index([recordedAt])
  @@map("trend_data_points")
}

// ─── LOCATION PROFILE ──────────────────────────────────────────────────────────

model LocationProfile {
  id                            String               @id @default(uuid())
  shopProfileId                 String               @unique

  // ── Coordinates & Source ──────────────────────────────────────────────────
  latitude                      Float
  longitude                     Float
  manuallySet                   Boolean              @default(false)  // true if user dragged pin manually
  nominatimPlaceId              String?              // OSM place_id for future refresh

  // ── Reverse Geocoded Address (from Nominatim) ─────────────────────────────
  village                       String?
  suburb                        String?
  taluka                        String?              // OSM county field
  district                      String?
  pincode                       String?

  // ── Topographic (from Open-Elevation + OpenTopoData) ─────────────────────
  elevationMetres               Float?
  terrainSlope                  Float?               // Degrees
  slopeAspect                   String?              // e.g. 'NE', 'SW'
  terrainType                   TerrainType?         // Derived from slope value

  // ── Nearest Water Body (from Overpass) ───────────────────────────────────
  nearestWaterBodyName          String?
  nearestWaterBodyType          WaterBodyType?
  nearestWaterBodyDistanceMetres Float?

  // ── Nearest Reservoir / Dam (from Overpass) ───────────────────────────────
  nearestReservoirName          String?
  nearestReservoirDistanceKm    Float?
  nearestDamName                String?
  nearestDamDistanceKm          Float?

  // ── Emergency Services (from Overpass) ───────────────────────────────────
  nearestHospitalName           String?
  nearestHospitalDistanceKm     Float?
  nearestPoliceStationName      String?
  nearestPoliceStationDistanceKm Float?
  nearestFireStationName        String?
  nearestFireStationDistanceKm  Float?
  nearestReliefCentreName       String?
  nearestReliefCentreDistanceKm Float?
  nearestLRDBCentreName         String?
  nearestLRDBCentreDistanceKm   Float?

  // ── Road & Connectivity Infrastructure (from Overpass + user input) ───────
  nearestRoadType               RoadType?
  nearestPavedRoadDistanceMetres Float?
  nearestSubstationName         String?
  nearestSubstationDistanceKm   Float?
  connectivityType              ConnectivityType?    // User-selected during registration
  powerSupplyType               PowerSupplyType?     // User-selected during registration

  // ── Building & Shop Structure (user-provided during registration) ─────────
  shopFloorLevel                ShopFloorLevel?
  buildingType                  BuildingType?
  roofType                      RoofType?
  hasBasement                   Boolean?
  shopAreaSqFt                  Int?
  storageFloorLevel             StorageFloorLevel?

  // ── Weather Integration ───────────────────────────────────────────────────
  imdGridRef                    String?              // Derived from lat/lng at batch time
  meteosourceLocationId         String?              // Meteosource internal location ID cache

  // ── Batch Job Metadata ────────────────────────────────────────────────────
  batchStatus                   LocationBatchStatus  @default(PENDING)
  lastBatchRunAt                DateTime?
  batchErrorMessage             String?

  createdAt                     DateTime             @default(now())
  updatedAt                     DateTime             @updatedAt

  shopProfile                   ShopProfile          @relation(fields: [shopProfileId], references: [id], onDelete: Cascade)

  @@map("location_profiles")
}



model LRDBOfficer {
  id           String   @id @default(uuid())
  userId       String   @unique
  district     String
  taluka       String?
  designation  String   // e.g. 'District Disaster Manager', 'Block Officer'
  regionCode   String

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([regionCode])
  @@map("lrdb_officers")
}

model Query {
  id              String        @id @default(uuid())
  shopProfileId   String
  submittedByUserId String
  assignedToUserId String?
  queryType       String        // e.g. 'Flood Assistance', 'Power Outage', 'Transport'
  description     String        @db.Text
  priority        QueryPriority @default(MEDIUM)
  status          QueryStatus   @default(PENDING)
  resolvedAt      DateTime?
  resolutionNotes String?       @db.Text

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  submittedBy     User          @relation("QuerySubmitter", fields: [submittedByUserId], references: [id])
  assignedTo      User?         @relation("QueryAssignee", fields: [assignedToUserId], references: [id])
  statusHistory   QueryStatusHistory[]

  @@index([status, priority])
  @@index([submittedByUserId])
  @@map("queries")
}

model QueryStatusHistory {
  id          String      @id @default(uuid())
  queryId     String
  fromStatus  QueryStatus?
  toStatus    QueryStatus
  changedBy   String      // User UUID
  notes       String?
  changedAt   DateTime    @default(now())

  query       Query       @relation(fields: [queryId], references: [id], onDelete: Cascade)

  @@index([queryId])
  @@map("query_status_history")
}

model DisasterReport {
  id                  String        @id @default(uuid())
  title               String
  disasterType        String
  affectedZone        String        // Human-readable area name
  affectedRegionCode  String
  reportDate          DateTime
  status              ReportStatus  @default(DRAFT)
  createdByUserId     String        // LRDB officer UUID
  publishedAt         DateTime?
  summary             String?       @db.Text

  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  metrics             ReportMetric[]

  @@index([affectedRegionCode])
  @@index([status])
  @@map("disaster_reports")
}

model ReportMetric {
  id                  String         @id @default(uuid())
  disasterReportId    String
  metricKey           String         // e.g. 'total_shops_affected', 'estimated_loss_inr'
  metricValue         Float
  metricLabel         String         // Human-readable label
  sectorBreakdown     String?        @db.Text  // JSON string of sector-wise breakdown

  disasterReport      DisasterReport @relation(fields: [disasterReportId], references: [id], onDelete: Cascade)

  @@map("report_metrics")
}

// ─── CHAT (METADATA ONLY) ──────────────────────────────────────────────────────

model ChatGroup {
  id              String        @id @default(uuid())
  streamChannelId String        @unique  // Stream channel ID (e.g. 'local-pune-uuid')
  name            String
  regionCode      String
  groupType       ChatGroupType
  createdByUserId String
  isActive        Boolean       @default(true)

  createdAt       DateTime      @default(now())

  members         ChatGroupMember[]
  labels          ChatLabel[]

  @@index([regionCode])
  @@index([groupType])
  @@map("chat_groups")
}

model ChatGroupMember {
  id            String    @id @default(uuid())
  chatGroupId   String
  userId        String
  joinedAt      DateTime  @default(now())
  isAdmin       Boolean   @default(false)

  chatGroup     ChatGroup @relation(fields: [chatGroupId], references: [id], onDelete: Cascade)
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([chatGroupId, userId])
  @@map("chat_group_members")
}

model ChatLabel {
  id            String    @id @default(uuid())
  chatGroupId   String
  label         String    // e.g. 'Emergency', 'Flood Alert', 'Volunteer Coordination'

  chatGroup     ChatGroup @relation(fields: [chatGroupId], references: [id], onDelete: Cascade)

  @@unique([chatGroupId, label])
  @@map("chat_labels")
}

// ─── NOTIFICATION LOG ──────────────────────────────────────────────────────────

model NotificationLog {
  id          String              @id @default(uuid())
  userId      String
  channel     NotificationChannel
  type        String              // e.g. 'alert', 'bcp_ready', 'risk_change', 'broadcast', 'query_update'
  subject     String
  status      NotificationStatus  @default(QUEUED)
  sentAt      DateTime?
  failReason  String?
  referenceId String?             // UUID of the related entity (alertId, queryId, etc.)

  createdAt   DateTime            @default(now())

  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([createdAt])
  @@map("notification_logs")
}
```

---

## 7. Migration Workflow

### Creating and Running Migrations (Remix / Prisma side)

```bash
# After editing prisma/schema.prisma, create a new migration:
npx prisma migrate dev --name <migration_name>
# Example:
npx prisma migrate dev --name add_stock_expiry_index

# Apply migrations in production:
npx prisma migrate deploy

# Reset DB in development (drops all data):
npx prisma migrate reset

# Open Prisma Studio (visual DB browser):
npx prisma studio
```

### Regenerating the Prisma Client

Run this any time `schema.prisma` is changed:

```bash
npx prisma generate
```

This regenerates `node_modules/@prisma/client` with full TypeScript types for all models.

---

## 8. Seeding the Database

Seed file lives at `prisma/seed.ts`. Run with:

```bash
npx prisma db seed
```

Add to `package.json`:
```json
{
  "prisma": {
    "seed": "ts-node --require tsconfig-paths/register prisma/seed.ts"
  }
}
```

Seed data should include:
- 1 LRDB officer account (for testing LRDB module)
- 3–5 MSME shop owner accounts with varied categories and locations
- Sample stock items with sensitivity tags for each shop
- Sample alerts (one per severity level)
- Sample BCP plans with steps in all three phases
- Sample trend data points for Pune region (past 12 months)
- Sample chat groups linking the seed users
- Sample queries in various statuses

---

## 9. Key Database Design Decisions

1. **UUIDs as primary keys everywhere** — Consistent with the application's UUIDv4 identity strategy. No auto-increment integers are used anywhere.
2. **`onDelete: Cascade`** — All child records (stock items, BCP steps, alert recipients, etc.) are automatically deleted when the parent (ShopProfile, Alert, etc.) is deleted.
3. **`@db.Text` for AI-generated content** — Summaries, narratives, BCP descriptions, and risk suggestions can be long. `String` defaults to `VARCHAR(191)` in MySQL which is insufficient.
4. **`sectorBreakdown` as JSON string** — `ReportMetric.sectorBreakdown` stores a JSON string rather than a separate relation table to avoid over-normalisation for what is essentially display data.
5. **Chat messages not stored in MySQL** — Stream owns message persistence. MySQL only stores channel metadata (`ChatGroup`), membership (`ChatGroupMember`), and labels (`ChatLabel`). This avoids duplicating Stream's real-time infrastructure.
6. **`TrendDataPoint` is append-only** — Trend data is never updated, only inserted. Historical data points are immutable once written. This makes the table safe for analytics queries without locking concerns.
7. **`NotificationLog` tracks all channels** — App, email, SMS, and WhatsApp notifications are all logged with their delivery status. This provides a complete audit trail and enables the Settings page to show delivery history.
8. **`QueryStatusHistory` as an audit trail** — Every status change on a Query is recorded with who made it and when. This gives LRDB officers a full timeline of how each query was handled.
9. **`regionCode` as the geographic linking key** — Rather than complex geospatial queries, shops, chat groups, trend data, and LRDB officers are linked by a `regionCode` string (e.g. `pune-mulshi`, `satara-wai`). The Python backend uses this for proximity grouping.
10. **Indexes on all foreign keys and frequent filter fields** — `@@index` is defined on every field used in `WHERE` clauses: `regionCode`, `status`, `priority`, `isRead`, `createdAt`, `expiryDate`.
