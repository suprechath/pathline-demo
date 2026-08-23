"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { orderSchema, allLinesBalanced } from "@/lib/domain/validation";
import { getOrder } from "@/lib/data/orders";
import { runSimulation } from "@/lib/batchline/simulator";
import type { ActionResult } from "@/app/materials/actions";

const BATCHLINE_API_KEY = process.env.BATCHLINE_API_KEY ?? "";
const BATCHLINE_PROCESS_ORDER_CREATE_API_URL =
  process.env.BATCHLINE_PROCESS_ORDER_CREATE_API_URL ??
  "https://processorder-demo.bl-client.com/api/v1/process-order/create";

export interface WizardInput {
  orderNo: string;
  productMaterialId: string;
  recipeId?: string;
  size: number;
  uom: string;
  planStart: string;
  planEnd: string;
  stageName: string;
  lines: {
    bomId: string;
    materialId: string;
    required: number;
    lots: { lotId: string; quantity: number }[];
  }[];
}

function formatIsoWithTimezone(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function getLocalYMD(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatPlanStartDate(startStr: string): string {
  const now = new Date();
  const localToday = getLocalYMD(now);
  const inputYMD = typeof startStr === "string" ? startStr.slice(0, 10) : getLocalYMD(new Date(startStr));
  // If input.planStart is today, automatically convert to next hour ahead from runtime
  if (inputYMD === localToday) {
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    return formatIsoWithTimezone(nextHour);
  }
  // Otherwise, format specified scheduled plan start date
  return formatIsoWithTimezone(startStr);
}

function sanitizeLotLocation(loc?: string | null): string {
  if (!loc) return "WH";
  // Remove all whitespace and invalid special characters, allowing ONLY alphanumeric, '-', and '_'
  const sanitized = loc
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");
  return sanitized || "WH";
}

function calculateEstimateWeeks(startStr: string, endStr: string): string {
  const startMs = new Date(startStr).getTime();
  const endMs = new Date(endStr).getTime();
  const diffWeeks = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24 * 7)));
  return `${diffWeeks} weeks`;
}

function formatErrorDetail(data: any, status: number): string {
  if (!data) return `HTTP ${status}`;
  if (typeof data === "string") return data;

  const obj = data.error && typeof data.error === "object" ? data.error : data;
  const messages: string[] = [];

  if (typeof obj.message === "string" && obj.message.trim()) {
    messages.push(obj.message.trim());
  }

  if (Array.isArray(obj.detail)) {
    messages.push(...obj.detail.map((d: any) => (typeof d === "string" ? d : JSON.stringify(d))));
  } else if (typeof obj.detail === "string" && obj.detail.trim()) {
    messages.push(obj.detail.trim());
  }

  if (Array.isArray(obj.errors)) {
    messages.push(...obj.errors.map((e: any) => (typeof e === "string" ? e : JSON.stringify(e))));
  } else if (typeof obj.errors === "object" && obj.errors !== null) {
    messages.push(JSON.stringify(obj.errors));
  }

  if (messages.length > 0) {
    return messages.join(" | ");
  }

  if (typeof obj.title === "string" && obj.title.trim()) {
    return obj.title.trim();
  }

  try {
    return JSON.stringify(data);
  } catch {
    return `HTTP ${status}`;
  }
}

interface BatchlineApiCallResult {
  ok: boolean;
  status: number;
  data: any;
  errorDetail?: string;
}

