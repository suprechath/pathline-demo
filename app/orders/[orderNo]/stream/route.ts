import { prisma } from "@/lib/db/prisma";
import { toEventVM } from "@/lib/domain/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  const order = await prisma.processOrder.findUnique({ where: { orderNo }, select: { id: true } });
  if (!order) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let closed = false;
  const sentIds = new Set<string>();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    closed = true;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  req.signal.addEventListener("abort", cleanup);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      send("ping", { ok: true });

      // Initial events query
      try {
        const initial = await prisma.executionEvent.findMany({
          where: { orderId: order.id },
          orderBy: { seq: "asc" },
        });
        for (const e of initial) {
          sentIds.add(e.id);
          send("execution", toEventVM(e));
        }
      } catch {
        /* proceed to polling */
      }

      // Fast poll loop for new delta events
      const poll = async () => {
        if (closed) return;
        try {
          const newEvents = await prisma.executionEvent.findMany({
            where: {
              orderId: order.id,
              id: { notIn: Array.from(sentIds) },
            },
            orderBy: { seq: "asc" },
          });

          for (const e of newEvents) {
            if (!sentIds.has(e.id)) {
              sentIds.add(e.id);
              send("execution", toEventVM(e));
            }
          }
        } catch {
          /* keep polling on error */
        }
        if (!closed) {
          pollTimer = setTimeout(poll, 400);
        }
      };

      pollTimer = setTimeout(poll, 400);

      // Periodic ping every 15s to keep connection alive
      pingInterval = setInterval(() => {
        if (closed) {
          cleanup();
          return;
        }
        send("ping", { time: Date.now() });
      }, 15_000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
