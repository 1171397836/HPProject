# 铁腕任务管理器 - CloudBase 集成 Spec

## Why
铁腕任务管理工具需要实现用户认证和数据云端同步功能。通过集成腾讯云开发 CloudBase，实现用户注册/登录、任务数据的增删改查以及跨设备数据同步。

## What Changes
- 创建登录/注册页面 (login.html)
- 集成 CloudBase JavaScript SDK
- 实现用户认证系统（用户名+密码）
- 实现任务数据的云端存储和同步
- 改造 app.html 添加登录状态检查

## Impact
- 新增文件: login.html, cloudbase.js, auth.js
- 修改文件: app.html（添加认证检查）
- 依赖: CloudBase 环境 ID ironhand-8gclol9h5c79d816

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
- `_openid`: 用户唯一标识（CloudBase 自动分配）
- `username`: 用户名
- `password`: 密码（加密存储）
- `createTime`: 注册时间

### 任务集合 (tasks)
- `content`: 任务内容 (String)
- `completed`: 是否完成 (Boolean, 默认 false)
- `quadrant`: 象限 1-4 (Number)
- `_openid`: 关联用户ID (String)
- `createTime`: 创建时间 (Date)
- `updateTime`: 更新时间 (Date)

## Security Rules
```javascript
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```
