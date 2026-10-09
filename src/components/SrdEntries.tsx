'use client';

import React, { Fragment, ReactNode } from 'react';
import styles from './SrdEntries.module.css';

const ABILITY_LABELS: Record<string, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力',
};

type LinkHandler = (reference: string, kind?: string) => void;

export function InlineText({
  text,
  onLink,
}: {
  text: string;
  onLink?: LinkHandler;
}) {
  let content = typeof text === 'string' ? text : String(text ?? '');
  content = content
    .replace('外部角色卡条目；请在规则资料中核对并替换为有来源的条目。', '')
    .replace('（阅读后自行填入）', '')
    .replace('职业等级可在角色卡中调整。', '');

  const parts: ReactNode[] = [];
  const regex = /\{@(\w+)(?:\s+([^{}]*))?\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    parts.push(content.slice(cursor, match.index));
    const [all, tag, body = ''] = match;
    const args = body.split('|');
    const label =
      tag === 'filter'
        ? args[0]
        : ['dice', 'damage', 'd20'].includes(tag)
        ? args[1] || args[0]
        : args[2] || args[0];

    if (
      [
        'creature',
        'spell',
        'item',
        'class',
        'race',
        'feat',
        'condition',
        'skill',
        'sense',
        'variantrule',
        'action',
        'language',
        'optfeature',
        'background',
        'status',
        'disease',
        'itemMastery',
        'itemProperty',
        'itemType',
        'table',
        'deity',
        'reward',
        'charoption',
        'psionic',
        'facility',
      ].includes(tag)
    ) {
      parts.push(
        <span
          key={match.index}
          className={styles.referenceLink}
          title={`点击查阅引用: ${body}`}
          onClick={(e) => {
            e.stopPropagation();
            onLink?.(body, tag);
          }}
        >
          {label}
        </span>
      );
    } else if (['b', 'bold', 'strong'].includes(tag)) {
      parts.push(<strong key={match.index}>{label}</strong>);
    } else if (['i', 'italic', 'note'].includes(tag)) {
      parts.push(<em key={match.index}>{label}</em>);
    } else if (tag === 'atkr') {
      const atkType = args[0]
        .split(',')
        .map((v) => ({ m: '近战攻击检定', r: '远程攻击检定', a: '攻击检定' }[v] || v))
        .join('或');
      parts.push(<em key={match.index}>{atkType}：</em>);
    } else if (tag === 'actSave') {
      parts.push(<em key={match.index}>{ABILITY_LABELS[args[0]] || args[0]}豁免：</em>);
    } else if (['actSaveFail', 'actSaveSuccess', 'actSaveSuccessOrFail', 'actTrigger', 'actResponse'].includes(tag)) {
      const map: Record<string, string> = {
        actSaveFail: '失败',
        actSaveSuccess: '成功',
        actSaveSuccessOrFail: '无论成败',
        actTrigger: '触发',
        actResponse: '响应',
      };
      parts.push(<em key={match.index}>{map[tag]}：</em>);
    } else if (tag === 'actSaveFailBy') {
      parts.push(<em key={match.index}>失败差值至少{label}：</em>);
    } else if (tag === 'dc') {
      parts.push(<span key={match.index} className={styles.dcBadge}>DC {label}</span>);
    } else if (['dice', 'damage', 'd20'].includes(tag)) {
      parts.push(
        <span key={match.index} className={styles.diceBadge}>
          🎲 {label}
        </span>
      );
    } else if (tag === 'hit') {
      const num = Number(label);
      parts.push(
        <span key={match.index} className={styles.hitBadge}>
          {num >= 0 ? `+${label}` : label}
        </span>
      );
    } else if (tag === 'atk') {
      const atkStr = args[0]
        .split(',')
        .map((v) => ({ mw: '近战武器攻击', rw: '远程武器攻击', ms: '近战法术攻击', rs: '远程法术攻击' }[v] || v))
        .join(' / ');
      parts.push(<span key={match.index} className={styles.atkLabel}>{atkStr}</span>);
    } else if (tag === 'h') {
      parts.push(<strong key={match.index}>命中：</strong>);
    } else if (tag === 'recharge') {
      parts.push(<span key={match.index} className={styles.rechargeTag}>充能 {label || '6'}</span>);
    } else {
      parts.push(label || '');
    }

    cursor = match.index + all.length;
  }

  parts.push(content.slice(cursor));
  return <>{parts}</>;
}

