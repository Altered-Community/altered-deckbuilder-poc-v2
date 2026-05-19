'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { batchAddCollectionEntries } from '@/lib/api/collectionApi';
import { verifyCardReferences } from '@/lib/api/cardApi';
import { getRarityFromSlug } from '@/lib/utils/card';
import type { CollectionImportRow, CollectionValidationResult } from '@/lib/types/collection';
import SiteLayout from '@/components/layout/SiteLayout';
import LoginButton from '@/components/auth/LoginButton';

const CSV_RARITY: Record<string, string> = {
  commun: 'COMMON', commune: 'COMMON',
  rare: 'RARE',
  unique: 'UNIQUE',
  exalté: 'EXALTED', exalte: 'EXALTED',
  common: 'COMMON', exalted: 'EXALTED',
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (const c of line) {
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ';' && !inQuote) { result.push(current.trim()); current = ''; }
    else current += c;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string, t: (k: string, v?: Record<string, string>) => string): CollectionValidationResult {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  const errors: CollectionValidationResult['errors'] = [];
  const valid: CollectionImportRow[] = [];

  if (lines.length < 2) {
    errors.push({ line: 0, raw: '', reason: t('emptyFile') });
    return { valid, errors, totalCards: 0, uniqueCount: 0 };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z_]/g, ''));
  const idxRef = header.indexOf('card_reference');
  const idxName = header.indexOf('card_name');
  const idxRarity = header.indexOf('rarity');
  const idxQty = header.indexOf('quantity');

  if ([idxRef, idxName, idxRarity, idxQty].some((i) => i === -1)) {
    errors.push({ line: 1, raw: lines[0], reason: t('missingColumns') });
    return { valid, errors, totalCards: 0, uniqueCount: 0 };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const cardReference = cols[idxRef] ?? '';
    const cardName = cols[idxName] ?? '';
    const rarityRaw = cols[idxRarity] ?? '';
    const quantity = parseInt(cols[idxQty] ?? '0', 10);

    if (!cardReference.startsWith('ALT_')) {
      errors.push({ line: i + 1, raw: lines[i], reason: t('invalidRef', { ref: cardReference }) });
      continue;
    }
    if (isNaN(quantity) || quantity <= 0) {
      errors.push({ line: i + 1, raw: lines[i], reason: t('invalidQty', { qty: cols[idxQty] ?? '' }) });
      continue;
    }
    valid.push({ cardReference, cardName, rarity: rarityRaw, quantity });
  }

  const totalCards = valid.reduce((s, r) => s + r.quantity, 0);
  const uniqueCount = valid.filter((r) => {
    const normalized = CSV_RARITY[r.rarity.toLowerCase()] ?? getRarityFromSlug(r.cardReference);
    return normalized === 'UNIQUE';
  }).length;

  return { valid, errors, totalCards, uniqueCount };
}

type Step = 'upload' | 'validate' | 'importing' | 'done';

