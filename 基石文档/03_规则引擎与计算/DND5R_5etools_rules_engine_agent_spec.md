# D&D 5e / 5R 车卡器：5etools 数据接入与自动规则引擎改造规范

> 面向对象：已有一个可运行的 D&D 车卡器，希望引入 5etools / 中文 5etools 兼容数据，并逐步实现稳定的自动计算能力。  
> 目标读者：开发者、AI Coding Agent、代码重构代理。  
> 文档定位：**实施规范（Implementation Spec）**，不是纯架构讨论。  
> 推荐技术栈：TypeScript + React/Vue/Svelte 任一前端；IndexedDB / SQLite 做本地缓存；Vitest/Jest 做测试。  
> 核心原则：**5etools 是内容数据源，不是完整规则执行引擎。**

---

# 1. 改造目标

将现有“静态数据 + UI 内计算 + 名称判断”的车卡器，逐步改造成：

```text
5etools / 中文镜像 / Homebrew
              │
              ▼
        Source Adapter
              │
              ▼
       Resolver / Parser
     (_copy/_mod/refs/tags)
              │
              ▼
       Normalized Catalog
              │
      ┌───────┴────────┐
      ▼                ▼
   Wiki/UI         Character Builder
                       │
                       ▼
                 Choice Resolution
                       │
                       ▼
                   Rule Effects
                       │
                       ▼
                  Rules Engine
                       │
                       ▼
               Derived Character
                       │
                       ▼
              Character Snapshot
```

最终希望做到：

```text
换资料源
→ 不改规则引擎

更新 5etools
→ 不自动污染旧角色

新增 Homebrew
→ 不改 Character Schema

新增一个职业自动规则
→ 不改 Catalog

自动算不了
→ 能明确提示，并允许人工覆盖

任何最终数值
→ 都可以解释“为什么是这个值”
```

---

# 2. 非目标

本次改造**不要**试图完成以下事情：

1. 不要求第一版完整自动化全部 D&D 规则。
2. 不尝试通过正则或 LLM 自动理解全部自然语言规则文本。
3. 不把 5etools 原始 JSON 直接作为角色模型。
4. 不要求一次性替换现有 UI。
5. 不要求一次性替换全部旧数据。
6. 不要求立刻支持所有 Homebrew。
7. 不要求第一阶段支持怪物、神祇、冒险书、表格等 DM 向数据。

---

# 3. 强制架构边界

项目必须至少拆成以下五个逻辑边界：

```text
src/
  catalog/
  character/
  rules/
  source/
  ui/
```

职责：

```text
source/
→ 数据从哪里来

catalog/
→ 数据是什么

character/
→ 玩家选了什么

rules/
→ 这些选择产生什么机械效果

ui/
→ 如何显示和交互
```

禁止：

```text
UI 组件直接 fetch 5etools
UI 组件直接解析 _copy
UI 组件直接判断职业中文名
UI 组件直接算 AC / HP / Spell DC
CharacterData 直接存所有最终派生数值
```

---

# 4. 推荐目录结构

```text
src/

  source/
    types.ts
    fiveetools/
      client.ts
      paths.ts
      cache.ts
      loader.ts
    fiveetools-cn/
      adapter.ts
    homebrew/
      adapter.ts

  catalog/
    types.ts
    catalog.ts
    identity.ts
    search.ts

    normalize/
      index.ts
      class.ts
      subclass.ts
      race.ts
      background.ts
      feat.ts
      spell.ts
      item.ts
      feature.ts

    resolver/
      copy.ts
      mod.ts
      versions.ts
      subrace.ts
      items.ts
      references.ts
      inlineTags.ts

  character/
    types.ts
    initial.ts
    choices.ts
    snapshot.ts
    migration.ts
    persistence.ts

  rules/
    types.ts
    engine.ts
    conditions.ts
    effects.ts
    modifiers.ts
    trace.ts
    warnings.ts

    derived/
      abilities.ts
      proficiency.ts
      skills.ts
      saves.ts
      hp.ts
      ac.ts
      initiative.ts
      spellcasting.ts
      inventory.ts

    rulesets/
      2014.ts
      2024.ts

    registry/
      classes/
      subclasses/
      feats/
      races/
      items/

  ui/
    ...
```

如果现有项目不是 `src/` 结构，可以保持原目录，但逻辑边界必须等价。

---

# 5. 数据源接口

所有远程资料源统一实现：

```ts
export interface RuleSource {
  id: string;
  name: string;
  kind: '5etools' | '5etools-cn' | 'homebrew';

  fetchJson<T>(
    path: string,
    options?: {
      signal?: AbortSignal;
      refresh?: boolean;
    }
  ): Promise<FetchResult<T>>;
}

export interface FetchResult<T> {
  body: T;
  revision: string;
  cached: boolean;
  fetchedAt: number;
}
```

配置：

