# 5etools 全量数据接入与规则引擎保留 —— 实施路线图

> **文档版本**：v1.0
> **编写日期**：2026-09-25
> **核心结论**：可以在接入 5etools 全量数据的前提下完整保留现有规则引擎，但必须引入三层架构以填补 5etools 数据层的机制计算缺口。

---

## 一、现状诊断

### 1.1 数据断链位置

| 文件 / 模块 | 问题 |
|---|---|
| src/app/builder/species/page.tsx | import { allSpecies } from '@/data/species' 硬编码本地离线 JSON |
| src/app/builder/class/page.tsx | import { allSpells } from '@/data/spell' 硬编码本地离线 JSON |
| src/app/builder/feats/page.tsx | import { allSpells } from '@/data/spell' 硬编码本地离线 JSON |
| src/app/builder/spells/SpellList.tsx | import { allSpells as legacySpells } 硬编码本地离线 JSON |
| src/engine/ability.ts | import { allSpecies } from '../data/species' 计算层直接依赖离线数据 |
| src/engine/spellcasting.ts | import { allSpells } from '../data/spell' 计算层直接依赖离线数据 |

已有的 getCatalogSpells()、getCatalogSpecies() 等适配器及 FiveEToolsCnSource.fetchJson() 从未在运行时被调用。
**结论：5etools 数据通道已搞建，但最后一公里未打通。**

### 1.2 为什么不能单纯切流到 5etools 原始 JSON

5etools 的 JSON 由两层数据混合：

- 数据层（可计算）：名称、法术环阶、职业标签、书源、护甲 AC 基值
- 机制层（仅供人读）：例如 "While not wearing armor, your AC equals 13 + DEX modifier."

我们的引擎依赖 mechanics.acCalculation、mechanics.acBonus、spellcastingType 等**结构化字段**，这些是我们自定义的 schema，5etools 不提供。

退化示例：
- 野蔓人无甲防御（应为 10+敏+体）→ 错误退化为 10+敏
- 武僧无甲防御（应为 10+敏+感）→ 错误退化为 10+敏
- 龙族术士无甲防御（应为 13+敏）→ 错误退化为 10+敏
- 邪术师契约魔法槽位 → 完全丢失

---

## 二、目标架构：三层解耦模型

```
Layer 1：5etools 在线数据（通过 IndexedDB 缓存）
  提供：全量名称、描述、选择池、书源元数据、中文翻译
  不提供：可被计算机直接计算的特性机制
         ↓
  Catalog 适配器归一化 → defaultCatalog 注册
         ↓
Layer 2：Mechanics Overlay（机制覆盖层）
  位置：src/mechanics-overlay/
  内容：约 30-50 个关键特性的机器可读计算描述
  维护：手动维护，不依赖5etools更新，永久稳定
  方式：mergeWithOverlay() 将覆盖层字段注入 CatalogEntry.raw.mechanics
         ↓
Layer 3：规则引擎（完全保留，不动任何现有文件）
  src/engine/ability.ts
  src/engine/combat.ts
  src/engine/spellcasting.ts
  src/engine/proficiency.ts
  src/engine/viewAdapter.ts
```

---

## 三、与参照项目 DND-card-web-main 的关键区别

| 维度 | DND-card-web-main | 本项目（目标） |
|---|---|---|
| 产品定位 | 开放式卡面工作台 | 强引导式车卡向导（状态机逐步引导） |
| 规则哲学 | 刻意不检查配额与进阶 | 严格检查配额、前置条件、进阶约束 |
| 施法系统 | 不计算法术槽 | 完整兼职施法槽折算、半施法者矩阵 |
| 无甲防御 | 不计算特殊无甲公式 | 精确区分野蔓人/武僧/龙族术士三种公式 |
| 数据加载 | IndexedDB 缓存已实现 | 待实现（借鉴对象） |
| 计算追溯 | trace: string[] 已实现 | 部分实现，需补全 |

仅借鉴以下两项工程能力，其余保留自有逻辑：
1. IndexedDB 缓存机制的工程实现
2. Calculation Trace 追溯链路的 UI 呈现方式

---

## 四、实施步骤（精准版）

### Phase A：运行时数据总线（最高优先级，所有后续 Phase 的前提）

目标：App 启动时从 5etools 拉取核心数据，缓存至 IndexedDB，注册进 defaultCatalog。

**A-1: IndexedDB 缓存管理器**
新增文件：src/platform/catalogCache.ts

接口设计：

