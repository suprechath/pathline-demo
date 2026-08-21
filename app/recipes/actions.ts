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
