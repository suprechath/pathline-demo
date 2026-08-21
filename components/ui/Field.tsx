import { clsx } from "./clsx";

export function Field({
  label,
  className,
  hint,
  children,
}: {
  label: string;
  className?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={clsx("block text-[12px] font-semibold text-muted", className)}>
      {label}
      <div className="mt-1.5">{children}</div>
      {hint && <div className="mt-1 text-[11px] font-normal text-faint">{hint}</div>}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-[#d8ccb8] bg-white px-[11px] py-[9px] text-[13px] text-ink placeholder:text-faint focus:border-amber focus:outline-none";

export function TextInput({ mono, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input {...props} className={clsx(inputBase, mono && "font-mono", className)} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={clsx(inputBase, className)}>
      {children}
    </select>
  );
}
