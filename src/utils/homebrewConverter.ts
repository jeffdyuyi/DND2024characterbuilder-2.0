// 原创/第三方数据包转换与互通协议（5etools / FVTT / 本地卡包）
import { HomebrewDataState, HomebrewPack, Monster } from '@/store/homebrewStore';

export interface ConvertedPackResult {
  pack: HomebrewPack;
  summary: {
    total: number;
    spells: number;
    monsters: number;
    items: number;
    feats: number;
    species: number;
    backgrounds: number;
    classes: number;
  };
}

/** 智能生成 slug 标识 */
export function generateSlug(str: string, fallbackPrefix = 'item'): string {
  if (!str || !str.trim()) {
    return `${fallbackPrefix}-${Date.now().toString(36)}`;
  }
  const clean = str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, '-')
    .replace(/-+/g, '-');
  return clean || `${fallbackPrefix}-${Date.now().toString(36)}`;
}

/** 将纯文本描述或 5etools entries 数组转为统一的 markdown / 文本字符串 */
export function flattenEntries(entries: any): string {
  if (!entries) return '';
  if (typeof entries === 'string') return entries;
  if (Array.isArray(entries)) {
    return entries
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          if (item.name && item.entries) {
            return `### ${item.name}\n${flattenEntries(item.entries)}`;
          }
          if (item.entries) {
            return flattenEntries(item.entries);
          }
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  return String(entries);
}

/** 将卡包导出为同时兼容 5etools、FVTT 规范及本系统的高保真 JSON */
export function exportPackToJSON(pack: HomebrewPack): string {
  const packSlug = generateSlug(pack.name, 'pack');
  const d = pack.data || {
    spells: [],
    monsters: [],
    items: [],
    feats: [],
    species: [],
    backgrounds: [],
    classes: [],
  };

  const payload = {
    _meta: {
      sources: [
        {
          json: packSlug,
          abbreviation: packSlug.slice(0, 4).toUpperCase(),
          full: pack.name,
          authors: pack.author ? [pack.author] : ['D&D 2024 Builder'],
          version: pack.version || '1.0.0',
        },
      ],
      dateCreated:
        Math.floor(new Date(pack.createdAt).getTime() / 1000) || Math.floor(Date.now() / 1000),
      dateLastModified:
        Math.floor(new Date(pack.updatedAt).getTime() / 1000) || Math.floor(Date.now() / 1000),
    },
    // 5etools 兼容字段
    spell: d.spells.map((s) => ({
      name: s.name,
      ENG_name: s.nameEn || s.name,
      source: packSlug,
      level: s.level ?? 1,
      school: s.school,
      time: [{ number: 1, unit: s.castingTime || 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 60 } },
      components: { v: true, s: true },
      duration: [{ type: 'instant' }],
      entries: [s.description || ''],
      classes: {
        fromClassList: (s.classes || []).map((c: string) => ({ name: c, source: 'PHB' })),
      },
      _native: s,
    })),
    item: d.items.map((i) => ({
      name: i.name,
      ENG_name: i.nameEn || i.name,
      source: packSlug,
      type: i.itemType || 'W',
      rarity: i.rarity || 'common',
      weight: i.weight ? parseFloat(i.weight) || 1 : 1,
      value: i.cost ? parseInt(i.cost, 10) * 100 || 1000 : 1000,
      entries: [i.description || ''],
      _native: i,
    })),
    monster: d.monsters.map((m) => ({
      name: m.name,
      ENG_name: m.nameEn || m.name,
      source: packSlug,
      cr: m.cr || '1',
      ac: [m.ac || 10],
      hp: { average: m.hp || 10 },
      speed: { walk: 30 },
      str: m.stats?.str ?? 10,
      dex: m.stats?.dex ?? 10,
      con: m.stats?.con ?? 10,
      int: m.stats?.int ?? 10,
      wis: m.stats?.wis ?? 10,
      cha: m.stats?.cha ?? 10,
      entries: [m.description || ''],
      _native: m,
    })),
    feat: d.feats.map((f) => ({
      name: f.name,
      ENG_name: f.nameEn || f.name,
      source: packSlug,
      category: f.category || 'General',
      entries: [f.description || ''],
      _native: f,
    })),
    race: d.species.map((r) => ({
      name: r.name,
      ENG_name: r.nameEn || r.name,
      source: packSlug,
      size: [r.size?.[0] || 'M'],
      entries: [r.description || ''],
      _native: r,
    })),
    background: d.backgrounds.map((b) => ({
      name: b.name,
      ENG_name: b.nameEn || b.name,
      source: packSlug,
      entries: [b.description || ''],
      _native: b,
    })),
    // 完整保真本系统包体数据
    dnd2024Pack: {
      id: pack.id,
      name: pack.name,
      author: pack.author,
      description: pack.description,
      version: pack.version,
      icon: pack.icon,
      enabled: pack.enabled,
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt,
      data: d,
    },
  };

  return JSON.stringify(payload, null, 2);
}

/** 导出单张卡片为通用格式 JSON */
export function exportSingleCardToJSON(
  category: keyof HomebrewDataState,
  entry: any,
  packName = '原创私设',
): string {
  const payload = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    category,
    packName,
    card: entry,
  };
  return JSON.stringify(payload, null, 2);
}

