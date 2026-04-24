export const FACTIONS: Record<string, string> = {
  AX: 'Axiom',
  BR: 'Bravos',
  LY: 'Lyra',
  MU: 'Muna',
  OR: 'Ordis',
  YZ: 'Yzmir',
};

export const FACTION_BADGE_COLORS: Record<string, string> = {
  AX: 'bg-blue-600',
  BR: 'bg-red-600',
  LY: 'bg-yellow-500',
  MU: 'bg-green-600',
  OR: 'bg-purple-600',
  YZ: 'bg-cyan-600',
};

export const RARITIES = [
  { value: 'COMMON', label: 'Commun' },
  { value: 'RARE', label: 'Rare' },
  { value: 'UNIQUE', label: 'Unique' },
  { value: 'EXALTED', label: 'Exalté' },
];

export const CARD_TYPES = [
  { value: 'HERO', label: 'Héros' },
  { value: 'CHARACTER', label: 'Personnage' },
  { value: 'SPELL', label: 'Sort' },
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'LANDMARK_PERMANENT', label: 'Haut lieu' },
  { value: 'TOKEN', label: 'Token' },
];

export const CARD_TYPE_LABELS: Record<string, string> = {
  HERO: 'Héros',
  CHARACTER: 'Personnages',
  SPELL: 'Sorts',
  PERMANENT: 'Permanents',
  LANDMARK_PERMANENT: 'Hauts lieux',
  EXPEDITION_PERMANENT: 'Expéditions',
  TOKEN: 'Tokens',
  TOKEN_MANA: 'Tokens mana',
  OTHER: 'Autres',
};

export const MIN_DECK_SIZE = 39;
