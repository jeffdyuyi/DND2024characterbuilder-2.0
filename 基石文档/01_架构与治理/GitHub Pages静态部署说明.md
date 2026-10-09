# GitHub Pages 静态部署适配

2026-10-09 已完成静态适配、干净源码上传、GitHub Actions 配置及首次 Pages 发布，线上地址为 https://jeffdyuyi.github.io/DND2024characterbuilder-2.0/ 。以下验收仅覆盖已明确记录的场景。

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

后续更新：在干净工作目录提交并推送 main，工作流自动检查及发布。完整规则、建卡流程和故障矩阵仍需逐项验收。

## GitHub Actions 与首次上传

工作流 `.github/workflows/pages.yml` 在 `main` 推送或手动触发时执行 `npm ci`、默认测试、Pages 静态构建、本机页面与资源检查，再上传 `out` 并发布。PR 只执行检查。构建任务仅有代码读取权限；发布任务具有 Pages 写入与部署身份令牌权限。

本地旧 Git 历史误收录 24,498 个 node_modules 文件及上游 ZIP（其中 Homebrew ZIP 约 585 MB，单个 SWC 文件约 137 MB），不适合上传 GitHub。首次发布在 `scratch/pages-release` 创建独立干净源码仓库；原仓库、历史与存档保留。发布不含 `.env.local`、node_modules、构建产物或上游 ZIP。

初次云端 npm ci 发现缺少跨平台 wasm 间接依赖锁记录。使用 Runner 相同版本 npm 补全 `package-lock.json`，没有改变已有锁定依赖版本。

后续开发与直接 git push 应使用 `scratch/pages-release` 或从 GitHub 克隆的新工作目录；原工作区 main 与远程干净历史不同，不能直接推送旧历史。GitHub Pages 是公开站点，角色仍只保存在访问者浏览器中。

## 2026-10-09 验收证据

- `npm test -- --reporter=dot`：226 项通过、3 项跳过；30 个测试文件通过、2 个跳过。
- `npm run build:pages`：编译、TypeScript 检查和静态导出通过；生成 24 个静态页面。
- `npm run verify:static`：24 个导出页面、46 个引用资源均通过 HTTP 与仓库子路径检查；角色卡查询参数入口与 404 检查通过。
- 内置浏览器、本地 4173 端口：角色库新建测试角色 `b6345921-585b-4184-91e6-3229aa44ff8d`；进入种族页面后返回固定角色卡入口，刷新后同 ID 角色卡显示；从角色卡进入引导编辑，下一步进入背景页并显示“步骤 2 / 10”。所有地址均保持 `/DND2024characterbuilder-2.0/` 前缀。
- 浏览器中可见已加载的中文种族与背景选项。本轮没有验证全部规则、第三方加载、故障矩阵或完整建卡流程，也没有进行线上验收。
- 初次构建受限环境停滞，改用允许子进程的构建环境。旧动态路由在 `.next/dev/types` 的生成类型失效，清理该生成目录后重新构建；未清理任何角色数据。构建仍提示 Browserslist 数据过期，不影响本次构建结果。

## 首次线上发布验收

- 发布源码提交：`df1272e7addbcb788d8ce17a878e8fa5bcd79818`。
- GitHub Actions：https://github.com/jeffdyuyi/DND2024characterbuilder-2.0/actions/runs/37884083733 ，build 和 deploy 均为 success。
- 云端安装、226 项默认测试（3 项跳过）、24 页面静态构建、24 页面与 46 资源检查、artifact 上传、Pages 部署均通过。
- 线上 HTTP 检查：首页、种族建卡页、角色卡查询参数入口、官方资源库、第三方库、规则速查均返回 200；这些页面引用的 27 个去重 JS/CSS 资源返回 200，路径均包含仓库前缀。
- 内置浏览器新建测试角色 `79afb406-3e04-4214-8e3b-8638a3c9928a`：进入建卡页后显示中文种族选项，状态为核心可用；进入 `/sheet/view/?id=...` 后角色卡显示，直接刷新仍显示同 ID 角色。角色未选择种族和职业，不能作为完整规则建卡验收。
- 本轮未验证所有第三方文件、全部规则计算、完整角色编辑闭环、多设备或跨浏览器存档迁移。
