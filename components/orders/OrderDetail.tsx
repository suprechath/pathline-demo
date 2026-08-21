"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderVM, EventVM } from "@/lib/domain/types";
import { sendToBatchline, simulateBatch } from "@/app/orders/actions";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { YieldPanel } from "./YieldPanel";
import { PayloadPeek } from "./PayloadPeek";
import { toast } from "@/components/ui/Toast";

export function OrderDetail({ order, initialEvents }: { order: OrderVM; initialEvents: EventVM[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [events, setEvents] = useState<EventVM[]>(initialEvents);
  const [running, setRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => setEvents(initialEvents), [initialEvents]);
  useEffect(() => () => esRef.current?.close(), []);

  const stats = [
    { k: "Batch ID", v: order.batchId ?? "—" },
    { k: "Size", v: `${order.size} ${order.uom}` },
    { k: "Plan start", v: order.planStart },
    { k: "Plan end", v: order.planEnd },
  ];

  const onSend = () =>
    start(async () => {
      const res = await sendToBatchline(order.orderNo);
      toast(res);
      router.refresh();
    });

  const onSimulate = () =>
    start(async () => {
      const res = await simulateBatch(order.orderNo);
      toast(res);
      if (!res.ok) return;
      setEvents([]);
      setRunning(true);
      esRef.current?.close();
      const es = new EventSource(`/orders/${order.orderNo}/stream`);
      esRef.current = es;
      es.addEventListener("execution", (e) => {
        const ev = JSON.parse((e as MessageEvent).data) as EventVM;
        setEvents((prev) => (prev.some((p) => p.seq === ev.seq) ? prev : [...prev, ev]));
      });
      es.addEventListener("done", () => { es.close(); setRunning(false); router.refresh(); });
      es.onerror = () => { es.close(); setRunning(false); };
    });

  const showSim = order.sent && !running && (order.status === "PLANNED" || order.status === "STARTED" || order.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-[1120px]">
      <Link href="/orders" className="mb-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        All orders
      </Link>

      <div className="mb-[18px] rounded-[14px] border border-border bg-panel px-6 py-[22px] shadow-[0_1px_2px_rgba(74,50,34,.04)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-1.5 flex items-center gap-3">
              <span className="font-mono text-[21px] font-semibold text-espresso-deep">{order.orderNo}</span>
              <Pill status={order.status} />
            </div>
            <div className="text-[15px] font-medium text-ink">{order.product} <span className="font-mono text-[12px] font-normal text-faint">{order.productId}</span></div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="outline" onClick={() => setPayloadOpen(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></svg>
              View API payload
            </Button>
            {!order.sent && (
              <Button variant="batchline" disabled={!order.fullyAssigned || pending} onClick={onSend}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
                Send to Batchline
              </Button>
            )}
            {order.sent && (
              <Button variant="batchline" disabled={running || pending || !showSim} onClick={onSimulate}>
                <span className="h-2 w-2 rounded-full bg-white" style={{ animation: running ? undefined : "pulseDot 1.4s infinite" }} />
                {running ? "Batch running in Batchline…" : "Simulate batch in Batchline"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-px overflow-hidden rounded-[10px] border border-line bg-line">
          {stats.map((s) => (
            <div key={s.k} className="bg-panel px-4 py-[13px]">
              <div className="mb-1 text-[10.5px] uppercase tracking-[.8px] text-faint">{s.k}</div>
              <div className="font-mono text-[14px] font-semibold text-ink">{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start gap-[18px] max-lg:grid-cols-1">
        {/* BOM */}
        <div className="overflow-hidden rounded-[14px] border border-border bg-panel shadow-[0_1px_2px_rgba(74,50,34,.04)]">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-[15px]">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-espresso" />
            <span className="text-[14px] font-semibold text-ink">Bill of materials</span>
            <span className="ml-auto text-[11.5px] text-faint">Stage · {order.stageName}</span>
          </div>
          <div className="px-5 pb-[18px] pt-1.5">
            {order.bom.map((b) => {
              const pct = Math.min(100, Math.round((b.assigned / Number(b.required)) * 100));
              return (
                <div key={b.id} className="border-b border-[#f2ebdd] py-[15px] last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <div><span className="text-[13.5px] font-semibold text-ink">{b.material}</span> <span className="font-mono text-[11px] text-faint">{b.bomId}</span></div>
                    <div className="font-mono text-[12.5px] text-ink">{b.assigned} / {b.required} <span className="text-faint">{b.uom}</span></div>
                  </div>
                  <div className="my-2 h-[7px] overflow-hidden rounded-[5px] bg-line">
                    <div className="h-full rounded-[5px]" style={{ width: `${pct}%`, background: b.balanced ? "#7d9540" : "#b87333" }} />
                  </div>
                  {b.lots.map((la) => (
                    <div key={la.lotId} className="flex items-center gap-2 py-0.5 text-[12px] text-muted">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b87333" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      <span className="font-mono text-amber-ink">{la.lotId}</span>
                      <span className="ml-auto font-mono">{la.quantity} {b.uom}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Execution */}
        <div className="overflow-hidden rounded-[14px] border border-border bg-panel shadow-[0_1px_2px_rgba(74,50,34,.04)]">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-[15px]">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-amber" />
            <span className="text-[14px] font-semibold text-ink">Execution</span>
            <span className="ml-auto font-mono text-[11px] text-faint">SSE · /stream</span>
          </div>
          <YieldPanel order={order} />
          <ExecutionTimeline
            events={events}
            running={running}
            emptyMsg={order.sent ? "Order is live at Batchline. Click Simulate to stream execution back over SSE." : "Send this order to Batchline to begin execution."}
          />
        </div>
      </div>

      <PayloadPeek open={payloadOpen} onClose={() => setPayloadOpen(false)} order={order} />
    </div>
  );
}
