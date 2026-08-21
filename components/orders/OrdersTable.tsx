"use client";
import { useState } from "react";
import Link from "next/link";
import type { OrderVM, MaterialVM, LotVM } from "@/lib/domain/types";
import { Table, Th, Td } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { OrderWizard } from "./OrderWizard";

export function OrdersTable({ orders, materials, lots }: { orders: OrderVM[]; materials: MaterialVM[]; lots: LotVM[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New order
        </Button>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Order</Th><Th>Product</Th><Th right>Size</Th><Th>Planned</Th><Th>Batch ID</Th><Th>Status</Th><Th right />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="group cursor-pointer hover:bg-[#faf5ec]">
              <Td mono className="font-semibold text-espresso"><Link href={`/orders/${o.orderNo}`} className="block">{o.orderNo}</Link></Td>
              <Td className="text-ink"><Link href={`/orders/${o.orderNo}`} className="block text-ink">{o.product} <span className="font-mono text-[11px] text-faint">{o.productId}</span></Link></Td>
              <Td mono right className="text-ink">{o.size} <span className="text-faint">{o.uom}</span></Td>
              <Td mono className="text-[12px] text-muted">{o.planStart} → {o.planEnd}</Td>
              <Td mono className="text-[12px]" style={{ color: o.batchId ? "#8a5a22" : "#c3ad8f" }}>{o.batchId ?? "—"}</Td>
              <Td><Pill status={o.status} /></Td>
              <Td right>
                <Link href={`/orders/${o.orderNo}`} className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: o.sent ? "#a0611f" : "#8a5a22" }}>
                  {o.sent ? "Track" : "Open"}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <OrderWizard open={open} onClose={() => setOpen(false)} materials={materials} lots={lots} />
    </>
  );
}
