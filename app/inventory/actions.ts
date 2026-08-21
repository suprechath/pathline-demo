"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { lotSchema } from "@/lib/domain/validation";
import { getLotLedger, type LotLedgerVM } from "@/lib/data/movements";
import type { ActionResult } from "@/app/materials/actions";

export async function fetchLedger(lotId: string): Promise<LotLedgerVM | null> {
  return getLotLedger(lotId);
}

export async function receiveLot(form: FormData): Promise<ActionResult> {
  const parsed = lotSchema.safeParse({
    lotId: form.get("lotId"),
    materialId: form.get("materialId"),
    quantity: form.get("quantity"),
    location: form.get("location") || undefined,
    expiry: form.get("expiry") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid lot", system: "pathline" };
  }
  const { lotId, materialId, quantity, location, expiry } = parsed.data;

  const material = await prisma.material.findUnique({ where: { materialId } });
  if (!material) return { ok: false, message: "Unknown material", system: "pathline" };

  try {
    const lot = await prisma.lot.create({
      data: {
        lotId, materialId: material.id, quantity,
        uom: material.uom, // inherited from material
        location: location ?? null,
        expiry: expiry ? new Date(expiry) : null,
        status: "IN_STOCK",
      },
    });
    revalidatePath("/inventory");
    return { ok: true, message: `Received ${lot.lotId} (${quantity} ${material.uom})`, system: "pathline" };
  } catch (e) {
    const dup = e instanceof Error && e.message.includes("Unique");
    return { ok: false, message: dup ? "Lot ID already exists" : "Failed to receive lot", system: "pathline" };
  }
}

const REASON_MAP: Record<string, "SALE_DISPATCH" | "QC_SAMPLE" | "SCRAP" | "REJECTION" | "ADJUSTMENT" | "QUARANTINE" | "QC_RELEASE"> = {
  "Sale / Dispatch": "SALE_DISPATCH", "QC sample": "QC_SAMPLE", "Scrap / Write-off": "SCRAP",
  "Rejection": "REJECTION", "Adjustment": "ADJUSTMENT", "Quarantine": "QUARANTINE", "QC release": "QC_RELEASE",
};

// Issue stock: writes a signed movement, recomputes on-hand, and flips status.
// Rejection/Quarantine issue the entire on-hand; QC release returns the full
// quarantined amount.
export async function issueStock(input: { lotId: string; reason: string; qty: number; note: string }): Promise<ActionResult> {
  const lot = await prisma.lot.findUnique({ where: { lotId: input.lotId }, include: { movements: true } });
  if (!lot) return { ok: false, message: "Lot not found", system: "pathline" };

  const reason = REASON_MAP[input.reason];
  if (!reason) return { ok: false, message: "Unknown reason", system: "pathline" };

  const onHand = lot.movements.reduce((s, m) => (m.reason === "RESERVE" || m.reason === "RELEASE" ? s : s + Number(m.quantity)), 0);
  const quarantined = lot.movements.reduce((s, m) => s + (m.reason === "QUARANTINE" ? Number(m.quantity) : m.reason === "QC_RELEASE" ? -Number(m.quantity) : 0), 0);

  let signed: number;
  if (reason === "QC_RELEASE") { signed = quarantined; if (signed <= 0) return { ok: false, message: "Nothing quarantined", system: "pathline" }; }
  else if (reason === "REJECTION" || reason === "QUARANTINE") { signed = -onHand; if (onHand <= 0) return { ok: false, message: "No stock on hand", system: "pathline" }; }
  else { const q = input.qty; if (q <= 0 || q > onHand) return { ok: false, message: "Quantity exceeds on hand", system: "pathline" }; signed = -q; }

  // QUARANTINE/QC_RELEASE are recorded as their own reasons but don't change
  // physical on-hand; treat them as signed magnitudes for the ledger.
  const isHold = reason === "QUARANTINE" || reason === "QC_RELEASE";
  await prisma.stockMovement.create({
    data: { lotId: lot.id, reason, quantity: isHold ? Math.abs(signed) : signed, note: input.note || null, user: "operator" },
  });

  const newOnHand = isHold ? onHand : onHand + signed;
  const status = reason === "REJECTION" ? "REJECTED" : reason === "QUARANTINE" ? "QUARANTINE" : reason === "QC_RELEASE" ? "IN_STOCK" : newOnHand <= 0 ? "CONSUMED" : lot.status;
  await prisma.lot.update({ where: { id: lot.id }, data: { quantity: newOnHand, status } });

  revalidatePath("/inventory");
  return { ok: true, message: `${input.reason} on ${lot.lotId}`, system: "pathline" };
}
