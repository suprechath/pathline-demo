import { getRecipes } from "@/lib/data/recipes";
import { getAssignableMaterials } from "@/lib/data/materials";
import { RecipesTable } from "@/components/recipes/RecipesTable";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const [recipes, materials] = await Promise.all([getRecipes(), getAssignableMaterials()]);
  return (
    <div className="mx-auto max-w-[1080px]">
      <RecipesTable recipes={recipes} materials={materials} />
    </div>
  );
}

