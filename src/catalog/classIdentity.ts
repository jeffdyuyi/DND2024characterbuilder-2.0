/** 5etools parent identity includes source, independent of the content's own book. */
export function classContentParent(raw: Record<string, any>, feature = false): string {
  const parts = [raw.className, raw.classSource || 'PHB'];
  if (feature && (raw.subclassShortName || raw.subclassName)) {
    parts.push(raw.subclassShortName || raw.subclassName, raw.subclassSource || 'PHB');
  }
  return parts.join('|');
}
