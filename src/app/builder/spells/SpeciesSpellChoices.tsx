import type { CharacterState } from '@/types/characterState';
import type { Spell } from '@/types/spell';
import { getSpeciesSpellChoiceSlots } from '@/engine/speciesSpellChoiceSlots';
import PillButton from '@/components/PillButton';

export default function SpeciesSpellChoices({
  character,
  candidates,
  onChange,
}: {
  character: CharacterState;
  candidates: Spell[];
  onChange: (selections: NonNullable<CharacterState['speciesSelections']>) => void;
}) {
  const slots = getSpeciesSpellChoiceSlots(character);
  if (!slots.length) return null;
  return (
    <section aria-label="种族法术选择" style={{ marginBottom: 24 }}>
      <h3>种族法术选择</h3>
      <p>与种族页共用选择；施法属性等其他配置仍可在种族页调整。</p>
      {slots.map((slot) => (
        <div key={slot.key} style={{ marginBottom: 12 }}>
          <h4>
            {slot.label}：选择 {slot.count} 项
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {candidates
              .filter((spell) => slot.optionIds.includes(spell.id))
              .map((spell) => (
                <PillButton
                  key={spell.id}
                  size="sm"
                  variant={slot.selectedIds.includes(spell.id) ? 'primary' : 'outline'}
                  onClick={() => {
                    const next = slot.selectedIds.includes(spell.id)
                      ? slot.selectedIds.filter((id) => id !== spell.id)
                      : [...slot.selectedIds, spell.id].slice(-slot.count);
                    onChange({ ...character.speciesSelections, [slot.key]: next });
                  }}
                >
                  {spell.name}
                </PillButton>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
