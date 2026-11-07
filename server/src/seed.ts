import { prisma } from "./db";
import { hashPassword } from "./lib/tokens";
import { seedCatalog } from "./seedCatalog";

/**
 * Seed — NO mock tenants.
 *
 * This seed intentionally does NOT create any demo institutions, labs, services,
 * experts, buyers or orders. Real providers, instruments and services are
 * onboarded through the application. It only bootstraps what a fresh platform
 * genuinely needs:
 *   1. the platform-fee singleton,
 *   2. one platform SUPER_ADMIN so you can sign in and configure the platform,
 *   3. the platform-owned industry / test / package catalog (provider links are
 *      created for whatever real Services exist at seed time).
 *
 * The bootstrap admin password must be provided through the environment.
 */

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "super@rix.local";

function getInitialSuperAdminPassword(): string {
  const password = process.env.SUPERADMIN_INITIAL_PASSWORD;
  if (!password) throw new Error("[seed] SUPERADMIN_INITIAL_PASSWORD is required.");
  return password;
}
const SUPERADMIN_INITIAL_PASSWORD = getInitialSuperAdminPassword();

async function main() {
  // 1. Platform fee singleton — global MARKUP_PERCENT 12% (create-only; never clobbers admin config).
  await prisma.platformSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", feeMode: "MARKUP_PERCENT", feeValue: 12 },
  });

  // 2. Platform SUPER_ADMIN bootstrap (not a tenant). Idempotent; never overwrites an edited account.
  const passwordHash = await hashPassword(SUPERADMIN_INITIAL_PASSWORD);
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      email: SUPER_ADMIN_EMAIL,
      name: "Platform Super Admin",
      role: "SUPER_ADMIN",
      passwordHash,
      institutionId: null,
    },
  });

  // 3. Industry / test / package catalog (platform-owned content).
  await seedCatalog();

  // eslint-disable-next-line no-console
  console.log("\n=== ITRO seed complete (catalog only - no mock tenants) ===");
  // eslint-disable-next-line no-console
  console.log(`Platform super admin: ${SUPER_ADMIN_EMAIL}\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
