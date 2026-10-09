import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { defaultCatalog } from '../catalog';
import { getCatalogSpecies } from '../adapters/species';
import { normalizeRace, normalizeSubrace } from '@/source/fiveetools-cn/normalizers/race';
import type { Trait, SubSpecies } from '@/types/species';

const FLAVOR_TRAIT_NAMES = new Set([
  '年龄',
  '阵营',
  '体型',
  '速度',
  '语言',
  'age',
  'alignment',
  'size',
  'speed',
  'languages',
]);

function isFlavorTrait(trait: Trait): boolean {
  const name = trait.name?.trim().toLowerCase();
  const nameEn = trait.nameEn?.trim().toLowerCase();
  return (
    FLAVOR_TRAIT_NAMES.has(name) ||
    (nameEn ? FLAVOR_TRAIT_NAMES.has(nameEn) : false) ||
    name === '阵营' ||
    name === '年龄' ||
    name === '体型' ||
    name === '速度'
  );
}

function resolveEffectiveTraits(baseTraits: Trait[], subspecies?: SubSpecies): Trait[] {
  const filteredBase = (baseTraits || []).filter((t) => {
    if (isFlavorTrait(t)) {
      const hasOptions = (t.options?.length ?? 0) > 0;
      const hasSpells = (t.features?.spells?.length ?? 0) > 0;
      const hasResist = (t.features?.resistances?.length ?? 0) > 0;
      return hasOptions || hasSpells || hasResist;
    }
    return true;
  });

  if (!subspecies) return filteredBase;

  const rawSubTraits: Trait[] = subspecies.traits ? [...subspecies.traits] : [];
  if (rawSubTraits.length === 0 && (subspecies.description || subspecies.features)) {
    rawSubTraits.push({
      id: `subspecies-${subspecies.id}`,
      name: subspecies.name,
      nameEn: subspecies.nameEn,
      description: subspecies.description || '',
      features: subspecies.features,
    });
  } else if (subspecies.features && rawSubTraits.length > 0) {
    // 严格检查：如果子特质列表中已包含法术，绝不二次挂载
    const hasSpellsInTraits = rawSubTraits.some(
      (t) => t.features?.spells && t.features.spells.length > 0,
    );
    if (subspecies.features.spells && !hasSpellsInTraits) {
      const baseDuplicateTrait = filteredBase.find((bt) => {
        if (isFlavorTrait(bt) || !bt.features?.spells) return false;
        const existing = new Set(
          (bt.features.spells as any[]).map(
            (s) => (s as any).spellName || (s as any).name || (s as any).id,
          ),
        );
        return (subspecies.features!.spells as any[]).some((s) =>
          existing.has((s as any).spellName || (s as any).name || (s as any).id),
        );
      });

      if (baseDuplicateTrait) {
        baseDuplicateTrait.features = {
          ...baseDuplicateTrait.features,
          spells: subspecies.features.spells,
        };
      } else {
        const spellHostTrait =
          rawSubTraits.find((t) => {
            if (isFlavorTrait(t)) return false;
            const text = `${t.name} ${t.nameEn || ''} ${t.description || ''}`.toLowerCase();
            return /(法术|戏法|灵能|施法|spells?|cantrip|psionics?|magic)/i.test(text);
          }) || rawSubTraits.find((t) => !isFlavorTrait(t));

        if (spellHostTrait) {
          spellHostTrait.features = {
            ...spellHostTrait.features,
            spells: subspecies.features.spells,
          };
        } else {
          rawSubTraits.push({
            id: `subspecies-spells-${subspecies.id}`,
            name: '种族法术',
            nameEn: 'Innate Spells',
            description: '你获得此亚种提供的额外法术。',
            features: { spells: subspecies.features.spells },
          });
        }
      }
    }

    const hasResistInTraits = rawSubTraits.some(
      (t) => t.features?.resistances && t.features.resistances.length > 0,
    );
    if (subspecies.features.resistances && !hasResistInTraits) {
      const resistHostTrait =
        rawSubTraits.find((t) => {
          if (isFlavorTrait(t)) return false;
          const text = `${t.name} ${t.nameEn || ''} ${t.description || ''}`.toLowerCase();
          return /(抗性|耐性|resistance)/i.test(text);
        }) || rawSubTraits.find((t) => !isFlavorTrait(t));
      if (resistHostTrait) {
        resistHostTrait.features = {
          ...resistHostTrait.features,
          resistances: subspecies.features.resistances,
        };
      }
    }
  }

  const filteredSub = rawSubTraits.filter((st) => {
    if (isFlavorTrait(st)) {
      const hasOptions = (st.options?.length ?? 0) > 0;
      const hasSpells = (st.features?.spells?.length ?? 0) > 0;
      const hasResist = (st.features?.resistances?.length ?? 0) > 0;
      return hasOptions || hasSpells || hasResist;
    }
    return true;
  });

  const finalBaseTraits = [...filteredBase];
  const normKey = (t: Trait) =>
    (t.id || t.nameEn || t.name || '').toLowerCase().replace(/[-_\s]+/g, '');
  const unmergedSubTraits: Trait[] = [];
  filteredSub.forEach((st) => {
    const stKey = normKey(st);
    const overwriteName = st.overwrite?.trim().toLowerCase();
    let matchIdx = finalBaseTraits.findIndex((bt) => {
      const btKey = normKey(bt);
      const nameMatches =
        btKey === stKey ||
        (bt.name && st.name && bt.name.toLowerCase() === st.name.toLowerCase()) ||
        (bt.nameEn && st.nameEn && bt.nameEn.toLowerCase() === st.nameEn.toLowerCase());
      const overwriteMatches = overwriteName
        ? (bt.name && bt.name.toLowerCase() === overwriteName) ||
          (bt.nameEn && bt.nameEn.toLowerCase() === overwriteName)
        : false;
      return nameMatches || overwriteMatches;
    });

    if (matchIdx < 0 && st.features?.spells && st.features.spells.length > 0) {
      matchIdx = finalBaseTraits.findIndex((bt) => {
        if (isFlavorTrait(bt) || !bt.features?.spells || bt.features.spells.length === 0)
          return false;
        const existing = new Set(
          (bt.features.spells as any[]).map(
            (s) => (s as any).spellName || (s as any).name || (s as any).id,
          ),
        );
        return (st.features!.spells as any[]).some((s) =>
          existing.has((s as any).spellName || (s as any).name || (s as any).id),
        );
      });
    }

    if (matchIdx >= 0) {
      if (
        (st.id === 'innate-spells' || st.name === '种族法术') &&
        finalBaseTraits[matchIdx].name !== '种族法术'
      ) {
        finalBaseTraits[matchIdx] = {
          ...finalBaseTraits[matchIdx],
          features: {
            ...(finalBaseTraits[matchIdx].features || {}),
            spells: st.features?.spells || finalBaseTraits[matchIdx].features?.spells,
          },
        };
      } else {
        finalBaseTraits[matchIdx] = st;
      }
    } else {
      unmergedSubTraits.push(st);
    }
  });

  return [...finalBaseTraits, ...unmergedSubTraits];
}

