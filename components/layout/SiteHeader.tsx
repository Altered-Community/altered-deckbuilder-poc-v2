'use client';

import { useState, useTransition, useSyncExternalStore, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { setLocale } from '@/lib/actions/locale';
import { useAuthStore } from '@/store/authStore';
import { devLogin } from '@/lib/api/authDev';
import type { NavItem } from '@/lib/api/alteredcoreLayout';

const USE_KEYCLOAK = process.env.NEXT_PUBLIC_USE_KEYCLOAK === 'true';

const LOCAL_NAV: { label: { en: string; fr: string }; url: string; icon: string }[] = [
  { label: { en: 'Deck Builder', fr: 'Deckbuilder' }, url: '/',      icon: 'fa-solid fa-hammer' },
  { label: { en: 'My Decks',    fr: 'Mes Decks'    }, url: '/decks', icon: 'fa-solid fa-layer-group' },
];

/* ── Theme toggle ── */
export function ThemeBtn() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return null;
  const isDark = theme === 'dark';
  return (
    <button
      className="btn-theme-toggle-ac"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle dark mode"
      title={isDark ? 'Mode clair' : 'Mode sombre'}
    >
      <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`} />
    </button>
  );
}

/* ── Language toggle ── */
export function LangBtn() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toggle = () => {
    const next = locale === 'fr' ? 'en' : 'fr';
    startTransition(async () => {
      await setLocale(next as 'fr' | 'en');
      router.refresh();
    });
  };
  return (
    <button className="btn-lang-footer-ac" onClick={toggle} disabled={isPending}>
      {locale === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
    </button>
  );
}

/* ── User dropdown ── */
function UserDropdown() {
  const { data: session, status } = useSession();
  const { token, setToken, logout } = useAuthStore();
  const [devLoading, setDevLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isKeycloak = USE_KEYCLOAK && status === 'authenticated';
  const isDev      = !USE_KEYCLOAK && !!token;
  const loggedIn   = isKeycloak || isDev;

  const displayName = isKeycloak
    ? (session?.user?.name ?? session?.user?.email ?? 'Compte')
    : isDev ? 'Dev' : '';

  const email = isKeycloak ? (session?.user?.email ?? '') : '';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    if (USE_KEYCLOAK) {
      await signOut({ redirect: false });
      logout();
      window.location.href = '/';
    } else {
      logout();
    }
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      const t = await devLogin();
      setToken(t);
    } finally {
      setDevLoading(false);
    }
  };

  const handleLogin = () => {
    if (USE_KEYCLOAK) signIn('keycloak');
    else handleDevLogin();
  };

  if (!loggedIn) {
    return (
      <button
        onClick={handleLogin}
        disabled={devLoading || status === 'loading'}
        className="btn-user-badge"
      >
        <i className="fa-solid fa-right-to-bracket" />
        <span>{devLoading || status === 'loading' ? '...' : 'Connexion'}</span>
      </button>
    );
  }

  return (
    <div className="ac-dropdown" ref={ref}>
      <button
        className="btn-user-badge dropdown-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <i className="fa-solid fa-user" />
        <span>{displayName}</span>
      </button>

      {open && (
        <ul className="ac-dropdown-menu">
          {email && (
            <li>
              <span className="ac-dropdown-item-text">{email}</span>
            </li>
          )}
          <li><hr className="ac-dropdown-divider" /></li>
          <li>
            <button className="ac-dropdown-item ac-dropdown-item-danger" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket" />
              Déconnexion
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

/* ── Main header ── */
export default function SiteHeader({
  navItems = [],
  logoUrl = 'https://alteredcore.org/assets/logo/site_logo.png',
}: {
  navItems?: NavItem[];
  logoUrl?: string;
}) {
  const pathname = usePathname();
  const locale = useLocale() as 'en' | 'fr';
  const [menuOpen, setMenuOpen] = useState(false);

  // API items (skip "Decks" pointing to alteredcore since we have local equivalent)
  const apiItems = navItems.filter((item) => item.id !== 4);

  // Inject local items after the first API item (Home)
  const [home, ...rest] = apiItems;
  const mergedNav = home ? [home, ...LOCAL_NAV.map((l, i) => ({ ...l, id: -1 - i, is_blank: false, children: [] })), ...rest] : LOCAL_NAV.map((l, i) => ({ ...l, id: -1 - i, is_blank: false, children: [] }));

  return (
    <header className="site-header">
      <nav className="altered-navbar">
        <div className="navbar-inner">

          {/* Brand */}
          <a href="https://alteredcore.org" className="navbar-brand-ac" title="AlteredCore">
            <img src={logoUrl} alt="AlteredCore" className="navbar-logo-custom" />
            <span className="navbar-site-name-ac">AlteredCore</span>
          </a>

          {/* Burger (mobile) */}
          <button
            className="navbar-toggler-ac"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <i className="fa-solid fa-bars" />
          </button>

          {/* Collapsible content */}
          <div className={`navbar-collapse-ac${menuOpen ? ' open' : ''}`}>

            <ul className="navbar-nav-ac">
              {mergedNav.map((item) => {
                const label = 'label' in item && typeof item.label === 'object'
                  ? (item.label as { en: string; fr: string })[locale]
                  : '';
                const isLocal = item.id < 0;
                const isActive = isLocal && pathname === item.url;

                if (isLocal) {
                  return (
                    <li key={item.url} className="nav-item nav-item-local">
                      <Link
                        href={item.url}
                        className={`nav-link-ac${isActive ? ' active' : ''}`}
                        onClick={() => setMenuOpen(false)}
                      >
                        <i className={item.icon} />
                        <span>{label}</span>
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={item.id} className="nav-item">
                    <a
                      href={item.url}
                      className="nav-link-ac"
                      target={item.is_blank ? '_blank' : undefined}
                      rel={item.is_blank ? 'noopener noreferrer' : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className={item.icon} />
                      <span>{label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>

            {/* Right side */}
            <div className="navbar-right-ac">
              <ThemeBtn />
              <LangBtn />
              <UserDropdown />
            </div>

          </div>
        </div>
      </nav>
    </header>
  );
}
