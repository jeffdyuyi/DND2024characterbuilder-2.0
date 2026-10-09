# GitHub Pages 静态部署适配

本步骤仅完成本地静态导出适配。尚未推送代码、配置 GitHub Actions 或发布线上站点。

## 构建与预览

```powershell
npm run build:pages
npm run preview -- --port 4173
```

打开 `http://localhost:4173/DND2024characterbuilder-2.0/`。预览服务器直接读取 `out`，不需要 Next.js 服务端。另开终端执行：

```powershell
npm run verify:static
```

该检查遍历导出的 index.html 页面，检查 HTTP 200、全部引用的 Next.js 资源路径与响应、带角色 ID 查询参数的角色卡入口及未知路由 404。它不能替代完整浏览器业务验收。

`npm run build` 默认导出根路径版本。`PAGES_BASE_PATH` 可覆盖构建路径（以 `/` 开头且不以 `/` 结尾）；变更路径必须重新构建。预览自动读取本次构建写入的 `out/.static-site.json`，无需再次设置路径。

## 改动

- Next.js 配置 `output: 'export'`、`trailingSlash: true` 和构建时 `basePath`。
- 构建成功后生成 `out/.nojekyll`，供 Pages 静态托管使用。
- 角色卡由运行时动态路由 `/sheet/[id]` 改为固定路由 `/sheet/view/?id=角色ID`。角色库、建卡完成和编辑返回入口同步修改，ID 经 URL 编码。
- `/sheet/` 在客户端返回角色库；404 首页链接改用 Next.js Link，以遵循部署子路径。
- 建卡步骤识别忽略结尾斜杠。
- `npm start`、`npm run preview` 使用静态预览脚本；本地启动脚本以 `out/.static-site.json` 判断构建是否存在。

## 数据与限制

5etools-cn 和 Homebrew 继续使用原有远程加载、缓存及解析逻辑，没有打包本地语料替代上游，也没有修改规则原文。网络可达性与 CORS 需要线上另行验收。

角色存档仍保存在浏览器本地。localhost 与 GitHub Pages 属于不同源，本地角色不会自动出现在新站点，应使用现有 JSON 导出/导入功能迁移。此适配不修改或清空存档。

旧 `/sheet/角色ID` 书签不再是有效路由；请从角色库重新进入。固定查询参数路由允许任意新建角色直接访问及刷新，不依赖服务器生成页面。

后续发布步骤：提交和推送代码，配置测试及静态构建的 GitHub Actions 工作流，设置 Pages 发布源，完成线上路由、数据加载和存档验收。

## 2026-10-09 验收证据

- `npm test -- --reporter=dot`：226 项通过、3 项跳过；30 个测试文件通过、2 个跳过。
- `npm run build:pages`：编译、TypeScript 检查和静态导出通过；生成 24 个静态页面。
- `npm run verify:static`：24 个导出页面、46 个引用资源均通过 HTTP 与仓库子路径检查；角色卡查询参数入口与 404 检查通过。
- 内置浏览器、本地 4173 端口：角色库新建测试角色 `b6345921-585b-4184-91e6-3229aa44ff8d`；进入种族页面后返回固定角色卡入口，刷新后同 ID 角色卡显示；从角色卡进入引导编辑，下一步进入背景页并显示“步骤 2 / 10”。所有地址均保持 `/DND2024characterbuilder-2.0/` 前缀。
- 浏览器中可见已加载的中文种族与背景选项。本轮没有验证全部规则、第三方加载、故障矩阵或完整建卡流程，也没有进行线上验收。
- 初次构建受限环境停滞，改用允许子进程的构建环境。旧动态路由在 `.next/dev/types` 的生成类型失效，清理该生成目录后重新构建；未清理任何角色数据。构建仍提示 Browserslist 数据过期，不影响本次构建结果。
