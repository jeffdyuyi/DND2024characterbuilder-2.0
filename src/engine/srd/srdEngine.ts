// 5etools 官方资源查阅库引擎 (对标 DND-card-web-main)
// 支持 IndexedDB 本地缓存加速、全量 5etools 继承树解包、2024/2014 双轨过滤、职业多级特性关联与检索

import { createDefaultFiveEToolsSource } from '@/source/fiveetools-cn/client';
import { expandCopies, expandVersions, inheritSubrace, readableEntries, Raw } from './expand';

export type SrdKind =
  'race' | 'class' | 'feat' | 'feature' | 'background' | 'item' | 'spell' | 'rule' | 'condition';

export const SRD_KIND_LABELS: Record<SrdKind, string> = {
  race: '种族',
  class: '职业',
  feat: '专长',
  feature: '职业能力 & 选项',
  background: '背景',
  item: '物品',
  spell: '法术',
  rule: '术语汇编',
  condition: '异常状态',
};

export interface SrdEntry {
  id: string;
  kind: SrdKind;
  name: string;
  nameEn: string;
  source: string;
  edition: '2024' | '2014' | 'both';
  categoryLabel: string;
  subCategory?: string; // 核心分类 key，如 'core' | 'subclass'，或 'EI' | 'FS' | 'MM' | 'MV' | 'CF'
  subCategoryLabel?: string; // 中文分类：如 '核心职业', '分支子职', '魔能祈魂', '战斗风格', '超魔', '战技', '职业特性'
  parentClass?: string; // 所属职业（如 '野蛮人', '战士', '法师'）
  level?: number; // 需求等级或生效等级
  prerequisite?: string; // 先决条件说明
  type?: string;
  description?: string;
  entries: any[];
  raw: Raw;
}

const canonical = (s: unknown) =>
  String(s ?? '')
    .trim()
    .toLowerCase();

export function makeSrdIdentity(kind: SrdKind, raw: Raw, packId = '5etools'): string {
  return [
    packId,
    kind,
    raw.source,
    raw.ENG_name || raw.name,
    raw.className,
    raw.subclassShortName,
    raw.level !== undefined ? String(raw.level) : undefined,
    raw.raceName,
    raw._category,
    raw._variantIdentity,
  ]
    .filter((v) => v !== undefined && v !== '')
    .map(canonical)
    .map(encodeURIComponent)
    .join(':');
}

export function detectEdition(source: string, raw: Raw = {}): '2024' | '2014' | 'both' {
  const s = String(source || raw.source || '')
    .toUpperCase()
    .trim();
  if (
    raw.edition === 'one' ||
    ['XPHB', 'XDMG', 'XMM', 'SRD52', '5R'].includes(s) ||
    s.includes('2024')
  ) {
    return '2024';
  }
  if (
    raw.edition === 'classic' ||
    [
      'PHB',
      'DMG',
      'MM',
      'SCAG',
      'VGM',
      'XGE',
      'MTF',
      'ERLW',
      'EGW',
      'MOT',
      'TCE',
      'VRGR',
      'WBTW',
      'FTD',
      'SCC',
      'MPMM',
      'AAG',
      'BAM',
      'SJA',
      'DSOTC',
      'BMT',
      'PAIT',
    ].includes(s)
  ) {
    return '2014';
  }
  return 'both';
}

function extractDescription(entries: any[]): string {
  if (!entries || !Array.isArray(entries)) return '';
  const texts: string[] = [];
  for (const item of entries) {
    if (typeof item === 'string') {
      texts.push(item);
    } else if (item && typeof item === 'object') {
      if (item.name && item.entries) {
        texts.push(`${item.name}：${extractDescription(item.entries)}`);
      } else if (item.entries) {
        texts.push(extractDescription(item.entries));
      }
    }
    if (texts.length >= 2) break;
  }
  return texts.join(' ').slice(0, 160);
}

function formatSpellType(s: Raw): string {
  const levelStr = s.level === 0 ? '戏法' : `${s.level}环`;
  const schoolStr = s.school ? `${s.school}系` : '';
  const timeStr = s.time?.[0]?.unit || '1 动作';
  return `${levelStr} ${schoolStr} · ${timeStr}`;
}

