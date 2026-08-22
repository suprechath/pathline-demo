import { getMaterials, getLastMaterialSync } from "@/lib/data/materials";
import { MaterialsTable } from "@/components/materials/MaterialsTable";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const [materials, lastSync] = await Promise.all([
    getMaterials(),
    getLastMaterialSync(),
  ]);

  return (
    <div className="mx-auto max-w-[1080px]">
      <MaterialsTable materials={materials} lastSync={lastSync} />
    </div>
  );
}
