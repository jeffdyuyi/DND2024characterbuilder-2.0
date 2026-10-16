import { expect, it } from 'vitest';
import { normalizeSpell } from '../fiveetools-cn/normalizers/spell';
import { catalogEntryToSpell } from '@/catalog/adapters/spells';
import { formatDuration } from '../fiveetools-cn/utils';

it('解析5etools原生duration.type，经目录适配后显示正确单位且不改raw', () => {
  // 2026-10-16核对cn2.0/data/spells/spells-phb.json光亮术duration字段。
  const raw = {
    name: '光亮术',
    source: 'PHB',
    duration: [{ type: 'timed', duration: { type: 'hour', amount: 1 } }],
  };
  const snapshot = JSON.stringify(raw);
  expect(catalogEntryToSpell(normalizeSpell(raw)).duration).toBe('1 小时');
  expect(JSON.stringify(raw)).toBe(snapshot);
});

it('原生单位与专注描述保留，旧自定义unit字段仍可用', () => {
  for (const [type, label] of Object.entries({
    round: '轮',
    minute: '分钟',
    hour: '小时',
    day: '天',
  })) {
    expect(
      formatDuration([{ type: 'timed', concentration: true, duration: { type, amount: 2 } }]),
    ).toBe(`专注，至多 2 ${label}`);
  }
  expect(formatDuration([{ type: 'timed', duration: { unit: 'hour', amount: 1 } }])).toBe('1 小时');
  expect(formatDuration([{ type: 'instant' }])).toBe('立即');
  expect(formatDuration([{ type: 'permanent' }])).toBe('永久');
  expect(formatDuration([{ type: 'special' }])).toBe('特殊');
});
