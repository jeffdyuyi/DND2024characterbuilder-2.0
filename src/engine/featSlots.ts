import type { CharacterState } from '@/types/characterState';
import type { Background } from '@/types/background';
import type { Species } from '@/types/species';
import type { ClassData } from '@/types/class';
import type { Feat } from '@/types/feat';

export interface CharacterFeatSlot {
  id: string;
  level?: number;
  /** 仅职业槽位提供，沿用角色保存的职业键；不是新增的存档字段。 */
  classId?: string;
  name: string;
  allowedCategories: Feat['category'][];
  grantingSource: string;
  currentFeatId?: string;
}

export interface FeatSlotDefinitions {
  background?: Pick<Background, 'name'> | null;
  species?: Pick<Species, 'name' | 'traits'> | null;
  getClass: (id: string) => Pick<ClassData, 'name' | 'features'> | undefined;
}

/** 复用专长页已有槽位与兼容读取规则，不写入记录或选择专长。 */
export function buildCharacterFeatSlots(
  character: CharacterState,
  definitions: FeatSlotDefinitions,
): CharacterFeatSlot[] {
  const { background, species } = definitions;
  const slots: CharacterFeatSlot[] = [];
  // 1. Background Feat (Origin)
  if (background) {
    const slotId = 'background-feat';
    slots.push({
      id: slotId,
      level: 1,
      name: '背景专长 (Origin Feat)',
      allowedCategories: ['Origin'],
      grantingSource: `背景: ${background.name}`,
      currentFeatId: character.featSelections?.[slotId]?.featId || character.originFeatId,
    });
  }

  // 2. Species-granted slots
  if (species) {
    species.traits.forEach((trait) => {
      const originFeatData = trait.features?.originFeats;
      const isLegacyFeat =
        trait.id === 'bonus-feat' ||
        trait.id === 'feat' ||
        trait.name === '额外专长' ||
        trait.name === '专长';
      const isVersatile =
        trait.id === 'versatile' ||
        trait.id === 'origin-feat' ||
        trait.name === '多用' ||
        trait.name === '多才多艺';

      if (originFeatData || isLegacyFeat || isVersatile) {
        const isOriginOnly = originFeatData ? originFeatData.filter === 'type:origin' : isVersatile;
        const slotId = `species-${trait.id || 'feat'}`;

        const traitKey = trait.id || trait.name || 'feat';
        const savedSelections =
          character.speciesSelections?.[slotId] ||
          (trait.id ? character.speciesSelections?.[trait.id] : undefined) ||
          (trait.name ? character.speciesSelections?.[trait.name] : undefined) ||
          (character.speciesId
            ? character.speciesSelections?.[`sp:${character.speciesId}:trait:${traitKey}`]
            : undefined) ||
          [];
        const savedFeat = savedSelections[0];

        slots.push({
          id: slotId,
          level: 1,
          name: isOriginOnly ? '种族加成专长 (Origin Feat)' : '种族加成专长 (Bonus Feat)',
          allowedCategories: isOriginOnly
            ? ['Origin']
            : ['Origin', 'General', 'Fighting Style', 'Legacy', 'Epic Boon'],
          grantingSource: `种族: ${species.name} (${trait.name})`,
          currentFeatId: character.featSelections?.[slotId]?.featId || savedFeat,
        });
      }
    });
  }

  // 3. Class Progression & Feature-granted slots
  character.classes.forEach((c) => {
    const classDef = definitions.getClass(c.classId);
    if (!classDef) return;

    classDef.features
      .filter((f: any) => f.level <= c.level)
      .forEach((f: any) => {
        if (f.mechanics?.choices) {
          f.mechanics.choices
            .filter((choice: any) => choice.type === 'feat')
            .forEach((choice: any) => {
              const slotId = `cls:${c.classId}:feat:${f.name}:${choice.id}`;
              let allowed: ('Origin' | 'General' | 'Fighting Style' | 'Epic Boon' | 'Legacy')[] = [
                'General',
                'Legacy',
              ];
              if (choice.options?.includes('Fighting Style')) allowed = ['Fighting Style'];
              else if (choice.options?.includes('Epic Boon')) allowed = ['Epic Boon'];
              else if (choice.options?.includes('Origin Feat')) allowed = ['Origin'];

              slots.push({
                id: slotId,
                level: f.level,
                classId: c.classId,
                name: `${f.name} (${choice.name || '专长选择'})`,
                allowedCategories: allowed,
                grantingSource: `职业: ${classDef.name} (等级 ${f.level})`,
                currentFeatId:
                  character.featSelections?.[slotId]?.featId ||
                  character.classSelections?.[slotId]?.[0],
              });
            });
        }
      });
  });

  return slots;
}
