'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLocale } from '@/lib/actions/locale';

export default function LanguageToggle() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = () => {
    const next = locale === 'fr' ? 'en' : 'fr';
    startTransition(async () => {
      await setLocale(next as 'fr' | 'en');
      router.refresh();
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="text-xs text-c-text-muted hover:text-c-text transition disabled:opacity-50 font-mono"
    >
      {locale === 'fr' ? 'EN' : 'FR'}
    </button>
  );
}
