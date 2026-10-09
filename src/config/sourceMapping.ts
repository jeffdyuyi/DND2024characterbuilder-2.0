/**
 * 书籍资源来源映射表 (Source Mapping)
 * 用于将代码中的缩写（如 PHB, XPHB）或长 ID（如 GuideDrakkenheim）转换为标准的中文译名。
 * 参考：基石文档/资源名称译名缩写对照.md
 */

export const SourceMap: Record<string, string> = {
  // 核心 (Core / 三宝书)
  PHB: '玩家手册',
  PH: '玩家手册',
  DMG: '地下城主指南',
  MM: '怪物图鉴',

  // 2024 新版 (2024 Core)
  XPHB: '2024 玩家手册',
  PHB2024: '2024 玩家手册',
  XDMG: '2024 地下城主指南',
  XMM: '2024 怪物图鉴',

  // 扩展 & 资源 (Expansion & Resources)
  SCAG: '剑湾冒险者指南',
  WGE: '艾伯伦寻路者指南',
  VGM: '瓦罗的怪物指南',
  VGtM: '瓦罗的怪物指南',
  XGE: '珊娜萨的万事指南',
  XGtE: '珊娜萨的万事指南',
  MTF: '魔邓肯的众敌卷册',
  MToF: '魔邓肯的众敌卷册',
  GGR: '拉尼卡公会长指南',
  GGtR: '拉尼卡公会长指南',
  ERLW: '艾伯伦：从终末战争中崛起',
  EGtW: '荒洲探险家指南',
  EGW: '荒洲探险家指南',
  AI: '艾奎兹玄有限责任公司',
  AcInc: '艾奎兹玄有限责任公司',
  MOT: '塞洛斯之神话奥德赛',
  MOoT: '塞洛斯之神话奥德赛',
  TCE: '塔莎的万事坩埚',
  VGR: '范·里希腾的鸦阁魔域指南',
  VRGR: '范·里希腾的鸦阁魔域指南',
  FTD: '费资本的巨龙宝库',
  FToD: '费资本的巨龙宝库',
  SCC: '斯翠海文：混沌研习',
  SCoC: '斯翠海文：混沌研习',
  DSDQ: '龙枪：龙后之影',
  DSotDQ: '龙枪：龙后之影',
  MPMM: '魔邓肯巨献：多元宇宙的怪物',
  MotM: '魔邓肯巨献：多元宇宙的怪物',
  MMoM: '魔邓肯巨献：多元宇宙的怪物',
  SAS: '魔法船：冒险于太空中',
  AAG: '星界冒险者指南',
  BAM: '布布的星界怪兽展',
  BPGG: '毕格比巨献：巨人之荣耀',
  BGG: '毕格比巨献：巨人之荣耀',
  PS: '异度风景：多元宇宙之冒险',
  BMT: '万象无常书',
  FR: '被遗忘的国度',
  FRHoF: '被遗忘的国度：费伦英雄',
  ABH: '阿斯代伦的饥渴之书',
  EFA: '奇械锻炉',

  // 合作内容 (Collaboration / Third Party)
  TCSR: '塔尔多雷战役设定集',
  GH: '鬼魅幽谷',
  GHPP: '鬼魅幽谷：玩家包',
  GHPG: '鬼魅幽谷：玩家指南',
  GH2: '鬼魅幽谷：玩家指南',
  GrimHollowPG24: '鬼魅幽谷：玩家指南',
  Dk: '德拉肯海姆',
  Dr: '德拉肯海姆',
  DoDk: '德拉肯海姆之墟',
  DoDr: '德拉肯海姆之墟',
  GuideDrakkenheim: '德拉肯海姆之墟',
  MoD: '德拉肯海姆的怪物',
  HCS: '谦卑林战役设定集',
  HumblewoodCampaignSetting: '谦卑林战役设定集',
  HT: '谦卑林故事集',
  HumblewoodTales: '谦卑林故事集',
  BoET: '黯潮之书',
  BookOfEbonTides: '黯潮之书',
  VSS: '瓦尔达的秘密尖塔',
  OTTG: '胧忆岛：蒿野物语',
  ObojimaTallGrass: '胧忆岛：蒿野物语',
  CM: '歪曲之月',
  CrookedMoon14: '歪曲之月',
  CBT: '火炬光下的克苏鲁',
  CthulhuTorchlight: '火炬光下的克苏鲁',
  HAP: '惊奇一发：节日包',
  HolidayAdventurePack: '惊奇一发：节日包',
  UA: '破解奥秘',
};

