# Electron 桌面端包装 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Electron 包装铁腕网页版为 Windows 桌面 App，与网页版效果完全一致。

**Architecture:** 新增 `electron/main.js`（主进程）和 `electron/preload.js`（预加载），Electron 加载 Vite 构建产物 `dist/app.html`。Vite 配置改为相对路径以支持 `file://` 协议加载。所有业务代码零改动。

**Tech Stack:** Electron 28+, electron-builder 24+, Vite 5

---

### Task 1: 配置 Vite 相对路径

**Files:**
- Modify: `vite.config.js`

为了让 Electron 通过 `file://` 协议加载构建产物时资源路径正确，Vite 需要输出相对路径。

- [ ] **Step 1: 修改 vite.config.js，添加 `base` 配置**

```js
// vite.config.js
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        app: resolve(__dirname, 'app.html'),
        motherduck: resolve(__dirname, 'motherduck.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  },
  server: {
    port: 3000,
    open: '/login.html'
  }
});
```

- [ ] **Step 2: 验证 Vite 构建产出相对路径**

```bash
npm run build
```

检查 `dist/app.html` 中的 `<script>` 标签是否使用相对路径（`./assets/...` 而非 `/assets/...`）：

```bash
head -20 dist/app.html
```

- [ ] **Step 3: 提交**

```bash
git add vite.config.js
git commit -m "$(cat <<'EOF'
feat: 配置 Vite 相对路径以支持 Electron file:// 加载

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 创建 Electron 主进程

**Files:**
- Create: `electron/main.js`

- [ ] **Step 1: 创建 `electron/main.js`**

```js
// electron/main.js
import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '铁腕 - 智能任务管理',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 开发模式加载 Vite dev server，生产模式加载构建产物
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000/app.html');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'app.html'));
  }

  // 设置简单菜单
  const menuTemplate = [
    {
      label: '铁腕',
      submenu: [
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

- [ ] **Step 2: 提交**

```bash
git add electron/main.js
git commit -m "$(cat <<'EOF'
feat: 添加 Electron 主进程，加载 Vite 构建产物

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 创建预加载脚本

**Files:**
- Create: `electron/preload.js`

- [ ] **Step 1: 创建 `electron/preload.js`**

```js
// electron/preload.js
import { contextBridge } from 'electron';

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
});
```

- [ ] **Step 2: 提交**

```bash
git add electron/preload.js
git commit -m "$(cat <<'EOF'
feat: 添加 Electron 预加载脚本

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 更新 package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 添加 Electron 依赖和打包配置**

编辑 `package.json`，修改内容如下：

1. `main` 从 `"index.html"` 改为 `"electron/main.js"`
2. 在 `scripts` 中新增 `"electron:dev"` 和 `"electron:build"` 脚本
3. 在 `devDependencies` 中添加 `electron` 和 `electron-builder`
4. 添加 `build` 字段配置 electron-builder

修改后的 `package.json`：

```json
{
  "name": "tiewan-task-manager",
  "version": "1.0.0",
  "description": "铁腕 - 智能任务管理工具",
  "main": "electron/main.js",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "electron:dev": "set NODE_ENV=development&& npx electron .",
    "electron:build": "vite build && npx electron-builder --win",
    "test": "node src/scripts/smoke-test.mjs"
  },
  "build": {
    "appId": "com.tiewan.task-manager",
    "productName": "铁腕",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "package.json"
    ],
    "win": {
      "target": "nsis"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  },
  "keywords": [
    "task-manager",
    "eisenhower-matrix"
  ],
  "author": "铁腕团队",
  "license": "MIT",
  "devDependencies": {
    "dotenv": "^17.4.2",
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.103.3"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
npm install
```

- [ ] **Step 3: 验证 Electron 可启动（开发模式）**

在一个终端启动 Vite dev server：

```bash
npm run dev
```

在另一个终端启动 Electron：

```bash
npm run electron:dev
```

预期：Electron 窗口打开，显示登录页面，与浏览器效果一致。

- [ ] **Step 4: 提交**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat: 添加 Electron 和 electron-builder 依赖及打包配置

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 清理旧版打包产物并构建新版

**Files:**
- Delete: `release/`

- [ ] **Step 1: 删除旧版 release 目录**

```bash
rm -rf release/
```

- [ ] **Step 2: 构建 Vite 产物并打包 Electron**

```bash
npm run electron:build
```

预期：在 `release/` 目录生成 `铁腕 Setup X.X.X.exe` 安装包和 `win-unpacked/` 目录。

- [ ] **Step 3: 验证桌面端安装包**

运行 `release/win-unpacked/铁腕.exe`，验证：
- 窗口正常打开，显示登录页面
- 注册/登录功能正常
- 任务 CRUD 正常
- AI 助手功能正常
- 工作区切换正常

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "$(cat <<'EOF'
chore: 清理旧版 Electron 打包产物

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```