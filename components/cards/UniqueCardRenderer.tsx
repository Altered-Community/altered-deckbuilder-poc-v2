'use client';

import { useEffect, useRef } from 'react';

interface Props {
  reference: string;
  locale?: string;
  className?: string;
}

export default function UniqueCardRenderer({ reference, locale = 'fr', className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const mount = () => {
      if (cancelled || !container) return;
      container.innerHTML = '';
      const el = document.createElement('altered-card');
      el.setAttribute('ref', reference);
      el.setAttribute('locale', locale);
      el.style.display = 'block';
      el.style.width = '100%';
      container.appendChild(el);
    };

    if (customElements.get('altered-card')) {
      mount();
    } else {
      customElements.whenDefined('altered-card').then(mount);
    }

    return () => {
      cancelled = true;
      if (container) container.innerHTML = '';
    };
  }, [reference, locale]);

  return <div ref={containerRef} className={className} />;
}
