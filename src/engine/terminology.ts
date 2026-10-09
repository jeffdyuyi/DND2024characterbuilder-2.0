/**
 * D&D 2024 Terminology Mapping Utility
 * Ensures consistency between 2014 and 2024 terms and handles translation variations.
 * Base Mapping Source: 基石文档/ability_skill_mapping.md, item_type_mapping.md
 */
import { ALL_GAME_LANGUAGES } from '../rules/languages';
import { getToolDisplayName } from '@/catalog/tools';

export const SKILL_MAP: Record<string, string> = {
  acrobatics: '杂技',
  animalHandling: '驯兽',
  arcana: '奥秘',
  athletics: '运动',
  deception: '欺瞒',
  history: '历史',
  insight: '洞悉',
  intimidation: '威吓',
  investigation: '调查',
  medicine: '医药',
  nature: '自然',
  perception: '察觉',
  performance: '表演',
  persuasion: '游说',
  religion: '宗教',
  sleightOfHand: '巧手',
  stealth: '隐匿',
  survival: '生存',
};

// 感官映射
export const SENSE_MAP: Record<string, string> = {
  darkvision: '黑暗视觉',
  blindsight: '盲视',
  truesight: '真视',
  tremorsense: '震颤感官',
};

// 技能与属性对应关系 (参考 D&D 2024 标准)
export const SKILL_ABILITY_MAP: Record<string, string> = {
  athletics: 'str',
  acrobatics: 'dex',
  sleightOfHand: 'dex',
  stealth: 'dex',
  arcana: 'int',
  history: 'int',
  investigation: 'int',
  nature: 'int',
  religion: 'int',
  animalHandling: 'wis',
  insight: 'wis',
  medicine: 'wis',
  perception: 'wis',
  survival: 'wis',
  deception: 'cha',
  intimidation: 'cha',
  performance: 'cha',
  persuasion: 'cha',
};

// 技能全列表 (用于 Any 展开)
export const ALL_SKILLS = Object.keys(SKILL_MAP);

