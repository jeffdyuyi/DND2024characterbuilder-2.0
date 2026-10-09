import { describe, it, expect } from 'vitest';
import { defaultCatalog } from '../catalog';
import { normalizeBackground } from '@/source/fiveetools-cn/normalizers/background';
import { catalogEntryToBackground } from '../adapters/backgrounds';
import {
  getCatalogTools,
  getToolDisplayName,
  findCatalogTool,
  invalidateCatalogToolCache,
} from '../tools';
import { translateProficiency } from '@/engine/terminology';
import { resolveBackgroundEquipmentChoices } from '@/engine/backgroundEquipment';
import { computeProficiencies } from '@/engine/proficiency';
import { CharacterState } from '@/types/characterState';
import { Selection } from '@/types/species';

function registerTools() {
  for (const source of ['PHB', 'XPHB']) {
    defaultCatalog.register({
      id: `5etools-cn:baseitem:${source}:alchemists-supplies`,
      name: '炼金工具',
      englishName: "Alchemist's Supplies",
      source,
      kind: 'baseitem',
      sourcePackId: '5etools-cn',
      edition: source === 'PHB' ? '2014' : '2024',
      raw: { type: 'AT', ENG_name: "Alchemist's Supplies" },
    });
  }
  defaultCatalog.register({
    id: '5etools-cn:item:dmg:airship',
    name: '飞艇',
    englishName: 'Airship',
    source: 'DMG',
    kind: 'item',
    sourcePackId: '5etools-cn',
    edition: '2014',
    raw: { type: 'AIR', ENG_name: 'Airship' },
  });
  invalidateCatalogToolCache();
}

