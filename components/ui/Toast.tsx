"use client";
import { useEffect, useState } from "react";

export interface ToastPayload {
  message: string;
  system?: "pathline" | "batchline";
  ok?: boolean;
}

// Fire a toast from anywhere (including after a Server Action resolves).
export function toast(p: ToastPayload | { ok: boolean; message: string; system?: "pathline" | "batchline" }) {
  if (typeof window === "undefined") return;
  const ok = "ok" in p ? p.ok : true;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>("pathline:toast", {
      detail: { message: p.message, system: p.system, ok },
    })
  );
}

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; message: string; system: "pathline" | "batchline"; ok: boolean }[]>([]);

  useEffect(() => {
    let id = 0;
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      const item = {
        id: ++id,
        message: detail.message,
        system: detail.system ?? ("pathline" as const),
        ok: detail.ok !== false,
      };
      setItems((s) => [...s, item]);
      setTimeout(() => setItems((s) => s.filter((i) => i.id !== item.id)), 4500);
    };
    window.addEventListener("pathline:toast", onToast);
    return () => window.removeEventListener("pathline:toast", onToast);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-2.5">
      {items.map((i) => (
        <div
          key={i.id}
          className="flex max-w-[400px] items-center gap-3 rounded-[11px] px-[17px] py-[13px] text-[13px] leading-snug shadow-[0_12px_30px_rgba(46,32,22,.35)]"
          style={{
            animation: "evin .3s ease both",
            background: i.ok ? "#2b1d12" : "#3b1717",
            color: i.ok ? "#f2e6d4" : "#ffe3e3",
            border: i.ok ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(239,68,68,0.3)",
          }}
        >
          <span
            className="h-2.5 w-2.5 flex-none rounded-[3px]"
            style={{
              background: !i.ok ? "#ef4444" : i.system === "batchline" ? "#b87333" : "#8fae5b",
            }}
          />
          <span className="flex-1 whitespace-pre-line">{i.message}</span>
        </div>
      ))}
    </div>
  );
}
