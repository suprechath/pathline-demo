import { prisma } from "@/lib/db/prisma";
import { getEventsSince } from "@/lib/data/orders";

export const dynamic = "force-dynamic";

// Server-Sent Events: streams new ExecutionEvents for one order as the webhook
// route writes them. Closes when a Completed batch_status event has been sent.
export async function GET(_req: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  const order = await prisma.processOrder.findUnique({ where: { orderNo }, select: { id: true } });
  if (!order) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let lastSeq = 0;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("ping", { ok: true });

      const poll = async () => {
        if (closed) return;
        try {
          const events = await getEventsSince(order.id, lastSeq);
          for (const e of events) {
            lastSeq = Math.max(lastSeq, e.seq);
            send("execution", e);
            if (e.batchStatus === "COMPLETED") {
              send("done", { seq: e.seq });
              closed = true;
              controller.close();
              return;
            }
          }
        } catch {
          /* keep polling */
        }
        if (!closed) timer = setTimeout(poll, 600);
      };

      let timer: ReturnType<typeof setTimeout> = setTimeout(poll, 200);
      // Safety cap so a stalled batch doesn't hold the connection forever.
      setTimeout(() => { if (!closed) { closed = true; try { controller.close(); } catch {} } }, 60_000);
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