```ts
export interface DataSourceConfig {
  id: string;
  name: string;
  baseUrl: string;
  kind: '5etools' | '5etools-cn' | 'homebrew';
  enabled: boolean;
}
```

要求：

- 业务代码不得写死具体域名。
- baseUrl 必须通过配置注入。
- Source Adapter 负责网络、缓存、revision。
- UI 不感知具体源地址。

---

# 6. 5etools 数据加载策略

常见直接文件：

```text
data/races.json
data/backgrounds.json
data/feats.json
data/items-base.json
data/items.json
data/optionalfeatures.json
data/conditionsdiseases.json
data/actions.json
data/skills.json
data/senses.json
data/languages.json
data/variantrules.json
```

常见索引：

```text
data/class/index.json
data/spells/index.json
data/bestiary/index.json
```

禁止写死所有分文件：

```ts
// 禁止
fetch("spells-phb.json")
fetch("spells-xge.json")
fetch("spells-tce.json")
```

必须：

```ts
const index = await source.fetchJson<Record<string, string>>(
  'data/spells/index.json'
);

for (const file of Object.values(index.body)) {
  await load(`data/spells/${file}`);
}
```

---

# 7. 第一阶段只接这些数据类型

优先级 P0：

```text
class
subclass
classFeature
subclassFeature

race
subrace

background
feat

spell

item
baseitem

optionalfeature
condition
```

暂缓：

```text
monster
deity
cult
boon
psionic
adventure
book
table
facility
```

目标是先服务车卡，不是先复制整个 5etools Wiki。

---

# 8. Catalog：必须有你自己的标准模型

禁止 UI 和规则引擎直接消费 5etools raw JSON。

```ts
export type EntryKind =
  | 'class'
  | 'subclass'
  | 'race'
  | 'background'
  | 'feat'
  | 'spell'
  | 'item'
  | 'feature'
  | 'condition'
  | 'rule'
  | 'monster';

export type Edition =
  | '2014'
  | '2024'
  | 'both';

export interface CatalogEntry {
  id: string;

  kind: EntryKind;

  name: string;
  englishName?: string;

  source: string;
  edition: Edition;

  page?: number;

  sourcePackId: string;
  revision: string;

  entries: unknown[];

  raw: Record<string, unknown>;
}
```

允许为各类数据建立扩展模型：

```ts
export interface SpellCatalogEntry extends CatalogEntry {
  kind: 'spell';

  spell: {
    level: number;
    school: string;

    classIds: string[];

    ritual?: boolean;
    concentration?: boolean;
  };
}
```

---

# 9. 稳定 ID

禁止：

```text
数组 index
中文名
随机 UUID
```

作为规则实体主 ID。

推荐：

```ts
function makeEntryId(input: {
  packId: string;
  kind: string;
  source?: string;
  name?: string;
  parent?: string;
  level?: number;
}) {
  return [
    input.packId,
    input.kind,
    input.source,
    input.name,
    input.parent,
    input.level
  ]
    .filter(v => v !== undefined && v !== '')
    .map(v => encodeURIComponent(
      String(v).trim().toLowerCase()
    ))
    .join(':');
}
```

职业特性必须包含：

```text
class
classSource
level
feature name
```

子职业特性必须包含：

```text
class
subclass
level
feature name
source
```

角色保存、收藏、选择、Snapshot、规则 Registry 均依赖稳定 ID。

---

# 10. 中文数据兼容

不要把中文数据差异散落在 UI。

建立 Source Adapter：

```ts
export interface CanonicalRaw {
  name: string;
  englishName?: string;
  source?: string;

  [key: string]: unknown;
}
```

示例：

```ts
function normalizeNames(raw: any) {
  return {
    name:
      raw.name ??
      raw.translatedName ??
      raw.zhName ??
      raw.ENG_name ??
      '未命名',

    englishName:
      raw.ENG_name ??
      raw.name_en ??
      raw.originalName ??
      undefined
  };
}
```

规则：

```text
Source-specific Raw
        ↓
Source Adapter
        ↓
Canonical Raw
        ↓
Normalizer
```

---

# 11. 2014 / 2024 必须独立

```ts
export type Edition =
  | '2014'
  | '2024'
  | 'both';
```

角色固定自己的 Ruleset：

```ts
export interface CharacterRuleset {
  edition: '2014' | '2024';
  enabledSources: string[];
}
```

禁止：

```text
当前 UI 的筛选器
=
角色规则版本
```

2014 与 2024 的规则模块必须允许分离：

```text
rules/rulesets/2014.ts
rules/rulesets/2024.ts
```

避免整个代码库出现大量：

```ts
if (edition === '2024') ...
else ...
```

---

# 12. Resolver：必须在 normalize 之前处理

推荐顺序：

```text
raw
↓
resolveSubraceInheritance
↓
resolveCopies
↓
applyMods
↓
expandVersions
↓
resolveItemReferences
↓
normalize
```

