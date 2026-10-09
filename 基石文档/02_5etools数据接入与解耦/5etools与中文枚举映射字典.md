# 5etools 与中文枚举映射字典 (5etools CN Schema Dictionary)

> **版本**：v2.0 (2026-09)  
> **定位**：供前端 UI 渲染、5etools 动态适配器 (`src/lib/5etools/`) 及 Mechanics Overlay 统一消费的枚举与代码对照字典。整合并替代原分散的 7 篇映射文档。

---

## 1. 核心属性与技能 (Abilities & Skills)

### 1.1 属性映射

| 代码 (Key) | 英文全称 | 中文名称 | 缩写 |
|---|---|---|---|
| `str` | Strength | 力量 | 力 |
| `dex` | Dexterity | 敏捷 | 敏 |
| `con` | Constitution | 体质 | 体 |
| `int` | Intelligence | 智力 | 智 |
| `wis` | Wisdom | 感知 | 感 |
| `cha` | Charisma | 魅力 | 魅 |

### 1.2 技能映射 (18 项)

| 技能代码 | 英文名称 | 中文名称 | 关联属性 |
|---|---|---|---|
| `athletics` | Athletics | 运动 | `str` |
| `acrobatics` | Acrobatics | 体操 | `dex` |
| `sleight of hand` | Sleight of Hand | 巧手 | `dex` |
| `stealth` | Stealth | 隐匿 | `dex` |
| `arcana` | Arcana | 奥秘 | `int` |
| `history` | History | 历史 | `int` |
| `investigation` | Investigation | 调查 | `int` |
| `nature` | Nature | 自然 | `int` |
| `religion` | Religion | 宗教 | `int` |
| `animal handling` | Animal Handling | 驯兽 | `wis` |
| `insight` | Insight | 洞悉 | `wis` |
| `medicine` | Medicine | 医药 | `wis` |
| `perception` | Perception | 察觉 | `wis` |
| `survival` | Survival | 求生 | `wis` |
| `deception` | Deception | 欺瞒 | `cha` |
| `intimidation` | Intimidation | 威吓 | `cha` |
| `performance` | Performance | 表演 | `cha` |
| `persuasion` | Persuasion | 说服 | `cha` |

---

## 2. 物品与武器系统 (Items & Equipment)

### 2.1 物品类型代码 (`type`)

| 代码 | 英文类型 | 中文类型 | 说明 |
|---|---|---|---|
| `LA` | Light Armor | 轻甲 | 基础护甲 |
| `MA` | Medium Armor | 中甲 | 基础护甲 |
| `HA` | Heavy Armor | 重甲 | 基础护甲 |
| `S` | Shield | 盾牌 | 提供 AC 加值 |
| `M` | Melee Weapon | 近战武器 | 匕首、长剑等 |
| `R` | Ranged Weapon | 远程武器 | 短弓、轻弩等 |
| `A` | Ammunition | 弹药 | 箭、弩矢等 |
| `AF` | Ammunition (Firearm) | 弹药（枪械） | 子弹、弹药筒 |
| `P` | Potion | 药水 | 消耗品 |
| `RD` | Rod | 权杖 | 施法/特殊法器 |
| `RG` | Ring | 戒指 | 饰品 |
| `SC` | Scroll | 卷轴 | 法术卷轴 |
| `ST` | Staff | 法杖 | 武器/施法法器 |
| `WD` | Wand | 魔杖 | 施法法器 |
| `W` | Wondrous Item | 奇物 | 魔法装备 |
| `T` | Tool | 工具 | 通用工具 |
| `AT` | Artisan's Tools | 工匠工具 | 炼金、锻造等 |
| `GS` | Gaming Set | 赌具 | 龙棋、骰子等 |
| `INS` | Musical Instrument | 乐器 | 鲁特琴、笛等 |
| `SCF` | Spellcasting Focus | 施法法器 | 圣徽、水晶、法球 |
| `G` | Adventuring Gear | 冒险装备 | 背包、绳索、火把等 |
| `MNT` | Mount | 坐骑 | 战马、骡等 |
| `VEH` | Vehicle (Land) | 陆地载具 | 马车、战车 |
| `SHP` | Vehicle (Water) | 水面舰船 | 帆船、划艇 |
| `AIR` | Vehicle (Air) | 飞空载具 | 飞空艇 |
| `TAH` | Tack and Harness | 马具 | 马鞍、鞍囊 |
| `FD` | Food & Drink | 饮食补给 | 铁配给、麦酒 |
| `TG` | Treasure / Gem | 珍宝/宝石 | 艺术品、宝石 |
| `EXP` | Explosive | 爆炸物 | 炸药包、火药 |
| `OTH` | Other | 其他 | 未归类杂物 |

### 2.2 武器与物品属性代码 (`property`)

| 代码 | 中文名称 | 英文名称 | 规则含义 |
|---|---|---|---|
| `F` | 灵巧 | Finesse | 可选用敏捷代替力量进行命中与伤害加值 |
| `L` | 轻型 | Light | 适配双武器战斗与副手攻击 |
| `H` | 重型 | Heavy | 小型及微型体型生物使用有劣势 |
| `V` | 多用 | Versatile | 双手握持时伤害骰提升（如 1d8/1d10） |
| `2H` | 双手 | Two-Handed | 必须使用双手进行攻击 |
| `R` | 触及 | Reach | 触及距离 +5 尺 |
| `T` | 投掷 | Thrown | 可作远程投掷攻击，具备通常/最大射程 |
| `A` | 弹药 | Ammunition | 射击消耗弹药，装填需空手 |
| `LD` | 装填 | Loading | 一轮仅可单次动作/附赠射击一次（除非特长免除） |
| `CNS` | 消耗品 | Consumable | 使用后即销毁 |

