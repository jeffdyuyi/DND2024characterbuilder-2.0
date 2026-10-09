# D&D 2024 车卡器 - 5etools 资料库迁移总结与架构规范

## 1. 迁移目标与达成情况

- **核心目标**：将资料库数据源全面对接并切换至 `tjliqy/5etools-cn` (`cn2.0` 分支) 与 `tjliqy/homebrew` 外部数据源；
- **旧数据隔离保护**：原旧版静态数据已完整归档至 `src/data-legacy/`，物理隔离、只读冻结、永不删除；原 `src/data/` 保留为兼容过渡层并全部标记 `@deprecated`；
- **视觉体验保持**：严格坚守 **零破坏、零位移、100% 保持原有 Apple 级磨砂灰质感与交互**，所有 UI 页面（法术、职业、专长、背景、种族、装备商店）仅切换数据抽象层输入源，布局、样式、动画及逻辑完全不变；
- **工程验证结果**：8 个测试文件、34 个单元测试用例 100% 通过；TypeScript 静态类型检查 0 报错；Next.js 生产构建 (`npm run build`) 22 个静态路由全部打包通过。

---

## 2. 核心架构设计

依据《`基石文档/DND5R_5etools_rules_engine_agent_spec.md`》规范要求，系统采用了分层解耦的现代化资料库架构：

```
                    ┌──────────────────────────────────────────────┐
                    │       tjliqy/5etools-cn (cn2.0)              │
                    │       tjliqy/homebrew (master)               │
                    └──────────────────────┬───────────────────────┘
                                           │ HTTP/Raw Fetch
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │    Source Client Layer (RuleSource)          │
                    │    src/source/fiveetools-cn/client.ts        │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
┌───────────────────────┐   ┌──────────────────────────────────────┐
│  Legacy Data Layer    │   │  Normalization & Resolving Layer     │
│  src/data-legacy/     │   │  _copy/_mod 展开、标签清洗、复合 ID   │
└───────────┬───────────┘   └──────────────────┬───────────────────┘
            │                                  │
            │ Adapt                            │ Normalize
            ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│              Catalog Unified Service (ICatalog)                  │
│              src/catalog/catalog.ts                              │
│              - 双轨数据合并（5etools优先，Legacy自动兜底）         │
│              - 稳定复合 ID 与 多维别名映射表 (defaultCatalog)      │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│              Domain Adapters (src/catalog/adapters/)             │
│  spells.ts / classes.ts / feats.ts / backgrounds.ts / species.ts │
│  items.ts                                                        │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
┌─────────────────────────────────┐ ┌──────────────────────────────┐
│       UI Pages & Components     │ │     Rules & Character Engine │
│  - builder/spells               │ │  - getSpellDefinition        │
│  - builder/class                │ │  - getClassDefinition        │
│  - builder/feats                │ │  - getFeatDefinition         │
│  - builder/background           │ │  - getBackgroundDefinition   │
│  - builder/species              │ │  - getSpeciesDefinition      │
│  - builder/equipment            │ │  - findItemById / findByName │
│  - engine/searchIndexer (搜索)  │ └──────────────────────────────┘
└─────────────────────────────────┘
```

---

## 3. 关键技术决策落地

1. **Q1：5etools 数据源**：
   - 运行时从中文 5etools 镜像动态拉取 `https://github.com/tjliqy/5etools-cn` (`cn2.0` 分支)；
   - 客户端位于 `src/source/fiveetools-cn/client.ts`，支持 `FIVEETOOLS_CN_CONFIG` 与 `TJLIQY_HOMEBREW_CONFIG`；
   - 同时支持离线同步工具 `node scripts/sync-5etools-data.mjs` 将数据缓存至 `public/5etools-data/`。
2. **Q2：第三方与原创内容**：
   - 权威第三方/原创扩展内容由 `https://github.com/tjliqy/homebrew` 统一覆盖；
   - Normalizers 自动将 homebrew 数据包标记为 `isHomebrew: true`，UI 无缝渲染标签。
3. **Q3：旧角色文件**：
   - 旧角色文件若存在不兼容格式可直接丢弃或重置，全面采用标准复合 ID（`makeEntryId`）和稳定别名。

---

## 4. 业务代码使用规范

在今后的开发与功能扩充中，请遵循以下规范：

- **读取实体全量列表**：
  ```typescript
  import { getCatalogSpells, getCatalogClasses, getCatalogFeats, getCatalogBackgrounds, getCatalogSpecies, getCatalogItems } from '@/catalog';
  ```
- **根据 ID 或名称获取实体定义**：
  ```typescript
  import { 
    getSpellDefinition, 
    getClassDefinition, 
    getSubclassDefinition, 
    getFeatDefinition, 
    getBackgroundDefinition, 
    getSpeciesDefinition, 
    getSubspeciesDefinition, 
    findItemById, 
    findItemByName 
  } from '@/engine/characterData';
  ```
- **禁止直接从 `src/data/` 引用裸数组**进行硬编码检索。
