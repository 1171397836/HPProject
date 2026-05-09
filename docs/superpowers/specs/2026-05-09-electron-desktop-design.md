# 铁腕桌面端 App — Electron 包装方案

> 日期: 2026-05-09
> 类型: 功能增强

## 1. 目标

将铁腕网页版包装为 Windows 桌面端 App，保持与网页版完全一致的用户体验，同时保留 Vercel 网页版部署。

## 2. 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | Electron | 已有打包经验，改动最小，Web 代码零修改 |
| 窗口 | 系统默认标题栏 | 最简单可靠，无需自定义标题栏 |
| 发布 | 双端保留 | Vercel 网页版 + 桌面安装包并行 |

## 3. 架构

```
electron/main.js          ← Electron 主进程 (新增)
electron/preload.js       ← 预加载脚本 (新增)
dist/                     ← Vite 构建产物 (现有，Electron 加载目标)
package.json              ← 增加 electron-builder 配置 (修改)
```

**运行流程**：
1. 用户启动 `铁腕.exe`
2. Electron 主进程创建 BrowserWindow
3. 加载 `dist/app.html`（生产）或 `http://localhost:3000/app.html`（开发）
4. 所有功能（Supabase Auth、任务 CRUD、AI 助手、工作区）照常运行

## 4. 实现内容

### 4.1 新增文件

- `electron/main.js` — 主进程入口，创建窗口、设置菜单
- `electron/preload.js` — 预加载脚本，安全暴露 IPC

### 4.2 修改文件

- `package.json` — 添加 `main` 字段指向 `electron/main.js`，添加 electron-builder 打包配置，添加 devDependencies (electron, electron-builder)

### 4.3 清理

- `release/` — 删除旧版打包产物

### 4.4 构建流程

```bash
npm run build          # Vite 打包 → dist/
npx electron-builder   # Electron 打包 → release/
```

## 5. 不涉及

- 无业务代码修改
- 无 UI 修改
- 无 Supabase 配置修改
- 不取消 Vercel 部署