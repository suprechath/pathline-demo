export function PageIntro({
  children,
  action,
  className = "max-w-[560px]",
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="mb-[18px] flex items-end justify-between gap-4">
      <div className={`m-0 text-[13px] leading-[1.55] text-muted ${className}`}>{children}</div>
      {action}
    </div>
  );
}