---

# 13. `_copy` / `_mod`

这是兼容 5etools 的重点。

第一阶段至少支持：

```text
appendArr
prependArr
insertArr
replaceArr
replaceOrAppendArr
removeArr

replaceTxt

scalarAddHit
scalarAddDc
scalarAddProp
scalarMultProp

addSenses
addSkills

addSpells
replaceSpells
removeSpells
```

禁止：

```text
遇到未知 _mod
→ 静默猜测
```

必须：

```ts
interface ResolverWarning {
  code: 'UNSUPPORTED_MOD';
  message: string;
  entry?: string;
}
```

未知 modifier 继续保留条目，但标记 warning。

---

# 14. `_versions`

同一 raw entry 中的不同版本应展开成独立 Catalog Entry。

禁止只保留主对象。

流程：

```text
base entry
+
_versions
↓
materialized entries
↓
unique stable IDs
```

---

# 15. 物品数据必须合并处理

不能只读取：

```text
items.json
```

至少考虑：

```text
items-base.json
items.json
magicvariants.json
itemEntry
itemType
itemProperty
itemMastery
```

推荐：

```text
baseitem
+
item
+
magicvariant
↓
expand
↓
normalize
↓
ItemCatalogEntry[]
```

---

# 16. Inline Tag Parser

必须支持 5etools 风格：

```text
{@spell fireball|PHB}
{@item longsword|PHB}
{@condition prone}
{@damage 2d6}
{@dice 1d20+5}
{@dc 15}
{@hit 7}
```

不要用 `dangerouslySetInnerHTML` 直接渲染。

建议 Tokenizer：

```ts
export interface InlineToken {
  type: 'text' | 'tag';

  raw: string;

  tag?: string;
  args?: string[];
}
```

基础正则：

```ts
const TAG_RE = /\{@(\w+)(?:\s+([^{}]*))?\}/g;
```

第一批 tag：

```text
spell
item
creature
class
race
background
feat
condition
skill
sense
action
language
optfeature
variantrule

dice
damage
d20
hit
dc

b
bold
i
italic
```

---

# 17. Reference Resolver

```text
{@spell fireball|PHB}
```

必须解析成内部 CatalogEntry。

```ts
function resolveReference(
  catalog: CatalogService,
  input: {
    kind?: EntryKind;
    name: string;
    source?: string;
  }
): CatalogEntry | undefined
```

用途：

```text
文内跳转
Hover Card
拖拽到角色
自动查找 spell/item
规则依赖
```

---

# 18. Catalog Service

```ts
export interface CatalogService {
  load(
    source: RuleSource,
    options?: {
      signal?: AbortSignal;
    }
  ): AsyncIterable<CatalogEntry[]>;

  get(id: string): CatalogEntry | undefined;

  list(kind: EntryKind): CatalogEntry[];

  search(query: string): CatalogEntry[];
}
```

必须支持增量加载：

```text
第一批核心数据
→ UI 可用

其余数据
→ 后续继续进入 Catalog
```

禁止等待全部数据完成后才渲染应用。

---

# 19. 网络缓存

推荐：

```text
Browser → IndexedDB
Desktop → SQLite / local files
```

缓存 key：

```text
sourceId + path
```

缓存结构：

```ts
export interface CacheRecord {
  sourceId: string;
  path: string;

  revision: string;

  body: unknown;

  fetchedAt: number;
}
```

revision 优先：

```text
ETag
↓
Last-Modified
↓
SHA-256
```

---

# 20. CharacterDocument：只保存事实和选择

禁止继续把所有最终计算值都写回角色。

推荐：

```ts
export interface CharacterDocument {
  schemaVersion: number;

  id: string;
  name: string;

  ruleset: CharacterRuleset;

  build: CharacterBuild;

  choices: ChoiceResolution[];

  inventory: InventoryState;

  session: SessionState;

  overrides: ManualOverride[];

  selections: CharacterSelection[];
}
```

---

# 21. 角色选择必须有 Snapshot

```ts
export interface CharacterSelection {
  entryId: string;

  snapshot: {
    name: string;
    englishName?: string;

    source: string;
    revision: string;

    raw?: unknown;
  };

  userChoices: Record<string, unknown>;
}
```

目的：

```text
Catalog entry v1
↓
玩家选择
↓
角色 Snapshot v1

Catalog 更新 v2
↓
Wiki 用 v2

旧角色
↓
继续使用 v1
↓
提示“有新版本可更新”
```

禁止：

```text
远程数据更新
→ 静默改变旧角色机械效果
```

---

# 22. schemaVersion

```ts
export interface CharacterDocument {
  schemaVersion: number;
  ...
}
```

迁移：

