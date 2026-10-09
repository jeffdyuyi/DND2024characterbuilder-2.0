# D&D 2024 角色构建器：全局资源查询与自制酿造者 (Homebrew) 技术落地方案规范

> **文档版本**：v1.0.0  
> **归属项目**：`DND2024characterbuilder-2.0`  
> **存放路径**：`基石文档/dnd2024_srd_search_and_homebrew_technical_spec.md`  
> **状态**：待审核 / 准备实施

---

## 1. 概述与核心原则

本技术文档旨在为 `DND2024characterbuilder-2.0` 工具箱提供**全局资源查询器（Ctrl+K 模态框）**、**5e / 5.5e (2024) 规则动态切换**以及**自制酿造者 (Homebrew Creator)** 的完整架构设计与落地实施步骤。

### 1.1 专有名词与译名规范（严禁机翻）
本实施方案**严格遵循**项目 `基石文档` 中已有的官方/行业标准映射文件（包括《spell_terminology_mapping.md》、《item_type_mapping.md》、《item_property_mapping.md》、《ability_skill_mapping.md》、《boon_reward_mapping.md》及《资源名称译名缩写对照.md》）：

| 英文原名 (English) | 错误/违禁译名 (Banned) | **标准中文专有名词 (Mandatory)** | 参考映射规范文件 |
| :--- | :--- | :--- | :--- |
| **Classes** | ❌ 课程 / 课 | **职业** | 《资源名称译名缩写对照.md》 |
| **Items / Adventuring Gear** | ❌ 项目 / 道具 | **物品与装备 / 冒险装备** | 《item_type_mapping.md》 |
| **Feats** | ❌ 壮举 / 功绩 | **专长** | 《boon_reward_mapping.md》 |
| **Species / Races** | ❌ 物种 | **种族** (2024 版按标准译名) | 《ability_skill_mapping.md》 |
| **Spells** | ❌ 咒语/拼写 | **法术** | 《spell_terminology_mapping.md》 |
| **Bestiary / Monsters** | ❌ 兽谱 | **怪物图鉴 / 怪物** | 《资源名称译名缩写对照.md》 |
| **Backgrounds** | ❌ 背景故事 | **背景** | 基石文档规范 |
| **Homebrew** | ❌ 啤酒酿造 | **自制内容 / 自制酿造者** | 项目自定义统一术语 |

---

## 2. 架构设计一：全局资源查询器与版本控制引擎

针对 `dndtools.online` 的标题栏查询功能进行全面升级，适配项目的 **Apple 黑金玻璃拟态 (`GlassNav`)** 主题。

```
                              [用户输入: Ctrl+K / 点击搜索]
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │  SearchModal 搜索对话框 │
                              └────────────┬────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
       ┌────────────────────────┐                    ┌────────────────────────┐
       │   SRD 核心索引数据库   │                    │ Homebrew 本地自制数据库 │
       │ (src/data/ 法术/专长...) │                    │  (dnd2024-homebrew)   │
       └────────────┬───────────┘                    └────────────┬───────────┘
                    │                                             │
                    └──────────────────────┬──────────────────────┘
                                           │ (合并 & 标记 [自制])
                                           ▼
                              ┌─────────────────────────┐
                              │ 模糊匹配引擎 (双语/拼音) │
                              └────────────┬────────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │ 搜索结果卡片 & 预览抽屉 │
                              │ (提供"加入角色卡"操作)  │
                              └─────────────────────────┘
```

### 2.1 全局搜索索引引擎 (`src/engine/searchIndexer.ts`)
* **匹配字段**：英文 ID (`id`)、中文名称 (`name`)、英文原名 (`nameEn`)、拼音首字母/全拼、分类标签。
* **规则版本过滤**：根据全局 store 中的 `edition` (`'5e'` | `'2024'`) 过滤显示符合当前版本的格式（如 2024 起源专长与 2014 传统专长）。
* **UI 交互**：
  * 全局键盘监听 `Ctrl + K` / `Cmd + K` 打开浮窗；
  * `ESC` 键或点击遮罩关闭；
  * 键盘上下键 (`ArrowUp`/`ArrowDown`) 遍历结果，`Enter` 查看详情。

### 2.2 规则版本切换器 (`5e / 5.5e (2024)`)
在全局 `GlassNav` 顶部导航栏中集成规则切换胶囊按钮：
* 状态保存在 `localStorage` 的 `dnd2024-rule-edition` 键中；
* 切换时通知 Builder 与 Searcher 组件响应式重绘。

---

## 3. 架构设计二：自制酿造者 (Homebrew) 独立本地存储库

为了保证第三方/自制内容不会污染系统核心数据，并且能够随浏览器离线存储和导出备份，采用**独立的解耦存储层**。

### 3.1 独立 Store 规范 (`src/store/homebrewStore.ts`)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Spell } from '@/types/spell';
import { Feat } from '@/types/feat';
import { Item } from '@/types/item';
import { Species } from '@/types/species';
import { Background } from '@/types/background';