describe('背景显示与选择的关联回归', () => {
  it('中文风味装备不会因空匹配键变成载具，仍能查询合法工具', () => {
    registerTools();
    for (const text of [
      '一块可以令你回忆起家乡的小石头',
      '一块可以令你回忆起家乡的小树枝',
      '陌生中文描述',
      '…',
    ]) {
      expect(getToolDisplayName(text)).toBe(text);
      expect(translateProficiency(text)).toBe(text);
    }
    expect(getToolDisplayName("alchemist's supplies|phb")).toBe('炼金工具 [玩家手册]');
    expect(findCatalogTool('alchemists-supplies')?.category).toBe('Artisan');
  });

  it('候选不重复加入别名，正文 filter 的 PHB 限制保留，存档的工具选择进入引擎', () => {
    registerTools();
    expect(getCatalogTools('Artisan')).not.toContain('alchemists-supplies');
    expect(
      getCatalogTools('Artisan').filter((id) => id.startsWith("alchemist's supplies")),
    ).toHaveLength(2);
    const entry = normalizeBackground({
      name: '符文雕刻者',
      ENG_name: 'Rune Carver',
      source: 'BGG',
      toolProficiencies: [{ anyArtisansTool: 1 }],
      entries: [
        {
          type: 'list',
          items: [
            {
              name: '工具熟练：',
              entry: '一套{@filter 工匠工具|items|source=phb|miscellaneous=平凡的|type=工匠工具}',
            },
          ],
        },
      ],
    });
    defaultCatalog.register(entry);
    const bg = catalogEntryToBackground(entry);
    const options = (bg.toolProficiencies![0] as Selection<string>).options;
    expect(options).toContain("alchemist's supplies|phb");
    expect(options).not.toContain("alchemist's supplies|xphb");
    expect(options.every((id) => findCatalogTool(id)?.source === 'PHB')).toBe(true);
    const state = {
      classes: [],
      feats: [],
      baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      backgroundId: entry.id,
      backgroundSource: 'BGG',
      backgroundSelections: { [`bg:${entry.id}:prof:tool:0`]: ["alchemist's supplies|phb"] },
    } as unknown as CharacterState;
    expect(computeProficiencies(state).tools).toContainEqual({
      id: "alchemist's supplies|phb",
      sources: ['背景: 符文雕刻者'],
    });
  });

  it('背景书籍本身不构成工具来源限制', () => {
    registerTools();
    const bg = catalogEntryToBackground(
      normalizeBackground({
        name: '测试背景',
        source: 'BGG',
        toolProficiencies: [{ anyArtisansTool: 1 }],
      }),
    );
    const options = (bg.toolProficiencies![0] as Selection<string>).options;
    expect(options).toContain("alchemist's supplies|phb");
    expect(options).toContain("alchemist's supplies|xphb");
  });

  it('装备二选一读取页面实际存档键，保留原文及货币，切换后不同时发放两项', () => {
    const stone = '一块可以令你回忆起家乡的小石头';
    const twig = '一块可以令你回忆起家乡的小树枝';
    const bg = catalogEntryToBackground(
      normalizeBackground({
        name: '巨人养子',
        ENG_name: 'Giant Foundling',
        source: 'BGG',
        startingEquipment: [
          { _: ['背包|phb', '旅行服装|phb', { item: '小包|phb', containsValue: 1000 }] },
          { a: [{ special: stone }], b: [{ special: twig }] },
        ],
      }),
    );
    const choice = bg.equipment.choiceA[3] as Selection<string>;
    expect(choice.options).toEqual([stone, twig]);
    for (const selected of choice.options) {
      const records = resolveBackgroundEquipmentChoices(bg, {
        [`bg:${bg.id}:equip-choiceA-3`]: [selected],
      });
      expect(records.some((r) => r.label === selected && r.quantity === 1)).toBe(true);
      expect(records.some((r) => r.label === (selected === stone ? twig : stone))).toBe(false);
      expect(records.find((r) => r.kind === 'currency')?.currency).toEqual({ gp: 10 });
    }
  });

  it('fluff 与构建段落一起展示，递归提取嵌套表，机械规则与特性不重复加入简介', () => {
    const rows = Array.from({ length: 6 }, (_, i) => [String(i + 1), `原文饰品${i + 1}`]);
    const raw = {
      name: '索兰尼亚骑士',
      ENG_name: 'Knight of Solamnia',
      source: 'DSotDQ',
      fluff: { entries: ['背景简介。'] },
      entries: [
        { type: 'list', items: [{ name: '技能熟练项：', entry: '运动、求生' }] },
        { name: '特性：索兰尼亚侍从', data: { isFeature: true }, entries: ['特性原文。'] },
        {
          name: '构建索兰尼亚骑士',
          entries: [
            '完整的构建段落。',
            {
              name: '索兰尼亚骑士饰品',
              entries: [
                '饰品表的使用说明。',
                { type: 'table', caption: '索兰尼亚骑士饰品', colLabels: ['d6', '饰品'], rows },
              ],
            },
          ],
        },
      ],
    };
    const before = JSON.stringify(raw);
    const bg = catalogEntryToBackground(normalizeBackground(raw));
    expect(bg.description).toContain('背景简介。');
    expect(bg.description).toContain('完整的构建段落。');
    expect(bg.description).toContain('饰品表的使用说明。');
    expect(bg.description).not.toContain('运动、求生');
    expect(bg.description).not.toContain('特性原文。');
    expect(bg.description).not.toContain('原文饰品1');
    expect(bg.legacyFeature?.description).toBe('特性原文。');
    expect(bg.flavorTables).toHaveLength(1);
    expect(bg.flavorTables![0].rows).toEqual(
      rows.map(([id, content]) => ({ id: Number(id), content })),
    );
    expect(JSON.stringify(raw)).toBe(before);
  });

  it('复杂表格保留全部列及骰值，叙事列表与重复段落正常处理', () => {
    const bg = catalogEntryToBackground(
      normalizeBackground({
        name: '测试',
        source: 'TEST',
        fluff: { entries: ['相同简介'] },
        entries: [
          '相同简介',
          { type: 'list', items: ['正文列表'] },
          {
            name: '多列表',
            entries: [
              {
                type: 'table',
                colLabels: ['d6', '物品', '说明'],
                rows: [['1–3', '石头', '保留第三列']],
              },
            ],
          },
        ],
      }),
    );
    expect(bg.description.split('相同简介')).toHaveLength(2);
    expect(bg.description).toContain('正文列表');
    expect(bg.description).toContain('1–3');
    expect(bg.description).toContain('保留第三列');
  });
});
