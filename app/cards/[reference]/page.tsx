'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { fetchCardGroupByReference } from '@/lib/api/cardApi';
import { FACTION_BADGE_COLORS } from '@/lib/types/constants';
import { getRarityFromSlug } from '@/lib/utils/card';
import SiteLayout from '@/components/layout/SiteLayout';
import CardText, { CardEffectList } from '@/components/cards/CardText';
import type { CardGroupVariant } from '@/lib/types/card';

type Tab = 'details' | 'rules' | 'lore' | 'offers';

const RARITY_COLORS: Record<string, string> = {
  COMMON: 'bg-gray-500',
  RARE: 'bg-blue-500',
  UNIQUE: 'bg-purple-500',
  EXALTED: 'bg-yellow-500',
};

export default function CardDetailPage() {
  const { reference } = useParams<{ reference: string }>();
  const locale = useLocale();
  const t = useTranslations('cardDetail');
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [selectedVariant, setSelectedVariant] = useState<CardGroupVariant | null>(null);
  const [lightbox, setLightbox] = useState(false);

  const { data: card, isLoading, isError } = useQuery({
    queryKey: ['card-detail', reference, locale],
    queryFn: () => fetchCardGroupByReference(reference, locale),
    staleTime: 1000 * 60 * 10,
  });

  const variants = card?.cards ?? [];
  const activeVariant = selectedVariant ?? variants.find((v) => v.variation === 'standard') ?? variants[0] ?? null;
  const image = activeVariant?.imagePath ?? null;

  const factionCode = card?.faction?.code ?? '';
  const factionBadge = FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600';
  const rarity = reference ? getRarityFromSlug(reference) : 'COMMON';
  const rarityBadge = RARITY_COLORS[rarity] ?? 'bg-gray-500';

  const echoEffects: string[] = card?.echoEffect
    ? (Array.isArray(card.echoEffect) ? card.echoEffect : [card.echoEffect])
    : [];

  const loreText = card?.loreEntries?.flatMap((e) => e.elements.map((el) => el.text)).join('\n') ?? null;

  const alteredLocale = locale === 'fr' ? 'fr-fr' : 'en-us';
  const alteredUrl = `https://www.altered.gg/${alteredLocale}/cards/${reference}`;

  const hasStats = card && (
    card.mainCost != null || card.recallCost != null ||
    card.forestPower != null || card.mountainPower != null || card.oceanPower != null
  );

  return (
    <SiteLayout>
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="self-start text-sm text-c-text-muted hover:text-c-text transition"
        >
          {t('back')}
        </button>

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400" />
          </div>
        )}

        {isError && (
          <p className="text-red-400 text-sm">Erreur lors du chargement de la carte.</p>
        )}

        {card && (
          <div className="flex flex-col lg:flex-row gap-8">

            {/* ── Lightbox ── */}
            {lightbox && image && (
              <div
                className="fixed inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                style={{ zIndex: 9999 }}
                onClick={() => setLightbox(false)}
              >
                <div className="relative max-h-[90vh] max-w-[90vw] aspect-[2/3]" style={{ height: '90vh' }}>
                  <Image
                    src={image}
                    alt={card.name}
                    fill
                    className="object-contain rounded-2xl shadow-2xl"
                    unoptimized
                    sizes="90vw"
                  />
                </div>
                <button
                  onClick={() => setLightbox(false)}
                  className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            )}

            {/* ── Colonne gauche : image + variantes ── */}
            <div className="lg:w-72 shrink-0 flex flex-col items-center gap-3">
              <div
                className="relative w-full max-w-xs aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl cursor-zoom-in"
                onClick={() => image && setLightbox(true)}
              >
                {image ? (
                  <Image
                    src={image}
                    alt={card.name}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-200"
                    unoptimized
                    sizes="288px"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-c-surface text-c-text-muted text-sm text-center px-4">
                    {card.name}
                  </div>
                )}
              </div>

              {/* Variantes */}
              {variants.length > 1 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {variants.map((v) => (
                    <button
                      key={v.reference}
                      onClick={() => setSelectedVariant(v)}
                      title={v.variation}
                      className={`relative w-12 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        activeVariant?.reference === v.reference
                          ? 'border-amber-400 scale-105'
                          : 'border-c-border opacity-60 hover:opacity-100'
                      }`}
                    >
                      {v.imagePath ? (
                        <Image src={v.imagePath} alt={v.variation} fill className="object-cover" unoptimized sizes="48px" />
                      ) : (
                        <div className="absolute inset-0 bg-c-surface flex items-center justify-center text-[8px] text-c-text-muted px-0.5 text-center">
                          {v.variation}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Colonne droite : infos + tabs ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-5">

              {/* En-tête */}
              <div>
                <h1 className="text-2xl font-bold text-c-text mb-2">{card.name}</h1>
                <div className="flex flex-wrap gap-2 items-center">
                  {factionCode && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${factionBadge}`}>
                      {factionCode}
                    </span>
                  )}
                  <span className="text-xs px-2.5 py-1 rounded-full bg-c-input text-c-text-secondary">
                    {card.cardType?.name ?? card.cardType?.reference}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full text-white ${rarityBadge}`}>
                    {rarity}
                  </span>
                  {card.cardSubTypes?.map((st) => (
                    <span key={st} className="text-xs px-2.5 py-1 rounded-full bg-c-surface text-c-text-muted">
                      {st}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              {hasStats && (
                <div className="flex flex-wrap gap-4 p-3 bg-c-surface rounded-xl border border-c-border-subtle">
                  {card.mainCost != null && (
                    <StatPill icon="fa-hand" color="text-amber-400" label={t('mainCost')} value={card.mainCost} />
                  )}
                  {card.recallCost != null && (
                    <StatPill icon="fa-rotate" color="text-sky-400" label={t('recallCost')} value={card.recallCost} />
                  )}
                  {card.forestPower != null && (
                    <StatPill icon="fa-tree" color="text-green-500" label={t('forestPower')} value={card.forestPower} />
                  )}
                  {card.mountainPower != null && (
                    <StatPill icon="fa-mountain" color="text-orange-400" label={t('mountainPower')} value={card.mountainPower} />
                  )}
                  {card.oceanPower != null && (
                    <StatPill icon="fa-water" color="text-cyan-400" label={t('oceanPower')} value={card.oceanPower} />
                  )}
                </div>
              )}

              {/* Tabs */}
              <div className="flex flex-col">
                <div className="flex border-b border-c-border">
                  {(['details', 'rules', 'lore', 'offers'] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === tab
                          ? 'border-amber-400 text-amber-500'
                          : 'border-transparent text-c-text-muted hover:text-c-text'
                      }`}
                    >
                      {t(`tabs.${tab}`)}
                    </button>
                  ))}
                </div>

                <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-h-[180px]">
                  {activeTab === 'details' && (
                    <div className="flex flex-col gap-5">
                      {card.mainEffect && (
                        <WhiteSection label={t('mainEffect')}>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            <CardText text={card.mainEffect} />
                          </p>
                        </WhiteSection>
                      )}
                      {echoEffects.length > 0 && (
                        <WhiteSection label={t('echoEffect')}>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            <CardEffectList effects={echoEffects} />
                          </p>
                        </WhiteSection>
                      )}
                      {!card.mainEffect && echoEffects.length === 0 && (
                        <p className="text-sm text-gray-400">{t('noEffect')}</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'rules' && (
                    <div>
                      {card.cardRulings?.length > 0 ? (
                        <div className="flex flex-col gap-3">
                          {card.cardRulings.map((r, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-1.5">
                              <p className="text-sm text-gray-800 font-medium">Q : {r.question}</p>
                              <p className="text-sm text-gray-600">A : {r.answer}</p>
                              {r.rulingDate && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{r.rulingDate}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 py-4">
                          <Image
                            src="/no_rules.png"
                            alt="No rules"
                            width={140}
                            height={140}
                            className="opacity-50"
                            unoptimized
                          />
                          <p className="text-sm text-gray-400 text-center">{t('noRulings')}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'lore' && (
                    <div>
                      {loreText ? (
                        <p className="text-sm text-gray-600 italic leading-relaxed whitespace-pre-line">{loreText}</p>
                      ) : (
                        <p className="text-sm text-gray-400">{t('noEffect')}</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'offers' && (
                    <div className="flex flex-col items-center gap-5 py-4">
                      <p className="text-gray-500 text-sm text-center max-w-xs">{t('offersDescription')}</p>
                      <Link
                        href={alteredUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary-altered btn-sm inline-flex items-center gap-2"
                      >
                        {t('offersOnAltered')}
                        <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

function StatPill({ icon, color, label, value }: { icon: string; color: string; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5" title={label}>
      <i className={`fa-solid ${icon} ${color} text-base`} />
      <span className="font-mono font-bold text-c-text text-sm">{value}</span>
      <span className="text-[9px] text-c-text-muted uppercase tracking-wide">{label}</span>
    </div>
  );
}

function WhiteSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      {children}
    </div>
  );
}
