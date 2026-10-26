import { CharacterState } from '../types/characterState';
import {
  normalizeSkillId,
  translateProficiency,
  normalizeAbilityKey,
  SIMPLE_WEAPONS,
  MARTIAL_WEAPONS,
  SKILL_MAP,
  TOOL_MAP,
  WEAPON_MAP,
  ARMOR_MAP,
  WEAPON_CATEGORY_MAP,
  ABILITY_KEY_MAP,
} from './terminology';
import {
  getBackgroundDefinition,
  getClassDefinition,
  getFeatDefinition,
  getSpeciesDefinition,
  getSubspeciesDefinition,
  findItemById,
} from './characterData';
import { computeAbilityScores } from './ability';
import { TraitFeatures } from '../types/species';
import { SPECIES_RESISTANCE_TRANSLATION } from '../catalog/adapters/speciesChoices';

export interface ProficiencySource {
  id: string; // e.g., 'stealth'
  sources: string[]; // e.g., ['background:criminal', 'class:rogue']
}

export function hasExpertise(
  proficiencies: { skills?: ProficiencySource[]; tools?: ProficiencySource[] } | undefined,
  id: string,
  category: 'skills' | 'tools' = 'skills',
): boolean {
  const normalized = category === 'skills' ? normalizeSkillId(id) : id;
  return Boolean(
    proficiencies?.[category]?.some(
      (item) => item.id === normalized && item.sources.includes('Expertise Selection'),
    ),
  );
}

export interface ComputedProficiencies {
  skills: ProficiencySource[];
  saves: ProficiencySource[];
  tools: ProficiencySource[];
  weapons: ProficiencySource[];
  armor: ProficiencySource[];
  languages: ProficiencySource[];
  weaponMasteries: ProficiencySource[]; // 新增：武器精通
  resistances: ProficiencySource[]; // 伤害抗性来源汇总

  // Additive bonuses (e.g., +Wis to Arcana)
  skillBonuses: {
    skill: string;
    bonus: number;
    source: string;
    condition?: string;
    isActive: boolean;
  }[];
  saveBonuses: {
    save: string;
    bonus: number;
    source: string;
    condition?: string;
    isActive: boolean;
  }[];

  // Selections that can be changed after a Long Rest
  dailyPreparation: {
    traitId: string;
    traitName: string;
    name: string;
    nameEn?: string;
    options: string[];
    currentSelections: string[];
  }[];

  // A map indicating overlaps. Key is "category:id", value is array of sources.
  duplicates: Record<string, string[]>;
  activeConditions: string[]; // Currently active state conditions
  hasJackOfAllTrades: boolean; // Bard feature: half proficiency to all non-proficient skills

  // 战斗相关汇总
  speedBonus: number; // 职业/特性带来的移动速度额外加值（不含基础速度）
  senses: { darkvision?: number; blindsight?: number; truesight?: number; tremorsense?: number }; // 感知能力
  weaponMasterySlots: number; // 可用的武器精通槽数量
}

