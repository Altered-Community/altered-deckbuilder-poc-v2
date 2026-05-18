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
  LY: 'bg-pink-500',
  MU: 'bg-green-600',
  OR: 'bg-blue-500',
  YZ: 'bg-violet-600',
};

export const FACTION_GRADIENT_RGB: Record<string, string> = {
  BR: '153,27,27',
  LY: '157,23,77',
  MU: '20,83,45',
  OR: '59,130,246',
  YZ: '76,29,149',
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
