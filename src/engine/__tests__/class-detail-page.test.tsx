import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass, normalizeSubclass } from '@/source/fiveetools-cn/normalizers/class';
import { createBuilderChoices } from '@/catalog/builderChoices';
import type { CharacterState } from '@/types/characterState';
import type { CatalogEntry } from '@/catalog/types';

const store = vi.hoisted(() => ({ character: {} as CharacterState, update: vi.fn() }));
vi.mock('react', async (load) => {
  const actual = await load<typeof import('react')>();
  return {
    ...actual,
    useMemo: (fn: () => unknown) => fn(),
    useState: (value: unknown) => [value, vi.fn()],
    useRef: () => ({ current: null }),
    useEffect: vi.fn(),
  };
});
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('id=test') }));
vi.mock('@/platform/useBuilderChoices', () => ({
  useBuilderChoices: () => createBuilderChoices({}),
}));
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({
    characters: { test: store.character },
    updateActiveCharacter: store.update,
    loadCharacter: vi.fn(),
  }),
}));
import ClassDetailPage from '@/app/builder/class-detail/page';
import ChoiceFilterList from '@/components/ChoiceFilterList';
import SubclassChoice from '@/components/SubclassChoice';
import { normalizeItem } from '@/source/fiveetools-cn/normalizers/item';
import ClassFeatureGuidance from '@/components/ClassFeatureGuidance';
import MarkdownText from '@/components/MarkdownText';
import { buildCharacterFeatSlots } from '../featSlots';
import { getClassDefinition } from '../characterData';
import { computeProficiencies } from '../proficiency';

function nodes(node: any): any[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (node.type === ChoiceFilterList) return [node, ...nodes(ChoiceFilterList(node.props))];
  return [node, ...nodes(node.props?.children)];
}
const parent = normalizeClass({
  name: '页面法师',
  ENG_name: 'Page Wizard',
  source: 'XPHB',
  classFeatures: ['施法|Page Wizard|XPHB|1', '属性值提升|Page Wizard|XPHB|4'],
});
const child = normalizeSubclass({
  name: '页面学派',
  ENG_name: 'Page School',
  shortName: 'Page',
  source: 'XPHB',
  className: 'Page Wizard',
  classSource: 'XPHB',
  subclassFeatures: ['学派介绍|Page Wizard|XPHB|Page|XPHB|3'],
});
function feature(name: string, level: number, entries: unknown[], subclass = false): CatalogEntry {
  return {
    ...parent,
    id: `page-test:${name}`,
    kind: subclass ? 'subclassFeature' : 'classFeature',
    name,
    englishName: name,
    raw: {
      name,
      className: 'Page Wizard',
      classSource: 'XPHB',
      source: 'XPHB',
      level,
      ...(subclass ? { subclassShortName: 'Page', subclassSource: 'XPHB' } : {}),
      entries,
    },
  };
}
beforeEach(() => {
  defaultCatalog.registerMany([
    parent,
    child,
    feature('施法', 1, ['选择初始法术。你的法术豁免DC使用智力。']),
    feature('属性值提升', 4, ['你获得属性值提升专长或其他符合条件的专长。']),
    feature(
      '学派介绍',
      3,
      [
        '完整学派说明。',
        { type: 'refSubclassFeature', subclassFeature: '学派能力|Page Wizard|XPHB|Page|XPHB|3' },
      ],
      true,
    ),
    feature('学派能力', 3, ['完整同等级能力正文。'], true),
  ]);
  store.update.mockClear();
  store.character = {
    id: 'test',
    classes: [{ classId: parent.id, level: 1 }],
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    selectedFeats: [],
    selectedSkills: [],
    selectedLanguages: [],
    inventoryEntries: [],
    equipmentIds: [],
    classSelections: {},
    speciesSelections: {},
    resourceUsage: {},
  } as unknown as CharacterState;
});

it('未解锁不显示子职业；解锁后在等级卡中选择稳定ID，重开后显示完整嵌套能力和配置引导', () => {
  let tree = nodes(ClassDetailPage());
  expect(tree.filter((node) => node.type === SubclassChoice)).toHaveLength(0);
  expect(
    tree.filter((node) => node.type === ClassFeatureGuidance).map((node) => node.props.page),
  ).toEqual(['spells']);
  store.character.classes[0].level = 3;
  tree = nodes(ClassDetailPage());
  const selector = tree.find((node) => node.type === SubclassChoice);
  expect(selector.props.level).toBe(3);
  expect(selector.props.options[0].source).toBe('XPHB');
  selector.props.onSelect(child.id);
  expect(store.update).toHaveBeenCalledWith({
    classes: [expect.objectContaining({ subclassId: child.id })],
  });
  store.character = JSON.parse(
    JSON.stringify({
      ...store.character,
      classes: [{ ...store.character.classes[0], level: 4, subclassId: child.id }],
    }),
  );
  tree = nodes(ClassDetailPage());
  expect(tree.filter((node) => node.type === SubclassChoice)).toHaveLength(1);
  expect(
    tree.filter((node) => node.type === MarkdownText).map((node) => node.props.text),
  ).toContain('完整同等级能力正文。');
  expect(
    tree.filter((node) => node.type === ClassFeatureGuidance).map((node) => node.props.page),
  ).toEqual(['spells', 'feats']);
  expect(buildCharacterFeatSlots(store.character, { getClass: getClassDefinition })).toHaveLength(
    1,
  );
});

