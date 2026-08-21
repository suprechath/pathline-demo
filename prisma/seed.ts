// Pathline ERP seed — paracetamol master data, lots,
// one COMPLETED order (PO-2041) and one PLANNED-ready order (PO-2042).
//
//   npx prisma db seed
//
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const D = (n: number | string) => new Prisma.Decimal(n);
const S = (n: number) => n.toString();

async function main() {
  // ── wipe (safe order: children first) ───────────────────────────
  await prisma.executionEvent.deleteMany();
  await prisma.integrationMessage.deleteMany();
  await prisma.lotAssignment.deleteMany();
  await prisma.bomLine.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.processOrder.deleteMany();
  await prisma.recipeBomLine.deleteMany();
  await prisma.recipeSubStage.deleteMany();
  await prisma.recipeStage.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.material.deleteMany();

  // LIMS wipes
  await prisma.qcResult.deleteMany();
  await prisma.holdPoint.deleteMany();
  await prisma.qcSpecification.deleteMany();

  // ── materials ───────────────────────────────────────────────────
  const para500 = await prisma.material.create({
    data: { materialId: "PARA-500", name: "Paracetamol 500mg Tablet", type: "PRODUCT", uom: "ea", shelfLife: 3, shelfLifeUom: "YEARS" },
  });
  const blend = await prisma.material.create({
    data: { materialId: "PARA-BLEND", name: "Paracetamol Blend", type: "INTERMEDIATE", uom: "kg", shelfLife: 6, shelfLifeUom: "MONTHS" },
  });
  const api = await prisma.material.create({
    data: { materialId: "PARA-API", name: "Paracetamol API", type: "RAW", uom: "kg", shelfLife: 0 },
  });
  const lact = await prisma.material.create({
    data: { materialId: "LACT-MONO", name: "Lactose Monohydrate", type: "RAW", uom: "kg", shelfLife: 0 },
  });
  const mag = await prisma.material.create({
    data: { materialId: "MAG-STE", name: "Magnesium Stearate", type: "RAW", uom: "kg", shelfLife: 0 },
  });
  await prisma.material.create({
    data: { materialId: "MAIZE-ST", name: "Maize Starch", type: "RAW", uom: "kg", shelfLife: 0, active: false, reason: "Superseded supplier" },
  });

  // ── recipe master (RCP-BLEND-01) ─────────────────────────────────
  const rcpBlend = await prisma.recipe.create({
    data: {
      recipeId: "RCP-BLEND-01", version: 2, status: "APPROVED", baseSize: D(300), uom: "kg",
      yieldPct: D(99), approvedBy: "S. Meyer", effective: new Date("2026-06-01"),
      note: "Standard direct-blend route.", productMaterialId: blend.id,
      stages: {
        create: {
          name: "Blending", seq: 1, outputQty: D(300), uom: "kg", outputMaterialId: blend.id,
          subStages: { create: [{ name: "Pre-mix", seq: 1 }, { name: "Final blend", seq: 2 }] },
          bomLines: {
            create: [
              { bomId: "BOM-BLEND-01", materialId: api.id, quantity: D(150), uom: "kg" },
              { bomId: "BOM-BLEND-02", materialId: lact.id, quantity: D(145), uom: "kg" },
              { bomId: "BOM-BLEND-03", materialId: mag.id, quantity: D(5), uom: "kg" },
            ],
          },
        },
      },
    },
  });

  // ── lots ────────────────────────────────────────────────────────
  const lotApi = await prisma.lot.create({
    data: { lotId: "LOT-API-2201", materialId: api.id, quantity: D(500), uom: "kg", location: "WH-A / R04", expiry: new Date("2027-03-01"), status: "IN_STOCK",
      movements: { create: [
        { reason: "RECEIPT", quantity: D(620), note: "GRN-8801", user: "R. Vance" },
        { reason: "SALE_DISPATCH", quantity: D(-120), note: "SO-3391 · Acme Pharma", user: "R. Vance" },
      ] } },
  });
  const lotLact = await prisma.lot.create({
    data: { lotId: "LOT-LACT-0091", materialId: lact.id, quantity: D(400), uom: "kg", location: "WH-A / R01", expiry: new Date("2027-09-01"), status: "IN_STOCK",
      movements: { create: [
        { reason: "RECEIPT", quantity: D(800), note: "GRN-8790", user: "R. Vance" },
        { reason: "SALE_DISPATCH", quantity: D(-260), note: "SO-3402", user: "R. Vance" },
        { reason: "QC_SAMPLE", quantity: D(-140), note: "QC-118 stability", user: "S. Meyer" },
      ] } },
  });
  const lotMag = await prisma.lot.create({
    data: { lotId: "LOT-MAG-0442", materialId: mag.id, quantity: D(18), uom: "kg", location: "WH-B / R12", expiry: new Date("2028-01-01"), status: "IN_STOCK",
      movements: { create: [
        { reason: "RECEIPT", quantity: D(120), note: "GRN-8812", user: "R. Vance" },
        { reason: "SALE_DISPATCH", quantity: D(-102), note: "SO-3410", user: "R. Vance" },
      ] } },
  });
  await prisma.lot.create({
    data: { lotId: "LOT-API-2198", materialId: api.id, quantity: D(60), uom: "kg", location: "WH-A / R04", expiry: new Date("2025-01-15"), status: "EXPIRED",
      movements: { create: [{ reason: "RECEIPT", quantity: D(60), note: "GRN-8600", user: "R. Vance" }] } },
  });
  await prisma.lot.create({
    data: { lotId: "LOT-MAIZE-88", materialId: (await prisma.material.findUniqueOrThrow({ where: { materialId: "MAIZE-ST" } })).id, quantity: D(186), uom: "kg", location: "WH-B / R03", expiry: new Date("2027-05-01"), status: "RESERVED",
      movements: { create: [
        { reason: "RECEIPT", quantity: D(300), note: "GRN-8770", user: "R. Vance" },
        { reason: "SCRAP", quantity: D(-114), note: "Damaged bags", user: "R. Vance" },
      ] } },
  });

  // ── PO-2042 : ready to send (fully assigned, not yet sent) ────────
  const po2042 = await prisma.processOrder.create({
    data: {
      orderNo: "PO-2042", productMaterialId: blend.id, erpRecipeId: "SPEC-BLEND-01", recipeId: rcpBlend.id,
      size: D(300), uom: "kg", planStart: new Date("2026-08-18"), planEnd: new Date("2026-08-19"),
      status: "DRAFT", sent: false, readyToSend: true, sendMode: "RECIPE_WITH_LOTS",
      stages: {
        create: {
          name: "Blending", seq: 1, targetSize: D(300), targetMaterialId: blend.id,
          bomLines: {
            create: [
              { bomId: "BOM-API-PARA", materialId: api.id, quantity: D(150), uom: "kg", assignments: { create: [{ lotId: lotApi.id, quantity: D(150) }] } },
              { bomId: "BOM-LACT", materialId: lact.id, quantity: D(145), uom: "kg", assignments: { create: [{ lotId: lotLact.id, quantity: D(145) }] } },
              { bomId: "BOM-MAG", materialId: mag.id, quantity: D(5), uom: "kg", assignments: { create: [{ lotId: lotMag.id, quantity: D(5) }] } },
            ],
          },
        },
      },
    },
  });

  // ── PO-2041 : completed reference order with yield + event history ─
  const po2041 = await prisma.processOrder.create({
    data: {
      orderNo: "PO-2041", batchId: "PARA-BLEND_7", productMaterialId: blend.id, erpRecipeId: "SPEC-BLEND-01", recipeId: rcpBlend.id,
      size: D(500), uom: "kg", planStart: new Date("2026-08-02"), planEnd: new Date("2026-08-03"),
      status: "COMPLETED", sent: true, readyToSend: true, sendMode: "RECIPE_WITH_LOTS",
      yieldPlan: D(500), yieldActual: D("496.8"),
      stages: {
        create: {
          name: "Blending", seq: 1, targetSize: D(500), targetMaterialId: blend.id,
          bomLines: {
            create: [
              { bomId: "BOM-API-PARA", materialId: api.id, quantity: D(250), uom: "kg" },
              { bomId: "BOM-LACT", materialId: lact.id, quantity: D(242), uom: "kg" },
              { bomId: "BOM-MAG", materialId: mag.id, quantity: D(8), uom: "kg" },
            ],
          },
        },
      },
      events: {
        create: [
          { seq: 1, kind: "BATCH_STATUS", title: "Batch started", wireNote: "batch_status.update -> Started", batchStatus: "STARTED", executedUser: "J. Okafor" },
          { seq: 2, kind: "INSTRUCTION", title: "Dispense Paracetamol API", detail: "249.1 kg from LOT-API-2190", actualValue: "249.1", targetValue: "250", uom: "kg", lotRef: "LOT-API-2190" },
          { seq: 3, kind: "INSTRUCTION", title: "Dispense Lactose Monohydrate", detail: "241.6 kg from LOT-LACT-0088", actualValue: "241.6", targetValue: "242", uom: "kg", lotRef: "LOT-LACT-0088" },
          { seq: 4, kind: "INSTRUCTION", title: "Blend & verify", detail: "Operator + QA signed", executedUser: "S. Meyer" },
          { seq: 5, kind: "BATCH_STATUS", title: "Batch completed", wireNote: "batch_status.update -> Completed", batchStatus: "COMPLETED" },
        ],
      },
      messages: {
        create: [
          { direction: "OUTBOUND", endpoint: "/api/v1/processorder/create", method: "POST", entityType: "process_order", entityRef: "PO-2041", status: "DELIVERED", httpStatus: 201 },
          { direction: "INBOUND", endpoint: "/api/batchline/webhook", entityType: "batch", entityRef: "PARA-BLEND_7", status: "RECEIVED", httpStatus: 200 },
        ],
      },
    },
  });

  // ── specifications (LIMS-local master) ──────────────────────────
  const bu = await prisma.qcSpecification.create({
    data: { code: "TM-BU-007", testName: "Blend Uniformity (RSD)", parameter: "RSD of 10 sample locations", limitType: "MAX", upper: S(5.0), unit: "%", limitText: "RSD ≤ 5.0 %" },
  });
  const ph = await prisma.qcSpecification.create({
    data: { code: "TM-PH-002", testName: "pH", parameter: "pH at 25°C", limitType: "RANGE", lower: S(5.5), upper: S(7.0), unit: "", limitText: "5.5 – 7.0" },
  });
  const lod = await prisma.qcSpecification.create({
    data: { code: "TM-LOD-011", testName: "Moisture (LOD)", parameter: "Loss on drying", limitType: "MAX", upper: S(2.0), unit: "%", limitText: "LOD ≤ 2.0 %" },
  });
  const assay = await prisma.qcSpecification.create({
    data: { code: "TM-ASSAY-014", testName: "Assay (HPLC)", parameter: "Assay of active", limitType: "RANGE", lower: S(95.0), upper: S(105.0), unit: "%", limitText: "95.0 – 105.0 %" },
  });

  // ── hold points in a spread of states ───────────────────────────
  await prisma.holdPoint.create({
    data: { sampleId: "IPC-26-0431", batchId: "PARA-BLEND_9", stageName: "Blending", gateStep: "Discharge blend to next step", ebrRequestRef: "EBR-REQ-9001", status: "PENDING", specificationId: bu.id },
  });
  await prisma.holdPoint.create({
    data: { sampleId: "IPC-26-0430", batchId: "PARA-SUSP_3", stageName: "Mixing", gateStep: "Proceed to fill", ebrRequestRef: "EBR-REQ-9000", status: "IN_TEST", specificationId: ph.id },
  });
  await prisma.holdPoint.create({
    data: { sampleId: "IPC-26-0428", batchId: "PARA-BLEND_8", stageName: "Drying", gateStep: "Release to blending", ebrRequestRef: "EBR-REQ-8994", status: "AWAITING_RESULT", specificationId: lod.id },
  });
  
  // A released (pass) hold with its recorded result.
  const rel = await prisma.holdPoint.create({
    data: { sampleId: "IPC-26-0421", batchId: "PARA-BLEND_7", stageName: "Blending", gateStep: "Discharge blend to next step", ebrRequestRef: "EBR-REQ-8990", status: "RELEASED", specificationId: bu.id },
  });
  await prisma.qcResult.create({
    data: { holdPointId: rel.id, measuredName: "Relative std. deviation", measuredValue: S(3.1), verdict: "PASS", recordedBy: "A. Reyes", dispositionSentAt: new Date(), ebrResponseRef: "EBR-DISP-IPC-26-0421" },
  });
  
  // A failed (OOS) hold — assay under the lower limit.
  const fail = await prisma.holdPoint.create({
    data: { sampleId: "IPC-26-0426", batchId: "PARA-500_12", stageName: "Compression", gateStep: "Release cores to coating", ebrRequestRef: "EBR-REQ-8988", status: "FAILED", specificationId: assay.id },
  });
  await prisma.qcResult.create({
    data: { holdPointId: fail.id, measuredName: "Assay", measuredValue: S(93.2), verdict: "OOS", recordedBy: "A. Reyes", dispositionSentAt: new Date(), ebrResponseRef: "EBR-DISP-IPC-26-0426" },
  });

  console.log("Database successfully seeded with ERP and LIMS data:", { po2042: po2042.orderNo, po2041: po2041.orderNo });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
