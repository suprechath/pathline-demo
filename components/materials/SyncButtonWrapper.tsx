"use client";
import { SyncButton } from "./SyncButton";

export default function SyncButtonWrapper({
  initialLastSync,
  onSyncComplete,
}: {
  initialLastSync?: string | null;
  onSyncComplete?: () => void;
}) {
  return <SyncButton initialLastSync={initialLastSync} onSyncComplete={onSyncComplete} />;
}