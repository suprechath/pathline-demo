import type { OrderVM } from "@/lib/domain/types";
import type { MaterialVM } from "@/lib/domain/types";
import type { ProcessOrderPayload, MaterialPayload } from "./types";

// Builds the process -> stage -> BOM -> lot JSON Batchline receives.
export function buildOrderPayload(o: OrderVM): ProcessOrderPayload {
  return {
    process_number: o.orderNo,
    product_spec: o.productId,
    batch_id: o.batchId ?? "(assigned on send)",
    message_mode: "RECIPE_WITH_LOTS",
    size: { value: o.size, uom: o.uom },
    plan: { start: o.planStart, end: o.planEnd },
    stages: [
      {
        name: o.stageName,
        target_material: o.productId,
        target_size: o.size,
        bom: o.bom.map((b) => ({
          variable: b.bomId,
          material: b.materialId,
          required: { value: b.required, uom: b.uom },
          lots: b.lots.map((l) => ({ lot_id: l.lotId, quantity: l.quantity })),
        })),
      },
    ],
  };
}

export function buildMaterialPayload(m: MaterialVM): MaterialPayload {
  return {
    material_id: m.materialId,
    name: m.name,
    type: m.type,
    uom: m.uom,
    shelf_life: { value: m.shelfLife, uom: m.shelfLifeUom },
    active: m.active,
  };
}
