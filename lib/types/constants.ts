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

export const MIN_DECK_SIZE = 39;
