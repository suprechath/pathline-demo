import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const D = (n: number | string) => new Prisma.Decimal(n);

async function main() {
  console.log("Seeding inventory lots for all materials...");

  const materials = await prisma.material.findMany();
  for (const m of materials) {
    if (m.type === "PRODUCT") continue; // raw & intermediates get lots

    // Check if lot already exists for this material
    const existingCount = await prisma.lot.count({ where: { materialId: m.id } });
    if (existingCount === 0) {
      const lotCode = `LOT-${m.materialId.slice(0, 8)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const qty = m.uom === "ea" ? 1000000 : 850;
      await prisma.lot.create({
        data: {
          lotId: lotCode,
          materialId: m.id,
          quantity: D(qty),
          uom: m.uom,
          location: `WH-${m.type === "RAW" ? "A" : "B"} / R0${Math.floor(1 + Math.random() * 9)}`,
          expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2), // 2 years in future
          status: "IN_STOCK",
          movements: {
            create: [
              { reason: "RECEIPT", quantity: D(qty), note: `GRN-${Math.floor(8000 + Math.random() * 1000)}`, user: "R. Vance" },
            ],
          },
        },
      });
      console.log(`Created lot ${lotCode} for ${m.name}`);
    }
  }

  const totalLots = await prisma.lot.count();
  console.log(`Total lots in DB: ${totalLots}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
