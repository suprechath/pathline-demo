"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HoldVM } from "@/lib/data/lims";
import { receiveSample, recordResult, simulateIncoming } from "@/app/lims/actions";
import { toast } from "@/components/ui/Toast";

const PILL: Record<HoldVM["status"], { label: string; bg: string; fg: string }> = {
  PENDING: { label: "Awaiting sample", bg: "#e7e9f0", fg: "#6b7385" },
  IN_TEST: { label: "In test", bg: "#ede7ff", fg: "#6d4ac4" },
  AWAITING_RESULT: { label: "Awaiting result", bg: "#e3dcff", fg: "#5b34d6" },
  RELEASED: { label: "Released", bg: "#d9ede2", fg: "#1f7a4d" },
  FAILED: { label: "Failed", bg: "#f6dcda", fg: "#c23934" },
};

function evalVerdict(spec: HoldVM["spec"], v: string | number): "pass" | "fail" | "empty" {
  if (spec.limitType === "OPTIONS") {
    const s = String(v).trim();
    if (!s) return "empty";
    const exp = spec.expectedValue?.trim().toLowerCase();
    return exp && s.toLowerCase() === exp ? "pass" : "fail";
  }
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (Number.isNaN(n) || String(v).trim() === "") return "empty";
  if (spec.limitType === "MAX") return spec.upper != null && n <= spec.upper ? "pass" : "fail";
  if (spec.limitType === "MIN") return spec.lower != null && n >= spec.lower ? "pass" : "fail";
  return spec.lower != null && spec.upper != null && n >= spec.lower && n <= spec.upper ? "pass" : "fail";
}

const Arrow = () => (
  <svg width="30" height="16" viewBox="0 0 30 16" fill="none" className="flex-none"><path d="M0 8h24M24 8l-5-4M24 8l-5 4" stroke="#b6bccb" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function HoldsBoard({ holds, stats }: { holds: HoldVM[]; stats: { onHold: number; pending: number } }) {
  const [selId, setSelId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const sel = holds.find((h) => h.sampleId === selId) ?? null;

  const run = (fn: () => Promise<{ ok: boolean; message: string; system?: "pathline" | "batchline" }>, close = false) =>
    start(async () => {
      const res = await fn();
      toast(res);
      if (!res.ok) {
        alert(res.message);
      }
      if (res.ok) {
        if (close) setSelId(null);
        router.refresh();
      }
    });

  return (
    <div className="mx-auto max-w-[1080px]">
      {/* handshake strip */}
      <div className="mb-[18px] flex items-center gap-3.5 rounded-xl border border-[#e4e7ee] bg-white px-[18px] py-[13px]">
        <Node color="#0fa396" text={<><b className="font-semibold text-[#0b7d76]">Batchline EBR</b> requests a test at a hold point</>} />
        <Arrow />
        <Node color="#7c4dff" text={<><b className="font-semibold text-[#5b34d6]">Assayline</b> tests &amp; records</>} />
        <Arrow />
        <Node color="#0fa396" text={<>result returns to <b className="font-semibold text-[#0b7d76]">EBR</b>, batch resumes</>} />
        <div className="ml-auto flex gap-4">
          <Stat n={stats.onHold} label="Batches on hold" color="#5b34d6" />
          <Stat n={stats.pending} label="Pending results" color="#1c2230" />
        </div>
      </div>

      <div className="mb-2.5 flex items-center">
        <div className="text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#8b93a6]">Pending hold points</div>
        <button
          onClick={() => run(simulateIncoming)}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-2 rounded-[9px] border border-[#bfeee7] bg-[#e9fbf8] px-3.5 py-2 text-[12px] font-semibold text-[#0b7d76] hover:bg-[#ddf6f1] disabled:opacity-60"
        >
          <span className="h-2 w-2 flex-none rounded-full bg-[#0fa396]" />
          Simulate EBR request
        </button>
      </div>

      {/* queue */}
      <div className="overflow-hidden rounded-[13px] border border-[#e4e7ee] bg-white shadow-[0_1px_2px_rgba(28,34,48,.04)]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f4f5f9] text-left">
              {["Sample ID", "Source (from EBR)", "Test required", "Requested", "Status", ""].map((h, i) => (
                <th key={i} className="px-[18px] py-3 text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#8b93a6]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holds.map((h) => {
              const done = h.status === "RELEASED" || h.status === "FAILED";
              const p = PILL[h.status];
              const action = h.status === "PENDING" ? "Receive" : done ? "View" : "Enter result";
              const ac = h.status === "RELEASED" ? "#1f7a4d" : h.status === "FAILED" ? "#c23934" : "#6d4ac4";
              return (
                <tr
                  key={h.id}
                  onClick={() => setSelId(h.sampleId)}
                  className="cursor-pointer border-t border-[#eef0f5] hover:bg-[#faf9ff]"
                  style={{ background: h.status === "RELEASED" ? "#f5faf7" : h.status === "FAILED" ? "#fdf6f5" : undefined }}
                >
                  <td className="px-[18px] py-3.5 font-mono font-semibold text-[#1c2230]">{h.sampleId}</td>
                  <td className="px-[18px] py-3.5">
                    <div className="flex items-center gap-2"><span className="h-2 w-2 flex-none rounded-sm bg-[#0fa396]" /><span className="font-mono font-semibold text-[#0b7d76]">{h.batchId}</span></div>
                  </td>
                  <td className="px-[18px] py-3.5 text-[#1c2230]">{testName(h)}</td>
                  <td className="px-[18px] py-3.5 font-mono text-[12px] text-[#6b7385]">{h.requested}</td>
                  <td className="px-[18px] py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: p.bg, color: p.fg }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.fg }} />{p.label}
                    </span>
                  </td>
                  <td className="px-[18px] py-3.5 text-right">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: ac }}>{action}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </span>
                  </td>
                </tr>
              );
            })}
            {holds.length === 0 && <tr><td colSpan={6} className="px-9 py-9 text-center text-[13px] text-[#9aa2b2]">No hold points. Simulate an EBR request to add one.</td></tr>}
          </tbody>
        </table>
      </div>

      {sel && <Drawer hold={sel} pending={pending} onClose={() => setSelId(null)} run={run} />}
    </div>
  );
}

function testName(h: HoldVM) {
  // The test name lives on the spec code mapping; parameter is the descriptor.
  return h.spec.method.startsWith("TM-BU") ? "Blend Uniformity (RSD)"
    : h.spec.method.startsWith("TM-PH") ? "pH"
    : h.spec.method.startsWith("TM-LOD") ? "Moisture (LOD)"
    : h.spec.method.startsWith("TM-ASSAY") ? "Assay (HPLC)"
    : h.spec.method.startsWith("TM-REL") ? "Final Batch Release"
    : h.spec.parameter;
}

function Node({ color, text }: { color: string; text: React.ReactNode }) {
  return <div className="flex items-center gap-2.5"><span className="h-[11px] w-[11px] flex-none rounded-sm" style={{ background: color }} /><span className="text-[12.5px] text-[#3a4256]">{text}</span></div>;
}
function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return <div className="text-right"><div className="font-mono text-[18px] font-semibold" style={{ color }}>{n}</div><div className="text-[10px] uppercase tracking-[.6px] text-[#9aa2b2]">{label}</div></div>;
}

