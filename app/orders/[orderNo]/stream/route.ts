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

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send("ping", { ok: true });

      // Mark initial events that exist at connect time
      try {
        const initial = await prisma.executionEvent.findMany({
          where: { orderId: order.id },
          orderBy: { createdAt: "asc" },
        });
        for (const e of initial) {
          sentIds.add(e.id);
          send("execution", toEventVM(e));
        }
      } catch {}

      // Fast poll loop for new events
      const poll = async () => {
        if (closed) return;
        try {
          const events = await prisma.executionEvent.findMany({
            where: { orderId: order.id },
            orderBy: { createdAt: "asc" },
          });
          for (const e of events) {
            if (!sentIds.has(e.id)) {
              sentIds.add(e.id);
              send("execution", toEventVM(e));
            }
          }
        } catch {
          /* keep polling */
        }
        if (!closed) timer = setTimeout(poll, 300);
      };

      let timer: ReturnType<typeof setTimeout> = setTimeout(poll, 300);

      // Periodic ping every 15s
      const pingInterval = setInterval(() => {
        if (closed) {
          clearInterval(pingInterval);
          return;
        }
        send("ping", { time: Date.now() });
      }, 15_000);
    },
    cancel() {
      closed = true;
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
