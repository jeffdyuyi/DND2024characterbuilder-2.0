import type { InnateSpellSource } from '@/engine/spellcasting';
import { getSpellDefinition } from '@/engine/characterData';

/** 只呈现来源页已生效的记录，不另存选择或改变职业名额。 */
export default function SourceGrantedSpells({ grants }: { grants: InnateSpellSource[] }) {
  if (!grants.length) return null;
  const rows = new Map<string, Set<string>>();
  for (const grant of grants) {
    const sources = rows.get(grant.spellId) || new Set<string>();
    sources.add(grant.source);
    rows.set(grant.spellId, sources);
  }
  return (
    <section aria-label="来源页已获得的法术" style={{ marginBottom: 24 }}>
      <h3>已获得的额外法术</h3>
      <p>按当前角色等级汇总各来源已获得的法术。可返回对应页面调整配置。</p>
      <ul>
        {[...rows].map(([spellId, sources]) => (
          <li key={spellId}>
            {getSpellDefinition(spellId)?.name || spellId}（{[...sources].join('；')}）
          </li>
        ))}
      </ul>
    </section>
  );
}
