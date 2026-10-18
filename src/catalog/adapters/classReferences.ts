import { CatalogEntry, CatalogService } from '../types';
import { createClassAliases } from '@/source/resolver/classAliases';

export const classKeyPart = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();
export const classNames = (entry: CatalogEntry) => [
  ...new Set(
    [entry.name, entry.englishName, entry.raw.name, entry.raw.ENG_name]
      .map(classKeyPart)
      .filter(Boolean),
  ),
];

// DataUtil.class.unpackUid{Class,Subclass}Feature in 5etools-cn/js/utils.js:
// omitted parent sources default to PHB; feature source defaults to its parent source.
export function parseClassFeatureUid(text: string, subclass = false) {
  const parts = text.split('|').map((part) => part.trim());
  const [name, className, parentSource] = parts;
  const classSource = parentSource || 'PHB';
  const subclassSource = subclass ? parts[4] || 'PHB' : '';
  const level = Number(parts[subclass ? 5 : 3]);
  return {
    name,
    className,
    classSource,
    level,
    subclassName: subclass ? parts[3] : '',
    subclassSource,
    source: parts[subclass ? 6 : 4] || (subclass ? subclassSource : classSource),
    valid: Boolean(
      name && className && (!subclass || parts[3]) && Number.isInteger(level) && level > 0,
    ),
  };
}

export function belongsToClass(subclass: CatalogEntry, parent: CatalogEntry): boolean {
  return (
    classNames(parent).includes(classKeyPart(subclass.raw.className || subclass.parent)) &&
    classKeyPart(subclass.raw.classSource || 'PHB') === classKeyPart(parent.source)
  );
}

type FeatureLookup = (text: string, owner: CatalogEntry) => CatalogEntry | undefined;
type LookupSnapshot = {
  revision: number;
  aliases: ReturnType<typeof createClassAliases>;
  classFeature?: FeatureLookup;
  subclassFeature?: FeatureLookup;
};
const lookupSnapshots = new WeakMap<CatalogService, LookupSnapshot>();

/** Source-scoped aliases come exclusively from registered upstream records. */
export function createClassFeatureLookup(catalog: CatalogService, subclass = false): FeatureLookup {
  const kind = subclass ? 'subclassFeature' : 'classFeature';
  const revision = catalog.revision;
  let snapshot = lookupSnapshots.get(catalog);
  if (revision === undefined || snapshot?.revision !== revision) snapshot = undefined;
  if (snapshot?.[kind]) return snapshot[kind];
  const aliases =
    snapshot?.aliases ||
    createClassAliases(
      catalog.list('class').map((entry) => entry.raw),
      catalog.list('subclass').map((entry) => entry.raw),
      catalog.list('subclassFeature').map((entry) => entry.raw),
    );
  const index = new Map<string, Map<string, CatalogEntry>>();
  const makeKey = (
    name: unknown,
    parent: unknown,
    parentSource: unknown,
    level: unknown,
    source: unknown,
    child: unknown = '',
    childSource: unknown = '',
  ) =>
    JSON.stringify([
      classKeyPart(name),
      aliases.className(parent, parentSource),
      classKeyPart(parentSource),
      Number(level),
      classKeyPart(source),
      subclass ? aliases.subclassName(child, parent, parentSource, childSource) : '',
      classKeyPart(childSource),
    ]);
  for (const feature of catalog.list(subclass ? 'subclassFeature' : 'classFeature')) {
    const raw = feature.raw;
    const parentSource = raw.classSource || 'PHB';
    const childSource = subclass ? raw.subclassSource || 'PHB' : '';
    for (const name of classNames(feature)) {
      const key = makeKey(
        name,
        raw.className,
        parentSource,
        raw.level,
        feature.source,
        raw.subclassShortName || raw.subclassName,
        childSource,
      );
      const candidates = index.get(key) || new Map<string, CatalogEntry>();
      candidates.set(feature.id, feature);
      index.set(key, candidates);
    }
  }
  const lookup: FeatureLookup = (text, owner) => {
    const ref = parseClassFeatureUid(text, subclass);
    if (!ref.valid) return undefined;
    const candidates = [
      ...(index
        .get(
          makeKey(
            ref.name,
            ref.className,
            ref.classSource,
            ref.level,
            ref.source,
            ref.subclassName,
            ref.subclassSource,
          ),
        )
        ?.values() || []),
    ];
    const samePack = candidates.filter(
      (candidate) => candidate.sourcePackId === owner.sourcePackId,
    );
    // Never resolve an ambiguous reference by insertion order or an arbitrary source.
    return samePack.length === 1
      ? samePack[0]
      : samePack.length === 0 && candidates.length === 1
        ? candidates[0]
        : undefined;
  };
  // 只复用原始目录的引用索引；职业树与角色计算仍独立装配。
  if (revision !== undefined) {
    snapshot ??= { revision, aliases };
    snapshot[kind] = lookup;
    lookupSnapshots.set(catalog, snapshot);
  }
  return lookup;
}
