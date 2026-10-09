import { ALL_GAME_LANGUAGES } from '@/rules/languages';
import { defaultCatalog } from '../catalog';
import { makeEntryId } from '../identity';
import { CatalogEntry } from '../types';
import { clean5eTags, flattenEntries } from '@/source/fiveetools-cn/utils';

export const SPECIES_RESISTANCE_TRANSLATION: Record<string, string> = {
  acid: '强酸', bludgeoning: '钝击', cold: '寒冷', fire: '火焰', force: '力场',
  lightning: '闪电', necrotic: '暗蚀', piercing: '穿刺', poison: '毒素',
  psychic: '心灵', radiant: '光耀', slashing: '劈砍', thunder: '雷鸣',
};
import { Trait, SubSpecies, Selection, InnateSpell } from '@/types/species';
import { translateProficiency, normalizeSkillId, SKILL_MAP } from '@/engine/terminology';
import { 
  getCatalogTools, 
  STANDARD_ARTISAN_TOOLS, 
  STANDARD_MUSICAL_INSTRUMENTS, 
  STANDARD_GAMING_SETS 
} from '../tools';

type Raw = Record<string, any>;
const array = (value: any): any[] => value == null ? [] : Array.isArray(value) ? value : [value];

export function entryTraits(raw: Raw): Trait[] {
  return array(raw.entries)
    .filter(e => {
      if (!e) return false;
      if (typeof e === 'string') return Boolean(e.trim());
      if (typeof e === 'object') {
        return Boolean(e.entries || e.entry || e.name || e.features);
      }
      return false;
    })
    .map((e, idx) => {
      const isString = typeof e === 'string';
      const rawName = isString ? '' : (e.name || '');
      const rawNameEn = isString ? '' : (e.nameEn || e.ENG_name || '');
      const desc = isString ? clean5eTags(e) : flattenEntries(e.entries || (e.entry ? [e.entry] : []));
      const fallbackId = `trait-unnamed-${idx}`;
      const id = (rawNameEn || rawName || fallbackId).toLowerCase().replace(/[-_\s]+/g, '');
      return {
        id: id || fallbackId,
        name: clean5eTags(rawName),
        nameEn: rawNameEn,
        description: desc,
        features: isString ? undefined : e.features,
        mechanics: isString ? undefined : e.mechanics,
        options: isString ? undefined : e.options,
        numToChoose: isString ? undefined : e.numToChoose,
        representsSubSpecies: isString ? undefined : e.representsSubSpecies,
        overwrite: isString ? undefined : (e.data?.overwrite || e.overwrite),
      };
    });
}

/**
 * 通用判定：判断当前种族母数据中的 raw.resist.choose 是否为“子分支/血统聚合统计”而非母特质自由单选。
 * 遵循 5etools 数据规范与规则语义解析，杜绝根据特定种族名称硬编码：
 * 1. 存在版本变体（_versions），且变体条目/变量中已分别定义抗性或属于机制实现分支（如 2024 提夫林、2024 龙裔）；
 * 2. 特质中已标记为亚种/血统分支宿主（representsSubSpecies）；
 * 3. 5etools 条目中包含分支血统映射表格（如 type: "table" 且包含伤害类型/抗数列，如 2014 龙裔）；
 * 4. 规则正文明确说明抗性由血统祖嗣分支决定（如“由你的...决定”、“基于所选...决定”）而非玩家在母特质自由单选。
 */
export function isAggregatedBranchResistance(raw: Raw, traits: Trait[]): boolean {
  // 1. 版本血统分支自身提供抗性或构成分支体系
  const versions = array(raw._versions);
  if (versions.length > 0) {
    const versionsProvideResist = versions.some((v: any) =>
      v.resist ||
      v._variables?.resist ||
      v._variables?.damageType ||
      (v._abstract && JSON.stringify(v._abstract).includes('resist')) ||
      (v._mod && JSON.stringify(v._mod).includes('resist'))
    );
    if (versionsProvideResist) return true;

    const isLineageVersionTree = versions.some((v: any) =>
      Boolean(v._abstract || v._implementations || v._mod?.entries)
    );
    if (isLineageVersionTree) return true;
  }

  // 2. 特质中已标记为亚种/血系宿主（例如已通过 subSpecies 结构化）
  if (traits.some(t => t.representsSubSpecies)) {
    return true;
  }

  // 3. 通用法条与结构化表格自省（如 2014 龙裔：正文中包含映射伤害抗性的分支表格）
  const allEntries = array(raw.entries);
  const hasBranchingResistanceTable = allEntries.some((e: any) => {
    const s = JSON.stringify(e);
    return s.includes('"type":"table"') && (
      s.includes('伤害类型') || s.includes('Damage Type') ||
      s.includes('抗性') || s.includes('Resistance')
    );
  });
  if (hasBranchingResistanceTable) return true;

  // 4. 正文语义判定：伤害抗性明确声明由分支血统决定
  const allEntriesJson = JSON.stringify(allEntries);
  const resistDeterminedByAncestry = /(?:由你的|取决于你的|基于所选).*?(?:决定|带来相应伤害类型)|(?:based on the|determines your).*?(?:damage|resistance)/i.test(allEntriesJson);
  if (resistDeterminedByAncestry) return true;

  return false;
}