// Outbound API caller for Batchline process-order/create
async function callBatchlineProcessOrderCreate(
  payload: Record<string, any>,
  entityRef: string
): Promise<BatchlineApiCallResult> {
  let responseData: any = null;
  let responseStatus = 200;
  let isSuccess = false;

  try {
    const res = await fetch(BATCHLINE_PROCESS_ORDER_CREATE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": BATCHLINE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const rawText = await res.text();

    responseStatus = res.status;
    try {
      responseData = JSON.parse(rawText);
    } catch {
      responseData = { message: rawText || res.statusText };
    }
    isSuccess = res.ok;
  } catch (apiErr) {
    console.error("Batchline /process-order/create API error:", apiErr);
    responseStatus = 502;
    responseData = { error: apiErr instanceof Error ? apiErr.message : "Network connection error" };
    isSuccess = false;
  }

  const errorDetail = formatErrorDetail(responseData, responseStatus);

  // Log outbound integration message with error reason string
  await prisma.integrationMessage.create({
    data: {
      direction: "OUTBOUND",
      endpoint: "/api/v1/process-order/create",
      method: "POST",
      entityType: "process_order",
      entityRef,
      status: isSuccess ? "DELIVERED" : "FAILED",
      httpStatus: responseStatus,
      reason: isSuccess ? null : errorDetail,
      payload: payload as any,
      response: responseData as any,
    },
  });

  return {
    ok: isSuccess,
    status: responseStatus,
    data: responseData,
    errorDetail,
  };
}

// Create order and attempt immediate Batchline sync.
// If the API call fails, the order is retained as "DRAFT" so it can be re-sent from the detail page.
export async function createAndSendOrderToBatchline(
  input: WizardInput
): Promise<ActionResult & { orderNo?: string }> {
  // 1. Validate form schema and lot balance
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid order", system: "pathline" };
  }
  const balanced = allLinesBalanced(input.lines.map((l) => ({ required: l.required, lots: l.lots })));
  if (!balanced) {
    return { ok: false, message: "Lot quantities must sum to each BOM quantity", system: "pathline" };
  }

  // Check unique orderNo
  const existingOrder = await prisma.processOrder.findUnique({
    where: { orderNo: input.orderNo.trim() },
  });
  if (existingOrder) {
    return { ok: false, message: "Order number already exists", system: "pathline" };
  }

  const product = await prisma.material.findUnique({
    where: { materialId: input.productMaterialId },
  });
  if (!product || (product.type !== "PRODUCT" && product.type !== "INTERMEDIATE") || !product.active) {
    return { ok: false, message: "Target must be an active Product/Intermediate", system: "pathline" };
  }

  // Resolve recipe
  const recipe = input.recipeId
    ? await prisma.recipe.findUnique({ where: { recipeId: input.recipeId } })
    : null;

  const allLotIds = input.lines.flatMap((l) => l.lots.map((x) => x.lotId));
  const mats = await prisma.material.findMany({
    where: { materialId: { in: input.lines.map((l) => l.materialId) } },
  });
  const lots = await prisma.lot.findMany({
    where: { lotId: { in: allLotIds } },
  });
  const matBy = new Map(mats.map((m) => [m.materialId, m]));
  const lotBy = new Map(lots.map((l) => [l.lotId, l]));

  const missingMat = input.lines.find((l) => !matBy.has(l.materialId));
  if (missingMat) return { ok: false, message: `Unknown material ${missingMat.materialId}`, system: "pathline" };
  const missingLot = allLotIds.find((id) => !lotBy.has(id));
  if (missingLot) return { ok: false, message: `Unknown lot ${missingLot}`, system: "pathline" };

  // 2. Create the order in DB with initial status "DRAFT"
  try {
    await prisma.processOrder.create({
      data: {
        orderNo: input.orderNo.trim(),
        productMaterialId: product.id,
        recipeId: recipe?.id ?? null,
        erpRecipeId: recipe?.recipeId ?? null,
        size: input.size,
        uom: input.uom,
        planStart: new Date(input.planStart),
        planEnd: new Date(input.planEnd),
        status: "DRAFT",
        sent: false,
        readyToSend: true,
        stages: {
          create: {
            name: input.stageName,
            seq: 1,
            targetSize: input.size,
            targetMaterialId: product.id,
            bomLines: {
              create: input.lines.map((l) => ({
                bomId: l.bomId,
                materialId: matBy.get(l.materialId)!.id,
                quantity: l.required,
                uom: matBy.get(l.materialId)!.uom,
                assignments: {
                  create: l.lots.map((x) => ({
                    lotId: lotBy.get(x.lotId)!.id,
                    quantity: x.quantity,
                  })),
                },
              })),
            },
          },
        },
      },
    });
  } catch (dbErr) {
    console.error("Failed to create draft order in DB:", dbErr);
    return { ok: false, message: "Failed to create order record in database", system: "pathline" };
  }

  // 3. Build Batchline payload matching specification
  const productLotNumber = `LOT-${input.orderNo.replace(/[^A-Za-z0-9]/g, "")}`;
  const batchlinePayload = {
    process_number: input.orderNo.trim(),
    provider: "Partline-ERP",
    erp_plant_id: "Partline",
    product_target_material_id: product.materialId,
    process_size: Number(input.size),
    process_size_uom: input.uom,
    plan_start_date: formatPlanStartDate(input.planStart),
    plan_end_date: formatIsoWithTimezone(input.planEnd),
    customer_product_name: product.name,
    product_description: product.name,
    product_lot_number: productLotNumber,
    estimate_time: calculateEstimateWeeks(input.planStart, input.planEnd),
    registration_number: "",
    erp_order_number: input.orderNo.trim(),
    bin_id: null,
    remark: "Order created by Partline",
    erp_recipe_id: recipe?.recipeId ?? input.recipeId ?? "",
    process_stage_bom_data: input.lines.map((l) => ({
      bom_id: l.bomId,
      bom_material_id: l.materialId,
      bom_quantity: Number(l.required),
      bom_uom: matBy.get(l.materialId)?.uom ?? "kg",
      bom_lot: l.lots.map((alloc) => {
        const lotRecord = lotBy.get(alloc.lotId);
        return {
          lot_id: alloc.lotId,
          lot_location: sanitizeLotLocation(lotRecord?.location),
          lot_quantity: Number(alloc.quantity),
          lot_quantity_uom: lotRecord?.uom ?? matBy.get(l.materialId)?.uom ?? "kg",
          lot_expiration_date: lotRecord?.expiry ? formatIsoWithTimezone(lotRecord.expiry) : "",
        };
      }),
    })),
  };

  // 4. Call Batchline API
  const apiResult = await callBatchlineProcessOrderCreate(batchlinePayload, input.orderNo.trim());

  // 5. If Batchline API fails, KEEP as DRAFT so planner can resend from the detail page
  if (!apiResult.ok) {
    revalidatePath("/orders");
    return {
      ok: false,
      message: `Order saved as DRAFT. Batchline sync pending/failed (${apiResult.errorDetail}). You can resend it from the Order Details page.`,
      system: "batchline",
      orderNo: input.orderNo.trim(),
    };
  }

  // 6. If Batchline API succeeds, transition to PLANNED and reserve stock
  const batchId = `${product.materialId}_${Math.floor(Math.random() * 40) + 10}`;
  const reserveMoves = input.lines.flatMap((line) =>
    line.lots.map((alloc) => ({
      lotId: lotBy.get(alloc.lotId)!.id,
      reason: "RESERVE" as const,
      quantity: alloc.quantity,
      note: input.orderNo.trim(),
      user: "planner",
    }))
  );

  await prisma.$transaction([
    prisma.processOrder.update({
      where: { orderNo: input.orderNo.trim() },
      data: {
        batchId,
        status: "PLANNED",
        sent: true,
      },
    }),
    ...reserveMoves.map((data) => prisma.stockMovement.create({ data })),
  ]);

  revalidatePath("/orders");
  revalidatePath("/inventory");
  return {
    ok: true,
    message: `Order ${input.orderNo.trim()} created and sent to Batchline (Status: PLANNED)`,
    system: "batchline",
    orderNo: input.orderNo.trim(),
  };
}

