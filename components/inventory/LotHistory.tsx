"use client";
import { useEffect, useState } from "react";
import type { LotVM } from "@/lib/domain/types";
import { fetchLedger } from "@/app/inventory/actions";
import type { LotLedgerVM } from "@/lib/data/movements";
import { Modal, ModalHeader } from "@/components/ui/Modal";

export function LotHistory({ open, onClose, lot }: { open: boolean; onClose: () => void; lot: LotVM | null }) {
  const [ledger, setLedger] = useState<LotLedgerVM | null>(null);
  useEffect(() => {
    if (open && lot) { setLedger(null); fetchLedger(lot.lotId).then(setLedger); }
  }, [open, lot]);
  if (!lot) return null;

  return (
    <Modal open={open} onClose={onClose} width={440}>
      <ModalHeader title={`Stock movements · ${lot.lotId}`} onClose={onClose} />
      <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
        <Tile k="Incoming" v={`${ledger?.incoming ?? "…"} ${lot.uom}`} c="#2e2016" />
        <Tile k="Issued" v={`${ledger?.issued ?? "…"} ${lot.uom}`} c="#a8432a" />
        <Tile k="On hand" v={`${ledger?.onHand ?? "…"} ${lot.uom}`} c="#556b2c" />
      </div>
      <div className="max-h-[420px] overflow-auto px-[22px] py-3.5">
        {!ledger && <div className="py-8 text-center text-[13px] text-faint">Loading…</div>}
        {ledger?.movements.map((m) => (
          <div key={m.id} className="flex gap-3 border-t border-[#f2ebdd] py-2.5 first:border-0">
            <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg" style={{ background: m.quantity >= 0 ? "#e2e8d5" : "#f2ddd5", color: m.quantity >= 0 ? "#556b2c" : "#a8432a" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">{m.quantity >= 0 ? <><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></> : <><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>}</svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2.5">
                <span className="text-[13px] font-semibold text-ink">{m.reason}</span>
                <span className="font-mono text-[13px] font-semibold" style={{ color: m.quantity >= 0 ? "#556b2c" : "#a8432a" }}>{m.quantity >= 0 ? "+" : ""}{m.quantity} {lot.uom}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2.5">
                <span className="text-[11.5px] text-faint">{m.note ?? "—"}</span>
                <span className="font-mono text-[11.5px] text-muted">{m.balance} {lot.uom}</span>
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] text-[#b0a084]">{m.at} · {m.user ?? "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Tile({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div className="bg-panel px-4 py-3">
      <div className="text-[10px] uppercase tracking-[.6px] text-faint">{k}</div>
      <div className="mt-0.5 font-mono text-[14px] font-semibold" style={{ color: c }}>{v}</div>
    </div>
  );
}
