import type { Background } from '@/types/background';

export type CharacteristicField = 'personalityTraits' | 'ideals' | 'bonds' | 'flaws';

const HEADINGS: Record<CharacteristicField, RegExp> = {
  personalityTraits: /特点|人格特质|性格特质|个性特征|personality traits?/i,
  ideals: /理念|理想|ideals?/i,
  bonds: /牵挂|羁绊|牵绊|bonds?/i,
  flaws: /缺陷|缺点|flaws?/i,
};

export function rollBackgroundCharacteristic(
  background: Background | undefined,
  field: CharacteristicField,
  random = Math.random,
): string | undefined {
  const table = background?.flavorTables?.find((entry) => HEADINGS[field].test(entry.name));
  if (table?.rows.length) {
    const faces = Number(table.dice) || table.rows.length;
    const roll = Math.floor(random() * faces) + 1;
    return table.rows.find((row) => row.id === roll)?.content;
  }
  const options = background?.suggestedCharacteristics?.[field] || [];
  if (!options.length) return undefined;
  const picked = options[Math.floor(random() * options.length)];
  return typeof picked === 'string' ? picked : picked.text;
}
