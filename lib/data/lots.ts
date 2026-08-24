import "server-only";
import { prisma } from "@/lib/db/prisma";
import { toLotVM } from "@/lib/domain/mappers";
import type { LotVM } from "@/lib/domain/types";

export async function getLots(): Promise<LotVM[]> {
  const rows = await prisma.lot.findMany({
    include: { material: true, movements: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toLotVM);
}