// 工具映射 (基于 item_type_mapping.md)
export const TOOL_MAP: Record<string, string> = {
  alchemistSupplies: '炼金工具',
  "alchemist's supplies": '炼金工具',
  'alchemists-supplies-full': '炼金工具',
  brewerSupplies: '酿酒工具',
  "brewer's supplies": '酿酒工具',
  'brewers-supplies-full': '酿酒工具',
  calligrapherSupplies: '书法工具',
  "calligrapher's supplies": '书法工具',
  'calligraphers-supplies-full': '书法工具',
  carpenterTools: '木匠工具',
  "carpenter's tools": '木匠工具',
  'carpenters-tools-full': '木匠工具',
  cartographerTools: '制图工具',
  "cartographer's tools": '制图工具',
  'cartographers-tools-full': '制图工具',
  cobblerTools: '鞋匠工具',
  "cobbler's tools": '鞋匠工具',
  'cobblers-tools-full': '鞋匠工具',
  cookUtensils: '厨具',
  "cook's utensils": '厨具',
  'cooks-utensils-full': '厨具',
  glassblowerTools: '吹玻璃工具',
  "glassblower's tools": '吹玻璃工具',
  'glassblowers-tools-full': '吹玻璃工具',
  jewelerTools: '珠宝工具',
  "jeweler's tools": '珠宝工具',
  'jewelers-tools-full': '珠宝工具',
  leatherworkerTools: '皮匠工具',
  "leatherworker's tools": '皮匠工具',
  'leatherworkers-tools-full': '皮匠工具',
  masonTools: '石匠工具',
  "mason's tools": '石匠工具',
  'masons-tools-full': '石匠工具',
  painterSupplies: '绘画用品',
  "painter's supplies": '绘画用品',
  'painters-supplies-full': '绘画用品',
  potterTools: '陶匠工具',
  "potter's tools": '陶匠工具',
  'potters-tools-full': '陶匠工具',
  smithTools: '铁匠工具',
  "smith's tools": '铁匠工具',
  'smiths-tools-full': '铁匠工具',
  tinkerTools: '修补匠工具',
  "tinker's tools": '修补匠工具',
  'tinkers-tools-full': '修补匠工具',
  weaverTools: '织工工具',
  "weaver's tools": '织工工具',
  'weavers-tools-full': '织工工具',
  woodcarverTools: '木雕工具',
  "woodcarver's tools": '木雕工具',
  'woodcarvers-tools-full': '木雕工具',
  diceSet: '骰子组',
  'dice set': '骰子组',
  'dice-set-full': '骰子组',
  dragonchessSet: '龙棋组',
  'dragonchess set': '龙棋组',
  'dragonchess-set-full': '龙棋组',
  playingCardSet: '整副纸牌',
  'playing card set': '整副纸牌',
  'playing-card-set-full': '整副纸牌',
  threeDragonAnteSet: '整副三龙牌',
  'three-dragon ante set': '整副三龙牌',
  'three-dragon-ante-set-full': '整副三龙牌',
  'bone dice': '骨骰',
  'bone-dice-full': '骨骰',
  'chess set': '国际象棋组',
  'chess-set-full': '国际象棋组',
  'bowling set': '九柱球组',
  'bowling-set-full': '九柱球组',
  gamingSet: '赌具',
  'gaming set': '赌具',
  'gaming sets': '赌具',
  anyGamingSet: '赌具',
  'any gaming set': '赌具',
  disguiseKit: '易容工具',
  'disguise kit': '易容工具',
  'disguise-kit-full': '易容工具',
  forgeryKit: '文书伪造工具',
  'forgery kit': '文书伪造工具',
  'forgery-kit-full': '文书伪造工具',
  herbalismKit: '草药工具',
  'herbalism kit': '草药工具',
  'herbalism-kit-full': '草药工具',
  navigatorTools: '领航工具',
  "navigator's tools": '领航工具',
  'navigators-tools-full': '领航工具',
  poisonerKit: '制毒工具',
  "poisoner's kit": '制毒工具',
  'poisoner-kit-full': '制毒工具',
  thievesTools: '盗贼工具',
  "thieves' tools": '盗贼工具',
  'thieves-tools-full': '盗贼工具',
  artisanTools: '工匠工具',
  "artisan's tools": '工匠工具',
  anyArtisansTool: '工匠工具',
  "any artisan's tool": '工匠工具',
  // 乐器 (标准 5etools items-base 原生译名)
  bagpipes: '风笛',
  bagpipe: '风笛',
  'bagpipes-full': '风笛',
  drum: '鼓',
  'drum-full': '鼓',
  dulcimer: '扬琴',
  'dulcimer-full': '扬琴',
  flute: '长笛',
  'flute-full': '长笛',
  lute: '鲁特琴',
  'lute-full': '鲁特琴',
  lyre: '里拉琴',
  'lyre-full': '里拉琴',
  horn: '号角',
  'horn-full': '号角',
  'pan flute': '排箫',
  'pan-flute': '排箫',
  panflute: '排箫',
  panFlute: '排箫',
  'pan-flute-full': '排箫',
  shawm: '芦笛',
  'shawm-full': '芦笛',
  viol: '提琴',
  'viol-full': '提琴',
  musicalInstrument: '乐器',
  'musical instrument': '乐器',
  'Musical Instrument': '乐器',
  'bandore-frhof': '班多里琴',
  'birdpipes-scag': '鸟箫',
  'cittern-frhof': '西特琴',
  'glaur-scag': '格劳尔号',
  'hand-drum-scag': '手鼓',
  'horn-xphb': '号角',
  'longhorn-scag': '长号角',
  'songhorn-scag': '歌唱号角',
  'tantan-scag': '镗镗',
  'thelarr-scag': '斯拉尔管',
  'tocken-scag': '托肯',
  'wargong-scag': '战锣',
  'yarting-frhof': '雅廷琴 (FRHoF)',
  'yarting-scag': '雅廷琴 (SCAG)',
  'zulkoon-scag': '咒昆琴',
  violoncello: '大提琴',
  // 载具与坐骑
  mule: '骡子',
  cart: '货车 (二轮)',
  'vehicles(land)': '陆地载具',
  'vehicles (land)': '陆地载具',
  'vehicles-land-full': '陆地载具',
  'vehicles(water)': '水上载具',
  'vehicles (water)': '水上载具',
  'vehicles-water-full': '水上载具',
  'land vehicles': '陆地载具',
  'water vehicles': '水上载具',
};

