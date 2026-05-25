'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useSealedStore } from '@/store/sealedStore';
import { getCardGroupFaction, getCardGroupImage, getCardGroupName, getRarityFromSlug, getCardReference } from '@/lib/utils/card';
import { CARD_TYPES, FACTIONS, RARITIES, FACTION_BADGE_COLORS } from '@/lib/types/constants';
import UniqueCardRenderer from '@/components/cards/UniqueCardRenderer';
import SealedCardItem from './SealedCardItem';
import type { CardGroup } from '@/lib/types/card';

const PAGE_SIZE = 40;
type ViewMode = 'packs' | 'list';

const CARD_RATIO = 1039 / 744;
const GAP = 16; // px gap between pack columns

export default function SealedCardBrowser() {
  const t = useTranslations('sealed');
  const tc = useTranslations('cards');
  const locale = useLocale();
  const { pool, packs } = useSealedStore();

  const [viewMode, setViewMode] = useState<ViewMode>('packs');
  const [search, setSearch] = useState('');
  const [factionFilter, setFactionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [lightboxCard, setLightboxCard] = useState<CardGroup | null>(null);
  const packsContainerRef = useRef<HTMLDivElement>(null);
  const [packsContainerW, setPacksContainerW] = useState(0);

  useEffect(() => {
    const el = packsContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPacksContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const poolMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of pool) m.set(e.cardGroup.slug, e.quantity);
    return m;
  }, [pool]);

  const resetFilter = useCallback(<T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    return pool.filter(({ cardGroup: g }) => {
      if (g.cardType?.reference === 'HERO') return false;
      if (search && !g.name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (factionFilter && getCardGroupFaction(g) !== factionFilter) return false;
      if (typeFilter && g.cardType?.reference !== typeFilter) return false;
      if (rarityFilter && getRarityFromSlug(g.slug) !== rarityFilter) return false;
      return true;
    });
  }, [pool, search, factionFilter, typeFilter, rarityFilter]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, lastPage);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (!lightboxCard) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxCard(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxCard]);

  const selectClass = 'px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Barre de contrôle */}
      <div className="shrink-0 flex flex-col gap-2 p-3 bg-c-elevated rounded-lg">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-c-border overflow-hidden text-xs">
            <button
              onClick={() => setViewMode('packs')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition ${viewMode === 'packs' ? 'bg-blue-600 text-white' : 'text-c-text-muted hover:text-c-text'}`}
            >
              <i className="fa-solid fa-box-open" /> {t('viewPacks')}
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-c-text-muted hover:text-c-text'}`}
            >
              <i className="fa-solid fa-list" /> {t('viewList')}
            </button>
          </div>

          {viewMode === 'list' && (
            <input
              type="text"
              value={search}
              onChange={(e) => resetFilter(setSearch)(e.target.value)}
              placeholder={tc('search')}
              className="flex-1 px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          )}
        </div>

        {viewMode === 'list' && (
          <div className="grid grid-cols-3 gap-2">
            <select value={factionFilter} onChange={(e) => resetFilter(setFactionFilter)(e.target.value)} className={selectClass}>
              <option value="">{tc('allFactions')}</option>
              {Object.entries(FACTIONS).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(e) => resetFilter(setTypeFilter)(e.target.value)} className={selectClass}>
              <option value="">{tc('allTypes')}</option>
              {CARD_TYPES.filter((ct) => ct.value !== 'HERO').map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
            <select value={rarityFilter} onChange={(e) => resetFilter(setRarityFilter)(e.target.value)} className={selectClass}>
              <option value="">{tc('allRarities')}</option>
              {RARITIES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Vue liste */}
      {viewMode === 'list' && (
        <>
          <div className="shrink-0 flex items-center justify-between text-xs text-c-text-muted px-1">
            <span>{t('poolCount', { count: filtered.length })}</span>
            {lastPage > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-0.5 bg-c-input rounded disabled:opacity-30">‹</button>
                <span>{tc('page', { current: safePage, last: lastPage })}</span>
                <button disabled={safePage >= lastPage} onClick={() => setPage((p) => p + 1)} className="px-2 py-0.5 bg-c-input rounded disabled:opacity-30">›</button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-c-text-muted text-sm">
                {tc('notFound')}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 md:gap-3">
                {paginated.map(({ cardGroup, quantity }) => (
                  <SealedCardItem
                    key={cardGroup.slug}
                    card={cardGroup}
                    poolQty={quantity}
                    onZoom={() => setLightboxCard(cardGroup)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Vue par booster — pleine largeur, éventail vertical par pack */}
      {viewMode === 'packs' && (
        <div ref={packsContainerRef} className="flex-1 overflow-y-auto min-h-0">
          {packsContainerW > 0 && (() => {
            const numPacks = packs.length;
            const colW = numPacks > 0
              ? Math.floor((packsContainerW - GAP * (numPacks - 1)) / numPacks)
              : 0;
            const cardH = Math.round(colW * CARD_RATIO);
            const peek = Math.max(10, Math.round(cardH * 0.14));

            const PAD = 8; // padding inside each pack column
            const fanW = colW - PAD * 2;
            const fanCardH = Math.round(fanW * CARD_RATIO);
            const fanPeek = Math.max(10, Math.round(fanCardH * 0.14));
            const radius = Math.round(fanW * 0.07);

            return (
              <div className="flex" style={{ gap: GAP }}>
                {packs.map((pack) => {
                  // rares (haut), commons (milieu), héros (bas, toujours visible)
                  const fanCards: CardGroup[] = [
                    ...pack.rares,
                    ...pack.commons,
                    ...(pack.hero ? [pack.hero] : []),
                  ];
                  const fanH = fanCards.length > 0
                    ? (fanCards.length - 1) * fanPeek + fanCardH
                    : 0;

                  return (
                    <div key={pack.id} className="flex flex-col gap-2 shrink-0 bg-c-elevated rounded-xl border border-c-border/60" style={{ width: colW, padding: PAD }}>
                      {/* Header */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-c-text truncate">
                          {t('boosterN', { n: pack.id })}
                        </span>
                        {pack.hero && (
                          <span className={`text-[8px] font-bold px-1 py-0.5 rounded text-white leading-none w-fit ${FACTION_BADGE_COLORS[pack.hero.faction?.code ?? ''] ?? 'bg-gray-600'}`}>
                            {pack.hero.faction?.code}
                          </span>
                        )}
                        {pack.hasUniqueSlot && (
                          <span className="text-[9px] text-purple-400 font-semibold flex items-center gap-0.5">
                            <i className="fa-solid fa-sparkles text-[8px]" />{t('uniqueSlot')}
                          </span>
                        )}
                      </div>

                      {/* Éventail */}
                      <div className="relative" style={{ width: fanW, height: fanH }}>
                        {fanCards.map((card, i) => (
                          <FanCard
                            key={card.slug + '-fan-' + i}
                            card={card}
                            index={i}
                            total={fanCards.length}
                            colW={fanW}
                            cardH={fanCardH}
                            peek={fanPeek}
                            radius={radius}
                            poolMap={poolMap}
                            onZoom={() => setLightboxCard(card)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Lightbox */}
      {lightboxCard && (() => {
        const rarity = getRarityFromSlug(lightboxCard.slug);
        const reference = getCardReference(lightboxCard);
        const image = rarity !== 'UNIQUE' ? getCardGroupImage(lightboxCard, locale) : null;
        const name = getCardGroupName(lightboxCard);
        return (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setLightboxCard(null)}>
            <div onClick={(e) => e.stopPropagation()}>
              {rarity === 'UNIQUE' && reference ? (
                <div style={{ width: 'min(52vh, 88vw)' }}>
                  <UniqueCardRenderer reference={reference} locale={locale} className="w-full" />
                </div>
              ) : image ? (
                <div className="relative" style={{ height: '85vh', aspectRatio: '744/1039' }}>
                  <Image src={image} alt={name} fill className="object-contain" unoptimized sizes="600px" />
                </div>
              ) : (
                <div className="flex items-center justify-center bg-c-surface rounded-xl p-8 h-64">
                  <span className="text-white text-sm">{name}</span>
                </div>
              )}
            </div>
            <button onClick={() => setLightboxCard(null)} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function FanCard({
  card, index, total, colW, cardH, peek, radius, poolMap, onZoom,
}: {
  card: CardGroup;
  index: number;
  total: number;
  colW: number;
  cardH: number;
  peek: number;
  radius: number;
  poolMap: Map<string, number>;
  onZoom: () => void;
}) {
  const locale = useLocale();
  const [hovered, setHovered] = useState(false);
  const { deck, addCard, canAddCard } = useSealedStore();

  const isLast = index === total - 1;
  const isHero = card.cardType?.reference === 'HERO';
  const rarity = getRarityFromSlug(card.slug);
  const image = getCardGroupImage(card, locale);
  const name = getCardGroupName(card);
  const factionCode = card.faction?.code ?? '';
  const deckQty = deck.cards.find((dc) => dc.cardGroup.slug === card.slug)?.quantity ?? 0;
  const poolQty = poolMap.get(card.slug) ?? 0;
  const addError = canAddCard(card);
  const canAdd = !isHero && addError === null;

  const visibleH = hovered ? cardH : (isLast ? cardH : peek);

  const borderColor =
    isHero            ? '#facc15' :  // jaune — héros
    rarity === 'UNIQUE' ? '#c084fc' :  // violet — unique
    rarity === 'RARE'   ? '#60a5fa' :  // bleu — rare
    'rgba(255,255,255,0.13)';           // subtil — commune
  const borderW = (isHero || rarity === 'RARE' || rarity === 'UNIQUE') ? 2 : 1;

  return (
    // Conteneur clip : gère uniquement la hauteur visible et le z-index, sans style visible
    <div
      style={{
        position: 'absolute',
        top: index * peek,
        width: colW,
        height: visibleH,
        overflow: 'hidden',
        zIndex: hovered ? 200 : (index + 1),
        transition: 'height 0.14s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Conteneur carte : bordure colorée + arrondi sur les 4 coins (le clip externe masque les coins bas quand réduit) */}
      <div
        className="relative group cursor-pointer"
        style={{
          width: colW,
          height: cardH,
          borderRadius: radius,
          border: `${borderW}px solid ${borderColor}`,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        onClick={() => canAdd && addCard(card)}
      >
        {rarity === 'UNIQUE' ? (
          <UniqueCardRenderer reference={getCardReference(card)} locale={locale} className="w-full" />
        ) : image ? (
          <Image src={image} alt={name} fill className="object-cover" sizes={`${colW}px`} unoptimized />
        ) : (
          <div className="absolute inset-0 bg-c-elevated flex items-center justify-center p-1">
            <span className="text-[9px] text-c-text-muted text-center leading-tight">{name}</span>
          </div>
        )}

        {/* Hero badge */}
        {isHero && (
          <div className="absolute top-1 left-1 z-10">
            <span className={`text-[8px] font-bold px-1 py-0.5 rounded text-white leading-none ${FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600'}`}>
              ★
            </span>
          </div>
        )}

        {/* Pool qty badge (only non-heroes) */}
        {!isHero && poolQty > 0 && (
          <div className="absolute top-1 left-1 z-10 bg-black/70 text-white text-[9px] font-bold rounded px-1 leading-none py-0.5">
            ×{poolQty}
          </div>
        )}

        {/* Deck qty badge */}
        {deckQty > 0 && (
          <div className="absolute top-1 right-1 z-10 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center" style={{ width: 16, height: 16 }}>
            {deckQty}
          </div>
        )}

        {/* Hover overlay */}
        {hovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-1.5 z-20">
            <button
              onClick={(e) => { e.stopPropagation(); onZoom(); }}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition"
            >
              <i className="fa-solid fa-magnifying-glass text-xs" />
            </button>
            {canAdd && (
              <button
                onClick={(e) => { e.stopPropagation(); addCard(card); }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition"
              >
                <i className="fa-solid fa-plus text-xs" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
