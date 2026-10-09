/**
 * 物品解析器 (Item Resolver)
 * 用于将背景描述中的自然语言（如 "一枚圣徽"、"羊皮纸（10张）"）解析为结构化数据。
 */

export interface ParsedItem {
  name: string;
  quantity: number;
  isFlavor: boolean; // 是否是风味描述（无法简单匹配数据库）
}

/**
 * 解析物品描述字符串
 * @param text 原始描述，如 "一枚圣徽（出任神职时的礼物）" 或 "羊皮纸（10张）"
 */
export function parseEquipmentString(text: string): ParsedItem {
  let name = text.trim();
  let quantity = 1;
  let isFlavor = false;

  // 如果文本包含“或”、“自选”、“由你选择”、“一些”等词，通常认为是风味描述或复杂项
  if (
    name.includes('或') ||
    name.includes('自选') ||
    name.includes('由你选择') ||
    name.includes('一些') ||
    name.length > 15
  ) {
    isFlavor = true;
  }

  // 1. 处理括号内的内容
  const parenMatch = name.match(/（([^）]+)）|\(([^)]+)\)/);
  if (parenMatch) {
    const content = parenMatch[1] || parenMatch[2];
    const numMatch = content.match(/(\d+)/);
    // 如果括号里只有纯数字和单位，通常是数量
    if (numMatch && content.match(/^\d+[张根把只支瓶份尺]$/)) {
      quantity = parseInt(numMatch[1], 10);
      if (!isFlavor) name = name.replace(/（[^）]+）|\([^)]+\)/g, '').trim();
    } else {
      // 括号里是描述文字，标记为风味
      isFlavor = true;
    }
  }

  // 2. 处理量词前置 (2014 风格)
  const prefixMatch = name.match(
    /^(\d+|一|两|三|四|五|六|七|八|九|十|几)\s*[枚套个根把张副件支块瓶份]/,
  );
  if (prefixMatch) {
    const qStr = prefixMatch[1];
    if (!isNaN(parseInt(qStr))) {
      quantity = parseInt(qStr, 10);
    } else {
      const chineseMap: Record<string, number> = {
        一: 1,
        两: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
      };
      if (chineseMap[qStr]) quantity = chineseMap[qStr];
    }
    // 如果是简单的“一个项目”，剥离前缀；如果是复杂的描述，保留
    if (!isFlavor) {
      name = name
        .replace(/^(\d+|一|两|三|四|五|六|七|八|九|十|几)\s*[枚套个根把张副件支块瓶份]/, '')
        .trim();
    }
  }

  // 3. 针对“20支箭”这种 2024 风格的简写
  const numPrefixMatch = name.match(/^(\d+)\s*[支根个块张]/);
  if (numPrefixMatch) {
    quantity = parseInt(numPrefixMatch[1], 10);
    if (!isFlavor) name = name.replace(/^(\d+)\s*[支根个块张]/, '').trim();
  }

  // 4. 处理金币
  const gpMatch = text.match(/(\d+)\s*[Gg][Pp]/);
  if (gpMatch) {
    quantity = parseInt(gpMatch[1], 10);
    name = 'GP';
    isFlavor = false;
  }

  return { name, quantity, isFlavor };
}
