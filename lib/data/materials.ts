import "server-only";
import { prisma } from "@/lib/db/prisma";
import { toMaterialVM } from "@/lib/domain/mappers";
import type { MaterialVM } from "@/lib/domain/types";

export async function getMaterials(): Promise<MaterialVM[]> {
  const rows = await prisma.material.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toMaterialVM);
}

export async function getAssignableMaterials(): Promise<MaterialVM[]> {
  const rows = await prisma.material.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return rows.map(toMaterialVM);
}