export interface HomebrewDataState {
  spells: Spell[];
  monsters: any[]; // 怪物数据结构
  items: Item[];
  feats: Feat[];
  species: Species[];
  backgrounds: Background[];
}

export interface HomebrewStore extends HomebrewDataState {
  // 数据增删改查
  addEntry: <K extends keyof HomebrewDataState>(category: K, entry: HomebrewDataState[K][number]) => void;
  updateEntry: <K extends keyof HomebrewDataState>(category: K, id: string, entry: Partial<HomebrewDataState[K][number]>) => void;
  deleteEntry: <K extends keyof HomebrewDataState>(category: K, id: string) => void;
  
  // 导入与导出
  exportAsJSON: () => string;
  importFromJSON: (jsonStr: string) => { success: boolean; count: number; error?: string };
  clearCategory: (category: keyof HomebrewDataState) => void;
}

export const useHomebrewStore = create<HomebrewStore>()(
  persist(
    (set, get) => ({
      spells: [],
      monsters: [],
      items: [],
      feats: [],
      species: [],
      backgrounds: [],

      addEntry: (category, entry) => set((state) => ({
        [category]: [...state[category], { ...entry, isHomebrew: true }]
      })),

      updateEntry: (category, id, updates) => set((state) => ({
        [category]: state[category].map((item: any) => item.id === id ? { ...item, ...updates } : item)
      })),

      deleteEntry: (category, id) => set((state) => ({
        [category]: state[category].filter((item: any) => item.id !== id)
      })),

      exportAsJSON: () => {
        const { spells, monsters, items, feats, species, backgrounds } = get();
        return JSON.stringify({ version: '1.0', timestamp: Date.now(), data: { spells, monsters, items, feats, species, backgrounds } }, null, 2);
      },

      importFromJSON: (jsonStr) => {
        try {
          const parsed = JSON.parse(jsonStr);
          if (!parsed.data) throw new Error('无效的自制数据包格式');
          set((state) => ({
            spells: [...state.spells, ...(parsed.data.spells || [])],
            monsters: [...state.monsters, ...(parsed.data.monsters || [])],
            items: [...state.items, ...(parsed.data.items || [])],
            feats: [...state.feats, ...(parsed.data.feats || [])],
            species: [...state.species, ...(parsed.data.species || [])],
            backgrounds: [...state.backgrounds, ...(parsed.data.backgrounds || [])],
          }));
          return { success: true, count: Object.values(parsed.data).flat().length };
        } catch (e: any) {
          return { success: false, count: 0, error: e.message };
        }
      },

      clearCategory: (category) => set({ [category]: [] })
    }),
    {
      name: 'dnd2024-homebrew-storage',
    }
  )
);
```

### 3.2 自制酿造者 UI 交互面板 (`/src/app/homebrew/page.tsx`)
1. **7 大分类标准导航 Tab**：
   * **法术** (Spells)
   * **怪物** (Monsters)
   * **装备与物品** (Items)
   * **职业** (Classes)
   * **种族** (Species)
   * **背景** (Backgrounds)
   * **专长** (Feats)
2. **双栏所见即所得创建模态框 (Live Preview Creator)**：
   * **左侧**：黑金拟态表单（带校验，如：法术环阶、学派选择、施法时间、成分与描述）；
   * **右侧**：实时渲染《D&D 5e/2024》标准卡片面板，动态更新。

---

## 4. 实施阶段与落地方案步骤

### 阶段一：建立独立 Store 与检索提供者 (Days 1)
1. 创建 `src/store/homebrewStore.ts`（实现 Zustand 本地持久化与 JSON 导入导出）。
2. 创建 `src/engine/searchIndexer.ts`（支持主 SRD 数据库与 Homebrew 数据库的合并全文索引）。

### 阶段二：升级导航栏与编写全局 `Ctrl + K` 搜索框 (Days 2)
1. 构建 `src/components/SearchModal/index.tsx`（具备双语模糊搜索、分类 Tab 过滤、微光暗色玻璃遮罩与详细卡片展开）。
2. 升级 `src/components/GlassNav/index.tsx`：
   * 加入 `Ctrl+K` 搜索按钮触点；
   * 加入 `5e / 5.5e` 规则版本切换胶囊；
   * 加入下拉导航菜单（数据库、规则速查、自制酿造者入口）。

### 阶段三：打造完全中文化的 `/homebrew` 酿造者页面 (Days 3)
1. 创建 `src/app/homebrew/page.tsx` 与相关组件 `src/components/homebrew/`。
2. 实现法术、专长、装备、种族、背景等 7 大分类的模态框录入表单。
3. 实现 JSON 文件一键拖拽上传导入与导出备份。

### 阶段四：质量验证与自动化测试 (Days 4)
1. 验证专有名词无任何机翻误译（核对《spell_terminology_mapping.md》与《item_type_mapping.md》）。
2. 验证浏览器清空缓存/隐私模式下的错误回退与安全性。
3. 执行 `npm run build` 确保 TypeScript 类型推导 100% 通过无报错。

---

> **审核提示**：请用户审阅本技术规范。审核通过后，我们将立即按照本步骤依次落实代码。
