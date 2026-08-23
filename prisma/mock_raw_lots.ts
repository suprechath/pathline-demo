import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const D = (n: number | string) => new Prisma.Decimal(n);

async function main() {
  console.log("Mocking 3 lots each for RAW-MAT-01 and RAW-MAT-02...");

  // 1. Ensure Materials exist
  const m1 = await prisma.material.upsert({
    where: { materialId: "RAW-MAT-01" },
    update: { active: true },
    create: {
      materialId: "RAW-MAT-01",
      name: "Raw Material 01",
      type: "RAW",
      uom: "kg",
      shelfLife: 0,
      active: true,
    },
  });

  const m2 = await prisma.material.upsert({
    where: { materialId: "RAW-MAT-02" },
    update: { active: true },
    create: {
      materialId: "RAW-MAT-02",
      name: "Raw Material 02",
      type: "RAW",
      uom: "kg",
      shelfLife: 0,
      active: true,
    },
  });

  // 2. Define 3 lots for RAW-MAT-01 and 3 lots for RAW-MAT-02
  const mockLots = [
    // RAW-MAT-01 lots
    {
      lotId: "LOT-RM01-101",
      materialId: m1.id,
      quantity: 500,
      uom: "kg",
      location: "WH-A / R01",
      expiry: new Date("2027-04-15"),
      status: "IN_STOCK" as const,
      grn: "GRN-9101",
    },
    {
      lotId: "LOT-RM01-102",
      materialId: m1.id,
      quantity: 350,
      uom: "kg",
      location: "WH-A / R02",
      expiry: new Date("2027-08-20"),
      status: "IN_STOCK" as const,
      grn: "GRN-9102",
    },
    {
      lotId: "LOT-RM01-103",
      materialId: m1.id,
      quantity: 750,
      uom: "kg",
      location: "WH-A / R03",
      expiry: new Date("2028-01-10"),
      status: "IN_STOCK" as const,
      grn: "GRN-9103",
    },
    // RAW-MAT-02 lots
    {
      lotId: "LOT-RM02-201",
      materialId: m2.id,
      quantity: 420,
      uom: "kg",
      location: "WH-B / R04",
      expiry: new Date("2027-03-30"),
      status: "IN_STOCK" as const,
      grn: "GRN-9201",
    },
    {
      lotId: "LOT-RM02-202",
      materialId: m2.id,
      quantity: 680,
      uom: "kg",
      location: "WH-B / R05",
      expiry: new Date("2027-09-15"),
      status: "IN_STOCK" as const,
      grn: "GRN-9202",
    },
    {
      lotId: "LOT-RM02-203",
      materialId: m2.id,
      quantity: 300,
      uom: "kg",
      location: "WH-B / R06",
      expiry: new Date("2027-12-05"),
      status: "IN_STOCK" as const,
      grn: "GRN-9203",
    },
  ];

  for (const l of mockLots) {
    const existing = await prisma.lot.findUnique({ where: { lotId: l.lotId } });
    if (existing) {
      await prisma.lot.update({
        where: { id: existing.id },
        data: {
          quantity: D(l.quantity),
          location: l.location,
          expiry: l.expiry,
          status: l.status,
        },
      });
      console.log(`Updated lot ${l.lotId}`);
    } else {
      await prisma.lot.create({
        data: {
          lotId: l.lotId,
          materialId: l.materialId,
          quantity: D(l.quantity),
          uom: l.uom,
          location: l.location,
          expiry: l.expiry,
          status: l.status,
          movements: {
            create: [
              {
                reason: "RECEIPT",
                quantity: D(l.quantity),
                note: l.grn,
                user: "R. Vance",
              },
            ],
          },
        },
      });
      console.log(`Created lot ${l.lotId}`);
    }
  }

  console.log("Finished mocking lots.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
