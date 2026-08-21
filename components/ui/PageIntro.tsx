export function PageIntro({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-[18px] flex items-end justify-between gap-4">
      <p className="m-0 max-w-[560px] text-[13px] leading-[1.55] text-muted">{children}</p>
      {action}
    </div>
  );
}
