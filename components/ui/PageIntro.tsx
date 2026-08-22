export function PageIntro({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between">
      <p className="m-0 text-[13px] leading-[1.55] text-muted">{children}</p>
      {action}
    </div>
  );
}
