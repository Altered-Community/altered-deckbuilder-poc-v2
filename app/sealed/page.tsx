'use client';

import { useSyncExternalStore } from 'react';
import { useSealedStore } from '@/store/sealedStore';
import SealedSetup from '@/components/sealed/SealedSetup';
import SealedBuilderView from '@/components/sealed/SealedBuilderView';

export default function SealedPage() {
  const pool = useSealedStore((s) => s.pool);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  if (!mounted) return null;

  return pool.length > 0 ? <SealedBuilderView /> : <SealedSetup />;
}
