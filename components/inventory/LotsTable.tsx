"use client";
import { useState } from "react";
import type { LotVM, MaterialVM } from "@/lib/domain/types";
import { Table, Th, Td } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ReceiveLotForm } from "./ReceiveLotForm";
import { IssueStockForm } from "./IssueStockForm";
import { LotHistory } from "./LotHistory";

export function LotsTable({ lots, materials }: { lots: LotVM[]; materials: MaterialVM[] }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ lot: LotVM; x: number; y: number } | null>(null);
  const [issueLot, setIssueLot] = useState<LotVM | null>(null);
  const [historyLot, setHistoryLot] = useState<LotVM | null>(null);

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>
          Receive lot
        </Button>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Lot ID</Th><Th>Material</Th><Th>Mat. ID</Th><Th right>Remaining</Th><Th>Location</Th><Th>Expiry</Th><Th>Status</Th><Th right />
          </tr>
        </thead>
        <tbody>
          {lots.map((l) => (
            <tr key={l.id} style={{ background: l.expired ? "#faf3f0" : undefined }}>
              <Td mono>
                <button onClick={() => setHistoryLot(l)} className="font-semibold text-espresso underline decoration-[#d8ccb8] underline-offset-2 hover:text-amber-ink">{l.lotId}</button>
              </Td>
              <Td className="text-ink">{l.material}</Td>
              <Td mono className="text-[12px] text-amber-ink">{l.materialId}</Td>
              <Td mono right className="font-semibold text-ink">{l.quantity} <span className="font-normal text-faint">{l.uom}</span></Td>
              <Td mono className="text-muted">{l.location ?? "—"}</Td>
              <Td mono style={{ color: l.expired ? "#a8432a" : "#7c6d58" }}>{l.expiry ?? "—"}</Td>
              <Td><Pill status={l.status} /></Td>
              <Td right>
                <button
                  onClick={(e) => setMenu({ lot: l, x: e.clientX, y: e.clientY })}
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-[#e0d3bf] bg-white text-muted hover:bg-panel-2"
                  aria-label="Actions"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {menu && (
        <div className="fixed inset-0 z-[75]" onClick={() => setMenu(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ top: menu.y + 8, left: menu.x - 152 }} className="fixed min-w-[168px] rounded-[10px] border border-border bg-panel p-1 shadow-[0_12px_30px_rgba(46,32,22,.2)]">
            <button onClick={() => { setHistoryLot(menu.lot); setMenu(null); }} className="flex w-full items-center gap-2.5 rounded-md px-[11px] py-2.5 text-left text-[13px] font-medium text-ink hover:bg-panel-2">Movements history</button>
            <button onClick={() => { setIssueLot(menu.lot); setMenu(null); }} className="flex w-full items-center gap-2.5 rounded-md px-[11px] py-2.5 text-left text-[13px] font-medium text-ink hover:bg-panel-2">Issue stock</button>
          </div>
        </div>
      )}

      <ReceiveLotForm open={open} onClose={() => setOpen(false)} materials={materials} />
      <IssueStockForm open={!!issueLot} onClose={() => setIssueLot(null)} lot={issueLot} />
      <LotHistory open={!!historyLot} onClose={() => setHistoryLot(null)} lot={historyLot} />
    </>
  );
}
