import { Background, BackgroundEquipmentRecord } from '@/types/background';

/** 读取背景页现有的选择键；不改写存档，也不把风味物品猜测成 Catalog 装备。 */
export function resolveBackgroundEquipmentChoices(
  background: Background,
  selections: Record<string, string[]> = {},
): BackgroundEquipmentRecord[] {
  const useGold = selections[`bg:${background.id}:equipment`]?.[0] === 'choiceB';
  if (useGold)
    return background.equipment.choiceBRecord ? [background.equipment.choiceBRecord] : [];
  return (background.equipment.choiceARecords || []).flatMap((record) => {
    if (!record.choices || !record.selectionId) return [record];
    const key = `bg:${background.id}:${record.selectionId}`;
    const selected = selections[key]?.[0];
    return selected && record.choices[selected] ? record.choices[selected] : [record];
  });
}