```ts
export function migrateCharacter(
  raw: unknown
): CharacterDocument {
  let doc = raw as any;

  if (doc.schemaVersion === 1) {
    doc = migrateV1ToV2(doc);
  }

  if (doc.schemaVersion === 2) {
    doc = migrateV2ToV3(doc);
  }

  return doc;
}
```

规则数据库版本和角色 Schema 版本必须分开。

---

# 23. DerivedCharacter

最终数值不得作为 CharacterDocument 的主来源。

```ts
export interface DerivedValue {
  value: number;

  traces: RuleTrace[];
}

export interface DerivedCharacter {
  level: number;

  proficiencyBonus: number;

  abilities: Record<
    Ability,
    {
      score: number;
      modifier: number;
    }
  >;

  ac: DerivedValue;
  hpMax: DerivedValue;
  initiative: DerivedValue;

  saves: Record<string, DerivedValue>;
  skills: Record<string, DerivedValue>;

  spellcasting: {
    attackBonus?: DerivedValue;
    dc?: DerivedValue;

    slots: Record<number, number>;
  };

  warnings: RuleWarning[];
}
```

---

# 24. Rules Engine 入口

```ts
export interface RuleEngine {
  evaluate(
    character: CharacterDocument,
    catalog: CatalogService
  ): DerivedCharacter;
}
```

执行顺序建议：

```text
Character Facts
↓
Resolve Selections
↓
Resolve Choices
↓
Generate Effects
↓
Validate Conditions
↓
Apply Modifiers
↓
Compute Derived Values
↓
Produce Trace + Warnings
```

---

# 25. Effect DSL

所有机械规则必须尽量转换成 Effect。

```ts
export type CharacterEffect =
  | AbilityBonusEffect
  | ProficiencyEffect
  | ExpertiseEffect
  | AcFormulaEffect
  | ModifierEffect
  | SpeedEffect
  | SpellGrantEffect
  | ResourceEffect;
```

示例：

```ts
export interface AbilityBonusEffect {
  type: 'abilityBonus';

  ability: Ability;
  value: number;

  sourceId: string;
}
```

```ts
export interface ProficiencyEffect {
  type: 'proficiency';

  target:
    | 'skill'
    | 'tool'
    | 'weapon'
    | 'armor'
    | 'save';

  value: string;

  sourceId: string;
}
```

---

# 26. Modifier Pipeline

统一 modifier：

```ts
export interface Modifier {
  id: string;
  sourceId: string;

  target:
    | 'ac'
    | 'initiative'
    | 'speed.walk'
    | 'skill.stealth'
    | 'save.wis'
    | 'spell.dc'
    | string;

  mode:
    | 'add'
    | 'set'
    | 'minimum'
    | 'maximum'
    | 'multiply';

  value: number;

  priority?: number;

  condition?: RuleCondition;
}
```

禁止各 UI 组件自己做：

```ts
finalValue += 2
```

所有修正统一进入 Pipeline。

---

# 27. RuleCondition

```ts
export type RuleCondition =
  | {
      type: 'armorCategory';
      in: ('none' | 'light' | 'medium' | 'heavy')[];
    }
  | {
      type: 'shieldEquipped';
      value: boolean;
    }
  | {
      type: 'hasEntry';
      entryId: string;
    }
  | {
      type: 'characterLevel';
      min?: number;
      max?: number;
    }
  | {
      type: 'and';
      conditions: RuleCondition[];
    }
  | {
      type: 'or';
      conditions: RuleCondition[];
    };
```

不要将复杂条件继续写成：

```ts
if (
  className === '某职业' &&
  !armor &&
  shield
)
```

---

# 28. Choice Engine

D&D 自动车卡的核心之一是“未决选择”。

```ts
export interface ChoiceDefinition {
  id: string;
  sourceId: string;

  type:
    | 'ability'
    | 'skill'
    | 'language'
    | 'tool'
    | 'feature'
    | 'spell'
    | 'item'
    | 'expertise';

  count: number;

  options?: string[];

  constraints?: RuleCondition[];
}
```

用户选择结果：

```ts
export interface ChoiceResolution {
  choiceId: string;
  selected: string[];
}
```

规则：

```text
Catalog Entry
+
ChoiceResolution
↓
Effects
```

---

# 29. 未完成选择不能偷偷填默认值

必须：

```text
背景：自定义背景

⚠ 未完成选择：
- 请选择 2 项技能
- 请选择 1 种工具
- 请选择 1 种语言
```

DerivedCharacter 必须允许：

```ts
warnings: [
  {
    code: 'UNRESOLVED_CHOICE',
    ...
  }
]
```

---

# 30. 5etools 数据不能直接等价为机械规则

策略：

```text
结构化字段
→ 自动映射

自然语言正文
→ Rule Registry / Manual
```

例如结构化字段：

```text
ability
skillProficiencies
languageProficiencies
weaponProficiencies
armorProficiencies
additionalSpells
speed
size
```

可以做 Adapter。

