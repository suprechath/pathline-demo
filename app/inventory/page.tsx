import { getLots } from "@/lib/data/lots";
import { getAssignableMaterials } from "@/lib/data/materials";
import { LotsTable } from "@/components/inventory/LotsTable";
import { PageIntro } from "@/components/ui/PageIntro";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [lots, materials] = await Promise.all([getLots(), getAssignableMaterials()]);
  return (
    <div className="mx-auto max-w-[1080px]">
      <PageIntro>
        Physical stock. Expired lots are flagged and cannot be assigned to an order. UOM is inherited
        from the material, never stored on the lot.
      </PageIntro>
      <LotsTable lots={lots} materials={materials} />
    </div>
  );
}
