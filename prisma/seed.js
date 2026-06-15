/**
 * prisma/seed.ts
 * Seed script for DisasterShield development database.
 *
 * Run:  npx prisma db seed
 *
 * Covers (per DATABASE.md §8):
 *   - 1 LRDB officer account
 *   - 3 MSME shop owner accounts
 *   - Stock items with sensitivity tags per shop
 *   - 4 alerts (one per AlertSeverity level)
 *   - BCP plans with BEFORE/DURING/AFTER steps
 *   - 12 months of Pune region trend data
 *   - Chat groups with members
 *   - Queries in all 5 statuses
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
// ── Region constants ───────────────────────────────────────────────────────────
const REGION_MULSHI = "pune-mulshi";
const REGION_HAVELI = "pune-haveli";
const REGION_BHOR = "pune-bhor";
// ── Date helpers ───────────────────────────────────────────────────────────────
function monthsAgo(n) {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}
function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
}
// ── Main seed ─────────────────────────────────────────────────────────────────
async function main() {
    console.log("🌱  Seeding DisasterShield database…");
    // ── 1. LRDB officer user ────────────────────────────────────────────────────
    const lrdbUser = await db.user.upsert({
        where: { email: "rajesh.kumar.lrdb@pune.gov.in" },
        update: {},
        create: {
            email: "rajesh.kumar.lrdb@pune.gov.in",
            name: "Rajesh Kumar",
            role: "LRDB",
            language: "en",
            notifyViaApp: true,
            notifyViaEmail: true,
            notifyViaSms: true,
            notifyViaWhatsapp: false,
        },
    });
    await db.lRDBOfficer.upsert({
        where: { userId: lrdbUser.id },
        update: {},
        create: {
            userId: lrdbUser.id,
            district: "Pune",
            taluka: "Haveli",
            designation: "District Disaster Management Officer",
            regionCode: REGION_HAVELI,
        },
    });
    await db.emergencyContact.upsert({
        where: { id: "ec-lrdb-1" },
        update: {},
        create: {
            id: "ec-lrdb-1",
            userId: lrdbUser.id,
            name: "NDRF Pune Control Room",
            phone: "9112345678",
            relationship: "Government Body",
            isPrimary: true,
        },
    });
    console.log("  ✓ LRDB officer:", lrdbUser.email);
    // ── 2. MSME shop owner accounts ─────────────────────────────────────────────
    // --- 2a. Meena Patil — Kirana store, Mulshi ---
    const meena = await db.user.upsert({
        where: { email: "meena.patil@gmail.com" },
        update: {},
        create: {
            email: "meena.patil@gmail.com",
            name: "Meena Patil",
            role: "MSME",
            language: "mr",
            notifyViaApp: true,
            notifyViaEmail: true,
            notifyViaSms: false,
        },
    });
    const meenaShop = await db.shopProfile.upsert({
        where: { userId: meena.id },
        update: {},
        create: {
            userId: meena.id,
            shopName: "Patil Kirana & General Store",
            category: "Grocery & Provisions",
            address: "Shop No. 4, Main Bazar Road, Mulshi",
            district: "Pune",
            taluka: "Mulshi",
            pincode: "412108",
            latitude: 18.5204,
            longitude: 73.5541,
            phoneNumber: "9876543210",
            gstNumber: "27AABPM1234F1Z5",
            establishedYear: 2009,
            regionCode: REGION_MULSHI,
        },
    });
    await db.locationProfile.upsert({
        where: { shopProfileId: meenaShop.id },
        update: {},
        create: {
            shopProfileId: meenaShop.id,
            latitude: 18.5204,
            longitude: 73.5541,
            manuallySet: true,
            village: "Mulshi",
            suburb: "Paud",
            taluka: "Mulshi",
            district: "Pune",
            pincode: "412108",
            elevationMetres: 600,
            terrainSlope: 4.2,
            slopeAspect: "SW",
            terrainType: "SLOPE",
            nearestWaterBodyName: "Mulshi Dam Backwaters",
            nearestWaterBodyType: "RESERVOIR",
            nearestWaterBodyDistanceMetres: 380,
            nearestReservoirName: "Mulshi Reservoir",
            nearestReservoirDistanceKm: 0.4,
            nearestDamName: "Mulshi Dam",
            nearestDamDistanceKm: 3.2,
            nearestHospitalName: "Paud Rural Hospital",
            nearestHospitalDistanceKm: 6.1,
            nearestPoliceStationName: "Mulshi Police Station",
            nearestPoliceStationDistanceKm: 2.3,
            nearestFireStationName: "Pune Fire Brigade (Paud)",
            nearestFireStationDistanceKm: 8.5,
            nearestRoadType: "STATE_HIGHWAY",
            nearestPavedRoadDistanceMetres: 50,
            nearestSubstationName: "MSEDCL Mulshi Sub-Station",
            nearestSubstationDistanceKm: 4.1,
            connectivityType: "FOUR_G",
            powerSupplyType: "GRID",
            shopFloorLevel: "GROUND",
            buildingType: "SEMI_PUCCA",
            roofType: "TIN_SHEET",
            hasBasement: false,
            shopAreaSqFt: 350,
            storageFloorLevel: "GROUND_LEVEL",
            batchStatus: "COMPLETE",
            lastBatchRunAt: daysAgo(2),
        },
    });
    await db.emergencyContact.createMany({
        skipDuplicates: true,
        data: [
            { userId: meena.id, name: "Ramesh Patil (Husband)", phone: "9823456781", relationship: "Spouse", isPrimary: true },
            { userId: meena.id, name: "Ganesh (Supplier)", phone: "9011234567", relationship: "Supplier", isPrimary: false },
        ],
    });
    // --- 2b. Ganesh Kale — Pharmacy, Haveli ---
    const ganesh = await db.user.upsert({
        where: { email: "ganesh.kale.pharmacy@gmail.com" },
        update: {},
        create: {
            email: "ganesh.kale.pharmacy@gmail.com",
            name: "Ganesh Kale",
            role: "MSME",
            language: "en",
            notifyViaApp: true,
            notifyViaEmail: true,
            notifyViaSms: true,
        },
    });
    const ganeshShop = await db.shopProfile.upsert({
        where: { userId: ganesh.id },
        update: {},
        create: {
            userId: ganesh.id,
            shopName: "Kale Medical & Pharmacy",
            category: "Pharmacy & Medical Supplies",
            address: "17/B, Kothrud Main Road, Near Bus Stand",
            district: "Pune",
            taluka: "Haveli",
            pincode: "411038",
            latitude: 18.5074,
            longitude: 73.8077,
            phoneNumber: "9765432109",
            gstNumber: "27ABCPK5678G2Z8",
            establishedYear: 2014,
            regionCode: REGION_HAVELI,
        },
    });
    await db.locationProfile.upsert({
        where: { shopProfileId: ganeshShop.id },
        update: {},
        create: {
            shopProfileId: ganeshShop.id,
            latitude: 18.5074,
            longitude: 73.8077,
            manuallySet: false,
            village: "Kothrud",
            suburb: "Kothrud",
            taluka: "Haveli",
            district: "Pune",
            pincode: "411038",
            elevationMetres: 575,
            terrainSlope: 1.8,
            slopeAspect: "E",
            terrainType: "FLAT",
            nearestWaterBodyName: "Mutha River",
            nearestWaterBodyType: "RIVER",
            nearestWaterBodyDistanceMetres: 1200,
            nearestHospitalName: "Deenanath Mangeshkar Hospital",
            nearestHospitalDistanceKm: 1.8,
            nearestPoliceStationName: "Kothrud Police Station",
            nearestPoliceStationDistanceKm: 0.9,
            nearestFireStationName: "Kothrud Fire Station",
            nearestFireStationDistanceKm: 2.2,
            nearestRoadType: "STATE_HIGHWAY",
            nearestPavedRoadDistanceMetres: 10,
            nearestSubstationName: "MSEDCL Kothrud Sub-Station",
            nearestSubstationDistanceKm: 1.3,
            connectivityType: "FOUR_G",
            powerSupplyType: "GRID",
            shopFloorLevel: "GROUND",
            buildingType: "PUCCA",
            roofType: "RCC_SLAB",
            hasBasement: false,
            shopAreaSqFt: 280,
            storageFloorLevel: "ELEVATED_SHELF",
            batchStatus: "COMPLETE",
            lastBatchRunAt: daysAgo(1),
        },
    });
    // --- 2c. Sunita Sawant — Electronics, Bhor ---
    const sunita = await db.user.upsert({
        where: { email: "sunita.sawant.electronics@gmail.com" },
        update: {},
        create: {
            email: "sunita.sawant.electronics@gmail.com",
            name: "Sunita Sawant",
            role: "MSME",
            language: "mr",
            notifyViaApp: true,
            notifyViaEmail: false,
            notifyViaSms: true,
            notifyViaWhatsapp: true,
        },
    });
    const sunitaShop = await db.shopProfile.upsert({
        where: { userId: sunita.id },
        update: {},
        create: {
            userId: sunita.id,
            shopName: "Sawant Electronics & Mobiles",
            category: "Electronics & Appliances",
            address: "Bhimashankar Chowk, Bhor",
            district: "Pune",
            taluka: "Bhor",
            pincode: "412206",
            latitude: 18.1519,
            longitude: 73.8461,
            phoneNumber: "9654321098",
            establishedYear: 2018,
            regionCode: REGION_BHOR,
        },
    });
    await db.locationProfile.upsert({
        where: { shopProfileId: sunitaShop.id },
        update: {},
        create: {
            shopProfileId: sunitaShop.id,
            latitude: 18.1519,
            longitude: 73.8461,
            manuallySet: false,
            village: "Bhor",
            taluka: "Bhor",
            district: "Pune",
            pincode: "412206",
            elevationMetres: 650,
            terrainSlope: 6.5,
            slopeAspect: "NW",
            terrainType: "SLOPE",
            nearestWaterBodyName: "Nira River",
            nearestWaterBodyType: "RIVER",
            nearestWaterBodyDistanceMetres: 850,
            nearestHospitalName: "Bhor Government Hospital",
            nearestHospitalDistanceKm: 0.7,
            nearestPoliceStationName: "Bhor Police Station",
            nearestPoliceStationDistanceKm: 0.4,
            nearestRoadType: "DISTRICT_ROAD",
            nearestPavedRoadDistanceMetres: 20,
            nearestSubstationName: "MSEDCL Bhor Sub-Station",
            nearestSubstationDistanceKm: 2.8,
            connectivityType: "THREE_G",
            powerSupplyType: "MIXED",
            shopFloorLevel: "GROUND",
            buildingType: "PUCCA",
            roofType: "RCC_SLAB",
            hasBasement: false,
            shopAreaSqFt: 420,
            storageFloorLevel: "ELEVATED_SHELF",
            batchStatus: "COMPLETE",
            lastBatchRunAt: daysAgo(3),
        },
    });
    console.log("  ✓ MSME accounts: Meena Patil, Ganesh Kale, Sunita Sawant");
    // ── 3. Stock items with sensitivity tags ────────────────────────────────────
    // Meena's Kirana — grocery mix with water / perishable / flammable items
    const kiranaItems = [
        { name: "Basmati Rice (50 kg bags)", category: "Grains", qty: 200, unit: "kg", val: 16000, sens: ["WATER", "HUMIDITY"] },
        { name: "Toor Dal (Lentils)", category: "Pulses", qty: 150, unit: "kg", val: 12000, sens: ["WATER", "HUMIDITY"] },
        { name: "Sugar", category: "Sweetener", qty: 300, unit: "kg", val: 12000, sens: ["WATER", "HUMIDITY"] },
        { name: "Refined Cooking Oil", category: "Oils", qty: 80, unit: "litres", val: 9600, sens: ["FLAMMABLE"] },
        { name: "Wheat Flour (Atta)", category: "Grains", qty: 250, unit: "kg", val: 10000, sens: ["WATER", "HUMIDITY"] },
        { name: "Tomatoes", category: "Vegetables", qty: 40, unit: "kg", val: 1600, sens: ["PERISHABLE", "HEAT"] },
        { name: "Onions", category: "Vegetables", qty: 100, unit: "kg", val: 3000, sens: ["PERISHABLE"] },
        { name: "Packaged Biscuits & Snacks", category: "FMCG", qty: 500, unit: "units", val: 15000, sens: ["HUMIDITY"] },
        { name: "Kerosene (sealed cans)", category: "Fuel", qty: 20, unit: "litres", val: 1800, sens: ["FLAMMABLE"] },
        { name: "Detergent Powder", category: "Household", qty: 80, unit: "kg", val: 4800, sens: ["WATER"] },
    ];
    for (const item of kiranaItems) {
        const created = await db.stockItem.create({
            data: {
                shopProfileId: meenaShop.id,
                name: item.name,
                category: item.category,
                quantity: item.qty,
                unit: item.unit,
                estimatedValueInr: item.val,
                vulnerabilityScore: item.sens.includes("WATER") ? 75 : item.sens.includes("PERISHABLE") ? 60 : 30,
            },
        });
        await db.stockSensitivity.createMany({
            skipDuplicates: true,
            data: item.sens.map((t) => ({ stockItemId: created.id, type: t })),
        });
    }
    // Ganesh's Pharmacy — temperature-critical medicines
    const pharmacyItems = [
        { name: "Insulin Vials (refrigerated)", category: "Prescription", qty: 200, unit: "units", val: 60000, sens: ["HEAT", "PERISHABLE", "FRAGILE"] },
        { name: "Antibiotics (oral strips)", category: "Prescription", qty: 500, unit: "strips", val: 25000, sens: ["HEAT", "HUMIDITY"] },
        { name: "IV Fluids (500 ml bags)", category: "IV Supplies", qty: 300, unit: "bags", val: 18000, sens: ["FRAGILE", "HEAT"] },
        { name: "Disposable Syringes", category: "Consumables", qty: 2000, unit: "units", val: 8000, sens: ["FRAGILE"] },
        { name: "Blood Pressure Monitors", category: "Equipment", qty: 15, unit: "units", val: 45000, sens: ["FRAGILE", "WATER"] },
        { name: "Paracetamol (OTC strips)", category: "OTC", qty: 1000, unit: "strips", val: 10000, sens: [] },
        { name: "Antiseptic Solution (bottles)", category: "Consumables", qty: 150, unit: "bottles", val: 7500, sens: ["FRAGILE", "FLAMMABLE"] },
        { name: "Medical Oxygen Cylinder", category: "Equipment", qty: 5, unit: "units", val: 25000, sens: ["FLAMMABLE", "FRAGILE"] },
    ];
    for (const item of pharmacyItems) {
        const created = await db.stockItem.create({
            data: {
                shopProfileId: ganeshShop.id,
                name: item.name,
                category: item.category,
                quantity: item.qty,
                unit: item.unit,
                estimatedValueInr: item.val,
                vulnerabilityScore: item.sens.includes("HEAT") ? 80 : item.sens.includes("FRAGILE") ? 55 : 20,
            },
        });
        if (item.sens.length > 0) {
            await db.stockSensitivity.createMany({
                skipDuplicates: true,
                data: item.sens.map((t) => ({ stockItemId: created.id, type: t })),
            });
        }
    }
    // Sunita's Electronics — high-value, fragile, theft-prone
    const electronicsItems = [
        { name: "LED Televisions (32-inch)", category: "TV & AV", qty: 12, unit: "units", val: 144000, sens: ["WATER", "FRAGILE", "THEFT"] },
        { name: "Smartphones (mid-range)", category: "Mobile", qty: 30, unit: "units", val: 300000, sens: ["WATER", "FRAGILE", "THEFT"] },
        { name: "Inverter Batteries (150 Ah)", category: "Power", qty: 20, unit: "units", val: 120000, sens: ["WATER", "FLAMMABLE"] },
        { name: "Ceiling Fans", category: "Appliances", qty: 25, unit: "units", val: 37500, sens: ["FRAGILE"] },
        { name: "Washing Machines (semi-automatic)", category: "Appliances", qty: 6, unit: "units", val: 84000, sens: ["WATER", "FRAGILE"] },
        { name: "Electric Cables & Wiring (100 m)", category: "Accessories", qty: 50, unit: "rolls", val: 25000, sens: ["WATER", "FLAMMABLE"] },
        { name: "Power Banks (20000 mAh)", category: "Accessories", qty: 40, unit: "units", val: 28000, sens: ["THEFT"] },
        { name: "Laptop Computers", category: "Computing", qty: 8, unit: "units", val: 120000, sens: ["WATER", "FRAGILE", "THEFT"] },
    ];
    for (const item of electronicsItems) {
        const created = await db.stockItem.create({
            data: {
                shopProfileId: sunitaShop.id,
                name: item.name,
                category: item.category,
                quantity: item.qty,
                unit: item.unit,
                estimatedValueInr: item.val,
                vulnerabilityScore: item.sens.includes("WATER") ? 70 : item.sens.includes("THEFT") ? 65 : 40,
            },
        });
        await db.stockSensitivity.createMany({
            skipDuplicates: true,
            data: item.sens.map((t) => ({ stockItemId: created.id, type: t })),
        });
    }
    console.log("  ✓ Stock items with sensitivity tags seeded");
    // ── 4. Alerts — one per severity level ─────────────────────────────────────
    const alertLow = await db.alert.create({
        data: {
            title: "Transport Advisory: Mulshi Ghat Road — Minor Waterlogging",
            severity: "LOW",
            category: "TRANSPORT",
            summary: JSON.stringify({
                summary: "Light waterlogging reported on Paud–Mulshi ghat stretch (NH 48) near 18th km marker due to overnight drizzle. Vehicles with low ground clearance advised to use the alternate Pirangut route. No disruption to supply chains expected.",
                affectedItems: [],
                actionSteps: ["Monitor MSRTC bus schedule for any delays", "Confirm delivery routes with suppliers before dispatch"],
            }),
            affectedRegions: REGION_MULSHI,
            isActive: true,
            expiresAt: daysFromNow(1),
            issuedByUserId: lrdbUser.id,
        },
    });
    const alertMedium = await db.alert.create({
        data: {
            title: "Wind Warning: Gusts up to 55 km/h Expected — Kothrud & Haveli",
            severity: "MEDIUM",
            category: "WIND",
            summary: JSON.stringify({
                summary: "IMD has issued a yellow wind warning for Haveli and Kothrud. Gusts up to 55 km/h expected between 14:00–20:00 IST. Outdoor signage, tin roof fixtures, and light scaffolding are at risk. Pharmacy owners should secure oxygen cylinders and door awnings.",
                affectedItems: ["Outdoor signage", "Tin roof fixtures", "Unsecured cylinders"],
                actionSteps: [
                    "Secure all outdoor signage and banners before 14:00",
                    "Reinforce tin sheet roofing with sandbags if applicable",
                    "Keep oxygen and LPG cylinders in secured, enclosed storage",
                    "Inform staff to avoid opening large glass doors during gusts",
                ],
            }),
            affectedRegions: REGION_HAVELI,
            isActive: true,
            expiresAt: daysFromNow(1),
        },
    });
    const alertHigh = await db.alert.create({
        data: {
            title: "Heavy Rain Alert: Mulshi Reservoir Inflow — Flood Risk for Low-Lying Shops",
            severity: "HIGH",
            category: "FLOOD",
            summary: JSON.stringify({
                summary: "Mulshi dam has received 85% of FRL inflow in last 48 hours (IMD Pune, 25 May 2026). Shops within 500 m of dam backwaters face HIGH flood risk. Patil Kirana & General Store (380 m from reservoir) should immediately elevate all ground-floor water-sensitive stock. District administration has opened relief shelters at Paud High School.",
                affectedItems: ["Basmati Rice", "Sugar", "Wheat Flour", "Toor Dal", "Detergent Powder"],
                actionSteps: [
                    "Move all water-sensitive stock (rice, sugar, flour) to shelves at least 60 cm above floor level immediately",
                    "Photograph entire inventory for insurance claim documentation",
                    "Disable ground-level electrical points and move switchboards to safe height",
                    "Keep emergency kit (torch, medicines, documents in waterproof bag) ready",
                    "Monitor LRDB WhatsApp broadcast for dam gate opening notifications",
                ],
            }),
            affectedRegions: REGION_MULSHI,
            isActive: true,
            expiresAt: daysFromNow(2),
        },
    });
    const alertCritical = await db.alert.create({
        data: {
            title: "CRITICAL: Flash Flood — Mulshi Dam Gates Opened; Immediate Evacuation Required",
            severity: "CRITICAL",
            category: "FLOOD",
            summary: JSON.stringify({
                summary: "URGENT: Mulshi dam gates opened at 03:45 IST. Rapid rise in water levels expected within 90 minutes in low-lying areas along Mula-Mutha basin. All businesses within 500 m of water bodies in Mulshi taluka must evacuate immediately. Do NOT attempt to move stock — prioritise personal safety.",
                affectedItems: ["All ground-floor stock", "Refrigeration units", "Electrical equipment"],
                actionSteps: [
                    "EVACUATE immediately — proceed to Paud High School relief camp",
                    "Call NDRF helpline: 011-24363260 if stranded",
                    "Do NOT enter flooded premises until cleared by LRDB officer",
                    "Contact Rajesh Kumar (LRDB): 9112345678",
                ],
            }),
            affectedRegions: `${REGION_MULSHI},${REGION_BHOR}`,
            isActive: true,
            expiresAt: daysFromNow(3),
            issuedByUserId: lrdbUser.id,
        },
    });
    // Attach all 3 MSME users as recipients of the critical alert
    await db.alertRecipient.createMany({
        skipDuplicates: true,
        data: [
            { alertId: alertLow.id, userId: meena.id, isRead: true },
            { alertId: alertMedium.id, userId: ganesh.id, isRead: false },
            { alertId: alertHigh.id, userId: meena.id, isRead: false },
            { alertId: alertCritical.id, userId: meena.id, isRead: false },
            { alertId: alertCritical.id, userId: sunita.id, isRead: false },
        ],
    });
    // Alert actions for the HIGH flood alert
    const action1 = await db.alertAction.create({
        data: { alertId: alertHigh.id, label: "Move water-sensitive stock to elevated shelves", actionType: "mark-secured", orderIndex: 0 },
    });
    const action2 = await db.alertAction.create({
        data: { alertId: alertHigh.id, label: "Photograph inventory for insurance", actionType: "mark-secured", orderIndex: 1 },
    });
    await db.alertAction.create({
        data: { alertId: alertHigh.id, label: "Request LRDB support", actionType: "request-support", orderIndex: 2 },
    });
    // One action result (Meena completed action 1)
    const meenaRecipient = await db.alertRecipient.findUnique({
        where: { alertId_userId: { alertId: alertHigh.id, userId: meena.id } },
    });
    if (meenaRecipient) {
        await db.alertActionResult.createMany({
            skipDuplicates: true,
            data: [
                { alertActionId: action1.id, alertRecipientId: meenaRecipient.id, isCompleted: true, completedAt: daysAgo(0) },
                { alertActionId: action2.id, alertRecipientId: meenaRecipient.id, isCompleted: false },
            ],
        });
    }
    console.log("  ✓ Alerts (LOW / MEDIUM / HIGH / CRITICAL) seeded");
    // ── 5. Risk profiles ────────────────────────────────────────────────────────
    const meenaRisk = await db.riskProfile.upsert({
        where: { shopProfileId: meenaShop.id },
        update: {},
        create: {
            shopProfileId: meenaShop.id,
            overallScore: 72,
            floodScore: 85,
            powerScore: 45,
            stockScore: 78,
            locationScore: 68,
            accessScore: 35,
            riskLevel: "HIGH",
        },
    });
    await db.riskSuggestion.createMany({
        skipDuplicates: true,
        data: [
            { riskProfileId: meenaRisk.id, title: "Raise storage shelves by 60 cm", description: "Proximity to Mulshi reservoir (380 m) makes ground-level storage extremely vulnerable. Elevate all rice, flour and sugar bags.", impactScore: 18, orderIndex: 0 },
            { riskProfileId: meenaRisk.id, title: "Obtain Micro-Enterprise Flood Insurance", description: "Current estimated stock value of ~₹86,000 is fully uninsured. PMFBY or private crop/stock insurance available through Pune district co-operative bank.", impactScore: 15, orderIndex: 1 },
            { riskProfileId: meenaRisk.id, title: "Install water-level alarm sensor", description: "Low-cost IoT water sensor (₹1,500) at shop entrance linked to phone alert can provide 30–60 min warning before water ingress.", impactScore: 12, orderIndex: 2 },
            { riskProfileId: meenaRisk.id, title: "Replace tin roof with RCC slab where possible", description: "Tin roof increases wind damage risk by 40%. A partial RCC slab over storage area would protect highest-value stock during cyclonic events.", impactScore: 10, orderIndex: 3 },
        ],
    });
    const ganeshRisk = await db.riskProfile.upsert({
        where: { shopProfileId: ganeshShop.id },
        update: {},
        create: {
            shopProfileId: ganeshShop.id,
            overallScore: 48,
            floodScore: 30,
            powerScore: 55,
            stockScore: 82,
            locationScore: 25,
            accessScore: 20,
            riskLevel: "MODERATE",
        },
    });
    await db.riskSuggestion.createMany({
        skipDuplicates: true,
        data: [
            { riskProfileId: ganeshRisk.id, title: "Install backup UPS / generator for cold chain", description: "Insulin and temperature-sensitive medicines (est. ₹60,000) require continuous refrigeration. A 2 kVA UPS provides 8 hours backup during power outages.", impactScore: 20, orderIndex: 0 },
            { riskProfileId: ganeshRisk.id, title: "Temperature logging for cold storage", description: "FDA-compliant temperature logs protect against spoilage claims. A ₹3,000 Bluetooth logger records data continuously and alerts on breaches.", impactScore: 14, orderIndex: 1 },
            { riskProfileId: ganeshRisk.id, title: "Secure medical oxygen cylinders", description: "Oxygen cylinders must be chained to wall brackets per IS 7285. During wind events, unsecured cylinders become projectiles. Install proper restraint brackets.", impactScore: 10, orderIndex: 2 },
        ],
    });
    await db.riskProfile.upsert({
        where: { shopProfileId: sunitaShop.id },
        update: {},
        create: {
            shopProfileId: sunitaShop.id,
            overallScore: 61,
            floodScore: 42,
            powerScore: 68,
            stockScore: 74,
            locationScore: 55,
            accessScore: 50,
            riskLevel: "HIGH",
        },
    });
    console.log("  ✓ Risk profiles and suggestions seeded");
    // ── 6. BCP plans ────────────────────────────────────────────────────────────
    const meenaBCP = await db.bCPPlan.upsert({
        where: { shopProfileId: meenaShop.id },
        update: {},
        create: {
            shopProfileId: meenaShop.id,
            completionPercent: 60,
        },
    });
    await db.bCPStep.createMany({
        skipDuplicates: true,
        data: [
            // BEFORE
            { bcpPlanId: meenaBCP.id, phase: "BEFORE", title: "Photograph all stock for insurance records", description: "Take date-stamped photographs of all stock categories, focusing on highest-value items (rice, oil, electronics). Store in a cloud folder accessible offline.", isCompleted: true, completedAt: daysAgo(5), orderIndex: 0 },
            { bcpPlanId: meenaBCP.id, phase: "BEFORE", title: "Move water-sensitive stock to elevated shelves (≥60 cm)", description: "Relocate all rice, sugar, flour and dal to shelves at least 60 cm above floor. Use wooden pallets as base layer for bulk bags. Target completion: within 2 hours of any orange IMD alert.", isCompleted: true, completedAt: daysAgo(4), orderIndex: 1 },
            { bcpPlanId: meenaBCP.id, phase: "BEFORE", title: "Prepare emergency contact list", description: "Compile single-page contact sheet: LRDB officer Rajesh Kumar (9112345678), NDRF (011-24363260), Pune Fire (101), Supplier Ganesh (9011234567), Insurance agent.", isCompleted: false, orderIndex: 2 },
            { bcpPlanId: meenaBCP.id, phase: "BEFORE", title: "Secure outdoor signage and kerosene cans", description: "Bring down overhanging banners. Store kerosene cans in raised metal cabinet. Sandbag the shop entrance threshold (pre-position 10 sandbags behind the counter).", isCompleted: false, orderIndex: 3 },
            { bcpPlanId: meenaBCP.id, phase: "BEFORE", title: "Contact crop/stock insurer and verify flood coverage", description: "Call Oriental Insurance (policy no. OIC-PNE-2024-0089) to confirm flood cover extends to Mulshi. Request endorsement for dam-backwater flooding.", isCompleted: false, orderIndex: 4, isOptional: true },
            // DURING
            { bcpPlanId: meenaBCP.id, phase: "DURING", title: "Shut off ground-level electrical mains", description: "Locate and flip the ground-floor MCB (marked in red near the meter board). Do NOT re-energise until a licensed electrician has inspected post-flood.", isCompleted: false, orderIndex: 0 },
            { bcpPlanId: meenaBCP.id, phase: "DURING", title: "Evacuate shop and proceed to Paud High School camp", description: "Lock the shop. Take the emergency bag (documents, cash, medicines). Walk via the elevated road — avoid the low-lying lane beside the canal.", isCompleted: false, orderIndex: 1 },
            { bcpPlanId: meenaBCP.id, phase: "DURING", title: "Document ongoing damage with phone camera", description: "If safe to do so, photograph or video water ingress as it occurs. This evidence is critical for insurance claims. Upload to cloud immediately.", isCompleted: false, orderIndex: 2 },
            { bcpPlanId: meenaBCP.id, phase: "DURING", title: "Notify all suppliers of closure", description: "Send a single WhatsApp broadcast to all suppliers: 'Shop closed due to flood. Will update on reopening. Please hold all deliveries.' Save chat screenshots.", isCompleted: false, orderIndex: 3 },
            // AFTER
            { bcpPlanId: meenaBCP.id, phase: "AFTER", title: "Conduct damage assessment before re-entering", description: "Wait for LRDB officer clearance before entering. Check for structural cracks, gas smell, and standing water. Wear gumboots. Do NOT use electrical switches.", isCompleted: false, orderIndex: 0 },
            { bcpPlanId: meenaBCP.id, phase: "AFTER", title: "File insurance claim with photo evidence", description: "Call OIC claims desk within 48 hours. Submit: inventory photos (pre-flood), damage photos, police FIR/LRDB report, purchase invoices for last 3 months.", isCompleted: false, orderIndex: 1 },
            { bcpPlanId: meenaBCP.id, phase: "AFTER", title: "Discard and log spoiled / contaminated stock", description: "Prepare itemised spoilage log: item name, quantity, estimated value, reason (flood/contamination). Have witnessed by LRDB officer for insurance verification.", isCompleted: false, orderIndex: 2 },
            { bcpPlanId: meenaBCP.id, phase: "AFTER", title: "Contact suppliers for priority restocking of essentials", description: "Call top 3 suppliers for rice, sugar, cooking oil. Explain situation. Request 50% advance credit for first post-flood order. Arrange direct delivery to avoid logistics delays.", isCompleted: false, orderIndex: 3 },
            { bcpPlanId: meenaBCP.id, phase: "AFTER", title: "Post reopening notice on shop and WhatsApp", description: "Put handwritten notice on shop door with reopening date/time. Send WhatsApp broadcast to regular customers. Resume operations only after electrical safety check.", isCompleted: false, orderIndex: 4 },
        ],
    });
    const ganeshBCP = await db.bCPPlan.upsert({
        where: { shopProfileId: ganeshShop.id },
        update: {},
        create: {
            shopProfileId: ganeshShop.id,
            completionPercent: 80,
        },
    });
    await db.bCPStep.createMany({
        skipDuplicates: true,
        data: [
            { bcpPlanId: ganeshBCP.id, phase: "BEFORE", title: "Switch refrigerator to UPS immediately on power flicker", description: "Turn on the 2 kVA UPS unit (under the dispensing counter) when grid power shows instability. This gives 8 hours backup for insulin cold chain.", isCompleted: true, completedAt: daysAgo(7), orderIndex: 0 },
            { bcpPlanId: ganeshBCP.id, phase: "BEFORE", title: "Move expired/near-expiry stock to safe zone", description: "Identify medicines expiring within 30 days. Move to a sealed, waterproof box stored at 1 m height. Return to supplier if exchange policy applies.", isCompleted: true, completedAt: daysAgo(6), orderIndex: 1 },
            { bcpPlanId: ganeshBCP.id, phase: "BEFORE", title: "Verify backup generator fuel level (≥10 litres diesel)", description: "Check fuel gauge on the 3 kVA generator in the back room. Refuel to at least 10 litres (runs ~6 hours). Keep jerry can with 5 litres extra on standby.", isCompleted: true, completedAt: daysAgo(3), orderIndex: 2 },
            { bcpPlanId: ganeshBCP.id, phase: "DURING", title: "Notify nearest government hospital of temporary closure", description: "Call Deenanath Mangeshkar Hospital pharmacy (020-30233000) and inform them of stock availability and closure duration so patients can redirect.", isCompleted: false, orderIndex: 0 },
            { bcpPlanId: ganeshBCP.id, phase: "DURING", title: "Secure narcotic and Schedule H1 medicines in locked safe", description: "Transfer all controlled substances to the fire-resistant safe (code: 2580). Document quantities removed and relocked. This is a CDSCO legal requirement during emergencies.", isCompleted: false, orderIndex: 1 },
            { bcpPlanId: ganeshBCP.id, phase: "AFTER", title: "Temperature log review and medicine quality check", description: "Download temperature log from Bluetooth logger. If any period exceeded 8°C for insulin or 25°C for other refrigerated items, discard that stock. Get pharmacist certification.", isCompleted: false, orderIndex: 0 },
            { bcpPlanId: ganeshBCP.id, phase: "AFTER", title: "Submit State Drug Department incident report", description: "Any destruction of Schedule H/H1/X medicines must be reported to Maharashtra FDA within 7 days. Include: quantity, reason, method of disposal, date.", isCompleted: false, orderIndex: 1 },
        ],
    });
    console.log("  ✓ BCP plans (Meena: 14 steps, Ganesh: 7 steps) seeded");
    // ── 7. Forecast scenarios ────────────────────────────────────────────────────
    const meenaForecast = await db.forecastScenario.create({
        data: {
            shopProfileId: meenaShop.id,
            disasterType: "Flood (Dam-Release)",
            probability: "high",
            estimatedLossInr: 62000,
            affectedItemCount: 6,
            estimatedDowntimeDays: 5,
            recoveryTimelineDays: 12,
            aiNarrative: "Based on Mulshi dam proximity (380 m) and monsoon inflow patterns over the past 5 years, a dam-release flood event has a HIGH probability of affecting this store. Historical data shows average 2.8 flood-proximity alerts per monsoon season in Mulshi. Estimated stock loss of ₹62,000 accounts for 72% of ground-level grain and FMCG inventory. Revenue loss of ₹18,000 is estimated over a 5-day closure at average daily sales of ₹3,600.",
            affectedItems: {
                create: [
                    { stockItemName: "Basmati Rice (50 kg bags)", estimatedDamageInr: 16000 },
                    { stockItemName: "Sugar", estimatedDamageInr: 12000 },
                    { stockItemName: "Wheat Flour (Atta)", estimatedDamageInr: 10000 },
                    { stockItemName: "Toor Dal (Lentils)", estimatedDamageInr: 9000 },
                    { stockItemName: "Packaged Biscuits & Snacks", estimatedDamageInr: 8000 },
                    { stockItemName: "Detergent Powder", estimatedDamageInr: 4000 },
                    { stockItemName: "Kerosene (sealed cans)", estimatedDamageInr: 1800 },
                    { stockItemName: "Onions", estimatedDamageInr: 1200 },
                ],
            },
        },
    });
    await db.forecastScenario.create({
        data: {
            shopProfileId: ganeshShop.id,
            disasterType: "3-Day Power Outage",
            probability: "medium",
            estimatedLossInr: 72000,
            affectedItemCount: 3,
            estimatedDowntimeDays: 3,
            recoveryTimelineDays: 5,
            aiNarrative: "Power grid instability during peak monsoon (June–September) creates a MEDIUM probability of 48–72 hour outages in Kothrud. Cold-chain medicines (insulin, IV fluids) account for 50% of stock value. Without adequate backup power, estimated losses of ₹72,000 would result from spoilage of temperature-sensitive inventory within 24 hours.",
            affectedItems: {
                create: [
                    { stockItemName: "Insulin Vials (refrigerated)", estimatedDamageInr: 60000 },
                    { stockItemName: "IV Fluids (500 ml bags)", estimatedDamageInr: 9000 },
                    { stockItemName: "Antibiotics (oral strips)", estimatedDamageInr: 3000 },
                ],
            },
        },
    });
    console.log("  ✓ Forecast scenarios seeded");
    // ── 8. Trend data — 12 months for Pune region ───────────────────────────────
    const trendRegions = [REGION_MULSHI, REGION_HAVELI, REGION_BHOR];
    // Monthly IMD-style rainfall data for Pune district (realistic monsoon pattern)
    const rainfallByMonth = {
        0: 11, // Jun  (monthsAgo(11) = ~Jun 2025)
        1: 8, // Jul
        2: 5, // Aug
        3: 12, // Sep
        4: 178, // Oct (post-monsoon)
        5: 220, // Nov
        6: 185, // Dec (peak monsoon)
        7: 312, // Jan — heavy
        8: 298, // Feb — heavy
        9: 243, // Mar — easing
        10: 95, // Apr
        11: 22, // May (pre-monsoon)
    };
    const floodIncidentsByMonth = {
        0: 0, 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0
    };
    const powerOutagesByMonth = {
        0: 1, 1: 0, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 4, 9: 3, 10: 2, 11: 1
    };
    const transportDisruptByMonth = {
        0: 0, 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 2, 7: 3, 8: 3, 9: 2, 10: 1, 11: 0
    };
    const trendRows = [];
    for (const region of trendRegions) {
        for (let m = 11; m >= 0; m--) {
            const date = monthsAgo(m);
            const scaleFactor = region === REGION_MULSHI ? 1.3 : region === REGION_BHOR ? 1.1 : 1.0;
            trendRows.push({ regionCode: region, trendType: "rainfall", value: Math.round(rainfallByMonth[11 - m] * scaleFactor), unit: "mm", recordedAt: date, source: "IMD" }, { regionCode: region, trendType: "flood_incident", value: floodIncidentsByMonth[11 - m], unit: "incidents", recordedAt: date, source: "LRDB Report" }, { regionCode: region, trendType: "power_outage", value: powerOutagesByMonth[11 - m] * (region === REGION_BHOR ? 1.5 : 1), unit: "incidents", recordedAt: date, source: "MSEDCL" }, { regionCode: region, trendType: "transport_disruption", value: transportDisruptByMonth[11 - m], unit: "incidents", recordedAt: date, source: "MSRTC" }, { regionCode: region, trendType: "customer_activity", value: Math.max(20, 100 - floodIncidentsByMonth[11 - m] * 15), unit: "index", recordedAt: date, source: "Manual" });
        }
    }
    await db.trendDataPoint.createMany({ data: trendRows });
    console.log(`  ✓ Trend data (${trendRows.length} points across 3 Pune regions) seeded`);
    // ── 9. Disaster report ───────────────────────────────────────────────────────
    const report = await db.disasterReport.create({
        data: {
            title: "Mulshi Flood Event — May 2026 Impact Assessment",
            disasterType: "Flood",
            affectedZone: "Mulshi, Paud, Tamhini",
            affectedRegionCode: REGION_MULSHI,
            reportDate: daysAgo(2),
            status: "PUBLISHED",
            createdByUserId: lrdbUser.id,
            publishedAt: daysAgo(1),
            summary: "Heavy rainfall of 312 mm in 48 hours triggered elevated Mulshi dam inflow (85% FRL). Controlled water release through 3 gates affected low-lying areas within 500 m of dam backwaters. 12 businesses in Mulshi taluka reported stock damage. Estimated total economic loss: ₹4.2 lakh. No casualties. 47 persons relocated to Paud High School relief camp.",
            reportMetrics: {
                create: [
                    { metricKey: "total_shops_affected", metricValue: 12, metricLabel: "Shops Affected", sectorBreakdown: JSON.stringify({ "Grocery": 5, "Pharmacy": 1, "Hardware": 3, "Electronics": 2, "Other": 1 }) },
                    { metricKey: "estimated_loss_inr", metricValue: 420000, metricLabel: "Estimated Loss (INR)", sectorBreakdown: null },
                    { metricKey: "persons_evacuated", metricValue: 47, metricLabel: "Persons Evacuated", sectorBreakdown: null },
                    { metricKey: "duration_hours", metricValue: 36, metricLabel: "Event Duration (hours)", sectorBreakdown: null },
                    { metricKey: "rainfall_48hr_mm", metricValue: 312, metricLabel: "48-hr Rainfall (mm)", sectorBreakdown: null },
                ],
            },
        },
    });
    console.log("  ✓ Disaster report seeded");
    // ── 10. Chat groups ──────────────────────────────────────────────────────────
    const localMsmeGroup = await db.chatGroup.create({
        data: {
            streamChannelId: `local-msme-${REGION_MULSHI}-seed`,
            name: "Mulshi MSME Business Circle",
            regionCode: REGION_MULSHI,
            groupType: "LOCAL_MSME",
            createdByUserId: meena.id,
            isActive: true,
            members: {
                create: [
                    { userId: meena.id, isAdmin: true },
                    { userId: sunita.id, isAdmin: false },
                ],
            },
            labels: {
                create: [
                    { label: "Flood Alert" },
                    { label: "Supplier Coordination" },
                    { label: "Market Updates" },
                ],
            },
        },
    });
    const lrdbCoordGroup = await db.chatGroup.create({
        data: {
            streamChannelId: `lrdb-coordination-${REGION_HAVELI}-seed`,
            name: "Pune District LRDB Coordination",
            regionCode: REGION_HAVELI,
            groupType: "LRDB_COORDINATION",
            createdByUserId: lrdbUser.id,
            isActive: true,
            members: {
                create: [
                    { userId: lrdbUser.id, isAdmin: true },
                    { userId: ganesh.id, isAdmin: false },
                    { userId: meena.id, isAdmin: false },
                ],
            },
            labels: {
                create: [
                    { label: "Emergency" },
                    { label: "Official Updates" },
                    { label: "Relief Operations" },
                ],
            },
        },
    });
    await db.chatGroup.create({
        data: {
            streamChannelId: `sos-mulshi-dam-2026-seed`,
            name: "SOS — Mulshi Dam Alert Channel",
            regionCode: REGION_MULSHI,
            groupType: "SOS_EMERGENCY",
            createdByUserId: lrdbUser.id,
            isActive: true,
            members: {
                create: [
                    { userId: lrdbUser.id, isAdmin: true },
                    { userId: meena.id, isAdmin: false },
                ],
            },
            labels: {
                create: [
                    { label: "SOS" },
                    { label: "Evacuation" },
                ],
            },
        },
    });
    console.log("  ✓ Chat groups (LOCAL_MSME, LRDB_COORDINATION, SOS_EMERGENCY) seeded");
    // ── 11. Queries in all statuses ──────────────────────────────────────────────
    // PENDING — new flood assistance request from Meena
    const q1 = await db.query.create({
        data: {
            shopProfileId: meenaShop.id,
            submittedByUserId: meena.id,
            queryType: "Flood Assistance",
            description: "My shop at Mulshi has been flooded. Water level reached approx. 30 cm inside the shop. Rice and sugar stock (approx. 350 kg, value ₹28,000) is damaged. Requesting LRDB inspection for insurance claim documentation and support with restocking credit.",
            priority: "HIGH",
            status: "PENDING",
        },
    });
    await db.queryStatusHistory.create({
        data: { queryId: q1.id, fromStatus: null, toStatus: "PENDING", changedBy: meena.id, notes: "Query submitted by shop owner" },
    });
    // UNDER_REVIEW — power outage complaint from Ganesh
    const q2 = await db.query.create({
        data: {
            shopProfileId: ganeshShop.id,
            submittedByUserId: ganesh.id,
            queryType: "Power Outage",
            description: "Kothrud area has been facing rolling 6–8 hour power cuts since last Tuesday. Our insulin cold chain has been compromised twice. UPS ran dry during the 9-hour outage on 22 May. We have already lost insulin stock worth ₹12,000. Request MSEDCL/LRDB escalation for priority feeder restoration for medical establishments.",
            priority: "CRITICAL",
            status: "UNDER_REVIEW",
        },
    });
    await db.queryStatusHistory.createMany({
        data: [
            { queryId: q2.id, fromStatus: null, toStatus: "PENDING", changedBy: ganesh.id, notes: "Submitted" },
            { queryId: q2.id, fromStatus: "PENDING", toStatus: "UNDER_REVIEW", changedBy: lrdbUser.id, notes: "Escalated to MSEDCL for critical medical facility priority" },
        ],
    });
    // ASSIGNED — transport disruption from Sunita
    const q3 = await db.query.create({
        data: {
            shopProfileId: sunitaShop.id,
            submittedByUserId: sunita.id,
            assignedToUserId: lrdbUser.id,
            queryType: "Transport Disruption",
            description: "Bhor–Pune NH 48 has been blocked since 3 days due to a landslide near Ketkavale. All stock deliveries for our electronics shop have been halted. Inventory running low. Requesting alternate route advisory and support for emergency goods movement.",
            priority: "MEDIUM",
            status: "ASSIGNED",
        },
    });
    await db.queryStatusHistory.createMany({
        data: [
            { queryId: q3.id, fromStatus: null, toStatus: "PENDING", changedBy: sunita.id, notes: "Submitted" },
            { queryId: q3.id, fromStatus: "PENDING", toStatus: "UNDER_REVIEW", changedBy: lrdbUser.id, notes: "Reviewing alternate route options with PWD" },
            { queryId: q3.id, fromStatus: "UNDER_REVIEW", toStatus: "ASSIGNED", changedBy: lrdbUser.id, notes: "Assigned to Rajesh Kumar for co-ordination with MSRTC and PWD Bhor division" },
        ],
    });
    // RESOLVED — a past flood assistance (from 30 days ago)
    const q4 = await db.query.create({
        data: {
            shopProfileId: meenaShop.id,
            submittedByUserId: meena.id,
            assignedToUserId: lrdbUser.id,
            queryType: "Flood Assistance",
            description: "March flooding affected my back storage room. Need help with damage assessment form and connection to SBI emergency loan scheme for MSMEs.",
            priority: "HIGH",
            status: "RESOLVED",
            resolvedAt: daysAgo(25),
            resolutionNotes: "LRDB officer visited on 01 April 2026. Damage assessment form (Form-7B) completed and submitted to tehsildar. Shopkeeper connected with Lead District Manager (SBI) for MUDRA Shishu emergency loan. Claim of ₹38,000 approved. Case closed.",
        },
    });
    await db.queryStatusHistory.createMany({
        data: [
            { queryId: q4.id, fromStatus: null, toStatus: "PENDING", changedBy: meena.id, notes: "Submitted" },
            { queryId: q4.id, fromStatus: "PENDING", toStatus: "ASSIGNED", changedBy: lrdbUser.id, notes: "Assigned to field officer for site visit" },
            { queryId: q4.id, fromStatus: "ASSIGNED", toStatus: "RESOLVED", changedBy: lrdbUser.id, notes: "Site visit complete. Loan approved. Case closed." },
        ],
    });
    // ESCALATED — critical infrastructure damage from Sunita (older)
    const q5 = await db.query.create({
        data: {
            shopProfileId: sunitaShop.id,
            submittedByUserId: sunita.id,
            assignedToUserId: lrdbUser.id,
            queryType: "Flood Assistance",
            description: "Ground floor shop completely inundated on 15 April due to Nira river overflow. All electronics stock (est. value ₹8.5 lakh) destroyed. Building structure compromised — wall cracks visible. Cannot reopen until structural clearance. This needs immediate district-level intervention.",
            priority: "CRITICAL",
            status: "ESCALATED",
        },
    });
    await db.queryStatusHistory.createMany({
        data: [
            { queryId: q5.id, fromStatus: null, toStatus: "PENDING", changedBy: sunita.id, notes: "Submitted" },
            { queryId: q5.id, fromStatus: "PENDING", toStatus: "UNDER_REVIEW", changedBy: lrdbUser.id, notes: "Stock damage of ₹8.5 lakh confirmed — above district approval threshold" },
            { queryId: q5.id, fromStatus: "UNDER_REVIEW", toStatus: "ESCALATED", changedBy: lrdbUser.id, notes: "Escalated to Divisional Commissioner Pune for emergency relief fund disbursement" },
        ],
    });
    console.log("  ✓ Queries (PENDING, UNDER_REVIEW, ASSIGNED, RESOLVED, ESCALATED) seeded");
    // ── 12. Notification logs ────────────────────────────────────────────────────
    await db.notificationLog.createMany({
        data: [
            { userId: meena.id, channel: "APP", type: "alert", subject: "Heavy Rain Alert: Mulshi Reservoir — Act Now", status: "SENT", sentAt: daysAgo(0), referenceId: alertHigh.id },
            { userId: meena.id, channel: "EMAIL", type: "alert", subject: "CRITICAL: Flash Flood — Immediate Evacuation Required", status: "SENT", sentAt: daysAgo(0), referenceId: alertCritical.id },
            { userId: meena.id, channel: "APP", type: "bcp_ready", subject: "Your Business Continuity Plan has been generated", status: "SENT", sentAt: daysAgo(3), referenceId: meenaBCP.id },
            { userId: meena.id, channel: "APP", type: "query_update", subject: "Your flood assistance query has been resolved", status: "SENT", sentAt: daysAgo(25), referenceId: q4.id },
            { userId: ganesh.id, channel: "APP", type: "alert", subject: "Wind Warning: Gusts up to 55 km/h — Secure your premises", status: "SENT", sentAt: daysAgo(0), referenceId: alertMedium.id },
            { userId: ganesh.id, channel: "EMAIL", type: "risk_change", subject: "Your risk profile has been updated — Score: 48/100", status: "SENT", sentAt: daysAgo(1), referenceId: ganeshRisk.id },
            { userId: ganesh.id, channel: "APP", type: "query_update", subject: "Your power outage query is now under review", status: "SENT", sentAt: daysAgo(0), referenceId: q2.id },
            { userId: sunita.id, channel: "SMS", type: "alert", subject: "CRITICAL FLOOD ALERT — Check DisasterShield app now", status: "SENT", sentAt: daysAgo(0), referenceId: alertCritical.id },
        ],
    });
    console.log("  ✓ Notification logs seeded");
    // ── Summary ───────────────────────────────────────────────────────────────────
    console.log("\n✅  Seed complete. Summary:");
    console.log(`     Users:           4 (1 LRDB + 3 MSME)`);
    console.log(`     Stock items:     ${kiranaItems.length + pharmacyItems.length + electronicsItems.length} across 3 shops`);
    console.log(`     Alerts:          4 (LOW / MEDIUM / HIGH / CRITICAL)`);
    console.log(`     BCP steps:       ${14 + 7} across 2 shops`);
    console.log(`     Forecast scenarios: 2`);
    console.log(`     Trend data:      ${trendRows.length} points (12 months × 3 regions × 5 types)`);
    console.log(`     Disaster reports: 1`);
    console.log(`     Chat groups:     3`);
    console.log(`     Queries:         5 (all statuses)`);
    console.log(`     Notification logs: 8`);
}
main()
    .then(() => db.$disconnect())
    .catch(async (e) => {
    console.error("❌  Seed failed:", e);
    await db.$disconnect();
    process.exit(1);
});
