"use client";
import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  children,
  width = 480,
  dark = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  dark?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-[rgba(46,32,22,.44)] px-5 py-14 backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: width }}
        className={`w-full overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(46,32,22,.3)] ${dark ? "bg-[#2b1d12]" : "bg-panel"}`}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose, dark = false }: { title: React.ReactNode; onClose: () => void; dark?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b px-6 py-4 ${dark ? "border-[#4a3626]" : "border-line"}`}>
      <div className={`text-[15px] font-semibold ${dark ? "text-[#f2e6d4]" : "text-ink"}`}>{title}</div>
      <button onClick={onClose} className={`p-1 ${dark ? "text-[#b0a084]" : "text-faint"} hover:opacity-70`} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
