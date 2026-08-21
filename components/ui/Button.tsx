import { clsx } from "./clsx";

type Variant = "primary" | "batchline" | "ghost" | "outline";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-espresso text-white hover:bg-espresso-deep",
  batchline: "bg-amber text-white hover:bg-amber-deep",
  ghost: "text-amber-ink hover:bg-panel-2 border border-transparent",
  outline: "bg-panel text-espresso border border-[#d8ccb8] hover:bg-panel-2",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-semibold",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