function formatItemType(i: Raw): string {
  const rarity = i.rarity || '普通';
  const type = i.type || '奇物';
  const attune = i.reqAttune ? ' (需同调)' : '';
  return `${rarity} · ${type}${attune}`;
}

/** 将 featureType 映射为友好的中文分类和所属职业提示 */
function parseFeatureType(featTypes?: string[]): {
  subCategory: string;
  subCategoryLabel: string;
  parentClass?: string;
} {
  if (!featTypes || !featTypes.length) {
    return { subCategory: 'OF', subCategoryLabel: '自选特性' };
  }
  const primary = String(featTypes[0]);
  if (primary === 'EI')
    return { subCategory: 'EI', subCategoryLabel: '魔能祈魂', parentClass: '邪术师' };
  if (primary.startsWith('FS')) {
    let pClass = '战士';
    if (primary.includes('P')) pClass = '圣骑士';
    else if (primary.includes('R')) pClass = '游侠';
    return { subCategory: 'FS', subCategoryLabel: '战斗风格', parentClass: pClass };
  }
  if (primary === 'MM')
    return { subCategory: 'MM', subCategoryLabel: '超魔选项', parentClass: '术士' };
  if (primary.startsWith('MV'))
    return { subCategory: 'MV', subCategoryLabel: '战斗大师战技', parentClass: '战士' };
  if (primary === 'PB')
    return { subCategory: 'PB', subCategoryLabel: '契约恩泽', parentClass: '邪术师' };
  if (primary === 'AS') return { subCategory: 'AS', subCategoryLabel: '额外法术' };
  if (primary === 'AI')
    return { subCategory: 'AI', subCategoryLabel: '魔导奇械', parentClass: '奇械师' };

  return { subCategory: 'OF', subCategoryLabel: '可选特性' };
}

class SrdEngineService {
  private entriesByKind = new Map<SrdKind, SrdEntry[]>();
  private loadedKinds = new Set<SrdKind>();
  private loadingPromises = new Map<SrdKind, Promise<SrdEntry[]>>();
  private client = createDefaultFiveEToolsSource();

  /** 全局特性字典，用于根据文本引用快速反查对应具体特性 */
  private featureRegistry = new Map<string, SrdEntry>();
  private classFeaturesList: SrdEntry[] = [];

  /** 获取特定分类的条目 */
  public async getEntries(
    kind: SrdKind,
    options?: { signal?: AbortSignal; refresh?: boolean },
  ): Promise<SrdEntry[]> {
    if (this.entriesByKind.has(kind)) {
      return this.entriesByKind.get(kind)!;
    }
    if (this.loadingPromises.has(kind)) {
      return this.loadingPromises.get(kind)!;
    }

    const loadTask = this.loadKindData(kind, options);
    this.loadingPromises.set(kind, loadTask);

    try {
      const result = await loadTask;
      this.entriesByKind.set(kind, result);
      this.loadedKinds.add(kind);
      return result;
    } finally {
      this.loadingPromises.delete(kind);
    }
  }

  /** 根据引用（如 '狂暴|野蛮人|XPHB|1' 或 '神圣打击|圣骑士'）反查具体特性 */
  public resolveFeature(ref: string): SrdEntry | undefined {
    if (!ref) return undefined;
    const clean = ref.trim().toLowerCase();
    if (this.featureRegistry.has(clean)) {
      return this.featureRegistry.get(clean);
    }
    const nameOnly = clean.split('|')[0];
    if (this.featureRegistry.has(nameOnly)) {
      return this.featureRegistry.get(nameOnly);
    }
    // 模糊匹配
    for (const [key, entry] of this.featureRegistry.entries()) {
      if (key.includes(nameOnly)) {
        return entry;
      }
    }
    return undefined;
  }