function proficiencyChoices(data: any): (string | Selection<string>)[] {
  return array(data).flatMap((block: Raw) => Object.entries(block).flatMap(([key, value]): (string | Selection<string>)[] => {
    if (value === true) return [key];
    if (key === 'choose' && value && typeof value === 'object') {
      const choicesArr = Array.isArray(value) ? value : [value];
      return choicesArr.flatMap((choice: any) => {
        if (!choice || typeof choice !== 'object') return [];
        const count = choice.count || 1;
        const from: string[] = choice.from || [];
        const isHybrid = from.some((f: string) => typeof f === 'string' && (f.includes('技能') || f.toLowerCase().includes('skill'))) &&
                         from.some((f: string) => typeof f === 'string' && (f.includes('工具') || f.toLowerCase().includes('tool')));
        if (isHybrid) {
          return [{
            numToChoose: count,
            options: ['anySkill', 'anyTool'],
            name: '技能或工具自选',
            description: `可自选 ${count} 项技能或工具熟练`,
          }];
        }
        return [{ numToChoose: count, options: from }];
      });
    }
    const normKey = key.toLowerCase().replace(/[-_\s']/g, '');
    if ((normKey === 'any' || normKey === 'anystandard' || normKey === 'anyexotic' || normKey === 'anytool') && typeof value === 'number') {
      return [{ numToChoose: value, options: ['any'] }];
    }
    if ((normKey === 'anyartisanstool' || normKey === 'artisanstool' || normKey === 'artisanstools') && typeof value === 'number') {
      return [{ numToChoose: value, name: '工匠工具自选', options: getCatalogTools('Artisan') }];
    }
    if ((normKey === 'anymusicalinstrument' || normKey === 'musicalinstrument' || normKey === 'musicalinstruments') && typeof value === 'number') {
      return [{ numToChoose: value, name: '乐器自选', options: getCatalogTools('Musical') }];
    }
    if ((normKey === 'anygamingset' || normKey === 'gamingset' || normKey === 'gamingsets') && typeof value === 'number') {
      return [{ numToChoose: value, name: '游戏套件自选', options: getCatalogTools('Gaming') }];
    }
    return [];
  }));
}

function spellOption(reference: string, level: number, freeCasts: number | 'Proficiency Bonus', packId: string): InnateSpell {
  const [name, book = 'PHB'] = reference.split('#')[0].split('|');
  const isCantrip = reference.includes('#c');
  const source = book.toUpperCase();
  const matches = defaultCatalog.list('spell').filter(e => e.source.toUpperCase() === source &&
    [e.name, e.englishName].some(n => n?.toLowerCase() === name.toLowerCase()));
  const spell = matches.find(e => e.sourcePackId === packId) || (matches.length === 1 ? matches[0] : undefined);
  const realLevel = isCantrip ? 0 : (typeof spell?.raw?.level === 'number' ? spell.raw.level : level);
  return {
    spellId: spell?.id || makeEntryId({ packId, kind: 'spell', source, name }),
    spellName: spell?.name || name, spellNameEn: spell?.englishName || name,
    level: realLevel, isPrepared: true, freeCastsPerLongRest: freeCasts, useSpellSlots: true,
  };
}

const ABILITY_NAMES: Record<string, string[]> = {
  int: ['智力', 'Intelligence'],
  wis: ['感知', 'Wisdom'],
  cha: ['魅力', 'Charisma'],
  str: ['力量', 'Strength'],
  dex: ['敏捷', 'Dexterity'],
  con: ['体质', 'Constitution'],
};

/** 从带官方法术标签的种族特质正文提取建卡时的法术与施法属性复合选择。 */
export function addTextChoiceTraits(traits: Trait[], raw: Raw, packId: string): void {
  for (const entry of array(raw.entries)) {
    if (!entry || typeof entry !== 'object') continue;
    const hasTable = Array.isArray(entry.entries) && entry.entries.some((e: any) => e?.type === 'table');
    // 如果该特质包含对比表格且存在 _versions，则表格内的文本属于亚种分支，不提取为母特质特性
    if (hasTable && raw._versions?.length) {
      continue;
    }
    const text = flattenEntries(entry.entries || [entry.entry]);
    const leafStrings: string[] = [];
    const collectStrings = (value: unknown) => {
      if (typeof value === 'string') leafStrings.push(value);
      else if (Array.isArray(value)) value.forEach(collectStrings);
      else if (value && typeof value === 'object') Object.values(value).forEach(collectStrings);
    };
    collectStrings(entry.entries || entry.entry || '');
    const trait = traits.find((candidate) =>
      candidate.name === clean5eTags(entry.name || '') ||
      Boolean(entry.ENG_name && candidate.nameEn === entry.ENG_name)
    );
    if (!trait) continue;

    // A. 提取具体法术多选一 (如戏法标签)
    const choiceText = leafStrings.find((value) =>
      /(选择|任选|choose|choice)/i.test(clean5eTags(value)) &&
      /(戏法|cantrip)/i.test(clean5eTags(value)) &&
      Array.from(value.matchAll(/\{@spell\s+([^}|]+)(?:\|([^}]+))?\}/gi)).length >= 2
    );
    if (choiceText) {
      const references = Array.from(choiceText.matchAll(/\{@spell\s+([^}|]+)(?:\|([^}]+))?\}/gi))
        .map((match) => `${match[1]}|${match[2] || 'PHB'}#c`);
      const uniqueReferences = Array.from(new Set(references));
      if (uniqueReferences.length >= 2) {
        const spells = uniqueReferences.map((reference) => spellOption(reference, 1, 0, packId));
        trait.features = {
          ...(trait.features || {}),
          spells: [{ numToChoose: 1, name: '戏法', options: spells }],
        };
      }
    }

    const rawProse = leafStrings.join(' ');
    // B. 提取自然语言与 @skill 标签中的自选技能熟练项 (如狗头人狡猾遗产)
    // 关键准则：若 raw.skillProficiencies 已经定义了结构化数据，则以顶层结构化数据为权威事实源，跳过文本粗粒度猜测
    const hasTopLevelSkills = Boolean(raw.skillProficiencies && array(raw.skillProficiencies).length > 0);
    if (!hasTopLevelSkills) {
      const rawSkillMatches = Array.from(rawProse.matchAll(/\{@skill\s+([^}|]+)(?:\|[^}]+)?\}/gi)).map(m => m[1]);
      const plainSkills = ['奥秘', '运动', '欺瞒', '历史', '洞悉', '威吓', '调查', '医药', '自然', '察觉', '表演', '说服', '宗教', '巧手', '隐匿', '求生', '驯兽', '特技', '杂技'];
      const textSkillMatches = plainSkills.filter(s => text.includes(s));
      const rawCandidates = rawSkillMatches.length >= 2 ? rawSkillMatches : (textSkillMatches.length >= 2 ? textSkillMatches : []);
      // 核心防错 1：必须有至少 2 项不重复的技能选项作为可选池
      const uniqueSkills = Array.from(new Set(rawCandidates));

      // 核心防错 2：严禁把选择工具/语言/专长误判为选择技能 (如“你可以选择两种工匠工具”)
      const isToolOrOtherChoice = /(选择|自选|choose)\s*(?:[一二三两123]|one|two|three)?\s*(?:种|项|个)?\s*(?:工匠工具|工具|语言|专长|tool|language|feat)/i.test(text) && !/(技能|skill)/i.test(text);

      if (uniqueSkills.length >= 2 && !isToolOrOtherChoice && /(选择|自选|choose|choice|一项|one of|两项|two|三项|three)/i.test(text)) {
        const skillOptions = uniqueSkills.map(s => normalizeSkillId(s) || s.toLowerCase());

        // 动态解析数量词，杜绝硬编码 1
        let numToChoose = 1;
        const countMatch = text.match(/(?:选择|任选|choose)\s*([一二三两123]|one|two|three)\s*(?:项|个)?(?:\s*技能|\s*skill)?/i);
        if (countMatch) {
          const word = countMatch[1].toLowerCase();
          if (['二', '两', '2', 'two'].includes(word)) numToChoose = 2;
          else if (['三', '3', 'three'].includes(word)) numToChoose = 3;
          else numToChoose = 1;
        }

        trait.features = {
          ...(trait.features || {}),
          skillProficiencies: [{
            numToChoose,
            name: '自选技能',
            options: skillOptions,
          }],
        };
      }
    }

    // C. 提取带职业法术列表过滤的戏法选择 (如狗头人龙族术法)
    if (/从术士法术列表中选择|从法师法术列表中选择|class=术士|class=法师/i.test(rawProse + ' ' + text) && /(戏法|cantrip)/i.test(text)) {
      const className = /术士|sorcerer/i.test(rawProse + ' ' + text) ? 'sorcerer' : 'wizard';
      trait.features = {
        ...(trait.features || {}),
        spells: [{
          numToChoose: 1,
          name: '自选戏法',
          options: [],
          filter: `class:${className};level:0`,
        }],
      };
    }

    // D. 提取施法属性多选一 (仅在赋予法术的特质上提取)
    if (trait.features?.spells?.length && /(施法属性|spellcasting ability)/i.test(text)) {
      const abilities = Object.entries(ABILITY_NAMES)
        .filter(([, names]) => names.some((name) => text.toLowerCase().includes(name.toLowerCase())))
        .map(([key]) => key);
      if (abilities.length > 1) {
        trait.features = {
          ...(trait.features || {}),
          spellcastingAbility: { numToChoose: 1, name: '施法属性', options: abilities },
        };
      }
    }

    // E. 提取自选额外语言 (例如沃赫达的“额外语言 Extra Language”，吉斯洋基人的“你可以选择学习一种语言”)
    const isStandardLanguageTrait = /^(语言|languages?)$/i.test((trait.name || '').trim()) || /^(语言|languages?)$/i.test((trait.nameEn || '').trim());
    if (
      !isStandardLanguageTrait &&
      !trait.features?.languages?.length &&
      (/(额外语言|extra language)/i.test(trait.name + ' ' + (trait.nameEn || '')) ||
      (/(自选|额外|另一门|另一项|一门额外|选择学习一种)你?(?:自选)?的?(?:一种|一门|一项)?语言|another language of your choice|learn (?:one|a) language of your choice/i.test(text)))
    ) {
      trait.features = {
        ...(trait.features || {}),
        languages: [{ numToChoose: 1, name: '自选语言', options: ['any'] }],
      };
    }

    // F0. 提取正文中的自选技能或工具混合熟练 (Hybrid Skill or Tool Proficiency)
    // 典型如科拉瓦(EFA)“你获得一个自选技能的熟练项或一个工具的熟练项”、赞迪卡特裘如精灵“两项技能或工具熟练”、涅非利亚“四个技能或工具熟练”
    if (!trait.features?.skillProficiencies?.length && !trait.features?.skillToolProficiencies?.length) {
      const CHINESE_NUMS: Record<string, number> = {
        '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
        '1': 1, '2': 2, '3': 3, '4': 4,
        'one': 1, 'two': 2, 'three': 3, 'four': 4,
      };

      const hybridTextMatch = leafStrings.find(value => {
        const clean = clean5eTags(value);
        return (
          /(?:技能.*?或.*?工具|工具.*?或.*?技能|技能或工具|工具或技能)/i.test(clean) ||
          /(?:skills?\s+(?:of your choice\s+)?or\s+(?:one\s+)?tools?|tools?\s+(?:of your choice\s+)?or\s+(?:one\s+)?skills?|skills?\s+or\s+tools?\s+of your choice)/i.test(clean)
        );
      });

      if (hybridTextMatch && !/(法术|施法|属性)/i.test(trait.name)) {
        const clean = clean5eTags(hybridTextMatch);
        let count = 1;
        const countMatch = clean.match(/(?:获得|具有|自选|任选|选择).*?([一二三四两1234]|one|two|three|four)\s*(?:项|门|个|种)?/i) ||
                           clean.match(/([一二三四两1234]|one|two|three|four)\s*(?:项|门|个|种)?\s*(?:你所选择的|自选|任意)?\s*(?:技能|工具)/i) ||
                           clean.match(/(?:proficiency in|proficient in|proficient with)\s+(?:any\s+)?(one|two|three|four|\d+)/i);
        if (countMatch) {
          const word = countMatch[1].toLowerCase();
          count = CHINESE_NUMS[word] || parseInt(word, 10) || 1;
        }

        trait.features = {
          ...(trait.features || {}),
          skillToolProficiencies: [{
            numToChoose: count,
            options: ['anySkill', 'anyTool'],
            name: '技能或工具自选',
            description: `可自选 ${count} 项技能或工具熟练`,
          }],
        };
      }
    }

    // F. 提取正文中的自选技能 (例如半血裔/重生者的“先祖遗赠 Ancestral Legacy：...则你获得你所选择的两项技能的熟练。”)
    if (!trait.features?.skillProficiencies?.length && !trait.features?.skillToolProficiencies?.length) {
      const isHybrid = leafStrings.some(value => {
        const clean = clean5eTags(value);
        return /(?:技能.*?或.*?工具|工具.*?或.*?技能|技能或工具|工具或技能)/i.test(clean) ||
               /(?:skills?\s+(?:of your choice\s+)?or\s+(?:one\s+)?tools?|tools?\s+(?:of your choice\s+)?or\s+(?:one\s+)?skills?|skills?\s+or\s+tools?\s+of your choice)/i.test(clean);
      });
      if (!isHybrid) {
        const CHINESE_NUMS: Record<string, number> = {
          '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
          '1': 1, '2': 2, '3': 3, '4': 4,
          'one': 1, 'two': 2, 'three': 3, 'four': 4,
        };
        const skillTextMatch = leafStrings.find(value =>
          /(?:获得|具有|自选|任选|选择).*?([一二三四两1234]|one|two|three|four)\s*(?:项|门|个)?\s*(?:你所选择的|任意)?\s*技能(?:熟练)?/i.test(clean5eTags(value)) ||
          /(?:proficiency in|proficient in|proficient with)\s+(?:any\s+)?(one|two|three|four|\d+)\s+skills?\s+of your choice/i.test(clean5eTags(value))
        );
        if (skillTextMatch && !/(法术|施法|属性)/i.test(trait.name)) {
          const m = clean5eTags(skillTextMatch).match(/(?:获得|具有|自选|任选|选择).*?([一二三四两1234]|one|two|three|four)\s*(?:项|门|个)?\s*(?:你所选择的|任意)?\s*技能(?:熟练)?/i) ||
                    clean5eTags(skillTextMatch).match(/(?:proficiency in|proficient in|proficient with)\s+(?:any\s+)?(one|two|three|four|\d+)\s+skills?\s+of your choice/i);
          if (m) {
            const count = CHINESE_NUMS[m[1].toLowerCase()] || parseInt(m[1], 10) || 1;
            trait.features = {
              ...(trait.features || {}),
              skillProficiencies: [{ numToChoose: count, options: ['any'], name: '自选技能熟练' }],
            };
          }
        }
      }
    }
  }
}

