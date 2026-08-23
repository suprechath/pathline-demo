"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import type { OrderVM, MaterialVM, LotVM } from "@/lib/domain/types";
import type { RecipeVM } from "@/lib/data/recipes";
import { Table, Th, Td } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { OrderWizard } from "./OrderWizard";

export function OrdersTable({
  orders,
  materials,
  lots,
  recipes = [],
}: {
  orders: OrderVM[];
  materials: MaterialVM[];
  lots: LotVM[];
  recipes?: RecipeVM[];
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(s) ||
        o.product.toLowerCase().includes(s) ||
        o.productId.toLowerCase().includes(s) ||
        (o.batchId && o.batchId.toLowerCase().includes(s))
    );
  }, [orders, searchQuery]);

  const isFiltered = searchQuery.trim() !== "";

  return (
    <>
      <PageIntro className="max-w-[760px]">
        <div>
          Process orders. Build an order, assign lots until the sum bar balances, then send to Batchline
          and watch execution return live in the drill-down.
          <div className="mt-1 text-[12px] text-muted">
            {isFiltered ? (
              <span>
                Showing <strong className="font-mono text-espresso">{filteredOrders.length}</strong> of{" "}
                <strong className="font-mono text-espresso">{orders.length}</strong> orders found
              </span>
            ) : (
              <span>
                Total <strong className="font-mono text-espresso">{orders.length}</strong> orders
              </span>
            )}
          </div>
        </div>
      </PageIntro>

      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="relative flex items-center">
          <svg
            className="pointer-events-none absolute left-3 text-faint"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order no, product or batch ID — Enter"
            className="w-[340px] rounded-lg border border-[#d8ccb8] bg-panel pl-8 pr-3 py-2 text-[12.5px] text-ink placeholder:text-faint focus:border-amber focus:outline-none"
          />
        </div>
        <Button onClick={() => setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New order
        </Button>
      </div>

      <Table containerClassName="max-h-[calc(100vh-245px)] overflow-y-auto">
        <thead>
          <tr>
            <Th>Order</Th>
            <Th>Product</Th>
            <Th right>Size</Th>
            <Th>Planned</Th>
            <Th>Batch ID</Th>
            <Th>Status</Th>
            <Th right />
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map((o) => (
            <tr key={o.id} className="group cursor-pointer hover:bg-[#faf5ec]">
              <Td mono className="font-semibold text-espresso">
                <Link href={`/orders/${o.orderNo}`} className="block">
                  {o.orderNo}
                </Link>
              </Td>
              <Td className="text-ink">
                <Link href={`/orders/${o.orderNo}`} className="block text-ink">
                  {o.product} <span className="font-mono text-[11px] text-faint">{o.productId}</span>
                </Link>
              </Td>
              <Td mono right className="text-ink">
                {o.size} <span className="text-faint">{o.uom}</span>
              </Td>
              <Td mono className="text-[12px] text-muted">
                {o.planStart} → {o.planEnd}
              </Td>
              <Td mono className="text-[12px]" style={{ color: o.batchId ? "#8a5a22" : "#c3ad8f" }}>
                {o.batchId ?? "—"}
              </Td>
              <Td>
                <Pill status={o.status} />
              </Td>
              <Td right>
                <Link
                  href={`/orders/${o.orderNo}`}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  style={{ color: o.sent ? "#a0611f" : "#8a5a22" }}
                >
                  {o.sent ? "Track" : "Open"}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              </Td>
            </tr>
          ))}
          {filteredOrders.length === 0 && (
            <tr>
              <td colSpan={7} className="border-t border-line px-9 py-9 text-center text-[13px] text-faint">
                No orders match this search.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <OrderWizard open={open} onClose={() => setOpen(false)} materials={materials} lots={lots} recipes={recipes} />
    </>
  );
}

