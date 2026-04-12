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
- 当前形态：以 `viewer01/` 为主的纯前端项目
- 核心业务：登录/注册、任务 CRUD、四象限展示、确认弹窗、退出登录
- 仅支持本地 localStorage 认证与本地任务存储
- 已完全移除 CloudBase 依赖

## 3. 仓库结构总览

```text
HPProject/
├── PROJECT_MAP.md
├── PRD.md
├── package.json
└── viewer01/
    ├── app.html
    ├── index.html
    ├── login.html
    ├── motherduck.html
    ├── Design.md
    ├── package.json
    ├── css/
    ├── js/
    └── scripts/
```

## 4. 顶层文件职责

| 路径 | 作用 |
|------|------|
| `package.json` | 根启动入口、项目元信息 |
| `PRD.md` | 产品需求文档，偏产品视角 |
| `viewer01/` | 实际前端应用目录 |

## 5. 运行入口

### 5.1 本地启动

- **一键启动 (推荐)**：双击运行根目录的 `start.bat`
- 命令行启动：根目录执行 `npm run dev`
- 实际行为：进入 `viewer01/` 后启动静态服务
- 默认打开页面：`viewer01/login.html`
- 默认访问地址：`http://127.0.0.1:8080/login.html`

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
| `viewer01/js/login.js` | 登录/注册页控制、表单校验、提交逻辑、已登录跳转 | 登录页交互异常、表单校验异常 |
| `viewer01/js/app.js` | 应用页初始化、任务渲染、增删改查、象限切换、统计、清空已完成、退出流程 | 任务页任何核心功能异常 |
| `viewer01/js/auth.js` | 认证状态、登录注册、鉴权守卫、用户展示、退出登录 | 登录态异常、跳转异常、用户信息异常 |
| `viewer01/js/storage.js` | 任务数据访问层，纯本地 localStorage 模式 | 任务数据读写异常、存储模式问题 |
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
  - 用户名/密码即时校验
  - 调用 `auth.js` 完成登录注册
  - 已登录用户直接跳转 `app.html`

### 7.2 应用页

- 页面：`viewer01/app.html`
- 脚本入口：`viewer01/js/app.js`
- 关键 DOM：
  - `userName` / `userAvatar`
  - `logoutBtn`
  - `questionsBadge`
  - `clearBtn`
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
| 清空已完成 | `viewer01/js/app.js` |
| 四象限渲染 | `viewer01/js/app.js` |
| 退出登录 | `viewer01/js/app.js`、`viewer01/js/auth.js` |
| 通用确认弹窗 | `viewer01/js/dialog.js` 与 `viewer01/js/app.js` 调用处 |

## 9. 数据与状态

### 9.1 认证

- `auth.js` 统一处理本地认证
- 登录态与本地用户库使用 `localStorage` 保存

### 9.2 任务数据

- `storage.js` 是唯一任务数据访问层
- 任务数据使用 `localStorage` 保存
- 任务字段核心包括：
  - `_id`
  - `uid`
  - `content`
  - `quadrant`
  - `completed`
  - `createdAt`
  - `updatedAt`

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
- 清空已完成确认
- 退出确认
- 四象限分组与渲染

## 11. 测试与环境入口

| 入口 | 用途 |
|------|------|
| `npm run dev` | 启动本地测试环境 |

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
- `clearBtn`
- `confirmBeforeClearCompleted`
- `logoutBtn`
- `taskInput`
- `quadrant-1`
- `localStorage`

## 14. 文档维护约定

出现以下变化时，应同步更新本文件：

- 新增页面入口
- 主链路脚本发生替换
- 新增核心模块
- 本地模式切换规则变化
- 测试入口变化
- 历史草稿文件被启用或删除

## 15. 当前已知注意点

- `PRD.md` 中“项目文件结构”章节仍保留较早版本描述，与当前运行结构不完全一致
- 当前调研项目现状时，应优先以 `viewer01/login.html`、`viewer01/app.html`、`viewer01/js/*.js` 的实际引用关系为准
- 如果后续要继续扩展项目说明，建议将本文件作为项目地图，`PRD.md` 继续保留产品需求视角