/** Translate only explicit schema fields; prose stays in the upstream entries. */

const LANGUAGE_ALIASES: Record<string, string> = {
  '格朗': 'grung',
  '格朗语': 'grung',
  '格龙蛙人语': 'grung',
  '梦族': 'quori',
  '梦族语': 'quori',
  '梦灵语': 'quori',
  '吉斯': 'gith',
  '吉斯语': 'gith',
  '气族语': 'auran',
  '风族语': 'auran',
  '风元素语': 'auran',
  '气元素语': 'auran',
  '水族语': 'aquan',
  '水元素语': 'aquan',
  '火族语': 'ignan',
  '火元素语': 'ignan',
  '土族语': 'terran',
  '土元素语': 'terran',
  '维达肯语': 'vedalken',
  '通用贸易皮钦语': 'common',
};

function resolveLanguageChoices(raw: Raw, choices: (string | Selection<string>)[], traits: Trait[]): (string | Selection<string>)[] {
  const langTrait = traits.find(t => 
    /(语言|language)/i.test(t.name + ' ' + (t.nameEn || '')) ||
    /(说、读、写|读、写、说|听、说、读、写|说、写、读)/.test(t.description || '')
  );
  const text = langTrait ? clean5eTags(langTrait.description || '') : '';

  const hasOther = choices.some(c => typeof c === 'string' && c.toLowerCase() === 'other');
  if (!hasOther) {
    if (!text) return choices;
    // 检查文本中是否有比 choices 中更特化的方言语言（如阴林地精语特化自地精语）
    const dialectRegex = /(?<=(?:^|[\s，,、。；;：:和与及或听说读写掌握]))([^\s，,、。；;：:和与及或听说读写掌握交流使用可以能够懂会这那你我他它她等虽然但是由于因为学习研究探讨考教授练通晓借用模仿各其该]{1,5}语)/g;
    const textLangs: string[] = [];
    let dm;
    while ((dm = dialectRegex.exec(text)) !== null) {
      if (dm[1].length >= 2) textLangs.push(dm[1]);
    }
    if (textLangs.length > 0) {
      return choices.map(c => {
        if (typeof c !== 'string') return c;
        const low = c.toLowerCase();
        // 优先检查正文是否有同义别名语言直接命中 (如正文出现的"风族语"对应 auran)
        const textAlias = textLangs.find(tl => LANGUAGE_ALIASES[tl] === low);
        if (textAlias) return textAlias;

        const baseZh = translateProficiency(c).replace(/语$/, '');
        if (!baseZh) return c;
        // 核心约束：特化语言必须真实存在于合法游戏语言库中且不含谓词/连词，严禁将文本中的动作/状语句子片段（如“学习精灵语”、“虽然半身人语”）误当作特化语言
        const specialized = textLangs.find(tl => 
          tl !== (baseZh + '语') && 
          tl.includes(baseZh) &&
          !/[虽但是由于因为学习研究探讨考教授练通晓借用模仿各其该可以能够会懂]/.test(tl) &&
          ALL_GAME_LANGUAGES.some(l => l.name === tl || l.id.toLowerCase() === tl.toLowerCase())
        );
        return specialized || c;
      });
    }
    return choices;
  }

  // 1. 过滤掉 'other' 占位符，并对基础语言选项中的字符串做首轮严格去重，对结构化自选语言进行去重合并
  const existingLangIds = new Set<string>();
  const filteredStrings: string[] = [];
  const filteredSelections: Selection<string>[] = [];
  for (const c of choices) {
    if (typeof c === 'string') {
      const low = c.toLowerCase();
      if (low === 'other') continue;
      if (existingLangIds.has(low)) continue;
      existingLangIds.add(low);
      filteredStrings.push(c);
    } else if (c && typeof c === 'object' && 'numToChoose' in c) {
      // 检查是否已有完全相同 options 类型的选择项（如都是 options: ['any'] 的自选语言）
      const normOptions = (c.options || []).map(o => String(o).toLowerCase()).sort().join(',');
      const existing = filteredSelections.find(s => 
        (s.options || []).map(o => String(o).toLowerCase()).sort().join(',') === normOptions
      );
      if (existing) {
        // 合并取最大配额，避免 5etools 规则变体平铺导致的自选槽位翻倍
        existing.numToChoose = Math.max(existing.numToChoose, c.numToChoose);
      } else {
        filteredSelections.push({ ...c });
      }
    }
  }

  const resolvedLanguages: string[] = [];

  const addLanguage = (langIdOrName: string) => {
    if (!langIdOrName || langIdOrName === 'undefined' || langIdOrName === 'null') return;
    const clean = langIdOrName.trim();
    if (!clean) return;
    if (existingLangIds.has(clean.toLowerCase())) return;
    existingLangIds.add(clean.toLowerCase());
    resolvedLanguages.push(clean);
  };

  // 2. 专有别名匹配 (如格朗语 -> grung)
  for (const [alias, id] of Object.entries(LANGUAGE_ALIASES)) {
    if (text.includes(alias)) {
      addLanguage(id);
    }
  }

  // 3. 词库全量匹配（排除坏条目与空串）
  for (const lang of ALL_GAME_LANGUAGES) {
    if (!lang || !lang.id || lang.id === 'undefined' || !lang.name || lang.name === 'undefined') continue;
    if (text.includes(lang.name)) {
      addLanguage(lang.id);
    } else if (lang.nameEn && lang.nameEn.trim()) {
      const escaped = lang.nameEn.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:^|[^a-zA-Z])${escaped}(?:$|[^a-zA-Z])`, 'i').test(text)) {
        addLanguage(lang.id);
      }
    }
  }

  // 4. 正则捕获天然语言名（杜绝前置动词“听/说/读/写/交流/掌握”与连词“和/与/及/或”混入）
  const regex = /(?<=(?:^|[\s，,、。；;：:和与及或听说读写掌握交流使用会懂]))([^\s，,、。；;：:和与及或听说读写掌握交流使用可以能够懂会这那你我他它她等]{1,5}语)/g;
  const EXCLUDE_WORDS = new Set([
    '语言', '本语言', '该语言', '此语言', '自选语言', '额外语言', '任何语言',
    '其他语言', '某种语言', '一种语言', '一门语言', '项语言', '已知语言',
    '所有语言', '同语言', '口头语言', '书面语言', '肢体语言', '手势语言',
  ]);

  let match;
  while ((match = regex.exec(text)) !== null) {
    const term = match[1];
    if (EXCLUDE_WORDS.has(term) || term.length < 2) continue;
    
    if (LANGUAGE_ALIASES[term]) {
      addLanguage(LANGUAGE_ALIASES[term]);
      continue;
    }
    const matchInDb = ALL_GAME_LANGUAGES.find(l => l.name === term || l.id === term);
    const target = matchInDb ? matchInDb.id : term;
    addLanguage(target);
  }

  // 5. 正文自选语言检测
  const hasAnyChoice = filteredSelections.length > 0 || choices.some(c => typeof c === 'object' && c !== null && 'numToChoose' in c);
  if (!hasAnyChoice && /(自选|额外|另一项|另一门)你?(?:自选)?的?(?:一种|一门|一项)?语言|another language of your choice|language of your choice/i.test(text)) {
    filteredSelections.push({ numToChoose: 1, options: ['any'] });
  }

  return [...filteredStrings, ...filteredSelections, ...resolvedLanguages];
}

export function addStructuredTraits(traits: Trait[], raw: Raw, packId: string, parent?: Raw): void {
  addTextChoiceTraits(traits, raw, packId);
  const normalized = (value: unknown) => String(value || '').toLowerCase().replace(/[-_\s]+/g, '');
  const attach = (
    id: string,
    label: string,
    features: Raw,
    options: { names?: string[]; matches?: (trait: Trait) => boolean; fallbackDescription: string },
  ) => {
    const names = new Set([label, ...(options.names || [])].map(normalized));
    const trait = traits.find((candidate) =>
      Boolean(options.matches?.(candidate)) ||
      names.has(normalized(candidate.name)) ||
      names.has(normalized(candidate.nameEn)) ||
      Array.from(names).some(n => normalized(candidate.name).includes(n) || normalized(candidate.nameEn).includes(n))
    );
    if (trait) {
      if (id === 'skillProficiencies' && Array.isArray(features.skillProficiencies)) {
        const text = trait.description || '';
        const tagSkills = Array.from(text.matchAll(/\{@skill\s+([^}|]+)(?:\|[^}]+)?\}/gi)).map(m => m[1]);
        const PLAIN_SKILLS = ['欺瞒', '洞悉', '威吓', '表演', '游说', '说服', '运动', '杂技', '特技', '巧手', '隐匿', '奥秘', '历史', '调查', '自然', '宗教', '驯兽', '医药', '察觉', '求生', '生存'];
        const textSkills = tagSkills.length >= 2 ? tagSkills : PLAIN_SKILLS.filter(s => text.includes(s));
        if (textSkills.length >= 2) {
          const normTextSkills = Array.from(new Set(textSkills.map(s => {
            const norm = normalizeSkillId(s);
            return norm && SKILL_MAP[norm] ? SKILL_MAP[norm] : s;
          })));
          features.skillProficiencies = features.skillProficiencies.map((sp: any) => {
            if (sp && typeof sp === 'object' && Array.isArray(sp.options) && sp.options.length < normTextSkills.length && !sp.options.includes('any')) {
              return { ...sp, options: normTextSkills };
            }
            return sp;
          });
        }
      }
      trait.features = { ...trait.features, ...features };
    } else {
      traits.push({ id, name: label, description: options.fallbackDescription, features });
    }
  };
  for (const [field, label, names] of [
    ['skillProficiencies', '技能熟练', ['Keen Senses', 'Skillful']],
    ['toolProficiencies', '工具熟练', []],
    ['languageProficiencies', '语言', ['Languages']],
    ['skillToolLanguageProficiencies', '技能与工具熟练', ['Breadth of Knowledge', '广博学识', 'Tajuru Lore', '特裘如学识', 'Decadent Mastery', '业余爱好', 'Skill Versatility', '多才多艺']],
  ] as const) {
    let choices = proficiencyChoices(raw[field]);
    if (field === 'languageProficiencies') {
      choices = resolveLanguageChoices(raw, choices, traits);
    }
    if (choices.length) {
      let matchesFn: ((trait: Trait) => boolean) | undefined;
      if (field === 'skillProficiencies') {
        const targetSkillKeys: string[] = [];
        for (const item of choices) {
          if (typeof item === 'string') targetSkillKeys.push(item);
          else if (item && typeof item === 'object') targetSkillKeys.push(...(item.options || []));
        }
        matchesFn = (candidate: Trait) => {
          if (candidate.features?.skillProficiencies?.length) return true;
          const text = `${candidate.name} ${candidate.nameEn || ''} ${candidate.description || ''}`.toLowerCase();
          if (targetSkillKeys.includes('any')) {
            // 严禁误匹配到专长、语言、工具、护甲、武器等非技能特质
            if (/(^|\s)(专长|feat|语言|languages?|工具|tools?|护甲|armor|武器|weapon)(\s|$)/i.test(candidate.name + ' ' + (candidate.nameEn || ''))) {
              return false;
            }
            return /(技能|skill)/i.test(text);
          }
          const SKILL_ALIASES: Record<string, string[]> = {
            survival: ['生存', '求生'],
            acrobatics: ['杂技', '特技', '体操'],
            sleightofhand: ['巧手'],
            animalhandling: ['驯兽'],
          };
          return targetSkillKeys.some(key => {
            const zh = translateProficiency(key).split(/[（(]/)[0].trim().toLowerCase();
            const en = key.toLowerCase();
            const cleanKey = en.replace(/[-_\s]+/g, '');
            const aliases = SKILL_ALIASES[cleanKey] || [];
            return (Boolean(zh) && text.includes(zh)) || text.includes(en) || aliases.some(a => text.includes(a));
          });
        };
      } else if (field === 'toolProficiencies') {
        const targetToolKeys: string[] = [];
        let isArtisanCategory = false;
        let isMusicalCategory = false;
        let isGamingCategory = false;
        for (const item of choices) {
          if (typeof item === 'string') targetToolKeys.push(item);
          else if (item && typeof item === 'object') {
            targetToolKeys.push(...(item.options || []));
            if (item.name?.includes('工匠') || item.options === STANDARD_ARTISAN_TOOLS) isArtisanCategory = true;
            if (item.name?.includes('乐器') || item.options === STANDARD_MUSICAL_INSTRUMENTS) isMusicalCategory = true;
            if (item.name?.includes('游戏') || item.options === STANDARD_GAMING_SETS) isGamingCategory = true;
          }
        }
        matchesFn = (candidate: Trait) => {
          if (candidate.features?.toolProficiencies?.length) return true;
          const nameCombined = `${candidate.name} ${candidate.nameEn || ''}`.toLowerCase();
          const text = `${candidate.name} ${candidate.nameEn || ''} ${candidate.description || ''}`.toLowerCase();

          // 严禁误匹配到专长、语言、技能等非工具特质
          if (/(^|\s)(专长|feat|语言|languages?|技能|skills?)(\s|$)/i.test(nameCombined)) {
            return false;
          }

          if (isArtisanCategory && /(工匠|artisan|tinker|修补)/i.test(text)) {
            return true;
          }
          if (isMusicalCategory && /(乐器|musical|instrument|reveler|贪欢)/i.test(text)) {
            return true;
          }
          if (isGamingCategory && /(游戏|gaming)/i.test(text)) {
            return true;
          }

          if (targetToolKeys.includes('any')) {
            return /(工具|tool|tinker|artisan)/i.test(text);
          }
          return targetToolKeys.some(key => {
            const zh = translateProficiency(key).split(/[（(]/)[0].trim().toLowerCase();
            const en = key.toLowerCase();
            return (Boolean(zh) && text.includes(zh)) || text.includes(en);
          });
        };
      } else if (field === 'skillToolLanguageProficiencies') {
        matchesFn = (candidate: Trait) => {
          if (candidate.features?.skillToolProficiencies?.length) return true;
          const text = `${candidate.name} ${candidate.nameEn || ''} ${candidate.description || ''}`.toLowerCase();
          return (/(技能|skill)/i.test(text) && /(工具|tool)/i.test(text)) ||
                 /(广博学识|breadth of knowledge|多才多艺|skill versatility|业余爱好|decadent mastery)/i.test(text);
        };
      }

      const featureKey = field === 'languageProficiencies'
        ? 'languages'
        : field === 'skillToolLanguageProficiencies'
        ? 'skillToolProficiencies'
        : field;

      attach(field, label, { [featureKey]: choices }, {
        names: [...names],
        matches: matchesFn,
        fallbackDescription: label === '语言' ? '你获得语言熟练项。' : `你获得${label}项。`,
      });
    }
  }
  for (const feat of array(raw.feats)) {
    if (!feat || typeof feat !== 'object') continue;
    if (feat.anyFromCategory?.category?.includes('O')) {
      attach('origin-feat', '起源专长', {
        originFeats: { numToChoose: feat.anyFromCategory.count || 1, options: [], filter: 'type:origin' },
      }, { names: ['Versatile', '多用', '起源专长'], fallbackDescription: '你获得一项自选起源专长。' });
    } else if (feat.any) {
      const count = typeof feat.any === 'number' ? feat.any : 1;
      attach('feat', '专长', {
        originFeats: { numToChoose: count, options: [], filter: 'type:any' },
      }, { names: ['Feat', '专长', '额外专长', 'Bonus Feat'], fallbackDescription: '你获得一项自选专长。' });
    }
  }
  const resistances = array(raw.resist)
    .filter(r => typeof r === 'string')
    .map((r: string) => SPECIES_RESISTANCE_TRANSLATION[r.toLowerCase()] || r);
  if (resistances.length) attach('damage-resistance', '伤害抗性', { resistances }, {
    matches: (trait) => {
      const text = `${trait.name} ${trait.nameEn || ''} ${trait.description}`.toLowerCase();
      return /(抗性|resistance)/i.test(text) && resistances.every((resistance) => text.includes(resistance.toLowerCase()));
    },
    fallbackDescription: `你具有${resistances.join('、')}伤害的抗性。`,
  });

  const chooseResistances: Selection<string>[] = [];
  // 若抗性属于子分支/血统所决定的聚合抗性（嵌套在各分支选项中），绝不在母特质提取自由抗性选择器
  const isBranchResist = isAggregatedBranchResistance(raw, traits);
  if (!isBranchResist) {
    for (const r of array(raw.resist)) {
      if (r && typeof r === 'object' && r.choose) {
        const count = typeof r.choose.count === 'number' ? r.choose.count : 1;
        const from = (r.choose.from || []).map((item: string) => SPECIES_RESISTANCE_TRANSLATION[item.toLowerCase()] || item);
        if (from.length > 0) {
          chooseResistances.push({
            numToChoose: count,
            options: from,
            name: '伤害抗性自选',
            description: `可自选 ${count} 项伤害抗性`,
          });
        }
      }
    }

    // 正文条目泛用提取（针对未提供结构化 choose 但正文明确规定伤害抗性自选的种族/亚种）
    if (chooseResistances.length === 0) {
      const resistTextRegex = /(?:对以下一种你选择的伤害类型具有(?:\{@[^}]+\}\s*)?抗性|具有以下一种你选择的伤害类型的(?:\{@[^}]+\}\s*)?抗性|选择(?:以下)?(?:一种|一项)(?:伤害类型)?(?:的)?(?:\{@[^}]+\}\s*)?抗性)[：:]([^。.]+)/;
      for (const t of traits) {
        const match = resistTextRegex.exec(t.description || '');
        if (match && match[1]) {
          const candidates = match[1].split(/[、,，或与及\s]+/).map(s => s.trim()).filter(Boolean);
          const validOptions = candidates.map(c => {
            const direct = SPECIES_RESISTANCE_TRANSLATION[c.toLowerCase()];
            if (direct) return direct;
            if (Object.values(SPECIES_RESISTANCE_TRANSLATION).includes(c)) return c;
            return null;
          }).filter((c): c is string => Boolean(c));
          if (validOptions.length > 1) {
            chooseResistances.push({
              numToChoose: 1,
              options: Array.from(new Set(validOptions)),
              name: '伤害抗性自选',
              description: `可自选 1 项伤害抗性`,
              hostTraitName: t.name,
              hostTraitNameEn: t.nameEn,
            });
            break;
          }
        }
      }
    }
  }

  if (chooseResistances.length) {
    attach('damage-resistance-choice', '伤害抗性自选', { resistanceChoices: chooseResistances }, {
      matches: (trait) => {
        const text = `${trait.name} ${trait.nameEn || ''} ${trait.description}`.toLowerCase();
        return /(抗性|resistance|耐性|endurance)/i.test(text) &&
               (text.includes('抗性') || text.includes('resistance')) &&
               (text.includes('选择') || text.includes('choice') || text.includes('耐性') || text.includes('endurance'));
      },
      fallbackDescription: `你可自选伤害抗性。`,
    });
  }
  if (parent && typeof raw.darkvision === 'number' && raw.darkvision !== parent.darkvision) {
    attach('lineage-senses', '血系感官', { senseUpgrade: { darkvision: raw.darkvision } }, {
      matches: (trait) => /(黑暗视觉|darkvision)/i.test(`${trait.name} ${trait.nameEn || ''} ${trait.description}`),
      fallbackDescription: `你的黑暗视觉范围为 ${raw.darkvision} 尺。`,
    });
  }
  const walk = (speed: any) => typeof speed === 'number' ? speed : speed?.walk;
  if (parent && typeof walk(raw.speed) === 'number') {
    const speed = walk(raw.speed);
    attach('lineage-speed', '血系速度', { speedBonus: speed - (walk(parent.speed) ?? 30) }, {
      matches: (trait) => /(^|\s)(速度|speed)(\s|$)/i.test(`${trait.name} ${trait.nameEn || ''}`),
      fallbackDescription: `你的步行速度为 ${speed} 尺。`,
    });
  }
  // Multiple named spell blocks on the parent describe mutually exclusive lineages.
  const blocks = array(raw.additionalSpells);
  if (blocks.length === 1) {
    const block = blocks[0];
    const spells: (InnateSpell | Selection<InnateSpell>)[] = [];
    const visit = (node: any, level: number, free: number | 'Proficiency Bonus') => {
      if (typeof node === 'string') spells.push(spellOption(node, level, free, packId));
      else if (Array.isArray(node)) node.forEach(value => visit(value, level, free));
      else if (node?.choose) {
        const choose = node.choose;
        const options = array(choose.from).map(ref => spellOption(ref, level, free, packId));
        // 扫描正文中是否有默认预设初始法术（例如高等精灵：“你知晓戏法魔法伎俩。每当你完成长休时，你可以将它替换为另一道法师法术列表中的戏法。”）
        const rawProse = flattenEntries(raw.entries || []);
        const tagMatch = rawProse.match(/(?:知晓戏法|习得戏法|知晓法术|习得法术|learns? the cantrip|knows? the cantrip|learns? the spell|knows? the spell)\s*\{@spell\s+([^}|]+)(?:\|([^}]+))?\}/i);
        let defaultSpellName: string | undefined;
        let defaultSpellBook: string | undefined;

        if (tagMatch) {
          defaultSpellName = tagMatch[1];
          defaultSpellBook = tagMatch[2];
        } else {
          const textMatch = rawProse.match(/(?:知晓戏法|习得戏法|知晓法术|习得法术)\s*([一-龥]{2,6})(?:。|，|\.|\s|$)/);
          if (textMatch) {
            defaultSpellName = textMatch[1];
          } else {
            const enMatch = rawProse.match(/(?:learns?|knows?)\s+the\s+([a-zA-Z\s'-]+?)\s+cantrip/i);
            if (enMatch) {
              defaultSpellName = enMatch[1].trim();
            }
          }
        }

        let defaultSpell: InnateSpell | undefined = undefined;
        if (defaultSpellName) {
          const found = defaultCatalog.list('spell').find(s => 
            (s.name === defaultSpellName || s.englishName?.toLowerCase() === defaultSpellName?.toLowerCase())
          );
          const source = defaultSpellBook || found?.source || (raw.source === 'XPHB' ? 'XPHB' : 'PHB');
          const spellRef = `${found?.name || defaultSpellName}|${source}#c`;
          defaultSpell = spellOption(spellRef, level, free, packId);
          if (!options.some(o => o.spellName === defaultSpell?.spellName)) {
            options.unshift(defaultSpell);
          }
        }

        spells.push({
          numToChoose: choose.count || node.count || 1,
          name: defaultSpell ? `自选戏法（默认：${defaultSpell.spellName}）` : '自选法术',
          options,
          filter: typeof choose === 'string' ? choose.split('|').map(part => part.replace('=', ':')).join(';') : undefined,
          defaultSpellName: defaultSpell?.spellName,
          defaultSpellId: defaultSpell?.spellId,
        } as any);
      } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (key === 'daily') {
            for (const [count, refs] of Object.entries(value as Raw)) visit(refs, level, count === 'pb' ? 'Proficiency Bonus' : parseInt(count, 10));
          } else visit(value, level, free);
        }
      }
    };
    for (const category of ['known', 'innate', 'prepared']) {
      for (const [level, value] of Object.entries(block[category] || {})) {
        visit(value, /^\d+$/.test(level) ? Number(level) : 1, 0);
      }
    }
    if (spells.length) {
      attach('innate-spells', '种族法术', { spells }, {
        matches: (candidate) => spells.some((spell) => {
          if ('numToChoose' in spell) {
            const cName = `${candidate.name} ${candidate.nameEn || ''}`.toLowerCase();
            const cText = `${cName} ${candidate.description || ''}`.toLowerCase();
            return /(戏法|cantrip|法术|spells?)/i.test(cName) || /(从.*?法术列表中选择|从.*?选择一个戏法|choose a cantrip|spells)/i.test(cText);
          }
          return candidate.description.includes(spell.spellName) || candidate.description.includes(spell.spellNameEn);
        }),
        fallbackDescription: '你获得此种族提供的法术。',
      });
      const trait = traits.find(t => t.id === 'innate-spells' || t.features?.spells === spells);
      if (trait) trait.mechanics = { spellcastingAbility: typeof block.ability === 'string' ? block.ability : undefined };
    }
    if (Array.isArray(block.ability?.choose)) {
      const targetTrait = traits.find(t => t.features?.spells === spells || t.id === 'innate-spells') || traits.find(t => t.features?.spells?.length);
      if (targetTrait) {
        targetTrait.features = {
          ...(targetTrait.features || {}),
          spellcastingAbility: {
            numToChoose: 1,
            name: '施法属性',
            options: block.ability.choose,
          },
        };
      }
    }
  }

  const seen = new Map<string, Trait>();
  for (let index = 0; index < traits.length; index++) {
    const trait = traits[index];
    const key = normalized(trait.id || trait.nameEn || trait.name);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, trait);
      continue;
    }
    existing.features = { ...(existing.features || {}), ...(trait.features || {}) };
    if (!existing.description && trait.description) existing.description = trait.description;
    if (!existing.options?.length && trait.options?.length) existing.options = trait.options;
    traits.splice(index, 1);
    index--;
  }
}

