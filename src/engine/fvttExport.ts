import { CharacterState } from '../types/characterState';
import { computeAbilityScores } from './ability';
import { computeCombatStats } from './combat';
import { computeProficiencies } from './proficiency';
import { getBackgroundDefinition, getClassDefinition, getFeatDefinition, getSpellDefinition, getSubclassDefinition, getSpeciesDefinition, resolveDisplayName } from './characterData';
import { computeSpellcasting } from './spellcasting';

export function exportToFVTT(character: CharacterState): string {
  const { scores } = computeAbilityScores(character);
  const combat = computeCombatStats(character);
  const profs = computeProficiencies(character);
  const spellcasting = computeSpellcasting(character);
  const primaryClass = character.classes?.[0] ? getClassDefinition(character.classes[0].classId) : undefined;
  const subclass = getSubclassDefinition(character);
  const background = getBackgroundDefinition(character);
  const species = getSpeciesDefinition(character);

  const formatAbility = (score: number, saveProf: boolean) => ({
    value: score,
    proficient: saveProf ? 1 : 0,
    max: null,
    bonuses: { check: "", save: "" },
    check: { roll: { min: null, max: null, mode: 0 } },
    save: { roll: { min: null, max: null, mode: 0 } }
  });

  const skillMapping: Record<string, string> = {
    acrobatics: 'acr', animalHandling: 'ani', arcana: 'arc', athletics: 'ath',
    deception: 'dec', history: 'his', insight: 'ins', intimidation: 'itm',
    investigation: 'inv', medicine: 'med', nature: 'nat', perception: 'prc',
    performance: 'prf', persuasion: 'per', religion: 'rel', sleightOfHand: 'slt',
    stealth: 'ste', survival: 'sur'
  };

  const fvttSkills: any = {};
  Object.entries(skillMapping).forEach(([id, fvttId]) => {
    const isProf = profs.skills.some(s => s.id === id);
    const isExp = character.expertiseSkills?.includes(id);
    fvttSkills[fvttId] = {
      value: isExp ? 2 : isProf ? 1 : 0,
      ability: '', // Let FVTT handle default ability
      bonuses: { check: "", passive: "" }
    };
  });

  const itemEntries = [
    ...(character.inventoryEntries ?? []).map((entry) => ({
      name: entry.name,
      type: entry.category === 'package' ? 'loot' : entry.category ?? 'loot',
      system: {
        quantity: entry.quantity ?? 1,
        equipped: entry.equipped ?? false,
        description: { value: entry.notes ?? '' },
      },
    })),
    ...(character.preparedSpellIds ?? []).map((spellId) => {
      const spell = getSpellDefinition(spellId);
      return spell
        ? {
            name: spell.name,
            type: 'spell',
            system: {
              level: spell.level,
              school: spell.school,
              activation: { type: spell.castingTime },
              description: { value: spell.description },
            },
          }
        : null;
    }).filter(Boolean),
    ...(character.selectedFeats ?? []).map((entry) => {
      const feat = getFeatDefinition(entry.featId);
      return feat
        ? {
            name: feat.name,
            type: 'feat',
            system: { description: { value: feat.description } },
          }
        : null;
    }).filter(Boolean),
  ];

  const fvttData = {
    name: character.name || '未命名',
    type: 'character',
    system: {
      currency: character.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      abilities: {
        str: formatAbility(scores.str, profs.saves.some(s => s.id === 'str')),
        dex: formatAbility(scores.dex, profs.saves.some(s => s.id === 'dex')),
        con: formatAbility(scores.con, profs.saves.some(s => s.id === 'con')),
        int: formatAbility(scores.int, profs.saves.some(s => s.id === 'int')),
        wis: formatAbility(scores.wis, profs.saves.some(s => s.id === 'wis')),
        cha: formatAbility(scores.cha, profs.saves.some(s => s.id === 'cha')),
      },
      skills: fvttSkills,
      attributes: {
        hp: {
          value: combat.hp.current,
          max: combat.hp.max,
          temp: combat.hp.temp || 0,
          tempmax: 0
        },
        ac: {
          flat: combat.ac,
          calc: 'flat',
          formula: ''
        },
        movement: {
          walk: combat.speed,
          units: 'ft'
        },
        init: {
          ability: 'dex',
          bonus: ''
        },
        exhaustion: character.exhaustion ?? 0,
        inspiration: character.inspiration ?? false,
        death: {
          success: character.deathSaves?.success ?? 0,
          failure: character.deathSaves?.failure ?? 0
        }
      },
      details: {
        alignment: character.alignment || '',
        race: character.speciesId || '',
        background: character.backgroundId || '',
        level: character.classes?.reduce((acc, c) => acc + c.level, 0) || 1,
        xp: { value: 0 },
        biography: {
          value: character.backstory || '',
          public: '',
        },
        ideal: character.ideals || '',
        bond: character.bonds || '',
        flaw: character.flaws || '',
        appearance: character.appearance || '',
        faith: character.faith || '',
        eyes: character.eyes || character.eyeColor || '',
        hair: character.hair || character.hairColor || '',
        skin: character.skin || character.skinColor || '',
        height: character.height || '',
        weight: character.weight || '',
        gender: character.gender || '',
        age: character.age || ''
      },
      traits: {
        size: character.size === 'Small' ? 'sm' : 'med',
        languages: {
          value: character.selectedLanguages || [],
          custom: ''
        },
        armorProf: {
          value: profs.armor.map(a => {
            if (a.id === 'light armor') return 'lgt';
            if (a.id === 'medium armor') return 'med';
            if (a.id === 'heavy armor') return 'hvy';
            if (a.id === 'shields' || a.id === 'shield') return 'shl';
            return a.id;
          }),
          custom: ''
        },
        weaponProf: {
          value: profs.weapons.map(w => {
            if (w.id === 'simple weapons') return 'sim';
            if (w.id === 'martial weapons') return 'mar';
            return w.id;
          }),
          custom: ''
        }
      },
      spells: {
        spell1: { value: (spellcasting.spellSlots[1] ?? 0) - (character.spellSlotUsage?.[1] ?? 0), override: spellcasting.spellSlots[1] ?? 0 },
        spell2: { value: (spellcasting.spellSlots[2] ?? 0) - (character.spellSlotUsage?.[2] ?? 0), override: spellcasting.spellSlots[2] ?? 0 },
        spell3: { value: (spellcasting.spellSlots[3] ?? 0) - (character.spellSlotUsage?.[3] ?? 0), override: spellcasting.spellSlots[3] ?? 0 },
        spell4: { value: (spellcasting.spellSlots[4] ?? 0) - (character.spellSlotUsage?.[4] ?? 0), override: spellcasting.spellSlots[4] ?? 0 },
        spell5: { value: (spellcasting.spellSlots[5] ?? 0) - (character.spellSlotUsage?.[5] ?? 0), override: spellcasting.spellSlots[5] ?? 0 },
        spell6: { value: (spellcasting.spellSlots[6] ?? 0) - (character.spellSlotUsage?.[6] ?? 0), override: spellcasting.spellSlots[6] ?? 0 },
        spell7: { value: (spellcasting.spellSlots[7] ?? 0) - (character.spellSlotUsage?.[7] ?? 0), override: spellcasting.spellSlots[7] ?? 0 },
        spell8: { value: (spellcasting.spellSlots[8] ?? 0) - (character.spellSlotUsage?.[8] ?? 0), override: spellcasting.spellSlots[8] ?? 0 },
        spell9: { value: (spellcasting.spellSlots[9] ?? 0) - (character.spellSlotUsage?.[9] ?? 0), override: spellcasting.spellSlots[9] ?? 0 },
      }
    },
    flags: {
      codex: {
        class: resolveDisplayName(primaryClass),
        subclass: resolveDisplayName(subclass),
        species: resolveDisplayName(species),
        background: resolveDisplayName(background),
      },
    },
    items: itemEntries,
    effects: []
  };

  return JSON.stringify(fvttData, null, 2);
}
