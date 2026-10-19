'use client';

import { useState } from 'react';
import PillButton from '@/components/PillButton';
import {
  getNativeFeatSpellPlans,
  requiresDistinctNativeFeatBlocks,
} from '@/engine/nativeFeatSpells';
import { resolveSpellGrantCandidates } from '@/engine/spellGrantCandidates';
import { translateAbilityKey } from '@/engine/terminology';
import type { CharacterState, FeatChoices } from '@/types/characterState';
import type { Spell } from '@/types/spell';

export default function NativeFeatSpellChoices({
  character,
  candidates,
  slotId,
  onChange,
}: {
  character: CharacterState;
  candidates: Spell[];
  slotId?: string;
  onChange: (selections: NonNullable<CharacterState['featSelections']>) => void;
}) {
  const [search, setSearch] = useState('');
  const plans = getNativeFeatSpellPlans(character).filter(
    ({ slot }) => !slotId || slot.id === slotId,
  );
  if (!plans.length) return null;

  const update = (
    id: string,
    featId: string,
    originId: string,
    patch: Partial<NonNullable<FeatChoices['nativeSpellGrants']>>,
  ) => {
    const selections = { ...character.featSelections };
    const existing = selections[id] || { featId };
    const saved =
      existing.nativeSpellGrants?.originId === originId
        ? existing.nativeSpellGrants
        : { originId, selections: {} };
    selections[id] = { ...existing, featId, nativeSpellGrants: { ...saved, ...patch } };
    onChange(selections);
  };

  return (
    <section aria-label="原生专长法术" style={{ marginBottom: 24 }}>
      <h3>专长额外法术</h3>
      {plans.map(({ slot, characterLevel, grants }) => {
        const saved = character.featSelections?.[slot.id]?.nativeSpellGrants;
        const current = saved?.originId === grants.origin.id ? saved : undefined;
        const block =
          grants.blockRelationship === 'single'
            ? grants.blocks[0]
            : grants.blocks.find((entry) => entry.id === current?.blockId);
        const reserved = requiresDistinctNativeFeatBlocks(grants.origin.id)
          ? new Set(
              Object.entries(character.featSelections || {})
                .filter(
                  ([id, choices]) =>
                    id !== slot.id && choices.nativeSpellGrants?.originId === grants.origin.id,
                )
                .map(([, choices]) => choices.nativeSpellGrants?.blockId),
            )
          : new Set<string | undefined>();
        return (
          <div key={slot.id} style={{ marginBottom: 20 }}>
            <h4>
              {grants.origin.name}（{slot.name}）
            </h4>
            {grants.blockRelationship === 'exclusive' && (
              <div>
                <p>选择一个法术列表</p>
                {grants.blocks.map((entry) => (
                  <PillButton
                    key={entry.id}
                    size="sm"
                    disabled={reserved.has(entry.id)}
                    variant={block?.id === entry.id ? 'primary' : 'outline'}
                    onClick={() =>
                      update(slot.id, slot.currentFeatId!, grants.origin.id, { blockId: entry.id })
                    }
                  >
                    {entry.name || entry.nameEn || entry.id}
                  </PillButton>
                ))}
              </div>
            )}
            {block && (
              <>
                {block.ability?.kind === 'choose' && (
                  <div>
                    <p>选择施法属性</p>
                    {block.ability.from.map((ability) => (
                      <PillButton
                        key={ability}
                        size="sm"
                        variant={current?.ability === ability ? 'primary' : 'outline'}
                        onClick={() =>
                          update(slot.id, slot.currentFeatId!, grants.origin.id, { ability })
                        }
                      >
                        {translateAbilityKey(ability)}
                      </PillButton>
                    ))}
                  </div>
                )}
                {block.ability?.kind === 'fixed' && (
                  <p>施法属性：{translateAbilityKey(block.ability.value)}</p>
                )}
                <label>
                  查找法术{' '}
                  <input value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                {block.rules
                  .filter(
                    (rule) => rule.gate.kind !== 'level' || rule.gate.value! <= characterLevel,
                  )
                  .map((rule) => {
                    const resolved = resolveSpellGrantCandidates(grants.origin, rule, candidates);
                    if (resolved.diagnostics.length)
                      return (
                        <p key={rule.id} role="status">
                          法术候选尚未就绪
                        </p>
                      );
                    if (rule.selection.kind === 'fixed')
                      return (
                        <p key={rule.id}>
                          固定获得：
                          {candidates.find((spell) => spell.id === resolved.spellIds[0])?.name ||
                            resolved.spellIds[0]}
                        </p>
                      );
                    if (rule.selection.kind !== 'choose') return null;
                    const count = rule.selection.count;
                    const selected = current?.selections[rule.id] || [];
                    const options = candidates.filter(
                      (spell) =>
                        resolved.spellIds.includes(spell.id) &&
                        (!search ||
                          selected.includes(spell.id) ||
                          spell.name.includes(search) ||
                          spell.nameEn.toLowerCase().includes(search.toLowerCase())),
                    );
                    return (
                      <div key={rule.id}>
                        <p>
                          {rule.mode === 'known' ? '习得' : '获得'}法术：{selected.length}/{count}
                          {rule.usage.kind !== 'unspecified' ? '（免费施法次数按原文）' : ''}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {options.map((spell) => (
                            <PillButton
                              key={spell.id}
                              size="sm"
                              variant={selected.includes(spell.id) ? 'primary' : 'outline'}
                              onClick={() => {
                                const next = selected.includes(spell.id)
                                  ? selected.filter((id) => id !== spell.id)
                                  : [...(count > 1 ? selected.slice(-(count - 1)) : []), spell.id];
                                update(slot.id, slot.currentFeatId!, grants.origin.id, {
                                  selections: { ...(current?.selections || {}), [rule.id]: next },
                                });
                              }}
                            >
                              {spell.name}
                            </PillButton>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
