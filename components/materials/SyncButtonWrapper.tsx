'use client';

import SyncButton from './SyncButton';

export default function SyncButtonWrapper() {
  return (
    <SyncButton onSyncComplete={() => console.log('Sync complete, refresh grid')} />
  );
}