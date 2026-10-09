# Antigravity 接手自检与技术优化指南

交接日期：2026-09-25。项目根目录：`E:\YJF\DND2024characterbuilder-2.0`。

## 1. 先读结论和用户要求

当前是“已实施多项接入与解耦，部分验收通过，完整业务验收仍待完成”，不能直接宣布全量可用或可发布。此前报告中“项目可以正常运行”的表述超出了已经取得的浏览器证据，应以本文件的验收边界为准。

用户要求：

- 内容以 `https://github.com/tjliqy/5etools-cn`（cn2.0）和 `https://github.com/tjliqy/homebrew`（master）为依据，不能用本地核心职业子集推断全量资源。
- 保留原文、来源、版本和原始数据；业务消费通过 Catalog，计算规则与内容分离。
- 基础同调上限为 3 件需要同调的魔法装备；特性可以提高上限。不能限制全部魔法装备或全部装备为 3 件。
- 每次完成一个可审核步骤后用中文报告：改动、证据、剩余限制、正确的下一步，等待用户审核再进入下一步。
- 不用资料移到 `E:\YJF\DNDdata备份` 对应目录，去重整理；不要重新打包旧资料作为隐性兜底。

先阅读同目录《全量公共数据接入与引擎解耦轻量化实施方案.md》《最终全链路验收报告.md》《高可用与性能验收记录.md》《旧数据归档与恢复记录.md》。这些文档是技术背景，执行范围以用户当前请求为准。

## 2. 两个真实问题到底修没修

| 问题 | 已落地的修复 | 已有证据 | 尚不能据此证明 |
|---|---|---|---|
| Homebrew 全仓递归树 HTTP 500 | `src/source/homebrew/manifest.ts` 在指定 GitHub 清单返回 5xx 时，读取根目录和支持类别的子树；检查截断并缓存。`homebrew-manifest.test.ts` 有 500 回退测试 | 上轮真实清单发现 956 个 JSON 文件，八类样本成功载入 | 956 个文件全都载入、所有跨包依赖完整、限流/超时/截断时回退完整 |
| 两个 XDMG 变体找不到 `_copy` 来源 | `src/source/resolver/copy.ts` 建立中英文名称索引，并在缺少 source 时从 type 的来源后缀建立索引；`loader.ts` 增加已注册物品的跨文件索引 | 上轮真实复验中“心灵抗性护甲::XDMG”和“警戒武器::XDMG”缺失警告由 2 条降为 0 | `_copy._mod`、多层继承、嵌套字段修改和最终物品机制都正确 |

第二项必须优先补语义核验：当前 Resolver 主要处理顶层 `_mod`，读取 `_copy` 后会删除它；实际样本的修改位于 `_copy._mod`。因此“找到基础模板”已经修复，但“继承修改完全正确”没有取得验收证据，不能将零警告作为充分条件。

## 3. 接手第一轮自检

### 3.1 保护工作区和角色数据

先读取适用的 AGENTS.md，检查 `git status --short`、`git diff --stat`、`package.json` 和锁文件。工作区包含前几轮大量未提交改动及旧数据移出后的删除记录，不要执行 reset、clean 或批量还原，也不要把所有改动当成当前任务新修改。

旧资料实际位置：`E:\YJF\DNDdata备份\data\DND2024characterbuilder-2.0-legacy`。其中 canonical-data 为主快照，legacy-delta 为 10 个差异/独有文件，metadata/dedup-map.csv 为 1,336 条映射。原两目录有 1,326 个相同副本已去重。使用映射重建时只恢复映射列出的旧文件，不应假定将主快照整体复制后覆盖即可在未来仍保持精确一致。

浏览器验收使用独立测试配置文件和明显命名的测试角色。清缓存前先导出真实角色；清理资源 IndexedDB 不等于清除整个站点数据，禁止顺手删除用户角色存档。不要输出 `.env.local` 中可能存在的秘密。

### 3.2 可复现命令（PowerShell）

```powershell
Set-Location 'E:\YJF\DND2024characterbuilder-2.0'
git status --short
npm test -- --reporter=dot
npm run build
```

真实联网测试单独执行，结束后移除开关：

