import { CharacterState } from '../types/characterState';
import { SpeciesSchema, BackgroundSchema, FeatSchema, SpellSchema, ClassDataSchema } from '../types/schemas';
import { z } from 'zod';

/**
 * 本项目原生 JSON 导入导出
 */
export function exportToJSON(character: CharacterState): string {
  return JSON.stringify(character, null, 2);
}

export async function importFromJSON(jsonStr: string): Promise<CharacterState> {
  try {
    const data = JSON.parse(jsonStr);
    // 这里可以添加基础校验，确保至少有 id 和 name
    if (!data.id) throw new Error('无效的角色数据：缺失 ID');
    return data as CharacterState;
  } catch (e) {
    throw new Error('导入失败：' + (e instanceof Error ? e.message : '未知错误'));
  }
}

/**
 * Markdown 导出引擎
 */
export function exportToMarkdown(character: CharacterState, context: {
  species?: any,
  background?: any,
  primaryClass?: any,
  subclass?: any,
  ability: any,
  combat: any,
  proficiencies: any,
  spellcasting: any,
  featDetails: any[],
  spellDetails: any[],
  cantripDetails: any[]
}): string {
  const { 
    species, background, primaryClass, subclass, 
    ability, combat, proficiencies, spellcasting,
    featDetails, spellDetails, cantripDetails 
  } = context;

  const totalLevel = character.classes?.reduce((acc, c) => acc + c.level, 0) || 1;
  const pb = Math.floor((totalLevel - 1) / 4) + 2;

  let md = `# ${character.name || '未命名角色'} · 角色卡\n\n`;
  
  md += `## 1. 基础信息\n`;
  md += `- **玩家名**：${character.playerName || '未填写'}\n`;
  md += `- **种族**：${species?.name || '未选择'}\n`;
  md += `- **背景**：${background?.name || '未选择'}\n`;
  md += `- **职业与等级**：${primaryClass?.name || ''} Lv.${totalLevel} ${subclass ? `(${subclass.name})` : ''}\n`;
  md += `- **阵营**：${character.alignment || '未填写'}\n`;
  md += `- **经验值**：0\n`;
  md += `- **熟练加值**：+${pb}\n\n`;

  md += `## 2. 核心属性\n`;
  md += `| 属性 | 数值 | 调整值 | 豁免 |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  Object.entries(ability.scores).forEach(([key, val]) => {
    const mod = ability.modifiers[key as keyof typeof ability.modifiers];
    const isProf = proficiencies.saves.some((s: any) => s.id === key);
    const modStr = mod >= 0 ? `+${mod}` : mod;
    const saveStr = isProf ? `✅ ${mod + pb >= 0 ? `+${mod + pb}` : mod + pb}` : '--';
    const labelMap: Record<string, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
    md += `| ${labelMap[key]} | ${val} | ${modStr} | ${saveStr} |\n`;
  });
  md += `\n`;

  md += `## 3. 战斗数据\n`;
  md += `- **护甲等级 (AC)**：${combat.ac}\n`;
  md += `- **先攻加值**：${combat.initiative >= 0 ? `+${combat.initiative}` : combat.initiative}\n`;
  md += `- **移动速度**：${combat.speed}\n`;
  md += `- **生命值 (HP)**：${combat.hp.current} / ${combat.hp.max} ${combat.hp.temp ? `(临时: ${combat.hp.temp})` : ''}\n`;
  md += `- **生命骰**：${totalLevel - (character.hitDiceUsed ?? 0)} / ${totalLevel} (d${primaryClass?.hitPointDie || 8})\n`;
  md += `- **被动属性**：被动察觉 ${10 + (proficiencies.skills.find((s: any) => s.id === 'perception')?.bonus ?? ability.modifiers.wis)}，被动洞悉 ${10 + (proficiencies.skills.find((s: any) => s.id === 'insight')?.bonus ?? ability.modifiers.wis)}，被动调查 ${10 + (proficiencies.skills.find((s: any) => s.id === 'investigation')?.bonus ?? ability.modifiers.int)}\n\n`;

  md += `## 4. 技能熟练\n`;
  md += `| 技能 | 加值 | 熟练度 |\n`;
  md += `| :--- | :--- | :--- |\n`;
  const skillToAbility: Record<string, string> = {
    arcana: 'int', history: 'int', investigation: 'int', nature: 'int', religion: 'int',
    athletics: 'str', acrobatics: 'dex', sleightOfHand: 'dex', stealth: 'dex',
    insight: 'wis', animalHandling: 'wis', medicine: 'wis', perception: 'wis', survival: 'wis',
    deception: 'cha', intimidation: 'cha', performance: 'cha', persuasion: 'cha'
  };
  const skillNames: Record<string, string> = {
    arcana: '奥秘', history: '历史', investigation: '调查', nature: '自然', religion: '宗教',
    athletics: '运动', acrobatics: '体操', sleightOfHand: '巧手', stealth: '隐匿',
    insight: '洞悉', animalHandling: '驯兽', medicine: '医药', perception: '察觉', survival: '生存',
    deception: '欺瞒', intimidation: '威吓', performance: '表演', persuasion: '游说'
  };
  
  Object.entries(skillNames).forEach(([id, name]) => {
    const prof = proficiencies.skills.find((p: any) => p.id === id);
    const isExp = character.expertiseSkills?.includes(id);
    const baseMod = ability.modifiers[skillToAbility[id] as keyof typeof ability.modifiers];
    let total = baseMod + (prof ? pb : 0) + (isExp ? pb : 0);
    md += `| ${name} | ${total >= 0 ? `+${total}` : total} | ${isExp ? '专精' : prof ? '熟练' : '--'} |\n`;
  });
  md += `\n`;

  md += `## 5. 特性与专长\n`;
  md += `### 种族特质 (${species?.name || '未选择'})\n`;
  (species?.traits || []).forEach((t: any) => {
    md += `- **${t.name}**：${t.description}\n`;
  });
  md += `\n### 专长\n`;
  featDetails.forEach((f: any) => {
    md += `- **${f.name}**：${f.description}\n`;
  });
  md += `\n`;

  if (spellcasting.spellcastingAbility) {
    md += `## 6. 法术信息\n`;
    md += `- **施法属性**：${spellcasting.spellcastingAbility.toUpperCase()}\n`;
    md += `- **法术 DC**：${spellcasting.spellDC}\n`;
    md += `- **法术攻击**：${spellcasting.spellAttack >= 0 ? `+${spellcasting.spellAttack}` : spellcasting.spellAttack}\n\n`;
    
    md += `### 戏法\n`;
    cantripDetails.forEach(s => md += `- ${s.name}\n`);
    md += `\n### 已准备法术\n`;
    spellDetails.forEach(s => md += `- ${s.name} (${s.level}环)\n`);
    md += `\n`;
  }

  md += `## 7. 装备与财富\n`;
  md += `- **货币**：GP: ${character.currency.gp}, SP: ${character.currency.sp}, CP: ${character.currency.cp}\n`;
  md += `- **库存**：\n`;
  character.inventoryEntries.forEach(e => md += `  - ${e.name} (x${e.quantity || 1})\n`);
  md += `\n`;

  md += `## 8. 背景与描述\n`;
  md += `### 个人设定\n`;
  md += `- **信仰**：${character.faith || '未填写'}\n`;
  md += `- **外貌**：${character.appearance || '未填写'}\n`;
  md += `\n### 背景故事\n`;
  md += `${character.backstory || '未填写'}\n`;

  return md;
}
