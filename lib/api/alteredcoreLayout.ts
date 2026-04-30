import { cache } from 'react';

export type NavItem = {
  id: number;
  label: { en: string; fr: string };
  url: string;
  icon: string;
  is_blank: boolean;
  hide_label: boolean;
  pos: number;
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

export type Language = {
  code: string;
  name: string;
  flag: string;
  nav_labels: boolean;
  is_default: boolean;
};

export type UserMenuItem = {
  id: number;
  type: 'system' | 'separator' | 'link';
  system_key: string | null;
  label: { en: string; fr: string };
  url: string | null;
  icon: string;
};

export type NavSettings = {
  mobile_header_mode: number;
  icons_only_mode: string;
  navbar_width: string;
  font_nav_url: string;
  font_alteredicons_url: string;
};

export type AlteredCoreLayout = {
  site: { name: string; url: string; logo_url: string };
  nav: NavItem[];
  nav_html?: string;
  nav_css_url?: string;
  languages?: Language[];
  user_menu?: UserMenuItem[];
  settings?: NavSettings;
  footer?: { columns: FooterColumn[] };
};

const FALLBACK: AlteredCoreLayout = {
  site: {
    name: 'Altered Core',
    url: 'https://alteredcore.org',
    logo_url: 'https://alteredcore.org/assets/logo/site_logo.png',
  },
  nav: [
    { id: 1, label: { en: 'Home',     fr: 'Accueil' }, url: 'https://alteredcore.org/',               icon: 'fa-solid fa-house',      is_blank: false, hide_label: false, pos: 10, children: [] },
    { id: 3, label: { en: 'Cards',    fr: 'Cartes'  }, url: 'https://alteredcore.org/pages/cards',    icon: 'fa-solid fa-table-cells', is_blank: false, hide_label: false, pos: 20, children: [] },
    { id: 7, label: { en: 'Projects', fr: 'Projets' }, url: 'https://alteredcore.org/pages/projects', icon: 'fa-solid fa-briefcase',   is_blank: false, hide_label: false, pos: 40, children: [] },
  ],
};

export const getAlteredCoreLayout = cache(async (): Promise<AlteredCoreLayout> => {
  try {
    const res = await fetch('https://alteredcore.org/api/nav', {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return FALLBACK;
    return await res.json();
  } catch {
    return FALLBACK;
  }
});
