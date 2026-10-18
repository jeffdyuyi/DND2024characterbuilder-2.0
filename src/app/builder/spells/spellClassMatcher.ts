import { getClassDefinition } from '@/engine/characterData';

/** 同一目录快照中，每个职业引用只解析一次；保留完整引用以区分来源。 */
export function createSpellClassMatcher(resolveClass = getClassDefinition) {
  const names = new Map<string, string | undefined>();
  return (reference: string, targetClass: string) => {
    if (reference.toLowerCase() === targetClass) return true;
    if (!names.has(reference)) {
      names.set(reference, resolveClass(reference)?.nameEn.toLowerCase());
    }
    return names.get(reference) === targetClass;
  };
}
