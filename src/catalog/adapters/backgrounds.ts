/**
 * Catalog Background Adapter
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18、§51
 *
 * 职责：
 * 1. 将 CatalogEntry (5etools / Legacy) 统一转为 UI 和规则引擎使用的 Background 接口；
 * 2. 提供 getCatalogBackgrounds() 检索背景全集，按 5etools 优先、Legacy 兜底策略去重；
 * 3. 维护稳定全局 ID 与旧版短 ID、英文名、中文名别名映射。
 */

import { CatalogEntry, Edition } from '../types';
import { defaultCatalog } from '../catalog';
import { Background, BackgroundEquipmentRecord, FlavorTable } from '@/types/background';
import { Selection } from '@/types/species';
import { Currency } from '@/types/characterState';
import { clean5eTags, flattenEntries } from '@/source/fiveetools-cn/utils';

import {
  getCatalogTools,
  getCatalogToolEntries,
  getToolCategory,
  getToolDisplayName,
} from '../tools';

function isArtisanCategory(term: string): boolean {
  const t = String(term || '').toLowerCase().replace(/[-_\s']/g, '');
  return (
    t === 'artisanstools' || 
    t === 'artisantools' || 
    t === 'anyartisan' || 
    t === 'anyartisanstool' || 
    t === 'anyartisanstools' ||
    t === 'artisan'
  );
}

function isGamingSetCategory(term: string): boolean {
  const t = String(term || '').toLowerCase().replace(/[-_\s']/g, '');
  return (
    t === 'gamingset' || 
    t === 'anygamingset' || 
    t === 'gamingsets' || 
    t === 'anygamingsets'
  );
}

function isMusicalInstrumentCategory(term: string): boolean {
  const t = String(term || '').toLowerCase().replace(/[-_\s']/g, '');
  return (
    t === 'musicalinstrument' || 
    t === 'anymusicalinstrument' || 
    t === 'musicalinstruments' || 
    t === 'anymusicalinstruments' ||
    t === 'instrument'
  );
}

function expandToolOptions(options: string[]): string[] {
  const result: string[] = [];
  for (const opt of options) {
    if (isArtisanCategory(opt)) {
      result.push(...getCatalogTools('Artisan'));
    } else if (isGamingSetCategory(opt)) {
      result.push(...getCatalogTools('Gaming'));
    } else if (isMusicalInstrumentCategory(opt)) {
      result.push(...getCatalogTools('Musical'));
    } else if (opt.toLowerCase() === 'any' || opt.toLowerCase() === 'anytool') {
      return getCatalogTools();
    } else {
      result.push(opt);
    }
  }
  return Array.from(new Set(result));
}

function parseProficiencies(value: unknown, kind: 'skill' | 'tool' | 'language'): any[] {
  if (!Array.isArray(value)) return [];
  const items: any[] = [];

  for (const group of value) {
    if (typeof group === 'string') {
      if (kind === 'tool') {
        if (isArtisanCategory(group)) {
          items.push({ name: '工匠工具自选', numToChoose: 1, options: getCatalogTools('Artisan') });
          continue;
        }
        if (isGamingSetCategory(group)) {
          items.push({ name: '赌具自选', numToChoose: 1, options: getCatalogTools('Gaming') });
          continue;
        }
        if (isMusicalInstrumentCategory(group)) {
          items.push({ name: '乐器自选', numToChoose: 1, options: getCatalogTools('Musical') });
          continue;
        }
      }
      items.push(group);
      continue;
    }

    if (!group || typeof group !== 'object') continue;

    if (group.choose) {
      const choose = group.choose;
      const count = typeof choose.count === 'number' ? choose.count : 1;
      let from: string[] = Array.isArray(choose.from) ? choose.from : ['Any'];
      let choiceName: string | undefined = undefined;

      if (kind === 'tool') {
        const hasArtisan = from.some(isArtisanCategory);
        const hasGaming = from.some(isGamingSetCategory);
        const hasMusical = from.some(isMusicalInstrumentCategory);
        const hasAny = from.some(f => f.toLowerCase() === 'any' || f.toLowerCase() === 'anytool');

        if (hasAny) {
          choiceName = '工具自选';
        } else if (hasArtisan && !hasGaming && !hasMusical && from.length === 1) {
          choiceName = '工匠工具自选';
        } else if (hasGaming && !hasArtisan && !hasMusical && from.length === 1) {
          choiceName = '赌具自选';
        } else if (hasMusical && !hasArtisan && !hasGaming && from.length === 1) {
          choiceName = '乐器自选';
        } else if (hasArtisan && hasMusical) {
          choiceName = '工匠工具或乐器自选';
        } else {
          choiceName = '工具自选';
        }
        from = expandToolOptions(from);
      } else if (kind === 'language') {
        choiceName = from.some(f => f.toLowerCase() === 'anystandard') ? '标准语言自选' : '语言自选';
        if (from.some(f => f.toLowerCase() === 'any' || f.toLowerCase() === 'anystandard')) {
          from = ['Any'];
        }
      } else if (kind === 'skill') {
        choiceName = '技能自选';
        if (from.some(f => f.toLowerCase() === 'any')) {
          from = ['Any'];
        }
      }

      items.push({
        name: choiceName,
        numToChoose: count,
        options: from,
      });
      continue;
    }

    for (const [key, amount] of Object.entries(group)) {
      const lowKey = key.toLowerCase();

      if (kind === 'language') {
        if (lowKey === 'anystandard' || lowKey === 'any') {
          const num = typeof amount === 'number' ? amount : 1;
          items.push({
            name: lowKey === 'anystandard' ? '标准语言自选' : '语言自选',
            numToChoose: num,
            options: ['Any'],
          });
          continue;
        }
        if (amount === true) {
          items.push(key);
          continue;
        }
      }

      if (kind === 'tool') {
        if (isArtisanCategory(key)) {
          const num = typeof amount === 'number' ? amount : 1;
          items.push({
            name: '工匠工具自选',
            numToChoose: num,
            options: getCatalogTools('Artisan'),
          });
          continue;
        }
        if (isGamingSetCategory(key)) {
          const num = typeof amount === 'number' ? amount : 1;
          items.push({
            name: '赌具自选',
            numToChoose: num,
            options: getCatalogTools('Gaming'),
          });
          continue;
        }
        if (isMusicalInstrumentCategory(key)) {
          const num = typeof amount === 'number' ? amount : 1;
          items.push({
            name: '乐器自选',
            numToChoose: num,
            options: getCatalogTools('Musical'),
          });
          continue;
        }
        if (lowKey === 'any' || lowKey === 'anytool') {
          const num = typeof amount === 'number' ? amount : 1;
          items.push({
            name: '工具自选',
            numToChoose: num,
            options: ['Any'],
          });
          continue;
        }
        if (amount === true) {
          items.push(key);
          continue;
        }
      }

      if (kind === 'skill') {
        if (lowKey === 'any') {
          const num = typeof amount === 'number' ? amount : 1;
          items.push({
            name: '技能自选',
            numToChoose: num,
            options: ['Any'],
          });
          continue;
        }
        if (amount === true) {
          items.push(key);
          continue;
        }
      }

      if (amount === true) {
        items.push(key);
      } else if (typeof amount === 'number') {
        items.push({
          numToChoose: amount,
          options: ['Any'],
        });
      }
    }
  }

  return items;
}

let cachedItemCatalogEntries: CatalogEntry[] | null = null;
let cachedItemCatalogFingerprint = '';

function getCachedItemCatalogEntries(): CatalogEntry[] {
  const rawItems = defaultCatalog.list('item');
  const rawBaseItems = defaultCatalog.list('baseitem');
  const rawMagicVariants = defaultCatalog.list('magicvariant');
  const fp = `${rawItems.length}:${rawBaseItems.length}:${rawMagicVariants.length}`;
  if (cachedItemCatalogEntries && cachedItemCatalogFingerprint === fp) {
    return cachedItemCatalogEntries;
  }
  cachedItemCatalogEntries = [...rawItems, ...rawBaseItems, ...rawMagicVariants];
  cachedItemCatalogFingerprint = fp;
  return cachedItemCatalogEntries;
}

function findCatalogItemEntry(name: string, source?: string): CatalogEntry | undefined {
  if (!name) return undefined;
  const target = name.toLowerCase().replace(/[-_\s()（）]/g, '');
  const normSource = source ? (source.toUpperCase() === 'PHB2024' ? 'XPHB' : source.toUpperCase()) : undefined;

  const items = getCachedItemCatalogEntries();

  const matches = items.filter((entry) => {
    if (normSource && entry.source.toUpperCase() !== normSource) return false;
    const n1 = entry.name.toLowerCase().replace(/[-_\s()（）]/g, '');
    const n2 = (entry.englishName || '').toLowerCase().replace(/[-_\s()（）]/g, '');
    const id = entry.id.toLowerCase().replace(/[-_\s()（）]/g, '');
    return n1 === target || n2 === target || id === target;
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return matches.find((m) => m.edition === '2024' || m.source === 'XPHB') || matches[0];
  }

  // 兜底模糊匹配：去除括号规格后重试（如 "墨水(1盎司/瓶)" -> "墨水"）
  const simplified = name.replace(/\(.*?\)|（.*?）/g, '').trim().toLowerCase().replace(/[-_\s]/g, '');
  if (simplified && simplified !== target) {
    const fuzzyMatches = items.filter((entry) => {
      if (normSource && entry.source.toUpperCase() !== normSource) return false;
      const n1 = entry.name.toLowerCase().replace(/[-_\s()（）]/g, '');
      return n1 === simplified || n1.includes(simplified) || simplified.includes(n1);
    });
    if (fuzzyMatches.length > 0) {
      return fuzzyMatches.find((m) => m.edition === '2024' || m.source === 'XPHB') || fuzzyMatches[0];
    }
  }

  return undefined;
}

function getCategoryFromCatalogEntry(catEntry?: CatalogEntry, label?: string): BackgroundEquipmentRecord['category'] {
  if (catEntry) {
    const type = String(catEntry.raw?.type || '').toUpperCase();
    if (['M', 'R', 'W'].includes(type) || catEntry.raw?.weaponCategory) return 'weapon';
    if (['HA', 'MA', 'LA'].includes(type) || catEntry.raw?.armorCategory) return 'armor';
    if (type === 'S' || catEntry.raw?.armorCategory === 'Shield') return 'shield';
    if (['AT', 'T', 'GS', 'INS'].includes(type) || catEntry.raw?.toolCategory) return 'tool';
  }
  if (label) {
    if (label.includes('工具') || label.includes('赌具') || label.includes('乐器') || label.includes('道具') || label.includes('套件')) return 'tool';
    if (label.includes('剑') || label.includes('匕首') || label.includes('弓') || label.includes('矛') || label.includes('杖') || label.includes('棍') || label.includes('弩') || label.includes('斧') || label.includes('锤')) return 'weapon';
    if (label.includes('甲') || label.includes('皮甲') || label.includes('链甲')) return 'armor';
    if (label.includes('盾')) return 'shield';
  }
  return 'gear';
}

function formatCurrencyFromCp(cpTotal: number): { label: string; currency: Partial<Currency> } {
  const gp = Math.floor(cpTotal / 100);
  const remainingCp = cpTotal % 100;
  const sp = Math.floor(remainingCp / 10);
  const cp = remainingCp % 10;
  const parts: string[] = [];
  const cur: Partial<Currency> = {};
  if (gp > 0) {
    parts.push(`${gp} GP`);
    cur.gp = gp;
  }
  if (sp > 0) {
    parts.push(`${sp} SP`);
    cur.sp = sp;
  }
  if (cp > 0) {
    parts.push(`${cp} CP`);
    cur.cp = cp;
  }
  const label = parts.join(' ') || '0 GP';
  return { label, currency: cur };
}

function parseCurrencyString(label: string): Partial<Currency> | undefined {
  if (!label) return undefined;
  const norm = label.replace(/\s+/g, '').toUpperCase();
  const match = norm.match(/^(\d+)(PP|GP|EP|SP|CP)$/);
  if (match) {
    return { [match[2].toLowerCase() as keyof Currency]: parseInt(match[1], 10) };
  }
  const matchCn = label.trim().match(/^(\d+)\s*(?:金币|GP|枚金币|枚)$/i);
  if (matchCn) {
    return { gp: parseInt(matchCn[1], 10) };
  }
  const matchOtherSp = label.trim().match(/^(\d+)\s*(?:银币|SP)$/i);
  if (matchOtherSp) {
    return { sp: parseInt(matchOtherSp[1], 10) };
  }
  const matchOtherCp = label.trim().match(/^(\d+)\s*(?:铜币|CP)$/i);
  if (matchOtherCp) {
    return { cp: parseInt(matchOtherCp[1], 10) };
  }
  return undefined;
}

function parseEquipmentElement(
  entry: any,
  index: number
): {
  displayLabel?: string | Selection<string>;
  records: BackgroundEquipmentRecord[];
} {
  const records: BackgroundEquipmentRecord[] = [];
  if (!entry) return { records };

  // 1. 纯字符串引用，如 "普通服装|phb" 或 "匕首|xphb"
  if (typeof entry === 'string') {
    const [rawName, source] = entry.split('|');
    const cleanName = clean5eTags(rawName).trim();
    const catEntry = findCatalogItemEntry(rawName, source);
    const itemId = catEntry?.id;
    const category = getCategoryFromCatalogEntry(catEntry);
    records.push({
      itemId,
      label: cleanName,
      quantity: 1,
      kind: 'item',
      category,
    });
    return { displayLabel: cleanName, records };
  }

  // 2. 纯货币条目，如 { value: 1600 } 或 { containsValue: 1500 }
  if (
    typeof entry === 'number' ||
    typeof entry.value === 'number' ||
    (typeof entry.containsValue === 'number' && !entry.item)
  ) {
    const cp = typeof entry === 'number' ? entry : (entry.value ?? entry.containsValue);
    const { label, currency } = formatCurrencyFromCp(cp);
    records.push({
      label,
      kind: 'currency',
      currency,
    });
    return { displayLabel: label, records };
  }

  // 3. 结构化物品，如 { item: "小包|phb", containsValue: 1000 } 或 { item: "圣徽|phb", displayName: "圣徽（出任神职时的礼物）" }
  if (entry.item) {
    const [rawName, source] = String(entry.item).split('|');
    const baseName = clean5eTags(entry.displayName || rawName).trim();
    const qty = entry.quantity || entry.count || 1;
    const catEntry = findCatalogItemEntry(rawName, source);
    const itemId = catEntry?.id;
    const category = getCategoryFromCatalogEntry(catEntry);

    if (typeof entry.containsValue === 'number') {
      const { label: curLabel, currency } = formatCurrencyFromCp(entry.containsValue);
      const displayLabel = `${qty > 1 ? `${qty} ` : ''}${baseName}（内含 ${curLabel}）`;
      records.push({
        itemId,
        label: `${qty > 1 ? `${qty} ` : ''}${baseName}`,
        quantity: qty,
        kind: 'item',
        category,
      });
      records.push({
        label: curLabel,
        kind: 'currency',
        currency,
      });
      return { displayLabel, records };
    }

    const displayLabel = `${qty > 1 ? `${qty} ` : ''}${baseName}`;
    records.push({
      itemId,
      label: displayLabel,
      quantity: qty,
      kind: 'item',
      category,
    });
    return { displayLabel, records };
  }

  // 4. 特殊/风味物品，如 { special: "俄佐立徽章" } 或 { special: "熏香", quantity: 5 }
  if (entry.special) {
    const specialText = clean5eTags(entry.special).trim();
    const qty = entry.quantity || entry.count || 1;
    const displayLabel = `${qty > 1 ? `${qty} ` : ''}${specialText}`;
    records.push({
      label: displayLabel,
      quantity: qty,
      kind: 'item',
      category: 'gear',
    });
    return { displayLabel, records };
  }

  // 5. 抽象工具/装备类型占位符，如 { equipmentType: "toolArtisan" }
  if (entry.equipmentType) {
    if (entry.equipmentType === 'setGaming') {
      return {
        displayLabel: '赌具自选',
        records: [{ label: '赌具自选', kind: 'unresolved', category: 'tool' }],
      };
    }
    if (entry.equipmentType === 'toolArtisan' || entry.equipmentType === 'artisan') {
      return {
        displayLabel: '工匠工具自选',
        records: [{ label: '工匠工具自选', kind: 'unresolved', category: 'tool' }],
      };
    }
    if (entry.equipmentType === 'instrumentMusical' || entry.equipmentType === 'musicalInstrument') {
      return {
        displayLabel: '乐器自选',
        records: [{ label: '乐器自选', kind: 'unresolved', category: 'tool' }],
      };
    }
  }

  return { records };
}

function parseStartingEquipmentAst(
  starting: any[],
  backgroundName?: string
): Background['equipment'] {
  const choiceA: (string | Selection<string>)[] = [];
  const choiceARecords: BackgroundEquipmentRecord[] = [];
  let choiceB = '';
  let choiceBRecord: BackgroundEquipmentRecord | undefined = undefined;

  for (let idx = 0; idx < starting.length; idx++) {
    const itemGroup = starting[idx];
    if (!itemGroup || typeof itemGroup !== 'object') continue;

    // 1. 如果包含固定装备 '_'
    if (Array.isArray(itemGroup._)) {
      for (const item of itemGroup._) {
        const parsed = parseEquipmentElement(item, idx);
        if (parsed.displayLabel) choiceA.push(parsed.displayLabel);
        choiceARecords.push(...parsed.records);
      }
    }

    // 2. 检查是否有内部自选项或顶层方案 A/B
    const hasGroupA = Array.isArray(itemGroup.A || itemGroup.a);
    const hasGroupB = Array.isArray(itemGroup.B || itemGroup.b);

    if (hasGroupA && hasGroupB) {
      const listA = itemGroup.A || itemGroup.a;
      const listB = itemGroup.B || itemGroup.b;

      // 判断这是否是“方案A (装备包) vs 方案B (50 GP金币)”的顶层规则
      const isTopLevelScheme = (
        !itemGroup._ &&
        idx === 0 &&
        listB.some((it: any) => typeof it?.value === 'number' || typeof it === 'number' || it?.containsValue)
      );

      if (isTopLevelScheme) {
        for (const item of listA) {
          const parsed = parseEquipmentElement(item, idx);
          if (parsed.displayLabel) choiceA.push(parsed.displayLabel);
          choiceARecords.push(...parsed.records);
        }
        const bLabels: string[] = [];
        const bRecords: BackgroundEquipmentRecord[] = [];
        for (const item of listB) {
          const parsed = parseEquipmentElement(item, idx);
          if (parsed.displayLabel && typeof parsed.displayLabel === 'string') {
            bLabels.push(parsed.displayLabel);
          }
          bRecords.push(...parsed.records);
        }
        choiceB = bLabels.join('，');
        choiceBRecord = bRecords[0];
      } else {
        // 内部二选一选项（如：祷告经书 或 经轮）
        const subLabelsA: string[] = [];
        const subRecordsA: BackgroundEquipmentRecord[] = [];
        for (const it of listA) {
          const p = parseEquipmentElement(it, idx);
          if (p.displayLabel && typeof p.displayLabel === 'string') subLabelsA.push(p.displayLabel);
          subRecordsA.push(...p.records);
        }

        const subLabelsB: string[] = [];
        const subRecordsB: BackgroundEquipmentRecord[] = [];
        for (const it of listB) {
          const p = parseEquipmentElement(it, idx);
          if (p.displayLabel && typeof p.displayLabel === 'string') subLabelsB.push(p.displayLabel);
          subRecordsB.push(...p.records);
        }

        const labelA = subLabelsA.join('，');
        const labelB = subLabelsB.join('，');
        if (labelA && labelB) {
          const selection: Selection<string> = {
            name: `${labelA} 或 ${labelB} 自选`,
            numToChoose: 1,
            options: [labelA, labelB],
          };
          choiceA.push(selection);
          choiceARecords.push({
            label: `${labelA} 或 ${labelB} 自选`,
            kind: 'unresolved',
            selectionId: `bg-equip-choice-${idx}`,
          });
        }
      }
    } else if (hasGroupA) {
      const listA = itemGroup.A || itemGroup.a;
      for (const item of listA) {
        const parsed = parseEquipmentElement(item, idx);
        if (parsed.displayLabel) choiceA.push(parsed.displayLabel);
        choiceARecords.push(...parsed.records);
      }
    }
  }

  return {
    choiceA,
    choiceB: choiceB || undefined,
    choiceARecords: choiceARecords.length > 0 ? choiceARecords : undefined,
    choiceBRecord,
  };
}

const REGEX_2024_SCHEME = /(?:\(A\)|(?:^|选择[A-Z或\s：:]*)[AＡ][：:])\s*([\s\S]+?)(?:[；;，,]\s*或|\s*或|[；;，,]|\s+)\s*(?:\(?[BＢ]\)?[：:]?)\s*([\s\S]+)$/i;

function parseEquipmentTextFallback(
  rawEqText: string
): Background['equipment'] {
  // 匹配 2024 标准分案：选择 A 或 B：(A) ...；或 (B) ...
  const match2024 = rawEqText.match(REGEX_2024_SCHEME);
  if (match2024) {
    let textA = match2024[1].trim();
    const textB = match2024[2].trim();

    // 1. 规范化分隔符：将仅由空格与前面的装备隔开的末尾货币前补充分隔符（如 "水袋 26GP" -> "水袋，26GP"）
    textA = textA.replace(/(\S)\s+(\d+\s*(?:GP|SP|CP|PP|EP|金币|银币|铜币|枚金币|枚))/gi, '$1，$2');

    // 2. 泛用按顿号、逗号、分号及连词拆分为子句
    const rawTokens = textA.split(/[、，,;；]|(?:\s*以及\s*|\s*还有\s*|\s*和\s*)/).map((s) => s.trim()).filter(Boolean);

    const choiceA: string[] = [];
    const choiceARecords: BackgroundEquipmentRecord[] = [];

    for (const token of rawTokens) {
      const cleanToken = clean5eTags(token).trim();
      if (!cleanToken) continue;

      // 检查是否为纯货币 (如 "30 GP", "50金币", "10 gp", "29枚")
      const cur = parseCurrencyString(cleanToken);
      if (cur) {
        choiceA.push(cleanToken);
        choiceARecords.push({ label: cleanToken, kind: 'currency', currency: cur });
        continue;
      }

      // 防御性处理：检查子句是否依然混有物品与货币（如 "旅行服装， 30 GP" 或 "旅行服装 30 GP"）
      const compoundCurMatch = cleanToken.match(/(?:[，,\s]+|\s+)(\d+)\s*(GP|SP|CP|PP|EP|金币|银币|铜币|枚金币|枚)$/i);
      if (compoundCurMatch) {
        const itemPart = cleanToken.slice(0, compoundCurMatch.index).trim();
        const amt = parseInt(compoundCurMatch[1], 10);
        const unit = compoundCurMatch[2].toLowerCase();
        const curKey: keyof Currency = (unit === '金币' || unit === 'gp' || unit === '枚' || unit === '枚金币') ? 'gp' :
                                      (unit === '银币' || unit === 'sp') ? 'sp' :
                                      (unit === '铜币' || unit === 'cp') ? 'cp' :
                                      (unit as keyof Currency);
        const embeddedCur: Partial<Currency> = { [curKey]: amt };
        const curLabel = `${amt} ${unit === '枚' || unit === '枚金币' ? 'GP' : unit.toUpperCase()}`;

        if (itemPart) {
          choiceA.push(itemPart);
          const catEntry = findCatalogItemEntry(itemPart);
          choiceARecords.push({
            itemId: catEntry?.id,
            label: itemPart,
            quantity: 1,
            kind: 'item',
            category: getCategoryFromCatalogEntry(catEntry, itemPart),
          });
        }
        choiceA.push(curLabel);
        choiceARecords.push({
          label: curLabel,
          kind: 'currency',
          currency: embeddedCur,
        });
        continue;
      }

      // 普通装备项：解析数量与具体物品名称
      let itemLabel = cleanToken;
      let qty = 1;
      const qtyMatch = itemLabel.match(/^(\d+)\s*(?:把|支|个|套|件|张|瓶|条|副|根|盒|份|只|包)?\s*(.+)$/) ||
                       itemLabel.match(/^(?:两|两把|两支|两个|两套|两瓶|两只|两包)\s*(.+)$/);
      if (qtyMatch) {
        if (qtyMatch[0].startsWith('两')) {
          qty = 2;
          itemLabel = qtyMatch[1].trim();
        } else {
          qty = parseInt(qtyMatch[1], 10) || 1;
          itemLabel = qtyMatch[2].trim();
        }
      }

      choiceA.push(cleanToken);
      const catEntry = findCatalogItemEntry(itemLabel) || findCatalogItemEntry(cleanToken);
      choiceARecords.push({
        itemId: catEntry?.id,
        label: cleanToken,
        quantity: qty,
        kind: 'item',
        category: getCategoryFromCatalogEntry(catEntry, cleanToken),
      });
    }

    const choiceB = clean5eTags(textB).trim();
    const curB = parseCurrencyString(choiceB);
    const choiceBRecord: BackgroundEquipmentRecord | undefined = curB
      ? { label: choiceB, kind: 'currency', currency: curB }
      : undefined;

    return {
      choiceA,
      choiceB,
      choiceARecords,
      choiceBRecord,
    };
  }

  // 2014 经典背景单文本解析：按标点与连词拆分
  const rawClauses = rawEqText.split(/[，,;；、]|(?:\s*以及\s*|\s*还有\s*|\s*和\s*)/).map((s) => s.trim()).filter(Boolean);
  const choiceA: string[] = [];
  const choiceARecords: BackgroundEquipmentRecord[] = [];

  for (const clause of rawClauses) {
    const cleanClauseText = clean5eTags(clause).trim();
    if (!cleanClauseText) continue;

    // 检查是否为纯货币 (如 "10 gp", "15 金币", "1000 cp")
    const pureCur = parseCurrencyString(cleanClauseText);
    if (pureCur) {
      choiceA.push(cleanClauseText);
      choiceARecords.push({
        label: cleanClauseText,
        kind: 'currency',
        currency: pureCur,
      });
      continue;
    }

    // 检查是否有包含货币，如 "一条腰带小包内装有10gp（俄佐立发行的1齐诺硬币）"
    const moneyMatch = clause.match(/(?:内装有|装有|内含|包含|带有|里面有)?\s*(\d+)\s*(gp|sp|cp|pp|ep|金币|银币|铜币)/i);
    let extractedCurrency: Partial<Currency> | undefined = undefined;
    if (moneyMatch) {
      const amount = parseInt(moneyMatch[1], 10);
      const unit = moneyMatch[2].toLowerCase();
      const curKey: keyof Currency = (unit === '金币' || unit === 'gp') ? 'gp' :
                                    (unit === '银币' || unit === 'sp') ? 'sp' :
                                    (unit === '铜币' || unit === 'cp') ? 'cp' :
                                    (unit as keyof Currency);
      extractedCurrency = { [curKey]: amount };
    }

    // 检查是否有 {@item ...} 标签
    const tagMatch = clause.match(/\{@item\s+([^|}]+)(?:\|([^|}]+))?(?:\|([^}]+))?\}/i);
    let itemName = '';
    let itemId: string | undefined = undefined;
    let category: BackgroundEquipmentRecord['category'] = 'gear';

    if (tagMatch) {
      const itemKey = tagMatch[1].trim();
      const source = tagMatch[2]?.trim();
      const catEntry = findCatalogItemEntry(itemKey, source);
      itemId = catEntry?.id;
      category = getCategoryFromCatalogEntry(catEntry, itemKey);
      itemName = catEntry?.name || clean5eTags(tagMatch[3] || itemKey).trim();
    }

    // 清洗该子句纯文本
    let cleanClause = cleanClauseText
      // 修复重叠量词（如 "一瓶一瓶蓝墨水" -> "一瓶蓝墨水"）
      .replace(/(一[瓶支套条枚个把副卷张份])\1+/g, '$1')
      .replace(/^(?:一枚|一支|一瓶|一套|一条|一把|一个|两把|一件|一卷|一副|两瓶|一盒|一份|一根)\s*/, '')
      .replace(/(?:内装有|装有|内含|包含).*$/, '')
      .replace(/[（(].*?[）)]/g, '')
      .trim();

    const finalItemLabel = itemName || cleanClause;
    if (!finalItemLabel) continue;

    if (extractedCurrency) {
      const gp = extractedCurrency.gp || 0;
      choiceA.push(`${cleanClause || finalItemLabel}（内含 ${gp} GP）`);
      choiceARecords.push({
        itemId,
        label: finalItemLabel,
        quantity: 1,
        kind: 'item',
        category,
      });
      choiceARecords.push({
        label: `${gp} GP`,
        kind: 'currency',
        currency: extractedCurrency,
      });
    } else {
      const displayLabel = clean5eTags(clause).replace(/(一[瓶支套条枚个把副卷张份])\1+/g, '$1').trim();
      choiceA.push(displayLabel);
      choiceARecords.push({
        itemId,
        label: finalItemLabel,
        quantity: 1,
        kind: 'item',
        category: getCategoryFromCatalogEntry(undefined, finalItemLabel),
      });
    }
  }

  return {
    choiceA: choiceA.length > 0 ? choiceA : [clean5eTags(rawEqText).trim()],
    choiceB: undefined,
    choiceARecords: choiceARecords.length > 0 ? choiceARecords : undefined,
    choiceBRecord: undefined,
  };
}

/**
 * 将 CatalogEntry 规范化为 UI 期望的标准 Background 接口
 */
export function catalogEntryToBackground(entry: CatalogEntry): Background {
  // 1. 若原始对象已是完整的旧版 Background，直接保留原汁原味
  if (entry.sourcePackId === 'legacy' && entry.raw && Array.isArray((entry.raw as any).skillProficiencies)) {
    return entry.raw as unknown as Background;
  }

  // 2. 5etools-cn 格式适配
  const raw = (entry.raw || {}) as any;

  // 属性值建议
  const abilityScoreOptions: string[] = [];
  if (Array.isArray(raw.ability)) {
    for (const ab of raw.ability) {
      if (typeof ab === 'object') {
        const weightedFrom = ab.choose?.weighted?.from || ab.choose?.from || [];
        [...Object.keys(ab).filter((key) => ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(key)), ...weightedFrom].forEach((k) => {
          if (!abilityScoreOptions.includes(k.toUpperCase())) {
            abilityScoreOptions.push(k.toUpperCase());
          }
        });
      }
    }
  }

  // 起源专长
  let feat: Background['feat'] | undefined = undefined;
  if (raw.feats && Array.isArray(raw.feats) && raw.feats.length > 0) {
    const f = raw.feats[0];
    let featRef = '';
    if (typeof f === 'string') {
      featRef = f.split('|')[0];
    } else if (typeof f === 'object') {
      const key = Object.keys(f)[0] || '';
      featRef = f.name || f.ENG_name || key.split('|')[0] || '';
    }
    if (featRef) {
      const catalogFeats = defaultCatalog.list('feat');
      const parts = featRef.split(/[;；]/).map(s => s.trim());
      const baseFeatName = parts[0];
      const subVariant = parts.slice(1).join('；');

      const cleanRef = featRef.toLowerCase().replace(/[-_\s]+/g, '');
      const cleanBase = baseFeatName.toLowerCase().replace(/[-_\s]+/g, '');

      const matchedFeat = catalogFeats.find(candidate => 
        candidate.name === featRef || 
        candidate.englishName === featRef ||
        candidate.id.toLowerCase() === featRef.toLowerCase() ||
        candidate.id.toLowerCase().replace(/[-_\s]+/g, '') === cleanRef ||
        (candidate.name && candidate.name.toLowerCase().replace(/[-_\s]+/g, '') === cleanRef) ||
        (candidate.englishName && candidate.englishName.toLowerCase().replace(/[-_\s]+/g, '') === cleanRef)
      ) || catalogFeats.find(candidate =>
        candidate.name === baseFeatName ||
        candidate.englishName === baseFeatName ||
        candidate.id.toLowerCase() === baseFeatName.toLowerCase() ||
        candidate.id.toLowerCase().replace(/[-_\s]+/g, '') === cleanBase ||
        (candidate.name && candidate.name.toLowerCase().replace(/[-_\s]+/g, '') === cleanBase) ||
        (candidate.englishName && candidate.englishName.toLowerCase().replace(/[-_\s]+/g, '') === cleanBase)
      );

      // 若有子变体，动态关联 Catalog 实体，严禁硬编码穷举字典
      let subVariantEn = '';
      if (subVariant) {
        const matchedClass = defaultCatalog.list('class').find(c => 
          c.name === subVariant || 
          c.id.toLowerCase() === subVariant.toLowerCase()
        );
        subVariantEn = matchedClass?.englishName || subVariant;
      }

      if (matchedFeat) {
        feat = {
          name: featRef,
          nameEn: subVariantEn 
            ? `${matchedFeat.englishName || baseFeatName} (${subVariantEn})` 
            : (matchedFeat.englishName || featRef),
          description: matchedFeat.description,
        };
      } else {
        feat = {
          name: typeof f === 'object' && f.name ? f.name : featRef,
          nameEn: typeof f === 'object' && f.ENG_name 
            ? f.ENG_name 
            : (subVariantEn ? `${baseFeatName} (${subVariantEn})` : featRef),
          description: typeof f === 'object' ? f.description : undefined,
        };
      }
    }
  }

  // 技能与工具熟练
  const skillProficiencies = parseProficiencies(raw.skillProficiencies || raw.skills, 'skill');
  const toolProficiencies = parseProficiencies(raw.toolProficiencies, 'tool');
  const languages = parseProficiencies(raw.languageProficiencies || raw.languages, 'language');
  
  const entriesList = Array.isArray(raw.entries) ? raw.entries : [];

  // 装备方案解析：
  let equipmentResult: Background['equipment'] = { choiceA: [] };

  // 1. 优先尝试从 5etools 原生 entries 中提取 2024 标准分案 (A) ... (B) ...（保留中文官方社群定稿语料，如 "赌具（任意）"、"2把匕首"）
  for (const entryItem of entriesList) {
    if (typeof entryItem === 'object' && entryItem !== null) {
      const items = Array.isArray(entryItem.items) ? entryItem.items : [];
      for (const item of items) {
        if (typeof item === 'object' && item !== null) {
          const isEquipment = item.name === '装备：' || item.name === '装备' || 
                              item.ENG_name === 'Equipment:' || item.ENG_name === 'Equipment';
          if (isEquipment && typeof item.entry === 'string') {
            const rawEqText = item.entry;
            const match2024 = rawEqText.match(REGEX_2024_SCHEME);
            if (match2024) {
              equipmentResult = parseEquipmentTextFallback(rawEqText);
              break;
            }
          }
        }
      }
      if (equipmentResult.choiceA && equipmentResult.choiceA.length > 0) break;
    }
  }

  // 2. 若非 2024 双案（即 2014 经典背景），优先使用 5etools 原生 startingEquipment AST 结构化节点解析
  const starting = Array.isArray(raw.startingEquipment) ? raw.startingEquipment : [];
  if ((!equipmentResult.choiceA || equipmentResult.choiceA.length === 0) && starting.length > 0) {
    equipmentResult = parseStartingEquipmentAst(starting, entry.name);
  }

  // 3. 兜底：若既无 2024 双案也无 startingEquipment，回退至从 entries 中解析 2014 单文本
  if (!equipmentResult.choiceA || equipmentResult.choiceA.length === 0) {
    for (const entryItem of entriesList) {
      if (typeof entryItem === 'object' && entryItem !== null) {
        const items = Array.isArray(entryItem.items) ? entryItem.items : [];
        for (const item of items) {
          if (typeof item === 'object' && item !== null) {
            const isEquipment = item.name === '装备：' || item.name === '装备' || 
                                item.ENG_name === 'Equipment:' || item.ENG_name === 'Equipment';
            if (isEquipment && typeof item.entry === 'string') {
              equipmentResult = parseEquipmentTextFallback(item.entry);
              break;
            }
          }
        }
        if (equipmentResult.choiceA && equipmentResult.choiceA.length > 0) break;
      }
    }
  }

  // 2014 经典背景特性提取
  let legacyFeature: Background['legacyFeature'] | undefined = raw.legacyFeature;
  if (!legacyFeature) {
    for (const entryItem of entriesList) {
      if (typeof entryItem === 'object' && entryItem !== null) {
        const entryName = entryItem.name || entryItem.ENG_name || '';
        const isFeature = Boolean(
          entryItem.data?.isFeature || 
          entryName.startsWith('特性：') || 
          entryName.startsWith('特性:') || 
          entryName.toLowerCase().startsWith('feature:') ||
          entryName.toLowerCase().startsWith('feature：')
        );
        if (isFeature) {
          const cleanName = entryName.replace(/^(特性[：:]\s*|Feature[：:]\s*)/i, '').trim();
          const cleanNameEn = (entryItem.ENG_name || '').replace(/^(Feature[：:]\s*)/i, '').trim();
          const desc = flattenEntries(entryItem.entries || (entryItem.entry ? [entryItem.entry] : []));
          legacyFeature = {
            name: cleanName || entryName,
            nameEn: cleanNameEn || cleanName || entryName,
            description: desc,
          };
          break;
        }
      }
    }
  }

  // 风味表格提取 (如特点、理念、牵挂、缺陷、手法、命定事件等)
  let flavorTables: FlavorTable[] | undefined = raw.flavorTables;
  if (!flavorTables) {
    const tables: FlavorTable[] = [];
    for (const entryItem of entriesList) {
      if (typeof entryItem === 'object' && entryItem !== null) {
        const subList = Array.isArray(entryItem.entries) ? entryItem.entries : [entryItem];
        for (const sub of subList) {
          if (sub && typeof sub === 'object' && sub.type === 'table') {
            const colLabels = sub.colLabels || [];
            const diceMatch = colLabels[0]?.match(/d(\d+)/i);
            const dice = diceMatch ? diceMatch[1] : (sub.rows?.length ? String(sub.rows.length) : undefined);
            
            // 提取第二列列名作为分类名 (如 "特点", "理念", "牵挂", "缺陷", "人格特质", "Personality Trait" 等)
            const colCategory = colLabels.length > 1 ? clean5eTags(String(colLabels[1])).trim() : '';
            
            // 如果父 entry 名字是泛指性的“建议人物特征”或“特征/特性”，优先使用第二列分类名
            const isGenericParent = entryItem.name && (
              entryItem.name.includes('特征') || 
              entryItem.name.includes('特性') || 
              entryItem.name.toLowerCase().includes('characteristic') ||
              entryItem.name.toLowerCase().includes('trait')
            );
            
            let tableName = sub.caption;
            if (!tableName && colCategory && (isGenericParent || subList.length > 1)) {
              tableName = colCategory;
            }
            if (!tableName) {
              tableName = colCategory || entryItem.name || '风味表格';
            }

            const rows = (sub.rows || []).map((row: any[], rIdx: number) => {
              const id = parseInt(row[0], 10) || (rIdx + 1);
              const content = clean5eTags(row[1] || row[0] || '');
              return { id, content };
            });
            if (rows.length > 0) {
              tables.push({
                name: clean5eTags(tableName),
                dice,
                rows,
              });
            }
          }
        }
      }
    }
    if (tables.length > 0) {
      flavorTables = tables;
    }
  }

  // 描述文本提取：优先取正版故事风味文本，排除单纯列出“属性值/专长/技能熟练”的规则清单
  let description = '';
  if (raw.fluff?.entries && raw.fluff.entries.length > 0) {
    description = flattenEntries(raw.fluff.entries);
  } else if (entry.description) {
    description = entry.description;
  }
  if (!description && entriesList.length > 0) {
    const textEntries = entriesList.filter((e: any) => {
      if (typeof e === 'string') return true;
      if (e.type === 'list' || e.data?.isFeature || (e.name && (e.name.includes('特性') || e.name.toLowerCase().includes('feature')))) return false;
      return true;
    });
    description = flattenEntries(textEntries);
  }

  return {
    id: entry.id,
    source: entry.source,
    name: entry.name,
    nameEn: entry.englishName || entry.name,
    description: description || '',
    variants: raw.variants,
    abilityScoreOptions: abilityScoreOptions.length > 0 ? abilityScoreOptions : raw.abilityScoreOptions,
    feat: feat || raw.feat,
    enforceRules: Boolean(raw.enforceRules ?? true),
    skillProficiencies,
    toolProficiencies,
    languages,
    equipment: raw.equipment || equipmentResult,
    legacyFeature,
    flavorTables,
    suggestedCharacteristics: raw.suggestedCharacteristics,
  } as Background;
}

/**
 * 获取 Catalog 中注册的所有背景
 * 合并策略：按英文原名/规范化标识去重，5etools 来源优先，Legacy 作为兜底
 */
export function getCatalogBackgrounds(options?: {
  edition?: Edition;
  source?: string;
}): Background[] {
  const entries = defaultCatalog.list('background', options);
  const backgrounds: Background[] = [];
  const seenKeys = new Set<string>();

  // 1. 优先放入 5etools / homebrew 条目
  for (const entry of entries) {
    if (entry.sourcePackId !== 'legacy') {
      const bg = catalogEntryToBackground(entry);
      const key = `${entry.source}:${(bg.nameEn || bg.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      seenKeys.add(key);
      backgrounds.push(bg);
    }
  }

  // 2. 补充放入 Legacy 条目
  for (const entry of entries) {
    if (entry.sourcePackId === 'legacy') {
      const bg = catalogEntryToBackground(entry);
      const key = `${entry.source}:${(bg.nameEn || bg.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        backgrounds.push(bg);
      }
    }
  }


  return backgrounds;
}


