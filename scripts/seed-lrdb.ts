/**
 * scripts/seed-lrdb.ts
 *
 * Populates all tables required by every LRDB page for a given officer user.
 * Creates 4 seed MSME shops in the officer's region so the shops list,
 * queries, estimation, and reports pages all have real data to display.
 *
 * Usage:
 *   npx tsx scripts/seed-lrdb.ts <userId>
 *   npx tsx scripts/seed-lrdb.ts <userId> --reset     # wipe & re-seed
 *   npx tsx scripts/seed-lrdb.ts <userId> --dry-run   # preview only
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: [] });

const REGION = "pune-haveli";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ago  = (days: number) => new Date(Date.now() - days * 86_400_000);
const from = (days: number) => new Date(Date.now() + days * 86_400_000);

// Seed-shop emails are prefixed so they're identifiable and cleanable
const SEED_EMAILS = [
  "seed-patil-electronics@disastershield.test",
  "seed-deshpande-medical@disastershield.test",
  "seed-kisan-agro@disastershield.test",
  "seed-mehta-textiles@disastershield.test",
];

// ─── Reset ────────────────────────────────────────────────────────────────────
async function resetLrdbData(officerUserId: string) {
  // 1. Remove officer from chat groups & delete groups they created
  await db.chatGroupMember.deleteMany({ where: { userId: officerUserId } });

  const officerGroups = await db.chatGroup.findMany({ where: { createdByUserId: officerUserId } });
  if (officerGroups.length) {
    await db.chatGroup.deleteMany({ where: { createdByUserId: officerUserId } });
  }

  // 2. Deactivate / delete alerts created by officer
  const officerAlerts = await db.alert.findMany({ where: { issuedByUserId: officerUserId }, select: { id: true } });
  if (officerAlerts.length) {
    await db.alert.deleteMany({ where: { issuedByUserId: officerUserId } });
  }

  // 3. Delete disaster reports created by officer
  await db.disasterReport.deleteMany({ where: { createdByUserId: officerUserId } });

  // 4. Delete seed MSME shop users (cascades most related data)
  for (const email of SEED_EMAILS) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) continue;
    const shop = await db.shopProfile.findUnique({ where: { userId: user.id } });
    if (shop) {
      // Manual cleanup for non-cascading FK relations on Query
      const queries = await db.query.findMany({ where: { shopProfileId: shop.id }, select: { id: true } });
      if (queries.length) {
        await db.queryStatusHistory.deleteMany({ where: { queryId: { in: queries.map(q => q.id) } } });
        await db.query.deleteMany({ where: { shopProfileId: shop.id } });
      }
      await db.affectedShopReport.deleteMany({ where: { shopProfileId: shop.id } });
    }
    await db.user.delete({ where: { email } });
  }

  // 5. Seed-tagged trend data
  await db.trendDataPoint.deleteMany({ where: { regionCode: REGION, source: "seed-lrdb" } });

  // 6. Delete LRDBOfficer record (keep User row)
  await db.lRDBOfficer.deleteMany({ where: { userId: officerUserId } });

  console.log("  ✓ Existing data cleared");
}

// ─── Phase 1: LRDB Officer Profile ───────────────────────────────────────────
async function seedOfficerProfile(userId: string) {
  const officer = await db.lRDBOfficer.upsert({
    where: { userId },
    create: {
      userId,
      district:    "Pune",
      taluka:      "Haveli",
      designation: "District Disaster Management Officer",
      regionCode:  REGION,
    },
    update: {},
  });
  console.log(`  ✓ LRDBOfficer → ${officer.designation} (region: ${officer.regionCode})`);
  return officer;
}

// ─── Phase 2: Seed MSME Shops ─────────────────────────────────────────────────
interface SeedShop {
  user: { id: string; name: string };
  shop: { id: string; shopName: string };
}

async function seedMsmeShops(): Promise<SeedShop[]> {
  const seedShopsSpec = [
    {
      email: SEED_EMAILS[0], name: "Suresh Patil",
      shop:  { shopName: "Patil Electronics & Appliances", category: "Electronics & Appliances", address: "12, FC Road, Shivajinagar, Pune", pincode: "411005", latitude: 18.5194, longitude: 73.8432 },
      risk:  { overallScore: 68, floodScore: 72, powerScore: 65, stockScore: 70, locationScore: 60, accessScore: 55, riskLevel: "HIGH" as const },
      stock: [
        { name: "LED Televisions (32-inch)",  category: "Electronics", quantity: 15, unit: "units", estimatedValueInr: 225000, vulnerabilityScore: 85, sensitivities: ["WATER","FRAGILE","THEFT"] },
        { name: "Electric Fans & Coolers",    category: "Electronics", quantity: 30, unit: "units", estimatedValueInr: 90000,  vulnerabilityScore: 60, sensitivities: ["WATER","FRAGILE"] },
        { name: "Smartphone Accessories",     category: "Electronics", quantity: 80, unit: "units", estimatedValueInr: 56000,  vulnerabilityScore: 78, sensitivities: ["WATER","THEFT"] },
      ],
    },
    {
      email: SEED_EMAILS[1], name: "Anita Deshpande",
      shop:  { shopName: "Deshpande Medical Store", category: "Pharmacy & Healthcare", address: "3, Baner Road, Baner, Pune", pincode: "411045", latitude: 18.5590, longitude: 73.7868 },
      risk:  { overallScore: 35, floodScore: 28, powerScore: 42, stockScore: 38, locationScore: 30, accessScore: 40, riskLevel: "SAFE" as const },
      stock: [
        { name: "Prescription Medicines",     category: "Healthcare", quantity: 500, unit: "boxes", estimatedValueInr: 180000, vulnerabilityScore: 70, sensitivities: ["HEAT","PERISHABLE"] },
        { name: "Surgical Supplies",          category: "Healthcare", quantity: 200, unit: "units", estimatedValueInr: 45000,  vulnerabilityScore: 40, sensitivities: ["FRAGILE"] },
        { name: "First Aid Kits",             category: "Healthcare", quantity: 60,  unit: "units", estimatedValueInr: 18000,  vulnerabilityScore: 30, sensitivities: ["PERISHABLE"] },
      ],
    },
    {
      email: SEED_EMAILS[2], name: "Vijay Kisan",
      shop:  { shopName: "Kisan Agro Centre", category: "Agriculture & Seeds", address: "45, Nagar Road, Wagholi, Pune", pincode: "412207", latitude: 18.5507, longitude: 73.9748 },
      risk:  { overallScore: 52, floodScore: 58, powerScore: 35, stockScore: 55, locationScore: 50, accessScore: 62, riskLevel: "MODERATE" as const },
      stock: [
        { name: "Paddy & Soybean Seeds",      category: "Agriculture", quantity: 100, unit: "bags",  estimatedValueInr: 85000,  vulnerabilityScore: 62, sensitivities: ["WATER","HUMIDITY"] },
        { name: "Chemical Fertilisers",       category: "Agriculture", quantity: 50,  unit: "bags",  estimatedValueInr: 32000,  vulnerabilityScore: 55, sensitivities: ["WATER","FLAMMABLE"] },
        { name: "Pesticide Concentrates",     category: "Agriculture", quantity: 40,  unit: "units", estimatedValueInr: 48000,  vulnerabilityScore: 68, sensitivities: ["HEAT","FLAMMABLE","THEFT"] },
      ],
    },
    {
      email: SEED_EMAILS[3], name: "Rahul Mehta",
      shop:  { shopName: "Mehta Textiles", category: "Textiles & Garments", address: "7, Laxmi Road, Sadashiv Peth, Pune", pincode: "411030", latitude: 18.5147, longitude: 73.8526 },
      risk:  { overallScore: 78, floodScore: 80, powerScore: 60, stockScore: 82, locationScore: 75, accessScore: 70, riskLevel: "HIGH" as const },
      stock: [
        { name: "Cotton Fabric Bales",        category: "Textiles", quantity: 40,  unit: "units", estimatedValueInr: 160000, vulnerabilityScore: 80, sensitivities: ["WATER","HEAT"] },
        { name: "Polyester Rolls",            category: "Textiles", quantity: 30,  unit: "units", estimatedValueInr: 75000,  vulnerabilityScore: 72, sensitivities: ["FLAMMABLE","HEAT"] },
        { name: "Readymade Garments",         category: "Textiles", quantity: 200, unit: "units", estimatedValueInr: 120000, vulnerabilityScore: 76, sensitivities: ["WATER","HUMIDITY","THEFT"] },
      ],
    },
  ];

  const result: SeedShop[] = [];

  for (const spec of seedShopsSpec) {
    const existing = await db.user.findUnique({ where: { email: spec.email } });
    if (existing) {
      const shop = await db.shopProfile.findUnique({ where: { userId: existing.id } });
      if (shop) {
        console.log(`  ✓ ${spec.shop.shopName} → already exists, skipping`);
        result.push({ user: { id: existing.id, name: existing.name }, shop: { id: shop.id, shopName: shop.shopName } });
        continue;
      }
    }

    const user = await db.user.upsert({
      where: { email: spec.email },
      create: { email: spec.email, name: spec.name, role: "MSME", language: "en" },
      update: {},
    });

    const shop = await db.shopProfile.create({ data: {
      userId: user.id,
      ...spec.shop,
      district: "Pune", taluka: "Haveli",
      regionCode: REGION,
      phoneNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
    }});

    await db.locationProfile.create({ data: {
      shopProfileId: shop.id,
      latitude: spec.shop.latitude, longitude: spec.shop.longitude,
      taluka: "Haveli", district: "Pune", pincode: spec.shop.pincode,
      connectivityType: "FOUR_G", powerSupplyType: "GRID",
      shopFloorLevel: "GROUND", buildingType: "PUCCA", roofType: "RCC_SLAB",
      hasBasement: false, storageFloorLevel: "GROUND_LEVEL",
      batchStatus: "COMPLETE",
    }});

    await db.riskProfile.create({ data: {
      shopProfileId: shop.id, ...spec.risk, lastComputedAt: ago(1),
    }});

    for (const item of spec.stock) {
      const { sensitivities, ...fields } = item;
      const si = await db.stockItem.create({ data: { ...fields, shopProfileId: shop.id } });
      await db.stockSensitivity.createMany({ data: sensitivities.map(type => ({ stockItemId: si.id, type: type as any })) });
    }

    console.log(`  ✓ ${shop.shopName} → created (risk: ${spec.risk.riskLevel}, ${spec.stock.length} stock items)`);
    result.push({ user: { id: user.id, name: user.name }, shop: { id: shop.id, shopName: shop.shopName } });
  }

  return result;
}

// ─── Phase 3: Queries ─────────────────────────────────────────────────────────
async function seedQueries(officerUserId: string, shops: SeedShop[]) {
  const [patil, deshpande, kisan, mehta] = shops;

  const count = await db.query.count({ where: { shopProfile: { regionCode: REGION } } });
  if (count >= 5) { console.log(`  ✓ Queries → ${count} already exist, skipping`); return; }

  const queriesSpec = [
    {
      shopProfileId: patil.shop.id, submittedByUserId: patil.user.id,
      queryType: "Flood Assistance",
      description: "Water entered our ground floor last night during heavy rain. Rice and electronic stock (₹3.5L) is submerged or at immediate risk. Need urgent site assessment and relief support.",
      priority: "HIGH" as const, status: "PENDING" as const,
      history: [{ from: null, to: "PENDING" as const, by: patil.user.id, note: "Query submitted via DisasterShield app" }],
    },
    {
      shopProfileId: deshpande.shop.id, submittedByUserId: deshpande.user.id,
      queryType: "Power Outage",
      description: "Refrigeration unit for temperature-sensitive medicines has been non-functional for 18 hours. Approximately ₹80,000 of stock is at risk of spoilage. Need generator support or priority power restoration.",
      priority: "MEDIUM" as const, status: "UNDER_REVIEW" as const,
      history: [
        { from: null,        to: "PENDING" as const,      by: deshpande.user.id, note: null },
        { from: "PENDING" as const, to: "UNDER_REVIEW" as const, by: officerUserId, note: "Escalated to MSEDCL duty officer. Awaiting ETA." },
      ],
    },
    {
      shopProfileId: kisan.shop.id, submittedByUserId: kisan.user.id,
      assignedToUserId: officerUserId,
      queryType: "Transport",
      description: "Paud Road is flooded and completely blocked. Cannot receive stock deliveries or serve walk-in customers. Request official road clearance priority for this high-density commercial area.",
      priority: "HIGH" as const, status: "ASSIGNED" as const,
      history: [
        { from: null,              to: "PENDING" as const,      by: kisan.user.id,    note: null },
        { from: "PENDING" as const, to: "UNDER_REVIEW" as const, by: officerUserId,   note: "Inspected flood status. Coordinating with PWD." },
        { from: "UNDER_REVIEW" as const, to: "ASSIGNED" as const, by: officerUserId,  note: "Assigned to myself. PWD team dispatched." },
      ],
    },
    {
      shopProfileId: mehta.shop.id, submittedByUserId: mehta.user.id,
      queryType: "Infrastructure",
      description: "Side wall of our shop has developed hairline cracks after heavy rain. Concerned about structural safety. Requesting an engineer assessment before we reopen.",
      priority: "LOW" as const, status: "RESOLVED" as const,
      resolvedAt: ago(3),
      resolutionNotes: "Civil engineer site visit completed on 2026-06-22. Minor surface cracks, no structural compromise. Shop cleared for safe reopening. Advised periodic re-inspection in 6 months.",
      history: [
        { from: null,        to: "PENDING" as const,       by: mehta.user.id,    note: null },
        { from: "PENDING" as const,  to: "UNDER_REVIEW" as const, by: officerUserId, note: "Coordinating structural engineer visit." },
        { from: "UNDER_REVIEW" as const, to: "RESOLVED" as const,    by: officerUserId, note: "Engineer visit done, no structural risk." },
      ],
    },
    {
      shopProfileId: patil.shop.id, submittedByUserId: patil.user.id,
      queryType: "Stock Protection",
      description: "URGENT — Flood water rising fast. Entire electronics inventory at risk. Need emergency transport or temporary elevated warehouse space to shift ₹3.5L worth of goods in the next 2 hours.",
      priority: "CRITICAL" as const, status: "ESCALATED" as const,
      history: [
        { from: null,        to: "PENDING" as const,      by: patil.user.id,    note: null },
        { from: "PENDING" as const,  to: "ASSIGNED" as const, by: officerUserId, note: "Arranging transport with district HQ." },
        { from: "ASSIGNED" as const, to: "ESCALATED" as const, by: officerUserId, note: "Escalated to State Disaster Response Force — situation worsening." },
      ],
    },
  ];

  for (const spec of queriesSpec) {
    const { history, ...fields } = spec;
    const q = await db.query.create({ data: { ...fields, createdAt: ago(Math.floor(Math.random() * 5) + 1) } });
    await db.queryStatusHistory.createMany({ data: history.map((h, i) => ({
      queryId: q.id,
      fromStatus: h.from ?? null,
      toStatus: h.to,
      changedBy: h.by,
      notes: h.note ?? null,
      changedAt: ago(history.length - i),
    }))});
  }
  console.log("  ✓ Queries → 5 created (PENDING / UNDER_REVIEW / ASSIGNED / RESOLVED / ESCALATED)");
}

// ─── Phase 4: Alerts ──────────────────────────────────────────────────────────
async function seedAlerts(officerUserId: string, shops: SeedShop[]) {
  const exists = await db.alert.count({ where: { issuedByUserId: officerUserId } });
  if (exists > 0) { console.log(`  ✓ Alerts → ${exists} already created by officer, skipping`); return; }

  const allShopUserIds = shops.map(s => s.user.id);

  const alertsSpec = [
    {
      title: "CRITICAL: Mutha River Overflow – Immediate Action Required",
      severity: "CRITICAL" as const, category: "FLOOD" as const,
      summary: "Khadakwasla Dam is discharging at 45,000 cusecs due to excess catchment inflows. Mutha River water level at Pune city is expected to breach the 560 m danger mark within 6 hours. All ground-floor shops within 2 km of the river must evacuate stock immediately.",
      affectedRegions: "pune-haveli,pune-mulshi,pune-bhor",
      isActive: true, expiresAt: from(2), issuedByUserId: officerUserId,
      actions: [
        { label: "Evacuate all stock from ground-floor storage",          actionType: "evacuation",         orderIndex: 1 },
        { label: "Move critical documents to upper floors or vehicles",   actionType: "emergency-prep",     orderIndex: 2 },
        { label: "Contact LRDB emergency helpline: 1070",                actionType: "contact-authorities", orderIndex: 3 },
      ],
      recipients: allShopUserIds, allRead: false,
    },
    {
      title: "High Wind Advisory – Sahyadri Hills Corridor",
      severity: "HIGH" as const, category: "WIND" as const,
      summary: "Wind speeds of 60–80 kmph are expected across the Sahyadri corridor affecting Haveli and Mulshi talukas tonight. Shops with tin or asbestos roofing should take precautions. Flying debris may damage glass storefronts.",
      affectedRegions: "pune-haveli",
      isActive: true, expiresAt: from(1), issuedByUserId: officerUserId,
      actions: [
        { label: "Secure signboards, awnings, and loose roof sheets", actionType: "structural-prep",   orderIndex: 1 },
        { label: "Move goods away from glass fronts and windows",     actionType: "stock-protection",  orderIndex: 2 },
      ],
      recipients: allShopUserIds, allRead: false,
    },
    {
      title: "Grid Maintenance Outage – Pune North Distribution Zone",
      severity: "MEDIUM" as const, category: "POWER_OUTAGE" as const,
      summary: "Scheduled 8-hour grid maintenance by MSEDCL on 2026-06-20 (08:00–16:00) affecting Haveli and parts of Shivajinagar. Backup power recommended for healthcare, cold-chain, and high-value electronics businesses.",
      affectedRegions: "pune-haveli",
      isActive: false, expiresAt: ago(5), issuedByUserId: officerUserId,
      actions: [
        { label: "Activate backup generator or UPS before 08:00",  actionType: "power-prep", orderIndex: 1 },
      ],
      recipients: allShopUserIds, allRead: true,
    },
  ];

  for (const a of alertsSpec) {
    const { actions, recipients, allRead, ...alertFields } = a;
    const alert = await db.alert.create({ data: {
      ...alertFields,
      actions: { createMany: { data: actions } },
    }});

    const actionRecs = await db.alertAction.findMany({ where: { alertId: alert.id } });

    for (const userId of recipients) {
      const r = await db.alertRecipient.create({ data: {
        alertId: alert.id, userId, isRead: allRead, readAt: allRead ? ago(5) : null,
      }});
      await db.alertActionResult.createMany({ data: actionRecs.map(ac => ({
        alertActionId: ac.id, alertRecipientId: r.id, isCompleted: false,
      }))});
    }
  }
  console.log("  ✓ Alerts → 3 created (CRITICAL flood, HIGH wind, MEDIUM power — all issued by officer)");
}

// ─── Phase 5: Disaster Reports ────────────────────────────────────────────────
async function seedDisasterReports(officerUserId: string, shops: SeedShop[]) {
  const count = await db.disasterReport.count({ where: { createdByUserId: officerUserId } });
  if (count > 0) { console.log(`  ✓ DisasterReports → ${count} already exist, skipping`); return; }

  const [patil, , kisan] = shops;

  // Report 1: PUBLISHED
  const report1 = await db.disasterReport.create({ data: {
    title: "Monsoon Flood Impact Assessment – Haveli Taluka, June 2026",
    disasterType: "Flood", affectedZone: "Haveli Taluka, Pune",
    affectedRegionCode: REGION,
    reportDate: ago(15), status: "PUBLISHED",
    createdByUserId: officerUserId, publishedByUserId: officerUserId, publishedAt: ago(10),
    summary: "A moderate flood event on 2026-06-10 affected 34 registered MSME businesses in Haveli taluka. The Mutha River rose 45 cm above the warning level for 18 hours. Ground-floor establishments within 500 m of the river embankment sustained the most significant stock damage. Recovery operations were coordinated with Pune District Collector's office and SDRF.",
    reportMetrics: { createMany: { data: [
      { metricKey: "total_shops_affected",  metricValue: 34,       metricLabel: "Shops Affected" },
      { metricKey: "estimated_loss_inr",    metricValue: 8500000,  metricLabel: "Total Estimated Loss (₹)" },
      { metricKey: "recovery_rate",         metricValue: 62,       metricLabel: "Recovery Rate (%)" },
      { metricKey: "avg_recovery_days",     metricValue: 12,       metricLabel: "Avg Recovery Days" },
    ]}},
    affectedShops: { createMany: { data: [
      { shopProfileId: patil.shop.id, estimatedLoss: 350000, primaryDamageType: "Stock — Electronics", recoveryStatus: "PARTIAL"    },
      { shopProfileId: kisan.shop.id, estimatedLoss: 125000, primaryDamageType: "Stock — Seeds & Fertilizer", recoveryStatus: "RECOVERED" },
    ]}},
  }});

  // Report 2: DRAFT
  await db.disasterReport.create({ data: {
    title: "Post-Monsoon Infrastructure Damage Survey – Haveli Taluka",
    disasterType: "Flood", affectedZone: "Haveli Taluka, Pune",
    affectedRegionCode: REGION,
    reportDate: ago(5), status: "DRAFT",
    createdByUserId: officerUserId,
    summary: "Preliminary survey of infrastructure damage caused by continued monsoon activity in June 2026. 8 commercial properties reported structural concerns. Civil engineering assessments ongoing.",
    reportMetrics: { createMany: { data: [
      { metricKey: "total_shops_affected", metricValue: 8, metricLabel: "Shops Affected" },
      { metricKey: "structural_reports",   metricValue: 8, metricLabel: "Structural Reports Filed" },
    ]}},
  }});

  console.log("  ✓ DisasterReports → 2 created (PUBLISHED flood report + DRAFT infrastructure survey)");
}

// ─── Phase 6: Trend Data ──────────────────────────────────────────────────────
async function seedTrendData() {
  const count = await db.trendDataPoint.count({ where: { regionCode: REGION, source: "seed-lrdb" } });
  if (count > 0) { console.log(`  ✓ TrendDataPoints → ${count} already seeded, skipping`); return; }

  // Check if seed-msme already seeded this region's trend data
  const msmeCount = await db.trendDataPoint.count({ where: { regionCode: REGION, source: "seed-msme" } });
  if (msmeCount > 0) { console.log(`  ✓ TrendDataPoints → ${msmeCount} already seeded by seed-msme, skipping`); return; }

  function monthStart(monthsAgo: number): Date {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - monthsAgo);
    return d;
  }

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
      { regionCode: REGION, trendType: "rainfall",             value: rainfall[idx],             unit: "mm",        recordedAt: date, source: "seed-lrdb" },
      { regionCode: REGION, trendType: "flood_incident",       value: floodIncidents[idx],       unit: "incidents", recordedAt: date, source: "seed-lrdb" },
      { regionCode: REGION, trendType: "power_outage",         value: powerOutageHrs[idx],       unit: "hours",     recordedAt: date, source: "seed-lrdb" },
      { regionCode: REGION, trendType: "transport_disruption", value: transportDisruptions[idx], unit: "incidents", recordedAt: date, source: "seed-lrdb" },
      { regionCode: REGION, trendType: "customer_activity",    value: customerActivity[idx],     unit: "index",     recordedAt: date, source: "seed-lrdb" },
    );
  }
  await db.trendDataPoint.createMany({ data: points });
  console.log(`  ✓ TrendDataPoints → 60 points (12 months × 5 types) for region ${REGION}`);
}

// ─── Phase 7: Chat Groups ─────────────────────────────────────────────────────
async function seedChatGroups(officerUserId: string, shops: SeedShop[]) {
  const coordChannelId = `lrdb-${REGION}-coord`;
  const localChannelId = `local-${REGION}-msme`;

  // LRDB coordination group
  const coordExists = await db.chatGroup.findUnique({ where: { streamChannelId: coordChannelId } });
  if (!coordExists) {
    const cg = await db.chatGroup.create({ data: {
      streamChannelId: coordChannelId,
      name:            "Pune Haveli Emergency Response",
      regionCode:      REGION,
      groupType:       "LRDB_COORDINATION",
      createdByUserId: officerUserId,
    }});
    await db.chatGroupMember.create({ data: { chatGroupId: cg.id, userId: officerUserId, isAdmin: true } });
    await db.chatLabel.createMany({ data: [
      { chatGroupId: cg.id, label: "LRDB Operations" },
      { chatGroupId: cg.id, label: "Flood Response"  },
    ]});
    console.log("  ✓ ChatGroup → 'Pune Haveli Emergency Response' (LRDB_COORDINATION) created");
  } else {
    await db.chatGroupMember.upsert({
      where: { chatGroupId_userId: { chatGroupId: coordExists.id, userId: officerUserId } },
      create: { chatGroupId: coordExists.id, userId: officerUserId, isAdmin: true },
      update: {},
    });
    console.log("  ✓ ChatGroup → LRDB coordination group already exists, ensured membership");
  }

  // Local MSME community group (shared with MSME seed)
  let localGroup = await db.chatGroup.findUnique({ where: { streamChannelId: localChannelId } });
  if (!localGroup) {
    localGroup = await db.chatGroup.create({ data: {
      streamChannelId: localChannelId,
      name:            "Haveli MSME Community",
      regionCode:      REGION,
      groupType:       "LOCAL_MSME",
      createdByUserId: officerUserId,
    }});
    await db.chatLabel.createMany({ data: [
      { chatGroupId: localGroup.id, label: "Community Updates" },
      { chatGroupId: localGroup.id, label: "Emergency" },
    ]});
  }

  // Add officer + all seed shops as members
  const memberIds = [officerUserId, ...shops.map(s => s.user.id)];
  for (const uid of memberIds) {
    await db.chatGroupMember.upsert({
      where: { chatGroupId_userId: { chatGroupId: localGroup.id, userId: uid } },
      create: { chatGroupId: localGroup.id, userId: uid, isAdmin: uid === officerUserId },
      update: {},
    });
  }
  console.log(`  ✓ ChatGroup → 'Haveli MSME Community' has ${memberIds.length} members`);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
async function main() {
  const args   = process.argv.slice(2);
  const userId = args.find(a => !a.startsWith("--"));
  const reset  = args.includes("--reset");
  const dryRun = args.includes("--dry-run");

  if (!userId) {
    console.error("Usage: npx tsx scripts/seed-lrdb.ts <userId> [--reset] [--dry-run]");
    process.exit(1);
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) { console.error(`User ${userId} not found`); process.exit(1); }
  if (user.role !== "LRDB") { console.error(`User ${userId} has role ${user.role}, expected LRDB`); process.exit(1); }

  console.log(`\n▶ Seeding LRDB data for: ${user.name} (${user.email})`);
  if (dryRun) { console.log("  [dry-run] No changes will be made.\n"); process.exit(0); }
  if (reset)  { console.log("  Resetting existing data…"); await resetLrdbData(userId); }
  console.log();

  console.log("Phase 1 — LRDB Officer Profile");
  await seedOfficerProfile(userId);

  console.log("\nPhase 2 — Seed MSME Shops (4 shops in region)");
  const shops = await seedMsmeShops();

  console.log("\nPhase 3 — Support Queries");
  await seedQueries(userId, shops);

  console.log("\nPhase 4 — Alerts (issued by officer)");
  await seedAlerts(userId, shops);

  console.log("\nPhase 5 — Disaster Reports");
  await seedDisasterReports(userId, shops);

  console.log("\nPhase 6 — Trend Data (12 months)");
  await seedTrendData();

  console.log("\nPhase 7 — Chat Groups");
  await seedChatGroups(userId, shops);

  console.log(`\n✅ LRDB seed complete for ${user.name}`);
  console.log("\nSeed shop credentials (for reference):");
  shops.forEach(s => console.log(`  • ${s.shop.shopName.padEnd(35)} user ID: ${s.user.id}`));
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
