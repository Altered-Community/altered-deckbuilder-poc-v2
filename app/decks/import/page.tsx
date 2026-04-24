'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { saveDeck, fetchFormats } from '@/lib/api/deckApi';
import LoginButton from '@/components/auth/LoginButton';
import SiteFooter from '@/components/layout/SiteFooter';

interface ParsedLine {
  quantity: number;
  cardReference: string;
}

interface ParseResult {
  valid: ParsedLine[];
  invalid: string[];
}

function parseDecklist(text: string): ParseResult {
  const valid: ParsedLine[] = [];
  const invalid: string[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(/^(\d+)\s+(ALT_\S+)$/i);
    if (match) {
      valid.push({ quantity: parseInt(match[1], 10), cardReference: match[2].toUpperCase() });
    } else {
      invalid.push(line);
    }
  }

  return { valid, invalid };
}

export default function ImportDeckPage() {
  const t = useTranslations('importDeck');
  const tc = useTranslations('common');
  const router = useRouter();
  const { token } = useAuth();

  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [format, setFormat] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const { data: formats = [] } = useQuery({ queryKey: ['formats'], queryFn: fetchFormats, staleTime: Infinity });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { valid, invalid } = parseDecklist(text);

  const handleImport = async () => {
    if (!token) return;
    setError(null);
    setSaving(true);
    try {
      const result = await saveDeck({
        name: name.trim() || t('deckNamePlaceholder'),
        format: format || null,
        isPublic,
        deckCards: valid,
      });
      router.push(`/decks/${result.id}`);
    } catch (e) {
      console.error('[import] error', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full bg-c-elevated border border-c-border rounded-lg px-3 py-2 text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="flex flex-col" style={{ flex: 1 }}>
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
        {!token && (
          <div className="text-center text-c-text-muted mt-20">
            <p className="mb-4">{t('loginRequired')}</p>
            <LoginButton />
          </div>
        )}

        {token && (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-c-text-muted">{t('deckName')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={150}
                  placeholder={t('deckNamePlaceholder')}
                  className={inputClass}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-c-text-muted">{t('format')}</label>
                  <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputClass}>
                    <option value="">{tc('noFormat')}</option>
                    {formats.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1 justify-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setIsPublic((v) => !v)}
                      className={`w-9 h-5 rounded-full transition-colors ${isPublic ? 'bg-blue-600' : 'bg-c-input'} relative`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isPublic ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-sm text-c-text-muted">{tc('public')}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-c-text-muted">
                {t('listLabel')}{' '}
                <span className="text-c-text-subtle">{t('listHint')}</span>
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={16}
                placeholder={'1 ALT_CORE_B_OR_01_C\n2 ALT_CORE_B_OR_05_C\n3 ALT_CORE_B_OR_06_C'}
                className={inputClass + ' resize-none font-mono text-xs leading-relaxed'}
              />
            </div>

            {text.trim() && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-400">
                  {t('validLines', { count: valid.length, cards: valid.reduce((s, l) => s + l.quantity, 0) })}
                </span>
                {invalid.length > 0 && (
                  <span className="text-red-400">
                    {t('ignoredLines', { count: invalid.length })}
                  </span>
                )}
              </div>
            )}

            {invalid.length > 0 && (
              <ul className="flex flex-col gap-1">
                {invalid.map((line, i) => (
                  <li key={i} className="text-xs font-mono text-red-400 bg-red-900/20 px-2 py-1 rounded">
                    {line}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={saving || valid.length === 0}
                className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? t('importing') : t('importBtn')}
              </button>
              {error && <span className="text-sm text-red-400">{error}</span>}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
