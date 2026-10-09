# 角色构建器：前端选择交互标准 (Selection UI Standard)

本手册定义了角色构建器中所有“选择项”（如种族、背景、职业、专长、装备包等）的统一前端交互方案。所有后续开发必须遵循此标准，以确保 Apple 设计风格的连贯性与交互逻辑的一致性。

## 1. 核心交互组件 (The Selection Card)

所有选项应封装在卡片式容器中（参考 `lineageItem` 类），具备以下特征：

### 1.1 基础视觉
- **背景**：淡色背景 (`#fbfbfd`)，选中时变为淡蓝色 (`#f0f7ff`)。
- **边框**：1px 浅灰色 (`#e5e5e7`)，选中时变为 2px Apple Blue (`#0071e3`)。
- **圆角**：10px - 12px (iOS 风格圆角)。
- **动效**：悬停时边框加深并伴随轻微阴影 (`box-shadow: 0 4px 12px rgba(0,0,0,0.05)`)。

### 1.2 内部指示器 (Indicators)
- **单选 (Radio)**：卡片内左侧或右上方必须包含圆形指示器。选中状态下包含中心实心圆点。
- **多选 (Checkbox)**：卡片内必须包含勾选框指示器，逻辑同单选。

---

## 2. 状态控制标准 (State Control)

### 2.1 排他性禁用状态 (Exclusivity & Gray-out)
当某选项因“前序选择已占用”（如种族已选语言、职业已选技能）而不可选时，必须遵循以下视觉规范：
- **置灰处理**：透明度降低至 `0.4`，背景色变为 `#f5f5f7`。
- **文字修饰**：在选项文字后添加小号字体的 `(已选)` 或 `(已占用)` 提示。
- **指针反馈**：鼠标样式锁定为 `not-allowed`。
- **点击失效**：物理上屏蔽 `onClick` 事件，防止状态误触发。

### 2.2 嵌套选择 (PillButton) 状态
- **Active**：选中时边框 2px，比例轻微放大 (`scale(1.02)`)，并带有 Apple Blue 阴影扩散效果。
- **Disabled**：同 2.1 规范，保持高度的视觉识别度。

---

## 3. 布局与呈现模式 (Layout & Presentation)

### 3.1 全宽垂直列表 (Full-width Vertical List)
- **适用场景**：核心决策点（如背景、职业分支）。
- **原则**：强制单列排列，保证每一项的名目和描述都能“拉满”显示。

### 3.2 风味内容展示 (Flavor Disclosure)
对于非机械性收益的随机表（如背景的风味表格）：
- **组件**：使用 `CollapsibleSection` (折叠面板) 封装。
- **原则**：遵循“渐进式呈现”原则，默认收起，点击标题展开，避免干扰核心数值决策。

---

## 4. 进度与反馈 (Progress & Feedback)

### 4.1 进度胶囊 (Progress Badges)
- **样式**：位于选择区标题右侧的极简胶囊。
- **逻辑**：显示 `已选 X/Y`。
- **视觉**：
  - 未完成：浅灰色背景，黑色文字。
  - 已完成：淡蓝色背景，蓝色文字，边框加粗。

### 4.2 边缘粗框特效 (Selection Highlight)
- 当用户选中某大项时，卡片边缘呈现明显的 **2px 粗框**。

---

## 5. 颜色规范 (Color Tokens)

| Token | 值 | 对应用途 |
| :--- | :--- | :--- |
| **Primary** | `#0071e3` | 选中边框、实心点、完成状态文字 |
| **Background** | `#f5f5f7` | 页面全局背景 |
| **Card BG** | `#fbfbfd` | 卡片静止状态背景 |
| **Disabled BG** | `#f5f5f7` | 选项被锁定/禁用时的背景 |
| **Border** | `#d2d2d7` | 默认边框线 |

---

## 6. 高阶特性选择标准 (Advanced Feature Selection - OptionCardInline)

对于包含复杂描述或有先决条件的选项（如专长 Feats、魔能祈唤 Invocations、超魔法 Metamagic、法术 Spells），必须使用 `OptionCardInline` 模式。

### 6.1 内联卡片结构
- **布局**：采用 `grid` 网格布局，推荐列宽 `minmax(300px, 1fr)`。
- **信息分层**：
  - **主标题**：中文名称 (name)。
  - **副标题**：英文名称 (nameEn)，灰色小号字体。
  - **元数据 (Metadata)**：在标题下方显示等级要求、消耗、来源等，使用极简字体。
  - **折叠按钮**：右侧圆圈按钮（标记为 `i` 或箭头），点击后向下展开详细描述。

### 6.2 描述渲染规则 (The "Description-Only" Rule)
- **纯文本优先**：为了防止 UI 递归崩溃，在选择阶段的卡片展开区**仅渲染纯文本 `description`**（Markdown 格式）。
- **屏蔽嵌套**：严禁在选择卡片内部渲染任何交互式 `mechanics`（如子选择器）。复杂的后续决策应在角色创建完成后的其他流程处理。

---

## 7. 超大型全局选项池选择标准 (Massive Pool Selection - Master-Detail Pattern)

对于属于全局通用池、数量庞大且依赖多维度分类检索的选项（如专长 Feats、法术 Spells、语言 Languages），禁止使用 `OptionCardInline` 以免页面过长，必须采用**“紧凑胶囊 + 独立详情面板”**的交互模式。

### 7.1 检索与紧凑展示区 (Master View)
- **分类与检索**：顶部必须提供分类 Tab（如专长的起源/通用分类，法术的环阶/职业限制）与搜索框。
- **紧凑排布**：选项使用 `PillButton` 胶囊按钮呈 Flex 自动换行排布，提供最高的信息密度。
- **状态反馈**：
  - **选中**：应用 Apple Blue 边框与阴影，并带有 `(已选)` 或 `(推荐)` 提示。
  - **不可选/先决条件不足**：按钮置灰 (`opacity: 0.4`)。

### 7.2 独立详情描述区 (Detail Pane)
- **位置**：位于胶囊按钮矩阵的下方。
- **触发逻辑**：当玩家选中（或移动端长按/PC端悬停，视具体实现而定）某个胶囊时，详情区展示该选项的具体信息。
- **展示内容**：
  - **标题**：带底色的分类标签（如“起源专长 Origin Feat”）+ 中文名称。
  - **描述**：**仅渲染纯文本 `description`**，严禁渲染任何嵌套子选项，确保渲染引擎的稳定性。

---

## 8. 技术复用参考
- **OptionCardInline 实现**：参考 `src/app/builder/class/page.tsx` 中的本地组件定义。
- **紧凑胶囊实现**：参考 `src/app/builder/class/page.tsx` 中的专长选择 (`category === 'feat'`) 渲染分支。
- **置灰逻辑实现**：参考 `src/app/builder/background/page.tsx` 中的 `preSelectedLanguages` 计算属性。
- **CSS 类名库**：参考 `src/app/builder/species/page.module.css`。
