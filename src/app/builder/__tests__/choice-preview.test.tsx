import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { resolveChoicePreview } from '@/components/choicePreview';

const control = vi.hoisted(() => ({
  pathname: '/builder/details',
  multiclass: false,
  previewId: 'old-spell',
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) =>
      initial === null ? [control.previewId, () => {}] : actual.useState(initial),
  };
});
vi.mock('next/navigation', () => ({
  usePathname: () => control.pathname,
  useSearchParams: () => new URLSearchParams('id=audit'),
  useRouter: () => ({ push() {} }),
}));
vi.mock('@/platform/CatalogProvider', () => ({
  useCatalog: () => ({ stats: {}, status: 'ready' }),
}));
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({
    characters: { audit: { isMulticlassingEnabled: control.multiclass, classes: [] } },
    updateCharacterSources() {},
  }),
}));
vi.mock('@/catalog/builderChoices', () => ({ getExcludedCharacterChoices: () => [] }));
vi.mock('@/components/SourceBookPicker', () => ({ default: () => null }));
vi.mock('@/components/GlassNav', () => ({ default: () => null }));
vi.mock('@/engine/characterData', () => ({
  getSpellDefinition: (id: string) => ({
    id,
    name: id,
    nameEn: id,
    source: 'TEST',
    level: 0,
    school: 'V',
    castingTime: '',
    range: '',
    duration: '',
    components: '',
    description: `BODY-${id}`,
  }),
  getClassDefinition: () => undefined,
}));
import BuilderLayout from '../layout';
import { SpellPoolSection } from '../spells/SpellList';

const first = { id: 'first', nameEn: 'First', description: 'FIRST' };
const second = { id: 'second', nameEn: 'Second', description: 'SECOND' };
const references = (item: typeof first) => [item.id, item.nameEn];

it('多选时点击的有效候选优先于第一已选项，不修改已保存选择', () => {
  const selected = Object.freeze(['first', 'second']);
  expect(resolveChoicePreview([first, second], 'second', selected, references)).toBe(second);
  expect(selected).toEqual(['first', 'second']);
});
it('已失效的预览和旧保存引用被跳过，回退至有效已选项', () => {
  expect(
    resolveChoicePreview([first, second], 'removed', ['removed', 'second'], references, true),
  ).toBe(second);
});
it('支持既有英文别名，候选不足时不从其他组或版本补入', () => {
  expect(resolveChoicePreview([first], null, ['First'], references)).toBe(first);
  expect(resolveChoicePreview([first], 'second', ['second'], references)).toBeUndefined();
  expect(resolveChoicePreview([], 'first', ['first'], references, true)).toBeUndefined();
});
it('专长重开恢复已选详情，固定法术无须点击就可预览', () => {
  expect(resolveChoicePreview([first, second], null, ['second'], references)).toBe(second);
  expect(resolveChoicePreview([first], null, [], references, true)).toBe(first);
  expect(resolveChoicePreview([first], null, [], references)).toBeUndefined();
});
it.each([false, true])('兼职开关为 %s 时，最后一步文案与实际步骤一致', (multiclass) => {
  control.multiclass = multiclass;
  control.pathname = '/builder/details';
  const html = renderToStaticMarkup(
    <BuilderLayout>
      <span>CONTENT</span>
    </BuilderLayout>,
  );
  expect(html).toMatch(/builder__footerInfo[^>]*>细节/);
  expect(html).toMatch(/<button[^>]*>完成<\/button>/);
  expect(html).not.toContain('下一步');
});
it('关闭兼职后，职业进阶之后的步骤不再发生底部标签错位', () => {
  control.multiclass = false;
  control.pathname = '/builder/feats';
  const html = renderToStaticMarkup(
    <BuilderLayout>
      <span>CONTENT</span>
    </BuilderLayout>,
  );
  expect(html).toMatch(/builder__footerInfo[^>]*>专长精选/);
  expect(html).toContain('下一步');
});
it.each([{ selected: ['new-spell'] }, { selected: [] as string[] }])(
  '法术候选变化时，旧预览不能串入当前分组（已选 $selected）',
  ({ selected }) => {
    const spell = {
      id: 'new-spell',
      name: 'new-spell',
      nameEn: '',
      source: 'TEST',
      level: 0,
      school: '',
      castingTime: '',
      range: '',
      duration: '',
      components: '',
      classes: [],
      description: 'BODY-new-spell',
    };
    const html = renderToStaticMarkup(
      <SpellPoolSection
        slotId="base-cantrips"
        title="Audit"
        spells={[spell]}
        current={selected.length}
        limit={1}
        sel={{ cantrips: selected, spells: [] }}
        isWizardBase={false}
        book={[]}
        allSelections={{ cantrips: [], spells: [] }}
        innateSpellIds={[]}
        currentStep={{}}
        toggleSelection={() => {}}
        toggleExtraSelection={() => {}}
      />,
    );
    expect(html).not.toContain('BODY-old-spell');
    if (selected.length) expect(html).toContain('BODY-new-spell');
    else expect(html).not.toContain('BODY-new-spell');
  },
);
