// View models the UI consumes. Flat, serialisable, and free of the
// transitive fields the 3NF schema deliberately does not store
// (sent, per-line uom, expired) — those are derived in mappers.ts.
import type {
  MaterialType, ShelfLifeUom, LotStatus, OrderStatus, EventKind,
} from "@prisma/client";

export interface MaterialVM {
  id: string;
  materialId: string;
  name: string;
  type: MaterialType;
  uom: string;
  shelfLife: number;
  shelfLifeUom: ShelfLifeUom;
  shelfLifeLabel: string; // "—" for RAW, else "3 years"
  active: boolean;
}

export interface LotVM {
  id: string;
  lotId: string;
  material: string;
  materialId: string;
  quantity: string;
  uom: string; // inherited from material
  location: string | null;
  expiry: string | null;
  expired: boolean; // derived from expiry
  status: LotStatus;
  assignable: boolean;
}

export interface AssignmentVM {
  lotId: string;
  quantity: string;
}

export interface BomLineVM {
  id: string;
  bomId: string;
  material: string;
  materialId: string;
  required: string;
  uom: string; // read from material
  assigned: number;
  balanced: boolean;
  lots: AssignmentVM[];
}

export interface OrderVM {
  id: string;
  orderNo: string;
  batchId: string | null;
  product: string;
  productId: string;
  size: string;
  uom: string;
  planStart: string;
  planEnd: string;
  status: OrderStatus;
  sent: boolean; // derived from status
  stageName: string;
  fullyAssigned: boolean;
  readyToSend: boolean; // persisted flag, mirrors fullyAssigned
  yieldPlan: string | null;
  yieldActual: string | null;
  yieldPct: number | null;
  bom: BomLineVM[];
}

export interface EventVM {
  id: string;
  seq: number;
  kind: EventKind;
  title: string;
  detail: string | null;
  wireNote: string | null;
  actualValue: string | null;
  targetValue: string | null;
  uom: string | null;
  lotRef: string | null;
  hasException: boolean;
  exceptionLevel: string | null;
  batchStatus: OrderStatus | null;
}
