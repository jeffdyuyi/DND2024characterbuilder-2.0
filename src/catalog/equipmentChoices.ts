import { defaultCatalog } from './catalog';
import type { EquipmentRecord } from '@/types/class';
import type { CharacterState } from '@/types/characterState';
import { createSourcePredicate, getCharacterSourcePolicy } from './sourcePolicy';

/** 5etools装备类别机器键对应原生物品字段，不枚举职业或物品名称。 */
export function equipmentTypeLabel(type: string): string {
  const weapon = type.match(/^weapon(Simple|Martial)?(Melee|Ranged)?$/);
  if (weapon)
    return (
      '自选' +
      ({ Simple: '简易', Martial: '军用' }[weapon[1] || ''] || '') +
      ({ Melee: '近战', Ranged: '远程' }[weapon[2] || ''] || '') +
      '武器'
    );
  const focus = type.match(/^focusSpellcasting(Arcane|Druidic|Holy)$/);
  if (focus)
    return (
      '自选' + ({ Arcane: '奥术法器', Druidic: '德鲁伊法器', Holy: '圣徽' }[focus[1]] || '施法法器')
    );
  return (
    (
      {
        toolArtisan: '工匠工具自选',
        instrumentMusical: '乐器自选',
        setGaming: '赌具自选',
      } as Record<string, string>
    )[type] || '自选装备'
  );
}

export function getEquipmentChoiceCandidates(record: EquipmentRecord, character?: CharacterState) {
  if (record.equipmentFilterUnresolved) return [];
  const type = record.equipmentType || '';
  const weapon = type.match(/^weapon(Simple|Martial)?(Melee|Ranged)?$/);
  const focus = type.match(/^focusSpellcasting(Arcane|Druidic|Holy)$/);
  const tool = (
    { toolArtisan: 'AT', instrumentMusical: 'INS', setGaming: 'GS' } as Record<string, string>
  )[type];
  const allows = createSourcePredicate(character ? getCharacterSourcePolicy(character) : undefined);
  return (['item', 'baseitem'] as const)
    .flatMap((kind) => defaultCatalog.list(kind))
    .filter((entry) => {
      if (
        !allows(entry) ||
        (record.equipmentSource &&
          entry.source.toLowerCase() !== record.equipmentSource.toLowerCase())
      )
        return false;
      const raw = entry.raw;
      if ((raw.rarity && raw.rarity !== 'none') || raw.reqAttune || raw.bonusWeapon || raw.bonusAc)
        return false;
      const itemType = String(raw.type || '').split('|')[0];
      if (weapon) {
        return (
          ['M', 'R'].includes(itemType) &&
          (!weapon[1] || String(raw.weaponCategory).toLowerCase() === weapon[1].toLowerCase()) &&
          (!weapon[2] || itemType === (weapon[2] === 'Melee' ? 'M' : 'R'))
        );
      }
      if (focus)
        return (
          itemType === 'SCF' &&
          String(raw.scfType).toLowerCase() ===
            ({ Arcane: 'arcane', Druidic: 'druid', Holy: 'holy' } as Record<string, string>)[
              focus[1]
            ]
        );
      return Boolean(tool) && itemType === tool;
    });
}
