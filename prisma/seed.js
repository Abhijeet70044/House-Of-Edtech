const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@stockpilot.dev" },
    update: {},
    create: {
      email: "demo@stockpilot.dev",
      name: "Demo Manager",
      passwordHash,
      role: "ADMIN",
    },
  });

  const baseItems = [
    {
      name: "Thermal Label Rolls",
      sku: "LBL-THERM-100",
      quantity: 120,
      category: "Supplies",
      location: "Aisle 1",
      minStock: 50,
      notes: "4x6 rolls",
      status: "ACTIVE",
    },
    {
      name: "USB Barcode Scanner",
      sku: "SCN-USB-200",
      quantity: 22,
      category: "Hardware",
      location: "Aisle 3",
      minStock: 10,
      notes: "Plug-and-play",
      status: "ACTIVE",
    },
    {
      name: "Thermal Printer",
      sku: "PRT-THERM-500",
      quantity: 8,
      category: "Hardware",
      location: "Backroom",
      minStock: 5,
      notes: "Requires 4x6 labels",
      status: "ACTIVE",
    },
  ];

  for (const item of baseItems) {
    await prisma.item.upsert({
      where: {
        ownerId_sku: {
          ownerId: user.id,
          sku: item.sku,
        },
      },
      update: item,
      create: {
        ...item,
        ownerId: user.id,
      },
    });
  }

  console.log("Seeded demo user demo@stockpilot.dev / demo1234 with inventory.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

