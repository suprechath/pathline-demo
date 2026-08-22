import type { OrderStatus, LotStatus } from "@prisma/client";

type PillTone = { label: string; bg: string; fg: string };

const MAP: Record<string, PillTone> = {
  DRAFT: { label: "Draft", bg: "#ece4d6", fg: "#7c6d58" },
  PLANNED: { label: "Planned", bg: "#f3e4c8", fg: "#9a6516" },
  STARTED: { label: "Started", bg: "#f0dcc0", fg: "#a0611f" },
  COMPLETED: { label: "Completed", bg: "#f3e4c8", fg: "#9a6516" },
  REVIEWED: { label: "Reviewed / Closed", bg: "#e2e8d5", fg: "#556b2c" },
  CANCELLED: { label: "Cancelled", bg: "#eddad3", fg: "#a8432a" },
  IN_STOCK: { label: "In stock", bg: "#e2e8d5", fg: "#556b2c" },
  RESERVED: { label: "Reserved", bg: "#f3e4c8", fg: "#9a6516" },
  EXPIRED: { label: "Expired", bg: "#eddad3", fg: "#a8432a" },
  REJECTED: { label: "Rejected", bg: "#eddad3", fg: "#a8432a" },
  QUARANTINE: { label: "Quarantine", bg: "#f3e4c8", fg: "#9a6516" },
  CONSUMED: { label: "Consumed", bg: "#ece4d6", fg: "#7c6d58" },
  ACTIVE: { label: "Active", bg: "#e2e8d5", fg: "#556b2c" },
  INACTIVE: { label: "Inactive", bg: "#ece4d6", fg: "#93856f" },
};

export function Pill({ status }: { status: OrderStatus | LotStatus | "ACTIVE" | "INACTIVE" }) {
  const t = MAP[status] ?? MAP.DRAFT;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={{ background: t.bg, color: t.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.fg }} />
      {t.label}
    </span>
  );
}

type TypeTone = { label: string; bg: string; fg: string; border: string };

const TYPE: Record<string, TypeTone> = {
  RAW: { label: "Raw", bg: "#a17230ff", fg: "#f7f5f3ff", border: "#684c2bff" },
  INTERMEDIATE: { label: "Intermediate", bg: "#224dc5ff", fg: "#bfe2e2ff", border: "#5f87f5ff" },
  PRODUCT: { label: "Product", bg: "#6f25b9ff", fg: "#d1c2e0ff", border: "#9d58e7ff" },
};

export function TypeTag({ type }: { type: keyof typeof TYPE }) {
  const t = TYPE[type] ?? TYPE.RAW;
  return (
    <span
      className="inline-flex items-center rounded-[6px] border px-2.5 py-[2.5px] text-[11px] font-semibold tracking-[0.2px]"
      style={{ background: t.bg, color: t.fg, borderColor: t.border }}
    >
      {t.label}
    </span>
  );
}
