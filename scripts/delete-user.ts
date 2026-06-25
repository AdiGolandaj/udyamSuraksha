/**
 * Deletes all data for a single user by UUID.
 *
 * Usage:
 *   npx tsx scripts/delete-user.ts <user-uuid>
 *
 * Handles non-cascading FK relations manually before deleting the user.
 * Relations that DO cascade (ShopProfile, EmergencyContact, AlertRecipient,
 * ChatGroupMember, NotificationLog, LRDBOfficer and all their children) are
 * handled automatically by Prisma / MySQL when the User row is deleted.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error("Usage: npx tsx scripts/delete-user.ts <user-uuid>");
    process.exit(1);
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      shopProfile: { select: { id: true, shopName: true } },
      lrdbOfficer: { select: { designation: true } },
    },
  });

  if (!user) {
    console.error(`No user found with id: ${userId}`);
    process.exit(1);
  }

  console.log(`\nDeleting user: ${user.name} <${user.email}> [${user.role}]`);
  if (user.shopProfile) {
    console.log(`  Shop: ${user.shopProfile.shopName} (${user.shopProfile.id})`);
  }
  if (user.lrdbOfficer) {
    console.log(`  Officer: ${user.lrdbOfficer.designation}`);
  }
  console.log();

  // ── Step 1: Null out nullable FK references pointing at this user ────────────
  // These fields have no onDelete and are optional, so we clear them first.

  const nulledAssignments = await db.query.updateMany({
    where: { assignedToUserId: userId },
    data: { assignedToUserId: null },
  });
  if (nulledAssignments.count > 0) {
    console.log(`  Cleared assignedToUserId on ${nulledAssignments.count} query(ies)`);
  }

  const nulledReports = await db.disasterReport.updateMany({
    where: { publishedByUserId: userId },
    data: { publishedByUserId: null },
  });
  if (nulledReports.count > 0) {
    console.log(`  Cleared publishedByUserId on ${nulledReports.count} disaster report(s)`);
  }

  // ── Step 2: Collect query IDs tied to this user or their shop(s) ─────────────

  const shopIds = user.shopProfile ? [user.shopProfile.id] : [];

  const relatedQueries = await db.query.findMany({
    where: {
      OR: [
        { submittedByUserId: userId },
        ...(shopIds.length > 0 ? [{ shopProfileId: { in: shopIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const queryIds = relatedQueries.map((q) => q.id);

  // ── Step 3: Delete QueryStatusHistory (no cascade from Query or User) ────────

  if (queryIds.length > 0 || true) {
    const deletedHistory = await db.queryStatusHistory.deleteMany({
      where: {
        OR: [
          ...(queryIds.length > 0 ? [{ queryId: { in: queryIds } }] : []),
          { changedBy: userId },
        ],
      },
    });
    if (deletedHistory.count > 0) {
      console.log(`  Deleted ${deletedHistory.count} query status history record(s)`);
    }
  }

  // ── Step 4: Delete AffectedShopReport (no cascade from ShopProfile) ──────────

  if (shopIds.length > 0) {
    const deletedShopReports = await db.affectedShopReport.deleteMany({
      where: { shopProfileId: { in: shopIds } },
    });
    if (deletedShopReports.count > 0) {
      console.log(`  Deleted ${deletedShopReports.count} affected shop report(s)`);
    }
  }

  // ── Step 5: Delete Queries (no cascade from ShopProfile or User) ─────────────

  if (queryIds.length > 0) {
    const deletedQueries = await db.query.deleteMany({
      where: { id: { in: queryIds } },
    });
    console.log(`  Deleted ${deletedQueries.count} query(ies)`);
  }

  // ── Step 6: Delete User (cascades everything else) ───────────────────────────
  // Cascade chain:
  //   User → ShopProfile → LocationProfile, StockItem (→StockSensitivity),
  //           BCPPlan (→BCPStep), RiskProfile (→RiskSuggestion),
  //           ForecastScenario (→ForecastAffectedItem)
  //   User → EmergencyContact
  //   User → AlertRecipient → AlertActionResult
  //   User → NotificationLog
  //   User → ChatGroupMember
  //   User → LRDBOfficer

  await db.user.delete({ where: { id: userId } });
  console.log(`\n✓ User ${user.name} (${userId}) and all associated data deleted.\n`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("\n✗ Deletion failed:", e.message);
    await db.$disconnect();
    process.exit(1);
  });
