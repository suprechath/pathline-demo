import "server-only";
import { prisma } from "@/lib/db/prisma";
import { toOrderVM, toEventVM } from "@/lib/domain/mappers";
import type { OrderVM, EventVM, OrderIntegrationErrorVM } from "@/lib/domain/types";

const fullInclude = {
  productMaterial: true,
  stages: {
    orderBy: { seq: "asc" as const },
    include: {
      bomLines: {
        orderBy: { bomId: "asc" as const },
        include: { material: true, assignments: { include: { lot: true } } },
      },
    },
  },
};

export async function getOrders(): Promise<OrderVM[]> {
  const rows = await prisma.processOrder.findMany({
    include: fullInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toOrderVM);
}

export async function getOrder(orderNo: string): Promise<OrderVM | null> {
  const row = await prisma.processOrder.findUnique({
    where: { orderNo },
    include: fullInclude,
  });
  return row ? toOrderVM(row) : null;
}

export async function getLatestOrderError(orderNo: string): Promise<OrderIntegrationErrorVM | null> {
  const msg = await prisma.integrationMessage.findFirst({
    where: {
      entityRef: orderNo,
      direction: "OUTBOUND",
      status: "FAILED",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!msg) return null;
  return {
    status: msg.httpStatus,
    errorDetail: msg.reason || "Batchline API call failed",
    responseBody: msg.response,
    createdAt: msg.createdAt.toISOString(),
  };
}

export async function getEvents(orderNo: string): Promise<EventVM[]> {
  const order = await prisma.processOrder.findUnique({ where: { orderNo }, select: { id: true } });
  if (!order) return [];
  const rows = await prisma.executionEvent.findMany({
    where: { orderId: order.id },
    orderBy: { seq: "asc" },
  });
  return rows.map(toEventVM);
}

export async function getEventsSince(orderId: string, afterSeq: number): Promise<EventVM[]> {
  const rows = await prisma.executionEvent.findMany({
    where: { orderId, seq: { gt: afterSeq } },
    orderBy: { seq: "asc" },
  });
  return rows.map(toEventVM);
}
