'use client';

import { QueryClient, QueryClientProvider, HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { useState, Suspense } from 'react';
import { ThemeProvider } from 'next-themes';
import { SessionProvider } from 'next-auth/react';
import ThemeFromUrl from '@/components/ThemeFromUrl';

export default function Providers({
  children,
  dehydratedState,
}: {
  children: React.ReactNode;
  dehydratedState?: DehydratedState;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
        <Suspense>
          <ThemeFromUrl />
        </Suspense>
        <QueryClientProvider client={queryClient}>
          <HydrationBoundary state={dehydratedState}>
            {children}
          </HydrationBoundary>
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