export function SrdEntries({
  value,
  onLink,
  depth = 0,
}: {
  value: unknown;
  onLink?: LinkHandler;
  depth?: number;
}): ReactNode {
  if (depth > 14 || value == null) return null;

  if (typeof value === 'string') {
    if (/^生命骰：d\d+。职业等级可在角色卡中调整。$/.test(value)) return null;
    return (
      <p className={styles.paragraph}>
        <InlineText text={value} onLink={onLink} />
      </p>
    );
  }

  if (typeof value === 'number') return String(value);

  if (Array.isArray(value)) {
    return value.map((v, i) => (
      <Fragment key={i}>
        <SrdEntries value={v} onLink={onLink} depth={depth + 1} />
      </Fragment>
    ));
  }

  if (typeof value !== 'object') return null;

  const v = value as Record<string, any>;

  if (v.type === 'dice') {
    return (
      <span className={styles.diceBadge}>
        🎲{' '}
        {v.toRoll
          ? (Array.isArray(v.toRoll) ? v.toRoll : [v.toRoll])
              .map((r: any) => `${r.number ?? 1}d${r.faces}${r.modifier ? (r.modifier > 0 ? `+${r.modifier}` : r.modifier) : ''}`)
              .join(' + ')
          : v.expression || v.displayText || ''}
      </span>
    );
  }

  if (v.type === 'bonus') {
    return <span className={styles.bonusTag}>{Number(v.value) >= 0 ? `+${v.value}` : v.value ?? 0}</span>;
  }

  if (v.type === 'bonusSpeed') {
    return <span>{v.value ?? 0} 尺</span>;
  }

  if (['abilityDc', 'abilityAttackMod'].includes(v.type)) {
    return (
      <p className={styles.abilityFormula}>
        <strong>
          {v.name || '法术'}
          {v.type === 'abilityDc' ? '豁免 DC' : '攻击加值'}
        </strong>{' '}
        = {v.type === 'abilityDc' ? '8 + ' : ''}
        {(v.attributes || []).map((a: string) => ABILITY_LABELS[a] || a).join(' / ')}
        调整值 + 熟练加值
      </p>
    );
  }

  if (v.type === 'table') {
    const rows: any[][] = (v.rows || []).map((row: any) => (Array.isArray(row) ? row : row.row || []));
    return (
      <div className={styles.tableScroll}>
        {v.caption && (
          <div className={styles.tableCaption}>
            <InlineText text={v.caption} onLink={onLink} />
          </div>
        )}
        <SrdEntries value={v.intro} onLink={onLink} depth={depth + 1} />
        <table className={styles.table}>
          <thead>
            <tr>
              {v.colLabels?.map((l: string, i: number) => (
                <th key={i} scope="col">
                  <InlineText text={l} onLink={onLink} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell: any, j) => (
                  <td
                    key={j}
                    rowSpan={cell?.rowSpan || cell?.rowspan || 1}
                    colSpan={cell?.colSpan || cell?.colspan || 1}
                  >
                    <SrdEntries value={cell} onLink={onLink} depth={depth + 1} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <SrdEntries value={v.footnotes} onLink={onLink} depth={depth + 1} />
      </div>
    );
  }

  if (v.headerEntries || v.spells || v.daily || v.will) {
    const frequencies: Record<string, string> = {
      daily: '每日',
      rest: '每次休息',
      weekly: '每周',
      monthly: '每月',
      yearly: '每年',
      recharge: '充能',
      legendary: '传奇动作',
    };
    return (
      <section className={styles.spellcastingBlock}>
        {v.name && (
          <h4 className={styles.sectionTitle}>
            <InlineText text={v.name} />
          </h4>
        )}
        <SrdEntries value={v.headerEntries} onLink={onLink} depth={depth + 1} />
        {v.will && (
          <p className={styles.paragraph}>
            <strong>随意施展：</strong>
            <InlineText text={v.will.join('、')} onLink={onLink} />
          </p>
        )}
        {Object.entries(v.spells || {}).map(([level, data]: [string, any]) => (
          <p key={level} className={styles.paragraph}>
            <strong>
              {level === '0' ? '戏法' : `${level}环`}
              {data.slots ? `（${data.slots}法术位）` : ''}：
            </strong>
            <InlineText text={(data.spells || []).join('、')} onLink={onLink} />
          </p>
        ))}
        {Object.entries(frequencies).flatMap(([key, label]) =>
          Object.entries(v[key] || {}).map(([count, spells]: [string, any]) => (
            <p key={`${key}-${count}`} className={styles.paragraph}>
              <strong>
                {label}
                {count.replace('e', '')}次{count.includes('e') ? '各自' : ''}：
              </strong>
              <InlineText text={Array.isArray(spells) ? spells.join('、') : String(spells)} onLink={onLink} />
            </p>
          ))
        )}
        <SrdEntries value={v.footerEntries} onLink={onLink} depth={depth + 1} />
      </section>
    );
  }

  if (v.type === 'list') {
    return (
      <ul className={styles.list}>
        {v.items?.map((item: unknown, i: number) => (
          <li key={i} className={styles.listItem}>
            <SrdEntries value={item} onLink={onLink} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  if (v.type === 'cell' && v.roll) {
    return <span>{v.roll.exact ?? `${v.roll.min}–${v.roll.max}`}</span>;
  }

  if (typeof v.type === 'string' && v.type.startsWith('ref')) {
    const ref = v.classFeature || v.subclassFeature || v.optionalfeature;
    return typeof ref === 'string' ? (
      <p className={styles.paragraph}>
        <span
          className={styles.referenceLink}
          onClick={(e) => {
            e.stopPropagation();
            onLink?.(ref, 'feature');
          }}
        >
          {ref.split('|')[0]}
        </span>
      </p>
    ) : null;
  }

  const isInset = ['inset', 'insetReadaloud', 'quote'].includes(v.type);

  return (
    <section className={isInset ? styles.inset : styles.section}>
      {v.name && (
        <h4 className={styles.sectionTitle}>
          <InlineText text={v.name} onLink={onLink} />
          {v.ENG_name && v.ENG_name !== v.name && <small className={styles.sectionEnName}> ({v.ENG_name})</small>}
        </h4>
      )}
      <SrdEntries value={v.entries || v.entry || v.items || v.text} onLink={onLink} depth={depth + 1} />
      {v.by && <small className={styles.quoteBy}>— {v.by}</small>}
    </section>
  );
}

export default SrdEntries;
