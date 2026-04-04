import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { fetchSets, fetchCardGroups } from '@/lib/api/cardApi';
import HeroSelector from '@/components/hero/HeroSelector';

const BASE_HERO_FILTERS = {
  cardType: 'HERO',
  'order[set.date]': 'desc' as const,
};

export default async function HomePage() {
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['sets'],
      queryFn: fetchSets,
    }),
    queryClient.prefetchQuery({
      queryKey: ['heroes', BASE_HERO_FILTERS, 1],
      queryFn: () => fetchCardGroups({ ...BASE_HERO_FILTERS, page: 1 }),
    }),
    queryClient.prefetchQuery({
      queryKey: ['heroes', BASE_HERO_FILTERS, 2],
      queryFn: () => fetchCardGroups({ ...BASE_HERO_FILTERS, page: 2 }),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HeroSelector />
    </HydrationBoundary>
  );
}
