"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderVM, EventVM, OrderIntegrationErrorVM, MaterialVM, LotVM } from "@/lib/domain/types";
import type { RecipeVM } from "@/lib/data/recipes";
import { sendToBatchline, simulateBatch } from "@/app/orders/actions";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { YieldPanel } from "./YieldPanel";
import { OrderWizard } from "./OrderWizard";
import { toast } from "@/components/ui/Toast";

export function OrderDetail({
  order,
  initialEvents,
  lastError,
  materials = [],
  lots = [],
  recipes = [],
}: {
  order: OrderVM;
  initialEvents: EventVM[];
  lastError?: OrderIntegrationErrorVM | null;
  materials?: MaterialVM[];
  lots?: LotVM[];
  recipes?: RecipeVM[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
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

  const consumedLots = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      if (e.lotRef && e.actualValue && Number(e.actualValue) > 0) {
        const current = map.get(e.lotRef) ?? 0;
        map.set(e.lotRef, current + Number(e.actualValue));
      }
    }
    return map;
  }, [events]);

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
            {!order.sent && (
              <>
                <Button variant="primary" onClick={() => setEditOpen(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Order
                </Button>
                <Button variant="batchline" disabled={!order.fullyAssigned || pending} onClick={onSend}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
                  Send to Batchline
                </Button>
              </>
            )}
            {order.sent && (
              <Button variant="batchline" disabled={running || pending || !showSim} onClick={onSimulate}>
                <span className="h-2 w-2 rounded-full bg-white" style={{ animation: running ? undefined : "pulseDot 1.4s infinite" }} />
                {running ? "Batch running in Batchline…" : "Simulate batch in Batchline"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-4 border-t border-line pt-[18px] max-md:grid-cols-2">
          {stats.map((s) => (
            <div key={s.k}>
              <div className="text-[11px] font-semibold uppercase tracking-[.6px] text-faint">{s.k}</div>
              <div className="mt-1 font-mono text-[13px] font-medium text-ink">{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Error Banner */}
      {lastError && !order.sent && (
        <div className="mb-[18px] overflow-hidden rounded-[14px] border border-[#e8a89e] bg-[#fbf3f1] p-5 shadow-[0_1px_2px_rgba(74,50,34,.04)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8432a] text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold text-[#8a2216]">
                    Batchline Dispatch Failed ({lastError.status ? `HTTP ${lastError.status}` : "Network Error"})
                  </span>
                  <span className="rounded bg-[#f5d5cf] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#8a2216]">
                    {lastError.status}
                  </span>
                </div>
                {lastError.errorDetail && (
                  <div className="mt-1.5 text-[13px] text-[#5c1d1a] leading-relaxed">
                    {lastError.errorDetail.includes("|") ? (
                      <ul className="list-disc pl-4 space-y-1">
                        {lastError.errorDetail.split("|").map((line, idx) => {
                          const trimmed = line.trim();
                          return trimmed ? <li key={idx}>{trimmed}</li> : null;
                        })}
                      </ul>
                    ) : (
                      <p>{lastError.errorDetail}</p>
                    )}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-3 text-[11.5px] text-[#8a2216]/80 font-mono">
                  <span>{new Date(lastError.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              disabled={!order.fullyAssigned || pending}
              onClick={onSend}
              className="shrink-0 border-[#d8897e] bg-white text-[#8a2216] hover:bg-[#faeae6] text-[12.5px] py-1.5 px-3"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Retry Dispatch
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start gap-[18px] max-lg:grid-cols-1">
        {/* BOM */}
        <div className="h-[600px] overflow-hidden rounded-[10px] border border-black/20 bg-panel shadow-[0_1px_2px_rgba(74,50,34,.04)]">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-[15px]">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-espresso" />
            <span className="text-[14px] font-semibold text-ink">Bill of materials</span>
            <span className="ml-auto text-[11.5px] text-faint">Stage · {order.stageName}</span>
          </div>
          <div className="px-5 pb-[18px] pt-1.5">
            {order.bom.map((b) => {
              const requiredNum = Number(b.required) || 1;
              const totalConsumedForLine = b.lots.reduce((sum, la) => {
                return sum + (consumedLots.get(la.lotId) ?? 0);
              }, 0);

              const hasConsumption = totalConsumedForLine > 0;
              const consumedPct = Math.min(100, Math.round((totalConsumedForLine / requiredNum) * 100));
              const isFullyConsumed = totalConsumedForLine >= requiredNum - 1e-4;

              return (
                <div key={b.id} className="border-b border-[#f2ebdd] py-[15px] last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <span className="text-[13.5px] font-semibold text-ink">{b.material}</span>{" "}
                      <span className="font-mono text-[11px] text-faint">{b.bomId}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[12.5px] font-medium text-ink">
                        <span className={isFullyConsumed ? "font-bold text-[#526d25]" : hasConsumption ? "font-bold text-amber-ink" : "font-semibold text-[#a8432a]"}>
                          {hasConsumption ? totalConsumedForLine.toFixed(1) : "0.0"}
                        </span>
                        {" "}/ {b.required} <span className="text-faint">{b.uom}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Consumption Progress Bar */}
                  <div className="my-2 h-[8px] overflow-hidden rounded-[5px] bg-[#fae8e6]">
                    <div
                      className="h-full rounded-[5px] transition-all duration-500 ease-out"
                      style={{
                        width: `${hasConsumption ? Math.max(consumedPct, 3) : 0}%`,
                        background: isFullyConsumed
                          ? "#7d9540"
                          : hasConsumption
                            ? "#b87333"
                            : "#d9534f",
                      }}
                    />
                  </div>

                  {/* Consumed vs Pending Status Note */}
                  <div className="mb-2 flex items-center justify-between text-[11px]">
                    <span className="text-muted font-medium">
                      {isFullyConsumed ? (
                        <span className="text-[#526d25] font-semibold">✓ Fully Consumed (100%)</span>
                      ) : hasConsumption ? (
                        <span className="text-amber-ink font-semibold">In Progress ({consumedPct}% dispensed)</span>
                      ) : (
                        <span className="text-[#a8432a] font-semibold">● 0% Consumed (Pending Dispense)</span>
                      )}
                    </span>
                    <span className="font-mono text-[11px] text-faint">
                      Allocated: {b.assigned} {b.uom}
                    </span>
                  </div>

                  {/* Lots with Dynamic Checkmarks */}
                  <div className="space-y-1.5">
                    {b.lots.map((la) => {
                      const isLotConsumed = (consumedLots.get(la.lotId) ?? 0) > 0;
                      const lotConsumedQty = consumedLots.get(la.lotId) ?? 0;

                      return (
                        <div
                          key={la.lotId}
                          className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-all ${isLotConsumed
                            ? "border-[#c4deb0] bg-[#f4f9ed] text-[#3e561c]"
                            : "border-[#eddacf] bg-[#fdfcf9] text-muted"
                            }`}
                        >
                          {isLotConsumed ? (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#6d8a34] text-white shadow-xs">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          ) : (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[#d98276] bg-white">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#d05040]" />
                            </span>
                          )}

                          <span className={`font-mono text-[12px] ${isLotConsumed ? "font-bold text-ink" : "text-ink"}`}>
                            {la.lotId}
                          </span>

                          {isLotConsumed ? (
                            <span className="rounded bg-[#e0edd0] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#486320]">
                              Dispensed ({lotConsumedQty} {b.uom})
                            </span>
                          ) : (
                            <span className="rounded bg-[#fbebe8] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#b54c3a]">
                              Pending Dispense
                            </span>
                          )}

                          <span className={`ml-auto font-mono text-[12px] ${isLotConsumed ? "font-bold text-[#486320]" : "text-muted"}`}>
                            {la.quantity} {b.uom}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Execution */}
        <div className="h-[600px] overflow-hidden rounded-[10px] border border-black/20 bg-panel shadow-[0_1px_2px_rgba(74,50,34,.04)]">
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

      {/* Edit Order Modal */}
      {editOpen && (
        <OrderWizard
          key={`edit-${order.orderNo}-${order.size}-${editOpen}`}
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            router.refresh();
          }}
          materials={materials}
          lots={lots}
          recipes={recipes}
          initialOrder={order}
        />
      )}
    </div>
  );
}
