"use client";
import { useMemo } from "react";
import type { EventVM } from "@/lib/domain/types";

const ICONS: Record<string, { bg: string; fg: string; path: string }> = {
  BATCH_STATUS: { bg: "#e2e8d5", fg: "#556b2c", path: "circle:12,12,9|M9 12l2 2 4-4" },
  INSTRUCTION: { bg: "#f0dcc0", fg: "#a0611f", path: "M20 6L9 17l-5-5" },
  EXCEPTION: { bg: "#f2ddd5", fg: "#a8432a", path: "M12 9v4M12 17h.01|M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z" },
};

function EvIcon({ kind }: { kind: string }) {
  const spec = ICONS[kind] ?? ICONS.INSTRUCTION;
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {spec.path.split("|").map((p, i) =>
        p.startsWith("circle:") ? (
          (() => { const [cx, cy, r] = p.slice(7).split(",").map(Number); return <circle key={i} cx={cx} cy={cy} r={r} />; })()
        ) : (
          <path key={i} d={p} />
        ),
      )}
    </svg>
  );
}

function formatEventTime(isoString?: string) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return null;
  }
}

export function ExecutionTimeline({ events, emptyMsg, running }: { events: EventVM[]; emptyMsg: string; running: boolean }) {
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) {
        return timeB - timeA;
      }
      return (b.seq ?? 0) - (a.seq ?? 0);
    });
  }, [events]);

  return (
    <div className="px-5 pb-5 pt-2.5">
      {sortedEvents.length === 0 ? (
        <div className="px-5 py-11 text-center text-faint">
          <div className="mx-auto mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-panel-2">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c3ad8f" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <div className="mx-auto max-w-[250px] text-[13px] leading-[1.5]">{running ? "Waiting for Batchline…" : emptyMsg}</div>
        </div>
      ) : (
        sortedEvents.map((e, index) => {
          const spec = ICONS[e.kind] ?? ICONS.INSTRUCTION;
          const hasMeasure = !!e.actualValue;
          const isLatest = index === 0;
          const isLast = index === sortedEvents.length - 1;
          const timeLabel = formatEventTime(e.createdAt);

          return (
            <div key={e.id} className="flex gap-3.5" style={{ animation: "evin .45s ease both" }}>
              <div className="flex flex-none flex-col items-center">
                <span
                  className={`relative flex h-[26px] w-[26px] items-center justify-center rounded-lg ${
                    isLatest && running ? "ring-2 ring-[#0fa396] ring-offset-1" : ""
                  }`}
                  style={{ background: spec.bg, color: spec.fg }}
                >
                  <EvIcon kind={e.kind} />
                  {isLatest && running && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0fa396] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0fa396]"></span>
                    </span>
                  )}
                </span>
                <span className={`my-0.5 min-h-2 w-0.5 flex-1 ${isLast ? "opacity-0" : "bg-line"}`} />
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: e.kind === "EXCEPTION" ? "#a8432a" : "#2e2016" }}>{e.title}</span>
                  {isLatest && (
                    <span className="rounded-[4px] bg-[#eef7e8] border border-[#cbe4bc] px-[5px] py-0.5 text-[9.5px] font-bold uppercase tracking-[.4px] text-[#4d6b24]">
                      Latest
                    </span>
                  )}
                  {e.hasException && <span className="rounded-[5px] bg-[#f2ddd5] px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[.5px] text-[#a8432a]">{e.exceptionLevel}</span>}
                  {timeLabel && (
                    <span className="ml-auto font-mono text-[11px] text-faint">
                      {timeLabel}
                    </span>
                  )}
                </div>
                {e.detail && <div className="mt-0.5 text-[12.5px] text-muted">{e.detail}</div>}
                {hasMeasure && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-md px-2.5 py-[3px] font-mono text-[11.5px]" style={{ background: e.hasException ? "#f2ddd5" : "#e2e8d5", color: e.hasException ? "#a8432a" : "#556b2c" }}>actual {e.actualValue} {e.uom}</span>
                    <span className="rounded-md bg-[#f2ebdd] px-2.5 py-[3px] font-mono text-[11.5px] text-muted">target {e.targetValue} {e.uom}</span>
                    {e.lotRef && <span className="rounded-md bg-panel-2 px-2.5 py-[3px] font-mono text-[11.5px] text-amber-ink">{e.lotRef}</span>}
                  </div>
                )}
                {e.wireNote && <div className="mt-1.5 font-mono text-[10.5px] text-[#b0a084]">{e.wireNote}</div>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
