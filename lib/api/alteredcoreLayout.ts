import { cache } from 'react';

export type NavItem = {
  id: number;
  label: { en: string; fr: string };
  url: string;
  icon: string;
  is_blank: boolean;
  children: NavItem[];
};

export type FooterLink = {
  label: { en: string; fr: string };
  url: string;
  icon: string;
};

export type FooterColumn = {
  num: number;
  title: { en: string; fr: string };
  content: { en: string; fr: string };
  links: FooterLink[];
};

export type AlteredCoreLayout = {
  site: { name: string; url: string; logo_url: string };
  nav: NavItem[];
  footer: { columns: FooterColumn[] };
};

const FALLBACK: AlteredCoreLayout = {
  site: {
    name: 'Altered Core',
    url: 'https://alteredcore.org',
    logo_url: 'https://alteredcore.org/assets/logo/site_logo.png',
  },
  nav: [
    { id: 1, label: { en: 'Home', fr: 'Accueil' }, url: 'https://alteredcore.org/', icon: 'fa-solid fa-house', is_blank: false, children: [] },
    { id: 3, label: { en: 'Cards', fr: 'Cartes' }, url: 'https://alteredcore.org/pages/cards', icon: 'fa-solid fa-list-check', is_blank: false, children: [] },
    { id: 7, label: { en: 'Projects', fr: 'Projets' }, url: 'https://alteredcore.org/pages/projects', icon: 'fa-solid fa-briefcase', is_blank: false, children: [] },
  ],
  footer: { columns: [] },
};

export const getAlteredCoreLayout = cache(async (): Promise<AlteredCoreLayout> => {
  try {
    const res = await fetch('https://alteredcore.org/api.php', {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return FALLBACK;
    return await res.json();
  } catch {
    return FALLBACK;
  }
});