it('原生子职业解锁说明与选项同框且说明只显示一次', () => {
  defaultCatalog.registerMany([
    {
      ...parent,
      raw: {
        ...parent.raw,
        classFeatures: [
          '施法|Page Wizard|XPHB|1',
          { classFeature: '法师学派|Page Wizard|XPHB|3', gainSubclassFeature: true },
        ],
      },
    },
    feature('法师学派', 3, ['原生子职业解锁说明。']),
  ]);
  store.character.classes[0].level = 3;
  const tree = nodes(ClassDetailPage());
  const selector = tree.find((node) => node.type === SubclassChoice);
  expect(selector.props.description).toContain('原生子职业解锁说明。');
  expect(tree.filter((node) => node.type === SubclassChoice)).toHaveLength(1);
  expect(
    tree.filter(
      (node) => node.type === MarkdownText && node.props.text === selector.props.description,
    ),
  ).toHaveLength(0);
});

it('基础熟练移除后不再计入专精完成度，重新选择时释放失效占位', () => {
  defaultCatalog.registerMany([
    { ...parent, raw: { ...parent.raw, classFeatures: ['专精|Page Wizard|XPHB|2'] } },
    feature('专精', 2, ['你获得两项由你选择的你已熟练的技能的专精。']),
  ]);
  store.character.classes[0].level = 2;
  store.character.proficiencies = { skills: ['history', 'performance'] } as any;
  const def = getClassDefinition(parent.id)!;
  const trait = def.features.find((item) =>
    item.mechanics?.choices?.some((choice) => choice.type === 'expertise'),
  )!;
  const choice = trait.mechanics!.choices!.find((item) => item.type === 'expertise')!;
  const key = 'cls:' + parent.id + ':feat:' + trait.name + ':' + choice.id;
  store.character.classSelections = { [key]: ['arcana', 'history'] };
  const tree = nodes(ClassDetailPage());
  const counts = tree.filter((item) => item.type === 'div').map((item) => item.props.children);
  expect(counts.some((value) => Array.isArray(value) && value.join('') === '已选 1/2')).toBe(true);
  const option = tree.find(
    (item) =>
      typeof item.props?.onClick === 'function' && item.props.children?.[0] === '表演（魅力）',
  );
  expect(option).toBeDefined();
  option.props.onClick();
  expect(store.update).toHaveBeenCalledWith(
    expect.objectContaining({
      classSelections: { [key]: ['history', 'performance'] },
    }),
  );
});

it('武器精通按原生武器身份限制已有熟练，呈现原文名称和出处', () => {
  defaultCatalog.registerMany([
    {
      ...parent,
      raw: {
        ...parent.raw,
        startingProficiencies: { weapons: ['测试细刃|TST'] },
        classFeatures: ['武器精通|Page Wizard|XPHB|1'],
      },
    },
    feature('武器精通', 1, ['你可以运用一种你熟练武器的精通词条。']),
    normalizeItem({
      name: '测试细刃',
      ENG_name: 'Fixture Blade',
      source: 'TST',
      type: 'M',
      weaponCategory: 'simple',
    }),
    normalizeItem({
      name: '未熟练细刃',
      ENG_name: 'Untrained Blade',
      source: 'TST',
      type: 'M',
      weaponCategory: 'martial',
    }),
  ]);
  const tree = nodes(ClassDetailPage());
  const options = tree.filter((node) => typeof node.props?.onClick === 'function');
  const weapon = options.find((node) => node.props.children?.[0] === '测试细刃 [TST]');
  expect(weapon).toBeDefined();
  expect(options.some((node) => node.props.children?.[0] === '未熟练细刃 [TST]')).toBe(false);
  weapon.props.onClick();
  expect(Object.values(store.update.mock.calls.at(-1)![0].classSelections)).toContainEqual([
    'Fixture Blade|TST',
  ]);
});

