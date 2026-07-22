import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Tenant",
      slug: "default",
      roles: {
        create: [
          { name: "owner", description: "Tenant owner" },
          { name: "admin", description: "Chat administrator" },
          { name: "moderator", description: "Community moderator" },
        ],
      },
      flags: {
        create: [{ key: "core.enabled", enabled: true }],
      },
      modules: {
        create: [{ moduleKey: "core", status: "enabled", version: "0.1.0" }],
      },
    },
  });

  const moduleState = await prisma.moduleState.findFirst({
    where: {
      tenantId: tenant.id,
      chatId: null,
      moduleKey: "core",
    },
  });

  if (moduleState) {
    await prisma.moduleState.update({
      where: {
        id: moduleState.id,
      },
      data: {
        status: "enabled",
      },
    });
  } else {
    await prisma.moduleState.create({
      data: {
        tenantId: tenant.id,
        chatId: null,
        moduleKey: "core",
        status: "enabled",
        version: "0.1.0",
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
