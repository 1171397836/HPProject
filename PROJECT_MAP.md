# 项目导航图

## 1. 这份文档的用途

- 用来快速回答以下问题：
  - 项目怎么启动
  - 页面从哪里进入
  - 核心功能分别在哪个文件
  - 哪些文件是当前主链路，哪些是历史草稿
  - 出问题时优先排查哪里
- 优先作为 Agent 和维护者的项目地图使用，不替代产品 PRD。

## 2. 项目当前状态

- 项目名称：铁腕 - 智能任务管理工具
- 当前形态：以 `viewer01/` 为主的纯前端项目，已部署至 Vercel
- 核心业务：登录/注册、任务 CRUD、四象限展示、确认弹窗、退出登录、AI 助手
- 云端后端：Supabase (Auth + PostgreSQL)，实现多设备实时同步
- 正式域名：`ironhand.top`
- 已完全移除 CloudBase 依赖

## 3. 仓库结构总览

```text
HPProject/
├── PROJECT_MAP.md
├── PRD.md
├── package.json
├── vercel.json
├── .env.local          ← 本地开发凭证（.gitignore）
├── .gitignore
├── scripts/
│   └── build.js        ← 构建脚本：viewer01 → viewer01-dist，注入环境变量
├── viewer01/           ← 源码目录（占位符，不含真实凭证）
│   ├── app.html
│   ├── index.html
│   ├── login.html
│   ├── motherduck.html
│   ├── Design.md
│   ├── package.json
│   ├── css/
│   ├── js/
│   └── scripts/
└── viewer01-dist/      ← 构建输出（.gitignore，含真实凭证）
```

## 4. 顶层文件职责

| 路径 | 作用 |
|------|------|
| `package.json` | 根启动入口、项目元信息、构建脚本 |
| `PRD.md` | 产品需求文档，偏产品视角 |
| `vercel.json` | Vercel 部署配置（build 命令、输出目录） |
| `.env.local` | 本地开发 Supabase 凭证（不提交到 git） |
| `scripts/build.js` | 构建脚本：复制 viewer01 → viewer01-dist，替换占位符为真实凭证 |
| `viewer01/` | 实际前端应用源码目录（含占位符） |
| `viewer01-dist/` | 构建输出目录（含真实凭证，不提交到 git） |

## 5. 运行入口

### 5.1 本地启动

- **一键启动 (推荐)**：双击运行根目录的 `start.bat`
- 命令行启动：根目录执行 `npm run dev`
- 实际行为：先执行 `npm run build`（将 viewer01 复制到 viewer01-dist 并注入凭证），再启动 viewer01-dist 的静态服务
- 默认打开页面：`viewer01-dist/login.html`
- 默认访问地址：`http://127.0.0.1:8080/login.html`

### 5.2 构建与部署

- **构建命令**：`npm run build`
- **构建流程**：`scripts/build.js` 将 `viewer01/` 复制到 `viewer01-dist/`，并将 `supabaseClient.js` 中的占位符替换为真实值
- **环境变量来源**：
  - Vercel 部署时：从 Vercel Dashboard 环境变量读取 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
  - 本地开发时：从项目根目录 `.env.local` 文件读取
- **部署平台**：Vercel，自动执行构建，输出目录为 `viewer01-dist`

### 5.2 线上访问

- **正式域名**: `https://ironhand.top`
- **备用域名**: `https://www.ironhand.top`

### 5.2 页面角色

| 页面 | 角色 | 是否主链路 |
|------|------|------------|
| `viewer01/login.html` | 登录/注册页 | 是 |
| `viewer01/app.html` | 任务主页面 | 是 |
| `viewer01/index.html` | 落地页/介绍页，提供跳转登录入口 | 否 |
| `viewer01/motherduck.html` | 独立页面/设计稿性质页面 | 否 |

### 5.3 主链路

