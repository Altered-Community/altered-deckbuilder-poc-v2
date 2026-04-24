'use client';

import Link from 'next/link';
import { ThemeBtn, LangBtn } from './SiteHeader';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-container">

        <div className="footer-grid">
          <div>
            <div className="footer-brand-ac">Altered Deck Builder</div>
            <div className="footer-tagline-ac">Outil communautaire non officiel</div>
          </div>

          <div>
            <ul className="footer-links-ac">
              <li>
                <Link href="/decks">
                  <i className="fa-solid fa-layer-group" />
                  Decks
                </Link>
              </li>
              <li>
                <Link href="/decks/import">
                  <i className="fa-solid fa-file-import" />
                  Importer
                </Link>
              </li>
              <li>
                <Link href="/decks/import/altered">
                  <i className="fa-solid fa-cloud-arrow-down" />
                  Import Altered
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <ul className="footer-links-ac">
              <li>
                <a href="https://altered.gg" target="_blank" rel="noopener">
                  <i className="fa-solid fa-arrow-up-right-from-square" />
                  altered.gg
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-fan-col">
            <a href="https://altered.gg" target="_blank" rel="noopener" className="footer-fan-badge-ac">
              <span style={{ fontWeight: 700, fontSize: '.82rem' }}>Altered</span>
              <span style={{ fontSize: '.78rem', opacity: .75 }}>
                Outil non officiel — non affilié à Equinox.
              </span>
            </a>
          </div>
        </div>

        <div className="footer-bottom-ac">
          <span>© 2026 Altered Deck Builder — Tous droits réservés.</span>
          <div className="footer-bottom-controls">
            <ThemeBtn />
            <LangBtn />
          </div>
        </div>

      </div>
    </footer>
  );
}
