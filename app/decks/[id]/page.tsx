'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDeckDetail, getDeckDetailPublic, getDecks, patchDeck, deleteDeck, fetchFormats } from '@/lib/api/deckApi';
import type { ApiDeckDetail, ApiDeckCard, ApiLegalityDetail } from '@/lib/types/deck';
import { cardGroupFromDeckCard, getCardGroupFaction, getCdnImageUrl, getHeroImageUrl, getRarityFromSlug } from '@/lib/utils/card';
import UniqueCardRenderer from '@/components/cards/UniqueCardRenderer';
import DeckDetailStats from '@/components/deck/DeckDetailStats';
import SiteLayout from '@/components/layout/SiteLayout';
import { useDeckStore } from '@/store/deckStore';
import { FACTION_BADGE_COLORS, CARD_TYPE_LABELS, FACTION_HERO_GRADIENT } from '@/lib/types/constants';

const TYPE_ORDER = ['HERO', 'CHARACTER', 'SPELL', 'PERMANENT', 'LANDMARK_PERMANENT', 'EXPEDITION_PERMANENT', 'TOKEN', 'TOKEN_MANA'];

const LEGALITY_KEYS: (keyof ApiLegalityDetail)[] = [
  'hero', 'deckSize', 'faction', 'sets', 'bannedCards', 'suspendedCards',
  'copies', 'uniqueQuantity', 'rareQuantity', 'exaltedQuantity',
];