it('武器精通提供来源筛选且仍保存完整来源身份', () => {
  defaultCatalog.registerMany([
    {
      ...parent,
      raw: {
        ...parent.raw,
        startingProficiencies: { weapons: ['测试细刃|TST', '第二细刃|ALT'] },
        classFeatures: ['武器精通|Page Wizard|XPHB|1'],
      },
    },
    feature('武器精通', 1, ['你可以运用一种你熟练武器的精通词条。']),
    normalizeItem({ name: '测试细刃', ENG_name: 'Fixture Blade', source: 'TST', type: 'M' }),
    normalizeItem({ name: '第二细刃', ENG_name: 'Other Blade', source: 'ALT', type: 'M' }),
  ]);
  const tree = nodes(ClassDetailPage());
  const sources = tree.filter((node) => node.props?.['aria-pressed'] !== undefined);
  expect(sources.some((node) => node.props.children === '全部来源')).toBe(true);
  expect(sources.some((node) => node.props.children === 'TST')).toBe(true);
  expect(sources.some((node) => node.props.children === 'ALT')).toBe(true);
  const weapon = tree.find((node) => node.props?.children?.[0] === '第二细刃 [ALT]');
  weapon.props.onClick();
  expect(Object.values(store.update.mock.calls.at(-1)![0].classSelections)).toContainEqual([
    'Other Blade|ALT',
  ]);
});

it('职业技能表自选使用父职业原生技能池，不引入其他段落的技能', () => {
  defaultCatalog.registerMany([
    {
      ...parent,
      raw: {
        ...parent.raw,
        startingProficiencies: { skills: [{ choose: { from: ['arcana', 'history'], count: 1 } }] },
        classFeatures: ['知识训练|Page Wizard|XPHB|1'],
      },
    },
    feature('知识训练', 1, [
      'Choose one skill from the Page Wizard skill list. You gain proficiency in that skill.',
      'When you make a check with {@skill Stealth}, use the additional benefit.',
    ]),
  ]);
  const tree = nodes(ClassDetailPage());
  const options = tree.filter((node) => typeof node.props?.onClick === 'function');
  const chosen = options.find((node) => node.props.children?.[0] === '奥秘（智力）');
  expect(chosen).toBeDefined();
  expect(options.some((node) => node.props.children?.[0] === '历史（智力）')).toBe(true);
  expect(options.some((node) => node.props.children?.[0] === '隐匿（敏捷）')).toBe(false);
  chosen.props.onClick();
  expect(Object.values(store.update.mock.calls.at(-1)![0].classSelections)).toContainEqual([
    'arcana',
  ]);
});

it('固定技能授予传入正式卡计算，不呈现额外任选技能', () => {
  defaultCatalog.registerMany([
    { ...parent, raw: { ...parent.raw, classFeatures: ['固定训练|Page Wizard|XPHB|1'] } },
    feature('固定训练', 1, ['你获得{@skill 奥秘}技能的熟练。']),
  ]);
  const before = JSON.stringify(store.character);
  expect(computeProficiencies(store.character).skills).toContainEqual(
    expect.objectContaining({ id: 'arcana' }),
  );
  const tree = nodes(ClassDetailPage());
  expect(tree.some((node) => node.props?.children?.[0] === '奥秘（智力）')).toBe(false);
  expect(JSON.stringify(store.character)).toBe(before);
});

it('可选特性开关保存来源ID，启用替换基础授予，关闭恢复且不删除旧选择', () => {
  const base = feature('基础训练', 1, ['你获得{@skill 奥秘}技能的熟练。']);
  const optional = feature('替换训练', 1, [
    '可选职业特性，替代基础训练特性',
    '你获得{@skill 医药}技能的熟练。',
  ]);
  optional.raw.isClassFeatureVariant = true;
  defaultCatalog.registerMany([
    {
      ...parent,
      raw: {
        ...parent.raw,
        classFeatures: ['基础训练|Page Wizard|XPHB|1', '替换训练|Page Wizard|XPHB|1'],
      },
    },
    base,
    optional,
  ]);
  store.character.classSelections = { 'manual:unchanged': ['history'] };
  let toggle = nodes(ClassDetailPage()).find((node) => node.props?.role === 'switch');
  expect(toggle.props['aria-checked']).toBe(false);
  expect(computeProficiencies(store.character).skills.some((skill) => skill.id === 'arcana')).toBe(
    true,
  );
  toggle.props.onClick();
  expect(store.update.mock.calls.at(-1)![0]).toEqual({
    enabledOptionalClassFeatureIds: [optional.id],
  });
  Object.assign(store.character, store.update.mock.calls.at(-1)![0]);
  expect(computeProficiencies(store.character).skills.some((skill) => skill.id === 'arcana')).toBe(
    false,
  );
  toggle = nodes(ClassDetailPage()).find((node) => node.props?.role === 'switch');
  expect(toggle.props['aria-checked']).toBe(true);
  toggle.props.onClick();
  Object.assign(store.character, store.update.mock.calls.at(-1)![0]);
  expect(computeProficiencies(store.character).skills.some((skill) => skill.id === 'arcana')).toBe(
    true,
  );
  expect(store.character.classSelections).toEqual({ 'manual:unchanged': ['history'] });
});