/**
 * 获取书籍来源的显示名称
 * @param sourceCode 来源缩写（如 "XPHB"）
 * @returns 友好的显示名称，如果未找到则返回缩写本身
 */
export function getSourceDisplayName(sourceCode: string): string {
  if (!sourceCode) return '未知来源';
  return SourceMap[sourceCode] || sourceCode;
}

/**
 * 获取书籍/来源分组的排序权重
 * 2024 核心规则/玩家手册 (1) > 2014 经典规则/玩家手册 (2) > 官方重大拓展 (3-8) > 设定集 (10-18) > UA/第三方 (80-90)
 */
export function getSourceSortWeight(sourceOrGroupName: string): number {
  if (!sourceOrGroupName) return 50;
  const s = sourceOrGroupName.toUpperCase();

  // 1. 2024 核心规则 / 玩家手册 2024 (最顶层优先)
  if (
    s.includes('XPHB') ||
    s.includes('PHB2024') ||
    (s.includes('2024') && (s.includes('CORE') || s.includes('核心') || s.includes('玩家手册')))
  ) {
    return 1;
  }

  // 2. 2014 玩家手册 / 经典规则 (第二优先)
  if (s === 'PHB' || s === 'PH' || s.includes('经典规则') || s.includes('玩家手册')) {
    return 2;
  }

  // 3. 官方重大核心拓展规则
  if (s.includes('TCE') || s.includes('塔莎')) return 3;
  if (s.includes('XGE') || s.includes('珊娜萨')) return 4;
  if (s.includes('MPMM') || s.includes('MOTM') || s.includes('多元宇宙')) return 5;
  if (s.includes('VGM') || s.includes('瓦罗')) return 6;
  if (s.includes('MTF') || s.includes('众敌')) return 7;
  if (s.includes('FTD') || s.includes('巨龙宝库')) return 8;

  // 4. 地下城主指南与怪物图鉴
  if (s.includes('DMG') || s.includes('XDMG') || s.includes('地下城主')) return 9;
  if (s.includes('MM') || s.includes('XMM') || s.includes('怪物图鉴')) return 10;

  // 5. 战役设定集扩展
  if (s.includes('EEPC')) return 11;
  if (s.includes('SCAG') || s.includes('剑湾')) return 12;
  if (s.includes('ERLW') || s.includes('艾伯伦')) return 13;
  if (s.includes('EGW') || s.includes('荒洲')) return 14;
  if (s.includes('GGR') || s.includes('拉尼卡')) return 15;
  if (s.includes('MOT') || s.includes('塞洛斯')) return 16;
  if (s.includes('VRGR') || s.includes('鸦阁')) return 17;
  if (s.includes('SAS') || s.includes('星界') || s.includes('魔法船')) return 18;

  // 6. UA / 破解奥秘 / 第三方
  if (s.includes('UA') || s.includes('破解奥秘')) return 80;
  if (s.includes('HOMEBREW') || s.includes('自制') || s.includes('第三方')) return 90;

  return 30;
}

/** 候选显示的统一出处顺序；排序副本，不改原数组与角色选择。 */
export function sortBySourcePriority<T extends { source?: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => getSourceSortWeight(a.source || '') - getSourceSortWeight(b.source || ''),
  );
}