```typescript
interface CacheRecord { body: unknown; revision: string; cachedAt: number }
export async function readCache(url: string): Promise<CacheRecord | null>
export async function writeCache(url: string, record: CacheRecord): Promise<void>
export async function clearCache(): Promise<void>
```

技术细节：
- 数据库名 dnd-catalog-v1，按完整 URL 作为 key 存储
- revision 通过 HTTP ETag 获取，降级时取 SHA-256(JSON.stringify(body))
- 缓存有效期：7 天（常量 CACHE_TTL_MS）

**A-2: 数据加载服务**
新增文件：src/platform/catalogLoader.ts

加载顺序（核心优先策略）：

| 批次 | 文件 | 策略 |
|---|---|---|
| 首批 | races.json、backgrounds.json、feats.json、class/index.json + class/*.json | 阻塞，等待后再渲染 |
| 次批 | spells/index.json + spells/*.json | 非阻塞，后台加载 |
| 末批 | items.json、items-base.json、optionalfeatures.json | 非阻塞 |

缓存策略：
- 有缓存且未过期 → 0 网络请求，直接从 IndexedDB 得到数据
- 有缓存但需刷新 → 先用旧缓存渲染，后台静默更新
- 无缓存 → 拉取并写入 IndexedDB

**A-3: 应用入口挂载**
修改文件：src/app/layout.tsx
新增 CatalogProvider，在应用最外层挂载：
- 持有状态：idle | loading | ready | error
- 首批数据到达后立即可交互

---

### Phase B：Mechanics Overlay 构建（必须在 Phase C 之前完成）

目标：建立计算机可读的特性机制覆盖层。
新增文件：src/mechanics-overlay/index.ts

职业施法类型标注（13 个核心职业，中英文双映射）：

| 职业（英文） | 职业（中文） | 施法类型 |
|---|---|---|
| Wizard | 法师 | full |
| Sorcerer | 术士 | full |
| Bard | 吟游诗人 | full |
| Cleric | 牧师 | full |
| Druid | 德鲁伊 | full |
| Ranger | 游侠 | half |
| Paladin | 圣武士 | half |
| Artificer | 炼金术师 | half |
| Fighter (Eldritch Knight) | 战士（奥术骑士） | third |
| Rogue (Arcane Trickster) | 盗贼（证术盗贼） | third |
| Warlock | 邪术师 | warlock |

特殊无甲防御公式（5 个）：

| 特性 | 公式 |
|---|---|
| Barbarian 野蔓人无甲防御 | base: 10, modifiers: [dex, con] |
| Monk 武僧无甲防御 | base: 10, modifiers: [dex, wis] |
| Draconic Resilience 龙族体质 | base: 13, modifiers: [dex] |
| Lizardfolk 天然护甲 | base: 13, modifiers: [dex] |
| Tortle 天然护甲 | base: 17, modifiers: [] |

属性上限突破：
- Barbarian Brutal Strike（2024）：STR 上限提升至 24

挂载方式：在 Catalog 适配器 normalize 后，通过 mergeOverlay(entry) 注入，引擎侧代码无需任何改动。

---

### Phase C：UI 页面切流

切流原则：
- 禁止在页面/引擎文件中 import { allXxx } from '@/data/...'（装备数据暫不切流）
- 统一改为调用对应的 getCatalogXxx() 函数

文件清单：

| 优先级 | 文件 | 当前 import | 改为 |
|---|---|---|---|
| P0 | src/engine/ability.ts | allSpecies from '@/data/species' | getCatalogSpecies() |
| P0 | src/engine/spellcasting.ts | allSpells from '@/data/spell' | getCatalogSpells() |
| P1 | src/app/builder/species/page.tsx | allSpecies | getCatalogSpecies() |
| P1 | src/app/builder/background/page.tsx | allBackgrounds | getCatalogBackgrounds() |
| P1 | src/app/builder/class/page.tsx | allSpells, allSpecies | Catalog API |
| P1 | src/app/builder/feats/page.tsx | allSpells, allFeats | Catalog API |
| P1 | src/app/builder/spells/SpellList.tsx | allSpells as legacySpells | getCatalogSpells() |
| P2 | src/app/builder/class-detail/page.tsx | allSpells, allSpecies | Catalog API |
| P2 | src/app/builder/multiclass/page.tsx | allSpells | Catalog API |

切流后必须通过的回归验证清单：
- [ ] 野蔓人无甲防御 = 10 + 敏 + 体（Overlay 命中验证）
- [ ] 武僧无甲防御 = 10 + 敏 + 感（Overlay 命中验证）
- [ ] 龙族术士无甲防御 = 13 + 敏（Overlay 命中验证）
- [ ] 游侠/圣武半施法者槽位正确
- [ ] 邪术师契约魔法独立槽位正确
- [ ] 奥术骑士/证术盗贼三分之一施法槽位正确
- [ ] 现有 34 项单元测试全绻

---

### Phase D：2024 种族 ASI 动态分配

目标：支持 2024 规则中自由分配属性值提升的动态选择。
5etools 2024 格式示例：{ "ability": [{ "choose": { "from": ["str","dex","con","int","wis","cha"], "count": 2, "amount": 1 } }] }

修改文件：
- src/engine/ability.ts：在 computeAbilityScores() 中增加 choose 类型分支解析
- src/app/builder/species/page.tsx：检测到 choose 格式 ASI 时，渲染属性分配 UI

注意：2014 格式模式不受影响。

---

### Phase E：Calculation Trace 追溯链路（体验升华）

目标：每个派生数值（AC、HP、先機、技能）附带来源列表，在卡面 Tooltip 中展示。
参照：DND-card-web-main/src/core/engine.ts 的 trace 实现。

修改文件：src/engine/combat.ts、ability.ts、spellcasting.ts
添加 acTrace: string[]、hpTrace: string[] 等字段。
示例：acTrace = ["基础 10 + 敏捷 +3", "麞甲 AC 13", "盾牌 +2"]

修改文件：src/engine/viewAdapter.ts
CharacterSheetView.computed 中携带各 trace 数组，final 层透传给 UI。

---

### Phase F：数据归档移出

前提：Phase A-D 全部完成且回归验证通过。

移出至 e:\YJF\DNDdata备份：
- src/data/ 下除 armor/、gear/、tools/、weapons/ 之外的所有子目录
- src/data-legacy/（全量）
- 基石文档/ 中纯数据提取类文档（JSON转TS系列、HTML转TS系列）

---

## 五、不在此路线图范围内的事项

| 事项 | 原因 |
|---|---|
| 云端角色存储后端集成 | 依赖用户服务器架构确认，与前端数据切流无耦合 |
| Homebrew 创作工具统合 | 依赖 5etools-nogubird-mirror 的具体自定义 schema 分析 |
| 装备数据切流 (armor/gear/tools/weapons) | acStructured 字段差异最大，需专项适配 |
| 借鉴 DND-card-web-main 的计算逻辑 | 我们的引擎已超越其实现 |

---

## 六、风险矩阵

| 风险 | 严重度 | 缓解措施 |
|---|---|---|
| 网络不稳定 | 高 | IndexedDB 缓存保证离线可用；public/5etools-data/ 作为备用静态镜像 |
| 5etools 数据格式更新 | 中 | Catalog 适配器集中管理，单点维护 |
| Overlay 条目覆盖不全 | 中 | 引擎垆底退化为已知数据而非崩溃 |
| 2024 ASI UI 复杂度 | 低 | 2014 模式不受影响 |
| 切流回归测试工作量 | 中 | 34 项单元测试必须全绻；新增施法槽矩阵集成测试 |

---

## 七、执行顺序

Phase A（数据总线） → Phase B（Mechanics Overlay） → Phase C（UI 切流） → Phase D（2024 ASI） → Phase E（Trace 追溯） → Phase F（归档移出）

- Phase A 是所有其他 Phase 的先决条件，必须最先完成。
- Phase B 必须在 Phase C 之前完成，否则切流后计算引擎会读到不完整的 mechanics 字段。
- Phase F 是不可逆操作，必须等到所有计算验证通过后方可执行。

---

## 附录：关键文件索引

| 文件 | 状态 | 角色 |
|---|---|---|
| src/source/fiveetools-cn/client.ts | 已有 | 5etools HTTP 客户端（待集成进 loader） |
| src/catalog/catalog.ts | 已有 | Catalog 注册与检索服务 |
| src/catalog/adapters/*.ts | 已有 | 各数据类型适配器（待与 loader 连通） |
| src/engine/viewAdapter.ts | 已有 | 引擎输出统一视图（待加 trace） |
| src/platform/catalogCache.ts | 待建 | IndexedDB 缓存管理器 |
| src/platform/catalogLoader.ts | 待建 | 运行时数据加载服务 |
| src/mechanics-overlay/index.ts | 待建 | 机制覆盖层 |
