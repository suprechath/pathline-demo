import { getLots } from "@/lib/data/lots";
import { getAssignableMaterials } from "@/lib/data/materials";
import { LotsTable } from "@/components/inventory/LotsTable";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [lots, materials] = await Promise.all([getLots(), getAssignableMaterials()]);
  return (
    <div className="mx-auto max-w-[1080px]">
      <LotsTable lots={lots} materials={materials} />
    </div>
  );
}

