import { getMaterials } from "@/lib/data/materials";
import { MaterialsTable } from "@/components/materials/MaterialsTable";
import SyncButtonWrapper from "@/components/materials/SyncButtonWrapper";
import { PageIntro } from "@/components/ui/PageIntro";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const materials = await getMaterials();
  return (
    <div className="mx-1 border">
      <div className="mb-4 flex items-center justify-between gap-4">
        <PageIntro>
          Each material syncs to Batchline via{" "}
          <code className="font-bold text-[13px] text-amber-ink">/api/v1/material/create</code> for every create
        </PageIntro>
        <SyncButtonWrapper />
      </div>
      <MaterialsTable materials={materials} />

    </div>
  );
}
