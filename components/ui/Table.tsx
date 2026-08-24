import { clsx } from "./clsx";

export function Table({
  children,
  className,
  containerClassName,
  maxHeight,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  maxHeight?: string;
}) {
  return (
    <div
      style={maxHeight ? { maxHeight } : undefined}
      className={clsx(
        "overflow-auto rounded-[13px] border border-border bg-panel shadow-[0_1px_2px_rgba(74,50,34,.04)]",
        containerClassName,
      )}
    >
      <table className={clsx("w-full border-collapse text-[13px]", className)}>{children}</table>
    </div>
  );
}

export function Th({
  children,
  right,
  className,
  style,
  sticky = true,
  onClick,
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
  style?: React.CSSProperties;
  sticky?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      style={style}
      onClick={onClick}
      className={clsx(
        "bg-panel-2 px-[10px] py-3 text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#93856f]",
        sticky && "sticky top-0 z-10 border-b border-border shadow-[0_1px_0_#e6dbcb]",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  mono,
  right,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  mono?: boolean;
  right?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={style}
      className={clsx("border-t border-line px-[8px] py-[13px]", mono && "font-mono", right && "text-right", className)}
    >
      {children}
    </td>
  );
}
