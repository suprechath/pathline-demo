// Prisma row -> view model. This is where the 3NF-removed fields are
// re-derived so the UI receives flat data while the DB stays normalized:
//   - `sent`     from ProcessOrder.status
//   - per-line `uom` from the line's Material
//   - `expired`  from Lot.expiry
import type { Prisma, Lot, Material, ExecutionEvent } from "@prisma/client";
import type { MaterialVM, LotVM, OrderVM, BomLineVM, EventVM } from "./types";

const dec = (d: Prisma.Decimal | null | undefined) =>
  d == null ? null : Number(d).toString();

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? 0 : Number(d));

export function shelfLifeLabel(m: Pick<Material, "type" | "shelfLife" | "shelfLifeUom">) {
  if (m.type === "RAW") return "—";
  return `${m.shelfLife} ${m.shelfLifeUom.toLowerCase()}`;
}

export function toMaterialVM(m: Material): MaterialVM {
  return {
    id: m.id,
    materialId: m.materialId,
    name: m.name,
    type: m.type,
    uom: m.uom,
    shelfLife: m.shelfLife,
    shelfLifeUom: m.shelfLifeUom,
    shelfLifeLabel: shelfLifeLabel(m),
    active: m.active,
  };
}

export function toLotVM(l: Lot & { material: Material; movements?: Prisma.StockMovementGetPayload<object>[] }): LotVM {
  const expired = l.status === "EXPIRED" || (!!l.expiry && l.expiry.getTime() < Date.now());
  let availableQty = Number(l.quantity);
  if (l.movements && l.movements.length > 0) {
    const onHand = l.movements.reduce((s, m) => (m.reason === "RESERVE" || m.reason === "RELEASE" ? s : s + Number(m.quantity)), 0);
    const reserved = l.movements.reduce((s, m) => s + (m.reason === "RESERVE" ? Number(m.quantity) : m.reason === "RELEASE" ? -Math.abs(Number(m.quantity)) : 0), 0);
    availableQty = Math.max(0, onHand - Math.max(0, reserved));
  }
  return {
    id: l.id,
    lotId: l.lotId,
    material: l.material.name,
    materialId: l.material.materialId,
    quantity: dec(l.quantity)!,
    uom: l.material.uom, // inherited, not stored on the lot
    location: l.location,
    expiry: l.expiry ? l.expiry.toISOString().slice(0, 10) : null,
    expired,
    status: expired ? "EXPIRED" : l.status,
    assignable: !expired && (l.status === "IN_STOCK" || l.status === "RESERVED") && availableQty > 0,
  };
}

type FullOrder = Prisma.ProcessOrderGetPayload<{
  include: {
    productMaterial: true;
    recipe: true;
    stages: {
      include: {
        bomLines: { include: { material: true; assignments: { include: { lot: true } } } };
      };
    };
  };
}>;

export function toOrderVM(o: FullOrder): OrderVM {
  const stage = o.stages[0];
  const bom: BomLineVM[] = (stage?.bomLines ?? []).map((b) => {
    const assigned = b.assignments.reduce((s, a) => s + num(a.quantity), 0);
    const required = num(b.quantity);
    return {
      id: b.id,
      bomId: b.bomId,
      material: b.material.name,
      materialId: b.material.materialId,
      required: dec(b.quantity)!,
      uom: b.material.uom, // read from material
      assigned,
      balanced: Math.abs(assigned - required) < 1e-6,
      lots: b.assignments.map((a) => ({ lotId: a.lot.lotId, quantity: dec(a.quantity)! })),
    };
  });

  const yieldPlan = num(o.yieldPlan);
  const yieldActual = num(o.yieldActual);
  const yieldPct = yieldPlan > 0 && o.yieldActual != null
    ? Math.round((yieldActual / yieldPlan) * 1000) / 10
    : null;

  return {
    id: o.id,
    orderNo: o.orderNo,
    batchId: o.batchId,
    product: o.productMaterial.name,
    productId: o.productMaterial.materialId,
    size: dec(o.size)!,
    uom: o.uom,
    planStart: o.planStart.toISOString().slice(0, 10),
    planEnd: o.planEnd.toISOString().slice(0, 10),
    status: o.status,
    sent: o.status !== "DRAFT", // derived
    erpRecipeId: o.erpRecipeId ?? o.recipe?.recipeId ?? null,
    stageName: stage?.name ?? "—",
    fullyAssigned: bom.length > 0 && bom.every((b) => b.balanced),
    readyToSend: o.readyToSend,
    yieldPlan: dec(o.yieldPlan),
    yieldActual: dec(o.yieldActual),
    yieldPct,
    bom,
  };
}

export function toEventVM(e: ExecutionEvent): EventVM {
  return {
    id: e.id,
    seq: e.seq,
    kind: e.kind,
    title: e.title,
    detail: e.detail,
    wireNote: e.wireNote,
    actualValue: e.actualValue,
    targetValue: e.targetValue,
    uom: e.uom,
    lotRef: e.lotRef,
    hasException: e.hasException,
    exceptionLevel: e.exceptionLevel,
    batchStatus: e.batchStatus,
  };
}
