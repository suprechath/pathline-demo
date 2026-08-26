"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { evalVerdict } from "@/lib/data/lims";
import { returnDisposition, extractEbrErrorDetail } from "@/lib/batchline/ebr-client";
import type { ActionResult } from "@/app/materials/actions";

// Sample id assigned by the LIMS when a request arrives from the EBR.
function genSampleId() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `IPC-26-${n}`;
}

export interface DynamicSpecInput {
  code?: string;
  testName?: string;
  test_name?: string;
  parameter?: string;
  limitType?: "MAX" | "MIN" | "RANGE" | "OPTIONS";
  limit_type?: "MAX" | "MIN" | "RANGE" | "OPTIONS";
  lower?: number | null;
  upper?: number | null;
  unit?: string;
  limitText?: string;
  limit_text?: string;
  expectedValue?: string;
  expected_value?: string;
  options?: string[] | string;
}

export interface HoldRequestInput {
  batchId: string;
  stageName: string;
  gateStep?: string;
  specCode?: string;
  specification?: DynamicSpecInput;
  ebrRequestRef?: string;
}

export interface HoldRequestCreatedItem {
  batchId: string;
  gateStep?: string;
  sampleId: string;
}

// EBR → LIMS: a hold point request arrives. Persisted against a stored spec or dynamic payload.
export async function receiveHoldRequest(input: HoldRequestInput): Promise<ActionResult & { sampleId?: string }> {
  const specCode = input.specification?.code ?? input.specCode ?? `SPEC-${Date.now()}`;
  let spec = await prisma.qcSpecification.findUnique({ where: { code: specCode } });

  if (input.specification) {
    const s = input.specification;
    const testName = s.testName ?? s.test_name ?? s.parameter ?? specCode;
    const parameter = s.parameter ?? s.testName ?? s.test_name ?? "In-process IPC limit";
    const lower = s.lower != null ? Number(s.lower) : null;
    const upper = s.upper != null ? Number(s.upper) : null;
    const optionsRaw = s.options;
    const optionsStr = Array.isArray(optionsRaw)
      ? optionsRaw.map((x) => String(x).trim()).join(",")
      : typeof optionsRaw === "string"
      ? optionsRaw
      : undefined;

    const expectedValue = s.expectedValue ?? s.expected_value ?? (optionsStr ? optionsStr.split(",")[0]?.trim() : undefined);
    const isOptions =
      s.limitType === "OPTIONS" ||
      s.limit_type === "OPTIONS" ||
      Boolean(optionsStr) ||
      Boolean(expectedValue && lower == null && upper == null);

    const limitType = (s.limitType ?? s.limit_type ?? (isOptions ? "OPTIONS" : lower != null && upper != null ? "RANGE" : upper != null ? "MAX" : "MIN")) as "MAX" | "MIN" | "RANGE" | "OPTIONS";
    const unit = isOptions ? "" : (s.unit ?? "");

    const limitText = s.limitText ?? s.limit_text ?? (
      limitType === "OPTIONS"
        ? (optionsStr ? `Must be '${expectedValue ?? "Released"}' (${optionsStr})` : `Must be '${expectedValue ?? "Released"}'`)
        : limitType === "RANGE"
        ? `${lower} – ${upper} ${unit}`.trim()
        : limitType === "MAX"
        ? `≤ ${upper} ${unit}`.trim()
        : `≥ ${lower} ${unit}`.trim()
    );

    spec = await prisma.qcSpecification.upsert({
      where: { code: specCode },
      create: {
        code: specCode,
        testName,
        parameter,
        limitType,
        lower: isOptions ? null : lower,
        upper: isOptions ? null : upper,
        unit,
        limitText,
        expectedValue: expectedValue ?? null,
        options: optionsStr ?? (isOptions ? (expectedValue ? `${expectedValue},Rejected` : "Released,Rejected") : null),
      },
      update: {
        testName,
        parameter,
        limitType,
        lower: isOptions ? null : lower,
        upper: isOptions ? null : upper,
        unit,
        limitText,
        expectedValue: expectedValue ?? null,
        options: optionsStr ?? (isOptions ? (expectedValue ? `${expectedValue},Rejected` : "Released,Rejected") : null),
      },
    });
  }

  if (!spec) return { ok: false, message: `Unknown specification ${input.specCode}`, system: "batchline" };

  // Duplicate prevention: reject if this batchId already has a hold point with the same gate_step
  const gateStepCondition = input.gateStep?.trim()
    ? { equals: input.gateStep.trim(), mode: "insensitive" as const }
    : null;

  const existingHold = await prisma.holdPoint.findFirst({
    where: {
      batchId: input.batchId,
      gateStep: gateStepCondition,
    },
    select: {
      sampleId: true,
      status: true,
      gateStep: true,
    },
  });

  if (existingHold) {
    const gateLabel = existingHold.gateStep ? `'${existingHold.gateStep}'` : "empty/unspecified gate step";
    return {
      ok: false,
      message: `Hold request rejected: Gate step ${gateLabel} for batch '${input.batchId}' already exists in LIMS (Sample: ${existingHold.sampleId}, Status: ${existingHold.status})`,
      system: "batchline",
    };
  }

  const hp = await prisma.holdPoint.create({
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

// EBR → LIMS: multiple hold point requests arrive in a single batch.
export async function receiveHoldRequests(
  inputs: HoldRequestInput[]
): Promise<ActionResult & { sampleIds?: string[]; results?: HoldRequestCreatedItem[] }> {
  if (inputs.length === 0) {
    return { ok: false, message: "No hold point requests provided", system: "batchline" };
  }

  // Pre-validate in-batch duplicate gate_step for the same batchId
  const seenKeys = new Set<string>();
  for (const input of inputs) {
    const key = `${input.batchId.trim()}::${input.gateStep?.trim() ?? ""}`.toLowerCase();
    if (seenKeys.has(key)) {
      const gateLabel = input.gateStep?.trim() ? `'${input.gateStep.trim()}'` : "empty gate step";
      return {
        ok: false,
        message: `Duplicate hold request in payload: Gate step ${gateLabel} for batch '${input.batchId}' is repeated`,
        system: "batchline",
      };
    }
    seenKeys.add(key);
  }

  // Pre-validate against existing database records
  for (const input of inputs) {
    const gateStepCondition = input.gateStep?.trim()
      ? { equals: input.gateStep.trim(), mode: "insensitive" as const }
      : null;

    const existingHold = await prisma.holdPoint.findFirst({
      where: {
        batchId: input.batchId,
        gateStep: gateStepCondition,
      },
      select: {
        sampleId: true,
        status: true,
        gateStep: true,
      },
    });

    if (existingHold) {
      const gateLabel = existingHold.gateStep ? `'${existingHold.gateStep}'` : "empty/unspecified gate step";
      return {
        ok: false,
        message: `Hold request rejected: Gate step ${gateLabel} for batch '${input.batchId}' already exists in LIMS (Sample: ${existingHold.sampleId}, Status: ${existingHold.status})`,
        system: "batchline",
      };
    }
  }

  // Process and create each hold point
  const created: HoldRequestCreatedItem[] = [];
  for (const input of inputs) {
    const res = await receiveHoldRequest(input);
    if (!res.ok) {
      return res;
    }
    if (res.sampleId) {
      created.push({
        batchId: input.batchId,
        gateStep: input.gateStep,
        sampleId: res.sampleId,
      });
    }
  }

  revalidatePath("/lims");
  return {
    ok: true,
    message: `Received ${created.length} sample request(s) from Batchline EBR`,
    system: "batchline",
    sampleIds: created.map((c) => c.sampleId),
    results: created,
  };
}

// Log receipt of the physical sample → testing may begin.
export async function receiveSample(sampleId: string): Promise<ActionResult> {
  const hp = await prisma.holdPoint.findUnique({ where: { sampleId } });
  if (!hp || hp.status !== "PENDING") return { ok: false, message: "Sample not awaiting receipt", system: "pathline" };
  await prisma.holdPoint.update({ where: { sampleId }, data: { status: "AWAITING_RESULT" } });
  revalidatePath("/lims");
  return { ok: true, message: "Sample logged — testing may begin", system: "pathline" };
}

// Record a measured value: compute the verdict, write the result, and return
// the disposition to the EBR — all in one transaction. A pass RELEASES the
// hold (batch resumes); an OOS FAILS it (batch held).
export async function recordResult(input: {
  sampleId: string;
  measuredName: string;
  measuredValue?: number | null;
  measuredText?: string | null;
  recordedBy?: string;
}): Promise<ActionResult> {
  const hp = await prisma.holdPoint.findUnique({ where: { sampleId: input.sampleId }, include: { specification: true } });
  if (!hp) return { ok: false, message: "Hold point not found", system: "pathline" };
  if (hp.status === "RELEASED" || hp.status === "FAILED") return { ok: false, message: "Already dispositioned", system: "pathline" };

  const spec = hp.specification;
  const isOptions = spec.limitType === "OPTIONS";

  let recordedValueToSend: number | string;
  let numVal: number | null = null;
  let textVal: string | null = null;

  if (isOptions) {
    textVal = input.measuredText?.trim() ?? (input.measuredValue != null ? String(input.measuredValue).trim() : "");
    if (!textVal) return { ok: false, message: "Select an option for result", system: "pathline" };
    recordedValueToSend = textVal;
  } else {
    if (input.measuredValue == null || Number.isNaN(input.measuredValue)) {
      return { ok: false, message: "Enter a numeric value", system: "pathline" };
    }
    numVal = input.measuredValue;
    textVal = String(input.measuredValue);
    recordedValueToSend = input.measuredValue;
  }

  const verdict = evalVerdict(
    {
      limitType: spec.limitType,
      lower: spec.lower == null ? null : Number(spec.lower),
      upper: spec.upper == null ? null : Number(spec.upper),
      expectedValue: spec.expectedValue,
    },
    isOptions ? (textVal ?? "") : (numVal ?? 0),
  );

  const ebr = await returnDisposition({
    batchId: hp.batchId,
    sampleId: hp.sampleId,
    gateStep: hp.gateStep,
    measuredValue: recordedValueToSend,
    verdict,
  });

  if (!ebr.ok) {
    const errorDetail = ebr.errorDetail ?? extractEbrErrorDetail(ebr.responseData, ebr.httpStatus);
    return {
      ok: false,
      message: `Failed to return disposition to Batchline EBR \n- (${errorDetail}). \n Result not recorded.`,
      system: "batchline",
    };
  }

  await prisma.$transaction([
    prisma.qcResult.create({
      data: {
        holdPointId: hp.id,
        measuredName: input.measuredName,
        measuredValue: numVal,
        measuredText: textVal,
        verdict,
        recordedBy: input.recordedBy ?? "analyst",
        dispositionSentAt: new Date(),
        ebrResponseRef: ebr.ref,
      },
    }),
    prisma.holdPoint.update({ where: { id: hp.id }, data: { status: verdict === "PASS" ? "RELEASED" : "FAILED" } }),
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
  const specs = await prisma.qcSpecification.findMany();
  if (specs.length === 0) return { ok: false, message: "No specifications seeded", system: "batchline" };
  const spec = specs[Math.floor(Math.random() * specs.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return receiveHoldRequest({
    batchId: `PARA-CR_${n}`,
    stageName: "Granulation",
    gateStep: "Discharge to next step",
    specCode: spec.code,
    ebrRequestRef: `EBR-REQ-${Date.now()}`,
  });
}