export default function CollectionImportCsvPage() {
  const t = useTranslations('collectionImport');
  const tc = useTranslations('collection');
  const { token, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileError, setFileError] = useState<string | null>(null);
  const [validation, setValidation] = useState<CollectionValidationResult | null>(null);
  const [uniqueErrors, setUniqueErrors] = useState<string[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifiedInvalidUniques, setVerifiedInvalidUniques] = useState<string[]>([]);

  const [progress, setProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setValidation(null);
    setUniqueErrors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const result = parseCsv(text, t as (k: string, v?: Record<string, string>) => string);
        setValidation(result);
        setStep('validate');
      } catch (err) {
        setFileError(err instanceof Error ? err.message : t('emptyFile'));
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const startImport = async (invalidUniques: string[]) => {
    if (!validation) return;
    const toImport = validation.valid.filter((r) => !invalidUniques.includes(r.cardReference));
    setStep('importing');
    setImportTotal(toImport.length);
    setProgress(0);
    setImportErrors([]);
    setImportedCount(0);

    const BATCH = 100;
    let done = 0;
    let imported = 0;
    const errs: string[] = [];

    for (let i = 0; i < toImport.length; i += BATCH) {
      const batch = toImport.slice(i, i + BATCH);
      try {
        const { created } = await batchAddCollectionEntries(
          batch.map((row) => ({ cardReference: row.cardReference, quantity: row.quantity, isFoil: false }))
        );
        imported += created.length;
        done += batch.length;
      } catch (err) {
        errs.push(`Batch ${Math.floor(i / BATCH) + 1}: ${err instanceof Error ? err.message : 'erreur'}`);
        done += batch.length;
      }
      setProgress(done);
    }

    setImportedCount(imported);
    setImportErrors(errs);
    setStep('done');
  };

  const handleVerifyAndImport = async () => {
    if (!validation || !token) return;
    setVerifying(true);
    setUniqueErrors([]);
    setVerifiedInvalidUniques([]);

    const uniqueRefs = validation.valid
      .filter((r) => (CSV_RARITY[r.rarity.toLowerCase()] ?? getRarityFromSlug(r.cardReference)) === 'UNIQUE')
      .map((r) => r.cardReference);

    let invalidUniques: string[] = [];
    if (uniqueRefs.length > 0) {
      try {
        const { notFound } = await verifyCardReferences(uniqueRefs);
        invalidUniques = notFound;
        if (notFound.length > 0) {
          setUniqueErrors(notFound);
          setVerifiedInvalidUniques(notFound);
          setVerifying(false);
          return; // show errors + bypass button
        }
      } catch {
        setVerifying(false);
        return;
      }
    }

    setVerifying(false);
    await startImport(invalidUniques);
  };

  return (
    <SiteLayout>
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        <div className="flex items-center gap-2 text-sm">
          <Link href="/collection" className="text-c-text-muted hover:text-c-text transition">{t('breadcrumb')}</Link>
          <span className="text-c-border">›</span>
          <span className="font-bold text-c-text">{t('breadcrumbImport')}</span>
        </div>

        {!authLoading && !token && (
          <div className="text-center mt-10 flex flex-col items-center gap-4">
            <p className="text-c-text-muted">{t('loginRequired')}</p>
            <LoginButton />
          </div>
        )}

        {token && (
          <>
            {(step === 'upload' || step === 'validate') && (
              <div className="card-altered p-5 flex flex-col gap-5">
                <div>
                  <h1 className="text-base font-bold text-c-text mb-1">{t('title')}</h1>
                  <p className="text-sm text-c-text-muted">
                    {t('instructions')}{' '}
                    <a href="https://www.altered.gg/en-us/manage-account/personal-data" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                      {t('instructionsLink')}
                    </a>
                    {t('instructionsEnd')}{' '}
                    <code className="text-xs bg-c-input px-1 rounded">collection.csv</code>.
                  </p>
                </div>

                <div>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="btn-primary-altered">
                    <i className="fa-solid fa-file-csv" />
                    {validation ? t('changeFile') : t('chooseFile')}
                  </button>
                  {fileError && <p className="text-sm text-red-400 mt-2">{fileError}</p>}
                </div>
              </div>
            )}

            {step === 'validate' && validation && (
              <div className="card-altered p-5 flex flex-col gap-4">
                <h2 className="text-sm font-bold text-c-text uppercase tracking-widest">{t('prevalidation')}</h2>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-c-elevated rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-c-text">{validation.valid.length}</p>
                    <p className="text-xs text-c-text-muted mt-0.5">{tc('validLines')}</p>
                  </div>
                  <div className="bg-c-elevated rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-400">{validation.totalCards}</p>
                    <p className="text-xs text-c-text-muted mt-0.5">{tc('totalCardsLabel')}</p>
                  </div>
                  <div className="bg-c-elevated rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-violet-400">{validation.uniqueCount}</p>
                    <p className="text-xs text-c-text-muted mt-0.5">{tc('uniquesLabel')}</p>
                  </div>
                </div>

                {validation.errors.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-widest">
                      {tc('formatErrors', { count: validation.errors.length })}
                    </p>
                    <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                      {validation.errors.map((err, i) => (
                        <div key={i} className="text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-1.5 text-red-400">
                          <span className="font-mono text-red-300 mr-2">L.{err.line}</span>
                          {err.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uniqueErrors.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
                      {tc('uniqueNotFound', { count: uniqueErrors.length })}
                    </p>
                    <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                      {uniqueErrors.map((ref) => (
                        <div key={ref} className="text-xs bg-amber-500/10 border border-amber-500/20 rounded px-3 py-1.5 text-amber-400 font-mono">
                          {ref}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-c-text-muted">{tc('uniqueSkipped')}</p>
                    <button
                      onClick={() => startImport(verifiedInvalidUniques)}
                      className="btn-primary-altered self-start mt-1"
                      style={{ background: 'var(--neutral-600)' }}
                    >
                      <i className="fa-solid fa-forward" />
                      Importer quand même (ignorer les uniques invalides)
                    </button>
                  </div>
                )}

                {validation.valid.length > 0 && (
                  <button onClick={handleVerifyAndImport} disabled={verifying} className="btn-primary-altered self-start disabled:opacity-50">
                    {verifying
                      ? <><i className="fa-solid fa-spinner fa-spin" /> {tc('verifying')}</>
                      : <><i className="fa-solid fa-cloud-arrow-up" /> {tc('importBtn', { count: validation.totalCards })}</>
                    }
                  </button>
                )}
              </div>
            )}

            {step === 'importing' && (
              <div className="card-altered p-5 flex flex-col gap-4">
                <h2 className="text-sm font-bold text-c-text uppercase tracking-widest">{tc('importing')}</h2>
                <div className="w-full bg-c-input rounded-full h-2">
                  <div
                    className="bg-amber-400 h-2 rounded-full transition-all"
                    style={{ width: `${importTotal ? Math.round((progress / importTotal) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-sm text-c-text-muted">{tc('progress', { done: progress, total: importTotal })}</p>
              </div>
            )}

            {step === 'done' && (
              <div className="card-altered p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-green-400 text-xl" />
                  <h2 className="text-base font-bold text-c-text">{tc('doneTitle')}</h2>
                </div>
                <p className="text-sm text-c-text-muted">{tc('doneSuccess', { count: importedCount })}</p>

                {importErrors.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-widest">
                      {tc('importErrors', { count: importErrors.length })}
                    </p>
                    <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                      {importErrors.map((err, i) => (
                        <div key={i} className="text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-1.5 text-red-400 font-mono">
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link href="/collection" className="btn-primary-altered self-start">
                  <i className="fa-solid fa-boxes-stacked" />
                  {tc('viewCollection')}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </SiteLayout>
  );
}
