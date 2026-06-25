/**
 * scripts/seed-msme.ts
 *
 * Populates all tables required by every MSME page for a given user.
 * Writes directly to the DB — no Python API calls.
 *
 * Usage:
 *   npx tsx scripts/seed-msme.ts <userId>
 *   npx tsx scripts/seed-msme.ts <userId> --reset     # wipe & re-seed
 *   npx tsx scripts/seed-msme.ts <userId> --dry-run   # preview only
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: [] });

const REGION = "pune-haveli";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ago  = (days: number)  => new Date(Date.now() - days * 86_400_000);
const from = (days: number)  => new Date(Date.now() + days * 86_400_000);
function monthStart(monthsAgo: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - monthsAgo);
  return d;
}

// ─── Reset ────────────────────────────────────────────────────────────────────
async function resetMsmeData(userId: string) {
  await db.alertRecipient.deleteMany({ where: { userId } });
  await db.chatGroupMember.deleteMany({ where: { userId } });
  await db.emergencyContact.deleteMany({ where: { userId } });
  // ShopProfile cascade deletes: StockItem, BCPPlan, RiskProfile,
  // ForecastScenario, LocationProfile, AffectedShopReport
  await db.shopProfile.deleteMany({ where: { userId } });
  // Seed-tagged trend data for this region
  await db.trendDataPoint.deleteMany({ where: { regionCode: REGION, source: "seed-msme" } });
  console.log("  ✓ Existing data cleared");
}

// ─── Phase 1: Shop Profile ────────────────────────────────────────────────────
async function seedShopProfile(userId: string) {
  const shop = await db.shopProfile.upsert({
    where: { userId },
    create: {
      userId,
      shopName:       "Sharma General Store",
      category:       "Grocery & Provisions",
      address:        "Shop No. 4, Paud Road, Kothrud, Pune",
      district:       "Pune",
      taluka:         "Haveli",
      pincode:        "411038",
      latitude:       18.5004,
      longitude:      73.8067,
      phoneNumber:    "9876543210",
      regionCode:     REGION,
      establishedYear: 2015,
    },
    update: {},
  });
  console.log(`  ✓ ShopProfile → ${shop.shopName} (${shop.id})`);
  return shop;
}

// ─── Phase 2: Location Profile ────────────────────────────────────────────────
async function seedLocationProfile(shopProfileId: string) {
  const exists = await db.locationProfile.findUnique({ where: { shopProfileId } });
  if (exists) { console.log("  ✓ LocationProfile → already exists, skipping"); return exists; }

  const loc = await db.locationProfile.create({ data: {
    shopProfileId,
    latitude: 18.5004, longitude: 73.8067,
    village: "Kothrud", suburb: "Paud Road",
    taluka: "Haveli", district: "Pune", pincode: "411038",
    elevationMetres: 570.0, terrainSlope: 2.3, slopeAspect: "SE",
    terrainType: "FLAT",
    nearestWaterBodyName: "Mutha River",
    nearestWaterBodyType: "RIVER",
    nearestWaterBodyDistanceMetres: 1800,
    nearestReservoirName: "Khadakwasla Dam",
    nearestReservoirDistanceKm: 14.2,
    nearestHospitalName: "Sahyadri Hospital Kothrud",
    nearestHospitalDistanceKm: 2.1,
    nearestPoliceStationName: "Kothrud Police Station",
    nearestPoliceStationDistanceKm: 0.8,
    nearestFireStationName: "Kothrud Fire Station",
    nearestFireStationDistanceKm: 1.2,
    nearestRoadType: "STATE_HIGHWAY",
    nearestPavedRoadDistanceMetres: 50,
    nearestSubstationName: "Kothrud Substation",
    nearestSubstationDistanceKm: 1.5,
    connectivityType: "FOUR_G",
    powerSupplyType:  "GRID",
    shopFloorLevel:   "GROUND",
    buildingType:     "PUCCA",
    roofType:         "RCC_SLAB",
    hasBasement: false, shopAreaSqFt: 450,
    storageFloorLevel: "GROUND_LEVEL",
    batchStatus: "COMPLETE", lastBatchRunAt: ago(1),
  }});
  console.log("  ✓ LocationProfile created");
  return loc;
}

// ─── Phase 3: Emergency Contacts ─────────────────────────────────────────────
async function seedEmergencyContacts(userId: string) {
  const count = await db.emergencyContact.count({ where: { userId } });
  if (count > 0) { console.log("  ✓ EmergencyContacts → already exist, skipping"); return; }

  await db.emergencyContact.createMany({ data: [
    { userId, name: "Priya Sharma",  phone: "9823456701", relationship: "Spouse",           isPrimary: true  },
    { userId, name: "Ramesh Patil",  phone: "9823456702", relationship: "Business Partner", isPrimary: false },
  ]});
  console.log("  ✓ EmergencyContacts → 2 created");
}

// ─── Phase 4: Stock Items ─────────────────────────────────────────────────────
async function seedStockItems(shopProfileId: string) {
  const count = await db.stockItem.count({ where: { shopProfileId } });
  if (count > 0) { console.log(`  ✓ StockItems → ${count} already exist, skipping`); return await db.stockItem.findMany({ where: { shopProfileId } }); }

  const items = [
    { name: "Basmati Rice (50 kg bags)", category: "Grains",              quantity: 200, unit: "kg",    estimatedValueInr: 16000,  storageLocation: "Back storeroom shelf 1", vulnerabilityScore: 65,  sensitivities: ["WATER","HUMIDITY"] },
    { name: "Wheat Flour",               category: "Grains",              quantity: 150, unit: "kg",    estimatedValueInr: 7500,   storageLocation: "Back storeroom shelf 2", vulnerabilityScore: 58,  sensitivities: ["WATER","HUMIDITY","PERISHABLE"], expiry: from(90) },
    { name: "Refined Cooking Oil (5 L)", category: "Cooking Essentials",  quantity: 60,  unit: "units", estimatedValueInr: 18000,  storageLocation: "Side rack",              vulnerabilityScore: 45,  sensitivities: ["FLAMMABLE","THEFT"] },
    { name: "OTC Medicines & Paracetamol", category: "Healthcare",        quantity: 200, unit: "boxes", estimatedValueInr: 25000,  storageLocation: "Medical cabinet",         vulnerabilityScore: 72,  sensitivities: ["HEAT","PERISHABLE"], expiry: from(180) },
    { name: "Mobile Phone Accessories",  category: "Electronics",         quantity: 30,  unit: "units", estimatedValueInr: 45000,  storageLocation: "Glass display cabinet",  vulnerabilityScore: 82,  sensitivities: ["WATER","FRAGILE","THEFT"] },
    { name: "Cotton Fabric Rolls",       category: "Textiles",            quantity: 25,  unit: "units", estimatedValueInr: 30000,  storageLocation: "Top shelf (elevated)",   vulnerabilityScore: 55,  sensitivities: ["WATER","HEAT"] },
    { name: "Biscuits & Packaged Snacks",category: "Food & Beverages",    quantity: 150, unit: "boxes", estimatedValueInr: 9000,   storageLocation: "Front display shelf",   vulnerabilityScore: 48,  sensitivities: ["PERISHABLE","HUMIDITY"], expiry: from(60) },
    { name: "Kharif Seeds (paddy/soy)",  category: "Agriculture",         quantity: 50,  unit: "bags",  estimatedValueInr: 12500,  storageLocation: "Locked storage room",   vulnerabilityScore: 60,  sensitivities: ["WATER","HUMIDITY"] },
  ] as const;

  const created = [];
  for (const item of items) {
    const { sensitivities, expiry, ...fields } = item as any;
    const si = await db.stockItem.create({ data: { ...fields, shopProfileId, expiryDate: expiry ?? null } });
    await db.stockSensitivity.createMany({ data: sensitivities.map((type: string) => ({ stockItemId: si.id, type: type as any })) });
    created.push(si);
  }
  console.log(`  ✓ StockItems → ${created.length} created with sensitivities`);
  return created;
}

// ─── Phase 5: Risk Profile ────────────────────────────────────────────────────
async function seedRiskProfile(shopProfileId: string) {
  const exists = await db.riskProfile.findUnique({ where: { shopProfileId } });
  if (exists) { console.log("  ✓ RiskProfile → already exists, skipping"); return exists; }

  const rp = await db.riskProfile.create({ data: {
    shopProfileId,
    overallScore: 42, floodScore: 55, powerScore: 32,
    stockScore: 48,   locationScore: 35, accessScore: 40,
    riskLevel: "MODERATE", lastComputedAt: ago(2),
    suggestions: { createMany: { data: [
      { title: "Elevate water-sensitive stock",       description: "Move rice, wheat, and seeds to shelves at least 60 cm above floor level. This single action reduces your flood loss exposure by ~₹1.4L.", impactScore: 12, isActioned: false, orderIndex: 1 },
      { title: "Install a UPS or small generator",    description: "A 1 kVA UPS protects your electronics and point-of-sale system during grid outages. Generator also keeps medicines refrigerated.", impactScore: 8, isActioned: false, orderIndex: 2 },
      { title: "Create a digital stock backup",       description: "Photograph your stock register monthly and upload to Google Drive. This dramatically speeds up insurance claims after a disaster.", impactScore: 6, isActioned: false, orderIndex: 3 },
      { title: "Brief staff on flood evacuation plan",description: "Run a 30-minute walkthrough of your BCP with all employees. A prepared team can move ₹2L of stock to safety in under 2 hours.", impactScore: 5, isActioned: true,  actionedAt: ago(1), orderIndex: 4 },
    ]}},
  }});
  console.log("  ✓ RiskProfile → score 42 (MODERATE) + 4 suggestions");
  return rp;
}

// ─── Phase 6: BCP Plan ────────────────────────────────────────────────────────
async function seedBCPPlan(shopProfileId: string) {
  const exists = await db.bCPPlan.findUnique({ where: { shopProfileId } });
  if (exists) { console.log("  ✓ BCPPlan → already exists, skipping"); return exists; }

  const plan = await db.bCPPlan.create({ data: {
    shopProfileId, completionPercent: 23,
    steps: { createMany: { data: [
      // BEFORE
      { phase: "BEFORE", orderIndex: 1, isCompleted: true,  completedAt: ago(3), title: "Backup stock records digitally",       description: "Photograph all invoices and the stock ledger. Upload to Google Drive or email to yourself." },
      { phase: "BEFORE", orderIndex: 2, isCompleted: true,  completedAt: ago(2), title: "Secure important documents",            description: "Store GST certificate, bank passbook, and insurance papers in a waterproof ziplock bag." },
      { phase: "BEFORE", orderIndex: 3, isCompleted: false,                      title: "Identify elevated storage zones",       description: "Walk the shop and mark shelves or areas above the predicted 60 cm flood level for critical stock." },
      { phase: "BEFORE", orderIndex: 4, isCompleted: false,                      title: "Verify emergency contact availability", description: "Call both emergency contacts to confirm they are reachable and aware of their roles in your plan." },
      { phase: "BEFORE", orderIndex: 5, isCompleted: false, isOptional: true,    title: "Test backup power equipment",           description: "Start the generator or UPS test cycle. Check fuel levels. Ensure it can run for at least 4 hours." },
      // DURING
      { phase: "DURING", orderIndex: 1, isCompleted: true,  completedAt: ago(1), title: "Move water-sensitive stock to elevation", description: "Transfer rice, wheat, seeds, and medicines to the elevated shelves you identified in the BEFORE phase." },
      { phase: "DURING", orderIndex: 2, isCompleted: false,                      title: "Document damage with timestamped photos", description: "Photograph every affected shelf, item, and wall. Enable GPS on your phone before taking photos." },
      { phase: "DURING", orderIndex: 3, isCompleted: false,                      title: "Notify LRDB officer and request support",  description: "Use the DisasterShield app query system to log a Flood Assistance request with your officer." },
      { phase: "DURING", orderIndex: 4, isCompleted: false,                      title: "Monitor entry points every hour",          description: "Mark door and step levels with tape. If water rises 15 cm in one hour, evacuate remaining stock." },
      // AFTER
      { phase: "AFTER",  orderIndex: 1, isCompleted: false, title: "Conduct full stock damage assessment",  description: "Go through every item: intact / damaged / destroyed. Record quantities and estimated loss in INR." },
      { phase: "AFTER",  orderIndex: 2, isCompleted: false, title: "File insurance claim immediately",       description: "Contact your insurer within 48 hours of the event. Attach the timestamped photos collected during the disaster." },
      { phase: "AFTER",  orderIndex: 3, isCompleted: false, title: "Contact key suppliers for emergency restock", description: "Call your top 3 suppliers and explain the situation. Most will prioritise emergency deliveries for established customers." },
      { phase: "AFTER",  orderIndex: 4, isCompleted: false, isOptional: true, title: "Submit recovery status on DisasterShield", description: "Report your recovery status in the app. This helps your LRDB officer plan ongoing support for your area." },
    ]}},
  }});
  console.log("  ✓ BCPPlan → 13 steps (BEFORE:5, DURING:4, AFTER:4), 3 completed");
  return plan;
}

// ─── Phase 7: Forecast Scenarios ─────────────────────────────────────────────
async function seedForecastScenarios(shopProfileId: string, stockItems: { id: string; name: string }[]) {
  const count = await db.forecastScenario.count({ where: { shopProfileId } });
  if (count > 0) { console.log(`  ✓ ForecastScenarios → ${count} already exist, skipping`); return; }

  const byName = (name: string) => stockItems.find(s => s.name.startsWith(name))?.name ?? name;

  const scenarios = [
    {
      disasterType: "3-Day Flood", probability: "high",
      estimatedLossInr: 420000, affectedItemCount: 5,
      estimatedDowntimeDays: 7, recoveryTimelineDays: 21,
      aiNarrative: "Your shop is 1.8 km from the Mutha River on a ground floor with no basement. A 3-day heavy-rain flood event has historically caused water ingress of 30–60 cm in Kothrud. Your water-sensitive stock (rice, wheat, seeds, medicines, electronics) accounts for ₹4.2L of potential loss. Elevating stock before the event and maintaining a UPS for your POS system are the two highest-ROI actions.",
      items: [
        { stockItemName: byName("Basmati Rice"),         estimatedDamageInr: 120000 },
        { stockItemName: byName("Mobile Phone"),          estimatedDamageInr: 135000 },
        { stockItemName: byName("OTC Medicines"),         estimatedDamageInr: 75000  },
        { stockItemName: byName("Wheat Flour"),           estimatedDamageInr: 52500  },
        { stockItemName: byName("Kharif Seeds"),          estimatedDamageInr: 37500  },
      ],
    },
    {
      disasterType: "2-Day Power Outage", probability: "medium",
      estimatedLossInr: 85000, affectedItemCount: 3,
      estimatedDowntimeDays: 2, recoveryTimelineDays: 3,
      aiNarrative: "Power outages in Pune's Haveli region average 14 hours during peak monsoon months. A 48-hour outage affects your perishable medicines (requires refrigeration), packaged snacks (spoilage), and cooking oil (POS downtime impact). A ₹12,000 UPS investment prevents ~₹85,000 of projected loss.",
      items: [
        { stockItemName: byName("OTC Medicines"),          estimatedDamageInr: 50000 },
        { stockItemName: byName("Biscuits"),               estimatedDamageInr: 22500 },
        { stockItemName: byName("Refined Cooking Oil"),    estimatedDamageInr: 12500 },
      ],
    },
    {
      disasterType: "Windstorm", probability: "low",
      estimatedLossInr: 120000, affectedItemCount: 2,
      estimatedDowntimeDays: 3, recoveryTimelineDays: 7,
      aiNarrative: "Windstorms in the Sahyadri belt are less frequent but cause structural and secondary damage. Your RCC slab roof is strong, but flying debris can breach glass display cabinets and scatter light packaged goods. Electronics in open display are the primary risk.",
      items: [
        { stockItemName: byName("Mobile Phone"),           estimatedDamageInr: 90000 },
        { stockItemName: byName("Cotton Fabric Rolls"),    estimatedDamageInr: 30000 },
      ],
    },
  ];

  for (const s of scenarios) {
    const { items, ...fields } = s;
    await db.forecastScenario.create({ data: {
      ...fields, shopProfileId,
      affectedItems: { createMany: { data: items } },
    }});
  }
  console.log("  ✓ ForecastScenarios → 3 created (Flood / Power Outage / Windstorm)");
}

// ─── Phase 8: Trend Data ──────────────────────────────────────────────────────
async function seedTrendData(regionCode: string) {
  const count = await db.trendDataPoint.count({ where: { regionCode, source: "seed-msme" } });
  if (count > 0) { console.log(`  ✓ TrendDataPoints → ${count} already seeded, skipping`); return; }

  // 12 months of realistic Pune monsoon data (index 0 = 11 months ago, 11 = current month)
  const rainfall            = [280, 320, 120, 45, 8,  3,  2,  3,  5,  15,  35, 180];
  const floodIncidents      = [5,   4,   2,   1,  0,  0,  0,  0,  0,  0,   1,  3  ];
  const powerOutageHrs      = [18,  22,  14,  8,  5,  4,  4,  3,  5,  6,   8,  12 ];
  const transportDisruptions= [12,  10,  5,   3,  1,  1,  1,  1,  2,  2,   3,  8  ];
  const customerActivity    = [45,  42,  58,  70, 76, 82, 78, 72, 75, 80,  65, 55 ];

  const points: any[] = [];
  for (let i = 11; i >= 0; i--) {
    const idx = 11 - i;
    const date = monthStart(i);
    points.push(
      { regionCode, trendType: "rainfall",              value: rainfall[idx],             unit: "mm",        recordedAt: date, source: "seed-msme" },
      { regionCode, trendType: "flood_incident",        value: floodIncidents[idx],       unit: "incidents", recordedAt: date, source: "seed-msme" },
      { regionCode, trendType: "power_outage",          value: powerOutageHrs[idx],       unit: "hours",     recordedAt: date, source: "seed-msme" },
      { regionCode, trendType: "transport_disruption",  value: transportDisruptions[idx], unit: "incidents", recordedAt: date, source: "seed-msme" },
      { regionCode, trendType: "customer_activity",     value: customerActivity[idx],     unit: "index",     recordedAt: date, source: "seed-msme" },
    );
  }
  await db.trendDataPoint.createMany({ data: points });
  console.log(`  ✓ TrendDataPoints → 60 points (12 months × 5 types) for region ${regionCode}`);
}

// ─── Phase 9: Alerts ──────────────────────────────────────────────────────────
async function seedAlerts(userId: string) {
  const count = await db.alertRecipient.count({ where: { userId } });
  if (count > 0) { console.log(`  ✓ Alerts → ${count} recipients already exist, skipping`); return; }

  const alertsData = [
    {
      title: "Heavy Rainfall Alert – Pune District",
      severity: "HIGH" as const, category: "FLOOD" as const,
      summary: "IMD has issued a heavy rainfall warning for Pune district. Water levels in the Mutha River basin are expected to rise significantly over the next 48 hours. Ground-floor shops near Kothrud and Paud Road should move water-sensitive stock immediately.",
      affectedRegions: "pune-haveli,pune-mulshi,pune-bhor",
      isActive: true, expiresAt: from(3),
      actions: [
        { label: "Move water-sensitive stock to elevated shelves", actionType: "stock-protection", orderIndex: 1 },
        { label: "Prepare emergency go-bag with key documents",    actionType: "emergency-prep",   orderIndex: 2 },
      ],
      isRead: false,
    },
    {
      title: "Planned Power Shutdown – Kothrud Zone",
      severity: "MEDIUM" as const, category: "POWER_OUTAGE" as const,
      summary: "MSEDCL has scheduled a 6-hour grid maintenance shutdown for the Kothrud feeder this Saturday, 8:00 AM to 2:00 PM. Ensure backup power is ready and perishable stock is protected.",
      affectedRegions: "pune-haveli",
      isActive: true, expiresAt: from(2),
      actions: [
        { label: "Charge all battery backup devices",         actionType: "power-prep",        orderIndex: 1 },
        { label: "Move perishables to insulated containers",  actionType: "stock-protection",  orderIndex: 2 },
      ],
      isRead: true, readAt: ago(1),
    },
  ];

  for (const a of alertsData) {
    const { actions, isRead, readAt, ...alertFields } = a;
    const alert = await db.alert.create({ data: {
      ...alertFields,
      actions: { createMany: { data: actions } },
    }});
    const recipient = await db.alertRecipient.create({ data: {
      alertId: alert.id, userId, isRead, readAt: (readAt as any) ?? null,
    }});
    const actionRecs = await db.alertAction.findMany({ where: { alertId: alert.id } });
    await db.alertActionResult.createMany({ data: actionRecs.map(ac => ({
      alertActionId: ac.id, alertRecipientId: recipient.id, isCompleted: false,
    }))});
  }
  console.log("  ✓ Alerts → 2 seeded (HIGH flood unread, MEDIUM power outage read)");
}

// ─── Phase 10: Chat Group ─────────────────────────────────────────────────────
async function seedChatGroup(userId: string, shopProfileId: string) {
  const channelId = `local-${REGION}-msme`;
  const exists = await db.chatGroup.findUnique({ where: { streamChannelId: channelId } });
  if (exists) {
    // Ensure user is a member
    await db.chatGroupMember.upsert({
      where: { chatGroupId_userId: { chatGroupId: exists.id, userId } },
      create: { chatGroupId: exists.id, userId, isAdmin: false },
      update: {},
    });
    console.log("  ✓ ChatGroup → already exists, ensured membership");
    return;
  }
  const group = await db.chatGroup.create({ data: {
    streamChannelId: channelId,
    name: "Haveli MSME Community",
    regionCode: REGION,
    groupType: "LOCAL_MSME",
    createdByUserId: userId,
  }});
  await db.chatGroupMember.create({ data: { chatGroupId: group.id, userId, isAdmin: true } });
  await db.chatLabel.createMany({ data: [
    { chatGroupId: group.id, label: "Emergency" },
    { chatGroupId: group.id, label: "Flood Alert" },
  ]});
  console.log("  ✓ ChatGroup → 'Haveli MSME Community' created");
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2);
  const userId  = args.find(a => !a.startsWith("--"));
  const reset   = args.includes("--reset");
  const dryRun  = args.includes("--dry-run");

  if (!userId) {
    console.error("Usage: npx tsx scripts/seed-msme.ts <userId> [--reset] [--dry-run]");
    process.exit(1);
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) { console.error(`User ${userId} not found`); process.exit(1); }
  if (user.role !== "MSME") { console.error(`User ${userId} has role ${user.role}, expected MSME`); process.exit(1); }

  console.log(`\n▶ Seeding MSME data for: ${user.name} (${user.email})`);
  if (dryRun) { console.log("  [dry-run] No changes will be made.\n"); process.exit(0); }
  if (reset)  { console.log("  Resetting existing data…"); await resetMsmeData(userId); }
  console.log();

  console.log("Phase 1 — Shop Profile & Location");
  const shop = await seedShopProfile(userId);
  await seedLocationProfile(shop.id);

  console.log("\nPhase 2 — Emergency Contacts");
  await seedEmergencyContacts(userId);

  console.log("\nPhase 3 — Stock Inventory");
  const stockItems = await seedStockItems(shop.id);

  console.log("\nPhase 4 — Risk Profile & Suggestions");
  await seedRiskProfile(shop.id);

  console.log("\nPhase 5 — Business Continuity Plan");
  await seedBCPPlan(shop.id);

  console.log("\nPhase 6 — Forecast Scenarios");
  await seedForecastScenarios(shop.id, stockItems);

  console.log("\nPhase 7 — Trend Data (12 months)");
  await seedTrendData(REGION);

  console.log("\nPhase 8 — Alerts");
  await seedAlerts(userId);

  console.log("\nPhase 9 — Community Chat Group");
  await seedChatGroup(userId, shop.id);

  console.log(`\n✅ MSME seed complete for ${user.name}\n`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
