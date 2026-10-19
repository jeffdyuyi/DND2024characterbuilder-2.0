'use client';

import { useState } from 'react';
import PillButton from '@/components/PillButton';
import {
  canRecordNativeFeatLevelReplacement,
  getActiveNativeFeatRuleSelections,
  getNativeFeatSpellPlans,
  requiresDistinctNativeFeatBlocks,
} from '@/engine/nativeFeatSpells';
import { resolveSpellGrantCandidates } from '@/engine/spellGrantCandidates';
import { translateAbilityKey } from '@/engine/terminology';
import type { CharacterState, FeatChoices } from '@/types/characterState';
import type { Spell } from '@/types/spell';
import type { ParsedSpellGrants } from '@/types/spellGrant';

function NativeFeatLevelReplacement({
  block,
  origin,
  saved,
  candidates,
  level,
  acquiredLevel,
  onChange,
}: {
  block: ParsedSpellGrants['blocks'][number];
  origin: ParsedSpellGrants['origin'];
  saved: NonNullable<FeatChoices['nativeSpellGrants']>;
  candidates: Spell[];
  level: number;
  acquiredLevel: number;
  onChange: (replacements: NonNullable<FeatChoices['nativeSpellGrants']>['replacements']) => void;
}) {
  const existing = saved.replacements?.[level];
  const [from, setFrom] = useState(
    existing ? JSON.stringify([existing.ruleId, existing.from]) : '',
  );
  const choices = block.rules.flatMap((rule) => {
    if (rule.selection.kind !== 'choose') return [];
    const resolved = resolveSpellGrantCandidates(origin, rule, candidates);
    if (resolved.diagnostics.length) return [];
    return getActiveNativeFeatRuleSelections(
      saved,
      rule,
      resolved.spellIds,
      level - 1,
      acquiredLevel,
      true,
    ).map((id) => ({ rule, id }));
  });
  if (!choices.length) return null;
  const current = choices.find((choice) => JSON.stringify([choice.rule.id, choice.id]) === from);
  const pool = current
    ? resolveSpellGrantCandidates(origin, current.rule, candidates).spellIds
    : [];
  const prior = current
    ? getActiveNativeFeatRuleSelections(saved, current.rule, pool, level - 1, acquiredLevel, true)
    : [];
  const targets = candidates.filter(
    (spell) => pool.includes(spell.id) && spell.id !== current?.id && !prior.includes(spell.id),
  );
  return (
    <details style={{ marginTop: 12 }} open={Boolean(existing)}>
      <summary>角色 {level} 级：替换一道同列表、同环阶法术（可选）</summary>
      <select
        aria-label="要替换的法术"
        value={from}
        onChange={(event) => setFrom(event.target.value)}
      >
        <option value="">选择原法术</option>
        {choices.map(({ rule, id }) => (
          <option key={`${rule.id}:${id}`} value={JSON.stringify([rule.id, id])}>
            {candidates.find((spell) => spell.id === id)?.name || id}
          </option>
        ))}
      </select>
      <select
        aria-label="替换成的法术"
        value={
          current && existing?.from === current.id && existing.ruleId === current.rule.id
            ? existing.to
            : ''
        }
        disabled={!current}
        onChange={(event) => {
          const replacements = { ...saved.replacements };
          if (current && event.target.value)
            replacements[level] = {
              ruleId: current.rule.id,
              from: current.id,
              to: event.target.value,
            };
          else delete replacements[level];
          onChange(replacements);
        }}
      >
        <option value="">不替换</option>
        {targets.map((spell) => (
          <option key={spell.id} value={spell.id}>
            {spell.name}
          </option>
        ))}
      </select>
    </details>
  );
}

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
                          {characterLevel > (slot.level || 1) &&
                          canRecordNativeFeatLevelReplacement(character, slot, grants.origin.id)
                            ? '初始'
                            : ''}
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
                {current &&
                  canRecordNativeFeatLevelReplacement(character, slot, grants.origin.id) &&
                  Array.from(
                    { length: Math.max(0, characterLevel - (slot.level || 1)) },
                    (_, index) => (slot.level || 1) + index + 1,
                  ).map((level) => (
                    <NativeFeatLevelReplacement
                      key={`${slot.id}:${level}:${block.id}`}
                      block={block}
                      origin={grants.origin}
                      saved={current}
                      candidates={candidates}
                      level={level}
                      acquiredLevel={slot.level || 1}
                      onChange={(replacements) =>
                        update(slot.id, slot.currentFeatId!, grants.origin.id, { replacements })
                      }
                    />
                  ))}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