只有文本描述的复杂能力不能默认自动化。

---

# 31. Rule Registry

推荐：

```ts
export interface RuleHandler {
  getChoices?: (
    entry: CatalogEntry,
    character: CharacterDocument
  ) => ChoiceDefinition[];

  getEffects: (
    entry: CatalogEntry,
    character: CharacterDocument,
    choices: ChoiceResolution[]
  ) => CharacterEffect[];
}
```

注册：

```ts
const registry: Record<string, RuleHandler> = {
  'xphb:feature:fighter:second-wind:1': ...,
  'xphb:feature:barbarian:unarmored-defense:1': ...,
};
```

key 使用稳定 ID 或英文 canonical identity。

禁止以中文展示名称为规则主键。

---

# 32. Rule Overlay

如果现有项目已经人工维护大量结构化规则，不要删除。

将其定位成：

```text
Rule Overlay Database
```

架构：

```text
5etools Entry
    │
    ├────► Content / Wiki
    │
    ▼
Rule Overlay
    │
    ▼
Effects
```

5etools 负责：

```text
正文
来源
页面
基础结构
引用
法术
装备
职业特性
```

Overlay 负责：

```text
自动计算
未决选择
条件
资源次数
特殊职业逻辑
本项目的修正规则
```

---

# 33. 基础公式

## Ability Modifier

```ts
export function abilityModifier(
  score: number
): number {
  return Math.floor((score - 10) / 2);
}
```

## Proficiency Bonus

建议通过 Ruleset：

```ts
export interface Ruleset {
  proficiencyBonus(
    level: number
  ): number;
}
```

默认：

```ts
export function proficiencyBonus(
  level: number
): number {
  return Math.floor((level - 1) / 4) + 2;
}
```

---

# 34. Bonus Pipeline

技能、豁免、攻击等尽量统一：

```ts
export interface BonusContext {
  abilityMod: number;

  proficiency: number;
  proficiencyMultiplier: number;

  flatBonus: number;
}
```

计算：

```ts
export function computeBonus(
  ctx: BonusContext
): number {
  return (
    ctx.abilityMod +
    ctx.proficiency *
      ctx.proficiencyMultiplier +
    ctx.flatBonus
  );
}
```

---

# 35. AC 不能靠字符串解析

禁止：

```ts
armor.ac.includes('最大 2')
armor.ac.includes('敏捷')
```

标准化装备：

```ts
export interface ArmorData {
  category:
    | 'light'
    | 'medium'
    | 'heavy'
    | 'shield';

  baseAC?: number;

  addDexterity?: boolean;
  dexterityCap?: number;

  strengthRequirement?: number;

  stealthDisadvantage?: boolean;

  acBonus?: number;
}
```

---

# 36. AC 采用候选公式

```ts
export interface AcFormula {
  id: string;
  sourceId: string;

  base: number;

  abilities: {
    ability: Ability;
    cap?: number;
  }[];

  condition?: RuleCondition;
}
```

候选：

```text
10 + DEX
light armor
medium armor
heavy armor
Mage Armor
Barbarian Unarmored Defense
Monk Unarmored Defense
其他职业能力
```

然后：

```text
合法 Base AC formulas
↓
选可用结果
↓
再叠加 shield / bonus modifiers
```

---

# 37. HP

角色保存：

```text
职业等级
生命骰
升级 HP 方式
掷骰结果
CON
特殊修正
```

不要只保存最终 `hpMax`。

```ts
export interface ClassLevel {
  classId: string;
  level: number;

  hitDie: number;

  hpMode?:
    | 'average'
    | 'rolled'
    | 'manual';

  rolledHp?: number[];
}
```

---

# 38. Spellcasting 必须拆分

禁止：

```ts
character.spells: string[]
```

至少区分：

```text
Known
Prepared
Granted
Spellbook
Slots
Pact Magic
Casting Ability
```

```ts
export interface CharacterSpell {
  spellId: string;

  origin:
    | 'class'
    | 'subclass'
    | 'race'
    | 'feat'
    | 'item'
    | 'manual';

  prepared?: boolean;
  alwaysPrepared?: boolean;

  castingAbility?: Ability;
}
```

---

# 39. Spell Source Lookup

法术职业关系不要只依赖法术对象本身。

Normalizer 最终输出：

```ts
export interface NormalizedSpell {
  id: string;

  level: number;
  school: string;

  classIds: string[];

  ritual: boolean;
  concentration: boolean;
}
```

必要时利用生成索引 / spell source lookup 做补充。

---

# 40. 多职业施法独立模块

```ts
export interface SpellcastingContribution {
  classId: string;
  classLevel: number;

  progression:
    | 'full'
    | 'half'
    | 'third'
    | 'artificer'
    | 'pact'
    | 'none';
}
```

普通 Spell Slots 与 Pact Magic 分开计算。

---

# 41. Manual Override

