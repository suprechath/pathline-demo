"use client";
import { useEffect, useState } from "react";
import type { LotVM } from "@/lib/domain/types";
import { fetchLedger } from "@/app/inventory/actions";
import type { LotLedgerVM } from "@/lib/data/movements";
import { Modal, ModalHeader } from "@/components/ui/Modal";

type ReasonSpec = {
  bg: string;
  fg: string;
  icon: React.ReactNode;
};

function getMovementStyle(reason: string, qty: number): ReasonSpec {
  const r = reason.toLowerCase();

  // 1. Goods Receipt / Inbound Arrival
  if (r.includes("receipt") || r.includes("incoming")) {
    return {
      bg: "#e2eed2",
      fg: "#446e22",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    };
  }

  // 2. Issued to Order / Plant Dispensing
  if (r.includes("issue") || r.includes("order")) {
    return {
      bg: "#fceddb",
      fg: "#b85d19",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2v7.31L4.35 19.46A2 2 0 0 0 6.09 22h11.82a2 2 0 0 0 1.74-2.54L14 9.31V2h-4z" />
          <path d="M8.5 2h7" />
          <path d="M7 16h10" />
        </svg>
      ),
    };
  }

  // 3. QC Release / Approval
  if (r.includes("qc_release") || r.includes("qc release") || r.includes("approved")) {
    return {
      bg: "#e1f5e5",
      fg: "#2d7a36",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
    };
  }

  // 4. QC Sample / Lab Test
  if (r.includes("sample") || r.includes("qc_sample")) {
    return {
      bg: "#f1eafd",
      fg: "#6f3ba8",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2" />
          <path d="M8.5 2h7" />
          <path d="M9.5 12h5" />
        </svg>
      ),
    };
  }

  // 5. Reservation for Production
  if (r.includes("reserve") && !r.includes("release")) {
    return {
      bg: "#fbf0dc",
      fg: "#9a6516",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    };
  }

  // 6. Reservation Released
  if (r.includes("release") && !r.includes("qc")) {
    return {
      bg: "#e4edf9",
      fg: "#3e6399",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
      ),
    };
  }

  // 7. Sale / Dispatch
  if (r.includes("sale") || r.includes("dispatch")) {
    return {
      bg: "#e1ecf9",
      fg: "#24558f",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    };
  }

  // 8. Scrap / Destruction
  if (r.includes("scrap") || r.includes("write-off")) {
    return {
      bg: "#fde8e5",
      fg: "#b83823",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
    };
  }

  // 9. Rejection
  if (r.includes("reject")) {
    return {
      bg: "#fde5e5",
      fg: "#b82323",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    };
  }

  // 10. Adjustment / Reconciliation
  if (r.includes("adjust")) {
    return {
      bg: "#ece5da",
      fg: "#6c5b47",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      ),
    };
  }

  // Fallback by quantity sign
  return {
    bg: qty >= 0 ? "#e2eed2" : "#fde8e5",
    fg: qty >= 0 ? "#446e22" : "#b83823",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {qty >= 0 ? <path d="M12 5v14M19 12l-7 7-7-7" /> : <path d="M12 19V5M5 12l7-7 7 7" />}
      </svg>
    ),
  };
}

export function LotHistory({ open, onClose, lot }: { open: boolean; onClose: () => void; lot: LotVM | null }) {
  const [ledger, setLedger] = useState<LotLedgerVM | null>(null);
  useEffect(() => {
    if (open && lot) { setLedger(null); fetchLedger(lot.lotId).then(setLedger); }
  }, [open, lot]);
  if (!lot) return null;

  return (
    <Modal open={open} onClose={onClose} width={720}>
      <ModalHeader title={`Stock movements · ${lot.lotId}`} onClose={onClose} />
      <div className="grid grid-cols-4 gap-px border-b border-line bg-line">
        <Tile k="Incoming" v={`${ledger?.incoming ?? "…"} ${lot.uom}`} c="#2e2016" />
        <Tile k="Issued" v={`${ledger?.issued ?? "…"} ${lot.uom}`} c="#a8432a" />
        <Tile k="On hand" v={`${ledger?.onHand ?? "…"} ${lot.uom}`} c="#7c6d58" />
        <Tile k="Available" v={`${ledger?.available ?? "…"} ${lot.uom}`} c="#556b2c" />
      </div>
      <div className="max-h-[720px] overflow-auto px-[22px] py-3.5">
        {!ledger && <div className="py-8 text-center text-[13px] text-faint">Loading…</div>}
        {ledger?.movements.map((m) => {
          const style = getMovementStyle(m.reason, m.quantity);
          return (
            <div key={m.id} className="flex gap-3 border-t border-[#f2ebdd] py-2.5 first:border-0">
              <span
                className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-lg shadow-xs transition-colors"
                style={{ background: style.bg, color: style.fg }}
              >
                {style.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className="text-[13px] font-semibold text-ink">{m.reason}</span>
                  <span className="font-mono text-[13px] font-semibold" style={{ color: m.quantity >= 0 ? "#556b2c" : "#a8432a" }}>
                    {m.quantity >= 0 ? "+" : ""}{m.quantity} {lot.uom}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className="text-[11.5px] text-faint truncate">{m.note ?? "—"}</span>
                  <span className="font-mono text-[11.5px] text-muted">{m.balance} {lot.uom}</span>
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-[#b0a084]">{m.at} · {m.user ?? "—"}</div>
              </div>
            </div>
          );
        })}
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