```text
login.html
  └── js/login.js
        ├── auth.js
        └── 登录成功后跳转 app.html

app.html
  └── js/app.js
        ├── auth.js
        ├── storage.js
        └── dialog.js
```

## 6. 核心模块地图

### 6.1 当前活跃文件

| 文件 | 职责 | 什么时候先看它 |
|------|------|----------------|
| `viewer01/js/config.js` | 全局配置（环境判断、API 地址、LocalStorage 键名等） | 涉及环境变量、存储键名、接口地址变更时 |
| `viewer01/js/supabaseClient.js` | Supabase 客户端初始化（源码中为占位符，构建时注入真实值） | Supabase 连接异常、凭证配置问题 |
| `viewer01/js/login.js` | 登录/注册页控制、表单校验、提交逻辑、已登录跳转 | 登录页交互异常、表单校验异常 |
| `viewer01/js/app.js` | 应用页初始化、任务渲染、增删改查、象限切换、统计、清空已完成、退出流程 | 任务页任何核心功能异常 |
| `viewer01/js/auth.js` | 认证状态、登录注册、鉴权守卫、用户展示、退出登录 | 登录态异常、跳转异常、用户信息异常 |
| `viewer01/js/storage.js` | 任务数据访问层（Supabase PostgreSQL） | 任务数据读写异常、数据库查询问题 |
| `viewer01/js/aiConfig.js` | AI 配置管理（提供商、API Key、模型选择），存储到 Supabase user_configs | AI 功能配置异常 |
| `viewer01/js/aiChat.js` | AI 聊天核心逻辑（消息管理、LLM API 通信、流式输出） | AI 对话功能异常 |
| `viewer01/js/dialog.js` | 通用弹窗与堆叠弹窗能力 | 编辑任务弹窗、确认弹窗异常 |

### 6.2 历史/草稿文件

以下文件当前不是页面主链路的一部分，内容更偏草稿或占位，不应优先作为现状依据：

- `viewer01/js/main.js`
- `viewer01/js/matrix.js`
- `viewer01/js/taskManager.js`
- `viewer01/js/ui.js`

如果后续继续保留这些文件，建议始终在调研时先确认页面是否仍有引用。

## 7. 页面到脚本映射

### 7.1 登录页

- 页面：`viewer01/login.html`
- 脚本入口：`viewer01/js/login.js`
- 关键职责：
  - 登录与注册表单切换
  - 邮箱/密码即时校验
  - 调用 `auth.js` 完成登录注册
  - 已登录用户直接跳转 `app.html`

### 7.2 应用页

- 页面：`viewer01/app.html`
- 脚本入口：`viewer01/js/app.js`
- 关键 DOM：
  - `userName` / `userAvatar`
  - `logoutBtn`
  - 左侧菜单按钮 (`menuBtn`) 和已完成任务抽屉 (`completedDrawer`)
  - `questionsBadge`
  - `quadrant-1` ~ `quadrant-4`
  - `taskTypeBtn`
  - `taskInput`
  - `sendBtn`

## 8. 核心功能对应位置

| 功能 | 优先查看 |
|------|----------|
| 登录/注册 | `viewer01/js/login.js`、`viewer01/js/auth.js` |
| 登录态校验 | `viewer01/js/auth.js` |
| 任务加载 | `viewer01/js/app.js`、`viewer01/js/storage.js` |
| 添加任务 | `viewer01/js/app.js` |
| 编辑任务 | `viewer01/js/app.js`、`viewer01/js/dialog.js` |
| 删除任务 | `viewer01/js/app.js` |
| 侧边栏/已完成历史 | `viewer01/js/app.js` |
| 四象限渲染 | `viewer01/js/app.js` |
| 退出登录 | `viewer01/js/app.js`、`viewer01/js/auth.js` |
| 通用确认弹窗 | `viewer01/js/dialog.js` 与 `viewer01/js/app.js` 调用处 |
| AI 助手对话 | `viewer01/js/aiChat.js`、`viewer01/js/aiConfig.js` |
| 构建与部署 | `scripts/build.js`、`vercel.json` |

