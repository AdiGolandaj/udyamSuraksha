# Mock Data Seeding Guide

This document explains how to populate the DisasterShield database with realistic mock data for both user roles so every page renders with meaningful content for demos and development testing.

---

## Overview

Two seeder scripts exist, one per role:

| Script | Command | Target Role |
|--------|---------|-------------|
| `scripts/seed-msme.ts` | `npm run db:seed-msme -- <uuid>` | MSME shop owner |
| `scripts/seed-lrdb.ts` | `npm run db:seed-lrdb -- <uuid>` | LRDB officer |

Both scripts write directly to the MySQL database via Prisma. No Python API or LLM calls are made — all data is hardcoded to realistic values for the Pune / Haveli region.

---

## Prerequisites

1. The application stack must be running (`bash run.sh`)
2. The target user must already exist in the `users` table — created automatically on first Google sign-in
3. The user's role must match the script being run (`MSME` or `LRDB`)

---

## Logging In as a Seed User (Dev Login)

Seed users with `@disastershield.test` emails have no Google account — they cannot sign in via Google OAuth. Use the **Dev Login** page instead:

1. Go to `http://localhost:5173/dev-login` (or click **Dev Login — bypass OAuth** at the bottom of the regular `/login` page)
2. All users in the database are listed, grouped by role. Seed users show a `seed` badge.
3. Click any user card to be logged in instantly — no Google account needed.
4. To switch users: log out first, then return to `/dev-login` and click a different user.

> Dev Login is blocked in production (`NODE_ENV=production` returns 404).

---

## Step 1 — Sign In and Get the User UUID

1. Open the app in a browser and sign in with Google using the account you want to seed
2. Complete the registration flow if prompted (role selection + shop/officer details)
3. Open a terminal and run:

```bash
npm run db:list-users
```

This prints a table of all registered users with their UUIDs, names, emails, and roles. Copy the UUID of the user you want to seed.

**Example output:**
```
┌──────────────────────────────────────┬──────────────────────┬───────────────────────────────┬──────┐
│ UUID                                 │ Name                 │ Email                         │ Role │
├──────────────────────────────────────┼──────────────────────┼───────────────────────────────┼──────┤
│ 3f2a1b4c-...                         │ Adi Sharma           │ adi@gmail.com                 │ MSME │
│ 7e9d2c1a-...                         │ Priya Officer        │ priya@gmail.com               │ LRDB │
└──────────────────────────────────────┴──────────────────────┴───────────────────────────────┴──────┘
```

---

## Step 2A — Seed an MSME User

Run the MSME seeder with the user's UUID:

```bash
npm run db:seed-msme -- <uuid>
```

**Example:**
```bash
npm run db:seed-msme -- 3f2a1b4c-8e5d-4f2a-b1c9-0d7e6f3a2b1c
```

### What gets created

| Page | Data Seeded |
|------|-------------|
| **Dashboard** | Shop profile (Sharma General Store, Kothrud, Pune), risk score 42 (MODERATE), 2 active alerts |
| **Stock** | 8 stock items across 6 categories with disaster sensitivities — rice, flour, oil, medicines, electronics, fabric, snacks, seeds |
| **Risk** | Risk profile with breakdown scores (flood 55, power 32, stock 48, location 35, access 40) + 4 improvement suggestions |
| **BCP** | 13-step plan across BEFORE / DURING / AFTER phases, 3 steps pre-marked as completed |
| **Forecasts** | 3 disaster scenarios: 3-Day Flood (₹4.2L loss), 2-Day Power Outage (₹85K), Windstorm (₹1.2L) |
| **Alerts** | 2 alerts: HIGH flood warning (unread) + MEDIUM power outage (read) |
| **Trends** | 12 months of Pune monsoon data — rainfall, flood incidents, power outages, transport disruptions, customer activity |
| **Community** | "Haveli MSME Community" chat group with membership |

### Emergency contacts also seeded
- Priya Sharma (Spouse) — primary contact
- Ramesh Patil (Business Partner)

### Location profile seeded
- Coordinates: 18.5004°N, 73.8067°E (Kothrud, Pune)
- 1.8 km from Mutha River
- Nearest hospital: Sahyadri Hospital (2.1 km)
- Connectivity: 4G, Grid power, Pucca building, RCC slab roof

---

## Step 2B — Seed an LRDB User

Run the LRDB seeder with the officer's UUID:

```bash
npm run db:seed-lrdb -- <uuid>
```

