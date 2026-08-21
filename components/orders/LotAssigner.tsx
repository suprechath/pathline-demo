"use client";

export interface WizLine {
  id: string;
  bomId: string;
  material: string;
  materialId: string;
  required: number;
  uom: string;
  lotId: string;
  assigned: string;
}

// Step 3 of the wizard: assign lots until every line's quantity sums exactly
// to its BOM quantity. Mirrors the rule Batchline validates on the way in.
export function LotAssigner({ lines, onChange, balanced }: { lines: WizLine[]; onChange: (l: WizLine[]) => void; balanced: boolean }) {
  const setLine = (id: string, assigned: string) => onChange(lines.map((l) => (l.id === id ? { ...l, assigned } : l)));
  const autofill = () => onChange(lines.map((l) => ({ ...l, assigned: String(l.required) })));

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[12.5px] text-muted">Assign lots until every line balances.</span>
        <button onClick={autofill} className="rounded-md border border-[#d8ccb8] px-3 py-1.5 text-[12px] font-semibold text-amber-ink hover:bg-panel-2">Auto-assign</button>
      </div>

      {lines.map((l) => {
        const a = Number(l.assigned) || 0;
        const pct = Math.min(100, Math.round((a / l.required) * 100));
        const bal = Math.abs(a - l.required) < 1e-6;
        const over = a > l.required;
        const color = bal ? "#7d9540" : over ? "#a8432a" : "#b87333";
        return (
          <div key={l.id} className="border-t border-line py-3">
            <div className="flex items-baseline justify-between gap-2.5">
              <div><span className="text-[13px] font-semibold text-ink">{l.material}</span> <span className="font-mono text-[11px] text-faint">{l.lotId}</span></div>
              <div className="flex items-center gap-1.5">
                <input
                  value={l.assigned}
                  onChange={(e) => setLine(l.id, e.target.value)}
                  className="w-[76px] rounded-md border bg-white px-2.5 py-1.5 text-right font-mono text-[12.5px] focus:border-amber focus:outline-none"
                  style={{ borderColor: bal ? "#7d9540" : over ? "#c9857a" : "#d8ccb8" }}
                />
                <span className="font-mono text-[12px] text-faint">/ {l.required} {l.uom}</span>
              </div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-[5px] bg-line">
              <div className="h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}

      <div
        className="mt-3.5 flex items-center gap-2.5 rounded-[10px] border px-[15px] py-3"
        style={{ background: balanced ? "#eef2e4" : "#f6efe3", borderColor: balanced ? "#cfdcb0" : "#ece0cc", color: balanced ? "#556b2c" : "#a0611f" }}
      >
        {balanced ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#556b2c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a0611f" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
        )}
        <span className="text-[13px] font-semibold">
          {balanced ? "All lines balanced — ready to send to Batchline." : "Lot quantities must sum exactly to each BOM quantity."}
        </span>
      </div>
    </div>
  );
}
