import { clsx } from "./clsx";

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[13px] border border-border bg-panel shadow-[0_1px_2px_rgba(74,50,34,.04)]">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th className={clsx("bg-panel-2 px-[18px] py-3 text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#93856f]", right ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}

export function Td({ children, className, mono, right }: { children?: React.ReactNode; className?: string; mono?: boolean; right?: boolean }) {
  return (
    <td className={clsx("border-t border-line px-[18px] py-[13px]", mono && "font-mono", right && "text-right", className)}>
      {children}
    </td>
  );
}