// 工匠工具全列表 (用于 Any 展开)
export const ARTISAN_TOOLS = [
  'alchemists-supplies-full',
  'brewers-supplies-full',
  'calligraphers-supplies-full',
  'carpenters-tools-full',
  'cartographers-tools-full',
  'cobblers-tools-full',
  'cooks-utensils-full',
  'glassblowers-tools-full',
  'jewelers-tools-full',
  'leatherworkers-tools-full',
  'masons-tools-full',
  'painters-supplies-full',
  'potters-tools-full',
  'smiths-tools-full',
  'tinkers-tools-full',
  'weavers-tools-full',
  'woodcarvers-tools-full',
  'alchemistSupplies',
  'brewerSupplies',
  'calligrapherSupplies',
  'carpenterTools',
  'cartographerTools',
  'cobblerTools',
  'cookUtensils',
  'glassblowerTools',
  'jewelerTools',
  'leatherworkerTools',
  'masonTools',
  'painterSupplies',
  'potterTools',
  'smithTools',
  'tinkerTools',
  'weaverTools',
  'woodcarverTools',
];

export const MUSICAL_INSTRUMENTS = [
  'bagpipes-full',
  'drum-full',
  'dulcimer-full',
  'flute-full',
  'horn-full',
  'lute-full',
  'lyre-full',
  'pan-flute-full',
  'shawm-full',
  'viol-full',
  'bandore-frhof',
  'birdpipes-scag',
  'cittern-frhof',
  'glaur-scag',
  'hand-drum-scag',
  'horn-xphb',
  'longhorn-scag',
  'songhorn-scag',
  'tantan-scag',
  'thelarr-scag',
  'tocken-scag',
  'wargong-scag',
  'yarting-frhof',
  'yarting-scag',
  'zulkoon-scag',
];

export const GAMING_SETS = [
  'dice-set-full',
  'dragonchess-set-full',
  'playing-card-set-full',
  'three-dragon-ante-set-full',
  'Dice set',
  'Dragonchess set',
  'Playing card set',
  'Three-Dragon Ante set',
];

// 武器映射
export const WEAPON_MAP: Record<string, string> = {
  club: '短棒',
  dagger: '匕首',
  greatclub: '巨棒',
  handaxe: '手斧',
  javelin: '标枪',
  'light hammer': '轻锤',
  mace: '重锤',
  quarterstaff: '长棍',
  sickle: '镰刀',
  spear: '矛',
  'light crossbow': '轻弩',
  dart: '飞镖',
  shortbow: '短弓',
  sling: '投石索',
  battleaxe: '战斧',
  flail: '连枷',
  glaive: '长柄刀',
  greataxe: '巨斧',
  greatsword: '巨剑',
  halberd: '长柄斧',
  lance: '骑枪',
  longsword: '长剑',
  maul: '巨槌',
  morningstar: '晨星锤',
  pike: '长矛',
  rapier: '细剑',
  scimitar: '弯刀',
  shortsword: '短剑',
  trident: '三叉戟',
  'war pick': '战镐',
  warhammer: '战锤',
  whip: '鞭',
  net: '捕网',
  blowgun: '吹箭筒',
  'hand crossbow': '手弩',
  'heavy crossbow': '重弩',
  longbow: '长弓',
  musket: '火铳',
  pistol: '手铳',
  firearms: '火器',
  firearm: '火器',
  'crossbow, light': '轻弩',
  'crossbow, hand': '手弩',
  'crossbow, heavy': '重弩',
};

// 护甲映射
export const ARMOR_MAP: Record<string, string> = {
  'light armor': '轻甲',
  'medium armor': '中甲',
  'heavy armor': '重甲',
  light: '轻甲',
  medium: '中甲',
  heavy: '重甲',
  shields: '盾牌',
  shield: '盾牌',
};

// 武器分类映射
export const WEAPON_CATEGORY_MAP: Record<string, string> = {
  'simple weapons': '简易武器',
  'martial weapons': '军用武器',
  simple: '简易武器',
  martial: '军用武器',
  'simple melee weapons': '简易近战武器',
  'simple ranged weapons': '简易远程武器',
  'martial melee weapons': '军用近战武器',
  'martial ranged weapons': '军用远程武器',
};

