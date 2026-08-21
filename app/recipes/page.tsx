import { getRecipes } from "@/lib/data/recipes";
import { getAssignableMaterials } from "@/lib/data/materials";
import { RecipesTable } from "@/components/recipes/RecipesTable";
import { PageIntro } from "@/components/ui/PageIntro";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const [recipes, materials] = await Promise.all([getRecipes(), getAssignableMaterials()]);
  return (
    <div className="mx-auto max-w-[1080px]">
      <PageIntro>
        Master recipes. A recipe defines the stage → output → BOM mapping for a product. Orders
        instantiate an approved recipe rather than defining stages by hand, so planners can&apos;t
        mis-map a stage.
      </PageIntro>
      <RecipesTable recipes={recipes} materials={materials} />
    </div>
  );
}