```powershell
$env:RUN_LIVE_DATA = '1'
try {
  npx vitest run src/source/__tests__/live-data.integration.test.ts --reporter=verbose
} finally {
  Remove-Item Env:RUN_LIVE_DATA -ErrorAction SilentlyContinue
}
npm start
```

生产服务地址通常为 `http://localhost:3000`；确认没有占用后再启动。实际脚本是 build，不是 build:vue。依赖已安装时不要为了验收随意升级或安装工具。

上轮基线：默认 98 项通过、1 项联网测试跳过；联网测试单独通过；23 个静态页面生成；14 个主要路由 HTTP 200；静态资源 1,901,492 字节。这些是历史结果，本轮应重新记录，不把远程数量固定成永久断言。

## 4. 按正确顺序推进优化

### P0-A：先补继承解析的正确性，再扩大验收

重点文件：`src/source/resolver/copy.ts`、`src/source/fiveetools-cn/loader.ts`、`src/catalog/adapters/items.ts`。

1. 从真实 magicvariants.json 提取“君威暴君胸甲 (*) / Regal Breastplate of the Tyrant (*)”及“博识卫护之刃 / Studious Blade of the Guardian”与其基础模板。记录仓库、路径、提交 SHA 或响应修订、提取日期。
2. 验证 `_copy._mod` 中 inherits.entries、namePrefix、nameSuffix、rarity、source、propertyAdd 和 remove 等操作的最终结果。只把名称/来源正确或警告为零作为部分证据。
3. 检查多层继承、循环引用、字段路径、修改顺序、缺少来源时的诊断；保留不可解析的原始字段供人工排查，不能静默丢失。
4. 来源推导限定于被验证的 schema。当前通用 type 后缀推导应审查是否会误用到其他类别；优先核对魔法变体 inherits.source 的正式结构。
5. 物品三个文件先收齐再建立按类别/来源的查找池，避免只查已注册条目导致文件顺序相关；覆盖后文件作为前文件依赖的测试。

交付：真实样本断言最终语义，缺项/循环不误报完整；相关测试和构建通过。完成这一小步先汇报。

### P0-B：普通浏览器完成核心建卡和存档闭环

前次内置浏览器观察到外部 raw/CDN 和同源 JSON 都返回 ERR_BLOCKED_BY_CLIENT；原因未完全定位。不要认定所有浏览器都受限，也不要因此认定普通浏览器已通过。用 Antigravity 可控制的普通 Chrome/Edge 检查 Network 和 Console；允许的调试手段以该 IDE 的工具规则为准。

| 场景 | 必须观察的结果 |
|---|---|
| 独立配置文件冷启动 | 能看到加载状态、真实来源和失败详情；后台数据到达后页面更新 |
| 核心 2024 职业完整建卡 | 种族、背景、属性、技能、法术、装备选择可保存，生成卡面且无运行时异常 |
| 扩展职业 The Mesmer | 可检索、可选，等级特性与公共条目关联；无法自动处理的机制明确提示 |
| 2014/2024 同名条目 | 来源和稳定 ID 独立，切换规则不自动替换已有角色 |
| 升级、替换法术、兼职 | 数量与资格按来源版本；保存重开后逐级记录和最终法表一致 |
| 物品穿脱及同调 | 需要同调与不需要同调分开；基础 3 槽；扩展特性提高上限；实例和加值不重复 |
| 手动覆盖与 Trace | 覆盖值生效、来源可追踪、相关派生值符合规则 |
| 刷新、关闭重开 | 同一个角色 ID、选择、装备实例和快照仍在，Console 无异常 |

记录每个场景的角色 ID、来源/版本、步骤、期望与实际、截图及必要日志。首页 200 或能显示壳页面不能替代此表。

### P1：完整性、诊断和数据调度