export const SIMPLE_WEAPONS = [
  'club',
  'dagger',
  'greatclub',
  'handaxe',
  'javelin',
  'light hammer',
  'mace',
  'quarterstaff',
  'sickle',
  'spear',
  'light crossbow',
  'dart',
  'shortbow',
  'sling',
];

export const MARTIAL_WEAPONS = [
  'battleaxe',
  'flail',
  'glaive',
  'greataxe',
  'greatsword',
  'halberd',
  'lance',
  'longsword',
  'maul',
  'morningstar',
  'pike',
  'rapier',
  'scimitar',
  'shortsword',
  'trident',
  'war pick',
  'warhammer',
  'whip',
  'blowgun',
  'hand crossbow',
  'heavy crossbow',
  'longbow',
  'musket',
  'pistol',
];

// 常用工具全列表 (用于 Any 展开)
export const ALL_TOOLS = [
  ...ARTISAN_TOOLS,
  ...GAMING_SETS,
  ...MUSICAL_INSTRUMENTS,
  'Disguise kit',
  'Forgery kit',
  'Herbalism kit',
  "Navigator's tools",
  "Poisoner's kit",
  "Thieves' tools",
];

// 语言全列表 (用于 Any 展开)
export const ALL_LANGUAGES = ALL_GAME_LANGUAGES.map((l) => l.id);

export const ABILITY_KEY_MAP: Record<string, any> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
  力量: 'str',
  敏捷: 'dex',
  体质: 'con',
  智力: 'int',
  感知: 'wis',
  魅力: 'cha',
  str: 'str',
  dex: 'dex',
  con: 'con',
  int: 'int',
  wis: 'wis',
  cha: 'cha',
};

export const ABILITY_LABEL_MAP: Record<string, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力',
};

export const CLASS_LABEL_MAP: Record<string, string> = {
  'rage charges': '狂暴次数',
  rages: '狂暴次数',
  'rage damage': '狂暴伤害',
  'mastery slots': '精通数量',
  'weapon mastery': '精通数量',
  'lay on hands pool': '圣疗池',
  'channel divinity': '引导神力',
  'prepared spells': '准备法术',
  'ki points': '气',
  'martial arts die': '武艺骰',
  'sneak attack': '偷袭',
  'sorcery points': '术法点',
  'bardic inspiration': '诗人激励',
  'infusion slots': '灌注数量',
  'second wind': '回气',
  'potent spellcasting': '强力施法',
  'divine strike': '神圣打击',
  'primal strike': '原力蛮击',
  magician: '术师',
  warden: '卫士',
  protector: '保护者',
  thaumaturge: '奇术使',
  radiant: '光耀',
  necrotic: '暗蚀',
  bear: '熊',
  eagle: '鹰',
  wolf: '狼',
  owl: '枭',
  panther: '豹',
  salmon: '鲑',
  falcon: '猎鹰',
  lion: '雄狮',
  ram: '角羊',
  'forceful blow': '强制驱散',
  'hamstring blow': '错愕打击',
  'staggering blow': '震慑重击',
  'sundering blow': '乱神重击',
  'armor training': '护甲受训',
  'armor proficiency': '护甲受训',
  'blessed warrior': '受祝福的勇士',
  'druidic warrior': '德鲁伊教战士',
  archery: '箭术',
  'blind fighting': '盲斗',
  defense: '防御',
  dueling: '对决',
  'great weapon fighting': '巨武器战斗',
  interception: '拦截',
  protection: '守护',
  'thrown weapon fighting': '投掷武器战斗',
  'two-weapon fighting': '双武器战斗',
  'unarmed fighting': '徒手战斗',
  // 魔能祈唤 Eldritch Invocations
  'armor of shadows': '幽影护甲',
  'eldritch mind': '魔能意志',
  'pact of the blade': '刃之魔契',
  'pact of the chain': '链之魔契',
  'pact of the tome': '书之魔契',
  'agonizing blast': '苦痛魔爆',
  "devil's sight": '魔鬼视界',
  'eldritch spear': '魔能长枪',
  'fiendish vigor': '邪魔活力',
  'lessons of the first ones': '原初之一的教习',
  'mask of many faces': '千面之颜',
  'misty visions': '幻象迷踪',
  'otherworldly leap': '超凡跳跃',
  'repelling blast': '斥力魔爆',
  'ascendant step': '星移步法',
  'eldritch smite': '魔能斩',
  'gaze of two minds': '共视感官',
  'gift of the depths': '深海馈赠',
  'investment of the chain master': '链主赋能',
  'master of myriad forms': '万形之主',
  'one with shadows': '融身入影',
  'thirsting blade': '饥渴魔刃',
  'whispers of the grave': '坟茔殁语',
  lifedrinker: '饮命者',
  'gift of the protectors': '守护馈赠',
  'visions of distant realms': '穹宇尽视',
  'devouring blade': '灭世魔刃',
  'witch sight': '巫术视界',
};

