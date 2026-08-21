"use client";
import type { OrderVM } from "@/lib/domain/types";

export function YieldPanel({ order }: { order: OrderVM }) {
  if (order.yieldPct == null) return null;
  return (
    <div className="mx-5 mb-1 mt-4 rounded-[11px] border border-[#e6d3ad] bg-gradient-to-br from-panel-2 to-[#f1e3cc] px-[18px] py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-[.6px] text-amber-ink">Yield</span>
        <span className="font-mono text-[22px] font-semibold text-espresso-deep">{order.yieldPct}%</span>
      </div>
      <div className="mb-2.5 h-2 overflow-hidden rounded-[5px] bg-[#e6d3ad]">
        <div className="h-full bg-amber" style={{ width: `${Math.min(100, order.yieldPct)}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[12px] text-muted">
        <span>Actual {order.yieldActual} {order.uom}</span>
        <span>Plan {order.yieldPlan} {order.uom}</span>
      </div>
    </div>
  );
}
