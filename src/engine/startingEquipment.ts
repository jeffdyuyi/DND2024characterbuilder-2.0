import { getEquipmentChoiceCandidates, equipmentTypeLabel } from '@/catalog/equipmentChoices';
import { resolveBackgroundEquipmentChoices } from './backgroundEquipment';
import {
  findItemById,
  findItemByName,
  getBackgroundDefinition,
  getPrimaryClassDefinition,
} from './characterData';
import { translateProficiency } from './terminology';
import type { CharacterState, InventoryEntry } from '@/types/characterState';
import type { Background, BackgroundEquipmentRecord } from '@/types/background';
import type { ClassData, EquipmentRecord } from '@/types/class';
import { totalInCP, fromCPToCurrency } from '@/utils/currencyUtils';
import { defaultCatalog } from '@/catalog/catalog';
type Currency = CharacterState['currency'];

export function normalizeEquipmentMode(
  mode: CharacterState['equipmentChoiceMode'],
): 'package' | 'gold' | 'choiceC' {
  if (mode === 'choiceB' || mode === 'gold') return 'gold';
  return mode === 'choiceC' ? 'choiceC' : 'package';
}

function emptyCurrency(): Currency {
  return { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
}

function parseCurrency(label: string): Partial<Currency> | null {
  const normalized = label.replace(/\s+/g, '').toUpperCase();
  const match = normalized.match(/^(\d+)(PP|GP|EP|SP|CP)$/);
  if (!match) return null;
  return { [match[2].toLowerCase() as keyof Currency]: parseInt(match[1], 10) };
}

export function parseStartingGoldFormula(formula: string) {
  const match = formula.replace(/\s+/g, '').match(/^(\d+)d(\d+)(?:[×x*](\d+))?$/i);
  if (!match) return undefined;
  const count = Number(match[1]);
  const faces = Number(match[2]);
  const multiplier = Number(match[3] || 1);
  return count > 0 && count <= 100 && faces > 0 && faces <= 1000 && multiplier > 0
    ? { count, faces, multiplier }
    : undefined;
}

function mergeCurrency(base: Currency, patch: Partial<Currency>): Currency {
  return {
    cp: base.cp + (patch.cp ?? 0),
    sp: base.sp + (patch.sp ?? 0),
    ep: base.ep + (patch.ep ?? 0),
    gp: base.gp + (patch.gp ?? 0),
    pp: base.pp + (patch.pp ?? 0),
  };
}

function getCategoryFromItem(item?: {
  armorCategory?: string;
  weaponCategory?: string;
}): InventoryEntry['category'] {
  if (!item) return 'other';
  if ('weaponCategory' in item) return 'weapon';
  if (item.armorCategory === 'Shield') return 'shield';
  if (item.armorCategory) return 'armor';
  return 'gear';
}

export function getItemCategory(input: any): InventoryEntry['category'] {
  if (!input) return 'other';

  // 如果输入是字符串，则视为 type 字段进行基础匹配
  if (typeof input === 'string') {
    if (input.includes('武器')) return 'weapon';
    if (input.includes('盾') || input.includes('甲')) return 'armor'; // 盾牌归入护甲
    if (input.includes('工具') || input.includes('赌具') || input.includes('游戏具')) return 'tool';
    return 'gear';
  }

  const item = input;
  const type = item.type || '';
  const tags = item.tags || [];

  if (type.includes('武器') || item.weaponCategory) return 'weapon';
  if (
    type.includes('盾') ||
    item.armorCategory === 'Shield' ||
    type.includes('甲') ||
    item.armorCategory
  )
    return 'armor'; // 盾牌归入护甲
  if (
    tags.includes('工匠工具') ||
    tags.includes('游戏具') ||
    tags.includes('游戏') ||
    tags.includes('乐器') ||
    type.includes('工具') ||
    type.includes('赌具')
  )
    return 'tool';
  if (tags.includes('坐骑') || tags.includes('载具')) return 'vehicle';
  if (
    type.includes('弹药') ||
    type.includes('法器') ||
    type.includes('套组') ||
    type.includes('杂物') ||
    tags.includes('冒险道具')
  )
    return 'gear';
  return 'other';
}

export function expandEquipmentOptions(choiceA: (string | { options: string[] })[]): string[] {
  let combinations: string[][] = [[]];

  choiceA.forEach((entry) => {
    if (typeof entry === 'string') {
      combinations = combinations.map((combo) => [...combo, entry]);
      return;
    }

    const next: string[][] = [];
    entry.options.forEach((option) => {
      combinations.forEach((combo) => next.push([...combo, option]));
    });
    combinations = next;
  });

  return combinations.map((combo) => combo.join('，'));
}

function parseLabelWithQuantity(label: string) {
  // 匹配形如 "2把匕首", "10支箭", "5GP" 的模式
  // 1. 尝试匹配阿拉伯数字开头的情况
  const match = label.match(
    /^(\d+)\s*(把|支|个|件|条|双|套|枚|张|份|瓶|卷|副|包|盒|根|GP|SP|CP|PP|EP)?\s*(.*)$/i,
  );
  if (match) {
    const qty = parseInt(match[1], 10);
    const unit = match[2];
    const rest = match[3].trim();

    // 如果单位是货币，直接返回货币
    if (['GP', 'SP', 'CP', 'PP', 'EP'].includes(unit?.toUpperCase())) {
      return { quantity: qty, name: unit.toUpperCase(), isCurrency: true };
    }

    return { quantity: qty, name: rest || unit };
  }

  // 2. 尝试匹配中文数字量词开头的情况 (如 "一枚俄佐立徽章", "一套高档服装", "一瓶蓝墨水")
  const matchCn = label.match(
    /^([一二三四五六七八九十两])\s*(把|支|个|件|条|双|套|枚|张|份|瓶|卷|副|包|盒|根)\s*(.*)$/,
  );
  if (matchCn) {
    const cnDigits: Record<string, number> = {
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    const qty = cnDigits[matchCn[1]] || 1;
    const rest = matchCn[3].trim();
    return { quantity: qty, name: rest };
  }

  return { quantity: 1, name: label };
}

function labelsToInventoryEntries(labels: string[], source: string) {
  const inventoryEntries: InventoryEntry[] = [];
  let currency = emptyCurrency();

  // 若传入的标签包含逗号、连词等复合长句，先平铺拆解
  const flattened: string[] = [];
  labels.forEach((l) => {
    if (typeof l !== 'string') return;
    if (l.includes('，') || l.includes('、') || l.includes('以及') || l.includes('还有')) {
      const parts = l
        .split(/[，,;；、]|(?:\s*以及\s*|\s*还有\s*)/)
        .map((p) => p.trim())
        .filter(Boolean);
      flattened.push(...parts);
    } else {
      flattened.push(l);
    }
  });

  flattened.forEach((label) => {
    const trimmed = label.trim();
    if (!trimmed) return;

    // 检查并提取内含货币，例如 "小包（内含 10 GP）" 或 "一条腰带小包内装有10gp"
    const embeddedCurMatch = trimmed.match(
      /(?:[（(]?内含|[（(]?内装有|装有)\s*(\d+)\s*(GP|SP|CP|PP|EP)[）)]?/i,
    );
    let cleanTrimmed = trimmed;
    if (embeddedCurMatch) {
      const amt = parseInt(embeddedCurMatch[1], 10);
      const curType = embeddedCurMatch[2].toLowerCase() as keyof Currency;
      currency = mergeCurrency(currency, { [curType]: amt });
      cleanTrimmed = trimmed
        .replace(/(?:[（(]?内含|[（(]?内装有|装有)\s*(\d+)\s*(GP|SP|CP|PP|EP)[）)]?/i, '')
        .replace(/[（(].*?[）)]/g, '')
        .trim();
    }

    // 首先尝试解析整条为货币
    const parsedCurrency = parseCurrency(cleanTrimmed);
    if (parsedCurrency) {
      currency = mergeCurrency(currency, parsedCurrency);
      return;
    }

    // 解析数量与名称
    const { quantity, name, isCurrency } = parseLabelWithQuantity(cleanTrimmed);

    if (isCurrency) {
      const curKey = name.toLowerCase() as keyof Currency;
      currency = mergeCurrency(currency, { [curKey]: quantity });
      return;
    }

    if (!name) return;

    // 尝试根据名称搜索物品
    const matchedItem = findItemByName(name);

    inventoryEntries.push({
      id: matchedItem ? `${source}:${matchedItem.id}` : `${source}:${trimmed}`,
      name: matchedItem?.name || name,
      source,
      quantity,
      category: getItemCategory(matchedItem),
      itemId: matchedItem?.id,
      weight: matchedItem?.weight,
    });
  });

  return { inventoryEntries, currency };
}

function toInventoryCategory(
  category?: BackgroundEquipmentRecord['category'],
): InventoryEntry['category'] {
  if (category === 'weapon' || category === 'armor' || category === 'shield') return category;
  if (category === 'tool' || category === 'gear') return 'gear';
  return 'other';
}

function resolveSelectableItemId(selectedValue: string): string | undefined {
  if (!selectedValue) return undefined;
  const cleanId = selectedValue.split('|')[0].trim();
  const cleanName = selectedValue.replace(/\s*\[.*?\]$/, '').trim();
  const normalized = cleanId.toLowerCase();

  // 1. 尝试通过翻译名查找 (解决 ID 映射问题)
  // 如果选中了 'alchemistSupplies', translateProficiency 会返回 '炼金工具'
  // 然后 findItemByName 会找到 'alchemists-supplies-full'
  const name = translateProficiency(selectedValue);
  if (name && name !== selectedValue) {
    const item = findItemByName(name) || findItemByName(cleanName);
    if (item) return item.id;
  }

  // 2. 优先尝试直接在物品库中查找
  const item =
    findItemByName(selectedValue) ||
    findItemByName(cleanName) ||
    findItemById(selectedValue) ||
    findItemById(cleanId);
  if (item) return item.id;

  // 3. 类别回退 (针对模糊匹配)
  if (
    normalized.includes('bagpipes') ||
    normalized.includes('drum') ||
    normalized.includes('dulcimer') ||
    normalized.includes('flute') ||
    normalized.includes('lute') ||
    normalized.includes('lyre') ||
    normalized.includes('horn') ||
    normalized.includes('pan flute') ||
    normalized.includes('shawm') ||
    normalized.includes('viol') ||
    normalized.includes('musical') ||
    normalized.includes('instrument')
  ) {
    return 'musical-instruments-full';
  }

  if (
    normalized.includes('supplies') ||
    normalized.includes('tools') ||
    normalized.includes('utensils') ||
    normalized.includes('artisan')
  ) {
    return 'artisan-tools-full';
  }

  if (normalized.includes('set') || normalized.includes('gaming')) {
    return 'gaming-set-full';
  }

  return undefined;
}

function resolveEquipmentRecord(
  record: EquipmentRecord | BackgroundEquipmentRecord,
  sourceName: string,
  character: CharacterState,
) {
  if (record.kind === 'currency') {
    return {
      inventoryEntries: [] as InventoryEntry[],
      currency: mergeCurrency(emptyCurrency(), record.currency || {}),
    };
  }

  const reference = 'itemReference' in record ? record.itemReference : undefined;
  const equipmentType = 'equipmentType' in record ? record.equipmentType : undefined;
  let resolvedItemId = record.itemId;
  if (equipmentType && record.selectionId) {
    const selected = character.classSelections?.[record.selectionId]?.[0];
    resolvedItemId = getEquipmentChoiceCandidates(record as EquipmentRecord).find(
      (item) => item.id === selected,
    )?.id;
  }
  if (reference) {
    const normalize = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[-_\s]+/g, '');
    const candidates = ['item', 'baseitem'] as const;
    const matches = candidates
      .flatMap((kind) => defaultCatalog.list(kind))
      .filter(
        (entry) =>
          entry.sourcePackId === reference.sourcePackId &&
          (!reference.source || entry.source.toLowerCase() === reference.source.toLowerCase()) &&
          [entry.name, entry.englishName || ''].some(
            (name) => normalize(name) === normalize(reference.name),
          ),
      );
    resolvedItemId = matches.length === 1 ? matches[0].id : undefined;
  }
  let resolvedLabel = record.label;
  let extraCurrency = record.currency
    ? mergeCurrency(emptyCurrency(), record.currency)
    : emptyCurrency();

  // 防御性处理：若 label 仍混有末尾货币（如 "旅行服装， 30 GP" 或 "旅行服装 30 GP"），提取货币并净化装备名
  const compoundMatch = resolvedLabel.match(
    /(?:[，,\s]+|\s+)(\d+)\s*(GP|SP|CP|PP|EP|金币|银币|铜币|枚金币|枚)$/i,
  );
  if (compoundMatch && !reference) {
    const amt = parseInt(compoundMatch[1], 10);
    const unit = compoundMatch[2].toLowerCase();
    const curKey: keyof Currency =
      unit === '金币' || unit === 'gp' || unit === '枚' || unit === '枚金币'
        ? 'gp'
        : unit === '银币' || unit === 'sp'
          ? 'sp'
          : unit === '铜币' || unit === 'cp'
            ? 'cp'
            : (unit as keyof Currency);
    extraCurrency = mergeCurrency(extraCurrency, { [curKey]: amt });
    resolvedLabel = resolvedLabel.slice(0, compoundMatch.index).trim();
    if (!resolvedItemId) {
      const found = findItemByName(resolvedLabel);
      if (found) resolvedItemId = found.id;
    }
  }

  // 处理自选项 (Selection)
  if (!reference && !equipmentType && !resolvedItemId && record.selectionId) {
    const selectedValue =
      character.backgroundSelections?.[record.selectionId]?.[0] ||
      character.classSelections?.[record.selectionId]?.[0];
    if (selectedValue) {
      resolvedLabel = `${record.label}：${selectedValue}`;
      resolvedItemId = resolveSelectableItemId(selectedValue);
    }
  }

  const resolvedItem = resolvedItemId ? findItemById(resolvedItemId) : undefined;
  const itemId = resolvedItem?.id;

  return {
    inventoryEntries: [
      {
        id: itemId
          ? `${sourceName}:${record.selectionId ? record.selectionId + ':' : ''}${itemId}:${resolvedLabel}`
          : `${sourceName}-unresolved:${record.selectionId ? record.selectionId + ':' : ''}${reference ? `${reference.sourcePackId}:${reference.source || ''}:${reference.name}:` : ''}${resolvedLabel}`,
        name: resolvedItem?.name || resolvedLabel,
        quantity: record.quantity,
        source: sourceName,
        category: record.category
          ? toInventoryCategory(record.category as any)
          : getItemCategory(resolvedItem),
        itemId,
        weight: resolvedItem?.weight,
        notes: itemId
          ? undefined
          : reference
            ? `未找到唯一的同来源物品，保留原始引用：${reference.name}|${reference.source || ''} [${reference.sourcePackId}]`
            : '未映射到具体物品数据，保留原文记录',
      },
    ],
    currency: extraCurrency,
  };
}

function buildBackgroundEquipmentState(
  background: Background | undefined,
  character: CharacterState,
) {
  if (!background?.equipment) {
    return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
  }

  const selectedChoice = character.backgroundSelections?.[`bg:${background.id}:equipment`]?.[0];
  const useChoiceB = selectedChoice === 'choiceB';
  const records = resolveBackgroundEquipmentChoices(background, character.backgroundSelections);

  if (records.length > 0) {
    return records.reduce(
      (acc, record) => {
        const resolved = resolveEquipmentRecord(record, '背景起始装备', character);
        acc.inventoryEntries.push(...resolved.inventoryEntries);
        acc.currency = mergeCurrency(acc.currency, resolved.currency);
        return acc;
      },
      { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() },
    );
  }

  if (!useChoiceB && background.equipment.choiceA.length) {
    return labelsToInventoryEntries(
      background.equipment.choiceA as string[],
      `背景: ${background.name}`,
    );
  }

  if (useChoiceB && background.equipment.choiceB) {
    const parsedCurrency = parseCurrency(background.equipment.choiceB);
    return {
      inventoryEntries: [] as InventoryEntry[],
      currency: parsedCurrency ? mergeCurrency(emptyCurrency(), parsedCurrency) : emptyCurrency(),
    };
  }

  return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
}

export function resolveClassEquipmentRows(definition: ClassData, character: CharacterState) {
  const rows = definition.startingEquipment.choiceRows || [];
  let recovered: Record<string, string> | undefined;
  let ambiguous = false;
  const savedPackage = character.selectedClassPackage?.replace(
    /自选([A-Za-z]+)/g,
    (_, type: string) => equipmentTypeLabel(type),
  );
  if (savedPackage && !rows.some((row) => character.classSelections?.[row.id]?.length)) {
    const seek = (index: number, labels: string[], selected: Record<string, string>): void => {
      if (ambiguous) return;
      if (index === rows.length) {
        if (labels.join('，') !== savedPackage) return;
        if (recovered) ambiguous = true;
        else recovered = selected;
        return;
      }
      const row = rows[index];
      for (const option of row.options.length ? row.options : [undefined]) {
        const nextLabels = [...labels, row.fixedLabel, option?.label || ''].filter(Boolean);
        if (!savedPackage.startsWith(nextLabels.join('，'))) continue;
        seek(index + 1, nextLabels, option ? { ...selected, [row.id]: option.id } : selected);
      }
    };
    seek(0, [], {});
  }
  return rows.map((row) => {
    const selectedId =
      character.classSelections?.[row.id]?.[0] ?? (ambiguous ? undefined : recovered?.[row.id]);
    const selected =
      ambiguous && !character.classSelections?.[row.id]?.length
        ? undefined
        : selectedId === undefined
          ? row.options[0]
          : row.options.find((option) => option.id === selectedId);
    return { row, selected };
  });
}

function buildClassEquipmentState(
  primaryClass: ClassData | undefined,
  character: CharacterState,
  mode: 'package' | 'gold' | 'choiceC',
  selectedPackageText?: string,
) {
  if (!primaryClass) return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };

  const { startingEquipment } = primaryClass;

  // --- 方案 B 处理 (通常标记为 gold) ---
  if (mode === 'gold') {
    if (startingEquipment.goldAlternativeFormula) {
      const roll = character.startingGoldRoll;
      return {
        inventoryEntries: [] as InventoryEntry[],
        currency: {
          ...emptyCurrency(),
          gp:
            roll?.classId === (primaryClass.catalogId || character.classes[0]?.classId) &&
            Number.isInteger(roll.amount) &&
            roll.amount >= 0
              ? roll.amount
              : 0,
        },
      };
    }
    // 优先尝试结构化记录 (如战士的方案B包含单品)
    const choiceBRecord = (startingEquipment as any).choiceBRecord;
    if (choiceBRecord) {
      const records = Array.isArray(choiceBRecord) ? choiceBRecord : [choiceBRecord];
      return records.reduce(
        (acc, record) => {
          const resolved = resolveEquipmentRecord(
            record,
            `职业: ${primaryClass.name} (方案B)`,
            character,
          );
          acc.inventoryEntries.push(...resolved.inventoryEntries);
          acc.currency = mergeCurrency(acc.currency, resolved.currency);
          return acc;
        },
        { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() },
      );
    }

    // B既可能是金币，也可能是包含金币的装备套组。
    if (startingEquipment.choiceB) {
      return labelsToInventoryEntries(
        startingEquipment.choiceB
          .split(/[，,]/)
          .map((label) => label.trim())
          .filter(Boolean),
        `职业: ${primaryClass.name} (方案B)`,
      );
    }
    return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
  }

  // --- 方案 C 处理 ---
  if (mode === 'choiceC') {
    const choiceCRecord = (startingEquipment as any).choiceCRecord;
    if (choiceCRecord) {
      const records = Array.isArray(choiceCRecord) ? choiceCRecord : [choiceCRecord];
      return records.reduce(
        (acc, record) => {
          const resolved = resolveEquipmentRecord(
            record,
            `职业: ${primaryClass.name} (方案C)`,
            character,
          );
          acc.inventoryEntries.push(...resolved.inventoryEntries);
          acc.currency = mergeCurrency(acc.currency, resolved.currency);
          return acc;
        },
        { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() },
      );
    }

    if (startingEquipment.choiceC) {
      const labels = startingEquipment.choiceC
        .split(/[，,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return labelsToInventoryEntries(labels, `职业: ${primaryClass.name} (方案C)`);
    }
    return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
  }

  // --- 方案 A 处理 (通常标记为 package) ---
  const classPackageOptions = expandEquipmentOptions(startingEquipment.choiceA || []);
  const effectivePackageText =
    selectedPackageText && classPackageOptions.includes(selectedPackageText)
      ? selectedPackageText
      : classPackageOptions[0];

  const choiceARecords = startingEquipment.choiceRows
    ? resolveClassEquipmentRows(primaryClass, character).flatMap(({ row, selected }) => [
        ...row.fixedRecords,
        ...(selected?.records || []),
      ])
    : startingEquipment.choiceARecords;
  if (choiceARecords && (choiceARecords.length > 0 || startingEquipment.choiceRows)) {
    const filteredRecords = choiceARecords.filter(
      (r) => !r.optionName || r.optionName === effectivePackageText,
    );
    return filteredRecords.reduce(
      (acc, record) => {
        const resolved = resolveEquipmentRecord(
          record,
          `职业: ${primaryClass.name} (方案A)`,
          character,
        );
        acc.inventoryEntries.push(...resolved.inventoryEntries);
        acc.currency = mergeCurrency(acc.currency, resolved.currency);
        return acc;
      },
      { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() },
    );
  }

  if (effectivePackageText) {
    const packageLabels = effectivePackageText
      .split(/[，,]/)
      .map((p) => p.trim())
      .filter(Boolean);
    return labelsToInventoryEntries(packageLabels, `职业: ${primaryClass.name} (方案A)`);
  }

  return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
}

export function buildEquipmentState(
  character: CharacterState,
  mode: CharacterState['equipmentChoiceMode'],
  selectedPackage?: string,
) {
  const primaryClass = getPrimaryClassDefinition(character);
  const background = getBackgroundDefinition(character);

  const backgroundResult = buildBackgroundEquipmentState(background, character);
  const classResult = buildClassEquipmentState(
    primaryClass,
    character,
    normalizeEquipmentMode(mode),
    selectedPackage,
  );

  const inventoryEntries: InventoryEntry[] = [
    ...backgroundResult.inventoryEntries,
    ...classResult.inventoryEntries,
  ];
  const currency = mergeCurrency(backgroundResult.currency, classResult.currency);

  return { inventoryEntries, currency };
}

function resolveClassEquipmentMode(character: CharacterState) {
  const mode = normalizeEquipmentMode(character.equipmentChoiceMode);
  const definition = getPrimaryClassDefinition(character);
  return mode === 'choiceC' && definition && !definition.startingEquipment.choiceC
    ? 'package'
    : mode;
}

/** 两页共用的发放差量；旧角色首次同步按用户确认的当前方案重算金币。 */
export function getStartingEquipmentKey(character: CharacterState): string {
  const mode = resolveClassEquipmentMode(character);
  const grant = buildEquipmentState(character, mode, character.selectedClassPackage);
  return JSON.stringify([
    character.classes?.[0]?.classId,
    character.classes?.[0]?.source,
    character.backgroundId,
    mode,
    grant.inventoryEntries.map(({ id, itemId, name, quantity, source }) => ({
      id,
      itemId,
      name,
      quantity,
      source,
    })),
    grant.currency,
  ]);
}

export function reconcileStartingEquipment(
  current: CharacterState,
  next: CharacterState,
): Partial<CharacterState> {
  const definition = getPrimaryClassDefinition(next);
  let mode = resolveClassEquipmentMode(next);
  if (mode === 'gold' && definition?.startingEquipment.goldAlternativeFormula) {
    const roll = next.startingGoldRoll;
    const valid =
      roll?.classId === (definition.catalogId || next.classes[0]?.classId) &&
      Number.isInteger(roll.amount) &&
      roll.amount >= 0;
    if (!valid) {
      if (current.classes[0]?.classId !== next.classes[0]?.classId) mode = 'package';
      else throw new Error('请先掷骰或填写起始金币金额；本次未更改方案和库存。');
    }
  }
  if (
    definition?.startingEquipment.choiceRows &&
    resolveClassEquipmentRows(definition, next).some(
      ({ row, selected }) => row.options.length > 0 && !selected,
    )
  ) {
    throw new Error('装备组选项无法唯一匹配，请先重新选择；本次未更改库存和金币。');
  }
  const options = expandEquipmentOptions(definition?.startingEquipment.choiceA || []);
  const selectedClassPackage = definition?.startingEquipment.choiceRows
    ? resolveClassEquipmentRows(definition, next)
        .flatMap(({ row, selected }) => [row.fixedLabel, selected?.label || ''])
        .filter(Boolean)
        .join('，')
    : next.selectedClassPackage && options.includes(next.selectedClassPackage)
      ? next.selectedClassPackage
      : options[0];
  const normalized = { ...next, equipmentChoiceMode: mode, selectedClassPackage };
  const key = getStartingEquipmentKey(normalized);
  if (current.startingEquipmentSynced && current.startingEquipmentGrant?.key === key) {
    return { equipmentChoiceMode: mode, selectedClassPackage };
  }
  const grant = buildEquipmentState(normalized, mode, selectedClassPackage);
  const previous = current.startingEquipmentGrant;
  const oldIds = new Set(
    previous?.inventoryIds ||
      current.inventoryEntries
        .filter((entry) => {
          const source = entry.source;
          return (
            source &&
            /^(职业|背景): /.test(source) &&
            (entry.id.startsWith(source + ':') || entry.id.startsWith(source + '-unresolved:'))
          );
        })
        .map((entry) => entry.id),
  );
  const preserved = current.inventoryEntries.filter((entry) => !oldIds.has(entry.id));
  const inventoryEntries = [
    ...grant.inventoryEntries.map((entry) => {
      const existing = current.inventoryEntries.find(
        (item) => oldIds.has(item.id) && item.id === entry.id,
      );
      return existing
        ? {
            ...entry,
            equipped: existing.equipped,
            notes: existing.notes,
            locationId: existing.locationId,
            versatileTwoHanded: existing.versatileTwoHanded,
          }
        : entry;
    }),
    ...preserved,
  ];
  let currency = previous?.currency ? current.currency : grant.currency;
  if (previous?.currency) {
    const delta = totalInCP(grant.currency) - totalInCP(previous.currency);
    if (totalInCP(current.currency) + delta < 0) {
      throw new Error('当前余额不足以扣回原方案的起始金币，请先核对余额；本次未更改方案和库存。');
    }
    if (delta !== 0) currency = fromCPToCurrency(totalInCP(current.currency) + delta);
  }
  const liveIds = new Set(inventoryEntries.map((entry) => entry.id));
  const oldItemIds = new Set(
    current.inventoryEntries.filter((entry) => oldIds.has(entry.id)).map((entry) => entry.itemId),
  );
  return {
    equipmentChoiceMode: mode,
    selectedClassPackage,
    inventoryEntries,
    equipmentIds: Array.from(
      new Set([
        ...current.equipmentIds.filter((id) => !oldItemIds.has(id)),
        ...inventoryEntries.flatMap((entry) => (entry.itemId ? [entry.itemId] : [])),
      ]),
    ),
    currency,
    equippedArmorId:
      oldIds.has(current.equippedArmorId || '') && !liveIds.has(current.equippedArmorId!)
        ? undefined
        : current.equippedArmorId,
    equippedShieldId:
      oldIds.has(current.equippedShieldId || '') && !liveIds.has(current.equippedShieldId!)
        ? undefined
        : current.equippedShieldId,
    equippedWeaponIds: current.equippedWeaponIds.filter((id) => !oldIds.has(id) || liveIds.has(id)),
    attunedItemIds: current.attunedItemIds.filter((id) => !oldIds.has(id) || liveIds.has(id)),
    startingEquipmentSynced: true,
    startingEquipmentGrant: {
      key,
      inventoryIds: grant.inventoryEntries.map((entry) => entry.id),
      currency: grant.currency,
    },
  };
}
