import type { ApiFormat } from '@/lib/types/deck';

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
