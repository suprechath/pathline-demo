"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { orderSchema, allLinesBalanced } from "@/lib/domain/validation";
import { getOrder } from "@/lib/data/orders";
import { sendOrder as sendOrderClient } from "@/lib/batchline/client";
import { buildOrderPayload } from "@/lib/batchline/payloads";
import { runSimulation } from "@/lib/batchline/simulator";
import type { ActionResult } from "@/app/materials/actions";

interface WizardInput {
  orderNo: string;
  productMaterialId: string; // business materialId
  recipeId?: string; // business key of the recipe this order instantiates
  size: number;
  uom: string;
  planStart: string;
  planEnd: string;
  stageName: string;
  lines: { bomId: string; materialId: string; required: number; lots: { lotId: string; quantity: number }[] }[];
}

// createOrder + assignLots in one round-trip (the wizard's Create action).
export async function createOrder(input: WizardInput): Promise<ActionResult & { orderNo?: string }> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid order", system: "pathline" };
  }
  const balanced = allLinesBalanced(input.lines.map((l) => ({ required: l.required, lots: l.lots })));
  if (!balanced) {
    return { ok: false, message: "Lot quantities must sum to each BOM quantity", system: "pathline" };
  }

  const product = await prisma.material.findUnique({ where: { materialId: input.productMaterialId } });
  if (!product || (product.type !== "PRODUCT" && product.type !== "INTERMEDIATE") || !product.active) {
    return { ok: false, message: "Target must be an active Product/Intermediate", system: "pathline" };
  }

  // Resolve the source recipe (optional) so the order links back to it.
  const recipe = input.recipeId
    ? await prisma.recipe.findUnique({ where: { recipeId: input.recipeId } })
    : null;
  if (input.recipeId && !recipe) {
    return { ok: false, message: "Unknown recipe", system: "pathline" };
  }

  const allLotIds = input.lines.flatMap((l) => l.lots.map((x) => x.lotId));
  const mats = await prisma.material.findMany({ where: { materialId: { in: input.lines.map((l) => l.materialId) } } });
  const lots = await prisma.lot.findMany({ where: { lotId: { in: allLotIds } } });
  const matBy = new Map(mats.map((m) => [m.materialId, m]));
  const lotBy = new Map(lots.map((l) => [l.lotId, l]));

  const missingMat = input.lines.find((l) => !matBy.has(l.materialId));
  if (missingMat) return { ok: false, message: `Unknown material ${missingMat.materialId}`, system: "pathline" };
  const missingLot = allLotIds.find((id) => !lotBy.has(id));
  if (missingLot) return { ok: false, message: `Unknown lot ${missingLot}`, system: "pathline" };

  try {
    await prisma.processOrder.create({
      data: {
        orderNo: input.orderNo, productMaterialId: product.id,
        recipeId: recipe?.id ?? null, erpRecipeId: recipe?.recipeId ?? null,
        size: input.size, uom: input.uom,
        planStart: new Date(input.planStart), planEnd: new Date(input.planEnd),
        status: "DRAFT", sent: false, readyToSend: balanced,
        stages: {
          create: {
            name: input.stageName, seq: 1, targetSize: input.size, targetMaterialId: product.id,
            bomLines: {
              create: input.lines.map((l) => ({
                bomId: l.bomId, materialId: matBy.get(l.materialId)!.id, quantity: l.required, uom: matBy.get(l.materialId)!.uom,
                assignments: { create: l.lots.map((x) => ({ lotId: lotBy.get(x.lotId)!.id, quantity: x.quantity })) },
              })),
            },
          },
        },
      },
    });
    revalidatePath("/orders");
    return { ok: true, message: `Created ${input.orderNo}`, system: "pathline", orderNo: input.orderNo };
  } catch (e) {
    const dup = e instanceof Error && e.message.includes("Unique");
    return { ok: false, message: dup ? "Order number already exists" : "Failed to create order", system: "pathline" };
  }
}

export async function sendToBatchline(orderNo: string): Promise<ActionResult> {
  const order = await getOrder(orderNo);
  if (!order) return { ok: false, message: "Order not found", system: "pathline" };
  if (!order.fullyAssigned) return { ok: false, message: "Assign every BOM line before sending", system: "pathline" };
  if (order.sent) return { ok: false, message: "Order already sent", system: "pathline" };

  const batchId = `${order.productId}_${Math.floor(Math.random() * 40) + 10}`;
  const payload = buildOrderPayload({ ...order, batchId });
  const res = await sendOrderClient(payload);

  const stage = await prisma.stage.findFirst({
    where: { orderId: order.id },
    include: { bomLines: { include: { assignments: true } } },
  });
  const reserveMoves = (stage?.bomLines ?? []).flatMap((line) =>
    line.assignments.map((a) => ({ lotId: a.lotId, reason: "RESERVE" as const, quantity: a.quantity, note: orderNo, user: "planner" })),
  );

  // One transaction: mark sent, reserve every assigned lot, log the message.
  // Either the whole hand-off persists or none of it does.
  await prisma.$transaction([
    prisma.processOrder.update({ where: { orderNo }, data: { batchId, status: "PLANNED", sent: true } }),
    ...reserveMoves.map((data) => prisma.stockMovement.create({ data })),
    prisma.integrationMessage.create({
      data: {
        direction: "OUTBOUND", endpoint: res.endpoint, method: res.method,
        entityType: "process_order", entityRef: orderNo, status: "DELIVERED", httpStatus: res.httpStatus,
        payload: payload as any, response: res.response as any,
      },
    }),
  ]);
  revalidatePath(`/orders/${orderNo}`);
  revalidatePath("/orders");
  return { ok: true, message: `Sent ${orderNo} → Batchline · batch ${batchId} created`, system: "batchline" };
}

// Kicks the Batchline simulator. Fire-and-forget: events land via the webhook
// route and stream to the client over SSE.
export async function simulateBatch(orderNo: string): Promise<ActionResult> {
  const order = await getOrder(orderNo);
  if (!order || !order.batchId) return { ok: false, message: "Send the order first", system: "pathline" };

  // clean re-run
  await prisma.executionEvent.deleteMany({ where: { order: { orderNo } } });
  await prisma.processOrder.update({ where: { orderNo }, data: { status: "STARTED", yieldActual: null } });
  revalidatePath(`/orders/${orderNo}`);

  void runSimulation(order); // do not await — stream picks it up
  return { ok: true, message: `Batch running in Batchline for ${orderNo}…`, system: "batchline" };
}
