export interface ApiCollectionEntry {
  id: number;
  cardReference: string;
  quantity: number;
  isFoil: boolean;
  cardSet: string;
  faction: string;
  rarity: string;
  name: string | null;
  cardType?: string | null;
}

export interface CollectionImportRow {
  cardReference: string;
  cardName: string;
  rarity: string;
  quantity: number;
}

export interface BatchAddResult {
  created: ApiCollectionEntry[];
  skipped: string[];
}

export interface CollectionValidationResult {
  valid: CollectionImportRow[];
  errors: { line: number; raw: string; reason: string }[];
  totalCards: number;
  uniqueCount: number;
}
