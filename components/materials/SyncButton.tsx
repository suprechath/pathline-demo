'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/Button";

export default function SyncButton({ onSyncComplete }: { onSyncComplete: () => void }) {
  const [syncStatus, setSyncStatus] = useState<string>('LOADING');
  const [lastSync, setLastSync] = useState<string>('');

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/sync');
      const data = await res.json();
      setSyncStatus(data.status || 'NONE');
      if (data.completedAt) {
        setLastSync(new Date(data.completedAt).toLocaleString());
      }
    } catch (e) {
      setSyncStatus('NONE');
      console.error('Error checking sync status:', e);
    }
  }; // update date sync time

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      if (syncStatus === 'IN_PROGRESS') checkStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [syncStatus]); // Poll the server every 5 seconds if a sync is currently running

  const handleSync = async () => {
    setSyncStatus('IN_PROGRESS');
    // const resMat = await fetch('/api/sync', { method: 'POST' });
    // console.log('sync POST status:', resMat.status, resMat.statusText);
    await checkStatus();
    onSyncComplete(); // Tell the page to refresh the grid
  };

  const isSyncing = syncStatus === 'IN_PROGRESS';
  const isFailed = syncStatus === 'FAILED';

  return (
    <div className="flex flex-col items-end gap-1.5 relative">
      <Button
        variant="outline"
        onClick={handleSync}
        disabled={isSyncing}
      >
        <svg
          className={isSyncing ? "animate-spin" : ""}
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 1 0 2.1-5.6L2 9" />
        </svg>
        {isSyncing ? "Syncing..." : "Fetch from Batchline"}
      </Button>
      {(lastSync || isFailed) && (
        <span className={`text-[10px] font-mono tracking-[0.4px] uppercase ${isFailed ? 'text-err font-semibold' : 'text-faint'}`}>
          {isFailed ? 'Sync failed' : `Last: ${lastSync}`}
        </span>
      )}
    </div>
  );
}