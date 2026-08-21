import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data/recipes";
import { getAssignableMaterials } from "@/lib/data/materials";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";

export const dynamic = "force-dynamic";

export default async function RecipeDrillDown({ params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await params;
  const [recipe, materials] = await Promise.all([getRecipe(recipeId), getAssignableMaterials()]);
  if (!recipe) notFound();
  return <RecipeDetail recipe={recipe} materials={materials} />;
}