function substitute(value: any, variables: Raw): any {
  if (typeof value === 'string') return value.replace(/\{\{([^}]+)\}\}/g, (match, key) => variables[key] ?? match);
  if (Array.isArray(value)) return value.map(v => substitute(v, variables));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, substitute(v, variables)]));
  return value;
}

/** These XPHB versions are actual build choices, not alternative publications. */
export function lineageChoices(entry: CatalogEntry): Selection<SubSpecies> | undefined {
  const raw = entry.raw as Raw;
  if (!raw._versions || !Array.isArray(raw._versions)) return;
  const hasLineageImplementations = raw._versions.some((v: any) =>
    Boolean(v._abstract || v._implementations || v._mod?.entries)
  );
  if (!hasLineageImplementations) return;
  const versions = array(raw._versions).flatMap(version => version._abstract ?
    array(version._implementations).map(implementation => ({
      ...substitute(version._abstract, implementation._variables || {}), ...implementation,
    })) : [version]);
    const options = versions.map(version => {
    // A version supplies replacement entries. Keep only its own traits, so the
    // parent's HP/skill bonuses are not applied again as subspecies bonuses.
    const changes = array(version._mod?.entries);
    const changedEntries = changes.flatMap(change => {
      if (['replaceArr', 'appendArr', 'prependArr'].includes(change?.mode)) {
        const items = array(change.items);
        if (change.mode === 'replaceArr' && change.replace) {
          const targetInRaw = array(raw.entries).find((e: any) => e.name === change.replace || e.ENG_name === change.replace);
          // 优先使用原始 entry 中声明的 overwrite，否则以 change.replace（被替换目标的名称）作为兜底
          // 这确保了 XPHB 提夫林等使用 _versions replaceArr 且原始数据无 overwrite 字段的种族
          // 其替换特质也能在 effectiveTraits 中正确匹配母特质
          const ow = targetInRaw?.data?.overwrite || targetInRaw?.overwrite || change.replace;
          return items.map((it: any) => {
            if (it && typeof it === 'object' && !it.data?.overwrite && !it.overwrite) {
              return { ...it, data: { ...(it.data || {}), overwrite: ow } };
            }
            return it;
          });
        }
        return items;
      }
      return [];
    });
    
    const rawResist = [
      ...array(version.resist),
      ...array(version._variables?.resist),
      ...(version._variables?.damageType ? [version._variables.damageType] : [])
    ].filter((r: any) => typeof r === 'string');
    const resistances = Array.from(new Set(rawResist.map((r: string) => SPECIES_RESISTANCE_TRANSLATION[r.toLowerCase()] || r)));

    // 继承在 _versions 间切换的属性（如定制血统中的自选技能熟练与黑暗视觉互斥切换）
    let inheritedSkills = version.skillProficiencies === null
      ? undefined
      : (version.skillProficiencies ?? (versions.some(v => v.skillProficiencies === null) ? raw.skillProficiencies : undefined));
    const changedProse = flattenEntries(changedEntries);
    const hasSpecificSkills = changedProse.includes('{@skill') || ['奥秘', '运动', '欺瞒', '历史', '洞悉', '威吓', '调查', '医药', '自然', '察觉', '表演', '说服', '宗教', '巧手', '隐匿', '求生', '驯兽', '特技', '杂技'].filter(s => changedProse.includes(s)).length >= 2;
    if (!inheritedSkills && !hasSpecificSkills && changedProse.match(/(?:自选|选择)(?:一个|一项|1项|1个)?技能.*?(?:熟练|具有熟练)|proficiency in (?:one|1) skill of your choice/i)) {
      inheritedSkills = [{ any: 1 }];
    }
    const inheritedDarkvision = version.darkvision === null
      ? undefined
      : (version.darkvision ?? (versions.some(v => v.darkvision === null) ? raw.darkvision : undefined));
    const inheritedTools = version.toolProficiencies === null
      ? undefined
      : (version.toolProficiencies ?? (versions.some(v => v.toolProficiencies === null) ? raw.toolProficiencies : undefined));
    const inheritedLanguages = version.languageProficiencies === null
      ? undefined
      : (version.languageProficiencies ?? (versions.some(v => v.languageProficiencies === null) ? raw.languageProficiencies : undefined));

    const versionRaw = {
      ...version,
      entries: changedEntries,
      resist: resistances.length ? resistances : version.resist,
      ...(inheritedSkills !== undefined ? { skillProficiencies: inheritedSkills } : {}),
      ...(inheritedDarkvision !== undefined ? { darkvision: inheritedDarkvision } : {}),
      ...(inheritedTools !== undefined ? { toolProficiencies: inheritedTools } : {}),
      ...(inheritedLanguages !== undefined ? { languageProficiencies: inheritedLanguages } : {}),
    };
    const traits = entryTraits(versionRaw);
    addStructuredTraits(traits, versionRaw, entry.sourcePackId, raw);
    
    const features: any = {};
    if (resistances.length) features.resistances = resistances;
    for (const t of traits) {
      if (t.features?.resistances?.length && !features.resistances?.length) features.resistances = t.features.resistances;
      if (t.features?.spells?.length && !features.spells?.length) features.spells = t.features.spells;
      if (t.features?.spellcastingAbility && !features.spellcastingAbility) features.spellcastingAbility = t.features.spellcastingAbility;
      if (t.features?.skillProficiencies?.length && !features.skillProficiencies?.length) features.skillProficiencies = t.features.skillProficiencies;
      if (t.features?.senseUpgrade && !features.senseUpgrade) features.senseUpgrade = t.features.senseUpgrade;
      if (typeof t.features?.speedBonus === 'number' && typeof features.speedBonus !== 'number') features.speedBonus = t.features.speedBonus;
    }
    let cleanName = version.name.replace(/^(?:.*?)[;；:：]\s*/, '').trim();
    let cleanNameEn = (version.ENG_name || version.name).replace(/^(?:.*?)[;；:：]\s*/, '').trim();

    // 如果版本名称格式形如 "种族名 (具体选项)"，例如 "龙裔 (黑)"，提取具体子项名 "黑"
    const parenMatch = cleanName.match(/^[^(（]+[（(](.*?)[)）]$/);
    if (parenMatch && parenMatch[1]) {
      cleanName = parenMatch[1].trim();
    }
    const parenMatchEn = cleanNameEn.match(/^[^(（]+[（(](.*?)[)）]$/);
    if (parenMatchEn && parenMatchEn[1]) {
      cleanNameEn = parenMatchEn[1].trim();
    }

    // 常见龙裔颜色/能量分支英文映射
    const COLOR_EN_MAP: Record<string, string> = {
      '黑': 'Black', '蓝': 'Blue', '黄铜': 'Brass', '青铜': 'Bronze',
      '赤铜': 'Copper', '金': 'Gold', '绿': 'Green', '红': 'Red',
      '银': 'Silver', '白': 'White', '紫晶': 'Amethyst', '水晶': 'Crystal',
      '祖母绿': 'Emerald', '蓝宝石': 'Sapphire', '黄玉': 'Topaz'
    };
    if (COLOR_EN_MAP[cleanName] && (!cleanNameEn || cleanNameEn === cleanName)) {
      cleanNameEn = COLOR_EN_MAP[cleanName];
    }

    return {
      id: makeEntryId({ packId: entry.sourcePackId, kind: 'subrace', source: version.source || entry.source, name: version.ENG_name || version.name, parent: entry.englishName || entry.name }),
      name: cleanName || version.name,
      nameEn: cleanNameEn || version.ENG_name || version.name,
      source: version.source || entry.source,
      description: flattenEntries(changedEntries), traits,
      features: Object.keys(features).length > 0 ? features : undefined,
      overwrite: version.overwrite || raw.overwrite,
    } as SubSpecies;
  });

  // 动态寻找宿主特性（如“精灵血系”、“邪魔遗赠”、“狗头人遗产”、“天界启示”、“先祖”等）
  const hostTrait = findLineageHostTrait(array(raw.entries), raw._versions);

  // 识别等级生效门槛（如“当你到达 3 级时”）
  const hostProse = hostTrait ? flattenEntries(hostTrait.entries || [hostTrait.entry]) : '';
  const levelMatch = hostProse.match(/(?:当你到达|当你在|到达|达到)\s*(\d+)\s*级时/i) || hostProse.match(/when you reach (\d+)(?:st|nd|rd|th)? level/i);
  const levelRequirement = levelMatch ? parseInt(levelMatch[1], 10) : 1;
  const isGamePlayChoice = levelRequirement > 1;

  return options.length ? {
    numToChoose: 1,
    options,
    name: hostTrait?.name || '亚种/血系选择',
    nameEn: hostTrait?.ENG_name || hostTrait?.nameEn || 'Subspecies / Lineage',
    hostTraitName: hostTrait?.name,
    hostTraitNameEn: hostTrait?.ENG_name || hostTrait?.nameEn,
    levelRequirement,
    isGamePlayChoice,
  } : undefined;
}

/**
 * 泛用宿主特性查找逻辑：
 * 优先匹配含有亚种/血系语义关键词的非通用特质，避免“黑暗视觉”等被误当成亚种宿主。
 */
export function findLineageHostTrait<T extends { name: string; nameEn?: string; ENG_name?: string }>(
  traitsOrEntries: T[],
  versions?: any[]
): T | undefined {
  if (!Array.isArray(traitsOrEntries) || traitsOrEntries.length === 0) return undefined;

  const isExcluded = (name: string) => /^(黑暗视觉|感官|速度|体型|年龄|阵营|darkvision|senses|speed|size|age|alignment)$/i.test((name || '').trim());
  const lineageRegex = /(遗赠|血系|祖怪|先祖|亚种|变体|世系|遗产|启示|馈赠|恩赐|传承|形态|lineage|ancestry|legacy|subrace|heritage|revelation|gift|boon)/i;

  // 1. 优先：名称中含有血系/亚种语义关键词且非单纯感官/数值基础特质
  const keywordCandidate = traitsOrEntries.find(t => {
    if (isExcluded(t.name)) return false;
    const combined = String((t.name || '') + ' ' + (t.nameEn || t.ENG_name || ''));
    return lineageRegex.test(combined);
  });
  if (keywordCandidate) return keywordCandidate;

  // 2. 次优：寻找被全部/最多 version 共同替换的特质（排除感官/数值）
  if (Array.isArray(versions) && versions.length > 0) {
    let bestCandidate: T | undefined = undefined;
    let maxCount = 0;
    for (const t of traitsOrEntries) {
      if (isExcluded(t.name)) continue;
      let count = 0;
      for (const v of versions) {
        const changes = array(v._mod?.entries);
        if (changes.some((m: any) => m?.replace && (m.replace === t.name || m.replace === t.nameEn || m.replace === t.ENG_name))) {
          count++;
        }
      }
      if (count > maxCount) {
        maxCount = count;
        bestCandidate = t;
      }
    }
    if (bestCandidate && maxCount > 0) return bestCandidate;
  }

  // 3. 兜底：任何符合语义关键词的特质
  return traitsOrEntries.find(t => lineageRegex.test(String((t.name || '') + ' ' + (t.nameEn || t.ENG_name || ''))));
}