/** 智能解析导入的 JSON：支持 5etools、FVTT 导出以及本系统备份文件 */
export function parseImportedJSON(jsonStr: string): ConvertedPackResult {
  const parsed = JSON.parse(jsonStr);

  // 1. 如果包含完整的 dnd2024Pack 键
  if (parsed.dnd2024Pack && typeof parsed.dnd2024Pack === 'object') {
    const rawPack = parsed.dnd2024Pack;
    const d = rawPack.data || {};
    const pack: HomebrewPack = {
      id: rawPack.id || `pack-${Date.now().toString(36)}`,
      name: rawPack.name || '导入的资源包',
      author: rawPack.author || '',
      description: rawPack.description || '',
      version: rawPack.version || '1.0.0',
      icon: rawPack.icon || 'book',
      enabled: rawPack.enabled !== false,
      createdAt: rawPack.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        spells: Array.isArray(d.spells) ? d.spells : [],
        monsters: Array.isArray(d.monsters) ? d.monsters : [],
        items: Array.isArray(d.items) ? d.items : [],
        feats: Array.isArray(d.feats) ? d.feats : [],
        species: Array.isArray(d.species) ? d.species : [],
        backgrounds: Array.isArray(d.backgrounds) ? d.backgrounds : [],
        classes: Array.isArray(d.classes) ? d.classes : [],
      },
    };
    return {
      pack,
      summary: {
        total:
          pack.data.spells.length +
          pack.data.monsters.length +
          pack.data.items.length +
          pack.data.feats.length +
          pack.data.species.length +
          pack.data.backgrounds.length +
          (pack.data.classes?.length || 0),
        spells: pack.data.spells.length,
        monsters: pack.data.monsters.length,
        items: pack.data.items.length,
        feats: pack.data.feats.length,
        species: pack.data.species.length,
        backgrounds: pack.data.backgrounds.length,
        classes: pack.data.classes?.length || 0,
      },
    };
  }

  // 2. 如果包含旧版 dnd2024-homebrew-backup 格式 { version, data: { spells, items... } }
  if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
    const d = parsed.data;
    const pack: HomebrewPack = {
      id: `pack-${Date.now().toString(36)}`,
      name: parsed.packName || '导入的备份包',
      author: parsed.author || '本地用户',
      description: '从旧版备份文件导入',
      version: parsed.version || '1.0.0',
      icon: 'book',
      enabled: true,
      createdAt: parsed.exportedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        spells: Array.isArray(d.spells) ? d.spells : [],
        monsters: Array.isArray(d.monsters) ? d.monsters : [],
        items: Array.isArray(d.items) ? d.items : [],
        feats: Array.isArray(d.feats) ? d.feats : [],
        species: Array.isArray(d.species) ? d.species : [],
        backgrounds: Array.isArray(d.backgrounds) ? d.backgrounds : [],
        classes: Array.isArray(d.classes) ? d.classes : [],
      },
    };
    return {
      pack,
      summary: {
        total:
          pack.data.spells.length +
          pack.data.monsters.length +
          pack.data.items.length +
          pack.data.feats.length +
          pack.data.species.length +
          pack.data.backgrounds.length +
          (pack.data.classes?.length || 0),
        spells: pack.data.spells.length,
        monsters: pack.data.monsters.length,
        items: pack.data.items.length,
        feats: pack.data.feats.length,
        species: pack.data.species.length,
        backgrounds: pack.data.backgrounds.length,
        classes: pack.data.classes?.length || 0,
      },
    };
  }

  // 3. 如果是单张卡片导出格式 { category, card }
  if (parsed.card && parsed.category) {
    const cat = parsed.category as keyof HomebrewDataState;
    const card = parsed.card;
    const pack: HomebrewPack = {
      id: `pack-${Date.now().toString(36)}`,
      name: parsed.packName ? `${parsed.packName} (单卡导入)` : `${card.name || '自制卡'} 包`,
      author: '单卡导入',
      description: '由单张卡片文件导入生成',
      version: '1.0.0',
      icon: 'file-text',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        spells: cat === 'spells' ? [card] : [],
        monsters: cat === 'monsters' ? [card] : [],
        items: cat === 'items' ? [card] : [],
        feats: cat === 'feats' ? [card] : [],
        species: cat === 'species' ? [card] : [],
        backgrounds: cat === 'backgrounds' ? [card] : [],
        classes: cat === 'classes' ? [card] : [],
      },
    };
    return {
      pack,
      summary: {
        total: 1,
        spells: cat === 'spells' ? 1 : 0,
        monsters: cat === 'monsters' ? 1 : 0,
        items: cat === 'items' ? 1 : 0,
        feats: cat === 'feats' ? 1 : 0,
        species: cat === 'species' ? 1 : 0,
        backgrounds: cat === 'backgrounds' ? 1 : 0,
        classes: cat === 'classes' ? 1 : 0,
      },
    };
  }

  // 4. 标准 5etools 格式（带有 _meta 或包含 spell/item/monster/race/feat 顶级数组）
  const sourceMeta = parsed._meta?.sources?.[0];
  const packName = sourceMeta?.full || sourceMeta?.json || '5etools 导入包';
  const packAuthor = sourceMeta?.authors?.join(', ') || '';
  const packVersion = sourceMeta?.version || '1.0.0';

  const spells: any[] = [];
  const monsters: Monster[] = [];
  const items: any[] = [];
  const feats: any[] = [];
  const species: any[] = [];
  const backgrounds: any[] = [];
  const classes: any[] = [];

  // 解析 spells
  if (Array.isArray(parsed.spell)) {
    parsed.spell.forEach((s: any) => {
      if (s._native) {
        spells.push(s._native);
      } else {
        spells.push({
          id: generateSlug(s.ENG_name || s.name, 'spell'),
          name: s.name,
          nameEn: s.ENG_name || s.name,
          source: s.source || '5ETOOLS_HB',
          level: s.level ?? 0,
          school: s.school ? `${s.school}系` : '通用',
          castingTime: s.time?.[0]?.unit || '1 动作',
          range: '60 尺',
          components: 'V, S',
          duration: '立即',
          classes: s.classes?.fromClassList?.map((c: any) => c.name) || ['法师'],
          description: flattenEntries(s.entries),
          isHomebrew: true,
          enabled: true,
        });
      }
    });
  }

  // 解析 items
  if (Array.isArray(parsed.item)) {
    parsed.item.forEach((i: any) => {
      if (i._native) {
        items.push(i._native);
      } else {
        items.push({
          id: generateSlug(i.ENG_name || i.name, 'item'),
          name: i.name,
          nameEn: i.ENG_name || i.name,
          source: i.source || '5ETOOLS_HB',
          itemType: i.type || '奇物',
          rarity: i.rarity || '普通',
          attunement: i.reqAttune ? '需要同调' : '无需同调',
          cost: i.value ? `${Math.floor(i.value / 100)} gp` : '100 gp',
          weight: i.weight ? `${i.weight} 磅` : '1 磅',
          description: flattenEntries(i.entries),
          isHomebrew: true,
          enabled: true,
        });
      }
    });
  }

  // 解析 monsters
  if (Array.isArray(parsed.monster)) {
    parsed.monster.forEach((m: any) => {
      if (m._native) {
        monsters.push(m._native);
      } else {
        monsters.push({
          id: generateSlug(m.ENG_name || m.name, 'monster'),
          name: m.name,
          nameEn: m.ENG_name || m.name,
          source: m.source || '5ETOOLS_HB',
          cr: String(m.cr || '1'),
          type: typeof m.type === 'string' ? m.type : m.type?.type || '类人生物',
          alignment: typeof m.alignment === 'string' ? m.alignment : '中立',
          ac: Array.isArray(m.ac) ? m.ac[0] : m.ac || 10,
          hp: typeof m.hp === 'object' ? m.hp?.average || 10 : m.hp || 10,
          speed: '30 尺',
          stats: {
            str: m.str ?? 10,
            dex: m.dex ?? 10,
            con: m.con ?? 10,
            int: m.int ?? 10,
            wis: m.wis ?? 10,
            cha: m.cha ?? 10,
          },
          description: flattenEntries(m.entries || m.trait || m.action),
          isHomebrew: true,
          enabled: true,
        });
      }
    });
  }

  // 解析 feats
  if (Array.isArray(parsed.feat)) {
    parsed.feat.forEach((f: any) => {
      if (f._native) {
        feats.push(f._native);
      } else {
        feats.push({
          id: generateSlug(f.ENG_name || f.name, 'feat'),
          name: f.name,
          nameEn: f.ENG_name || f.name,
          source: f.source || '5ETOOLS_HB',
          category: f.category || 'General',
          prerequisite: '无',
          description: flattenEntries(f.entries),
          isHomebrew: true,
          enabled: true,
        });
      }
    });
  }

  // 解析 race / species
  const raceList = parsed.race || parsed.species;
  if (Array.isArray(raceList)) {
    raceList.forEach((r: any) => {
      if (r._native) {
        species.push(r._native);
      } else {
        species.push({
          id: generateSlug(r.ENG_name || r.name, 'species'),
          name: r.name,
          nameEn: r.ENG_name || r.name,
          source: r.source || '5ETOOLS_HB',
          creatureType: '类人生物',
          size: r.size?.[0] || 'Medium',
          senses: '常规视觉',
          description: flattenEntries(r.entries),
          isHomebrew: true,
          enabled: true,
        });
      }
    });
  }

  // 解析 background
  if (Array.isArray(parsed.background)) {
    parsed.background.forEach((b: any) => {
      if (b._native) {
        backgrounds.push(b._native);
      } else {
        backgrounds.push({
          id: generateSlug(b.ENG_name || b.name, 'bg'),
          name: b.name,
          nameEn: b.ENG_name || b.name,
          source: b.source || '5ETOOLS_HB',
          abilityScores: '自选',
          featRecommendation: '常训',
          skills: '两项自选',
          description: flattenEntries(b.entries),
          isHomebrew: true,
          enabled: true,
        });
      }
    });
  }

  // 解析 FVTT items 导出包 [{ name, type: "spell", system: {...} }]
  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.system) {
    parsed.forEach((fvttItem: any) => {
      const type = fvttItem.type;
      const sys = fvttItem.system || {};
      const desc = sys.description?.value || '';
      if (type === 'spell') {
        spells.push({
          id: generateSlug(fvttItem.name, 'fvtt-spell'),
          name: fvttItem.name,
          nameEn: fvttItem.name,
          source: 'FVTT_IMPORT',
          level: sys.level ?? 1,
          school: sys.school || '通用',
          castingTime: sys.activation?.type || '1 动作',
          range: `${sys.range?.value || 60} 尺`,
          components: 'V, S',
          duration: '立即',
          classes: ['法师'],
          description: desc,
          isHomebrew: true,
          enabled: true,
        });
      } else if (type === 'feat') {
        feats.push({
          id: generateSlug(fvttItem.name, 'fvtt-feat'),
          name: fvttItem.name,
          nameEn: fvttItem.name,
          source: 'FVTT_IMPORT',
          category: 'General',
          prerequisite: '无',
          description: desc,
          isHomebrew: true,
          enabled: true,
        });
      } else if (type === 'weapon' || type === 'equipment' || type === 'loot') {
        items.push({
          id: generateSlug(fvttItem.name, 'fvtt-item'),
          name: fvttItem.name,
          nameEn: fvttItem.name,
          source: 'FVTT_IMPORT',
          itemType: type,
          rarity: sys.rarity || '普通',
          attunement: sys.attunement ? '需要同调' : '无需同调',
          cost: `${sys.price?.value || 10} gp`,
          weight: `${sys.weight || 1} 磅`,
          description: desc,
          isHomebrew: true,
          enabled: true,
        });
      }
    });
  }

  const pack: HomebrewPack = {
    id: `pack-${Date.now().toString(36)}`,
    name: packName,
    author: packAuthor,
    description: `从外部文件导入，包含 ${spells.length + items.length + monsters.length + feats.length + species.length + backgrounds.length} 个条目`,
    version: packVersion,
    icon: 'book',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: {
      spells,
      monsters,
      items,
      feats,
      species,
      backgrounds,
      classes,
    },
  };

  return {
    pack,
    summary: {
      total:
        spells.length +
        monsters.length +
        items.length +
        feats.length +
        species.length +
        backgrounds.length +
        classes.length,
      spells: spells.length,
      monsters: monsters.length,
      items: items.length,
      feats: feats.length,
      species: species.length,
      backgrounds: backgrounds.length,
      classes: classes.length,
    },
  };
}
