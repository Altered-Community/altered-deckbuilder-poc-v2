import SiteFooter from './SiteFooter';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