export const translateLabel = (label: string): string => {
  if (typeof label !== 'string') return String(label || '');
  const lowLabel = label.toLowerCase();
  return CLASS_LABEL_MAP[lowLabel] || WEAPON_MAP[lowLabel] || label;
};

export const CLASS_MAP: Record<string, string> = {
  wizard: '法师',
  cleric: '牧师',
  druid: '德鲁伊',
  bard: '吟游诗人',
  sorcerer: '术士',
  warlock: '魔契师',
  paladin: '圣武士',
  ranger: '游侠',
  barbarian: '野蛮人',
  fighter: '战士',
  monk: '武僧',
  rogue: '游荡者',
  游侠: '游侠',
  邪术师: '魔契师',
  魔契师: '魔契师',
  游荡者: '游荡者',
  野蛮人: '野蛮人',
  武僧: '武僧',
  圣武士: '圣武士',
  术士: '术士',
  法师: '法师',
  德鲁伊: '德鲁伊',
  牧师: '牧师',
  吟游诗人: '吟游诗人',
  战士: '战士',
};

export const translateClass = (name: string): string => {
  return CLASS_MAP[name.toLowerCase()] || CLASS_MAP[name] || name;
};

// 法术学派映射
export const SPELL_SCHOOL_MAP: Record<string, string> = {
  A: '防护系',
  Abjuration: '防护系',
  C: '咒法系',
  Conjuration: '咒法系',
  D: '预言系',
  Divination: '预言系',
  E: '惑控系',
  Enchantment: '惑控系',
  I: '幻术系',
  Illusion: '幻术系',
  N: '死灵系',
  Necromancy: '死灵系',
  V: '塑能系',
  Evocation: '塑能系',
  T: '变化系',
  Transmutation: '变化系',
};

import { getSourceDisplayName } from '../config/sourceMapping';

export const translateSource = (source: string): string => {
  return getSourceDisplayName(source);
};

export const translateSpellSchool = (school: string): string => {
  if (!school) return '';
  const lowSchool = school.toLowerCase();

  // 查找映射表，忽略大小写
  for (const [key, value] of Object.entries(SPELL_SCHOOL_MAP)) {
    if (key.toLowerCase() === lowSchool) return value;
  }

  return school;
};

// 施法要素翻译 (距离、时间等)
export const SPELL_ELEMENT_MAP: Record<string, string> = {
  // 施法动作/时间
  Action: '动作',
  '1 Action': '动作',
  'Magic Action': '动作',
  'Bonus Action': '附赠动作',
  附赠动作: '附赠动作',
  Reaction: '反应',
  反应: '反应',
  Minute: '分钟',
  Hour: '小时',
  // 距离与范围
  touch: '触碰',
  Touch: '触碰',
  sight: '视线',
  Sight: '视线',
  unlimited: '无限',
  Unlimited: '无限',
  self: '自身',
  Self: '自身',
  feet: '尺',
  Feet: '尺',
  miles: '英里',
  Miles: '英里',
  point: '点',
  Point: '点',
  radius: '半径',
  Radius: '半径',
  sphere: '球状',
  Sphere: '球状',
  cone: '锥状',
  Cone: '锥状',
  cube: '立方',
  Cube: '立方',
  line: '线状',
  Line: '线状',
  // 持续时间标签
  Concentration: '专注',
  instant: '瞬时',
  Instant: '瞬时',
  立即: '瞬时',
};

