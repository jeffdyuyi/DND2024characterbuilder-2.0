import { getSourceSortWeight } from '@/config/sourceMapping';
import type { CharacterState } from '@/types/characterState';
import type { CharacterSourcePolicy, SourceBook, SourceSelection } from '@/types/sourceSelection';
import type { CatalogEntry, CatalogService, EntryKind } from './types';

type SourceIdentity = SourceBook & { isHomebrew?: boolean };

export function isHomebrewSource(entry: SourceIdentity): boolean {
  return Boolean(entry.isHomebrew || entry.sourcePackId.toLowerCase().startsWith('homebrew'));
}

export function sourceBookKey(book: SourceBook): string {
  let source = book.source.trim().toUpperCase();
  // 官方历史代码别名只在同一数据包内归一化，绝不把 PHB 和 XPHB 合并。
  if (book.sourcePackId === '5etools-cn' || book.sourcePackId === 'legacy') {
    source =
      ({ PHB2024: 'XPHB', DMG2024: 'XDMG', MM2024: 'XMM' } as Record<string, string>)[source] ||
      source;
  }
  return JSON.stringify([book.sourcePackId, source]);
}

/** 用于写入配置；无效输入拒绝写入，不把错误白名单自动扩大为全部。 */
export function validateSourceSelection(value: SourceSelection): SourceSelection {
  if (value?.mode === 'all') return { mode: 'all' };
  if (value?.mode !== 'selected' || !Array.isArray(value.books)) {
    throw new Error('无效的书籍来源配置');
  }
  const books = new Map<string, SourceBook>();
  for (const book of value.books) {
    if (
      !book ||
      typeof book.source !== 'string' ||
      !book.source.trim() ||
      typeof book.sourcePackId !== 'string' ||
      !book.sourcePackId.trim()
    ) {
      throw new Error('书籍来源必须包含 source 与 sourcePackId');
    }
    const normalized = { sourcePackId: book.sourcePackId.trim(), source: book.source.trim() };
    books.set(sourceBookKey(normalized), normalized);
  }
  return { mode: 'selected', books: [...books.values()] };
}

export function getCharacterSourcePolicy(
  character: Pick<CharacterState, 'sourceSelection' | 'allowHomebrew'>,
): CharacterSourcePolicy {
  return { selection: character.sourceSelection, allowHomebrew: Boolean(character.allowHomebrew) };
}

/** 只控制候选查询；没有 policy 时保持全局 Catalog 及旧调用的行为。 */
export function createSourcePredicate(policy?: CharacterSourcePolicy) {
  let selection: SourceSelection | undefined;
  try {
    selection =
      policy?.selection === undefined ? undefined : validateSourceSelection(policy.selection);
  } catch {
    // 非法导入配置不会崩溃，也不能意外开放全部来源；由设置入口重新选择。
    return (_entry: SourceIdentity) => false;
  }
  const selected =
    selection?.mode === 'selected' ? new Set(selection.books.map(sourceBookKey)) : undefined;
  return (entry: SourceIdentity): boolean => {
    if (!policy) return true;
    if (!policy.allowHomebrew && isHomebrewSource(entry)) return false;
    return !selected || selected.has(sourceBookKey(entry));
  };
}

/** 内嵌子选项优先读取稳定引用；没有独立来源的内嵌选项继承宿主书籍。 */
export function filterNestedSourceChoices<
  T extends {
    id?: string;
    catalogId?: string;
    source?: string;
    sourcePackId?: string;
    isHomebrew?: boolean;
  },
>(
  choices: T[],
  parent: CatalogEntry,
  catalog: CatalogService,
  policy?: CharacterSourcePolicy,
): T[] {
  if (!policy) return choices;
  const allows = createSourcePredicate(policy);
  return choices.filter((choice) => {
    const entry = catalog.get(choice.catalogId || choice.id || '');
    return allows(
      entry || {
        source: choice.source || parent.source,
        sourcePackId: choice.sourcePackId || parent.sourcePackId,
        isHomebrew: choice.isHomebrew ?? (choice.sourcePackId ? undefined : parent.isHomebrew),
      },
    );
  });
}

/** 已有选择的提示依据。排除和未载入都只返回状态，绝不删除或改写引用。 */
export function getSourceReferenceStatus(
  reference: string,
  catalog: CatalogService,
  policy: CharacterSourcePolicy,
):
  | { status: 'unresolved'; reference: string }
  | { status: 'allowed' | 'excluded'; reference: string; entry: CatalogEntry } {
  const entry = catalog.get(reference);
  if (!entry) return { status: 'unresolved', reference };
  return {
    status: createSourcePredicate(policy)(entry) ? 'allowed' : 'excluded',
    reference,
    entry,
  };
}

const BOOK_KINDS: EntryKind[] = [
  'class',
  'subclass',
  'classFeature',
  'subclassFeature',
  'race',
  'subrace',
  'background',
  'feat',
  'spell',
  'item',
  'baseitem',
  'magicvariant',
  'optionalfeature',
  'charoption',
  'reward',
  'boon',
  'cult',
  'condition',
  'language',
  'rule',
];

/** 从已加载 Catalog 发现书籍；这不是远程完整清单，也不触发下载。 */
export function getLoadedSourceBooks(catalog: CatalogService) {
  const books = new Map<string, SourceBook & { isHomebrew: boolean; entryCount: number }>();
  for (const kind of BOOK_KINDS) {
    for (const entry of catalog.list(kind)) {
      const key = sourceBookKey(entry);
      const book = books.get(key);
      if (book) {
        book.entryCount++;
        book.isHomebrew ||= isHomebrewSource(entry);
      } else
        books.set(key, {
          source: entry.source,
          sourcePackId: entry.sourcePackId,
          isHomebrew: isHomebrewSource(entry),
          entryCount: 1,
        });
    }
  }
  return [...books.values()].sort(
    (a, b) =>
      Number(a.isHomebrew) - Number(b.isHomebrew) ||
      getSourceSortWeight(a.source) - getSourceSortWeight(b.source) ||
      sourceBookKey(a).localeCompare(sourceBookKey(b)),
  );
}
