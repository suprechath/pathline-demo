"use server";
import { revalidatePath } from "next/cache";
import { limsPrisma } from "@/lib/db/lims-prisma";
import { evalVerdict } from "@/lib/data/lims";
import { returnDisposition } from "@/lib/batchline/ebr-client";
import type { ActionResult } from "@/app/materials/actions";

// Sample id assigned by the LIMS when a request arrives from the EBR.
function genSampleId() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `IPC-26-${n}`;
}

// EBR → LIMS: a hold point request arrives. Persisted against a stored spec.
export async function receiveHoldRequest(input: {
  batchId: string;
  stageName: string;
  gateStep?: string;
  specCode: string;
  ebrRequestRef?: string;
}): Promise<ActionResult & { sampleId?: string }> {
  const spec = await limsPrisma.qcSpecification.findUnique({ where: { code: input.specCode } });
  if (!spec) return { ok: false, message: `Unknown specification ${input.specCode}`, system: "batchline" };

  const hp = await limsPrisma.holdPoint.create({
    data: {
      sampleId: genSampleId(),
      batchId: input.batchId,
      stageName: input.stageName,
      gateStep: input.gateStep ?? null,
      ebrRequestRef: input.ebrRequestRef ?? null,
      status: "PENDING",
      specificationId: spec.id,
    },
  });
  revalidatePath("/lims");
  return { ok: true, message: "New sample request received from Batchline EBR", system: "batchline", sampleId: hp.sampleId };
}

// Log receipt of the physical sample → testing may begin.
export async function receiveSample(sampleId: string): Promise<ActionResult> {
  const hp = await limsPrisma.holdPoint.findUnique({ where: { sampleId } });
  if (!hp || hp.status !== "PENDING") return { ok: false, message: "Sample not awaiting receipt", system: "pathline" };
  await limsPrisma.holdPoint.update({ where: { sampleId }, data: { status: "AWAITING_RESULT" } });
  revalidatePath("/lims");
  return { ok: true, message: "Sample logged — testing may begin", system: "pathline" };
}

// Record a measured value: compute the verdict, write the result, and return
// the disposition to the EBR — all in one transaction. A pass RELEASES the
// hold (batch resumes); an OOS FAILS it (batch held).
export async function recordResult(input: {
  sampleId: string;
  measuredName: string;
  measuredValue: number;
  recordedBy?: string;
}): Promise<ActionResult> {
  const hp = await limsPrisma.holdPoint.findUnique({ where: { sampleId: input.sampleId }, include: { specification: true } });
  if (!hp) return { ok: false, message: "Hold point not found", system: "pathline" };
  if (hp.status === "RELEASED" || hp.status === "FAILED") return { ok: false, message: "Already dispositioned", system: "pathline" };
  if (Number.isNaN(input.measuredValue)) return { ok: false, message: "Enter a numeric value", system: "pathline" };

  const spec = hp.specification;
  const verdict = evalVerdict(
    { limitType: spec.limitType, lower: spec.lower == null ? null : Number(spec.lower), upper: spec.upper == null ? null : Number(spec.upper) },
    input.measuredValue,
  );

  const ebr = await returnDisposition({ batchId: hp.batchId, sampleId: hp.sampleId, verdict });

  await limsPrisma.$transaction([
    limsPrisma.qcResult.create({
      data: {
        holdPointId: hp.id,
        measuredName: input.measuredName,
        measuredValue: input.measuredValue,
        verdict,
        recordedBy: input.recordedBy ?? "analyst",
        dispositionSentAt: new Date(),
        ebrResponseRef: ebr.ref,
      },
    }),
    limsPrisma.holdPoint.update({ where: { id: hp.id }, data: { status: verdict === "PASS" ? "RELEASED" : "FAILED" } }),
  ]);

  revalidatePath("/lims");
  return {
    ok: true,
    system: "batchline",
    message:
      verdict === "PASS"
        ? "Result recorded — pass returned to Batchline EBR, batch resumed"
        : "Result recorded (OOS) — batch held at hold point, EBR notified",
  };
}

// Demo helper: fabricate an incoming EBR request against a random stored spec.
export async function simulateIncoming(): Promise<ActionResult> {
  const specs = await limsPrisma.qcSpecification.findMany();
  if (specs.length === 0) return { ok: false, message: "No specifications seeded", system: "batchline" };
  const spec = specs[Math.floor(Math.random() * specs.length)];
  const n = Math.floor(1 + Math.random() * 9);
  return receiveHoldRequest({
    batchId: `PARA-CR_${n}`,
    stageName: "Granulation",
    gateStep: "Discharge to next step",
    specCode: spec.code,
    ebrRequestRef: `EBR-REQ-${Date.now()}`,
  });
}
