import DeckBuilderView from '@/components/deck/DeckBuilderView';

interface Props {
  searchParams: Promise<{ faction?: string }>;
}

export default async function DeckPage({ searchParams }: Props) {
  const { faction } = await searchParams;

  return <DeckBuilderView initialFaction={faction} />;
}
