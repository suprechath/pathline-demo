"use client";
import { useEffect, useState } from "react";

export interface ToastPayload {
  message: string;
  system?: "pathline" | "batchline";
}

// Fire a toast from anywhere (including after a Server Action resolves).
export function toast(p: ToastPayload | { ok: boolean; message: string; system?: "pathline" | "batchline" }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>("pathline:toast", { detail: { message: p.message, system: p.system } }));
}

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; message: string; system: "pathline" | "batchline" }[]>([]);

  useEffect(() => {
    let id = 0;
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      const item = { id: ++id, message: detail.message, system: detail.system ?? "pathline" as const };
      setItems((s) => [...s, item]);
      setTimeout(() => setItems((s) => s.filter((i) => i.id !== item.id)), 3600);
    };
    window.addEventListener("pathline:toast", onToast);
    return () => window.removeEventListener("pathline:toast", onToast);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-2.5">
      {items.map((i) => (
        <div
          key={i.id}
          className="flex max-w-[360px] items-center gap-3 rounded-[11px] bg-[#2b1d12] px-[17px] py-[13px] text-[13px] leading-snug text-[#f2e6d4] shadow-[0_12px_30px_rgba(46,32,22,.35)]"
          style={{ animation: "evin .3s ease both" }}
        >
          <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: i.system === "batchline" ? "#b87333" : "#8fae5b" }} />
          {i.message}
        </div>
      ))}
    </div>
  );
}
