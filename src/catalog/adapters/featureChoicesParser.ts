import { CatalogEntry } from '../types';
import type { ClassFeature } from '@/types/class';
import { ALL_SKILLS } from '@/engine/terminology';

type FeatureChoice = NonNullable<NonNullable<ClassFeature['mechanics']>['choices']>[number];

export interface FeatureChoiceParseResult {
  choices: FeatureChoice[];
  diagnostics: string[];
}

function stripTags(value: string): string {
  return value.replace(/\{@\w+\s+([^}]+)\}/g, (_, body: string) => body.split('|')[2] || body.split('|')[0]);
}

function flattenText(value: unknown): string[] {
  if (typeof value === 'string') return [stripTags(value)];
  if (Array.isArray(value)) return value.flatMap(flattenText);
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [node.name, node.entry, node.entries, node.items].flatMap(flattenText);
}

function optionLabel(value: unknown): string | undefined {
  if (typeof value === 'string') return stripTags(value).trim() || undefined;
  if (!value || typeof value !== 'object') return undefined;
  const node = value as Record<string, unknown>;
  const reference =
    node.optionalfeature ||
    node.feat ||
    node.item ||
    node.classFeature ||
    node.subclassFeature ||
    node.name;
  if (typeof reference === 'string') return stripTags(reference).split('|')[0].trim() || undefined;
  return undefined;
}

function numberWord(value: string): number | undefined {
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  };
  const wordMatch = value.toLowerCase().match(/\b(one|two|three|four|five)\b|([一二两三四五])/);
  if (wordMatch) return words[wordMatch[1] || wordMatch[2]];

  const numeric = value.match(/\b([1-9]|10)\b/);
  if (numeric) return Number(numeric[1]);
  return undefined;
}

function inferChoiceType(text: string): FeatureChoice['type'] | undefined {
  const low = text.toLowerCase();
  if (/expertise|专精|双倍.*熟练|double (?:its|your) proficiency/i.test(low)) return 'expertise';
  if (/weapon mastery|mastery propert|武器精通|精通属性|精通词条/i.test(low)) return 'weaponMastery';
  if (/fighting style|战斗风格/i.test(low)) return 'fightingStyle';
  if (/language|语言/i.test(low)) return 'language';
  if (/skill proficien|技能熟练/i.test(low)) return 'skill';
  if (/tool proficien|工具熟练/i.test(low)) return 'tool';
  if (/saving throw|豁免/i.test(low)) return 'savingThrow';
  return undefined;
}

function walkOptionNodes(value: unknown, output: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    value.forEach((entry) => walkOptionNodes(entry, output));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const node = value as Record<string, unknown>;
  if (node.type === 'options') output.push(node);
  Object.entries(node).forEach(([key, child]) => {
    if (key !== 'type') walkOptionNodes(child, output);
  });
}

function semanticFallback(entriesText: string, entry: CatalogEntry): FeatureChoice[] {
  const fullText = [entry.name, entry.englishName, entriesText].filter(Boolean).join(' ');
  const type = inferChoiceType(fullText);
  if (!type || !/(choose|choice|select|选择|自选|任选|gain|获得|运用)/i.test(entriesText)) return [];

  const countContext =
    entriesText.match(/[^。.!！?？]{0,24}(?:choose|select|选择|自选|任选|gain|获得|运用)[^。.!！?？]{0,24}/i)?.[0] || entriesText;
  const count = numberWord(countContext) || 1;
  let filter: string | undefined;
  let options: string[] = [];

  if (type === 'expertise') {
    filter = 'proficient-skills';
    options = [...ALL_SKILLS];
    if (/(?:盗贼工具|thieves'?\s*tools)/i.test(entriesText)) {
      options.push('thievesTools');
    }
  } else if (type === 'weaponMastery') {
    filter = 'proficient-weapons';
    options = ['Any'];
  } else if (type === 'fightingStyle') {
    filter = 'category:Fighting Style';
  } else if (type === 'language') {
    filter = 'type:language';
    options = ['Any'];
  }

  return [{
    id: `cls:${entry.raw?.className || 'class'}:feat:${entry.id}:choice:0`,
    type,
    numToChoose: count,
    options,
    filter,
    name: entry.name,
    nameEn: entry.englishName,
  }];
}

/**
 * 从 5etools 原生职业特性 AST 与规则文本中提取交互选项。
 * 优先读取 type:"options"；仅在没有结构化选项时使用通用法条模式。
 */
export function parseFeatureChoices(entry: CatalogEntry): FeatureChoiceParseResult {
  const raw = (entry.raw || {}) as Record<string, unknown>;
  const entriesText = flattenText(raw.entries).join(' ');
  const fullText = [entry.name, entry.englishName, entriesText].filter(Boolean).join(' ');
  const inferredType = inferChoiceType(fullText);
  const optionNodes: Record<string, unknown>[] = [];
  walkOptionNodes(raw.entries, optionNodes);

  const choices = optionNodes.map((node, index): FeatureChoice => {
    const options = (Array.isArray(node.entries) ? node.entries : []).map(optionLabel).filter((item): item is string => Boolean(item));
    return {
      id: `cls:${raw.className || 'class'}:feat:${entry.id}:choice:${index}`,
      type: inferredType || 'custom',
      numToChoose: Number(node.count || 1),
      options,
      name: entry.name,
      nameEn: entry.englishName,
    };
  });

  if (choices.length === 0) choices.push(...semanticFallback(entriesText, entry));

  const diagnostics: string[] = [];
  if (choices.length === 0 && /(choose|choice|select|选择|自选|任选)/i.test(entriesText)) {
    diagnostics.push(`feature-choice-unresolved:${entry.id}`);
  }
  if (choices.some((choice) => choice.type === 'custom')) {
    diagnostics.push(`feature-choice-generic:${entry.id}`);
  }
  return { choices, diagnostics };
}
