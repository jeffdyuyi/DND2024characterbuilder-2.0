'use client';

import { useEffect, useState } from 'react';
import { normalizeEquipmentMode, parseStartingGoldFormula } from '@/engine/startingEquipment';
import type { ClassData } from '@/types/class';
import type { CharacterState } from '@/types/characterState';
import PillButton from '@/components/PillButton';

export default function ClassStartingGoldChoice({
  character,
  definition,
  onChange,
}: {
  character: CharacterState;
  definition: ClassData;
  onChange: (updates: Partial<CharacterState>) => void;
}) {
  const formula = definition.startingEquipment.goldAlternativeFormula;
  const classId = definition.catalogId || character.classes[0]?.classId;
  const recorded =
    character.startingGoldRoll?.classId === classId ? character.startingGoldRoll.amount : undefined;
  const [draft, setDraft] = useState(recorded === undefined ? '' : String(recorded));
  useEffect(() => setDraft(recorded === undefined ? '' : String(recorded)), [classId, recorded]);
  if (!formula || !classId) return null;

  const dice = parseStartingGoldFormula(formula);
  const apply = (amount: number) => {
    if (!Number.isInteger(amount) || amount < 0) return;
    onChange({ equipmentChoiceMode: 'gold', startingGoldRoll: { classId, amount } });
  };

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      <div>方案 B：按 {formula} GP 确定起始金币</div>
      {normalizeEquipmentMode(character.equipmentChoiceMode) === 'gold' &&
        recorded === undefined && <p role="status">当前方案尚未结算，请掷骰或填写金额。</p>}
      {dice && (
        <PillButton
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const amount =
              Array.from(
                { length: dice.count },
                () => Math.floor(Math.random() * dice.faces) + 1,
              ).reduce((sum, die) => sum + die, 0) * dice.multiplier;
            setDraft(String(amount));
            apply(amount);
          }}
        >
          掷骰并选择方案 B
        </PillButton>
      )}
      <label style={{ display: 'block' }}>
        起始金币金额（GP）
        <input
          type="number"
          min="0"
          step="1"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 4,
            padding: '8px 10px',
            color: 'var(--color-text-primary)',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-dark)',
            borderRadius: 8,
          }}
        />
      </label>
      <PillButton
        type="button"
        variant="primary"
        size="sm"
        disabled={draft === '' || !Number.isInteger(Number(draft)) || Number(draft) < 0}
        onClick={() => apply(Number(draft))}
      >
        使用该金额并选择方案 B
      </PillButton>
    </div>
  );
}
