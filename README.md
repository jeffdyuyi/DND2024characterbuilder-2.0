# D&D 2024 Character Builder

[打开 GitHub Pages 站点](https://jeffdyuyi.github.io/DND2024characterbuilder-2.0/)

通过 Catalog 加载与解析 5etools-cn 和 Homebrew 数据的角色创建与角色卡工具。

## 本地开发

```sh
npm ci
npm run dev
```

## 静态构建

```sh
npm run build:pages
npm run preview -- --port 4173
```

打开 `http://localhost:4173/DND2024characterbuilder-2.0/`。另开终端运行 `npm run verify:static` 检查导出页面与资源。

`npm run build` 导出根路径版本，`PAGES_BASE_PATH` 可覆盖部署子路径。

## 自动发布

`.github/workflows/pages.yml` 在推送 `main` 后按锁文件安装依赖，运行默认测试、静态构建和页面资源检查，全部通过后发布 GitHub Pages。PR 执行同样检查，不发布站点。

数据仍从上游动态加载并解析。角色保存于浏览器本地，不会随代码部署上传，也不会自动跨域或跨设备同步；迁移请使用 JSON 导出/导入。

当前线上版本不代表全部规则和建卡流程已验收。

首次上传使用干净源码快照，排除了旧本地历史中的依赖目录和语料 ZIP。后续开发、提交和推送应使用从本 GitHub 仓库克隆的干净工作目录，不能直接推送旧仓库历史。

## 代码格式与仓库范围

`npm run format` 统一源码格式，`npm run format:check` 检查格式。原始测试样本不会格式化。

仓库保留运行源码、必要测试及样本、依赖锁文件、构建配置和发布工作流。规划文档、验收输出、代理指令、编辑器配置和离线辅助脚本仅保留本地，已加入忽略规则。
