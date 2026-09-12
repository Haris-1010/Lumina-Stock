import { config } from "dotenv";
config({ path: ".env.local", override: true });
config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const email = (getArg("--email") || process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
  const password = getArg("--password") || process.env.ADMIN_PASSWORD || "AdminPassword123!";
  const name = getArg("--name") || process.env.ADMIN_NAME || "Store Owner";
  const orgName = getArg("--org") || process.env.ORG_NAME || "My Store";

  console.log(`\n📦 Creating/Updating Admin User: ${email} for Store: ${orgName}...`);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`⚠️ User ${email} already exists. Updating password...`);
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: "OWNER" },
    });
    console.log(`✅ Password updated successfully!`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: OWNER\n`);
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      currencyCode: "PKR",
      subscriptionStatus: "PRO",
      onboardingComplete: true,
      businessType: "BOTH",
      activeMode: "RETAIL",
      storefrontEnabled: true,
    },
  });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "OWNER",
      organizationId: org.id,
    },
  });

  console.log(`✅ Admin user & organization created successfully!`);
  console.log(`   Store: ${orgName}`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role: OWNER\n`);
}

main()
  .catch((e) => {
    console.error("❌ Failed to create admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
