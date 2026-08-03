export type BreedBadge =
  | { kind: 'solid'; color: string; borderColor?: string }
  | { kind: 'split'; leftColor: string; rightColor: string; borderColor?: string };

export type BreedOption = {
  label: string;
  value: string;
  badge: BreedBadge;
};

export const LIVESTOCK_CATEGORY_OPTIONS = [
  { label: 'Poultry (Meat)', value: 'POULTRY_BROILER' },
  { label: 'Poultry (Eggs)', value: 'POULTRY_LAYER' },
  { label: 'Cattle / Livestock', value: 'CATTLE' },
  { label: 'Sheep / Goat', value: 'SHEEP_GOAT' },
  { label: 'Pig / Swine', value: 'PIG' },
  { label: 'Other / Generic', value: 'OTHER' },
] as const;

export const BREED_OPTIONS_BY_CATEGORY: Record<string, BreedOption[]> = {
  POULTRY_BROILER: [
    {
      label: 'White Broiler (Cobb 500 / Ross 308)',
      value: 'ross_308',
      badge: { kind: 'solid', color: '#FDFBF7', borderColor: '#B8B8B8' },
    },
  ],
  POULTRY_LAYER: [
    {
      label: 'Brown Layer (ISA Brown / Lohmann)',
      value: 'isa_brown',
      badge: { kind: 'solid', color: '#B3541E' },
    },
    {
      label: 'Black Layer (Bovans Black)',
      value: 'bovans_black',
      badge: { kind: 'solid', color: '#222222' },
    },
  ],
  CATTLE: [
    {
      label: 'Local Zebu / Sanga / White Fulani',
      value: 'local_zebu_sanga_white_fulani',
      badge: { kind: 'solid', color: '#D2B48C' },
    },
    {
      label: 'Ndama / Brown Crosses',
      value: 'ndama_brown_crosses',
      badge: { kind: 'solid', color: '#5C2C16' },
    },
  ],
  SHEEP_GOAT: [
    {
      label: 'West African Dwarf (Local)',
      value: 'west_african_dwarf',
      badge: { kind: 'split', leftColor: '#FDFBF7', rightColor: '#111111', borderColor: '#C29160' },
    },
    {
      label: 'Sahelian / Northern Cross',
      value: 'sahelian_northern_cross',
      badge: { kind: 'solid', color: '#FDFBF7', borderColor: '#D2B48C' },
    },
  ],
  PIG: [
    {
      label: 'Large White / Landrace',
      value: 'large_white',
      badge: { kind: 'solid', color: '#F6C3C3' },
    },
    {
      label: 'Ashanti Black / Local Cross',
      value: 'ashanti_black_local_cross',
      badge: { kind: 'solid', color: '#111111' },
    },
  ],
  OTHER: [],
};

export function getBreedOptionsForCategory(category: string | null | undefined) {
  return BREED_OPTIONS_BY_CATEGORY[category || ''] ?? [];
}

export function getBreedOptionByValue(value: string | null | undefined) {
  if (!value) return null;
  const normalizedValue = normalizeBreedValue(value);
  for (const options of Object.values(BREED_OPTIONS_BY_CATEGORY)) {
    const match = options.find((option) => option.value === normalizedValue);
    if (match) return match;
  }
  return null;
}

export function getBreedDisplayName(value: string | null | undefined) {
  return getBreedOptionByValue(value)?.label ?? value ?? '';
}

export function normalizeBreedValue(value: string | null | undefined) {
  if (!value) return '';

  const normalized = value.trim().toLowerCase().replace(/[\s/-]+/g, '_');
  const legacyAliases: Record<string, string> = {
    broiler: 'ross_308',
    ross_308: 'ross_308',
    cobb_500: 'ross_308',
    hubbard: 'ross_308',
    layer: 'isa_brown',
    isa_brown: 'isa_brown',
    isa: 'isa_brown',
    lohmann: 'isa_brown',
    bovans_black: 'bovans_black',
    leghorn: 'isa_brown',
    large_white: 'large_white',
    landrace: 'large_white',
  };

  return legacyAliases[normalized] ?? normalized;
}
