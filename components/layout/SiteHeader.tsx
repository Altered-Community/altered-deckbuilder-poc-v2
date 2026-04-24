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

const USE_KEYCLOAK = process.env.NEXT_PUBLIC_USE_KEYCLOAK === 'true';

const NAV_LINKS = [
  { href: 'https://alteredcore.org',                                           label: 'Accueil', icon: 'fa-house',      external: false },
  { href: 'https://alteredcore.org/pages/altered.php',   label: 'Altered', icon: 'fa-dragon',     external: true  },
  { href: 'https://alteredcore.org/pages/cards.php',     label: 'Cartes',  icon: 'fa-list-check', external: true  },
  { href: '/',                                           label: 'Deckbuilder', icon: 'fa-layer-group',external: false },
  { href: '/decks',                                      label: 'Decks',   icon: 'fa-layer-group',external: false },
  { href: 'https://alteredcore.org/pages/projects.php',  label: 'Projets', icon: 'fa-briefcase',  external: true  },
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

/* ── User dropdown (matches .btn-user-badge template) ── */
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

  /* close on outside click */
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
export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <nav className="altered-navbar">
        <div className="navbar-inner">

          {/* Brand */}
          <Link href="/" className="navbar-brand-ac" title="Altered Deck Builder">
            <span className="navbar-site-name-ac">Altered Deck Builder</span>
          </Link>

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

            {/* Nav links — centred */}
            <ul className="navbar-nav-ac">
              {NAV_LINKS.map((link) =>
                link.external ? (
                  <li key={link.href} className="nav-item">
                    <a
                      href={link.href}
                      className="nav-link-ac"
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className={`fa-solid ${link.icon}`} />
                      <span>{link.label}</span>
                    </a>
                  </li>
                ) : (
                  <li key={link.href} className="nav-item">
                    <Link
                      href={link.href}
                      className={`nav-link-ac${pathname === link.href ? ' active' : ''}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className={`fa-solid ${link.icon}`} />
                      <span>{link.label}</span>
                    </Link>
                  </li>
                )
              )}
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
