import { getMaterials } from "@/lib/data/materials";
import { MaterialsTable } from "@/components/materials/MaterialsTable";
import { PageIntro } from "@/components/ui/PageIntro";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const materials = await getMaterials();
  return (
    <div className="mx-auto max-w-[1080px]">
      <PageIntro>
        Item master. Each material syncs to Batchline via{" "}
        <code className="font-mono text-[12px] text-amber-ink">/api/v1/material/create</code> — every create
        and status change is logged as an outbound message.
      </PageIntro>
      <MaterialsTable materials={materials} />
    </div>
  );
}
