import type { Feat } from '@/types/feat';
import type { Spell } from '@/types/spell';
import { translateClass } from './terminology';

type SpellRequirement = NonNullable<NonNullable<Feat['mechanics']>['spells']>[number];

const classes = new Set([
  'cleric',
  'druid',
  'wizard',
  'paladin',
  'ranger',
  'bard',
  'sorcerer',
  'warlock',
]);
const schools = new Set([
  'divination',
  'enchantment',
  'illusion',
  'necromancy',
  'evocation',
  'abjuration',
  'transmutation',
  'conjuration',
  'ritual',
]);

/** 专长页已有候选语义；只筛选调用方提供的启用目录，不授予法术。 */
export function getFeatSpellCandidates(
  requirement: SpellRequirement,
  selectedList: string,
  spells: Spell[],
): Spell[] {
  const lists = requirement.listOptions;
  const fixed =
    lists?.length === 1 &&
    !lists[0].includes(',') &&
    !classes.has(lists[0].toLowerCase()) &&
    !schools.has(lists[0].toLowerCase());
  return spells.filter((spell) => {
    if (spell.level !== requirement.level) return false;
    if (fixed) {
      const target = lists[0].toLowerCase();
      return spell.id.toLowerCase() === target || spell.nameEn.toLowerCase() === target;
    }
    const ritual = spell.ritual || spell.castingTime.includes('仪式');
    const matches =
      selectedList === 'Any' ||
      selectedList.split(',').some((value) => {
        const list = value.trim().toLowerCase();
        return (
          spell.classes.includes(translateClass(list)) ||
          spell.school.toLowerCase() === list ||
          (list === 'ritual' && ritual)
        );
      });
    return Boolean(matches && (!requirement.ritualOnly || ritual));
  });
}

/** 保留原按环阶名额与最早项替换顺序，不修改其他环阶或原数组。 */
export function toggleFeatSpellChoice(
  selected: string[],
  spellId: string,
  requirement: SpellRequirement,
  spells: Spell[],
): string[] {
  if (selected.includes(spellId)) return selected.filter((id) => id !== spellId);
  const sameLevel = selected.filter(
    (id) => spells.find((spell) => spell.id === id)?.level === requirement.level,
  );
  if (sameLevel.length < requirement.count) return [...selected, spellId];
  const others = selected.filter((id) => !sameLevel.includes(id));
  return [...others, ...sameLevel.slice(1), spellId];
}
