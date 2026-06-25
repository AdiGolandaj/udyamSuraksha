import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      shopProfile: { select: { shopName: true, district: true } },
      lrdbOfficer: { select: { designation: true, district: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (users.length === 0) {
    console.log("No users found.");
    return;
  }

  console.log(`\nRegistered users (${users.length} total)\n`);
  console.log(
    "UUID".padEnd(38) +
    "Name".padEnd(22) +
    "Email".padEnd(38) +
    "Role".padEnd(8) +
    "Detail"
  );
  console.log("─".repeat(130));

  for (const u of users) {
    const detail =
      u.role === "MSME"
        ? u.shopProfile
          ? `${u.shopProfile.shopName} (${u.shopProfile.district})`
          : "(no shop profile)"
        : u.lrdbOfficer
        ? `${u.lrdbOfficer.designation} — ${u.lrdbOfficer.district}`
        : "(no officer profile)";

    console.log(
      u.id.padEnd(38) +
      u.name.slice(0, 20).padEnd(22) +
      u.email.slice(0, 36).padEnd(38) +
      u.role.padEnd(8) +
      detail
    );
  }

  console.log();
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("Error:", e.message);
    await db.$disconnect();
    process.exit(1);
  });