## 9. 数据与状态

### 9.1 认证

- `auth.js` 统一处理认证逻辑
- 使用 Supabase Auth 实现邮箱+密码登录注册
- Supabase 凭证通过环境变量注入，不硬编码在源码中

### 9.2 任务数据

- `storage.js` 是唯一任务数据访问层，使用 Supabase PostgreSQL 存储
- 任务字段核心包括：
  - `id` (UUID)
  - `user_id`
  - `content`
  - `quadrant`
  - `completed`
  - `completed_at` (任务完成时间，用于抽屉时间分类)
  - `created_at`
  - `updated_at`

### 9.3 页面状态

- 当前选中象限由 `app.js` 管理，并持久化到本地存储
- 当前任务列表由 `app.js` 内存状态维护，再统一渲染到四象限 DOM

## 10. 测试与验证入口

### 10.1 测试命令

- 在 `viewer01/` 目录执行：`npm test`

### 10.2 测试文件

- `viewer01/scripts/smoke-test.mjs`

### 10.3 当前覆盖重点

- 注册/登录
- 登录态
- 本地任务 CRUD
- 编辑弹窗
- 删除确认
- 退出确认
- 四象限分组与渲染

## 11. 测试与环境入口

| 入口 | 用途 |
|------|------|
| `npm run dev` | 构建并启动本地测试环境 |
| `npm run build` | 仅构建（viewer01 → viewer01-dist，注入环境变量） |

## 12. 常见排查路径

### 12.1 登录失败

优先查看：

- `viewer01/js/login.js`
- `viewer01/js/auth.js`

重点关注：

- 表单校验
- 本地认证与云端认证分支
- 登录态写入是否成功

### 12.2 登录后没有进入任务页

优先查看：

- `viewer01/js/login.js`
- `viewer01/js/auth.js`

重点关注：

- 跳转逻辑
- `requireAuth`
- 当前页面是否处于本地模式

### 12.3 任务无法显示或刷新后丢失

优先查看：

- `viewer01/js/app.js`
- `viewer01/js/storage.js`

重点关注：

- `taskDB.getTasks`
- 当前登录用户 `uid`
- 本地存储读写是否正常

### 12.4 弹窗打不开或确认流异常

优先查看：

- `viewer01/js/dialog.js`
- `viewer01/js/app.js`

重点关注：

- 弹窗栈是否正常
- 触发事件是否绑定
- 关闭回调是否被正确处理

## 13. 建议搜索关键词

以下关键词适合快速定位问题：

- `requireAuth`
- `handleLogout`
- `taskDB`
- `loadTasks`
- `renderTaskMatrix`
- `openStackedDialog`
- `logoutBtn`
- `menuBtn`
- `completedDrawer`
- `taskInput`
- `quadrant-1`
- `supabase`
- `__SUPABASE_URL__`
- `__SUPABASE_ANON_KEY__`

## 14. 文档维护约定

出现以下变化时，应同步更新本文件：

- 新增页面入口
- 主链路脚本发生替换
- 新增核心模块
- 本地模式切换规则变化
- 测试入口变化
- 历史草稿文件被启用或删除

## 15. 当前已知注意点

- `PRD.md` 中"项目文件结构"章节仍保留较早版本描述，与当前运行结构不完全一致
- 当前调研项目现状时，应优先以 `viewer01/login.html`、`viewer01/app.html`、`viewer01/js/*.js` 的实际引用关系为准
- 如果后续要继续扩展项目说明，建议将本文件作为项目地图，`PRD.md` 继续保留产品需求视角
- Supabase 凭证不在源码中硬编码，通过 `scripts/build.js` 从环境变量注入到构建输出
- 抽屉三个 Tab（今日/本周/历史）是互斥分类，本周 Tab 不含今日（PRD 已明确）
