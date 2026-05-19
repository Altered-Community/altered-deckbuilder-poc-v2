import type { ApiFormat } from '@/lib/types/deck';

const KNOWN_CODES = new Set(['sandbox', 'nuc', 'standard', 'singleton', 'singleton_nuc']);

const ALIASES: Record<string, string> = {
  no_unique: 'nuc',
  no_unique_cards: 'nuc',
};

/**
 * Normalise un format venant d'un export Altered (JSON/CSV) vers le code API.
 * Ex: "STANDARD" → "standard", "NO_UNIQUE" → "nuc", "SINGLETON NUC" → "singleton_nuc"
 */
export function normalizeFormatCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ALIASES[code] ?? (KNOWN_CODES.has(code) ? code : null);
}

/** Retourne la limite unique pour un héros donné dans un format Singleton.
 *  heroName ex: "Sierra & Oddball" → on cherche "sierra" dans uniqueLimitsByHero */
export function getUniqueLimit(format: ApiFormat, heroName: string | null): number | null {
  if (!format.uniqueLimitsByHero || !heroName) return format.limits.unique;
  const firstName = heroName.toLowerCase().split(/[\s&,]/)[0].trim();
  for (const [limit, heroes] of Object.entries(format.uniqueLimitsByHero)) {
    if (heroes.includes(firstName)) return Number(limit);
  }
  return format.limits.unique;
}