function Drawer({ hold, pending, onClose, run }: {
  hold: HoldVM; pending: boolean; onClose: () => void;
  run: (fn: () => Promise<{ ok: boolean; message: string; system?: "pathline" | "batchline" }>, close?: boolean) => void;
}) {
  const isOptions = hold.spec.limitType === "OPTIONS";
  const [val, setVal] = useState(
    hold.result
      ? hold.result.measuredText ?? (hold.result.measuredValue != null ? String(hold.result.measuredValue) : "")
      : ""
  );
  const done = hold.status === "RELEASED" || hold.status === "FAILED";
  const measuredName = hold.result?.measuredName ?? defaultMeasured(hold);
  const p = PILL[hold.status];
  const ev = evalVerdict(hold.spec, val);
  const verdict =
    ev === "empty"
      ? { label: "Awaiting entry", bg: "#eef0f5", fg: "#8b93a6" }
      : ev === "pass"
      ? { label: "In spec", bg: "#d9ede2", fg: "#1f7a4d" }
      : { label: "Out of spec", bg: "#f6dcda", fg: "#c23934" };
  const canRecord = ev !== "empty";

  const optionsList = isOptions
    ? hold.spec.options && hold.spec.options.length > 0
      ? hold.spec.options
      : ["Released", "Rejected"]
    : [];

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex justify-end bg-[rgba(28,34,48,.4)] backdrop-blur-[2px]">
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-[560px] max-w-[94vw] flex-col bg-[#f7f8fb] shadow-[-16px_0_44px_rgba(28,34,48,.28)]" style={{ animation: "drawerin .28s ease both" }}>
        {/* header */}
        <div className="flex-none border-b border-[#e4e7ee] bg-white px-6 py-[18px]">
          <div className="flex items-start justify-between gap-3.5">
            <div>
              <div className="mb-[5px] flex items-center gap-2.5">
                <span className="font-mono text-[18px] font-semibold text-[#1c2230]">{hold.sampleId}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: p.bg, color: p.fg }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: p.fg }} />{p.label}</span>
              </div>
              <div className="text-[13.5px] font-medium text-[#1c2230]">{testName(hold)}</div>
              <div className="mt-[5px] flex items-center gap-[7px] text-[12px] text-[#6b7385]"><span className="h-2 w-2 flex-none rounded-sm bg-[#0fa396]" />from <span className="font-mono font-semibold text-[#0b7d76]">{hold.batchId}</span> · {hold.stageName}</div>
            </div>
            <button onClick={onClose} className="p-1 text-[#9aa2b2] hover:opacity-70" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-[18px]">
          {/* PENDING: receive sample */}
          {hold.status === "PENDING" && (
            <div className="rounded-xl border border-dashed border-[#d3d7e2] bg-white px-5 py-[34px] text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[13px] bg-[#f4f5f9]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a99ee0" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v5.5L5.2 18a2 2 0 0 0 1.8 3h10a2 2 0 0 0 1.8-3L14 8.5V3" /></svg></div>
              <div className="mx-auto mb-4 max-w-[280px] text-[13px] leading-relaxed text-[#6b7385]">Physical sample has not yet arrived from the line. Log receipt to begin testing.</div>
              <button onClick={() => run(() => receiveSample(hold.sampleId))} disabled={pending} className="rounded-[9px] bg-[#7c4dff] px-[18px] py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">Receive sample → In test</button>
            </div>
          )}

          {/* IN_TEST / AWAITING_RESULT: entry */}
          {(hold.status === "IN_TEST" || hold.status === "AWAITING_RESULT") && (
            <>
              <div className="grid grid-cols-2 items-start gap-3.5">
                <SpecCard hold={hold} />
                <div className="rounded-xl border border-[#e4e7ee] bg-white px-[17px] py-[15px]">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#8b93a6]">Result entry</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: verdict.bg, color: verdict.fg }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: verdict.fg }} />{verdict.label}</span>
                  </div>
                  <div className="text-[12.5px] text-[#3a4256]">{measuredName}</div>
                  
                  {isOptions ? (
                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      {optionsList.map((opt) => {
                        const isSel = val.trim().toLowerCase() === opt.trim().toLowerCase();
                        const optEv = evalVerdict(hold.spec, opt);
                        const activeColor =
                          optEv === "pass"
                            ? { border: "#1f7a4d", bg: "#eaf6f0", text: "#1f7a4d" }
                            : { border: "#c23934", bg: "#fdf2f1", text: "#c23934" };
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setVal(opt)}
                            className={`flex items-center gap-1.5 rounded-lg border-[1.5px] px-3.5 py-2 text-[13px] font-semibold transition-all ${
                              isSel ? "shadow-sm" : "border-[#dfe3ee] bg-white text-[#4a5568] hover:bg-[#f7f8fb]"
                            }`}
                            style={
                              isSel
                                ? { borderColor: activeColor.border, backgroundColor: activeColor.bg, color: activeColor.text }
                                : undefined
                            }
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: isSel ? activeColor.text : "#a0aec0" }}
                            />
                            {opt}
                          </button>
                        );
                      })}
                      <div className="ml-auto flex items-center">
                        <Mark ev={ev} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2.5">
                      <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" placeholder="0.0"
                        className="w-[120px] rounded-lg border-[1.5px] px-[11px] py-2.5 text-right font-mono text-[14px] text-[#1c2230] focus:border-[#7c4dff] focus:outline-none"
                        style={{ borderColor: ev === "pass" ? "#a9d9bf" : ev === "fail" ? "#e6a49d" : "#dfe3ee", background: ev === "pass" ? "#f4fbf7" : ev === "fail" ? "#fdf3f2" : "#fff" }} />
                      <span className="font-mono text-[12px] text-[#9aa2b2]">{hold.spec.unit}</span>
                      <Mark ev={ev} />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-[11px] border border-[#bfeee7] bg-[#e9fbf8] px-3.5 py-3 text-[11.5px] leading-relaxed text-[#0b7d76]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0b7d76" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></svg>
                Recording sends the result to <b>Batchline EBR</b>: an in-spec value releases the hold and the batch resumes; out-of-spec holds the batch at this point.
              </div>

              <button
                onClick={() => run(() => recordResult({
                  sampleId: hold.sampleId,
                  measuredName,
                  measuredText: isOptions ? val : undefined,
                  measuredValue: isOptions ? undefined : parseFloat(val),
                }), true)}
                disabled={pending || !canRecord}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] py-3 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "#7c4dff" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                Record &amp; send to EBR
              </button>
            </>
          )}

          {/* dispositioned */}
          {done && hold.result && (
            <>
              <div className="mb-3.5 flex items-center gap-2.5 rounded-[11px] border px-3.5 py-3" style={{ background: hold.status === "RELEASED" ? "#f2faf5" : "#fdf4f3", borderColor: hold.status === "RELEASED" ? "#c6e6d3" : "#f1cbc6", borderLeft: `4px solid ${hold.status === "RELEASED" ? "#1f9d5b" : "#c23934"}` }}>
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg text-white" style={{ background: hold.status === "RELEASED" ? "#1f9d5b" : "#c23934" }}>
                  {hold.status === "RELEASED"
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>}
                </span>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold" style={{ color: hold.status === "RELEASED" ? "#1f7a4d" : "#c23934" }}>{hold.status === "RELEASED" ? "Hold released" : "Hold failed — batch stopped"}</div>
                  <div className="mt-px text-[11.5px] text-[#6b7385]">{hold.status === "RELEASED" ? "Pass result sent to EBR · batch resumed" : "OOS result sent to EBR · batch halted"} · {hold.result.dispositionSentAt}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 items-start gap-3.5">
                <SpecCard hold={hold} />
                <div className="rounded-xl border border-[#e4e7ee] bg-white px-[17px] py-[15px]">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#8b93a6]">Recorded result</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: hold.result.verdict === "PASS" ? "#d9ede2" : "#f6dcda", color: hold.result.verdict === "PASS" ? "#1f7a4d" : "#c23934" }}>{hold.result.verdict === "PASS" ? "In spec" : "Out of spec"}</span>
                  </div>
                  <div className="flex items-center gap-2.5 py-2">
                    <div className="flex-1 text-[12.5px] text-[#3a4256]">{hold.result.measuredName}</div>
                    <span className="font-mono text-[14px] font-semibold text-[#1c2230]">{hold.result.measuredText ?? hold.result.measuredValue}</span>
                    {hold.spec.unit && <span className="font-mono text-[12px] text-[#9aa2b2]">{hold.spec.unit}</span>}
                    <Mark ev={hold.result.verdict === "PASS" ? "pass" : "fail"} />
                  </div>
                  <div className="mt-1 border-t border-[#eef0f5] pt-2 font-mono text-[10.5px] text-[#b0a084]">by {hold.result.recordedBy} · {hold.result.recordedAt}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function defaultMeasured(h: HoldVM) {
  if (h.spec.limitType === "OPTIONS") return "Disposition";
  return h.spec.method.startsWith("TM-BU") ? "Relative std. deviation"
    : h.spec.method.startsWith("TM-PH") ? "Measured pH"
    : h.spec.method.startsWith("TM-LOD") ? "Loss on drying"
    : h.spec.method.startsWith("TM-ASSAY") ? "Assay" : "Measured value";
}

function SpecCard({ hold }: { hold: HoldVM }) {
  return (
    <div className="rounded-xl border border-[#e4e7ee] bg-white px-[17px] py-[15px]">
      <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#8b93a6]">Specification</div>
      <div className="overflow-hidden rounded-[9px] border border-[#eef0f5] bg-[#eef0f5]">
        <div className="bg-white px-[13px] py-2.5"><div className="mb-[3px] text-[10px] text-[#9aa2b2]">Parameter</div><div className="text-[12.5px] font-semibold text-[#1c2230]">{hold.spec.parameter}</div></div>
        <div className="mt-px bg-white px-[13px] py-2.5"><div className="mb-[3px] text-[10px] text-[#9aa2b2]">Acceptance limit</div><div className="font-mono text-[12.5px] font-semibold text-[#1c2230]">{hold.spec.limitText}</div></div>
      </div>
    </div>
  );
}

function Mark({ ev }: { ev: "pass" | "fail" | "empty" }) {
  if (ev === "pass") return <span className="flex w-[18px]"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1f7a4d" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></span>;
  if (ev === "fail") return <span className="flex w-[18px]"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c23934" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg></span>;
  return <span className="w-[18px]" />;
}
