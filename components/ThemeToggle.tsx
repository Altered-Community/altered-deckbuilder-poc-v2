'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="text-gray-500 hover:text-white transition text-base leading-none"
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
