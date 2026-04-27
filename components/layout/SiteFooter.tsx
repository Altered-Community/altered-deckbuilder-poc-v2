'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { ThemeBtn, LangBtn } from './SiteHeader';
import type { FooterColumn, AlteredCoreLayout } from '@/lib/api/alteredcoreLayout';

const LOCAL_LINKS = [
  { href: '/',                     icon: 'fa-solid fa-hammer',           label: { en: 'Deck Builder',   fr: 'Deckbuilder'   } },
  { href: '/decks',                icon: 'fa-solid fa-layer-group',      label: { en: 'My Decks',       fr: 'Mes Decks'     } },
  { href: '/decks/import',         icon: 'fa-solid fa-file-import',      label: { en: 'Import',         fr: 'Importer'      } },
  { href: '/decks/import/altered', icon: 'fa-solid fa-cloud-arrow-down', label: { en: 'Import Altered', fr: 'Import Altered' } },
];

function FooterApiColumn({ col, locale }: { col: FooterColumn; locale: 'en' | 'fr' }) {
  const title = col.title[locale];
  const raw   = col.content[locale];
  const safeContent = raw && raw.length < 600
    ? raw
    : col.content['fr'] && col.content['fr'].length < 600
      ? col.content['fr']
      : null;

  return (
    <div>
      {title && <div className="footer-col-title-ac">{title}</div>}
      {safeContent && (
        <div className="footer-col-content-ac" dangerouslySetInnerHTML={{ __html: safeContent }} />
      )}
      {col.links.length > 0 && (
        <ul className="footer-links-ac">
          {col.links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <i className={link.icon} />
                {link.label[locale]}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SiteFooter() {
  const locale = useLocale() as 'en' | 'fr';
  const [columns, setColumns] = useState<FooterColumn[]>([]);

  useEffect(() => {
    fetch('https://alteredcore.org/api.php')
      .then<AlteredCoreLayout>((r) => r.json())
      .then((data) => setColumns(data.footer.columns))
      .catch(() => {});
  }, []);

  const [brandCol, ...restCols] = columns;

  return (
    <footer className="site-footer">
      <div className="footer-container">

        <div className="footer-grid">

          {brandCol && <FooterApiColumn col={brandCol} locale={locale} />}

          <div>
            <div className="footer-col-title-ac">Deck Builder</div>
            <ul className="footer-links-ac">
              {LOCAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <i className={link.icon} />
                    {link.label[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {restCols.map((col) => (
            <FooterApiColumn key={col.num} col={col} locale={locale} />
          ))}

        </div>

        <div className="footer-bottom-ac">
          <span>© 2026 Altered Core — Deck Builder</span>
          <div className="footer-bottom-controls">
            <ThemeBtn />
            <LangBtn />
          </div>
        </div>

      </div>
    </footer>
  );
}