必须提供人工兜底：

```ts
export interface ManualOverride {
  target: string;

  mode:
    | 'add'
    | 'set';

  value: number;

  reason: string;
}
```

禁止覆盖掉原计算来源。

UI 展示：

```text
AC 计算值：18
人工修正：+1
原因：DM 特许
最终：19
```

---

# 42. Rule Trace

所有关键派生数值应支持解释：

```ts
export interface RuleTrace {
  sourceId: string;
  label: string;

  mode:
    | 'base'
    | 'add'
    | 'set'
    | 'minimum'
    | 'maximum';

  value: number;
}
```

例如：

```text
AC 19

Chain Mail              16
Shield                   +2
Defense Style            +1
---------------------------
最终                      19
```

---

# 43. Warning 系统

```ts
export interface RuleWarning {
  code:
    | 'UNSUPPORTED_RULE'
    | 'UNRESOLVED_CHOICE'
    | 'MISSING_REFERENCE'
    | 'DISABLED_SOURCE'
    | 'STALE_SNAPSHOT'
    | 'UNSUPPORTED_MOD';

  sourceId?: string;

  message: string;
}
```

规则引擎宁可输出 Warning，也不要静默算错。

---

# 44. Source Settings

工作区维护：

```ts
export interface SourceProfile {
  enabledSources: Set<string>;
  disabledEntries: Set<string>;
}
```

规则：

```text
禁用来源
→ 新角色选择不显示

旧角色已选择
→ 保留
→ 提示来源被禁用
```

---

# 45. Homebrew

只允许数据：

```text
JSON
```

禁止：

```text
eval
new Function
远程脚本字段
```

流程：

```text
validate
↓
normalize
↓
Catalog
↓
Rule Overlay（可选）
```

---

# 46. 安全要求

所有外部 JSON 均视为不可信输入。

至少防：

```text
__proto__
prototype
constructor
Prototype Pollution
恶意正则
超大 JSON
超深递归
不可信 URL
```

禁止直接将规则文本注入 HTML。

---

# 47. CORS

如果外部镜像不允许跨域：

优先级：

```text
A. 镜像开放 CORS
B. 自己维护静态镜像
C. 后端 Proxy
```

如果做 Proxy：

```text
禁止开放任意 URL proxy
```

避免 SSRF。

---

# 48. 推荐生产架构：自有镜像

长期推荐：

```text
Upstream compatible source
            ↓
         Sync Job
            ↓
   Resolve / Validate
            ↓
      Canonical Build
            ↓
     Versioned JSON
            ↓
         CDN
            ↓
       Character App
```

客户端最终不应该永久强依赖某个第三方镜像。

---

# 49. 自有 Manifest

```json
{
  "schemaVersion": 1,
  "revision": "2026-09-24-a1b2",
  "generatedAt": "2026-09-24T00:00:00Z",

  "files": {
    "classes": {
      "url": "classes.json",
      "sha256": "..."
    },
    "spells": {
      "url": "spells.json",
      "sha256": "..."
    }
  }
}
```

客户端只理解自己的稳定 Schema。

---

# 50. 旧项目迁移策略

禁止大爆炸重写。

推荐：

```text
旧 UI
  │
  ▼
Facade Layer
  │
  ├── CatalogFacade
  ├── CharacterFacade
  └── RulesFacade
```

迁移顺序：

```text
1. Catalog
2. Character schemaVersion
3. Derived values
4. Effects
5. Choices
6. Rule Registry
7. 替换旧静态数据
8. 删除旧计算逻辑
```

---

# 51. Legacy Adapter

旧项目如果已经有大量手工数据：

```ts
export interface LegacyDataAdapter {
  normalize(): CatalogEntry[];
}
```

架构：

```text
旧 TypeScript 数据
        ↓
Legacy Adapter
        ↓
CatalogEntry[]

5etools JSON
        ↓
5etools Adapter
        ↓
CatalogEntry[]
```

两者可同时存在。

不要一次删除旧数据。

---

# 52. 推荐迁移阶段

## Phase 0：代码审计

Agent 先完成：

```text
识别现有：
- Character model
- 数据入口
- 本地存储
- AC / HP / 技能 / 法术计算
- 选择系统
- 法术系统
- 装备系统
```

输出：

```text
docs/current-architecture.md
docs/migration-map.md
```

此阶段不修改业务行为。

---

## Phase 1：引入 Catalog 抽象

新增：

```text
catalog/types.ts
catalog/catalog.ts
catalog/identity.ts
```

将现有静态数据通过 Legacy Adapter 接入。

验收：

```text
现有 UI 功能不变
现有数据仍能正常浏览
```

---

## Phase 2：引入 5etools Source

新增：

```text
source/fiveetools/client.ts
source/fiveetools/loader.ts
catalog/normalize/*
catalog/resolver/*
```

第一批：