**Example:**
```bash
npm run db:seed-lrdb -- 7e9d2c1a-3b4f-4c2d-a8e1-9f0b5c6d7e8f
```

### What gets created

| Page | Data Seeded |
|------|-------------|
| **Shops** | 4 seed MSME shops registered in the officer's region (Haveli, Pune) |
| **Queries** | 5 support queries — one in each status: PENDING, UNDER_REVIEW, ASSIGNED, RESOLVED, ESCALATED |
| **Alerts** | 3 alerts issued by the officer: CRITICAL flood, HIGH wind, MEDIUM power outage |
| **Reports** | 1 PUBLISHED flood impact report + 1 DRAFT infrastructure survey |
| **Estimation** | Populated automatically from the 4 seed shop profiles and their stock/risk data |
| **Trends** | 12 months of regional data (shared with MSME if already seeded) |
| **Community** | "Pune Haveli Emergency Response" (LRDB coordination) + "Haveli MSME Community" (local group) |

### Seed shops created

These are synthetic MSME users created solely for the LRDB officer to interact with. They are identified by their `@disastershield.test` email suffix.

| Shop Name | Category | Risk Level | Email (DB identifier) |
|-----------|----------|------------|----------------------|
| Patil Electronics & Appliances | Electronics | HIGH (68) | `seed-patil-electronics@disastershield.test` |
| Deshpande Medical Store | Pharmacy | SAFE (35) | `seed-deshpande-medical@disastershield.test` |
| Kisan Agro Centre | Agriculture | MODERATE (52) | `seed-kisan-agro@disastershield.test` |
| Mehta Textiles | Textiles | HIGH (78) | `seed-mehta-textiles@disastershield.test` |

### Query statuses seeded (one each)

| Status | Shop | Query Type | Priority |
|--------|------|------------|----------|
| PENDING | Patil Electronics | Flood Assistance | HIGH |
| UNDER_REVIEW | Deshpande Medical | Power Outage | MEDIUM |
| ASSIGNED | Kisan Agro | Transport | HIGH |
| RESOLVED | Mehta Textiles | Infrastructure | LOW |
| ESCALATED | Patil Electronics | Stock Protection | CRITICAL |

---

## Step 3 — Reload the App

After seeding, hard-refresh the browser (`Ctrl+Shift+R`) or navigate away and back. The data is already in the database — no server restart needed.

---

## Re-seeding (Wipe and Reset)

If you want to clear all seeded data and start fresh, pass the `--reset` flag:

```bash
npm run db:seed-msme -- <uuid> --reset
npm run db:seed-lrdb -- <uuid> --reset
```

**What `--reset` deletes before re-seeding:**

- **MSME:** Alert recipients, chat memberships, emergency contacts, shop profile (cascades stock, BCP, risk profile, forecasts, location profile), and seeded trend data
- **LRDB:** All 4 seed shop users and their data, officer-issued alerts, disaster reports, chat groups created by the officer, and seeded trend data

The `User` row itself is never deleted by either script.

---

## Preview Without Writing (Dry Run)

To see what would be created without touching the database:

```bash
npm run db:seed-msme -- <uuid> --dry-run
npm run db:seed-lrdb -- <uuid> --dry-run
```

---

## Seeding Both Roles (Full Demo Setup)

To have a complete demo with both roles working:

```bash
# 1. Sign in with Google Account A → completes MSME registration
# 2. Sign in with Google Account B → completes LRDB registration
# 3. List users to get both UUIDs
npm run db:list-users

# 4. Seed the MSME user
npm run db:seed-msme -- <msme-uuid>

# 5. Seed the LRDB user
npm run db:seed-lrdb -- <lrdb-uuid>
```

> **Note:** Both scripts use the same `regionCode: "pune-haveli"`. The LRDB officer's seed shops appear in the MSME user's community group, and the LRDB officer can see the MSME user's shop in their shops list — provided the MSME user's `ShopProfile.regionCode` is also `pune-haveli` (which the MSME seeder sets automatically).

---

## Deleting a User Entirely

To delete a user and all their data from the database:

```bash
npm run db:delete-user -- <uuid>
```

This is separate from `--reset`. It removes the `User` row itself, permanently deleting all associated data via cascade.

---

## File Reference

```
scripts/
├── seed-msme.ts       ← MSME seeder (this guide, Step 2A)
├── seed-lrdb.ts       ← LRDB seeder (this guide, Step 2B)
├── list-users.ts      ← Print all users with UUIDs
└── delete-user.ts     ← Permanently delete a user by UUID
```
