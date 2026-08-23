import { prisma } from "@/lib/db/prisma";
import type { WebhookEvent } from "@/lib/batchline/types";
import type { EventKind, Prisma } from "@prisma/client";

// Inbound: Batchline -> Pathline. The simulator (and, in production, the real
// plant) POSTs here. Writes an ExecutionEvent, advances order status/yield,
// and logs the inbound IntegrationMessage.
// http://<your-host>/api/batchline/webhook
export async function POST(req: Request) {
  // This is API authen
  // const apiKey = req.headers.get("x-api-key");
  // if (apiKey !== (process.env.BATCHLINE_API_KEY ?? "local-demo-key")) {
  //   return new Response("Unauthorized", { status: 401 });
  // }

  let body: WebhookEvent;
  try {
    body = (await req.json()) as WebhookEvent;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const order = await prisma.processOrder.findUnique({ where: { orderNo: body.process_number } });
  if (!order) {
    console.warn(`[INBOUND WEBHOOK WARNING] Unknown process_number: "${body.process_number}". No matching order found in database.`);
    await prisma.integrationMessage.create({
      data: {
        direction: "INBOUND",
        endpoint: "/api/batchline/webhook",
        method: "POST",
        entityType: "batch",
        entityRef: body.process_number ?? "UNKNOWN",
        status: "FAILED",
        httpStatus: 404,
        reason: `Unknown process_number: ${body.process_number}`,
        response: body as unknown as object,
      },
    });
    return new Response(`Unknown order: ${body.process_number}`, { status: 404 });
  }

  const kind: EventKind =
    body.topic === "batch_status.update" ? "BATCH_STATUS" : body.has_exception ? "EXCEPTION" : "INSTRUCTION";

  const detail =
    body.detail ??
    (body.actual_value ? `${body.actual_value} ${body.uom ?? ""} from ${body.lot_ref ?? "lot"} (target ${body.target_value})` : null);

  // Build the write set, then commit it in ONE transaction so an event, the
  // status/yield advance, the lot consumption, and the inbound log are all-or-
  // nothing. Reads (current lot ledger) happen first, outside the writes.
  const writes: Prisma.PrismaPromise<unknown>[] = [];

  writes.push(
    prisma.executionEvent.create({
      data: {
        orderId: order.id, seq: body.seq, kind, title: body.title, detail,
        wireNote: `${body.topic}${body.batch_status ? ` -> ${body.batch_status}` : ""}`,
        batchStatus: body.batch_status ?? null,
        actualValue: body.actual_value ?? null,
        targetValue: body.target_value ?? null,
        uom: body.uom ?? null,
        lotRef: body.lot_ref ?? null,
        hasException: body.has_exception ?? false,
        exceptionLevel: body.exception_level ?? null,
        executedUser: body.executed_user ?? null,
        executedAt: new Date(),
      },
    }),
  );

  if (body.batch_status) {
    writes.push(
      prisma.processOrder.update({
        where: { id: order.id },
        data: {
          status: body.batch_status,
          ...(body.yield_actual ? { yieldActual: body.yield_actual, yieldPlan: order.size } : {}),
        },
      }),
    );

    // If batch was CANCELLED, release any remaining unconsumed inventory reservations
    if (body.batch_status === "CANCELLED") {
      const assignments = await prisma.lotAssignment.findMany({
        where: { bomLine: { stage: { orderId: order.id } } },
        include: { lot: { include: { movements: true } } },
      });
      for (const a of assignments) {
        const lot = a.lot;
        const reservedForOrder = lot.movements
          .filter((m) => m.note === order.orderNo)
          .reduce(
            (sum, m) =>
              sum +
              (m.reason === "RESERVE"
                ? Number(m.quantity)
                : m.reason === "RELEASE"
                ? -Math.abs(Number(m.quantity))
                : 0),
            0
          );
        if (reservedForOrder > 0) {
          writes.push(
            prisma.stockMovement.create({
              data: {
                lotId: lot.id,
                reason: "RELEASE",
                quantity: -reservedForOrder,
                note: `Order ${order.orderNo} cancelled`,
                user: body.executed_user ?? "system",
              },
            })
          );
        }
      }
    }
  }

  // A dispense instruction that references a lot + actual consumes that lot:
  // negative ISSUE_TO_ORDER (drops on-hand) plus RELEASE of its reservation.
  if (body.lot_ref && body.actual_value) {
    const actual = Number(body.actual_value);
    const lot = await prisma.lot.findUnique({ where: { lotId: body.lot_ref }, include: { movements: true } });
    if (lot && actual > 0) {
      writes.push(
        prisma.stockMovement.create({
          data: { lotId: lot.id, reason: "ISSUE_TO_ORDER", quantity: -actual, note: order.orderNo, user: body.executed_user ?? "operator" },
        }),
      );
      const reserved = lot.movements.reduce((s, m) => s + (m.reason === "RESERVE" ? Number(m.quantity) : m.reason === "RELEASE" ? -Math.abs(Number(m.quantity)) : 0), 0);
      if (reserved > 0) {
        writes.push(
          prisma.stockMovement.create({
            data: { lotId: lot.id, reason: "RELEASE", quantity: -Math.min(reserved, actual), note: order.orderNo, user: "system" },
          }),
        );
      }
      const onHand = lot.movements.reduce((s, m) => s + (m.reason === "RESERVE" || m.reason === "RELEASE" ? 0 : Number(m.quantity)), 0) - actual;
      if (onHand <= 0) writes.push(prisma.lot.update({ where: { id: lot.id }, data: { status: "CONSUMED" } }));
    }
  }

  writes.push(
    prisma.integrationMessage.create({
      data: {
        direction: "INBOUND", endpoint: "/api/batchline/webhook", method: "POST",
        entityType: "batch", entityRef: order.batchId ?? body.batch_id,
        status: "RECEIVED", httpStatus: 200, orderId: order.id,
        response: body as unknown as object,
      },
    }),
  );

  await prisma.$transaction(writes);

  console.log(`[INBOUND WEBHOOK SUCCESS] Event recorded for order ${order.orderNo} (Status: ${body.batch_status ?? "unchanged"}, Seq: ${body.seq}, Title: "${body.title}")\n`);

  return Response.json({ ok: true, seq: body.seq });
}
