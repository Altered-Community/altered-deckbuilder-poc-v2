import SiteFooter from './SiteFooter';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
