type Raw = Record<string, any>;
const normalized = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();
const names = (raw: Raw) => [raw.name, raw.ENG_name].map(normalized).filter(Boolean);

/** Aliases are evidence from bilingual records and uniquely identified _copy
 * targets, scoped by parent and book. No prefixes, translations or ID tables. */
export function createClassAliases(classes: Raw[], subclasses: Raw[], features: Raw[] = []) {
  const isRecord = (value: unknown): value is Raw =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value));
  classes = classes.filter(isRecord);
  subclasses = subclasses.filter(isRecord);
  features = features.filter(isRecord);
  const links = new Map<string, string>();
  const root = (value: string): string => {
    const next = links.get(value);
    if (!next || next === value) return value;
    const result = root(next);
    links.set(value, result);
    return result;
  };
  const scoped = (scope: unknown[], name: unknown) => JSON.stringify([...scope, normalized(name)]);
  const unite = (scope: unknown[], values: unknown[]) => {
    const keys = values
      .map(normalized)
      .filter(Boolean)
      .map((value) => root(scoped(scope, value)));
    const canonical = [...keys].sort()[0];
    if (canonical) keys.forEach((value) => links.set(value, canonical));
  };
  const classScope = (source: unknown) => ['class', normalized(source || 'PHB')];
  const className = (name: unknown, source: unknown) => root(scoped(classScope(source), name));
  for (const raw of classes) unite(classScope(raw.source), names(raw));
  const childScope = (parent: unknown, parentSource: unknown, source: unknown) => [
    'subclass',
    className(parent, parentSource),
    normalized(parentSource || 'PHB'),
    normalized(source || 'PHB'),
  ];
  const canLink = (scope: unknown[], baseName: unknown, aliases: unknown[]) =>
    aliases
      .filter(Boolean)
      .every(
        (alias) =>
          !links.has(scoped(scope, alias)) ||
          root(scoped(scope, alias)) === root(scoped(scope, baseName)),
      );
  for (const raw of subclasses) {
    unite(childScope(raw.className, raw.classSource, raw.source), [raw.shortName, ...names(raw)]);
  }
  // A copy's full name + book + parent identify its base. Only then is its
  // shortName explicit evidence of that base's alias (e.g. translated data).
  for (const raw of subclasses) {
    const copy = raw._copy || raw._copyIdentity;
    if (!copy?.name && !copy?.ENG_name) continue;
    const copyNames = new Set(names(copy));
    const matches = subclasses.filter(
      (base) =>
        normalized(base.source || 'PHB') === normalized(copy.source || 'PHB') &&
        normalized(base.classSource || 'PHB') === normalized(copy.classSource || 'PHB') &&
        className(base.className, base.classSource) ===
          className(copy.className, copy.classSource) &&
        names(base).some((name) => copyNames.has(name)),
    );
    const identities = new Map(
      matches.map((base) => [
        scoped(
          childScope(base.className, base.classSource, base.source),
          base.shortName || base.name,
        ),
        base,
      ]),
    );
    if (identities.size !== 1) continue;
    const base = [...identities.values()][0];
    const scope = childScope(base.className, base.classSource, base.source);
    if (canLink(scope, base.shortName || base.name, [copy.shortName, ...names(copy)])) {
      unite(scope, [base.shortName, ...names(base), copy.shortName, ...names(copy)]);
    }
  }
  const subclassName = (name: unknown, parent: unknown, parentSource: unknown, source: unknown) =>
    root(scoped(childScope(parent, parentSource, source), name));
  const featureKey = (
    name: unknown,
    source: unknown,
    parent: unknown,
    parentSource: unknown,
    childSource: unknown,
    level: unknown,
  ) =>
    JSON.stringify([
      normalized(name),
      normalized(source),
      className(parent, parentSource),
      normalized(parentSource || 'PHB'),
      normalized(childSource || 'PHB'),
      Number(level),
    ]);
  const featureIndex = new Map<string, Raw[]>();
  for (const feature of features)
    for (const name of names(feature)) {
      const key = featureKey(
        name,
        feature.source,
        feature.className,
        feature.classSource,
        feature.subclassSource,
        feature.level,
      );
      featureIndex.set(key, [...(featureIndex.get(key) || []), feature]);
    }
  // A cross-book subclass can reuse another tree without _copy. Its full name
  // and the complete explicit feature-reference group must identify one base.
  for (const owner of subclasses) {
    if (!Array.isArray(owner.subclassFeatures)) continue;
    const groups = new Map<string, string[][]>();
    for (const value of owner.subclassFeatures || []) {
      const text = typeof value === 'string' ? value : value?.subclassFeature;
      if (typeof text !== 'string') continue;
      const p = text.split('|').map((part) => part.trim());
      if (!p[0] || !p[1] || !p[3] || !Number.isInteger(Number(p[5])) || Number(p[5]) <= 0) continue;
      const group = JSON.stringify([p[1], p[2] || 'PHB', p[3], p[4] || 'PHB']);
      groups.set(group, [...(groups.get(group) || []), p]);
    }
    for (const refs of groups.values()) {
      const p = refs[0];
      const matches = subclasses.filter(
        (base) =>
          normalized(base.source || 'PHB') === normalized(p[4] || 'PHB') &&
          normalized(base.classSource || 'PHB') === normalized(p[2] || 'PHB') &&
          className(base.className, base.classSource) === className(p[1], p[2]) &&
          names(base).some((name) => names(owner).includes(name)) &&
          refs.every((ref) =>
            (
              featureIndex.get(
                featureKey(ref[0], ref[6] || ref[4] || 'PHB', ref[1], ref[2], ref[4], ref[5]),
              ) || []
            ).some(
              (feature) =>
                subclassName(
                  feature.subclassShortName || feature.subclassName,
                  feature.className,
                  feature.classSource,
                  feature.subclassSource,
                ) ===
                subclassName(
                  base.shortName || base.name,
                  base.className,
                  base.classSource,
                  base.source,
                ),
            ),
          ),
      );
      const identities = new Map(
        matches.map((base) => [
          scoped(
            childScope(base.className, base.classSource, base.source),
            base.shortName || base.name,
          ),
          base,
        ]),
      );
      if (identities.size !== 1) continue;
      const base = [...identities.values()][0];
      const scope = childScope(base.className, base.classSource, base.source);
      if (canLink(scope, base.shortName || base.name, [p[3]]))
        unite(scope, [base.shortName, ...names(base), p[3]]);
    }
  }
  const matchesCopyScope = (candidate: Raw, copy: Raw) => {
    if (
      copy.subclassSource !== undefined &&
      normalized(candidate.subclassSource || 'PHB') !== normalized(copy.subclassSource || 'PHB')
    )
      return false;
    if (
      copy.className &&
      (normalized(candidate.classSource || 'PHB') !== normalized(copy.classSource || 'PHB') ||
        className(candidate.className, candidate.classSource) !==
          className(copy.className, copy.classSource))
    )
      return false;
    if (
      !copy.className &&
      copy.classSource &&
      normalized(candidate.classSource || 'PHB') !== normalized(copy.classSource)
    )
      return false;
    if (
      copy.shortName &&
      subclassName(
        candidate.shortName,
        candidate.className,
        candidate.classSource,
        candidate.source,
      ) !== subclassName(copy.shortName, copy.className, copy.classSource, copy.source)
    )
      return false;
    if (copy.subclassShortName || copy.subclassName) {
      if (
        normalized(candidate.subclassSource || 'PHB') !== normalized(copy.subclassSource || 'PHB')
      )
        return false;
      if (
        subclassName(
          candidate.subclassShortName || candidate.subclassName,
          candidate.className,
          candidate.classSource,
          candidate.subclassSource,
        ) !==
        subclassName(
          copy.subclassShortName || copy.subclassName,
          copy.className,
          copy.classSource,
          copy.subclassSource,
        )
      )
        return false;
    }
    return copy.level === undefined || Number(candidate.level) === Number(copy.level);
  };
  return { className, subclassName, matchesCopyScope };
}