function DeckLegality({ legal, detail, formatErrors }: { legal: boolean | undefined; detail: ApiLegalityDetail | undefined; formatErrors?: string[] }) {
  const t = useTranslations('deckEdit');

  const labelKey: Record<keyof ApiLegalityDetail, string> = {
    hero: t('legalityHero'),
    deckSize: t('legalityDeckSize'),
    faction: t('legalityFaction'),
    sets: t('legalitySets'),
    bannedCards: t('legalityBannedCards'),
    suspendedCards: t('legalitySuspendedCards'),
    copies: t('legalityCopies'),
    uniqueQuantity: t('legalityUniqueQuantity'),
    rareQuantity: t('legalityRareQuantity'),
    exaltedQuantity: t('legalityExaltedQuantity'),
    global: '',
  };

  const isLegal = legal ?? detail?.global;

  return (
    <div className="card-altered overflow-hidden">
      <div className="px-4 py-3 border-b border-c-border-subtle flex items-center justify-between">
        <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">{t('legalityTitle')}</h2>
        {isLegal !== undefined && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${isLegal ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}
          >
            {isLegal ? (
              <><i className="fa-solid fa-circle-check mr-1" />{t('legalityLegal')}</>
            ) : (
              <><i className="fa-solid fa-circle-xmark mr-1" />{t('legalityIllegal')}</>
            )}
          </span>
        )}
      </div>
      {detail && (
        <div className="px-4 py-3 flex flex-col gap-1.5">
          {LEGALITY_KEYS.map((key) => {
            const ok = detail[key];
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-c-text-secondary">{labelKey[key]}</span>
                <i className={`fa-solid ${ok ? 'fa-check text-green-500' : 'fa-xmark text-red-500'}`} />
              </div>
            );
          })}
          {formatErrors && formatErrors.length > 0 && (
            <div className="mt-2 pt-2 border-t border-c-border-subtle flex flex-col gap-1">
              {formatErrors.map((err, i) => (
                <p key={i} className="text-[11px] text-red-400 leading-tight">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getFactionCode(heroRef: string | undefined): string | null {
  if (!heroRef) return null;
  const parts = heroRef.split('_');
  return parts.length > 3 ? parts[3] : null;
}

function groupByType(deckCards: ApiDeckCard[]) {
  const groups: Record<string, ApiDeckCard[]> = {};
  for (const dc of deckCards) {
    const type = dc.cardTypeReference ?? 'OTHER';
    if (!groups[type]) groups[type] = [];
    groups[type].push(dc);
  }
  return TYPE_ORDER
    .filter((t) => groups[t]?.length)
    .map((t) => ({ type: t, label: CARD_TYPE_LABELS[t] ?? t, cards: groups[t] }));
}

function CardRow({ dc, onClick }: { dc: ApiDeckCard; onClick: () => void }) {
  const locale = useLocale();
  const name = dc.name ?? dc.cardReference;
  const isUnique = getRarityFromSlug(dc.cardReference) === 'UNIQUE';
  const image = isUnique ? null : getCdnImageUrl(dc.cardReference, locale);

  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg overflow-hidden border border-c-border bg-c-surface cursor-pointer hover:brightness-110 hover:scale-[1.02] transition-all duration-100 select-none ${isUnique ? '' : 'aspect-[744/1039]'}`}
    >
      {isUnique ? (
        <UniqueCardRenderer reference={dc.cardReference} className="w-full" />
      ) : image ? (
        <Image src={image} alt={name} className="absolute inset-0 w-full h-full object-cover" fill sizes="(max-width: 768px) 50vw, 33vw" />
      ) : null}
      <span className="absolute top-1.5 right-1.5 z-10 text-sm font-bold text-white bg-black/70 px-2 py-0.5 rounded-full shadow">
        x{dc.quantity}
      </span>
    </div>
  );
}

function ListRow({ dc, onClick }: { dc: ApiDeckCard; onClick: () => void }) {
  const name = dc.name ?? dc.cardReference;
  const faction = dc.factionCode ?? '';
  const badge = FACTION_BADGE_COLORS[faction] ?? 'bg-gray-600';

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 py-1.5 border-b border-c-border-subtle last:border-0 cursor-pointer hover:bg-c-elevated transition-colors rounded px-1 -mx-1"
    >
      {faction && (
        <span className={`text-[9px] font-bold px-1 rounded text-white shrink-0 ${badge}`}>
          {faction}
        </span>
      )}
      <span className="w-4 text-xs text-c-text-muted text-right shrink-0">{dc.quantity}×</span>
      <span className="flex-1 text-xs text-c-text-secondary">{name}</span>
      <span className="text-[10px] text-c-text-subtle font-mono shrink-0">{dc.cardReference}</span>
    </div>
  );
}

function DeckCards({ deckCards, view }: { deckCards: ApiDeckCard[]; view: 'cards' | 'list' }) {
  const t = useTranslations('deckEdit');
  const router = useRouter();
  const groups = groupByType(deckCards);
  if (deckCards.length === 0) return <p className="text-c-text-subtle text-sm">{t('noCards')}</p>;

  const openCard = (ref: string) => router.push(`/cards/${ref}`);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g, i) => (
        <div key={g.type}>
          {i > 0 && <hr className="border-c-border-subtle mb-6" />}
          <p className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-2">
            {g.label}
            <span className="ml-1.5 text-c-text-subtle font-normal normal-case">
              ({g.cards.reduce((s, dc) => s + dc.quantity, 0)})
            </span>
          </p>
          {view === 'cards' ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
              {g.cards.map((dc) => (
                <CardRow key={dc.cardReference} dc={dc} onClick={() => openCard(dc.cardReference)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {g.cards.map((dc) => (
                <ListRow key={dc.cardReference} dc={dc} onClick={() => openCard(dc.cardReference)} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DeckEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('deckEdit');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const locale = useLocale();
  const { token } = useAuth();

  const [deck, setDeck] = useState<ApiDeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const { data: formats = [] } = useQuery({ queryKey: ['formats'], queryFn: fetchFormats, staleTime: Infinity });

  const { data: myDecks = [] } = useQuery({
    queryKey: ['my-decks', locale],
    queryFn: () => getDecks(locale),
    enabled: !!token,
    staleTime: 60_000,
  });
  const isOwner = !!token && myDecks.some((d) => d.id === id);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loadingBuilder, setLoadingBuilder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardView, setCardView] = useState<'cards' | 'list'>('cards');

  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetcher = token ? getDeckDetail(id, locale) : getDeckDetailPublic(id, locale);
    fetcher
      .then((d) => {
        setDeck(d);
        setName(d.name);
        setDescription(d.description ?? '');
        setFormat(d.format ?? '');
        setIsPublic(d.isPublic);
      })
      .catch((e) => setError(e instanceof Error ? e.message : tc('unknownError')))
      .finally(() => setLoading(false));
  }, [id, token, locale, tc]);

  const handleOpenInBuilder = async () => {
    if (!deck) return;
    setLoadingBuilder(true);
    setLoadError(null);
    try {
      const heroDc = deck.cards.find((dc) => dc.cardTypeReference === 'HERO');
      const hero = heroDc ? cardGroupFromDeckCard(heroDc) : null;
      const cards = deck.cards
        .filter((dc) => dc.cardTypeReference !== 'HERO')
        .map((dc) => ({ cardGroup: cardGroupFromDeckCard(dc), quantity: dc.quantity }));

      useDeckStore.setState({
        deck: {
          id: crypto.randomUUID(),
          apiId: deck.id,
          name: deck.name,
          format: formats.find((f) => f.code === deck.format) ?? null,
          hero,
          cards,
          createdAt: deck.createdAt,
          updatedAt: deck.updatedAt ?? deck.createdAt,
        },
      });

      const faction = hero ? getCardGroupFaction(hero) : null;
      router.push(faction ? `/deck?faction=${faction}` : '/deck');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : tc('unknownError'));
      setLoadingBuilder(false);
    }
  };

  const handleSave = async () => {
    if (!isOwner) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await patchDeck(id, { name: name.trim(), description: description.trim() || null, format: format || null, isPublic });
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : tc('unknownError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    try {
      await deleteDeck(id);
      router.push('/decks');
    } catch {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const handleOpenRename = () => {
    setRenameInput(deck?.name ?? '');
    setShowRename(true);
  };

  const handleRename = async () => {
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    setRenaming(true);
    try {
      await patchDeck(id, { name: trimmed });
      setDeck((d) => d ? { ...d, name: trimmed } : d);
      setName(trimmed);
      setShowRename(false);
    } finally {
      setRenaming(false);
    }
  };

  const handleCopyDecklist = useCallback(() => {
    if (!deck) return;
    const lines: string[] = [];
    const hero = deck.cards.find((dc) => dc.cardTypeReference === 'HERO');
    if (hero) lines.push(`1 ${hero.cardReference}`);
    for (const dc of deck.cards) {
      if (dc.cardTypeReference === 'HERO') continue;
      lines.push(`${dc.quantity} ${dc.cardReference}`);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [deck]);

  const handleExportImage = useCallback(async () => {
    if (!deck || exporting) return;
    setExporting(true);
    try {
      const loadImage = (src: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

      // Render an altered-card web component off-screen and extract its canvas
      const renderUniqueCard = (reference: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const container = document.createElement('div');
          container.style.cssText = 'position:fixed;left:-9999px;top:0;width:220px;height:308px;overflow:hidden;pointer-events:none;';
          document.body.appendChild(container);
          const el = document.createElement('altered-card');
          el.setAttribute('ref', reference);
          el.setAttribute('locale', locale);
          container.appendChild(el);

          let attempts = 0;
          const poll = () => {
            const cv = container.querySelector('canvas') as HTMLCanvasElement | null;
            if (cv && cv.width > 0) {
              try {
                const dataUrl = cv.toDataURL('image/png');
                document.body.removeChild(container);
                const img = new window.Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = dataUrl;
              } catch {
                document.body.removeChild(container);
                resolve(null);
              }
              return;
            }
            if (++attempts < 80) setTimeout(poll, 100);
            else { document.body.removeChild(container); resolve(null); }
          };
          setTimeout(poll, 300);
        });

      // Merge CORE + COREKS variants, then sort: Characters by mainCost → Spells → Permanents → rest
      const EXPORT_TYPE_ORDER = ['CHARACTER', 'SPELL', 'PERMANENT', 'LANDMARK_PERMANENT', 'EXPEDITION_PERMANENT', 'TOKEN', 'TOKEN_MANA'];
      const nonHeroCards = deck.cards.filter((dc) => dc.cardTypeReference !== 'HERO');

      const mergeMap = new Map<string, typeof nonHeroCards[number] & { quantity: number }>();
      for (const dc of nonHeroCards) {
        const key = dc.cardReference.replace(/^ALT_COREKS_/, 'ALT_CORE_');
        const existing = mergeMap.get(key);
        if (existing) {
          existing.quantity += dc.quantity;
        } else {
          mergeMap.set(key, { ...dc, cardReference: key });
        }
      }

      const merged = Array.from(mergeMap.values());
      const allNonHero = EXPORT_TYPE_ORDER
        .flatMap((type) => {
          const group = merged.filter((dc) => dc.cardTypeReference === type);
          if (type === 'CHARACTER') group.sort((a, b) => (a.mainCost ?? 99) - (b.mainCost ?? 99));
          return group;
        })
        .concat(merged.filter((dc) => !EXPORT_TYPE_ORDER.includes(dc.cardTypeReference ?? '')));

      const COLS = 7;
      const CARD_W = 420;
      const CARD_H = Math.round(CARD_W * 1039 / 744);
      const GAP = 12;
      const PAD = 40;
      const PEEK = 36;
      const RADIUS = 10;
      const HEADER_H = 300;
      const SLOT_H = CARD_H + 2 * PEEK;

      const rows = Math.ceil(allNonHero.length / COLS);
      const canvasW = PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP;
      const canvasH = HEADER_H + PAD + rows * SLOT_H + (rows - 1) * GAP + PAD;

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d')!;

      // Background
      ctx.fillStyle = '#f8f7f2';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Load hero + banner + gem + card images in parallel
      const exportFactionCode = getFactionCode(deck.stats?.hero?.reference);
      const heroImgPromise = deck.stats?.hero
        ? loadImage(getHeroImageUrl(deck.stats.hero.reference))
        : Promise.resolve(null);
      const bannerImgPromise = exportFactionCode
        ? loadImage(`/banner_${exportFactionCode}.png`)
        : Promise.resolve(null);
      const gemPromises = (['C', 'R', 'U', 'E'] as const).map((k) =>
        loadImage(`https://alteredcore.org/assets/gems/${k}.png`)
      );
      const cardImgPromises = allNonHero.map((dc) => {
        const isUnique = getRarityFromSlug(dc.cardReference) === 'UNIQUE';
        if (isUnique) {
          // Render via the altered-card web component (uses its internal canvas)
          return renderUniqueCard(dc.cardReference);
        }
        // Non-unique: CDN has CORS, load directly
        const url = getCdnImageUrl(dc.cardReference, locale);
        return url ? loadImage(url) : Promise.resolve(null);
      });

      const [heroImg, bannerImg, ...rest] = await Promise.all([heroImgPromise, bannerImgPromise, ...gemPromises, ...cardImgPromises]);
      const gemImgs = rest.slice(0, 4) as (HTMLImageElement | null)[];
      const cardImgs = rest.slice(4) as (HTMLImageElement | null)[];

      // Header background (faction color) with white border
      const factionColor = exportFactionCode ? (FACTION_HERO_GRADIENT[exportFactionCode] ?? '#1e293b') : '#1e293b';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, HEADER_H);
      ctx.fillStyle = factionColor;
      ctx.fillRect(3, 3, canvasW - 6, HEADER_H - 3);

      // Type counts (computed before drawing)
      const typeCounts: Record<string, number> = {};
      for (const dc of deck.cards) {
        if (dc.cardTypeReference === 'HERO') continue;
        const t = dc.cardTypeReference ?? 'OTHER';
        typeCounts[t] = (typeCounts[t] ?? 0) + dc.quantity;
      }
      const typeLabel = Object.entries(typeCounts)
        .map(([t, n]) => `${n} ${CARD_TYPE_LABELS[t] ?? t}`)
        .join('  ·  ');

      // Hero image with diagonal right-edge separator (cover crop, no distortion)
      const SLANT = 38;
      let textX = PAD + 12;
      let heroDrawW = 0;
      if (heroImg) {
        const natW = heroImg.naturalWidth;
        const natH = heroImg.naturalHeight;
        const destH = HEADER_H - 3;
        const destW = Math.round(destH * 2.2); // target display width
        heroDrawW = destW;

        // Cover crop: fill destW x destH from center of source
        const scaleByH = destH / natH;
        let srcW = Math.round(destW / scaleByH);
        let srcX = Math.round((natW - srcW) / 2);
        if (srcW > natW) { srcW = natW; srcX = 0; }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(3, 3);
        ctx.lineTo(destW + 3, 3);
        ctx.lineTo(destW + 3 - SLANT, HEADER_H);
        ctx.lineTo(3, HEADER_H);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(heroImg, srcX, 0, srcW, natH, 3, 3, destW, destH);
        ctx.restore();

        heroDrawW = destW + 3;
        textX = heroDrawW + 20;
      }

      // Banner width reservation (for text max-width calculation)
      const BANNER_DISPLAY_H = 260;
      const BANNER_OVERFLOW = 28;
      const bannerReservedW = bannerImg
        ? Math.round(BANNER_DISPLAY_H * (bannerImg.naturalWidth / bannerImg.naturalHeight)) + PAD + 16
        : 0;
      const maxTextW = canvasW - textX - bannerReservedW;

      // Deck name (top)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px system-ui, sans-serif';
      ctx.fillText(deck.name, textX, 64, maxTextW);

      // Type breakdown aligned bottom-left
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(typeLabel, textX, HEADER_H - 24, maxTextW);

      // Banner: smaller, overflowing top and bottom
      const byRarity = deck.stats?.byRarity ?? {};
      const gemKeys = ['C', 'R', 'U', 'E'] as const;

      if (bannerImg) {
        const bannerNatW = bannerImg.naturalWidth;
        const bannerNatH = bannerImg.naturalHeight;
        const bannerW = Math.round(BANNER_DISPLAY_H * (bannerNatW / bannerNatH));
        const bannerX = canvasW - bannerW - PAD;
        // Draw at natural aspect ratio, no stretching
        ctx.drawImage(bannerImg, 0, 0, bannerNatW, bannerNatH, bannerX, -BANNER_OVERFLOW, bannerW, BANNER_DISPLAY_H);

        // Rarities below banner: number then icon, displayed horizontally
        const GEM_SLOT_W = 38;
        const GEM_GAP = 10;
        const GEM_H = Math.round(GEM_SLOT_W * 0.77);
        const activeGems = gemKeys.filter((k) => (byRarity[k] ?? 0) > 0);
        const totalRarityW = activeGems.length * GEM_SLOT_W + (activeGems.length - 1) * GEM_GAP;
        let gx = bannerX + Math.round((bannerW - totalRarityW) / 2);
        const numY = BANNER_DISPLAY_H - BANNER_OVERFLOW + 20;
        const icnY = numY + 6;

        ctx.textAlign = 'center';
        activeGems.forEach((key) => {
          const i = gemKeys.indexOf(key);
          const count = byRarity[key] ?? 0;
          const cx = gx + GEM_SLOT_W / 2;
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px system-ui, sans-serif';
          ctx.fillText(String(count), cx, numY);
          const gemImg = gemImgs[i];
          if (gemImg) ctx.drawImage(gemImg, gx, icnY, GEM_SLOT_W, GEM_H);
          gx += GEM_SLOT_W + GEM_GAP;
        });
        ctx.textAlign = 'left';
      } else {
        // Fallback: inline gem counts in header
        let gemX = textX;
        const gemY = HEADER_H - 30;
        gemKeys.forEach((key, i) => {
          const count = byRarity[key] ?? 0;
          if (!count) return;
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px system-ui, sans-serif';
          const countStr = String(count);
          ctx.fillText(countStr, gemX, gemY);
          const cw = ctx.measureText(countStr).width;
          const gemImg = gemImgs[i];
          if (gemImg) ctx.drawImage(gemImg, gemX + cw + 2, gemY - 12, 16, 12);
          gemX += cw + (gemImg ? 24 : 20);
        });
      }

      // Draw cards with stacking effect
      const clip = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
        ctx.clip();
      };

      allNonHero.forEach((dc, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const slotX = PAD + col * (CARD_W + GAP);
        const slotY = HEADER_H + PAD + row * (SLOT_H + GAP);
        const img = cardImgs[i];
        const n = Math.min(dc.quantity, 3);

        // Draw from back to front; front card is bottom-aligned in slot
        for (let p = n - 1; p >= 0; p--) {
          const cardY = slotY + (SLOT_H - CARD_H) - p * PEEK;
          ctx.save();
          clip(slotX, cardY, CARD_W, CARD_H, RADIUS);
          if (img) {
            ctx.drawImage(img, slotX, cardY, CARD_W, CARD_H);
          } else {
            ctx.fillStyle = '#27272a';
            ctx.fillRect(slotX, cardY, CARD_W, CARD_H);
            if (p === 0) {
              ctx.fillStyle = '#71717a';
              ctx.font = '16px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(dc.name ?? dc.cardReference, slotX + CARD_W / 2, cardY + CARD_H / 2);
              ctx.textAlign = 'left';
            }
          }
          ctx.restore();
        }
      });

      // Watermark
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('alteredcore.org', canvasW - PAD, canvasH - 6);

      const link = document.createElement('a');
      link.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  }, [deck, exporting, locale]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: deck?.name ?? '', url }); } catch { /* annulé */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }, [deck]);

  const heroRef2    = deck?.stats?.hero?.reference ?? null;
  const heroImage   = heroRef2 ? getHeroImageUrl(heroRef2) : (deck?.stats?.hero?.imagePath ?? null);
  const heroName    = deck?.stats?.hero?.name ?? null;
  const factionCode = getFactionCode(deck?.stats?.hero?.reference);
  const totalCards  = deck?.cards.reduce((s, dc) => s + dc.quantity, 0) ?? 0;

  const inputClass = 'w-full bg-c-surface border border-c-border rounded-lg px-3 py-2 text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

  const gradientColor = factionCode ? (FACTION_HERO_GRADIENT[factionCode] ?? null) : null;
  const bannerStyle: React.CSSProperties = heroImage
    ? {
        borderTop: '3px solid var(--primary-400)',
        backgroundImage: gradientColor
          ? `linear-gradient(to right, ${gradientColor}cc 30%, ${gradientColor}00 50%), url(${heroImage})`
          : `url(${heroImage})`,
        backgroundSize: 'cover',
      }
    : { borderTop: '3px solid var(--primary-400)' };

  return (
    <SiteLayout>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* ── En-tête ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/decks" className="text-c-text-muted hover:text-c-text transition">
              {tn('backMyDecks')}
            </Link>
            <span className="text-c-border">›</span>
            <span className="font-bold text-c-text truncate max-w-xs">
              {loading ? '…' : (deck?.name ?? '')}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {loadError && <span className="text-xs text-red-400">{loadError}</span>}

            {isOwner && (
              <button onClick={handleOpenRename} className="ac-btn">
                <i className="fa-solid fa-pencil" />
                {t('rename')}
              </button>
            )}

            <button
              onClick={handleOpenInBuilder}
              disabled={loadingBuilder}
              className="ac-btn disabled:opacity-40"
            >
              <i className="fa-solid fa-pen-to-square" />
              {loadingBuilder ? '…' : t('builder')}
            </button>

            {isOwner && (
              deleteConfirm ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="ac-btn ac-btn-danger disabled:opacity-40"
                  >
                    <i className="fa-solid fa-trash" />
                    {deleting ? '…' : t('deleteConfirm')}
                  </button>
                  <button onClick={() => setDeleteConfirm(false)} className="ac-btn">
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <button onClick={handleDelete} className="ac-btn ac-btn-danger">
                  <i className="fa-solid fa-trash" />
                  {t('delete')}
                </button>
              )
            )}

            {deck && (
              <button onClick={handleCopyDecklist} className="ac-btn">
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
                {copied ? t('copied') : t('copyDecklist')}
              </button>
            )}

            {deck && (
              <button onClick={handleExportImage} disabled={exporting} className="ac-btn disabled:opacity-40">
                <i className={`fa-solid ${exporting ? 'fa-spinner fa-spin' : 'fa-image'}`} />
                {exporting ? t('exporting') : t('exportImage')}
              </button>
            )}

            {deck && (
              <button onClick={handleShare} className="ac-btn">
                <i className={`fa-solid ${shared ? 'fa-check' : 'fa-share-nodes'}`} />
                {shared ? t('shared') : t('share')}
              </button>
            )}
          </div>
        </div>

        {/* ── États ── */}
        {loading && <p className="text-c-text-muted text-sm">{tc('loading')}</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && deck && (
          <>
            {/* ── Bannière héro ── */}
            <div className="news-card" style={bannerStyle}>
              <div className="news-card-body">
                <div className="flex flex-wrap gap-1 items-center">
                  {deck.format && (
                    <span className="ac-badge" style={{ background: 'var(--primary-400)', color: '#fff' }}>
                      {deck.format}
                    </span>
                  )}
                  {deck.legal !== undefined && (
                    <span
                      className="ac-badge"
                      style={deck.legal
                        ? { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.12)', color: '#16a34a' }
                        : { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.12)', color: '#dc2626' }
                      }
                    >
                      <i className={`fa-solid ${deck.legal ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                      {deck.legal ? t('legalityLegal') : t('legalityIllegal')}
                    </span>
                  )}
                  <span
                    className="ac-badge ml-auto"
                    style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.12)', color: '#444' }}
                  >
                    <i className={`fa-solid ${deck.isPublic ? 'fa-globe' : 'fa-lock'}`} />
                    {deck.isPublic ? tc('public') : tc('private')}
                  </span>
                </div>

                <h1 className="news-card-title">
                  {factionCode && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://alteredcore.org/assets/faction/${factionCode}.png`}
                      alt={factionCode}
                      style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
                    />
                  )}
                  {deck.name}
                </h1>
                {heroName && (
                  <p style={{ fontSize: '.8rem', opacity: 0.75, color: '#fff', margin: 0 }}>{heroName}</p>
                )}

                {/* Gems */}
                {deck.stats?.byRarity && (
                  <div className="flex items-center gap-3 mt-1" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                    {(['C', 'R', 'U', 'E'] as const).map((key) => {
                      const count = deck.stats?.byRarity[key] ?? 0;
                      if (!count) return null;
                      return (
                        <span key={key} className="flex items-center gap-1" style={{ fontSize: '.85rem', fontWeight: 600, color: '#fff' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://alteredcore.org/assets/gems/${key}.png`} alt={key} style={{ width: 14, height: 14, objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }} />
                          {count}
                        </span>
                      );
                    })}
                  </div>
                )}

                <p style={{ fontSize: '.72rem', color: '#fff', margin: '4px 0 0', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {deck.updatedAt
                    ? `${t('updatedAt')} ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(deck.updatedAt))}`
                    : `${t('createdAt')} ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(deck.createdAt))}`
                  }
                </p>
              </div>
            </div>

            {/* ── Contenu principal ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

              {/* Cartes (2/3) */}
              <div className="lg:col-span-2 card-altered p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">
                    {t('cards', { count: totalCards })}
                  </h2>
                  <div className="flex border border-c-border rounded-lg overflow-hidden">
                    {(['cards', 'list'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setCardView(v)}
                        className={`px-3 py-1 text-xs transition ${cardView === v ? 'bg-c-input text-c-text font-semibold' : 'text-c-text-subtle hover:text-c-text-secondary'}`}
                      >
                        {v === 'cards' ? t('byType') : t('list')}
                      </button>
                    ))}
                  </div>
                </div>
                <DeckCards deckCards={deck.cards} view={cardView} />
              </div>

              {/* Sidebar droite (1/3) */}
              <div className="flex flex-col gap-4">

                {/* Formulaire — uniquement pour le propriétaire du deck */}
                {isOwner && (
                  <div className="card-altered p-4 flex flex-col gap-4">
                    <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">{t('info')}</h2>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-c-text-muted">{t('name')}</label>
                      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} className={inputClass} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-c-text-muted">{t('description')}</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass + ' resize-none'} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-c-text-muted">{t('format')}</label>
                      <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputClass}>
                        <option value="">{tc('noFormat')}</option>
                        {formats.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setIsPublic((v) => !v)}
                        className={`w-9 h-5 rounded-full transition-colors ${isPublic ? 'bg-amber-500' : 'bg-c-input'} relative`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-4' : ''}`} />
                      </div>
                      <span className="text-sm text-c-text-muted">{t('public')}</span>
                    </label>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                        className="btn-primary-altered btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {saving ? tc('saving') : tc('save')}
                      </button>
                      {saved && <span className="text-sm text-green-600 dark:text-green-400 font-medium">{tc('saved')}</span>}
                      {saveError && <span className="text-xs text-red-500">{saveError}</span>}
                    </div>
                  </div>
                )}

                {/* Légalité */}
                <DeckLegality legal={deck.legal} detail={deck.legalityDetail} formatErrors={deck.formatErrors} />

                {/* Statistiques */}
                <div className="card-altered overflow-hidden">
                  <div className="px-4 py-3 border-b border-c-border-subtle">
                    <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">{t('statsTitle')}</h2>
                  </div>
                  <DeckDetailStats cards={deck.cards} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal rename ── */}
      {showRename && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowRename(false)}
        >
          <div
            className="card-altered p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-c-text">{t('renameTitle')}</h2>
            <input
              autoFocus
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setShowRename(false); }}
              maxLength={150}
              className="w-full bg-c-surface border border-c-border rounded-lg px-3 py-2 text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRename(false)} className="ac-btn">{t('cancel')}</button>
              <button
                onClick={handleRename}
                disabled={renaming || !renameInput.trim()}
                className="btn-primary-altered btn-sm disabled:opacity-40"
              >
                {renaming ? '…' : tc('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
