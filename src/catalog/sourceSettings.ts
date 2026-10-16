import type { SourceBook, SourceSelection } from '@/types/sourceSelection';
import { sourceBookKey, validateSourceSelection } from './sourcePolicy';

export interface SourceSettings {
  sourceSelection?: SourceSelection;
  allowHomebrew?: boolean;
}
export interface SourceBookSummary extends SourceBook {
  isHomebrew: boolean;
  entryCount: number;
}

/** Portable settings only: no character data, downloads, or content snapshots. */
export function exportSourceSettings(settings: SourceSettings): string {
  return JSON.stringify(
    {
      format: 'dnd-source-settings',
      version: 1,
      sourceSelection: validateSourceSelection(settings.sourceSelection ?? { mode: 'all' }),
      allowHomebrew: Boolean(settings.allowHomebrew),
    },
    null,
    2,
  );
}

export function importSourceSettings(text: string): {
  sourceSelection: SourceSelection;
  allowHomebrew: boolean;
} {
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error('配置码不是有效的 JSON。');
  }
  if (
    !document ||
    document.format !== 'dnd-source-settings' ||
    document.version !== 1 ||
    typeof document.allowHomebrew !== 'boolean'
  ) {
    throw new Error('配置码格式或版本不受支持。');
  }
  return {
    sourceSelection: validateSourceSelection(document.sourceSelection),
    allowHomebrew: document.allowHomebrew,
  };
}

/** Use known source origin; edition labels require verified upstream publication metadata. */
export function groupSourceBooks<T extends SourceBookSummary>(books: T[]) {
  const groups = [
    { id: 'official', label: '官方资料', books: [] as T[] },
    { id: 'homebrew', label: '第三方资料', books: [] as T[] },
    { id: 'unloaded', label: '尚未载入的来源', books: [] as T[] },
  ];
  for (const book of books) {
    const group = book.isHomebrew ? 'homebrew' : book.entryCount > 0 ? 'official' : 'unloaded';
    groups.find((item) => item.id === group)!.books.push(book);
  }
  return groups.filter((group) => group.books.length > 0);
}

/** Editing a group preserves selections in every other group, including unloaded books. */
export function toggleSourceGroup(
  selection: SourceSelection,
  available: SourceBook[],
  group: SourceBook[],
  checked: boolean,
): SourceSelection {
  const current = selection.mode === 'all' ? available : selection.books;
  const changed = new Set(group.map(sourceBookKey));
  return validateSourceSelection({
    mode: 'selected',
    books: checked
      ? [...current, ...group]
      : current.filter((book) => !changed.has(sourceBookKey(book))),
  });
}
