import { findCatalogTool, ToolCategory } from '../tools';
import { Selection } from '@/types/species';

/** 读取工具熟练项中的原生 filter 标签；不以背景所属书籍推断工具出处。 */
export function constrainBackgroundTools(
  choices: (string | Selection<string>)[],
  entries: unknown[],
) {
  const restrictions = new Map<ToolCategory, Set<string>>();
  const types: Record<string, ToolCategory> = {
    工匠工具: 'Artisan',
    AT: 'Artisan',
    'artisan tools': 'Artisan',
    乐器: 'Musical',
    INS: 'Musical',
    'musical instrument': 'Musical',
    赌具: 'Gaming',
    GS: 'Gaming',
    'gaming set': 'Gaming',
    工具: 'Other',
    T: 'Other',
  };
  const visit = (node: any, inTools = false) => {
    if (typeof node === 'string' && inTools) {
      for (const match of node.matchAll(/\{@filter\s+([^{}]+)\}/g)) {
        const [, page, ...filters] = match[1].split('|');
        if (page?.toLowerCase() !== 'items') continue;
        const source = filters.find((f) => f.startsWith('source='))?.slice(7);
        const type = filters.find((f) => f.startsWith('type='))?.slice(5);
        const category = type ? types[type] : undefined;
        if (!category || !source || !/^[a-z0-9;]+$/i.test(source)) continue;
        const sources = restrictions.get(category) || new Set<string>();
        source.split(';').forEach((s) => sources.add(s.toUpperCase()));
        restrictions.set(category, sources);
      }
    } else if (node && typeof node === 'object') {
      const isTools =
        inTools ||
        [node.name, node.ENG_name].some((name) =>
          /^(?:工具熟练(?:项)?|Tool Proficiencies)[:：]?$/i.test(name || ''),
        );
      if (node.entry) visit(node.entry, isTools);
      for (const child of node.entries || node.items || []) visit(child, isTools);
    }
  };
  entries.forEach((node) => visit(node));
  return choices.map((choice) =>
    typeof choice === 'string'
      ? choice
      : {
          ...choice,
          options: choice.options.filter((id) => {
            const tool = findCatalogTool(id);
            const allowed = tool && restrictions.get(tool.category);
            return !allowed || allowed.has(tool!.source);
          }),
        },
  );
}
