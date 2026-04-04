import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Altered Deck Builder',
  description: 'Créez et gérez vos decks Altered',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-c-bg text-c-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
