'use client';
import { useBuilderChoices } from '@/platform/useBuilderChoices';
import type { CharacterState } from '@/types/characterState';
import type { ClassData } from '@/types/class';
import { resolveClassEquipmentRows } from '@/engine/startingEquipment';
import { getEquipmentChoiceCandidates } from '@/catalog/equipmentChoices';
import { getSourceDisplayName } from '@/config/sourceMapping';
import PillButton from './PillButton';

export default function ClassEquipmentChoices({
  character,
  definition,
  onChange,
}: {
  character: CharacterState;
  definition: ClassData;
  onChange: (updates: Partial<CharacterState>) => void;
}) {
  useBuilderChoices(); // 目录分批加载或来源设置改变时刷新候选。
  const rows = resolveClassEquipmentRows(definition, character);
  const records = rows.length
    ? rows.flatMap(({ row, selected }) => [...row.fixedRecords, ...(selected?.records || [])])
    : definition.startingEquipment.choiceARecords || [];
  const change = (key: string, value: string) => {
    const selections = { ...character.classSelections };
    for (const { row, selected } of rows) if (selected) selections[row.id] = [selected.id];
    selections[key] = [value];
    onChange({ classSelections: selections, selectedClassPackage: undefined });
  };
  return (
    <div>
      {rows.map(({ row, selected }, index) => (
        <div key={row.id} style={{ marginTop: 14 }}>
          {row.options.length > 0 && (
            <div role="group" aria-label={'装备组选项 ' + (index + 1)}>
              <span>装备组 {index + 1}：</span>
              {row.options.map((option) => (
                <PillButton
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={option.id === selected?.id ? 'primary' : 'outline'}
                  aria-pressed={option.id === selected?.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    change(row.id, option.id);
                  }}
                >
                  {option.label}
                </PillButton>
              ))}
              {!selected && <p role="status">原选项未匹配，请重新选择。</p>}
            </div>
          )}
        </div>
      ))}
      {records
        .filter((record) => record.equipmentType && record.selectionId)
        .map((record) => {
          const candidates = getEquipmentChoiceCandidates(record, character);
          const chosen = character.classSelections?.[record.selectionId!]?.[0];
          const oldChoice =
            chosen && !candidates.some((item) => item.id === chosen) ? chosen : undefined;
          return (
            <div
              key={record.selectionId}
              role="group"
              aria-label={record.label}
              style={{ marginTop: 10 }}
            >
              <div>{record.label}：</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {candidates.map((item) => (
                  <PillButton
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={item.id === chosen ? 'primary' : 'outline'}
                    aria-pressed={item.id === chosen}
                    onClick={(event) => {
                      event.stopPropagation();
                      change(record.selectionId!, item.id);
                    }}
                  >
                    {item.name} [{getSourceDisplayName(item.source)}]
                    {item.isHomebrew ? ' [' + item.sourcePackId + ']' : ''}
                  </PillButton>
                ))}
              </div>
              {candidates.length === 0 && <p role="status">该类别尚无可用候选，保留未解决记录。</p>}
              {oldChoice && <p role="status">已有选择当前不在候选中，原记录保留，未自动替换。</p>}
            </div>
          );
        })}
    </div>
  );
}