// Update existing DRAFT order and attempt Batchline sync
export async function updateDraftOrder(
  input: WizardInput
): Promise<ActionResult & { orderNo?: string }> {
  // 1. Validate form schema and lot balance
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid order", system: "pathline" };
  }
  const balanced = allLinesBalanced(input.lines.map((l) => ({ required: l.required, lots: l.lots })));
  if (!balanced) {
    return { ok: false, message: "Lot quantities must sum to each BOM quantity", system: "pathline" };
  }

  // Check draft order exists
  const existingOrder = await prisma.processOrder.findUnique({
    where: { orderNo: input.orderNo.trim() },
  });
  if (!existingOrder) {
    return { ok: false, message: "Order not found", system: "pathline" };
  }
  if (existingOrder.status !== "DRAFT" || existingOrder.sent) {
    return { ok: false, message: "Only DRAFT orders can be edited", system: "pathline" };
  }

  const product = await prisma.material.findUnique({
    where: { materialId: input.productMaterialId },
  });
  if (!product || (product.type !== "PRODUCT" && product.type !== "INTERMEDIATE") || !product.active) {
    return { ok: false, message: "Target must be an active Product/Intermediate", system: "pathline" };
  }

  const recipe = input.recipeId
    ? await prisma.recipe.findUnique({ where: { recipeId: input.recipeId } })
    : null;

  const allLotIds = input.lines.flatMap((l) => l.lots.map((x) => x.lotId));
  const mats = await prisma.material.findMany({
    where: { materialId: { in: input.lines.map((l) => l.materialId) } },
  });
  const lots = await prisma.lot.findMany({
    where: { lotId: { in: allLotIds } },
  });
  const matBy = new Map(mats.map((m) => [m.materialId, m]));
  const lotBy = new Map(lots.map((l) => [l.lotId, l]));

  const missingMat = input.lines.find((l) => !matBy.has(l.materialId));
  if (missingMat) return { ok: false, message: `Unknown material ${missingMat.materialId}`, system: "pathline" };
  const missingLot = allLotIds.find((id) => !lotBy.has(id));
  if (missingLot) return { ok: false, message: `Unknown lot ${missingLot}`, system: "pathline" };

  // 2. Update DB with new draft values
  try {
    await prisma.$transaction([
      prisma.stage.deleteMany({ where: { orderId: existingOrder.id } }),
      prisma.processOrder.update({
        where: { id: existingOrder.id },
        data: {
          productMaterialId: product.id,
          recipeId: recipe?.id ?? null,
          erpRecipeId: recipe?.recipeId ?? null,
          size: input.size,
          uom: input.uom,
          planStart: new Date(input.planStart),
          planEnd: new Date(input.planEnd),
          status: "DRAFT",
          sent: false,
          readyToSend: true,
          stages: {
            create: {
              name: input.stageName,
              seq: 1,
              targetSize: input.size,
              targetMaterialId: product.id,
              bomLines: {
                create: input.lines.map((l) => ({
                  bomId: l.bomId,
                  materialId: matBy.get(l.materialId)!.id,
                  quantity: l.required,
                  uom: matBy.get(l.materialId)!.uom,
                  assignments: {
                    create: l.lots.map((x) => ({
                      lotId: lotBy.get(x.lotId)!.id,
                      quantity: x.quantity,
                    })),
                  },
                })),
              },
            },
          },
        },
      }),
    ]);
  } catch (dbErr) {
    console.error("Failed to update draft order in DB:", dbErr);
    return { ok: false, message: "Failed to update order record in database", system: "pathline" };
  }

  // 3. Build Batchline payload matching specification
  const productLotNumber = `LOT-${input.orderNo.replace(/[^A-Za-z0-9]/g, "")}`;
  const batchlinePayload = {
    process_number: input.orderNo.trim(),
    provider: "Partline-ERP",
    erp_plant_id: "Partline",
    product_target_material_id: product.materialId,
    process_size: Number(input.size),
    process_size_uom: input.uom,
    plan_start_date: formatPlanStartDate(input.planStart),
    plan_end_date: formatIsoWithTimezone(input.planEnd),
    customer_product_name: product.name,
    product_description: product.name,
    product_lot_number: productLotNumber,
    estimate_time: calculateEstimateWeeks(input.planStart, input.planEnd),
    registration_number: "",
    erp_order_number: input.orderNo.trim(),
    bin_id: null,
    remark: "Order created by Partline",
    erp_recipe_id: recipe?.recipeId ?? input.recipeId ?? "",
    process_stage_bom_data: input.lines.map((l) => ({
      bom_id: l.bomId,
      bom_material_id: l.materialId,
      bom_quantity: Number(l.required),
      bom_uom: matBy.get(l.materialId)?.uom ?? "kg",
      bom_lot: l.lots.map((alloc) => {
        const lotRecord = lotBy.get(alloc.lotId);
        return {
          lot_id: alloc.lotId,
          lot_location: sanitizeLotLocation(lotRecord?.location),
          lot_quantity: Number(alloc.quantity),
          lot_quantity_uom: lotRecord?.uom ?? matBy.get(l.materialId)?.uom ?? "kg",
          lot_expiration_date: lotRecord?.expiry ? formatIsoWithTimezone(lotRecord.expiry) : "",
        };
      }),
    })),
  };

  // 4. Call Batchline API
  const apiResult = await callBatchlineProcessOrderCreate(batchlinePayload, input.orderNo.trim());

  // 5. If Batchline API fails, KEEP as DRAFT
  if (!apiResult.ok) {
    revalidatePath(`/orders/${input.orderNo.trim()}`);
    revalidatePath("/orders");
    return {
      ok: false,
      message: `Order updated as DRAFT. Batchline sync pending/failed (${apiResult.errorDetail}).`,
      system: "batchline",
      orderNo: input.orderNo.trim(),
    };
  }

  // 6. If Batchline API succeeds, transition to PLANNED and reserve stock
  const batchId = `${product.materialId}_${Math.floor(Math.random() * 40) + 10}`;
  const reserveMoves = input.lines.flatMap((line) =>
    line.lots.map((alloc) => ({
      lotId: lotBy.get(alloc.lotId)!.id,
      reason: "RESERVE" as const,
      quantity: alloc.quantity,
      note: input.orderNo.trim(),
      user: "planner",
    }))
  );

  await prisma.$transaction([
    prisma.processOrder.update({
      where: { orderNo: input.orderNo.trim() },
      data: {
        batchId,
        status: "PLANNED",
        sent: true,
      },
    }),
    ...reserveMoves.map((data) => prisma.stockMovement.create({ data })),
  ]);

  revalidatePath(`/orders/${input.orderNo.trim()}`);
  revalidatePath("/orders");
  revalidatePath("/inventory");
  return {
    ok: true,
    message: `Order ${input.orderNo.trim()} updated and sent to Batchline (Status: PLANNED)`,
    system: "batchline",
    orderNo: input.orderNo.trim(),
  };
}

