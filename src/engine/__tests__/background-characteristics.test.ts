import { describe, expect, it } from 'vitest';
import { rollBackgroundCharacteristic } from '../backgroundCharacteristics';
import type { Background } from '@/types/background';

describe('background characteristic rolls', () => {
  it('按背景表的骰面取对应文本，空表不生成内容', () => {
    const background = {
      flavorTables: [
        {
          name: '特点',
          dice: '8',
          rows: [
            { id: 1, content: '第一条' },
            { id: 2, content: '第二条' },
          ],
        },
      ],
    } as Background;
    expect(rollBackgroundCharacteristic(background, 'personalityTraits', () => 0)).toBe('第一条');
    expect(rollBackgroundCharacteristic(background, 'personalityTraits', () => 0.2)).toBe('第二条');
    expect(rollBackgroundCharacteristic(background, 'ideals', () => 0)).toBeUndefined();
  });
});
