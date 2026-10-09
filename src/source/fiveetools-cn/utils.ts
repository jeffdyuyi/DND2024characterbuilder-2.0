/**
 * 5etools 文本与数据格式工具
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §15、§16
 */

/**
 * 清除 5etools 专有的 {@tag target|source|displayText} 标记，转换为纯净中文/易读文本
 */
export function clean5eTags(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Resolve inner tags first so nested formatting cannot expose source fields.
  let previous: string;
  do {
    previous = text;
    text = text.replace(/\{@([a-zA-Z0-9]+)\s+([^{}]+)\}/g, (match, tag, body) => {
    const parts = body.split('|');
    const first = parts[0]?.trim() || '';

    switch (tag.toLowerCase()) {
      case 'dice':
      case 'damage':
      case 'd20':
      case 'hit':
        // {@damage 1d6} -> 1d6, {@dice 2d4 × 10|2d4 × 10|Starting Gold} -> 2d4 × 10
        return parts[1] || first;
      case 'item':
      case 'spell':
      case 'creature':
      case 'feat':
      case 'condition':
      case 'race':
      case 'background':
      case 'class':
      case 'subclass':
      case 'variantrule':
      case 'sense':
      case 'action':
      case 'skill':
      case 'status':
      case 'optfeature':
      case 'reward':
      case 'language':
        // {@item shield|phb|shields} -> shields || shield
        return parts[2] || first;
      case 'filter':
        // {@filter simple weapon|...} -> simple weapon
        return first;
      case 'b':
      case 'bold':
        return `**${first}**`;
      case 'i':
      case 'italic':
        return `*${first}*`;
      case 'note':
        return `[注: ${first}]`;
      default:
        // Unknown tags must never substitute a source/URL for their visible label.
        return first;
    }
    });
  } while (text !== previous && text.includes('{@'));
  return text;
}

/**
 * 将 5etools entries 树状/混合数组递归拍平成纯文本描述
 */
export function flattenEntries(entries: unknown[] | undefined): string {
  if (!entries || !Array.isArray(entries)) return '';

  const lines: string[] = [];

  for (const item of entries) {
    if (typeof item === 'string') {
      lines.push(clean5eTags(item));
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, any>;
      if (obj.name) {
        lines.push(`【${clean5eTags(obj.name)}】`);
      }
      if (obj.type === 'table' && Array.isArray(obj.rows)) {
        const cell = (value: any): string => typeof value === 'string' ? clean5eTags(value) :
          value?.entry ? flattenEntries([value.entry]) : value?.roll ? String(value.roll.exact ?? `${value.roll.min}–${value.roll.max}`) : String(value ?? '');
        if (obj.caption) lines.push(clean5eTags(obj.caption));
        const labels = obj.colLabels || obj.rows[0]?.map(() => '');
        if (labels?.length) {
          lines.push(`| ${labels.map(cell).join(' | ')} |\n| ${labels.map(() => '---').join(' | ')} |\n${obj.rows.map((row: any) => `| ${(row.row || row).map(cell).join(' | ')} |`).join('\n')}`);
        }
        continue;
      }
      if (Array.isArray(obj.entries)) {
        lines.push(flattenEntries(obj.entries));
      } else if (typeof obj.entry === 'string') {
        lines.push(clean5eTags(obj.entry));
      } else if (Array.isArray(obj.items)) {
        for (const subItem of obj.items) {
          if (typeof subItem === 'string') {
            lines.push(`• ${clean5eTags(subItem)}`);
          } else if (subItem && typeof subItem === 'object') {
            lines.push(`• ${flattenEntries([subItem])}`);
          }
        }
      }
    }
  }

  return lines.filter(Boolean).join('\n\n');
}

/** 学派代码缩写映射表 */
export const SPELL_SCHOOL_NAMES: Record<string, string> = {
  A: '防护',
  C: '咒法',
  D: '预言',
  E: '惑控',
  V: '塑能',
  I: '幻术',
  N: '死灵',
  T: '变化',
};

/** 施法时间格式化 */
export function formatCastingTime(timeArr: any[] | undefined): string {
  if (!timeArr || !Array.isArray(timeArr) || timeArr.length === 0) return '';
  const first = timeArr[0];
  const unit = first.unit || '';
  const num = first.number || 1;
  const unitMap: Record<string, string> = {
    action: '动作',
    bonus: '附赠动作',
    reaction: '反应',
    round: '轮',
    minute: '分钟',
    hour: '小时',
  };
  return `${num} ${unitMap[unit] || unit}`.trim();
}

/** 施法距离格式化 */
export function formatRange(rangeObj: any): string {
  if (!rangeObj) return '';
  if (typeof rangeObj === 'string') return clean5eTags(rangeObj);
  if (rangeObj.type === 'special') return '特殊';
  if (rangeObj.type === 'touch') return '触及';
  if (rangeObj.type === 'self') return '自身';
  if (rangeObj.distance) {
    const dist = rangeObj.distance;
    if (dist.type === 'feet') return `${dist.amount} 尺`;
    if (dist.type === 'miles') return `${dist.amount} 英里`;
    if (dist.type === 'self') return '自身';
    if (dist.type === 'touch') return '触及';
  }
  return rangeObj.type || '';
}

/** 持续时间格式化 */
export function formatDuration(durationArr: any[] | undefined): string {
  if (!durationArr || !Array.isArray(durationArr) || durationArr.length === 0) return '';
  const first = durationArr[0];
  if (first.type === 'instant') return '立即';
  if (first.type === 'permanent') return '永久';
  if (first.type === 'special') return '特殊';
  if (first.duration) {
    const dur = first.duration;
    const unitMap: Record<string, string> = {
      round: '轮',
      minute: '分钟',
      hour: '小时',
      day: '天',
    };
    const unit = unitMap[dur.unit] || dur.unit;
    const conc = first.concentration ? '专注，至多 ' : '';
    return `${conc}${dur.amount} ${unit}`;
  }
  return '';
}