export function computeProficiencies(state: CharacterState): ComputedProficiencies {
  const result: ComputedProficiencies = {
    skills: [],
    saves: [],
    tools: [],
    weapons: [],
    armor: [],
    languages: [],
    weaponMasteries: [],
    resistances: [],
    skillBonuses: [],
    saveBonuses: [],
    dailyPreparation: [],
    duplicates: {},
    activeConditions: state.activeConditions || [],
    hasJackOfAllTrades: false,
    speedBonus: 0,
    senses: {},
    weaponMasterySlots: 0,
  };

  const { modifiers } = computeAbilityScores(state);

  type ProficiencyCategory =
    | 'skills'
    | 'saves'
    | 'tools'
    | 'weapons'
    | 'armor'
    | 'languages'
    | 'weaponMasteries'
    | 'resistances';

  const addProficiency = (category: ProficiencyCategory, id: string, sourceName: string) => {
    // Normalize skill IDs for consistency
    const normalizedId = category === 'skills' ? normalizeSkillId(id) : id;

    const list = result[category] as ProficiencySource[];
    let existing = list.find((p: ProficiencySource) => p.id === normalizedId);
    if (!existing) {
      existing = { id: normalizedId, sources: [] };
      list.push(existing);
    }
    existing.sources.push(sourceName);
  };

  const addDynamicBonuses = (mechanics: any, sourceName: string) => {
    if (!mechanics) return;

    // Skill Bonuses
    mechanics.dynamicSkillBonuses?.forEach((db: any) => {
      const abilityMod = modifiers[normalizeAbilityKey(db.ability) as keyof typeof modifiers] || 0;
      let finalBonus = abilityMod;
      if (db.minBonus !== undefined) finalBonus = Math.max(finalBonus, db.minBonus);

      const isActive = !db.condition || result.activeConditions.includes(db.condition);
      result.skillBonuses.push({
        skill: normalizeSkillId(db.skill),
        bonus: finalBonus,
        source: sourceName,
        condition: db.condition,
        isActive,
      });
    });

    // Save Bonuses
    mechanics.dynamicSavingThrowBonuses?.forEach((db: any) => {
      const abilityMod = modifiers[normalizeAbilityKey(db.ability) as keyof typeof modifiers] || 0;
      let finalBonus = abilityMod;
      if (db.minBonus !== undefined) finalBonus = Math.max(finalBonus, db.minBonus);

      const isActive = !db.condition || result.activeConditions.includes(db.condition);
      const saveKey = normalizeAbilityKey(db.save);
      if (saveKey) {
        result.saveBonuses.push({
          save: saveKey,
          bonus: finalBonus,
          source: sourceName,
          condition: db.condition,
          isActive,
        });
      }
    });
    // Speed Bonus
    if (mechanics.speedBonus) {
      result.speedBonus += mechanics.speedBonus;
    }

    // Senses
    if (mechanics.senseUpgrade) {
      const su = mechanics.senseUpgrade;
      if (su.darkvision)
        result.senses.darkvision = Math.max(result.senses.darkvision || 0, su.darkvision);
      if (su.blindsight)
        result.senses.blindsight = Math.max(result.senses.blindsight || 0, su.blindsight);
      if (su.truesight)
        result.senses.truesight = Math.max(result.senses.truesight || 0, su.truesight);
      if (su.tremorsense)
        result.senses.tremorsense = Math.max(result.senses.tremorsense || 0, su.tremorsense);
    }
  };

  const background = getBackgroundDefinition(state);
  const species = getSpeciesDefinition(state);
  const subspecies = getSubspeciesDefinition(state);
  result.senses = { ...species?.senses };

  // 1. 处理背景 (Background)
  if (background) {
    const bgLabel = `背景: ${background.name}`;

    // 固定熟练项
    background.skillProficiencies
      .filter((s) => typeof s === 'string')
      .forEach((s) => addProficiency('skills', s as string, bgLabel));
    background.toolProficiencies
      ?.filter((t) => typeof t === 'string')
      .forEach((t) => addProficiency('tools', t as string, bgLabel));
    background.languages
      ?.filter((l) => typeof l === 'string')
      .forEach((l) => addProficiency('languages', l as string, bgLabel));

    // 处理背景中的 URI 模式选择项 (bg:[ID]:prof:[TYPE]:[IDX])
    Object.entries(state.backgroundSelections || {}).forEach(([key, chosen]) => {
      if (key.startsWith(`bg:${background.id}:prof:`)) {
        const type = key.slice(`bg:${background.id}:prof:`.length).split(':')[0];
        const categoryMap: Record<string, ProficiencyCategory> = {
          skill: 'skills',
          tool: 'tools',
          lang: 'languages',
        };
        const category = categoryMap[type];
        if (category && chosen) {
          chosen.forEach((choice) => addProficiency(category, choice, bgLabel));
        }
      }
    });
  }

  // 2. 处理种族与亚种 (Species & Subspecies)
  const overwrittenTraitNames = new Set<string>();
  if (subspecies?.traits) {
    subspecies.traits.forEach((st) => {
      if (st.overwrite) {
        overwrittenTraitNames.add(st.overwrite.toLowerCase().replace(/[-_\s]+/g, ''));
      }
    });
  }
  const overwriteSkills = Boolean(subspecies?.overwrite?.skillProficiencies);

  [species, subspecies].forEach((entry) => {
    if (!entry) return;
    const isBaseSpecies = entry === species;
    const traits = entry.traits ?? [];
    traits.forEach((trait) => {
      if (isBaseSpecies && subspecies) {
        const tName = (trait.name || '').toLowerCase().replace(/[-_\s]+/g, '');
        const tNameEn = (trait.nameEn || '').toLowerCase().replace(/[-_\s]+/g, '');
        if (overwrittenTraitNames.has(tName) || (tNameEn && overwrittenTraitNames.has(tNameEn))) {
          return; // 该母特质已被亚种/变体特质覆盖替换
        }
      }

      const features: TraitFeatures | undefined = trait.features;
      const traitLabel = `${entry.name}: ${trait.name}`;

      // 固定熟练项与抗性 (若亚种覆写技能，则跳过母种族技能)
      if (!isBaseSpecies || !overwriteSkills) {
        features?.skillProficiencies
          ?.filter((s) => typeof s === 'string')
          .forEach((s) => addProficiency('skills', s as string, traitLabel));
      }
      features?.toolProficiencies
        ?.filter((t) => typeof t === 'string')
        .forEach((t) => addProficiency('tools', t as string, traitLabel));
      features?.skillToolProficiencies?.forEach((st) => {
        if (typeof st === 'string') {
          const normSkill = normalizeSkillId(st);
          const isSkill = Boolean(SKILL_MAP[st] || (normSkill && SKILL_MAP[normSkill]));
          addProficiency(isSkill ? 'skills' : 'tools', st, traitLabel);
        }
      });
      features?.weaponProficiencies
        ?.filter((w) => typeof w === 'string')
        .forEach((w) => addProficiency('weapons', w as string, traitLabel));
      features?.armorProficiencies
        ?.filter((a) => typeof a === 'string')
        .forEach((a) => addProficiency('armor', a as string, traitLabel));
      features?.languages
        ?.filter((l) => typeof l === 'string')
        .forEach((l) => addProficiency('languages', l as string, traitLabel));
      features?.resistances
        ?.filter((r) => typeof r === 'string')
        .forEach((r) => {
          const label = SPECIES_RESISTANCE_TRANSLATION[r.toLowerCase()] || r;
          addProficiency('resistances', label, traitLabel);
        });

      // 处理种族与亚种 URI 模式选择项 (sp:[ID]:trait:[TraitID]:[SubKey] 或 sp:[ID]:sub:[SubID]:[SubKey])
      Object.entries(state.speciesSelections || {}).forEach(([key, chosen]) => {
        const traitPrefix = `sp:${species?.id}:trait:${trait.id || trait.name}:`;
        const subPrefix = `sp:${species?.id}:sub:${entry.id}:`;
        const matchedPrefix = key.startsWith(traitPrefix)
          ? traitPrefix
          : key.startsWith(subPrefix)
            ? subPrefix
            : null;
        if (matchedPrefix && chosen) {
          // 如果是每日整备项，放入专用列表
          const isDaily =
            trait.features?.skillProficiencies?.some((s: any) => s.isLongRestChoice) ||
            trait.features?.toolProficiencies?.some((t: any) => t.isLongRestChoice);

          if (isDaily) {
            result.dailyPreparation.push({
              traitId: trait.id || 'unknown',
              traitName: trait.name,
              name: trait.name,
              nameEn: trait.nameEn,
              options: [], // 临时简化，UI 会处理
              currentSelections: chosen,
            });
            return;
          }

          const suffix = key.slice(matchedPrefix.length);
          if (suffix.startsWith('skilltool-') || suffix.startsWith('hybrid-')) {
            chosen.forEach((choice) => {
              const normSkill = normalizeSkillId(choice);
              const isSkill = Boolean(SKILL_MAP[choice] || (normSkill && SKILL_MAP[normSkill]));
              const category: ProficiencyCategory = isSkill ? 'skills' : 'tools';
              addProficiency(category, choice, traitLabel);
            });
            return;
          }

          if (suffix.startsWith('resist-')) {
            chosen.forEach((choice) => {
              const label = SPECIES_RESISTANCE_TRANSLATION[choice.toLowerCase()] || choice;
              addProficiency('resistances', label, traitLabel);
            });
            return;
          }

          let category: ProficiencyCategory;
          if (suffix.startsWith('skill-')) category = 'skills';
          else if (suffix.startsWith('tool-')) category = 'tools';
          else if (suffix.startsWith('lang-')) category = 'languages';
          else return;

          chosen.forEach((choice) => addProficiency(category, choice, traitLabel));
        }
      });

      addDynamicBonuses(trait.mechanics, traitLabel);
      if (features?.senseUpgrade)
        addDynamicBonuses({ senseUpgrade: features.senseUpgrade }, traitLabel);
    });
  });

  // 兜底补全：扫描 speciesSelections 中可能存在的自选项（抗性、语言、技能、工具）
  Object.entries(state.speciesSelections || {}).forEach(([k, chosen]) => {
    if (!Array.isArray(chosen) || chosen.length === 0) return;
    if (k.includes(':resist')) {
      chosen.forEach((c) => {
        const label = SPECIES_RESISTANCE_TRANSLATION[c.toLowerCase()] || c;
        addProficiency('resistances', label, '种族自选抗性');
      });
    } else if (k.includes(':lang-') || k.includes(':language')) {
      chosen.forEach((c) => addProficiency('languages', c, '种族自选语言'));
    } else if (k.includes(':skill-')) {
      chosen.forEach((c) => addProficiency('skills', c, '种族自选技能'));
    } else if (k.includes(':tool-')) {
      chosen.forEach((c) => addProficiency('tools', c, '种族自选工具'));
    } else if (k.includes(':skilltool-') || k.includes(':hybrid-')) {
      chosen.forEach((c) => {
        const normSkill = normalizeSkillId(c);
        const isSkill = Boolean(SKILL_MAP[c] || (normSkill && SKILL_MAP[normSkill]));
        addProficiency(isSkill ? 'skills' : 'tools', c, '种族自选技能/工具');
      });
    }
  });

  const expertiseRequests = new Set<string>();
  const selectionsByKey = new Map(
    Object.entries(state.classSelections || {}).map(([key, values]) => [key.toLowerCase(), values]),
  );
  const recordedExpertise = new Set(
    Object.entries(state.classSelections || {})
      .filter(([key]) => /expertise|专精/i.test(key))
      .flatMap(([, values]) => values.map(normalizeSkillId)),
  );
  const featureChoiceActivity = new Map<string, boolean>();
  const activeClassKeys = new Set<string>();
  const handledFeatureChoices = new Set<string>();
  const scopedClassChoices: string[] = [];

  // 3. 处理职业 (Classes)
  state.classes?.forEach((cEntry, index) => {
    const classDef = getClassDefinition(cEntry.classId);
    if (!classDef) return;

    const sourceName = `职业: ${classDef.name}`;
    const classKeys = [cEntry.classId, classDef.nameEn].filter(Boolean);
    classKeys.forEach((key) => activeClassKeys.add(key.toLowerCase()));
    const registerChoices = (feature: any, active: boolean) => {
      for (const choice of feature.mechanics?.choices || []) {
        for (const owner of classKeys) {
          const key = `cls:${owner}:feat:${feature.name}:${choice.id}`.toLowerCase();
          featureChoiceActivity.set(key, active || featureChoiceActivity.get(key) === true);
          if (choice.type === 'expertise') {
            selectionsByKey
              .get(key)
              ?.forEach((value) => recordedExpertise.add(normalizeSkillId(value)));
          }
        }
      }
    };
    classDef.features?.forEach((feature) =>
      registerChoices(feature, feature.level <= cEntry.level),
    );
    classDef.subClassInfo?.options.forEach((subclass) => {
      const selected = [subclass.catalogId, subclass.nameEn, subclass.name].includes(
        cEntry.subclassId,
      );
      subclass.traits?.forEach((feature) =>
        registerChoices(feature, selected && feature.level <= cEntry.level),
      );
    });
    if (classDef.features?.length)
      scopedClassChoices.push(
        ...[cEntry.classId, classDef.nameEn].map((id) => `cls:${id}:feat:`.toLowerCase()),
      );

    // 3.1 处理职业基础熟练 (cls:[ID]:base:prof:[TYPE])
    Object.entries(state.classSelections || {}).forEach(([key, chosen]) => {
      if ([cEntry.classId, classDef.nameEn].some((id) => key.startsWith(`cls:${id}:base:prof:`))) {
        const type = key.split(':').pop();
        const categoryMap: Record<string, ProficiencyCategory> = {
          skills: 'skills',
          tools: 'tools',
          weapons: 'weapons',
          armor: 'armor',
        };
        const category = categoryMap[type || ''];
        if (category && chosen) {
          chosen.forEach((choice) => addProficiency(category, choice, sourceName));
        }
      }
    });

    // 3.2 固定熟练项 (仅首个职业)
    if (index === 0) {
      classDef.proficiencies?.savingThrows?.forEach((save) => {
        const normalized = normalizeAbilityKey(save);
        if (normalized) addProficiency('saves', normalized, sourceName);
      });
      if (Array.isArray(classDef.proficiencies?.armor)) {
        classDef.proficiencies.armor.forEach((a) => addProficiency('armor', a, sourceName));
      }
      if (Array.isArray(classDef.proficiencies?.weapons)) {
        classDef.proficiencies.weapons.forEach((w) => addProficiency('weapons', w, sourceName));
      }
      if (Array.isArray(classDef.proficiencies?.tools)) {
        classDef.proficiencies.tools.forEach((tool) => addProficiency('tools', tool, sourceName));
      }
    }

    const applyFeature = (feature: any, label: string) => {
      if (feature.level > cEntry.level) return;
      const applyMechanics = (mechanics: any, source: string) => {
        addDynamicBonuses(mechanics, source);
        const fixed: Record<string, ProficiencyCategory> = {
          skillProficiencies: 'skills',
          toolProficiencies: 'tools',
          languageProficiencies: 'languages',
          weaponProficiencies: 'weapons',
        };
        for (const [field, category] of Object.entries(fixed)) {
          if (Array.isArray(mechanics?.[field]))
            mechanics[field].forEach((value: unknown) => {
              if (typeof value === 'string') addProficiency(category, value, source);
            });
        }
      };
      applyMechanics(feature.mechanics, label);
      const prefixes = [cEntry.classId, classDef.nameEn].map((id) =>
        ('cls:' + id + ':feat:' + feature.name + ':').toLowerCase(),
      );
      for (const [key, selected] of Object.entries(state.classSelections || {})) {
        if (!prefixes.some((prefix) => key.toLowerCase().startsWith(prefix))) continue;
        const choice = feature.mechanics?.choices?.find((candidate: any) =>
          key.endsWith(':' + candidate.id),
        );
        if (
          featureChoiceActivity.get(key.toLowerCase()) === false ||
          (!choice && featureChoiceActivity.has(key.toLowerCase()))
        )
          continue;
        handledFeatureChoices.add(key);
        for (const value of selected || []) {
          if (choice?.type === 'expertise' || /expertise|专精/i.test(key)) {
            expertiseRequests.add(normalizeSkillId(value));
            continue;
          }
          const categories: Record<string, ProficiencyCategory> = {
            skill: 'skills',
            tool: 'tools',
            language: 'languages',
            weapon: 'weapons',
            weaponMastery: 'weaponMasteries',
            mastery: 'weaponMasteries',
            savingThrow: 'saves',
          };
          if (categories[choice?.type]) {
            addProficiency(categories[choice.type], value, label);
            continue;
          }
          const option =
            feature.options?.find(
              (option: any) => option.name === value || option.nameEn === value,
            ) ||
            feature.mechanics?.choices
              ?.flatMap((choice: any) => choice.options || [])
              .find((option: any) => option?.name === value || option?.nameEn === value);
          if (option?.mechanics) applyMechanics(option.mechanics, label + ' (' + option.name + ')');
          const skill = normalizeSkillId(value);
          if (SKILL_MAP[skill]) addProficiency('skills', skill, label);
          else if (TOOL_MAP[value]) addProficiency('tools', value, label);
        }
      }
    };
    classDef.features?.forEach((feature) => {
      if (feature.level > cEntry.level) return;
      if (feature.nameEn === 'Jack of All Trades' || feature.name === '万事通')
        result.hasJackOfAllTrades = true;
      applyFeature(feature, sourceName + ' (' + feature.name + ')');
    });
    if (cEntry.subclassId) {
      const subclass = classDef.subClassInfo?.options.find((option) =>
        [option.catalogId, option.nameEn, option.name].includes(cEntry.subclassId),
      );
      subclass?.traits?.forEach((feature) =>
        applyFeature(feature, '子职: ' + subclass.name + ' (' + feature.name + ')'),
      );
    }
  });

  // 3. 处理专长 (Feats)
  const processFeatMechanics = (mechanics: any, featLabel: string) => {
    if (!mechanics) return;

    // Weapons
    if (Array.isArray(mechanics.weaponProficiencies)) {
      mechanics.weaponProficiencies.forEach((w: string) => addProficiency('weapons', w, featLabel));
    } else if (mechanics.weaponProficiencies?.options) {
      // This is a choice, normally handled via featSelections, but adding safety
      mechanics.weaponProficiencies.options.forEach((w: string) => {
        if (w !== 'Any' && w !== 'any') addProficiency('weapons', w, featLabel);
      });
    }

    // Armor
    mechanics.armorProficiencies?.forEach((a: string) => addProficiency('armor', a, featLabel));

    // Tools
    const processTool = (tp: any) => {
      if (tp.options) {
        tp.options.forEach((t: string) => {
          if (t !== 'Any' && t !== 'any') addProficiency('tools', t, featLabel);
        });
      }
    };
    if (Array.isArray(mechanics.toolProficiencies)) {
      mechanics.toolProficiencies.forEach(processTool);
    } else if (mechanics.toolProficiencies) {
      processTool(mechanics.toolProficiencies);
    }

    // Skills
    const processSkill = (sp: any) => {
      if (sp.options) {
        sp.options.forEach((s: string) => {
          if (s !== 'Any' && s !== 'any') addProficiency('skills', s, featLabel);
        });
      }
    };
    if (Array.isArray(mechanics.skillProficiencies)) {
      mechanics.skillProficiencies.forEach(processSkill);
    } else if (mechanics.skillProficiencies) {
      processSkill(mechanics.skillProficiencies);
    }

    // Languages
    const processLang = (lp: any) => {
      if (lp.options) {
        lp.options.forEach((l: string) => {
          if (l !== 'Any' && l !== 'any') addProficiency('languages', l, featLabel);
        });
      }
    };
    if (Array.isArray(mechanics.languageProficiencies)) {
      mechanics.languageProficiencies.forEach(processLang);
    } else if (mechanics.languageProficiencies) {
      processLang(mechanics.languageProficiencies);
    }

    // Weapon Masteries (Directly in mechanics)
    mechanics.weaponMasteries?.forEach((w: string) =>
      addProficiency('weaponMasteries', w, featLabel),
    );
  };

  // 3.1 旧版数据兼容
  state.selectedFeats?.forEach((selection) => {
    const feat = getFeatDefinition(selection.featId);
    if (feat) processFeatMechanics(feat.mechanics, `专长: ${feat.name}`);
  });

  // 3.2 新版精细化选择数据 (featSelections)
  Object.entries(state.featSelections || {}).forEach(([slotId, choices]) => {
    const feat = getFeatDefinition(choices.featId);
    if (!feat) return;
    const featLabel = `专长: ${feat.name}`;

    choices.skills?.forEach((skill) => addProficiency('skills', skill, featLabel));
    choices.tools?.forEach((tool) => addProficiency('tools', tool, featLabel));
    choices.languages?.forEach((lang) => addProficiency('languages', lang, featLabel));
    choices.weaponMasteries?.forEach((w) => addProficiency('weaponMasteries', w, featLabel));

    processFeatMechanics(feat.mechanics, featLabel);
  });

  state.selectedSkills?.forEach((skill) => addProficiency('skills', skill, 'Player Selection'));
  for (const category of ['skills', 'saves', 'tools', 'languages'] as const) {
    state.proficiencies?.[category]?.forEach((id) =>
      addProficiency(category, id, 'Manual Proficiency'),
    );
  }
  state.selectedLanguages?.forEach((lang) => addProficiency('languages', lang, 'Player Selection'));

  // 3.3 Class Selections (Feature choices like Student of War, or weapon/armor choices)
  Object.entries(state.classSelections || {}).forEach(([id, choices]) => {
    if (handledFeatureChoices.has(id)) return;
    const lowId = id.toLowerCase();
    if (featureChoiceActivity.has(lowId)) return;
    const classOwner = lowId.match(/^cls:(.+?):feat:/)?.[1];
    if (classOwner && !activeClassKeys.has(classOwner)) return;
    // Known class trees already consumed active, unlocked features above.
    if (
      scopedClassChoices.some((prefix) => lowId.startsWith(prefix)) &&
      !/expertise|专精/i.test(lowId)
    )
      return;
    choices.forEach((choice) => {
      if (typeof choice !== 'string') return;
      const normalized = normalizeSkillId(choice);
      const lowChoice = choice.toLowerCase();

      if (lowId.includes('expertise') || lowId.includes('专精')) {
        expertiseRequests.add(normalized);
      } else if (
        SKILL_MAP[normalized] &&
        (lowId.includes('skill') || lowId.includes('proficiency'))
      ) {
        addProficiency('skills', normalized, 'Class Feature Selection');
      } else if (
        (TOOL_MAP[choice] || TOOL_MAP[lowChoice]) &&
        (lowId.includes('tool') || lowId.includes('proficiency'))
      ) {
        addProficiency('tools', choice, 'Class Feature Selection');
      } else if (WEAPON_MAP[lowChoice] || WEAPON_CATEGORY_MAP[lowChoice]) {
        if (lowId.includes('mastery') || lowId.includes('精通')) {
          addProficiency('weaponMasteries', choice, 'Weapon Mastery Feature');
        } else if (lowId.includes('weapon') || lowId.includes('proficiency')) {
          addProficiency('weapons', choice, 'Class Feature Selection');
        }
      } else if (
        ARMOR_MAP[lowChoice] &&
        (lowId.includes('armor') || lowId.includes('proficiency'))
      ) {
        addProficiency('armor', choice, 'Class Feature Selection');
      } else if (
        ABILITY_KEY_MAP[lowChoice] &&
        (lowId.includes('save') || lowId.includes('proficiency'))
      ) {
        const ability = normalizeAbilityKey(choice);
        if (ability) addProficiency('saves', ability, 'Class Feature Selection');
      } else if (lowId.includes('language') || lowId.includes('lang')) {
        addProficiency('languages', choice, 'Class Feature Selection');
      }
    });
  });

  // The aggregate field mirrors keyed choices; only unscoped legacy/manual values stand alone.
  state.expertiseSkills?.forEach((value) => {
    const id = normalizeSkillId(value);
    if (!recordedExpertise.has(id)) expertiseRequests.add(id);
  });

  // Expertise only augments independently granted proficiency; it never grants one.
  for (const id of expertiseRequests) {
    if (result.skills.some((skill) => skill.id === id))
      addProficiency('skills', id, 'Expertise Selection');
    else {
      const toolName = (value: string) =>
        translateProficiency(value)
          .replace(/\s*\[.*?\]$/, '')
          .trim();
      const tool = result.tools.find((tool) => toolName(tool.id) === toolName(id));
      if (tool) addProficiency('tools', tool.id, 'Expertise Selection');
    }
  }

  // Detect and record duplicates
  const categories: ProficiencyCategory[] = [
    'skills',
    'saves',
    'tools',
    'weapons',
    'armor',
    'languages',
    'weaponMasteries',
  ];
  for (const category of categories) {
    const list = result[category] as ProficiencySource[];
    list.forEach((prof: ProficiencySource) => {
      if (prof.sources.filter((source) => source !== 'Expertise Selection').length > 1) {
        result.duplicates[`${category}:${prof.id}`] = prof.sources;
      }
    });
  }

  return result;
}

