"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncMaterialsFromBatchline } from "@/app/materials/actions";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

interface SyncButtonProps {
  initialLastSync?: string | null;
  onSyncComplete?: () => void;
  variant?: "outline" | "batchline" | "primary" | "ghost";
  className?: string;
}

export function SyncButton({
  initialLastSync,
  onSyncComplete,
  variant = "outline",
  className,
}: SyncButtonProps) {
  const [pending, start] = useTransition();
  const [lastSync, setLastSync] = useState<string | null>(initialLastSync ?? null);
  const router = useRouter();

  const handleSync = () =>
    start(async () => {
      const res = await syncMaterialsFromBatchline();
      toast(res);
      if (res.ok) {
        setLastSync(new Date().toISOString());
        onSyncComplete?.();
        router.refresh();
      }
    });

  const formattedLastSync = lastSync
    ? (() => {
        const d = new Date(lastSync);
        if (isNaN(d.getTime())) return null;
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      })()
    : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={variant}
        onClick={handleSync}
        disabled={pending}
        className={className}
      >
        <svg
          className={pending ? "animate-spin" : ""}
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 1 0 2.1-5.6L2 9" />
        </svg>
        {pending ? "Syncing…" : "Fetch from Batchline"}
      </Button>
      {formattedLastSync && (
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-faint">
          Last: {formattedLastSync}
        </span>
      )}
    </div>
  );
}

export default SyncButton;