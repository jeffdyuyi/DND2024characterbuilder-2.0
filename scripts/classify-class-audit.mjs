import { readFileSync, writeFileSync } from 'node:fs';

// Offline analysis of an explicitly captured audit batch; never a runtime seed.
const label = process.argv[2] || 'before';
if (!['before', 'after'].includes(label)) throw new Error('Expected before or after');
const root = 'scratch/class-audit';
const audit = JSON.parse(readFileSync(`${root}/${label}.json`, 'utf8'));
const catalog = JSON.parse(readFileSync(`${root}/${label}-catalog.json`, 'utf8'));
const key = value => String(value ?? '').trim().toLowerCase();
const names = record => [record.name, record.englishName, record.raw?.name, record.raw?.ENG_name].map(key).filter(Boolean);
const parents = catalog.filter(record => record.kind === 'class');
const parentKey = (name, source) => {
  const matches = parents.filter(record => key(record.source) === key(source) && names(record).includes(key(name)));
  return key(matches.find(record => !record.isHomebrew)?.englishName || matches[0]?.englishName || name);
};
const byId = new Map(catalog.map(record => [record.id, record]));
const features = catalog.filter(record => record.kind === 'classFeature' || record.kind === 'subclassFeature');
const groups = new Map();
const references = new Map();
for (const failure of audit.diagnostics.referenceFailures) {
  const p = failure.reference.split('|').map(value => value.trim());
  const subclass = failure.kind === 'subclassFeature';
  const source = p[subclass ? 6 : 4] || (subclass ? p[4] : p[2]) || 'PHB';
  const parentSource = p[2] || 'PHB';
  const level = Number(p[subclass ? 5 : 3]);
  const valid = Boolean(p[0] && p[1] && (!subclass || p[3]) && Number.isInteger(level) && level > 0);
  const candidates = features.filter(record => record.kind === failure.kind && names(record).includes(key(p[0])) && key(record.source) === key(source) && Number(record.raw.level) === level);
  const hasSource = features.some(record => key(record.source) === key(source));
  const cause = !valid ? 'invalid-uid' : !hasSource ? 'source-not-loaded' : candidates.length ? 'identity-mismatch-or-ambiguity' : 'target-not-found';
  const target = valid
    ? [failure.kind, key(p[0]), parentKey(p[1], parentSource), key(parentSource), key(subclass ? p[3] : ''), key(subclass ? p[4] || 'PHB' : ''), level, key(source)]
    : [failure.kind, failure.ownerId, failure.reference];
  const id = JSON.stringify(target);
  const issue = references.get(id) || { cause, target, references: [], owners: [], candidates: candidates.map(record => ({ id: record.id, path: record.raw._provenance?.path, className: record.raw.className, classSource: record.raw.classSource, subclassShortName: record.raw.subclassShortName, subclassSource: record.raw.subclassSource })) };
  if (!issue.references.includes(failure.reference)) issue.references.push(failure.reference);
  const owner = byId.get(failure.ownerId);
  issue.owners.push({ ...failure, filePath: owner?.raw._provenance?.path, revision: owner?.revision });
  references.set(id, issue);
}
const warnings = new Map();
for (const warning of audit.sources.homebrew.warnings) {
  const t = warning.target || {};
  const matching = catalog.filter(record => record.kind === warning.kind && names(record).some(name => [key(t.name), key(t.ENG_name)].includes(name)) && key(record.source) === key(t.source));
  const scoped = matching.filter(record => !t.className || (parentKey(record.raw.className, record.raw.classSource || 'PHB') === parentKey(t.className, t.classSource || 'PHB') && key(record.raw.classSource || 'PHB') === key(t.classSource || 'PHB')));
  const sameSource = catalog.filter(record => record.kind === warning.kind && key(record.source) === key(t.source));
  const shortNameMatches = sameSource.filter(record => t.shortName && key(record.raw.shortName) === key(t.shortName) &&
    parentKey(record.raw.className, record.raw.classSource || 'PHB') === parentKey(t.className, t.classSource || 'PHB') && key(record.raw.classSource || 'PHB') === key(t.classSource || 'PHB'));
  const cause = warning.code !== 'MISSING_COPY_SOURCE' ? warning.code : scoped.length === 1 ? 'copy-identity-alias' : scoped.length > 1 ? 'copy-ambiguous' :
    shortNameMatches.length ? 'copy-target-name-mismatch' : !sameSource.length ? 'copy-source-not-loaded' : 'copy-target-not-found';
  const target = [warning.kind, key(t.name || t.ENG_name), key(t.source), parentKey(t.className, t.classSource || 'PHB'), key(t.classSource || ''), key(t.shortName || t.subclassShortName || ''), key(t.subclassSource || ''), t.level ?? ''];
  const id = JSON.stringify(target);
  const issue = warnings.get(id) || { cause, target, warnings: [], candidates: [...scoped, ...shortNameMatches].map(record => ({ id: record.id, name: record.name, path: record.raw._provenance?.path, className: record.raw.className, shortName: record.raw.shortName })) };
  issue.warnings.push(warning);
  warnings.set(id, issue);
}
for (const [type, issues] of [['reference', references], ['copy', warnings]]) for (const issue of issues.values()) {
  const groupKey = `${type}:${issue.cause}`;
  const group = groups.get(groupKey) || { type, cause: issue.cause, uniqueTargets: 0, occurrences: 0 };
  group.uniqueTargets++;
  group.occurrences += issue.owners?.length || issue.warnings?.length || 0;
  groups.set(groupKey, group);
}
const result = { batch: label, referenceOccurrences: audit.diagnostics.referenceFailures.length, uniqueReferenceTargets: references.size, warningOccurrences: audit.sources.homebrew.warnings.length, uniqueWarningTargets: warnings.size, groups: [...groups.values()], references: [...references.values()], warnings: [...warnings.values()] };
writeFileSync(`${root}/${label}-classified.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, references: undefined, warnings: undefined }, null, 2));