export const formatSpellRange = (range: string): string => {
  let result = range;
  Object.entries(SPELL_ELEMENT_MAP).forEach(([en, zh]) => {
    // 简单的替换逻辑，对于带有数值的如 "60 feet" -> "60 尺"
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    result = result.replace(regex, zh);
  });
  return result;
};

export const formatSpellDuration = (duration: string): string => {
  let result = duration;
  Object.entries(SPELL_ELEMENT_MAP).forEach(([en, zh]) => {
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    result = result.replace(regex, zh);
  });
  return result;
};

export const normalizeSkillId = (id: string): string => {
  if (typeof id !== 'string') return '';
  const lowId = id.toLowerCase().trim();
  if (lowId === 'acrobatics' || lowId === '体操' || lowId === '特技' || lowId === '杂技')
    return 'acrobatics';
  if (lowId === 'sleight of hand' || lowId === 'sleightofhand' || lowId === '巧手')
    return 'sleightOfHand';
  if (lowId === 'animal handling' || lowId === 'animalhandling' || lowId === '驯兽')
    return 'animalHandling';
  if (lowId === 'arcana' || lowId === '奥秘') return 'arcana';
  if (lowId === 'athletics' || lowId === '运动') return 'athletics';
  if (lowId === 'deception' || lowId === '欺瞒') return 'deception';
  if (lowId === 'history' || lowId === '历史') return 'history';
  if (lowId === 'insight' || lowId === '洞悉') return 'insight';
  if (lowId === 'intimidation' || lowId === '威吓') return 'intimidation';
  if (lowId === 'investigation' || lowId === '调查') return 'investigation';
  if (lowId === 'medicine' || lowId === '医药' || lowId === '医疗') return 'medicine';
  if (lowId === 'nature' || lowId === '自然') return 'nature';
  if (lowId === 'perception' || lowId === '察觉') return 'perception';
  if (lowId === 'performance' || lowId === '表演') return 'performance';
  if (lowId === 'persuasion' || lowId === '游说' || lowId === '说服') return 'persuasion';
  if (lowId === 'religion' || lowId === '宗教') return 'religion';
  if (lowId === 'stealth' || lowId === '隐匿') return 'stealth';
  if (lowId === 'survival' || lowId === '求生' || lowId === '生存') return 'survival';
  return lowId;
};

export const translateSkill = (id: string, includeAbility: boolean = true): string => {
  const normalized = normalizeSkillId(id);
  const zhName = SKILL_MAP[normalized] || id;
  if (includeAbility) {
    const abilityKey = SKILL_ABILITY_MAP[normalized];
    if (abilityKey) {
      const abilityZh = ABILITY_LABEL_MAP[abilityKey];
      return `${zhName}（${abilityZh}）`;
    }
  }
  return zhName;
};

/**
 * 通用熟练项翻译 (支持 技能/工具/属性/语言)
 * 优先返回纯中文名
 */