```text
class
race
background
feat
spell
item
```

验收：

```text
可以同时显示 Legacy + 5etools 数据
可以切换来源
可以搜索
```

---

## Phase 3：Character Schema Migration

新增：

```text
schemaVersion
ruleset
selections
snapshot
overrides
```

旧角色必须可迁移。

验收：

```text
旧角色文件导入后不丢关键数据
```

---

## Phase 4：DerivedCharacter

将以下从 CharacterDocument 移出：

```text
最终 AC
最终 Spell DC
最终 Spell Attack
最终技能加值
最终豁免加值
最终 PB
```

验收：

```text
界面显示值与旧版保持一致
```

---

## Phase 5：基础 Rules Engine

先实现：

```text
Ability Modifier
PB
Skills
Saves
Initiative
HP
AC
Spell DC
Spell Attack
```

验收：

```text
每个值有 RuleTrace
```

---

## Phase 6：Choice + Effect

把现有：

```text
技能选择
语言选择
工具选择
属性选择
专长选择
```

统一进入 ChoiceDefinition / ChoiceResolution。

验收：

```text
未完成选择会产生 warning
```

---

## Phase 7：职业 Rule Registry

只做几个 Vertical Slice。

优先：

```text
Fighter
Wizard
Barbarian
Rogue
Cleric
```

不要追求一次覆盖全部职业。

---

# 53. Vertical Slice 1：Fighter Lv1

必须覆盖：

```text
读取职业
选择技能
选择装备

PB
Saves
Skills
HP
AC
Attack Bonus
```

如果第一切片不能完整跑通，不要继续扩数据类型。

---

# 54. Vertical Slice 2：Wizard Lv3

必须覆盖：

```text
Spell Catalog
Spell Class Filtering
Cantrips
Spellbook
Prepared Spells
Spell Slots
Spell Save DC
Spell Attack
```

---

# 55. Vertical Slice 3：Multiclass

建议：

```text
Fighter 1 / Wizard 2
```

验证：

```text
总等级
PB
HP
装备
Spellcasting
来源
Snapshot
升级
```

---

# 56. 测试要求

至少四类：

## Resolver

```text
_copy
_mod
_versions
subrace inheritance
magicvariant
references
```

## Normalizer

```text
raw → stable id
raw → source
raw → edition
raw → normalized fields
```

## Rules Engine

```text
ability modifier
PB
skills
saves
AC
HP
spellcasting
```

## Migration

```text
Character v1 → v2
Character v2 → v3
```

---

# 57. Fixture

测试不要直接依赖远程站点。

建立：

```text
tests/fixtures/
  class-fighter.json
  class-wizard.json
  spell-fireball.json
  race-human.json
  item-chain-mail.json
  item-shield.json
  copy-example.json
```

CI 必须离线可跑。

---

# 58. 禁止事项

Agent 在重构过程中不得：

1. 删除现有工作功能再承诺“以后补回来”。
2. 一次性重写整个 UI。
3. 把全部远程数据塞入一个巨大 JSON bundle。
4. 用中文显示名作为规则 ID。
5. 用 `includes("敏捷")` 等文本判断作为最终规则机制。
6. 用正则自动推断所有自然语言规则。
7. 让 Catalog 更新静默修改旧角色。
8. 让 UI 直接写派生最终值。
9. 把网络请求逻辑散落进组件。
10. 遇到不支持规则时默默忽略。

---

# 59. 兼容旧项目的最优原则

能包一层，就不要立即删除。

例如：

```text
旧函数：
calculateAC(character)

第一阶段：
内部改成 RulesFacade.getAC(character)

第二阶段：
RulesFacade → RuleEngine

第三阶段：
移除旧函数
```

保持每个阶段项目都能构建和运行。

---

# 60. Agent 的实施工作流

Agent 收到本规范后应按以下顺序执行。

## Step 1

扫描项目并输出：

```text
现有架构
现有数据源
现有 Character model
现有计算逻辑
现有持久化方式
```

## Step 2

建立：

```text
MIGRATION_PLAN.md
```

每项注明：

```text
文件
动作
风险
依赖
验收标准
```

## Step 3

优先增加新抽象，不删除旧功能。

## Step 4

每完成一个阶段：

```text
npm test
npm run build
```

或项目对应命令。

## Step 5

保持 commits / patches 小而独立。

---

# 61. 建议的 MIGRATION_PLAN.md 格式

```md
# Migration Plan

## Current State

### Character State
...

### Data Layer
...

### Rules
...

## Phase 1 - Catalog

### New Files
- ...

### Modified Files
- ...

### Acceptance
- ...

## Phase 2 - FiveETools Adapter
...

## Risks
...

## Rollback
...
```

---

# 62. 自动规则 Coverage

增加：

```ts
export interface AutomationCoverage {
  entryId: string;

  status:
    | 'full'
    | 'partial'
    | 'manual';

  notes?: string[];
}
```

