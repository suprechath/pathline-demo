import { PrismaClient } from ".prisma/lims-client";

const db = new PrismaClient();
const D = (n: number) => n.toString();

async function main() {
  await db.qcResult.deleteMany();
  await db.holdPoint.deleteMany();
  await db.qcSpecification.deleteMany();

  // ── specifications (LIMS-local master) ──────────────────────────
  const bu = await db.qcSpecification.create({
    data: { code: "TM-BU-007", testName: "Blend Uniformity (RSD)", parameter: "RSD of 10 sample locations", limitType: "MAX", upper: D(5.0), unit: "%", limitText: "RSD ≤ 5.0 %" },
  });
  const ph = await db.qcSpecification.create({
    data: { code: "TM-PH-002", testName: "pH", parameter: "pH at 25°C", limitType: "RANGE", lower: D(5.5), upper: D(7.0), unit: "", limitText: "5.5 – 7.0" },
  });
  const lod = await db.qcSpecification.create({
    data: { code: "TM-LOD-011", testName: "Moisture (LOD)", parameter: "Loss on drying", limitType: "MAX", upper: D(2.0), unit: "%", limitText: "LOD ≤ 2.0 %" },
  });
  const assay = await db.qcSpecification.create({
    data: { code: "TM-ASSAY-014", testName: "Assay (HPLC)", parameter: "Assay of active", limitType: "RANGE", lower: D(95.0), upper: D(105.0), unit: "%", limitText: "95.0 – 105.0 %" },
  });

  // ── hold points in a spread of states ───────────────────────────
  await db.holdPoint.create({
    data: { sampleId: "IPC-26-0431", batchId: "PARA-BLEND_9", stageName: "Blending", gateStep: "Discharge blend to next step", ebrRequestRef: "EBR-REQ-9001", status: "PENDING", specificationId: bu.id },
  });
  await db.holdPoint.create({
    data: { sampleId: "IPC-26-0430", batchId: "PARA-SUSP_3", stageName: "Mixing", gateStep: "Proceed to fill", ebrRequestRef: "EBR-REQ-9000", status: "IN_TEST", specificationId: ph.id },
  });
  await db.holdPoint.create({
    data: { sampleId: "IPC-26-0428", batchId: "PARA-BLEND_8", stageName: "Drying", gateStep: "Release to blending", ebrRequestRef: "EBR-REQ-8994", status: "AWAITING_RESULT", specificationId: lod.id },
  });
  // A released (pass) hold with its recorded result.
  const rel = await db.holdPoint.create({
    data: { sampleId: "IPC-26-0421", batchId: "PARA-BLEND_7", stageName: "Blending", gateStep: "Discharge blend to next step", ebrRequestRef: "EBR-REQ-8990", status: "RELEASED", specificationId: bu.id },
  });
  await db.qcResult.create({
    data: { holdPointId: rel.id, measuredName: "Relative std. deviation", measuredValue: D(3.1), verdict: "PASS", recordedBy: "A. Reyes", dispositionSentAt: new Date(), ebrResponseRef: "EBR-DISP-IPC-26-0421" },
  });
  // A failed (OOS) hold — assay under the lower limit.
  const fail = await db.holdPoint.create({
    data: { sampleId: "IPC-26-0426", batchId: "PARA-500_12", stageName: "Compression", gateStep: "Release cores to coating", ebrRequestRef: "EBR-REQ-8988", status: "FAILED", specificationId: assay.id },
  });
  await db.qcResult.create({
    data: { holdPointId: fail.id, measuredName: "Assay", measuredValue: D(93.2), verdict: "OOS", recordedBy: "A. Reyes", dispositionSentAt: new Date(), ebrResponseRef: "EBR-DISP-IPC-26-0426" },
  });

  console.log("LIMS seed complete");
}

main().finally(() => db.$disconnect());
