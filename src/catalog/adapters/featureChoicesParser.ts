import { CatalogEntry } from '../types';
import type { ClassFeature } from '@/types/class';
import { ALL_SKILLS, normalizeSkillId } from '@/engine/terminology';

type FeatureChoice = NonNullable<NonNullable<ClassFeature['mechanics']>['choices']>[number];

export interface FeatureChoiceParseResult {
  choices: FeatureChoice[];
  skillProficiencies: string[];
  diagnostics: string[];
}

function stripTags(value: string): string {
  return value.replace(
    /\{@\w+\s+([^}]+)\}/g,
    (_, body: string) => body.split('|')[2] || body.split('|')[0],
  );
}

function flattenText(value: unknown, excludeOptions = false): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((child) => flattenText(child, excludeOptions));
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  if (excludeOptions && node.type === 'options') return [];
  return [node.name, node.entry, node.entries, node.items].flatMap((child) =>
    flattenText(child, excludeOptions),
  );
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
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
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
  if (/weapon mastery|mastery propert|武器精通|精通属性|精通词条/i.test(low))
    return 'weaponMastery';
  if (/fighting style|战斗风格/i.test(low)) return 'fightingStyle';
  if (
    /ability score improvement|属性值提升|属性提升|epic boon|传奇恩惠|feat of your choice|选择[^。.!]*专长|获得[^。.!]*专长/i.test(
      low,
    )
  )
    return 'feat';
  if (
    /(?:learn|choose|select)[^.!。]{0,80}languages?|languages?[^.!。]{0,40}(?:of your choice|choose)|(?:学习|学会|掌握|选择|自选|额外获得)[^。.!]{0,24}语言|语言[^。.!]{0,15}(?:选择|自选)/i.test(
      low,
    )
  )
    return 'language';
  if (/skill proficien|proficien[^.!。]*skills?|技能(?:的)?熟练/i.test(low)) return 'skill';
  if (/tool proficien|工具熟练/i.test(low)) return 'tool';
  if (/weapon proficien|proficien[^.!。]*weapons?|武器(?:的)?熟练/i.test(low)) return 'weapon';
  if (/saving throw proficien|proficien[^.!。]*saving throw|豁免熟练/i.test(low))
    return 'savingThrow';
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
  if (!type || !/(choose|choice|select|选择|自选|任选|gain|获得|运用)/i.test(entriesText))
    return [];

  const countContext =
    entriesText.match(
      /[^。.!！?？]{0,24}(?:choose|select|选择|自选|任选|gain|获得|运用)[^。.!！?？]{0,24}/i,
    )?.[0] || entriesText;
  const count = numberWord(countContext) || 1;
  let filter: string | undefined;
  let options: string[] = [];

  if (type === 'expertise') {
    filter = 'proficient-skills';
    options = [...ALL_SKILLS];
    if (/(?:盗贼工具|thieves'?\s*tools)/i.test(entriesText)) {
      options.push('thievesTools');
    }
  } else if (type === 'skill') {
    const className = String(entry.raw.className || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const classSkills =
      /from (?:your|the) class(?:'s)? skill list/i.test(entriesText) ||
      (className &&
        new RegExp(
          '(?:从|from)[^。.!]{0,12}' +
            className +
            '[^。.!]{0,32}(?:技能(?:熟练项)?(?:列表|表)|skill list)',
          'i',
        ).test(entriesText));
    const choiceText = flattenText(entry.raw.entries)
      .flatMap((text) => text.split(/[。.!！？?]/))
      .filter((text) => /choose|choice|select|选择|自选|任选/i.test(text))
      .join(' ');
    const referenced = [...choiceText.matchAll(/\{@skill\s+([^|}]+)/g)].map((match) =>
      normalizeSkillId(match[1]),
    );
    if (classSkills) {
      filter = 'class-skills';
      options = ['Any'];
    } else {
      if (!choiceText) return [];
      options =
        /(?:从|from|following)/i.test(choiceText) && referenced.length
          ? [...new Set(referenced)]
          : [...ALL_SKILLS];
    }
  } else if (type === 'weaponMastery') {
    filter = 'proficient-weapons';
    options = ['Any'];
  } else if (type === 'fightingStyle') {
    filter = 'category:Fighting Style';
  } else if (type === 'language') {
    filter = 'type:language';
    options = ['Any Language'];
  } else if (type === 'tool' || type === 'weapon') {
    const referenced = [
      ...JSON.stringify(entry.raw.entries || []).matchAll(/\{@item\s+([^}]+)/g),
    ].map((match) => match[1].split('|').slice(0, 2).join('|'));
    if (referenced.length && /(?:从|from|following)/i.test(entriesText))
      options = [...new Set(referenced)];
    else if (type === 'weapon') options = ['Any'];
    else
      options = [
        /工匠|artisan/i.test(entriesText)
          ? "Artisan's Tools"
          : /乐器|musical instrument/i.test(entriesText)
            ? 'Any Musical Instrument'
            : /赌具|gaming set/i.test(entriesText)
              ? 'Any Gaming Set'
              : 'Any Tool',
      ];
  } else if (type === 'feat') {
    options = /epic boon|传奇恩惠/i.test(fullText) ? ['Epic Boon'] : ['General Feat'];
  }

  return [
    {
      id: `cls:${entry.raw?.className || 'class'}:feat:${entry.id}:choice:0`,
      type,
      numToChoose: count,
      options,
      filter,
      name: entry.name,
      nameEn: entry.englishName,
    },
  ];
}

/**
 * 从 5etools 原生职业特性 AST 与规则文本中提取交互选项。
 * 优先读取 type:"options"；仅在没有结构化选项时使用通用法条模式。
 */
export function parseFeatureChoices(entry: CatalogEntry): FeatureChoiceParseResult {
  const raw = (entry.raw || {}) as Record<string, unknown>;
  const entriesText = flattenText(raw.entries).map(stripTags).join(' ');
  const fullText = [entry.name, entry.englishName, entriesText].filter(Boolean).join(' ');
  const inferredType = inferChoiceType(fullText);
  const optionNodes: Record<string, unknown>[] = [];
  walkOptionNodes(raw.entries, optionNodes);

  const fields: Record<string, FeatureChoice['type']> = {
    skillProficiencies: 'skill',
    toolProficiencies: 'tool',
    languageProficiencies: 'language',
    weaponProficiencies: 'weapon',
  };
  const structured: FeatureChoice[] = [];
  for (const [field, type] of Object.entries(fields)) {
    if (!Array.isArray(raw[field])) continue;
    (raw[field] as any[]).forEach((group, index) => {
      if (!group || typeof group !== 'object') return;
      const categories: Record<string, string> = {
        any: type === 'language' ? 'Any Language' : type === 'tool' ? 'Any Tool' : 'Any',
        anyStandard: 'Any Standard Language',
        anyArtisansTool: "Artisan's Tools",
        anyMusicalInstrument: 'Any Musical Instrument',
        anyGamingSet: 'Any Gaming Set',
      };
      const choices = group.choose
        ? [{ count: group.choose.count ?? 1, from: group.choose.from }]
        : Object.entries(group)
            .filter(([key, value]) => categories[key] && typeof value === 'number')
            .map(([key, count]) => ({ count, from: [categories[key]] }));
      choices.forEach((choice, choiceIndex) => {
        if (!Array.isArray(choice.from)) return;
        structured.push({
          id: `cls:${raw.className || 'class'}:feat:${entry.id}:${field}:${index}:${choiceIndex}`,
          type,
          numToChoose: Number(choice.count),
          options: choice.from.map((value: string) => categories[value] || value),
          name: entry.name,
        });
      });
    });
  }

  const choices = optionNodes.map((node, index): FeatureChoice => {
    const options = (Array.isArray(node.entries) ? node.entries : [])
      .map(optionLabel)
      .filter((item): item is string => Boolean(item));
    return {
      id: `cls:${raw.className || 'class'}:feat:${entry.id}:choice:${index}`,
      type: inferredType || 'custom',
      numToChoose: Number(node.count || 1),
      options,
      name: entry.name,
      nameEn: entry.englishName,
    };
  });

  if (choices.length === 0) {
    choices.push(...structured);
    if (!Object.keys(fields).some((field) => Array.isArray(raw[field])))
      choices.push(...semanticFallback(entriesText, entry));
  }

  const diagnostics: string[] = [];
  const skillProficiencies = Array.isArray(raw.skillProficiencies)
    ? []
    : [
        ...new Set(
          flattenText(raw.entries, true)
            .flatMap((text) => text.split(/[。.!！？?]/))
            .filter(
              (text) =>
                /你(?:获得|拥有|习得)\s*(?:\{@skill[^}]+\}[、，和与及\s]*)+技能(?:的)?熟练|\byou (?:(?:gain|have) proficiency in|(?:are|become) proficient in) (?:the )?\{@skill\s/i.test(
                  text,
                ) && !/choose|choice|select|选择|自选|任选|如果|若|\bif\b/i.test(text),
            )
            .flatMap((text) => [...text.matchAll(/\{@skill\s+([^|}]+)/g)])
            .map((match) => normalizeSkillId(match[1])),
        ),
      ];
  if (choices.length === 0 && /(choose|choice|select|选择|自选|任选)/i.test(entriesText)) {
    diagnostics.push(`feature-choice-unresolved:${entry.id}`);
  }
  if (choices.some((choice) => choice.type === 'custom')) {
    diagnostics.push(`feature-choice-generic:${entry.id}`);
  }
  return { choices, skillProficiencies, diagnostics };
}