// Send existing order to Batchline (from the detailed order page)
export async function sendToBatchline(orderNo: string): Promise<ActionResult> {
  const order = await getOrder(orderNo);
  if (!order) return { ok: false, message: "Order not found", system: "pathline" };
  if (!order.fullyAssigned) return { ok: false, message: "Assign every BOM line before sending", system: "pathline" };
  if (order.sent) return { ok: false, message: "Order already sent", system: "pathline" };

  const product = await prisma.material.findUnique({ where: { materialId: order.productId } });
  if (!product) return { ok: false, message: "Unknown product", system: "pathline" };

  const allLotIds = order.bom.flatMap((b) => b.lots.map((l) => l.lotId));
  const lots = await prisma.lot.findMany({ where: { lotId: { in: allLotIds } } });
  const lotBy = new Map(lots.map((l) => [l.lotId, l]));

  const productLotNumber = `LOT-${order.orderNo.replace(/[^A-Za-z0-9]/g, "")}`;
  const batchlinePayload = {
    process_number: order.orderNo,
    provider: "Partline-ERP",
    erp_plant_id: "Partline",
    product_target_material_id: order.productId,
    process_size: Number(order.size),
    process_size_uom: order.uom,
    plan_start_date: formatPlanStartDate(order.planStart),
    plan_end_date: formatIsoWithTimezone(order.planEnd),
    customer_product_name: order.product,
    product_description: order.product,
    product_lot_number: productLotNumber,
    estimate_time: calculateEstimateWeeks(order.planStart, order.planEnd),
    registration_number: "",
    erp_order_number: order.orderNo,
    bin_id: null,
    remark: "Order created by Partline",
    erp_recipe_id: order.erpRecipeId ?? "",
    process_stage_bom_data: order.bom.map((b) => ({
      bom_id: b.bomId,
      bom_material_id: b.materialId,
      bom_quantity: Number(b.required),
      bom_uom: b.uom,
      bom_lot: b.lots.map((l) => {
        const lotRecord = lotBy.get(l.lotId);
        return {
          lot_id: l.lotId,
          lot_location: sanitizeLotLocation(lotRecord?.location),
          lot_quantity: Number(l.quantity),
          lot_quantity_uom: lotRecord?.uom ?? b.uom,
          lot_expiration_date: lotRecord?.expiry ? formatIsoWithTimezone(lotRecord.expiry) : "",
        };
      }),
    })),
  };

  const apiResult = await callBatchlineProcessOrderCreate(batchlinePayload, orderNo);
  if (!apiResult.ok) {
    return {
      ok: false,
      message: `Failed to send to Batchline (${apiResult.errorDetail}). Order remains in DRAFT status.`,
      system: "batchline",
    };
  }

  const batchId = `${order.productId}_${Math.floor(Math.random() * 40) + 10}`;
  const stage = await prisma.stage.findFirst({
    where: { orderId: order.id },
    include: { bomLines: { include: { assignments: true } } },
  });
  const reserveMoves = (stage?.bomLines ?? []).flatMap((line) =>
    line.assignments.map((a) => ({
      lotId: a.lotId,
      reason: "RESERVE" as const,
      quantity: a.quantity,
      note: orderNo,
      user: "planner",
    }))
  );

  await prisma.$transaction([
    prisma.processOrder.update({
      where: { orderNo },
      data: { batchId, status: "PLANNED", sent: true },
    }),
    ...reserveMoves.map((data) => prisma.stockMovement.create({ data })),
  ]);

  revalidatePath(`/orders/${orderNo}`);
  revalidatePath("/orders");
  revalidatePath("/inventory");
  return { ok: true, message: `Sent ${orderNo} → Batchline (Status: PLANNED)`, system: "batchline" };
}

// Kicks the Batchline simulator
export async function simulateBatch(orderNo: string): Promise<ActionResult> {
  const order = await getOrder(orderNo);
  if (!order || !order.batchId) return { ok: false, message: "Send the order first", system: "pathline" };

  // clean re-run
  await prisma.executionEvent.deleteMany({ where: { order: { orderNo } } });
  await prisma.processOrder.update({ where: { orderNo }, data: { status: "STARTED", yieldActual: null } });
  revalidatePath(`/orders/${orderNo}`);

  void runSimulation(order);
  return { ok: true, message: `Batch running in Batchline for ${orderNo}…`, system: "batchline" };
}
