import { describe, expect, it } from 'vitest';
import {
  exportSourceSettings,
  importSourceSettings,
  groupSourceBooks,
  toggleSourceGroup,
} from '../sourceSettings';
import { getLoadedSourceBooks } from '../sourcePolicy';
import { InMemoryCatalogService } from '../catalog';
import type { CatalogEntry } from '../types';
import type { SourceSelection } from '@/types/sourceSelection';

const official = { sourcePackId: '5etools-cn', source: 'XPHB' };
const classic = { sourcePackId: '5etools-cn', source: 'PHB' };
const brew = { sourcePackId: 'homebrew-tjliqy', source: 'XPHB' };
const unloaded = { sourcePackId: 'future-package', source: 'UNKNOWN' };

describe('portable source settings', () => {
  it('round trips both all and empty selected modes, retaining Homebrew permission', () => {
    const selections: SourceSelection[] = [{ mode: 'all' }, { mode: 'selected', books: [] }];
    for (const sourceSelection of selections) {
      const settings = { sourceSelection, allowHomebrew: false };
      expect(importSourceSettings(exportSourceSettings(settings))).toEqual(settings);
    }
  });

  it('keeps unloaded references and distinguishes the same source in different packages', () => {
    const settings = {
      sourceSelection: { mode: 'selected' as const, books: [official, brew, unloaded, official] },
      allowHomebrew: true,
    };
    const before = JSON.stringify(settings);
    expect(importSourceSettings(exportSourceSettings(settings)).sourceSelection).toEqual({
      mode: 'selected',
      books: [official, brew, unloaded],
    });
    expect(JSON.stringify(settings)).toBe(before);
    expect(
      exportSourceSettings({ ...settings, character: 'private' } as typeof settings),
    ).not.toContain('private');
  });

  it('rejects malformed, unsupported and unsafe configurations without broadening permissions', () => {
    for (const text of [
      '{',
      'null',
      JSON.stringify({ format: 'other', version: 1 }),
      JSON.stringify({ format: 'dnd-source-settings', version: 2, allowHomebrew: true }),
      JSON.stringify({
        format: 'dnd-source-settings',
        version: 1,
        allowHomebrew: 'false',
        sourceSelection: { mode: 'all' },
      }),
      JSON.stringify({
        format: 'dnd-source-settings',
        version: 1,
        allowHomebrew: false,
        sourceSelection: { mode: 'selected', books: [{}] },
      }),
    ])
      expect(() => importSourceSettings(text)).toThrow();
  });

  it('changes a whole group without losing unloaded or other-group selections', () => {
    const selection = { mode: 'selected' as const, books: [classic, unloaded] };
    expect(toggleSourceGroup(selection, [official, classic], [official], true)).toEqual({
      mode: 'selected',
      books: [classic, unloaded, official],
    });
    expect(toggleSourceGroup(selection, [official, classic], [classic], false)).toEqual({
      mode: 'selected',
      books: [unloaded],
    });
    expect(selection.books).toEqual([classic, unloaded]);
    expect(
      toggleSourceGroup({ mode: 'all' }, [official, classic, unloaded], [official], false),
    ).toEqual({ mode: 'selected', books: [classic, unloaded] });
  });

  it('groups by known origin without treating book source codes as edition markers', () => {
    const catalog = new InMemoryCatalogService();
    const raw = { name: '原文不改' };
    for (const [index, edition] of ['2014', '2024'].entries()) {
      catalog.register({
        id: `test-${index}`,
        kind: 'feat',
        name: '测试条目',
        source: 'SHARED',
        sourcePackId: '5etools-cn',
        edition,
        raw,
      } as CatalogEntry);
    }
    const books = getLoadedSourceBooks(catalog);
    const groups = groupSourceBooks([
      ...books,
      { ...official, source: 'XGE', isHomebrew: false, entryCount: 1 },
      { ...brew, isHomebrew: true, entryCount: 1 },
      { ...unloaded, isHomebrew: false, entryCount: 0 },
    ]);
    expect(groups.map((group) => [group.id, group.books.length])).toEqual([
      ['official', 2],
      ['homebrew', 1],
      ['unloaded', 1],
    ]);
    expect(raw).toEqual({ name: '原文不改' });
  });
});