/**
 * 辅助函数：检查角色是否熟练于某种特定武器
 * 考虑了大类熟练（Simple/Martial）和单体熟练
 */
export const isProficientWithWeapon = (weaponId: string, proficiencies: string[]): boolean => {
  const normalize = (value: string) => {
    const base = (findItemById(value)?.nameEn || value.split('|')[0]).toLowerCase().trim();
    return (
      Object.keys(WEAPON_MAP).find((key) => WEAPON_MAP[key] === base) ||
      (base === '简易' || base === '简易武器'
        ? 'simple weapons'
        : base === '军用' || base === '军用武器'
          ? 'martial weapons'
          : base)
    );
  };
  const lowId = normalize(weaponId);
  const profs = proficiencies.map(normalize);

  // 1. 直接匹配 (如 'longsword')
  if (profs.includes(lowId)) return true;

  // 2. 检查大类
  const hasSimple = profs.some((p) => p.includes('simple weapons'));
  const hasMartial = profs.some((p) => p.includes('martial weapons'));

  if (hasMartial && MARTIAL_WEAPONS.includes(lowId)) return true;
  if (hasSimple && SIMPLE_WEAPONS.includes(lowId)) return true;

  // 3. 容错：有些地方可能存的是 'Martial Weapons' 这种带空格的
  if (hasMartial && MARTIAL_WEAPONS.includes(lowId)) return true;

  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// 战斗数值计算辅助函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 计算角色最大生命值
 * 规则：1级取完整生命骰 + CON调整值；之后每级取骰面一半+1 + CON调整值
 */
export function computeMaxHP(state: CharacterState): number {
  if (!state.classes || state.classes.length === 0) return 0;
  const { modifiers } = computeAbilityScores(state);
  const conMod = modifiers.con || 0;
  let totalHP = 0;
  let isFirstLevel = true;

  state.classes.forEach((cEntry) => {
    const classDef = getClassDefinition(cEntry.classId);
    if (!classDef) return;
    const die = classDef.hitPointDie;
    for (let lvl = 1; lvl <= cEntry.level; lvl++) {
      if (isFirstLevel) {
        totalHP += die + conMod;
        isFirstLevel = false;
      } else {
        totalHP += Math.floor(die / 2) + 1 + conMod;
      }
    }
  });

  return Math.max(1, totalHP);
}

/**
 * 计算护甲等级 (AC)
 * 按优先级遍历：装备护甲 > 职业无甲防御特性 > 默认10+DEX
 */
export function computeAC(
  state: CharacterState,
  equippedArmorId?: string | null,
  hasShield?: boolean,
): number {
  const { modifiers } = computeAbilityScores(state);
  const dexMod = modifiers.dex || 0;
  const conMod = modifiers.con || 0;
  const wisMod = modifiers.wis || 0;

  // 收集所有无甲防御计算来源
  const unarmoredACs: number[] = [];

  if (!equippedArmorId) {
    state.classes?.forEach((cEntry) => {
      const classDef = getClassDefinition(cEntry.classId);
      if (!classDef) return;
      classDef.features?.forEach((f) => {
        if (f.level <= cEntry.level && f.mechanics?.acCalculation) {
          const ac = f.mechanics.acCalculation;
          let base = ac.base;
          (ac.modifiers || []).forEach((mod: string) => {
            const key = mod.toLowerCase();
            if (key.includes('dex') || key.includes('敏捷')) base += dexMod;
            if (key.includes('con') || key.includes('体质')) base += conMod;
            if (key.includes('wis') || key.includes('感知')) base += wisMod;
          });
          if (hasShield && ac.canUseShield) base += 2;
          unarmoredACs.push(base);
        }
      });
    });
  }

  if (unarmoredACs.length > 0) return Math.max(...unarmoredACs);

  // 默认：10 + DEX（装备护甲由装备模块覆盖）
  const baseAC = 10 + dexMod;
  return hasShield ? baseAC + 2 : baseAC;
}

/**
 * 计算被动察觉
 * 规则：10 + 察觉技能总加值（包含熟练加值和额外调整）
 */
export function computePassivePerception(perceptionBonus: number, hasAdvantage?: boolean): number {
  return 10 + perceptionBonus + (hasAdvantage ? 5 : 0);
}