describe('全量种族与亚种特质装配完整性普查 (Species & Subspecies Trait Integrity)', () => {
  beforeAll(() => {
    const rawRacesPath = path.resolve(process.cwd(), 'tests/fixtures/races.json');
    if (fs.existsSync(rawRacesPath)) {
      const fileData = JSON.parse(fs.readFileSync(rawRacesPath, 'utf8'));
      for (const r of fileData.race || []) {
        defaultCatalog.register(normalizeRace(r, '5etools-cn'));
      }
      for (const s of fileData.subrace || []) {
        defaultCatalog.register(normalizeSubrace(s, '5etools-cn'));
      }
    }
  });

  it('全量种族基础特质：绝无风味条目（阵营/年龄/体型等）被污染挂载法术或抗性', () => {
    const allSpecies = getCatalogSpecies();
    expect(allSpecies.length).toBeGreaterThan(50);

    const violations: Array<{ species: string; trait: string; issue: string }> = [];

    for (const sp of allSpecies) {
      const traits = resolveEffectiveTraits(sp.traits);
      for (const t of traits) {
        if (isFlavorTrait(t)) {
          if (t.features?.spells && t.features.spells.length > 0) {
            violations.push({ species: sp.name, trait: t.name, issue: '挂载了法术' });
          }
          if (t.features?.resistances && t.features.resistances.length > 0) {
            violations.push({ species: sp.name, trait: t.name, issue: '挂载了抗性' });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('全量种族+亚种所有组合：绝无风味条目被污染挂载法术或抗性', () => {
    const allSpecies = getCatalogSpecies();
    const violations: Array<{ species: string; sub: string; trait: string; issue: string }> = [];
    let combinationsChecked = 0;
    let totalSubs = 0;

    for (const sp of allSpecies) {
      const subs = sp.subSpecies?.options || [];
      totalSubs += subs.length;
      if (subs.length === 0) {
        combinationsChecked++;
        continue;
      }

      for (const sub of subs) {
        combinationsChecked++;
        const traits = resolveEffectiveTraits(sp.traits, sub);
        for (const t of traits) {
          if (isFlavorTrait(t)) {
            if (t.features?.spells && t.features.spells.length > 0) {
              violations.push({
                species: sp.name,
                sub: sub.name,
                trait: t.name,
                issue: '风味条目被挂载了法术',
              });
            }
            if (t.features?.resistances && t.features.resistances.length > 0) {
              violations.push({
                species: sp.name,
                sub: sub.name,
                trait: t.name,
                issue: '风味条目被挂载了抗性',
              });
            }
          }
        }
      }
    }

    console.log(
      `[普查统计] 已验证组合总数: ${combinationsChecked}（包含 ${allSpecies.length} 基础种族, ${totalSubs} 亚种配置）`,
    );
    expect(violations).toEqual([]);
  });

  it('全量种族+亚种所有组合：任意生效特质间绝不出现相同法术的跨特质重复展示', () => {
    const allSpecies = getCatalogSpecies();
    const duplicateSpellViolations: Array<{
      species: string;
      sub?: string;
      spell: string;
      traits: string[];
    }> = [];

    for (const sp of allSpecies) {
      const subs = sp.subSpecies?.options || [];
      const testCases = subs.length > 0 ? subs : [undefined];

      for (const sub of testCases) {
        const traits = resolveEffectiveTraits(sp.traits, sub);
        const spellToTraitsMap = new Map<string, string[]>();

        for (const t of traits) {
          const spells = t.features?.spells || [];
          const traitSpellKeys = new Set<string>();
          for (const s of spells) {
            const spellKey =
              (s as any).spellName || (s as any).spellId || (s as any).name || (s as any).id;
            if (spellKey) traitSpellKeys.add(spellKey);
          }
          for (const key of traitSpellKeys) {
            if (!spellToTraitsMap.has(key)) {
              spellToTraitsMap.set(key, []);
            }
            spellToTraitsMap.get(key)!.push(t.name);
          }
        }

        for (const [spell, traitNames] of spellToTraitsMap.entries()) {
          if (traitNames.length > 1) {
            duplicateSpellViolations.push({
              species: sp.name,
              sub: sub?.name,
              spell,
              traits: traitNames,
            });
          }
        }
      }
    }

    if (duplicateSpellViolations.length > 0) {
      console.error('[重复法术检出]', duplicateSpellViolations);
    }
    expect(duplicateSpellViolations).toEqual([]);
  });

  it('全量种族亚种选项：绝无任何“未命名亚种”或 undefined 占位遗留', () => {
    const allSpecies = getCatalogSpecies();
    const unnamedViolations: Array<{ species: string; optName: string; optId: string }> = [];

    for (const sp of allSpecies) {
      const subs = sp.subSpecies?.options || [];
      for (const sub of subs) {
        if (
          sub.name.includes('未命名') ||
          sub.nameEn.includes('未命名') ||
          sub.name === 'undefined'
        ) {
          unnamedViolations.push({
            species: sp.name,
            optName: sub.name,
            optId: sub.id,
          });
        }
      }
    }

    if (unnamedViolations.length > 0) {
      console.error('[检出未命名亚种]', unnamedViolations);
    }
    expect(unnamedViolations).toEqual([]);
  });
});
