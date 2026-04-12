import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.adminUser.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Default Admin",
      role: "admin"
    }
  });

  await prisma.eventSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      capacity: 40,
      checkinRadiusM: 100,
      drinkCooldownSec: 600,
      drinkMaxPerUser: 10
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