export const translateProficiency = (id: unknown): string => {
  if (!id) return '';

  let rawStr = '';
  let isOptional = false;

  if (typeof id === 'string') {
    rawStr = id.trim();
  } else if (typeof id === 'object' && id !== null) {
    const obj = id as Record<string, any>;
    const prof =
      typeof obj.proficiency === 'string'
        ? obj.proficiency.trim()
        : typeof obj.name === 'string'
          ? obj.name.trim()
          : '';
    if (!prof) return '';
    rawStr = prof;
    if (obj.optional) isOptional = true;
  } else {
    return '';
  }

  // 提取可选标记
  if (rawStr.includes('（可选）') || rawStr.includes('(optional)')) {
    isOptional = true;
    rawStr = rawStr.replace(/（可选）|\(optional\)/gi, '').trim();
  }

  if (!rawStr || rawStr.toLowerCase() === 'other') return '';
  const lowId = rawStr.toLowerCase().trim();

  // 0. 特殊处理带来源后缀的 ID (如 "drum|xphb")
  if (rawStr.includes('|')) {
    const toolDisplayName = getToolDisplayName(rawStr);
    if (toolDisplayName && toolDisplayName !== rawStr) {
      return isOptional ? `${toolDisplayName}（可选）` : toolDisplayName;
    }
    const [baseId, source] = rawStr.split('|');
    const translatedBase = translateProficiency(baseId);
    if (translatedBase && translatedBase !== baseId) {
      const formatted = `${translatedBase} [${getSourceDisplayName(source.toUpperCase())}]`;
      return isOptional ? `${formatted}（可选）` : formatted;
    }
  }

  const formatResult = (res: string) => (isOptional ? `${res}（可选）` : res);

  // 1. 优先检查工具映射 (直接匹配)
  if (TOOL_MAP[rawStr]) return formatResult(TOOL_MAP[rawStr]);
  if (TOOL_MAP[lowId]) return formatResult(TOOL_MAP[lowId]);

  // 2. 检查技能 (格式: 技能名 (属性))
  const normalizedSkill = normalizeSkillId(rawStr);
  if (SKILL_MAP[normalizedSkill]) {
    const abilityKey = SKILL_ABILITY_MAP[normalizedSkill];
    const abilityZh = abilityKey ? ABILITY_LABEL_MAP[abilityKey] : '';
    const res = abilityZh
      ? `${SKILL_MAP[normalizedSkill]}（${abilityZh}）`
      : SKILL_MAP[normalizedSkill];
    return formatResult(res);
  }

  // 3. 模糊检查工具 (处理 's, 空格, 横杠以及 -full 后缀等)
  const cleanId = lowId
    .replace(/['’]s/g, '')
    .replace(/s['’]/g, 's')
    .replace(/[^a-z0-9]/g, '');
  for (const key in TOOL_MAP) {
    const cleanKey = key
      .toLowerCase()
      .replace(/['’]s/g, '')
      .replace(/s['’]/g, 's')
      .replace(/[^a-z0-9]/g, '');
    if (cleanId === cleanKey || cleanId === cleanKey.replace(/full$/, ''))
      return formatResult(TOOL_MAP[key]);
  }

  // 4. 检查武器/护甲分类
  if (WEAPON_MAP[lowId]) return formatResult(WEAPON_MAP[lowId]);
  if (WEAPON_MAP[rawStr]) return formatResult(WEAPON_MAP[rawStr]);
  if (ARMOR_MAP[lowId]) return formatResult(ARMOR_MAP[lowId]);
  if (WEAPON_CATEGORY_MAP[lowId]) return formatResult(WEAPON_CATEGORY_MAP[lowId]);

  // 5. 检查伤害类型
  if (DAMAGE_TYPE_MAP[lowId]) return formatResult(DAMAGE_TYPE_MAP[lowId]);
  if (DAMAGE_TYPE_MAP[rawStr]) return formatResult(DAMAGE_TYPE_MAP[rawStr]);

  // 6. 检查语言
  if (LANGUAGE_MAP[lowId]) return formatResult(LANGUAGE_MAP[lowId]);
  if (LANGUAGE_MAP[rawStr]) return formatResult(LANGUAGE_MAP[rawStr]);
  const cleanLangKey = lowId.replace(/[^a-z0-9]/g, '');
  if (LANGUAGE_MAP[cleanLangKey]) return formatResult(LANGUAGE_MAP[cleanLangKey]);

  const language = ALL_GAME_LANGUAGES.find(
    (l) =>
      l.id.toLowerCase() === lowId ||
      l.nameEn.toLowerCase() === lowId ||
      l.name === rawStr ||
      l.name === lowId ||
      l.id.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanLangKey,
  );
  if (language && language.name && /[\u4e00-\u9fa5]/.test(language.name)) {
    return formatResult(language.name);
  }

  // 7. 检查感官
  const senseZh = SENSE_MAP[lowId];
  if (senseZh) return formatResult(senseZh);

  // 8. 检查属性
  const abilityKey = ABILITY_KEY_MAP[lowId];
  if (abilityKey) return formatResult(ABILITY_LABEL_MAP[abilityKey]);

  // 9. 检查 5etools Catalog 工具动态提取库与扩展
  const toolNameZh = getToolDisplayName(rawStr);
  if (toolNameZh && toolNameZh !== rawStr) return formatResult(toolNameZh);

  return formatResult(rawStr);
};

export const DAMAGE_TYPE_MAP: Record<string, string> = {
  acid: '酸蚀',
  bludgeoning: '钝击',
  cold: '寒冷',
  fire: '火焰',
  force: '力场',
  lightning: '闪电',
  necrotic: '死灵',
  piercing: '穿刺',
  poison: '毒素',
  psychic: '心灵',
  radiant: '光耀',
  slashing: '挥砍',
  thunder: '雷鸣',
  酸蚀: '酸蚀',
  钝击: '钝击',
  寒冷: '寒冷',
  火焰: '火焰',
  力场: '力场',
  闪电: '闪电',
  死灵: '死灵',
  穿刺: '穿刺',
  毒素: '毒素',
  心灵: '心灵',
  光耀: '光耀',
  挥砍: '挥砍',
  雷鸣: '雷鸣',
};

export const LANGUAGE_MAP: Record<string, string> = {
  common: '通用语',
  dwarvish: '矮人语',
  elvish: '精灵语',
  giant: '巨人语',
  gnomish: '侏儒语',
  goblin: '地精语',
  halfling: '半身人语',
  orc: '兽人语',
  abyssal: '深渊语',
  celestial: '天界语',
  draconic: '龙语',
  deepspeech: '深语',
  'deep speech': '深语',
  infernal: '炼狱语',
  primordial: '原初语',
  sylvan: '木族语',
  undercommon: '地底通用语',
  druidic: '德鲁伊语',
  thievescant: '盗贼暗语',
  "thieves' cant": '盗贼暗语',
  'thieves cant': '盗贼暗语',
  auran: '气族语',
  aquan: '水族语',
  ignan: '火族语',
  terran: '土族语',
  telepathy: '心电感应',
  aarakocra: '鸟羽人语',
  gith: '吉斯语',
  grung: '格朗语',
  quori: '梦灵语',
  vedalken: '维达肯语',
  commonsignlanguage: '通用手语',
  'common sign language': '通用手语',
  commontradepidgin: '通用贸易皮钦语',
  'common trade pidgin': '通用贸易皮钦语',
  // 中文自我对齐
  通用语: '通用语',
  矮人语: '矮人语',
  精灵语: '精灵语',
  巨人语: '巨人语',
  侏儒语: '侏儒语',
  哥布林语: '哥布林语',
  地精语: '地精语',
  半身人语: '半身人语',
  兽人语: '兽人语',
  深渊语: '深渊语',
  天界语: '天界语',
  龙语: '龙语',
  深语: '深语',
  炼狱语: '炼狱语',
  地狱语: '炼狱语',
  原初语: '原初语',
  木族语: '木族语',
  地底通用语: '地底通用语',
  德鲁伊语: '德鲁伊语',
  盗贼暗语: '盗贼暗语',
  气族语: '气族语',
  风族语: '风族语',
  水族语: '水族语',
  火族语: '火族语',
  土族语: '土族语',
  心电感应: '心电感应',
};

/**
 * 专门用于翻译感官的工具函数
 */
export const translateSense = (senseId: string | undefined | null): string => {
  if (!senseId) return '';
  const lowId = senseId.toLowerCase().trim();
  return SENSE_MAP[lowId] || senseId;
};

export const normalizeAbilityKey = (value: string): string | undefined => {
  return ABILITY_KEY_MAP[value.trim().toLowerCase()] || ABILITY_KEY_MAP[value.trim()];
};

export const translateAbilityKey = (value: string): string => {
  if (!value) return '';
  const lowValue = value.trim().toLowerCase();
  // 先找缩写，再找对应的中文标签
  const normalized = ABILITY_KEY_MAP[lowValue] || lowValue;
  return ABILITY_LABEL_MAP[normalized] || value;
};

export const formatSpellComponent = (components: string): string => {
  if (!components) return '';
  let result = components;
  // 处理英文代码
  result = result.replace(/\bv\b/gi, '咒语');
  result = result.replace(/\bs\b/gi, '姿势');
  result = result.replace(/\bm\b/gi, '材料');
  result = result.replace(/\br\b/gi, '仪式成分');
  // 标准化描述 (避免过度说明)
  return result;
};

export const formatActionType = (action: string): string => {
  if (!action) return '';
  const lowAction = action.toLowerCase();
  if (lowAction === 'magic action' || lowAction === 'action' || lowAction === '1 action')
    return '动作';
  if (lowAction === 'bonus action') return '附赠动作';
  if (lowAction === 'reaction') return '反应';
  return SPELL_ELEMENT_MAP[action] || action;
};