UI 可以显示：

```text
完整自动化
部分自动化
仅展示正文
```

这比假装全部自动更可靠。

---

# 63. 推荐验收清单

项目达到以下状态，即视为基础改造成功：

```text
[ ] UI 不直接读取 5etools raw
[ ] UI 不直接 fetch 规则 JSON
[ ] 有 CatalogEntry
[ ] 有稳定 ID
[ ] 有 Source Adapter
[ ] 有 Character schemaVersion
[ ] 有 Snapshot
[ ] 有 DerivedCharacter
[ ] 有 Rules Engine
[ ] 有 ChoiceDefinition
[ ] 有 Effect / Modifier
[ ] 有 RuleTrace
[ ] 有 Warning
[ ] AC 不再依赖中文字符串解析
[ ] 远程数据更新不会静默修改旧角色
[ ] 5etools 与旧数据可以并存迁移
[ ] 至少一个 Fighter vertical slice 跑通
[ ] 至少一个 Wizard spellcasting slice 跑通
```

---

# 64. 推荐优先改造的旧代码模式

发现：

```ts
if (character.className === '野蛮人')
```

优先替换为：

```text
stable feature ID
→ Rule Registry
→ Effect
```

发现：

```ts
armor.ac.includes('最大 2')
```

优先替换为：

```text
Normalized ArmorData.dexterityCap
```

发现：

```ts
character.spellSaveDC = ...
```

优先替换为：

```text
DerivedCharacter.spellcasting.dc
```

发现：

```ts
import { CLASSES } from './data'
```

优先替换为：

```text
CatalogService.list('class')
```

---

# 65. 不要优先优化这些

在核心架构完成前，不要投入大量时间：

```text
动画
主题
复杂 GM 功能
怪物数据库
大量视觉重构
PWA 高级功能
多人同步
```

优先保证：

```text
数据正确
选择正确
计算正确
角色可迁移
数据可解释
```

---

# 66. 推荐技术路线总结

```text
现有静态数据
      ↓
Legacy Adapter
      ↓
      ├──────────────┐
      ▼              ▼
CatalogEntry ← FiveETools Adapter
      │
      ├────► Wiki / UI
      │
      ▼
Character Selection
      │
      ▼
Choice Resolution
      │
      ▼
Rule Registry
      │
      ▼
Effects / Modifiers
      │
      ▼
Rules Engine
      │
      ▼
DerivedCharacter
      │
      ▼
Trace / Warning / Override
```

---

# 67. 给 Coding Agent 的最终指令

请遵循以下优先级：

```text
正确性
>
可迁移
>
可解释
>
可扩展
>
代码优雅
>
一次性覆盖所有规则
```

如果遇到无法确定的规则：

```text
不要猜
不要静默自动
保留正文
标记 manual / partial
输出 RuleWarning
```

如果已有系统功能正常：

```text
优先 Adapter / Facade
不要立即删除
```

如果远程数据结构与本文假设不同：

```text
以实际数据为准
但必须继续遵守：
Source → Resolver → Normalize → Catalog → Rules
的边界
```

---

# 68. 建议 Coding Agent 首次执行时直接完成的任务

第一轮不要尝试“完成全部重构”。

建议只做：

```text
1. 扫描现有项目
2. 生成 CURRENT_ARCHITECTURE.md
3. 生成 MIGRATION_PLAN.md
4. 增加 CatalogEntry 类型
5. 增加 Legacy Adapter
6. 不改变任何现有 UI 行为
7. 跑测试 / build
```

第二轮：

```text
1. 加 FiveETools Source Adapter
2. 加 spell / class / race 三类 normalize
3. 接入 Catalog
4. 保留旧数据作为 fallback
```

第三轮：

```text
1. 引入 DerivedCharacter
2. 将 PB / Ability Mod / AC 从 UI 中移出
3. 建 Rules Engine 最小骨架
```

后续再逐步扩大。

---

# 69. 一句话原则

> **先让 5etools 成为稳定 Catalog，再让角色只保存选择与事实，最后由自己的 Rules Engine 生成所有派生数值。**

不要让：

```text
5etools raw JSON
```

直接成为：

```text
Character State
```

也不要让：

```text
自然语言规则正文
```

直接成为：

```text
自动计算逻辑
```

---

# 70. 完成定义（Definition of Done）

当以下三个角色切片都能完整工作，本次核心改造可以认为已经成立：

```text
Fighter Lv1
Wizard Lv3
Fighter 1 / Wizard 2
```

且满足：

```text
数据来自 Catalog
角色有 Snapshot
数值来自 Rules Engine
选择有 Choice Resolution
特殊规则有 Rule Registry
计算结果有 Trace
不支持规则有 Warning
人工规则有 Override
```

之后再扩展职业、专长、物品、Homebrew，而不是继续修改架构核心。
