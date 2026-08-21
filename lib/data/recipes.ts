import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

const dec = (d: Prisma.Decimal | null) => (d == null ? null : Number(d).toString());

export interface RecipeStageVM {
  id: string;
  name: string;
  seq: number;
  output: string;
  outputId: string;
  outputQty: string;
  uom: string;
  subStages: { name: string; seq: number }[];
  bom: { bomId: string; material: string; materialId: string; qty: string; uom: string }[];
}

export interface RecipeVM {
  id: string;
  recipeId: string;
  version: number;
  status: string;
  product: string;
  productId: string;
  baseSize: string;
  uom: string;
  yieldPct: string | null;
  note: string | null;
  stageCount: number;
  bomCount: number;
  stages: RecipeStageVM[];
}

const fullInclude = {
  productMaterial: true,
  stages: {
    orderBy: { seq: "asc" as const },
    include: {
      subStages: { orderBy: { seq: "asc" as const } },
      bomLines: { orderBy: { bomId: "asc" as const }, include: { material: true } },
    },
  },
};

type FullRecipe = Prisma.RecipeGetPayload<{ include: typeof fullInclude }>;

function toRecipeVM(r: FullRecipe): RecipeVM {
  return {
    id: r.id,
    recipeId: r.recipeId,
    version: r.version,
    status: r.status,
    product: r.productMaterial.name,
    productId: r.productMaterial.materialId,
    baseSize: dec(r.baseSize)!,
    uom: r.uom,
    yieldPct: dec(r.yieldPct),
    note: r.note,
    stageCount: r.stages.length,
    bomCount: r.stages.reduce((a, s) => a + s.bomLines.length, 0),
    stages: r.stages.map((s) => ({
      id: s.id,
      name: s.name,
      seq: s.seq,
      output: s.outputMaterial.name,
      outputId: s.outputMaterial.materialId,
      outputQty: dec(s.outputQty)!,
      uom: s.uom,
      subStages: s.subStages.map((ss) => ({ name: ss.name, seq: ss.seq })),
      bom: s.bomLines.map((b) => ({
        bomId: b.bomId,
        material: b.material.name,
        materialId: b.material.materialId,
        qty: dec(b.quantity)!,
        uom: b.uom,
      })),
    })),
  };
}

export async function getRecipes(): Promise<RecipeVM[]> {
  const rows = await prisma.recipe.findMany({ include: fullInclude, orderBy: { createdAt: "desc" } });
  return rows.map(toRecipeVM);
}

export async function getRecipe(recipeId: string): Promise<RecipeVM | null> {
  const row = await prisma.recipe.findUnique({ where: { recipeId }, include: fullInclude });
  return row ? toRecipeVM(row) : null;
}

// Approved recipes for a given product — the wizard's recipe picker.
export async function getRecipesForProduct(productMaterialId: string): Promise<RecipeVM[]> {
  const rows = await prisma.recipe.findMany({
    where: { productMaterialId, status: "APPROVED" },
    include: fullInclude,
    orderBy: { version: "desc" },
  });
  return rows.map(toRecipeVM);
}
