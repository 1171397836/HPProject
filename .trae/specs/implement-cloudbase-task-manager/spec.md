# 铁腕任务管理器 - CloudBase 集成 Spec

## Why
铁腕任务管理工具需要实现用户认证和数据云端同步功能。通过集成腾讯云开发 CloudBase，实现用户注册/登录、任务数据的增删改查以及跨设备数据同步。

## What Changes
- 创建登录/注册页面 (login.html)
- 新增登录页模块脚本 (js/login.js)
- 集成 CloudBase JavaScript SDK
- 实现用户认证系统（用户名+密码）
- 实现任务数据的云端存储和同步
- 为本地开发/测试提供 localStorage 回退模式
- 改造 app.html 添加登录状态检查

## Impact
- 新增文件: login.html, js/login.js, js/cloudbase.js, js/auth.js
- 修改文件: app.html, js/app.js
- 依赖: CloudBase 环境 ID ironhand-8gclol9h5c79d816

## Current Status
- 本地功能测试已完成：注册、登录、退出、四象限新增、完成/取消完成、编辑、删除、清空已完成
- 本地预览默认使用 localStorage 作为认证与任务数据回退模式
- CloudBase 真环境联调、线上托管与跨设备同步仍待验证

## ADDED Requirements

### Requirement: 用户认证系统
系统应提供用户注册和登录功能。

#### Scenario: 用户注册
- **GIVEN** 用户在登录页面
- **WHEN** 输入用户名和密码并点击注册
- **THEN** 创建新用户并自动登录

#### Scenario: 用户登录
- **GIVEN** 已注册用户
- **WHEN** 输入正确的用户名和密码
- **THEN** 登录成功并跳转到任务管理页

#### Scenario: 用户退出
- **GIVEN** 已登录用户
- **WHEN** 点击退出按钮
- **THEN** 清除登录状态并跳转到登录页

### Requirement: 本地开发测试模式
系统应在本地开发或预览环境提供可用的认证与任务存储回退模式，以便不依赖 CloudBase 真环境也能进行功能测试。

#### Scenario: 本地认证回退
- **GIVEN** 用户在本地开发环境访问应用
- **WHEN** CloudBase 真环境未接通或不适合本地域名访问
- **THEN** 系统使用 localStorage 完成注册、登录、退出和会话校验

#### Scenario: 本地任务存储回退
- **GIVEN** 用户已在本地开发环境登录
- **WHEN** 进行新增、编辑、完成、删除、清空已完成等任务操作
- **THEN** 系统使用 localStorage 保存并读取该用户的任务数据

### Requirement: 任务数据云端存储
系统应将任务数据存储在 CloudBase 云数据库中。

#### Scenario: 添加任务
- **GIVEN** 用户已登录
- **WHEN** 输入任务内容并选择象限
- **THEN** 任务保存到云端数据库

#### Scenario: 完成任务
- **GIVEN** 用户有未完成任务
- **WHEN** 点击任务复选框
- **THEN** 任务状态更新为已完成

#### Scenario: 删除任务
- **GIVEN** 用户有已完成任务
- **WHEN** 点击删除按钮
- **THEN** 任务从数据库中删除

#### Scenario: 数据同步
- **GIVEN** 用户在新设备登录
- **WHEN** 进入任务管理页
- **THEN** 自动加载该用户的所有任务数据

### Requirement: 登录状态保护
系统应保护任务管理页面，未登录用户无法访问。

#### Scenario: 未登录访问
- **GIVEN** 用户未登录
- **WHEN** 直接访问 app.html
- **THEN** 自动重定向到登录页

## MODIFIED Requirements

### Requirement: 应用界面
app.html 应添加用户认证相关功能。

#### Changes:
- 顶部显示当前用户名
- 添加退出登录按钮
- 页面加载时检查登录状态
- 集成 CloudBase SDK 进行数据操作

## Data Model

### 用户集合 (users)
- `uid`: 本地模式用户唯一标识
- `_openid`: CloudBase 模式用户唯一标识（CloudBase 自动分配）
- `username`: 用户名
- `password`: 密码（本地测试模式为本地存储，线上应加密存储）
- `createTime` / `createdAt`: 注册时间

### 任务集合 (tasks)
- `_id`: 任务唯一标识
- `content`: 任务内容 (String)
- `completed`: 是否完成 (Boolean, 默认 false)
- `quadrant`: 象限编码 q1-q4 (String)
- `uid` / `_openid`: 关联用户 ID (String)
- `createTime` / `createdAt`: 创建时间
- `updateTime` / `updatedAt`: 更新时间

## Security Rules
```javascript
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```