  /** 获取所有已知职业名称列表（用于前端下拉/筛选） */
  public async getAvailableClasses(): Promise<string[]> {
    const classEntries = await this.getEntries('class');
    const set = new Set<string>();
    for (const c of classEntries) {
      if (c.parentClass) set.add(c.parentClass);
      else if (c.name) set.add(c.name.split(':')[0].trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
  }

  private registerFeatureRef(entry: SrdEntry) {
    const keys = [
      entry.name.toLowerCase(),
      entry.nameEn.toLowerCase(),
      `${entry.parentClass || ''}|${entry.name}`.toLowerCase(),
      `${entry.name}|${entry.parentClass || ''}`.toLowerCase(),
      `${entry.name}|${entry.parentClass || ''}|${entry.source}|${entry.level || 1}`.toLowerCase(),
      `${entry.nameEn}|${entry.parentClass || ''}|${entry.source}|${entry.level || 1}`.toLowerCase(),
    ];
    for (const k of keys) {
      if (k) this.featureRegistry.set(k, entry);
    }
  }

  private async loadClassBundle(options?: { signal?: AbortSignal; refresh?: boolean }): Promise<{
    classes: SrdEntry[];
    subclasses: SrdEntry[];
    classFeatures: SrdEntry[];
  }> {
    const classEntries: SrdEntry[] = [];
    const subEntries: SrdEntry[] = [];
    const featureEntries: SrdEntry[] = [];

    try {
      const fileNames = await this.client.listIndexedFiles('data/class/index.json', options);

      for (const fn of fileNames) {
        try {
          const res = await this.client.fetchJson<{
            class?: Raw[];
            subclass?: Raw[];
            classFeature?: Raw[];
            subclassFeature?: Raw[];
          }>(`data/class/${fn}`, options);

          const rawClassFeatures = expandCopies(res.body.classFeature || []);
          const rawSubclassFeatures = expandCopies(res.body.subclassFeature || []);

          // 1. 注册所有的 classFeature
          const featuresByClass = new Map<string, SrdEntry[]>();
          for (const cf of rawClassFeatures) {
            const src = String(cf.source || cf.classSource || 'PHB').toUpperCase();
            const ed = detectEdition(src, cf);
            const entries = readableEntries(cf, 'classFeature');
            const entry: SrdEntry = {
              id: makeSrdIdentity('feature', { ...cf, source: src, _category: 'classFeature' }),
              kind: 'feature',
              name: cf.name,
              nameEn: cf.ENG_name || cf.name,
              source: src,
              edition: ed,
              categoryLabel: '职业特性',
              subCategory: 'CF',
              subCategoryLabel: '核心职业特性',
              parentClass: cf.className,
              level: Number(cf.level) || 1,
              type: `${cf.className} 第 ${cf.level || 1} 级特性`,
              description: extractDescription(entries),
              entries,
              raw: cf,
            };
            featureEntries.push(entry);
            this.registerFeatureRef(entry);

            const cKey = `${cf.className}|${src}`.toLowerCase();
            if (!featuresByClass.has(cKey)) featuresByClass.set(cKey, []);
            featuresByClass.get(cKey)!.push(entry);
          }

          // 2. 注册所有的 subclassFeature
          const featuresBySubclass = new Map<string, SrdEntry[]>();
          for (const scf of rawSubclassFeatures) {
            const src = String(scf.source || scf.subclassSource || 'PHB').toUpperCase();
            const ed = detectEdition(src, scf);
            const entries = readableEntries(scf, 'subclassFeature');
            const entry: SrdEntry = {
              id: makeSrdIdentity('feature', { ...scf, source: src, _category: 'subclassFeature' }),
              kind: 'feature',
              name: scf.name,
              nameEn: scf.ENG_name || scf.name,
              source: src,
              edition: ed,
              categoryLabel: '子职特性',
              subCategory: 'CF',
              subCategoryLabel: '子职分支特性',
              parentClass: scf.className,
              level: Number(scf.level) || 3,
              type: `${scf.className} (${scf.subclassShortName || ''}) 第 ${scf.level || 3} 级特性`,
              description: extractDescription(entries),
              entries,
              raw: scf,
            };
            featureEntries.push(entry);
            this.registerFeatureRef(entry);

            const scKey = `${scf.className}|${scf.subclassShortName || ''}|${src}`.toLowerCase();
            if (!featuresBySubclass.has(scKey)) featuresBySubclass.set(scKey, []);
            featuresBySubclass.get(scKey)!.push(entry);
          }

          // 3. 构建职业，将对应的 classFeatures 按等级结构化组合进正文
          for (const cls of res.body.class || []) {
            const src = String(cls.source || 'PHB').toUpperCase();
            const ed = detectEdition(src, cls);
            const baseEntries = readableEntries(cls, 'class');

            // 提取该职业的所有等级特性
            const cKey = `${cls.name}|${src}`.toLowerCase();
            const relatedFeatures = (featuresByClass.get(cKey) || []).sort(
              (a, b) => (a.level || 0) - (b.level || 0),
            );

            // 构造层次化等级特性章节
            const levelSections: any[] = [];
            const featuresByLevel = new Map<number, SrdEntry[]>();
            for (const f of relatedFeatures) {
              const lvl = f.level || 1;
              if (!featuresByLevel.has(lvl)) featuresByLevel.set(lvl, []);
              featuresByLevel.get(lvl)!.push(f);
            }

            for (let lvl = 1; lvl <= 20; lvl++) {
              const list = featuresByLevel.get(lvl);
              if (list && list.length > 0) {
                levelSections.push({
                  type: 'section',
                  name: `第 ${lvl} 级特性`,
                  entries: list.map((f) => ({
                    type: 'entries',
                    name: f.name,
                    ENG_name: f.nameEn,
                    entries: f.entries,
                  })),
                });
              }
            }

            const assembledEntries = [
              ...baseEntries,
              ...(levelSections.length > 0
                ? [
                    {
                      type: 'section',
                      name: '职业等级特性详述',
                      entries: levelSections,
                    },
                  ]
                : []),
            ];

            classEntries.push({
              id: makeSrdIdentity('class', { ...cls, source: src, _category: 'class' }),
              kind: 'class',
              name: cls.name,
              nameEn: cls.ENG_name || cls.name,
              source: src,
              edition: ed,
              categoryLabel: '核心职业',
              subCategory: 'core',
              subCategoryLabel: '核心职业',
              parentClass: cls.name,
              type: `生命骰 d${cls.hd?.faces || 8} · 主属性 ${cls.spellcastingAbility || '战力'}`,
              description: extractDescription(baseEntries),
              entries: assembledEntries,
              raw: cls,
            });
          }

          // 4. 构建子职，将对应的 subclassFeatures 按等级结构化组合进正文
          for (const sub of res.body.subclass || []) {
            const src = String(sub.source || sub.classSource || 'PHB').toUpperCase();
            const ed = detectEdition(src, sub);
            const baseEntries = readableEntries(sub, 'subclass');

            const scKey = `${sub.className}|${sub.shortName || sub.name}|${src}`.toLowerCase();
            const relatedFeatures = (featuresBySubclass.get(scKey) || []).sort(
              (a, b) => (a.level || 0) - (b.level || 0),
            );

            const levelSections: any[] = [];
            const featuresByLevel = new Map<number, SrdEntry[]>();
            for (const f of relatedFeatures) {
              const lvl = f.level || 3;
              if (!featuresByLevel.has(lvl)) featuresByLevel.set(lvl, []);
              featuresByLevel.get(lvl)!.push(f);
            }

            for (const [lvl, list] of featuresByLevel.entries()) {
              levelSections.push({
                type: 'section',
                name: `第 ${lvl} 级子职特性`,
                entries: list.map((f) => ({
                  type: 'entries',
                  name: f.name,
                  ENG_name: f.nameEn,
                  entries: f.entries,
                })),
              });
            }

            const assembledEntries = [
              ...baseEntries,
              ...(levelSections.length > 0
                ? [
                    {
                      type: 'section',
                      name: '子职特性详述',
                      entries: levelSections,
                    },
                  ]
                : []),
            ];

            subEntries.push({
              id: makeSrdIdentity('class', { ...sub, source: src, _category: 'subclass' }),
              kind: 'class',
              name: `${sub.className}: ${sub.name}`,
              nameEn: `${sub.className}: ${sub.ENG_name || sub.name}`,
              source: src,
              edition: ed,
              categoryLabel: '分支子职',
              subCategory: 'subclass',
              subCategoryLabel: '分支子职',
              parentClass: sub.className,
              type: `属于 ${sub.className}`,
              description: extractDescription(baseEntries),
              entries: assembledEntries,
              raw: sub,
            });
          }
        } catch {
          // 忽略单个 class 文件解析错误
        }
      }
    } catch (e) {
      console.warn('[SrdEngine] 加载 class 索引失败:', e);
    }

    this.classFeaturesList = featureEntries;
    return { classes: classEntries, subclasses: subEntries, classFeatures: featureEntries };
  }

  private async loadKindData(
    kind: SrdKind,
    options?: { signal?: AbortSignal; refresh?: boolean },
  ): Promise<SrdEntry[]> {
    const results: SrdEntry[] = [];

    switch (kind) {
      case 'race': {
        try {
          const res = await this.client.fetchJson<{ race?: Raw[]; subrace?: Raw[] }>(
            'data/races.json',
            options,
          );
          const rawRaces = expandCopies(res.body.race || []);
          const rawSubraces = expandCopies(res.body.subrace || []);

          for (const raw of rawRaces) {
            for (const r of [raw, ...expandVersions(raw)]) {
              const src = String(r.source || 'PHB').toUpperCase();
              const ed = detectEdition(src, r);
              const entries = readableEntries(r, 'race');
              results.push({
                id: makeSrdIdentity('race', { ...r, source: src, _category: 'race' }),
                kind: 'race',
                name: r.name,
                nameEn: r.ENG_name || r.name,
                source: src,
                edition: ed,
                categoryLabel: '种族',
                subCategory: 'main',
                subCategoryLabel: '核心种族',
                type: `体型 ${r.size?.[0] || 'M'} · 移速 ${typeof r.speed === 'object' ? r.speed.walk || 30 : r.speed || 30} 尺`,
                description: extractDescription(entries),
                entries,
                raw: r,
              });
            }
          }

          for (const sub of rawSubraces) {
            const inherited = inheritSubrace(sub, rawRaces);
            const src = String(inherited.source || 'PHB').toUpperCase();
            const ed = detectEdition(src, inherited);
            const entries = readableEntries(inherited, 'subrace');
            results.push({
              id: makeSrdIdentity('race', { ...inherited, source: src, _category: 'subrace' }),
              kind: 'race',
              name: inherited.name,
              nameEn: inherited.ENG_name || inherited.name,
              source: src,
              edition: ed,
              categoryLabel: '亚种',
              subCategory: 'subrace',
              subCategoryLabel: '分支血系/亚种',
              type: `亚种 · 主种族: ${inherited.raceName || ''}`,
              description: extractDescription(entries),
              entries,
              raw: inherited,
            });
          }
        } catch (e) {
          console.warn('[SrdEngine] 加载 races 失败:', e);
        }
        break;
      }

      case 'class': {
        const bundle = await this.loadClassBundle(options);
        results.push(...bundle.classes, ...bundle.subclasses);
        break;
      }

      case 'feature': {
        // 先确保职业核心特性已载入
        if (!this.classFeaturesList.length) {
          await this.loadClassBundle(options);
        }
        // 加入所有职业核心特性与子职特性
        results.push(...this.classFeaturesList);

        // 加载可选特性（如魔能祈魂、战斗风格、超魔、战技等）
        try {
          const res = await this.client.fetchJson<{ optionalfeature?: Raw[] }>(
            'data/optionalfeatures.json',
            options,
          );
          const rawOpts = expandCopies(res.body.optionalfeature || []);
          for (const f of rawOpts) {
            const src = String(f.source || 'PHB').toUpperCase();
            const ed = detectEdition(src, f);
            const entries = readableEntries(f, 'optionalfeature');
            const meta = parseFeatureType(f.featureType);

            // 提取先决条件
            let prereq = '';
            if (f.prerequisite && Array.isArray(f.prerequisite)) {
              prereq = f.prerequisite
                .map((p: any) => (typeof p === 'string' ? p : p.spell ? `法术：${p.spell}` : ''))
                .filter(Boolean)
                .join('；');
            }

            const entry: SrdEntry = {
              id: makeSrdIdentity('feature', { ...f, source: src, _category: 'optionalfeature' }),
              kind: 'feature',
              name: f.name,
              nameEn: f.ENG_name || f.name,
              source: src,
              edition: ed,
              categoryLabel: meta.subCategoryLabel,
              subCategory: meta.subCategory,
              subCategoryLabel: meta.subCategoryLabel,
              parentClass: meta.parentClass,
              prerequisite: prereq || undefined,
              type: meta.parentClass
                ? `${meta.subCategoryLabel} (${meta.parentClass})`
                : meta.subCategoryLabel,
              description: extractDescription(entries),
              entries,
              raw: f,
            };
            results.push(entry);
            this.registerFeatureRef(entry);
          }
        } catch (e) {
          console.warn('[SrdEngine] 加载 optionalfeatures 失败:', e);
        }
        break;
      }

      case 'feat': {
        try {
          const res = await this.client.fetchJson<{ feat?: Raw[] }>('data/feats.json', options);
          const rawFeats = expandCopies(res.body.feat || []);
          for (const f of rawFeats) {
            const src = String(f.source || 'PHB').toUpperCase();
            const ed = detectEdition(src, f);
            const entries = readableEntries(f, 'feat');
            results.push({
              id: makeSrdIdentity('feat', { ...f, source: src, _category: 'feat' }),
              kind: 'feat',
              name: f.name,
              nameEn: f.ENG_name || f.name,
              source: src,
              edition: ed,
              categoryLabel: '专长',
              subCategory: f.category || 'general',
              subCategoryLabel: f.category ? `${f.category} 专长` : '通用专长',
              type: f.category ? `${f.category} 专长` : '通用专长',
              description: extractDescription(entries),
              entries,
              raw: f,
            });
          }
        } catch (e) {
          console.warn('[SrdEngine] 加载 feats 失败:', e);
        }
        break;
      }

      case 'background': {
        try {
          const res = await this.client.fetchJson<{ background?: Raw[] }>(
            'data/backgrounds.json',
            options,
          );
          const rawBgs = expandCopies(res.body.background || []);
          for (const b of rawBgs) {
            const src = String(b.source || 'PHB').toUpperCase();
            const ed = detectEdition(src, b);
            const entries = readableEntries(b, 'background');
            results.push({
              id: makeSrdIdentity('background', { ...b, source: src, _category: 'background' }),
              kind: 'background',
              name: b.name,
              nameEn: b.ENG_name || b.name,
              source: src,
              edition: ed,
              categoryLabel: '背景',
              type: '角色背景',
              description: extractDescription(entries),
              entries,
              raw: b,
            });
          }
        } catch (e) {
          console.warn('[SrdEngine] 加载 backgrounds 失败:', e);
        }
        break;
      }

      case 'spell': {
        try {
          const fileNames = await this.client.listIndexedFiles('data/spells/index.json', options);
          for (const fn of fileNames) {
            try {
              const res = await this.client.fetchJson<{ spell?: Raw[] }>(
                `data/spells/${fn}`,
                options,
              );
              const rawSpells = expandCopies(res.body.spell || []);
              for (const s of rawSpells) {
                const src = String(s.source || 'PHB').toUpperCase();
                const ed = detectEdition(src, s);
                const entries = readableEntries(s, 'spell');
                results.push({
                  id: makeSrdIdentity('spell', { ...s, source: src, _category: 'spell' }),
                  kind: 'spell',
                  name: s.name,
                  nameEn: s.ENG_name || s.name,
                  source: src,
                  edition: ed,
                  categoryLabel: '法术',
                  type: formatSpellType(s),
                  description: extractDescription(entries),
                  entries,
                  raw: s,
                });
              }
            } catch {
              // 忽略单个分卷错误
            }
          }
        } catch (e) {
          console.warn('[SrdEngine] 加载 spells 失败:', e);
        }
        break;
      }

      case 'item': {
        try {
          const [baseRes, itemRes] = await Promise.allSettled([
            this.client.fetchJson<{ baseitem?: Raw[]; item?: Raw[] }>(
              'data/items-base.json',
              options,
            ),
            this.client.fetchJson<{ item?: Raw[] }>('data/items.json', options),
          ]);
          const baseItems = baseRes.status === 'fulfilled' ? baseRes.value.body.baseitem || [] : [];
          const customItems = itemRes.status === 'fulfilled' ? itemRes.value.body.item || [] : [];
          const allRawItems = expandCopies([...baseItems, ...customItems]);

          for (const i of allRawItems) {
            const src = String(i.source || 'PHB').toUpperCase();
            const ed = detectEdition(src, i);
            const entries = readableEntries(i, 'item');
            results.push({
              id: makeSrdIdentity('item', { ...i, source: src, _category: 'item' }),
              kind: 'item',
              name: i.name,
              nameEn: i.ENG_name || i.name,
              source: src,
              edition: ed,
              categoryLabel: '物品',
              type: formatItemType(i),
              description: extractDescription(entries),
              entries,
              raw: i,
            });
          }
        } catch (e) {
          console.warn('[SrdEngine] 加载 items 失败:', e);
        }
        break;
      }

      case 'condition': {
        try {
          const res = await this.client.fetchJson<{
            condition?: Raw[];
            status?: Raw[];
            disease?: Raw[];
          }>('data/conditionsdiseases.json', options);
          const list = [
            ...(res.body.condition || []).map((c) => ({ ...c, _cat: '状态' })),
            ...(res.body.status || []).map((c) => ({ ...c, _cat: '异常' })),
            ...(res.body.disease || []).map((c) => ({ ...c, _cat: '疾病' })),
          ];
          for (const c of expandCopies(list)) {
            const src = String(c.source || 'PHB').toUpperCase();
            const ed = detectEdition(src, c);
            const entries = readableEntries(c, 'condition');
            results.push({
              id: makeSrdIdentity('condition', { ...c, source: src, _category: 'condition' }),
              kind: 'condition',
              name: c.name,
              nameEn: c.ENG_name || c.name,
              source: src,
              edition: ed,
              categoryLabel: '异常状态',
              type: c._cat || '异常状态',
              description: extractDescription(entries),
              entries,
              raw: c,
            });
          }
        } catch (e) {
          console.warn('[SrdEngine] 加载 conditions 失败:', e);
        }
        break;
      }

      case 'rule': {
        try {
          const [varRules, actions, senses, languages] = await Promise.allSettled([
            this.client.fetchJson<{ variantrule?: Raw[] }>('data/variantrules.json', options),
            this.client.fetchJson<{ action?: Raw[] }>('data/actions.json', options),
            this.client.fetchJson<{ sense?: Raw[] }>('data/senses.json', options),
            this.client.fetchJson<{ language?: Raw[] }>('data/languages.json', options),
          ]);

          const list: { raw: Raw; category: string }[] = [];
          if (varRules.status === 'fulfilled') {
            for (const r of varRules.value.body.variantrule || [])
              list.push({ raw: r, category: '变体规则' });
          }
          if (actions.status === 'fulfilled') {
            for (const a of actions.value.body.action || [])
              list.push({ raw: a, category: '动作' });
          }
          if (senses.status === 'fulfilled') {
            for (const s of senses.value.body.sense || []) list.push({ raw: s, category: '感官' });
          }
          if (languages.status === 'fulfilled') {
            for (const l of languages.value.body.language || [])
              list.push({ raw: l, category: '语言' });
          }

          for (const item of list) {
            const r = item.raw;
            const src = String(r.source || 'PHB').toUpperCase();
            const ed = detectEdition(src, r);
            const entries = readableEntries(r, 'rule');
            results.push({
              id: makeSrdIdentity('rule', { ...r, source: src, _category: 'rule' }),
              kind: 'rule',
              name: r.name,
              nameEn: r.ENG_name || r.name,
              source: src,
              edition: ed,
              categoryLabel: item.category,
              type: item.category,
              description: extractDescription(entries),
              entries,
              raw: r,
            });
          }
        } catch (e) {
          console.warn('[SrdEngine] 加载 rules 失败:', e);
        }
        break;
      }
    }

    return results;
  }
}

export const srdEngine = new SrdEngineService();
