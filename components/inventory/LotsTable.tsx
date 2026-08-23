"use client";
import { useState, useMemo } from "react";
import type { LotVM, MaterialVM } from "@/lib/domain/types";
import { Table, Th, Td } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { ReceiveLotForm } from "./ReceiveLotForm";
import { IssueStockForm } from "./IssueStockForm";
import { LotHistory } from "./LotHistory";

type SortKey = "lotId" | "material" | "materialId" | "quantity" | "location" | "expiry" | "status";

export function LotsTable({ lots, materials }: { lots: LotVM[]; materials: MaterialVM[] }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });
  const [menu, setMenu] = useState<{ lot: LotVM; x: number; y: number } | null>(null);
  const [issueLot, setIssueLot] = useState<LotVM | null>(null);
  const [historyLot, setHistoryLot] = useState<LotVM | null>(null);

  const rows = useMemo(() => {
    let list = lots;
    const s = searchQuery.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (l) =>
          l.lotId.toLowerCase().includes(s) ||
          l.material.toLowerCase().includes(s) ||
          l.materialId.toLowerCase().includes(s) ||
          (l.location && l.location.toLowerCase().includes(s)) ||
          l.status.toLowerCase().includes(s)
      );
    }
    if (sort.key) {
      const dir = sort.dir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const k = sort.key!;
        if (k === "quantity") {
          const aq = Number(a.quantity) || 0;
          const bq = Number(b.quantity) || 0;
          return (aq - bq) * dir;
        }
        if (k === "expiry") {
          const at = a.expiry ? new Date(a.expiry).getTime() : 0;
          const bt = b.expiry ? new Date(b.expiry).getTime() : 0;
          return (at - bt) * dir;
        }
        const av = (a[k] as string || "").toLowerCase();
        const bv = (b[k] as string || "").toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    return list;
  }, [lots, searchQuery, sort]);

  const isFiltered = searchQuery.trim() !== "";

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const arrow = (k: SortKey) => (sort.key === k ? (sort.dir === "asc" ? "▲" : "▼") : "↕");

  return (
    <>
      <PageIntro className="max-w-[760px]">
        <div>
          <div>
            Physical stock. Expired lots are flagged and cannot be assigned to an order. UOM is inherited
            from the material, never stored on the lot.
          </div>
          <div className="mt-1 text-[12px] text-muted">
            {isFiltered ? (
              <span>
                Showing <strong className="font-mono text-espresso">{rows.length}</strong> of{" "}
                <strong className="font-mono text-espresso">{lots.length}</strong> lots found
              </span>
            ) : (
              <span>
                Total <strong className="font-mono text-espresso">{lots.length}</strong> lots
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
            placeholder="Search lot ID, material, location or status — Enter"
            className="w-[340px] rounded-lg border border-[#d8ccb8] bg-panel pl-8 pr-8 py-2 text-[12.5px] text-ink placeholder:text-faint focus:border-amber focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 text-faint hover:text-ink focus:outline-none"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <Button onClick={() => setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8v13H3V8" />
            <path d="M1 3h22v5H1z" />
            <path d="M10 12h4" />
          </svg>
          Receive lot
        </Button>
      </div>

      <Table containerClassName="max-h-[calc(100vh-245px)] overflow-y-auto">
        <thead>
          <tr>
            <Th onClick={() => toggleSort("lotId")} className="cursor-pointer select-none">
              Lot ID <span className="text-[9px] text-amber-ink">{arrow("lotId")}</span>
            </Th>
            <Th onClick={() => toggleSort("material")} className="cursor-pointer select-none">
              Material <span className="text-[9px] text-amber-ink">{arrow("material")}</span>
            </Th>
            <Th onClick={() => toggleSort("materialId")} className="cursor-pointer select-none">
              Mat. ID <span className="text-[9px] text-amber-ink">{arrow("materialId")}</span>
            </Th>
            <Th right onClick={() => toggleSort("quantity")} className="cursor-pointer select-none">
              Remaining <span className="text-[9px] text-amber-ink">{arrow("quantity")}</span>
            </Th>
            <Th onClick={() => toggleSort("location")} className="cursor-pointer select-none">
              Location <span className="text-[9px] text-amber-ink">{arrow("location")}</span>
            </Th>
            <Th onClick={() => toggleSort("expiry")} className="cursor-pointer select-none">
              Expiry <span className="text-[9px] text-amber-ink">{arrow("expiry")}</span>
            </Th>
            <Th onClick={() => toggleSort("status")} className="cursor-pointer select-none">
              Status <span className="text-[9px] text-amber-ink">{arrow("status")}</span>
            </Th>
            <Th right />
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} style={{ background: l.expired ? "#faf3f0" : undefined }} className="hover:bg-[#faf5ec] transition-colors">
              <Td mono>
                <button
                  onClick={() => setHistoryLot(l)}
                  className="font-semibold text-espresso underline decoration-[#d8ccb8] underline-offset-2 hover:text-amber-ink"
                >
                  {l.lotId}
                </button>
              </Td>
              <Td className="text-ink font-medium">{l.material}</Td>
              <Td mono className="text-[12px] text-amber-ink">{l.materialId}</Td>
              <Td mono right className="font-semibold text-ink">
                {l.quantity} <span className="font-normal text-faint">{l.uom}</span>
              </Td>
              <Td mono className="text-muted">{l.location ?? "—"}</Td>
              <Td mono style={{ color: l.expired ? "#a8432a" : "#7c6d58" }}>{l.expiry ?? "—"}</Td>
              <Td><Pill status={l.status} /></Td>
              <Td right>
                <button
                  onClick={(e) => setMenu({ lot: l, x: e.clientX, y: e.clientY })}
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[#e0d3bf] bg-white text-muted hover:bg-panel-2 transition-colors"
                  aria-label="Actions"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                </button>
              </Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="border-t border-line px-9 py-9 text-center text-[13px] text-faint">
                No lots match this search.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {menu && (
        <div className="fixed inset-0 z-[75]" onClick={() => setMenu(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ top: menu.y + 8, left: menu.x - 152 }}
            className="fixed min-w-[168px] rounded-[10px] border border-border bg-panel p-1 shadow-[0_12px_30px_rgba(46,32,22,.2)]"
          >
            <button
              onClick={() => {
                setHistoryLot(menu.lot);
                setMenu(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-[11px] py-2.5 text-left text-[13px] font-medium text-ink hover:bg-panel-2"
            >
              Movements history
            </button>
            <button
              onClick={() => {
                setIssueLot(menu.lot);
                setMenu(null);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-[11px] py-2.5 text-left text-[13px] font-medium text-ink hover:bg-panel-2"
            >
              Issue stock
            </button>
          </div>
        </div>
      )}

      <ReceiveLotForm open={open} onClose={() => setOpen(false)} materials={materials} />
      <IssueStockForm open={!!issueLot} onClose={() => setIssueLot(null)} lot={issueLot} />
      <LotHistory open={!!historyLot} onClose={() => setHistoryLot(null)} lot={historyLot} />
    </>
  );
}
