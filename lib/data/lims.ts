import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma, ResultVerdict } from ".prisma/lims-client";

const num = (d: Prisma.Decimal | null) => (d == null ? null : Number(d));

export interface SpecVM {
  parameter: string;
  limitText: string;
  method: string;
  unit: string;
  limitType: "MAX" | "MIN" | "RANGE";
  lower: number | null;
  upper: number | null;
}

export interface ResultVM {
  measuredName: string;
  measuredValue: number;
  verdict: ResultVerdict;
  recordedBy: string | null;
  recordedAt: string;
  dispositionSentAt: string | null;
}

export interface HoldVM {
  id: string;
  sampleId: string;
  batchId: string;
  stageName: string;
  gateStep: string | null;
  requested: string;
  status: "PENDING" | "IN_TEST" | "AWAITING_RESULT" | "RELEASED" | "FAILED";
  spec: SpecVM;
  result: ResultVM | null;
}

const holdInclude = { specification: true, results: { orderBy: { recordedAt: "desc" as const } } };
type FullHold = Prisma.HoldPointGetPayload<{ include: typeof holdInclude }>;

const hhmm = (d: Date) => d.toISOString().slice(11, 16);

function toHoldVM(h: FullHold): HoldVM {
  const s = h.specification;
  const r = h.results[0] ?? null;
  return {
    id: h.id,
    sampleId: h.sampleId,
    batchId: h.batchId,
    stageName: h.stageName,
    gateStep: h.gateStep,
    requested: hhmm(h.requestedAt),
    status: h.status,
    spec: {
      parameter: s.parameter,
      limitText: s.limitText,
      method: s.code,
      unit: s.unit,
      limitType: s.limitType,
      lower: num(s.lower),
      upper: num(s.upper),
    },
    result: r
      ? {
          measuredName: r.measuredName,
          measuredValue: Number(r.measuredValue),
          verdict: r.verdict,
          recordedBy: r.recordedBy,
          recordedAt: r.recordedAt.toISOString().slice(0, 16).replace("T", " "),
          dispositionSentAt: r.dispositionSentAt ? r.dispositionSentAt.toISOString().slice(0, 16).replace("T", " ") : null,
        }
      : null,
  };
}

// Evaluate a measured value against a specification → PASS / OOS.
export function evalVerdict(spec: Pick<SpecVM, "limitType" | "lower" | "upper">, value: number): ResultVerdict {
  if (spec.limitType === "MAX") return spec.upper != null && value <= spec.upper ? "PASS" : "OOS";
  if (spec.limitType === "MIN") return spec.lower != null && value >= spec.lower ? "PASS" : "OOS";
  return spec.lower != null && spec.upper != null && value >= spec.lower && value <= spec.upper ? "PASS" : "OOS";
}

export async function getHoldPoints(): Promise<HoldVM[]> {
  const rows = await prisma.holdPoint.findMany({ include: holdInclude, orderBy: { requestedAt: "desc" } });
  return rows.map(toHoldVM);
}

export async function getHoldPoint(sampleId: string): Promise<HoldVM | null> {
  const row = await prisma.holdPoint.findUnique({ where: { sampleId }, include: holdInclude });
  return row ? toHoldVM(row) : null;
}

export async function limsStats() {
  const [onHold, pending] = await Promise.all([
    prisma.holdPoint.count({ where: { status: { in: ["PENDING", "IN_TEST", "AWAITING_RESULT"] } } }),
    prisma.holdPoint.count({ where: { status: { in: ["IN_TEST", "AWAITING_RESULT"] } } }),
  ]);
  return { onHold, pending };
}
