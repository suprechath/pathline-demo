import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

const num = (d: Prisma.Decimal) => Number(d);
export interface MovementVM {
  id: string;
  reason: string;
  quantity: number; // signed
  note: string | null;
  user: string | null;
  at: string;
  balance: number; // running on-hand after this movement
}

export interface LotLedgerVM {
  lotId: string;
  incoming: number; // sum of positive on-hand movements
  issued: number; // sum of negative on-hand movements (as a positive number)
  onHand: number; // derived physical balance
  reserved: number; // open commitments (Σ RESERVE − Σ RELEASE)
  available: number; // onHand − reserved
  movements: MovementVM[];
}

const REASON_LABEL: Record<string, string> = {
  RECEIPT: "Goods receipt",
  SALE_DISPATCH: "Sale / Dispatch",
  QC_SAMPLE: "QC sample",
  SCRAP: "Scrap / Write-off",
  REJECTION: "Rejection",
  ADJUSTMENT: "Adjustment",
  QUARANTINE: "Quarantine",
  QC_RELEASE: "QC release",
  RESERVE: "Reserved for order",
  RELEASE: "Reservation released",
  ISSUE_TO_ORDER: "Issued to order",
};

// The lot's full movement ledger with a running balance. On-hand is derived
// here (Σ movements), never read from a stored column.
export async function getLotLedger(lotId: string): Promise<LotLedgerVM | null> {
  const lot = await prisma.lot.findUnique({
    where: { lotId },
    include: { movements: { orderBy: { createdAt: "asc" } } },
  });
  if (!lot) return null;

  let balance = 0;
  let incoming = 0;
  let issued = 0;
  let reserved = 0;
  const movements: MovementVM[] = lot.movements.map((m) => {
    const q = num(m.quantity);
    if (m.reason === "RESERVE") reserved += q;
    else if (m.reason === "RELEASE") reserved -= Math.abs(q);
    else {
      balance += q;
      if (q > 0) incoming += q;
      else issued += -q;
    }
    return {
      id: m.id,
      reason: REASON_LABEL[m.reason] ?? m.reason,
      quantity: q,
      note: m.note,
      user: m.user,
      at: m.createdAt.toISOString().slice(0, 10),
      balance,
    };
  });

  const reservedClamped = Math.max(0, reserved);
  return { lotId: lot.lotId, incoming, issued, onHand: balance, reserved: reservedClamped, available: Math.max(0, balance - reservedClamped), movements };
}
