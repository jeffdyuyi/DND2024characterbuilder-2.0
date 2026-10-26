import Link from 'next/link';
import type { ClassFeature } from '@/types/class';

export function featureConfigurationPage(feature: ClassFeature): 'spells' | 'feats' | undefined {
  const choices = feature.mechanics?.choices || [];
  const title = `${feature.name} ${feature.nameEn || ''}`;
  if (
    choices.some((choice) => choice.type === 'feat') ||
    /ability score improvement|属性值提升|属性提升|epic boon|传奇恩惠/i.test(title)
  )
    return 'feats';
  if (
    choices.some((choice) => choice.type === 'spell') ||
    /^(施法|契约魔法|契约施法|魔契魔法)\s|spellcasting|pact magic/i.test(title)
  )
    return 'spells';
  return undefined;
}

export default function ClassFeatureGuidance({
  page,
  characterId,
}: {
  page: 'spells' | 'feats';
  characterId?: string;
}) {
  const label = page === 'spells' ? '法术' : '专长';
  return (
    <div
      style={{
        marginTop: 16,
        padding: '16px 20px',
        border: '1px solid var(--color-border-dark)',
        borderRadius: 14,
        background: 'var(--color-bg-dark)',
      }}
    >
      <strong>{label}配置</strong>
      <p style={{ margin: '8px 0 0' }}>
        {page === 'spells'
          ? '初始法术、后续新增与替换，请前往法术页面按职业和等级精细选择。'
          : '属性值提升、可替换专长及后续专长选择，请前往专长页面精细配置。'}{' '}
        <Link href={`/builder/${page}/?id=${encodeURIComponent(characterId || '')}`}>
          前往{label}页面
        </Link>
      </p>
    </div>
  );
}
