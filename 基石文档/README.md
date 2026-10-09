# 基石文档技术导航与规范索引 (Architecture & Specs)

> **当前架构版本**：v2.0 (2026-09)  
> **核心原则**：5etools 在线镜像接入 + Catalog 统一适配 + Mechanics Overlay 覆盖 + 纯函数规则引擎。本目录仅保留指导后续产品设计、数据解耦与工程落地的核心技术资产。历史散装语料与旧版规范已归档至 `DNDdata备份` 仓库。

---

## 目录与文档全览

### 1. 架构与治理 (`01_架构与治理/`)
- [Antigravity接手自检与技术优化指南.md](01_架构与治理/Antigravity接手自检与技术优化指南.md)：开发与交付自检基准、AGENTS.md 引用的强制准则与全局阶段划分。
- [数据处理核心原则.md](01_架构与治理/数据处理核心原则.md)：语料原文零篡改原则、2014/2024 双轨并存及手动控制权红线准则。
- [精细化来源控制与规则适配计划.md](01_架构与治理/精细化来源控制与规则适配计划.md)：核心三宝书、战役扩展与自制内容来源过滤体系设计。

### 2. 5etools 数据接入与解耦 (`02_5etools数据接入与解耦/`)
- [5etools全量数据接入与引擎保留实施路线图.md](02_5etools数据接入与解耦/5etools全量数据接入与引擎保留实施路线图.md)：三层解耦架构模型（5etools 在线层 + Mechanics Overlay + Rules Engine）的顶层设计。
- [5etools_data_migration_summary.md](02_5etools数据接入与解耦/5etools_data_migration_summary.md)：5etools 接入进度、数据源接口与断链排查现状。
- [全量公共数据接入与引擎解耦轻量化实施方案.md](02_5etools数据接入与解耦/全量公共数据接入与引擎解耦轻量化实施方案.md)：数据源彻底解耦、本地轻量化与工程架构支撑方案。
- [5etools与中文枚举映射字典.md](02_5etools数据接入与解耦/5etools与中文枚举映射字典.md)：六维属性、18项技能、物品类型、武器属性、武器掌握、法术学派与出版物代码全量映射字典。

### 3. 规则引擎与计算 (`03_规则引擎与计算/`)
- [DND5R_5etools_rules_engine_agent_spec.md](03_规则引擎与计算/DND5R_5etools_rules_engine_agent_spec.md)：规则引擎交互契约、5etools 适配器接口与 Overlay 注入规格。
- [dnd2024_srd_search_and_homebrew_technical_spec.md](03_规则引擎与计算/dnd2024_srd_search_and_homebrew_technical_spec.md)：SRD 检索与自制内容（Homebrew）扩展技术规格。
- [角色卡手动覆盖与字段计算规范.md](03_规则引擎与计算/角色卡手动覆盖与字段计算规范.md)：三层数据流（Computed -> Manual -> Final）、9项可覆盖字段白名单与双轨规则约束。

### 4. 产品与界面 (`04_产品与界面/`)
- [角色创建流程与卡面生成设计方案.md](04_产品与界面/角色创建流程与卡面生成设计方案.md)：角色创建 9 步向导状态机、CharacterState V2 模型契约与角色卡渲染管线。
- [selection_ui_standard.md](04_产品与界面/selection_ui_standard.md)：选择器、多选/单选池、弹层与交互规范标准。
- [主界面与角色卡视觉重构及双端响应式适配方案.md](04_产品与界面/主界面与角色卡视觉重构及双端响应式适配方案.md)：仿既白卡面视觉规范、双端响应式适配与 CSS 样式系统契约。

---

## 历史归档索引
如需查阅历史本地 TS 转换提取规范、过程验收记录或原始散装语料 JSON/TXT，请前往外部归档路径：
- 原始散装语料库：`e:/YJF/DNDdata备份/中文data/`
- 规则原文归档：`e:/YJF/DNDdata备份/中文data/规则源文归档/`
- 历史本地TS转换规范：`e:/YJF/DNDdata备份/docs/02_数据工程/历史本地TS转换规范/`
- 历史交付验收记录：`e:/YJF/DNDdata备份/docs/01_产品与流程/历史交付记录/`
- 参考规书与测试资料：`e:/YJF/DNDdata备份/reference_materials/`
