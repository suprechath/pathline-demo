"use client";
import type { LotVM } from "@/lib/domain/types";

export interface WizLotAllocation {
  lotId: string;
  assigned: string;
}

export interface WizLine {
  id: string;
  bomId: string;
  material: string;
  materialId: string;
  baseQty: number;
  required: number;
  uom: string;
  stageName?: string;
  allocations: WizLotAllocation[];
}

// Calculate calendar days remaining until lot expiration
export function getDaysUntilExpiry(expiryStr?: string | null): number | null {
  if (!expiryStr) return null;
  const expiryDate = new Date(expiryStr);
  if (isNaN(expiryDate.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);
  const diffMs = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// Helper: Filter in-stock lots and sort by nearest expiration date (FEFO - First Expired, First Out)
export function getFefoLots(materialId: string, lots: LotVM[]): LotVM[] {
  return lots
    .filter((lot) => lot.materialId === materialId && lot.assignable && Number(lot.quantity) > 0)
    .sort((a, b) => {
      if (!a.expiry && !b.expiry) return 0;
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return new Date(a.expiry).getTime() - new Date(b.expiry).getTime();
    });
}

export function LotAssigner({
  lines,
  lots,
  onChange,
  balanced,
}: {
  lines: WizLine[];
  lots: LotVM[];
  onChange: (l: WizLine[]) => void;
  balanced: boolean;
}) {
  // Update a specific allocation row for a BOM line
  const updateAllocation = (
    lineId: string,
    allocIndex: number,
    updates: Partial<WizLotAllocation>
  ) => {
    onChange(
      lines.map((l) => {
        if (l.id !== lineId) return l;
        const newAllocations = [...l.allocations];
        newAllocations[allocIndex] = { ...newAllocations[allocIndex], ...updates };
        return { ...l, allocations: newAllocations };
      })
    );
  };

  // Add another lot split allocation row for a BOM line
  const addAllocation = (lineId: string) => {
    onChange(
      lines.map((l) => {
        if (l.id !== lineId) return l;
        const fefoLots = getFefoLots(l.materialId, lots);
        const assignedLotIds = new Set(l.allocations.map((a) => a.lotId));
        const unusedLot = fefoLots.find((lot) => !assignedLotIds.has(lot.lotId)) || fefoLots[0];

        const totalAssignedSoFar = l.allocations.reduce(
          (sum, a) => sum + (Number(a.assigned) || 0),
          0
        );
        const remainingNeeded = Math.max(0, l.required - totalAssignedSoFar);

        return {
          ...l,
          allocations: [
            ...l.allocations,
            {
              lotId: unusedLot?.lotId ?? "",
              assigned: remainingNeeded > 0 ? String(remainingNeeded) : "0",
            },
          ],
        };
      })
    );
  };

  // Remove a lot allocation row
  const removeAllocation = (lineId: string, allocIndex: number) => {
    onChange(
      lines.map((l) => {
        if (l.id !== lineId) return l;
        if (l.allocations.length <= 1) return l;
        const newAllocations = l.allocations.filter((_, i) => i !== allocIndex);
        return { ...l, allocations: newAllocations };
      })
    );
  };

  // Smart Auto-assign: distributes required quantity across FEFO lots (splitting if necessary)
  const autofill = () => {
    onChange(
      lines.map((l) => {
        const fefoLots = getFefoLots(l.materialId, lots);
        if (fefoLots.length === 0) {
          return {
            ...l,
            allocations: [{ lotId: "", assigned: String(l.required) }],
          };
        }

        let needed = l.required;
        const newAllocations: WizLotAllocation[] = [];

        for (const lot of fefoLots) {
          if (needed <= 0) break;
          const availQty = Number(lot.quantity) || 0;
          if (availQty <= 0) continue;

          const allocQty = Math.min(needed, availQty);
          newAllocations.push({
            lotId: lot.lotId,
            assigned: String(Math.round(allocQty * 1000) / 1000),
          });
          needed -= allocQty;
        }

        // If needed remains but no more stock, assign remaining to the last lot or first
        if (needed > 0) {
          if (newAllocations.length > 0) {
            const last = newAllocations[newAllocations.length - 1];
            last.assigned = String(
              Math.round((Number(last.assigned) + needed) * 1000) / 1000
            );
          } else {
            newAllocations.push({
              lotId: fefoLots[0].lotId,
              assigned: String(l.required),
            });
          }
        }

        return {
          ...l,
          allocations: newAllocations.length > 0 ? newAllocations : [{ lotId: "", assigned: "0" }],
        };
      })
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[13.5px] font-semibold text-espresso-deep">Material Lot Allocation </h4>
          <p className="text-[12px] text-muted">
            Assign one or multiple in-stock lots per BOM line until required quantities are 100% balanced.
          </p>
        </div>
        <button
          type="button"
          onClick={autofill}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ccb8] bg-panel-2 px-3 py-1.5 text-[12px] font-semibold text-amber-ink transition-colors hover:border-amber hover:bg-[#faf5ec]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Auto-assign (FEFO)
        </button>
      </div>

      <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
        {lines.map((l) => {
          const totalAssigned = l.allocations.reduce(
            (sum, a) => sum + (Number(a.assigned) || 0),
            0
          );
          const pct = l.required > 0 ? Math.min(100, Math.round((totalAssigned / l.required) * 100)) : 0;
          const bal =
            Math.abs(totalAssigned - l.required) < 1e-6 &&
            l.allocations.length > 0 &&
            l.allocations.every((a) => a.lotId !== "" && Number(a.assigned) > 0);
          const over = totalAssigned > l.required;
          const color = bal ? "#7d9540" : over ? "#a8432a" : "#b87333";

          const fefoLots = getFefoLots(l.materialId, lots);

          return (
            <div
              key={l.id}
              className="rounded-xl border border-[#e8dcd0] bg-panel p-3.5 shadow-[0_1px_2px_rgba(74,50,34,.03)]"
            >
              {/* Header Info */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f2ebdd] pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-ink">{l.material}</span>
                    <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-amber-ink">
                      {l.bomId}
                    </span>
                    {l.stageName && (
                      <span className="text-[11px] text-faint">({l.stageName})</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted">
                    Required: <strong className="font-mono text-ink">{l.required} {l.uom}</strong>
                    {" · "}
                    Total Assigned:{" "}
                    <strong className="font-mono" style={{ color }}>
                      {Math.round(totalAssigned * 1000) / 1000} {l.uom}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addAllocation(l.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-[#d8ccb8] bg-panel px-2.5 py-1 text-[11.5px] font-semibold text-amber-ink hover:bg-panel-2 transition-colors"
                  >
                    + Split lot
                  </button>
                </div>
              </div>

              {/* Multi-Lot Allocation Rows */}
              <div className="mt-2.5 space-y-2">
                {l.allocations.map((alloc, allocIdx) => {
                  const selectedLot = lots.find((lot) => lot.lotId === alloc.lotId);
                  const selectedDaysLeft = getDaysUntilExpiry(selectedLot?.expiry);

                  return (
                    <div
                      key={allocIdx}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#faf6ee] p-2"
                    >
                      <div className="flex flex-1 min-w-[280px] items-center gap-2">
                        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#ebdcc8] font-mono text-[10px] font-bold text-espresso">
                          {allocIdx + 1}
                        </span>

                        {fefoLots.length > 0 ? (
                          <select
                            value={alloc.lotId}
                            onChange={(e) =>
                              updateAllocation(l.id, allocIdx, { lotId: e.target.value })
                            }
                            className="flex-1 min-w-0 rounded-lg border border-[#d8ccb8] bg-white px-2.5 py-1.5 font-mono text-[12px] text-ink focus:border-amber focus:outline-none"
                          >
                            <option value="">Select Lot (FEFO)…</option>
                            {fefoLots.map((lot, idx) => (
                              <option key={lot.id} value={lot.lotId}>
                                {idx === 0 ? "★ " : ""}{lot.lotId} ({lot.quantity} {lot.uom} · {lot.expiry} · {lot.location ?? "WH"})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="rounded bg-amber-50 px-2 py-1 text-[11.5px] font-semibold text-amber-700">
                            No stock in inventory
                          </span>
                        )}

                        {selectedLot && selectedDaysLeft !== null && (
                          <span
                            className={`flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10.5px] ${selectedDaysLeft <= 0
                              ? "bg-red-100 font-bold text-red-700"
                              : selectedDaysLeft <= 60
                                ? "bg-amber-100 font-semibold text-amber-800"
                                : "bg-[#efe9dc] text-espresso"
                              }`}
                          >
                            {selectedDaysLeft <= 0
                              ? `Expired (${Math.abs(selectedDaysLeft)}d ago)`
                              : `${selectedDaysLeft}d left`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="any"
                          value={alloc.assigned}
                          onChange={(e) =>
                            updateAllocation(l.id, allocIdx, { assigned: e.target.value })
                          }
                          className="w-[85px] rounded-lg border bg-white px-2.5 py-1.5 text-right font-mono text-[12.5px] text-ink focus:border-amber focus:outline-none"
                          style={{
                            borderColor: bal ? "#7d9540" : over ? "#c9857a" : "#d8ccb8",
                          }}
                        />
                        <span className="w-6 font-mono text-[12px] text-faint">/{l.uom}</span>

                        {l.allocations.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAllocation(l.id, allocIdx)}
                            title="Remove split lot"
                            className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600 focus:outline-none transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eee4d6]">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-[11px] font-semibold" style={{ color }}>
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="flex items-center gap-2.5 rounded-xl border px-4 py-3"
        style={{
          background: balanced ? "#eef2e4" : "#fbf4eb",
          borderColor: balanced ? "#cfdcb0" : "#ecd8c0",
          color: balanced ? "#4b6422" : "#9b581b",
        }}
      >
        {balanced ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b6422" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9b581b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        )}
        <div className="text-[12.5px] font-semibold">
          {balanced
            ? "All BOM lines are 100% balanced with valid in-stock lots — ready to create and send to Batchline."
            : "Every BOM line must have assigned lots and the combined quantity must exactly equal the required amount."}
        </div>
      </div>
    </div>
  );
}