### 2.3 2024版武器掌握特性 (Weapon Mastery)

| 代码/名称 | 中文名称 | 效果简述 |
|---|---|---|
| `Cleave` | 顺势斩 | 命中后可对5尺内另一目标进行一次额外攻击（不加属性伤害） |
| `Graze` | 擦伤 | 攻击未命中时依然对目标造成等于属性调整值的伤害 |
| `Nick` | 疾袭 | 轻型副手武器攻击可以作为主手攻击动作的一部分（不耗附赠动作） |
| `Push` | 击退 | 命中后可将目标推离自身至多 10 尺（需体型限制） |
| `Sap` | 迟滞 | 命中后令目标下一次攻击检定承受劣势 |
| `Slow` | 减速 | 命中后令目标直到其下回合开始前速度减少 10 尺 |
| `Topple` | 绊摔 | 命中后目标必须通过体质豁免，失败则倒地 |
| `Vex` | 烦扰 | 命中后你在该回合结束前对该目标的下一次攻击获得优势 |

---

## 3. 法术系统 (Spells)

### 3.1 学派代码 (`school`)

| 代码 | 中文名称 | 英文名称 | 简称 |
|---|---|---|---|
| `A` | 防护系 | Abjuration | 防护 |
| `C` | 咒法系 | Conjuration | 咒法 |
| `D` | 预言系 | Divination | 预言 |
| `E` | 惑控系 | Enchantment | 惑控 |
| `I` | 幻术系 | Illusion | 幻术 |
| `N` | 死灵系 | Necromancy | 死灵 |
| `V` | 塑能系 | Evocation | 塑能 |
| `T` | 变化系 | Transmutation | 变化 |

### 3.2 成分 (`components`)

- `v`: 语言成分 (Verbal)
- `s`: 姿势成分 (Somatic)
- `m`: 材料成分 (Material - 包含价值与消耗标记)
- `r`: 仪式成分 (Ritual)

---

## 4. 专长与恩惠 (Feats & Boons)

### 4.1 专长类别 (`category`)

| 代码 | 中文类别 | 说明 |
|---|---|---|
| `O` | 起源专长 (Origin) | 1级可选或背景授予，无前置属性/等级门槛 |
| `G` | 通用专长 (General) | 4级及以上可选属性值提升替代 |
| `FS` | 战斗风格 (Fighting Style) | 战士/圣武士/游侠特性专长 |
| `EB` | 史诗恩惠 (Epic Boon) | 19级或传奇等级专用高阶专长 |

### 4.2 前置要求键位 (`prerequisite`)

- `level`: 人物总等级或职业等级要求
- `ability`: 属性值门槛（如 `{ str: 13 }`）
- `race`: 种族/血系统限定
- `proficiency`: 护甲、武器熟练项要求
- `spellcasting`: 具备施法能力

---

## 5. 出版物来源代码映射 (Sources / Books)

### 5.1 2024 / 2014 核心书源

| 5etools 代码 | 官方英文全称 | 中文标准译名 | 规则轨 |
|---|---|---|---|
| `XPHB` | Player's Handbook (2024) | 2024 玩家手册 | 2024 规则 |
| `XDMG` | Dungeon Master's Guide (2024) | 2024 地下城主指南 | 2024 规则 |
| `XMM` | Monster Manual (2025) | 2025 怪物图鉴 | 2024 规则 |
| `PHB` | Player's Handbook (2014) | 2014 玩家手册 | 2014 规则 |
| `DMG` | Dungeon Master's Guide (2014) | 2014 地下城主指南 | 2014 规则 |
| `MM` | Monster Manual (2014) | 2014 怪物图鉴 | 2014 规则 |

### 5.2 核心扩展与战役设定集

| 5etools 代码 | 中文标准译名 | 规则兼容模式 |
|---|---|---|
| `TCE` | 塔莎的万事坩埚 | 2014 扩展 / 2024 规则可向下兼容 |
| `XGE` | 珊娜萨的万事指南 | 2014 扩展 / 2024 规则可向下兼容 |
| `MPMM` | 魔邓肯巨献：多元宇宙的怪物 | 种族/怪物通用 |
| `FTD` | 费资本的巨龙宝库 | 龙族选项扩展 |
| `BGG` | 毕格比巨献：巨人之荣耀 | 巨人选项扩展 |
| `SCAG` | 剑湾冒险者指南 | 费伦设定集 |
| `ERLW` | 艾伯伦：从终末战争中崛起 | 艾伯伦设定集（奇械师源） |
| `VRGR` | 范·里希腾的鸦阁魔域指南 | 鸦阁暗黑设定集 |
| `AAG` | 星界冒险者指南 | 魔法船设定集 |
| `SCC` | 斯翠海文：混沌研习 | 学院魔法设定集 |
| `MOT` | 塞洛斯之神话奥德赛 | 希腊神话设定集 |
| `GGR` | 拉尼卡公会长指南 | 万智牌公会设定集 |
| `DSotDQ` | 龙枪：龙后之影 | 龙枪战役设定集 |
| `BMT` | 万象无常书 | 牌书扩展 |
