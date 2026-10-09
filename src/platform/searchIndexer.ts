import { getCatalogSpells, getCatalogClasses, getCatalogFeats, getCatalogBackgrounds, getCatalogSpecies, getCatalogItems } from '@/catalog';
import { useHomebrewStore } from '@/store/homebrewStore';

export interface SearchResultItem {
  id: string;
  name: string;
  nameEn: string;
  category: 'spell' | 'feat' | 'item' | 'species' | 'background' | 'monster' | 'class';
  categoryLabel: string;
  source: string;
  level?: number;
  type?: string;
  description: string;
  isHomebrew?: boolean;
  raw: any;
}

export type CategoryFilter = 'all' | 'spell' | 'feat' | 'item' | 'species' | 'background' | 'monster' | 'class';

export function searchAll(
  query: string,
  editionFilter: '5e' | '2024' | 'all' = 'all',
  categoryFilter: CategoryFilter = 'all'
): SearchResultItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  const results: SearchResultItem[] = [];

  const homebrewState = useHomebrewStore.getState();

  // 1. Spells (Catalog + Legacy Fallback + Homebrew)
  if (categoryFilter === 'all' || categoryFilter === 'spell') {
    const spellList = getCatalogSpells();
    spellList.forEach((spell: any) => {
      results.push({
        id: spell.id,
        name: spell.name,
        nameEn: spell.nameEn || '',
        category: 'spell',
        categoryLabel: '法术',
        source: spell.source || 'PHB2024',
        level: spell.level,
        type: spell.school ? `${spell.school}系` : '法术',
        description: spell.description || '',
        isHomebrew: false,
        raw: spell,
      });
    });

    homebrewState.spells.forEach((spell: any) => {
      if (spell.enabled === false) return;
      results.push({
        id: spell.id,
        name: spell.name,
        nameEn: spell.nameEn || '',
        category: 'spell',
        categoryLabel: '法术',
        source: spell.source || 'HOMEBREW',
        level: spell.level,
        type: spell.school ? `${spell.school}系` : '原创/第三方法术',
        description: spell.description || '',
        isHomebrew: true,
        raw: spell,
      });
    });
  }

  // 2. Feats (Catalog + Legacy Fallback + Homebrew)
  if (categoryFilter === 'all' || categoryFilter === 'feat') {
    const featList = getCatalogFeats();
    featList.forEach((feat: any) => {
      results.push({
        id: feat.id,
        name: feat.name,
        nameEn: feat.nameEn || '',
        category: 'feat',
        categoryLabel: '专长',
        source: feat.source || 'PHB2024',
        type: feat.category || '专长',
        description: feat.description || '',
        isHomebrew: false,
        raw: feat,
      });
    });

    homebrewState.feats.forEach((feat: any) => {
      if (feat.enabled === false) return;
      results.push({
        id: feat.id,
        name: feat.name,
        nameEn: feat.nameEn || '',
        category: 'feat',
        categoryLabel: '专长',
        source: feat.source || 'HOMEBREW',
        type: feat.category || '原创/第三方专长',
        description: feat.description || '',
        isHomebrew: true,
        raw: feat,
      });
    });
  }

  // 3. Species (Catalog 5etools + Legacy + Homebrew)
  if (categoryFilter === 'all' || categoryFilter === 'species') {
    const effectiveSpecies = getCatalogSpecies();

    effectiveSpecies.forEach((sp: any) => {
      results.push({
        id: sp.id,
        name: sp.name,
        nameEn: sp.nameEn || '',
        category: 'species',
        categoryLabel: '种族',
        source: sp.source || 'PHB2024',
        type: sp.creatureType || '类人',
        description: sp.description || '',
        isHomebrew: false,
        raw: sp,
      });
    });

    homebrewState.species.forEach((sp: any) => {
      if (sp.enabled === false) return;
      results.push({
        id: sp.id,
        name: sp.name,
        nameEn: sp.nameEn || '',
        category: 'species',
        categoryLabel: '种族',
        source: sp.source || 'HOMEBREW',
        type: sp.creatureType || '原创/第三方种族',
        description: sp.description || '',
        isHomebrew: true,
        raw: sp,
      });
    });
  }

  // 4. Backgrounds (Catalog 5etools + Legacy + Homebrew)
  if (categoryFilter === 'all' || categoryFilter === 'background') {
    const effectiveBackgrounds = getCatalogBackgrounds();

    effectiveBackgrounds.forEach((bg: any) => {
      results.push({
        id: bg.id,
        name: bg.name,
        nameEn: bg.nameEn || '',
        category: 'background',
        categoryLabel: '背景',
        source: bg.source || 'PHB2024',
        type: '背景',
        description: bg.description || '',
        isHomebrew: false,
        raw: bg,
      });
    });

    homebrewState.backgrounds.forEach((bg: any) => {
      if (bg.enabled === false) return;
      results.push({
        id: bg.id,
        name: bg.name,
        nameEn: bg.nameEn || '',
        category: 'background',
        categoryLabel: '背景',
        source: bg.source || 'HOMEBREW',
        type: '原创/第三方背景',
        description: bg.description || '',
        isHomebrew: true,
        raw: bg,
      });
    });
  }

  // 5. Classes (SRD + 2014 + Expansions + Homebrew)
  if (categoryFilter === 'all' || categoryFilter === 'class') {
    getCatalogClasses().forEach((cls: any) => {
      results.push({
        id: cls.id,
        name: cls.name,
        nameEn: cls.nameEn || '',
        category: 'class',
        categoryLabel: '职业',
        source: cls.source || 'PHB2024',
        type: `生命骰 d${cls.hitDice || 8}`,
        description: cls.description || `${cls.name}职业核心规则`,
        isHomebrew: false,
        raw: cls,
      });
    });

    if ((homebrewState as any).classes) {
      (homebrewState as any).classes.forEach((cls: any) => {
        if (cls.enabled === false) return;
        results.push({
          id: cls.id,
          name: cls.name,
          nameEn: cls.nameEn || '',
          category: 'class',
          categoryLabel: '职业',
          source: cls.source || 'HOMEBREW',
          type: `原创/第三方职业`,
          description: cls.description || '',
          isHomebrew: true,
          raw: cls,
        });
      });
    }
  }

  // 6. Items, Weapons, Armor, Tools (SRD + 2014 + Expansions + Homebrew)
  if (categoryFilter === 'all' || categoryFilter === 'item') {
    const catalogItems = getCatalogItems();
    catalogItems.forEach((it: any) => {
      results.push({
        id: it.id,
        name: it.name,
        nameEn: it.nameEn || '',
        category: 'item',
        categoryLabel: '装备与物品',
        source: it.source || '',
        type: it.category || it.weaponCategory || it.armorCategory || '物品',
        description: it.description || it.name,
        isHomebrew: Boolean(it.isHomebrew),
        raw: it,
      });
    });


    homebrewState.items.forEach((item: any) => {
      if (item.enabled === false) return;
      results.push({
        id: item.id,
        name: item.name,
        nameEn: item.nameEn || '',
        category: 'item',
        categoryLabel: '装备与物品',
        source: item.source || 'HOMEBREW',
        type: item.type || '原创/第三方装备',
        description: item.description || '',
        isHomebrew: true,
        raw: item,
      });
    });
  }

  // 7. Monsters (Homebrew + Extra)
  if (categoryFilter === 'all' || categoryFilter === 'monster') {
    homebrewState.monsters.forEach((mon: any) => {
      if (mon.enabled === false) return;
      results.push({
        id: mon.id,
        name: mon.name,
        nameEn: mon.nameEn || '',
        category: 'monster',
        categoryLabel: '怪物',
        source: mon.source || 'HOMEBREW',
        type: `CR ${mon.cr} · ${mon.type}`,
        description: mon.description || '',
        isHomebrew: true,
        raw: mon,
      });
    });
  }

  // 8. Classes (Catalog + Legacy Fallback)
  if (categoryFilter === 'all' || categoryFilter === 'class') {
    const classList = getCatalogClasses();
    classList.forEach((cls: any) => {
      results.push({
        id: cls.nameEn || cls.name,
        name: cls.name,
        nameEn: cls.nameEn || '',
        category: 'class',
        categoryLabel: '职业',
        source: cls.source || 'PHB2024',
        type: `生命骰 d${cls.hitPointDie || 8}`,
        description: cls.description || '',
        isHomebrew: false,
        raw: cls,
      });
    });
  }

  let filtered = results;
  if (editionFilter === '2024') {
    filtered = filtered.filter((r) => r.isHomebrew || r.source.includes('2024') || r.source === 'XPHB' || r.source.includes('2024'));
  } else if (editionFilter === '5e') {
    filtered = filtered.filter((r) => r.isHomebrew || (!r.source.includes('2024') && r.source !== 'XPHB'));
  }

  if (!normalizedQuery) {
    return filtered.slice(0, 100);
  }

  return filtered.filter((item) => {
    return (
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.nameEn.toLowerCase().includes(normalizedQuery) ||
      item.id.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery) ||
      item.source.toLowerCase().includes(normalizedQuery)
    );
  }).slice(0, 150);
}