- 联网测试目前只取 Homebrew 八个样本，不是全部启用文件。新增独立完整批次验收，列出启用/未启用类别、预期文件数、成功/失败、跳过条目、复制依赖和未解析关系。
- collection 默认不启用。部分职业/依赖可能只在 collection 中；明确界面范围和按需包加载，不能把 collection 全部忽略后称为全量。
- 检查主源加载器是否在有解析警告时仍误报 complete；文件下载成功和关系解析成功分开统计。
- Homebrew 回退目前主要覆盖 5xx。补超时、取消、429、截断、子树单点失败测试；别用无界重试。回退成功后的 revision 应来自实际成功根/子树修订，而非失败响应的 ETag。
- 依赖缺失应能追到仓库文件和原条目；跨包同名条目不得仅按名称覆盖。

### P1：剩余本地规则与业务耦合

零 `src/data` 导入不等于内容已全部外部化。`src/rules/languages`、`conditions.ts`、`equipment.ts` 和 `warlockInvocations.ts` 仍保留本地内容；祈唤模块含完整描述，不能称作纯机器规则补丁。

按原方案：语言、状态及祈唤原文应来自公共资源；祈唤选择读 Catalog optionalfeature，机器补丁只绑定明确身份和版本。先补公共元数据和业务适配再移出旧文案，不能只移动目录名来宣称解耦完成。

检查旧短 ID 与 Catalog 的来源消歧、工具选择回退 ID、缓存刷新后的引用迁移。不能为让页面出现结果而恢复全量本地 seed。

### P2：规则与性能深化

- 契约魔法和常规法术槽分别保存、消耗、休息恢复；检查目前派生显示是否把两类槽直接相加。
- 属性设定、同调上限、条件效果避免宽泛文本猜测；优先可靠字段和绑定具体版本的补丁。
- 对大批物品/变体和职业树测量内存、首屏请求数、下载量、查询耗时、重复组装；有证据后做缓存、懒加载、虚拟列表。
- 条目更新/删除后的 Catalog 清理与快照保全分别验证，防止刷新只新增不移除旧条目。

## 5. 缓存、故障和旧存档验收矩阵

在正常浏览器中验证冷缓存在线、热缓存在线、已有缓存断网、无缓存断网、过期缓存刷新、单文件坏 JSON、限流、上游条目删除、Homebrew 发现失败。每项都要区分页面仍可显示与规则结果可信；缺数据时不能让引擎默认值伪装成完整计算。

先导出角色，再验证旧存档短 ID、同名不同书源、装备实例、特性等级、内容快照及人工覆盖。未知引用应明确保留并提示，不能丢弃或自动换版本。

## 6. 技术入口速查

| 模块 | 文件/目录 |
|---|---|
| 清单和网络缓存 | src/source/homebrew/manifest.ts；src/source/fiveetools-cn/client.ts；src/platform/catalogCache.ts |
| 加载调度和状态界面 | src/platform/catalogLoader.ts；src/platform/CatalogProvider.tsx |
| 继承和标准化 | src/source/resolver/copy.ts；src/source/fiveetools-cn/normalizers/ |
| 职业树与业务适配 | src/catalog/adapters/classAssembly.ts；src/catalog/adapters/ |
| 稳定身份与引用迁移 | src/catalog/identity.ts；src/catalog/references.ts；src/store/characterStore.ts |
| 计算和覆盖 | src/engine/；src/mechanics-overlay/ |
| 建卡与角色卡 | src/app/builder/；src/app/sheet/[id]/ |
| 联网验收入口 | src/source/__tests__/live-data.integration.test.ts |

## 7. 每步完成与最终签收标准

每步报告注明实际修改文件、测试命令与结果、真实数据修订、未覆盖项。缺陷修复须验证最终行为，不能只删失败测试或降低断言来获得绿灯。

只有当完整启用范围的数据发现/载入/关联、上述浏览器流程、存档恢复、关键规则和故障矩阵都有证据，才更新方案为“最终验收通过”。发现 956 个文件、八个样本载入、零警告、HTTP 200 和构建成功各自只证明对应层次。

可直接给接手 IDE 的第一条指令：

> 阅读本指南和修订实施方案，保护所有现有工作区修改与角色存档。先执行 P0-A，使用真实魔法变体样本核查并修复 `_copy._mod` 的最终语义，补有意义的回归测试；完成这一小步后用中文报告证据、限制和下一步，等待审核。不要预先宣称全链路已经通过。
