"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { ActionResult } from "@/app/materials/actions";

interface RecipeHeaderInput {
  recipeId: string;
  productMaterialId: string;
  baseSize: number;
  yieldPct: number;
  note: string;
}

export async function createRecipe(input: RecipeHeaderInput): Promise<ActionResult & { recipeId?: string }> {
  if (!input.recipeId) return { ok: false, message: "Recipe ID is required", system: "pathline" };
  const product = await prisma.material.findUnique({ where: { materialId: input.productMaterialId } });
  if (!product || (product.type !== "PRODUCT" && product.type !== "INTERMEDIATE")) {
    return { ok: false, message: "Product must be a Product/Intermediate", system: "pathline" };
  }
  try {
    const rec = await prisma.recipe.create({
      data: {
        recipeId: input.recipeId, version: 1, status: "DRAFT",
        baseSize: input.baseSize, uom: product.uom, yieldPct: input.yieldPct, note: input.note || null,
        productMaterialId: product.id,
        stages: {
          create: { name: "Stage 1", seq: 1, outputQty: input.baseSize, uom: product.uom, outputMaterialId: product.id },
        },
      },
    });
    revalidatePath("/recipes");
    return { ok: true, message: `Created recipe ${rec.recipeId}`, system: "pathline", recipeId: rec.recipeId };
  } catch (e) {
    const dup = e instanceof Error && e.message.includes("Unique");
    return { ok: false, message: dup ? "Recipe ID already exists" : "Failed to create recipe", system: "pathline" };
  }
}

export async function updateRecipeHeader(input: RecipeHeaderInput): Promise<ActionResult> {
  const product = await prisma.material.findUnique({ where: { materialId: input.productMaterialId } });
  if (!product) return { ok: false, message: "Unknown product", system: "pathline" };
  await prisma.recipe.update({
    where: { recipeId: input.recipeId },
    data: { productMaterialId: product.id, baseSize: input.baseSize, uom: product.uom, yieldPct: input.yieldPct, note: input.note || null },
  });
  revalidatePath(`/recipes/${input.recipeId}`);
  revalidatePath("/recipes");
  return { ok: true, message: `Updated recipe ${input.recipeId}`, system: "pathline" };
}

export interface RecipeStageDesignInput {
  name: string;
  seq: number;
  outputMaterialId: string;
  outputQty: number;
  uom: string;
  subStages: { name: string; seq: number }[];
  bom: {
    bomId: string;
    materialId: string;
    qty: number;
    uom: string;
  }[];
}

export interface UpdateRecipeStagesInput {
  recipeId: string;
  stages: RecipeStageDesignInput[];
}

export async function updateRecipeStages(input: UpdateRecipeStagesInput): Promise<ActionResult> {
  const recipe = await prisma.recipe.findUnique({
    where: { recipeId: input.recipeId },
  });
  if (!recipe) return { ok: false, message: "Recipe not found", system: "pathline" };

  if (!input.stages || input.stages.length === 0) {
    return { ok: false, message: "A recipe must have at least 1 stage", system: "pathline" };
  }

  const allMaterials = await prisma.material.findMany();
  const matMap = new Map<string, (typeof allMaterials)[0]>();
  for (const m of allMaterials) {
    matMap.set(m.id, m);
    matMap.set(m.materialId, m);
    matMap.set(m.materialId.toLowerCase(), m);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.recipeStage.deleteMany({
        where: { recipeId: recipe.id },
      });

      for (const [sIndex, s] of input.stages.entries()) {
        const outMat = matMap.get(s.outputMaterialId) || matMap.get(s.outputMaterialId.toLowerCase());
        if (!outMat) {
          throw new Error(`Unknown output material: ${s.outputMaterialId}`);
        }

        await tx.recipeStage.create({
          data: {
            recipeId: recipe.id,
            name: s.name.trim() || `Stage ${sIndex + 1}`,
            seq: sIndex + 1,
            outputQty: Number(s.outputQty) || 0,
            uom: s.uom || outMat.uom,
            outputMaterialId: outMat.id,
            subStages: {
              create: (s.subStages || []).map((ss, ssIndex) => ({
                name: ss.name.trim() || `Step ${ssIndex + 1}`,
                seq: ssIndex + 1,
              })),
            },
            bomLines: {
              create: (s.bom || []).map((b, bIndex) => {
                const bMat = matMap.get(b.materialId) || matMap.get(b.materialId.toLowerCase());
                if (!bMat) {
                  throw new Error(`Unknown BOM material: ${b.materialId}`);
                }
                return {
                  bomId: b.bomId.trim() || `BOM-${sIndex + 1}-${bIndex + 1}`,
                  quantity: Number(b.qty) || 0,
                  uom: b.uom || bMat.uom,
                  materialId: bMat.id,
                };
              }),
            },
          },
        });
      }
    });

    revalidatePath(`/recipes/${input.recipeId}`);
    revalidatePath("/recipes");
    return { ok: true, message: `Updated stages for recipe ${input.recipeId}`, system: "pathline" };
  } catch (err) {
    console.error("Error updating recipe stages:", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to save stages",
      system: "pathline",
    };
  }
}

