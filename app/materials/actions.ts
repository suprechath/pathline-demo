"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { materialSchema } from "@/lib/domain/validation";
import { sendMaterial } from "@/lib/batchline/client";
import { buildMaterialPayload } from "@/lib/batchline/payloads";
import { toMaterialVM } from "@/lib/domain/mappers";

export interface ActionResult {
  ok: boolean;
  message: string;
  system?: "pathline" | "batchline";
}

export async function createMaterial(form: FormData): Promise<ActionResult> {
  const parsed = materialSchema.safeParse({
    materialId: form.get("materialId"),
    name: form.get("name"),
    type: form.get("type"),
    uom: form.get("uom"),
    shelfLife: form.get("shelfLife"),
    shelfLifeUom: form.get("shelfLifeUom"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid material", system: "pathline" };
  }
  const data = parsed.data;

  try {
    const created = await prisma.material.create({ data });
    const res = await sendMaterial(buildMaterialPayload(toMaterialVM(created)));
    await prisma.integrationMessage.create({
      data: {
        direction: "OUTBOUND", endpoint: res.endpoint, method: res.method,
        entityType: "material", entityRef: created.materialId,
        status: "DELIVERED", httpStatus: res.httpStatus,
        payload: buildMaterialPayload(toMaterialVM(created)) as object,
        response: res.response,
      },
    });
    revalidatePath("/materials");
    return { ok: true, message: `Synced ${created.materialId} → Batchline /material/create`, system: "batchline" };
  } catch (e) {
    const dup = e instanceof Error && e.message.includes("Unique");
    return { ok: false, message: dup ? "Material ID already exists" : "Failed to create material", system: "pathline" };
  }
}

export async function toggleActive(materialId: string, reason?: string): Promise<ActionResult> {
  const m = await prisma.material.findUnique({ where: { materialId } });
  if (!m) return { ok: false, message: "Material not found", system: "pathline" };

  const updated = await prisma.material.update({
    where: { materialId },
    data: { active: !m.active, reason: reason ?? null },
  });
  await prisma.integrationMessage.create({
    data: {
      direction: "OUTBOUND", endpoint: "/api/v1/material/update", method: "PUT",
      entityType: "material", entityRef: materialId, status: "DELIVERED", httpStatus: 200,
      payload: { material_id: materialId, active: updated.active } as object,
    },
  });
  revalidatePath("/materials");
  return {
    ok: true,
    message: `${updated.active ? "Activated" : "Deactivated"} ${materialId} → logged as sync`,
    system: "batchline",
  };
}
