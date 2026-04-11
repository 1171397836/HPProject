# 本地任务维护修复 Spec

## Why
当前项目的本地主链路已经可用，但仍存在规则不一致、路径处理分散、批量操作反馈不足，以及遗留入口混杂等维护问题。用户明确要求暂不处理云端相关 P1 问题，优先修复本地可落地问题，并在修复过程中顺带简化代码。

## What Changes
- 统一任务新增与编辑时的内容校验规则，避免通过编辑绕过限制
- 统一页面跳转逻辑，避免登录成功跳转与认证模块的路径解析策略分叉
- 改进本地“清空已完成”流程的结构与反馈，减少重复实现并提升可维护性
- 清理或隔离当前未参与主流程的旧入口与占位脚本，降低误导性
- 在不改变现有本地使用方式的前提下，适度提炼公共逻辑并简化实现

## Impact
- Affected specs: 本地认证流程、本地任务 CRUD、页面导航、一致性交互、代码维护性
- Affected code: viewer01/js/app.js、viewer01/js/login.js、viewer01/js/auth.js、viewer01/js/cloudbase.js、viewer01/index.html、viewer01/js/main.js、viewer01/js/matrix.js、viewer01/js/taskManager.js、viewer01/js/ui.js、viewer01/scripts/smoke-test.mjs

## ADDED Requirements
### Requirement: 统一任务内容校验
系统 SHALL 对新增任务与编辑任务应用同一套内容合法性规则。

#### Scenario: 编辑任务时复用新增规则
- **WHEN** 用户编辑已有任务内容
- **THEN** 系统使用与新增任务相同的非空与长度校验规则

#### Scenario: 非法内容被阻止提交
- **WHEN** 用户提交空内容或超出限制的内容
- **THEN** 系统阻止保存，并给出与现有交互一致的反馈

### Requirement: 统一页面导航入口
系统 SHALL 复用统一的页面跳转与路径解析逻辑处理登录后导航。

#### Scenario: 登录成功后的跳转
- **WHEN** 用户在登录页完成登录或注册后的自动跳转
- **THEN** 系统通过统一导航能力进入 app.html，而不是直接写死路径

### Requirement: 本地批量删除流程可维护
系统 SHALL 以更清晰且可复用的方式执行“清空已完成”操作，并保持当前用户可见行为稳定。

#### Scenario: 清空已完成任务
- **WHEN** 用户确认清空已完成任务
- **THEN** 系统删除当前已完成任务、刷新界面，并维持现有确认与反馈流程

### Requirement: 非主流程代码应明确降噪
系统 SHALL 降低旧入口与占位脚本对维护的干扰。

#### Scenario: 维护者查看前端入口
- **WHEN** 维护者检查当前前端主流程文件
- **THEN** 能清晰识别哪些文件属于正式主路径，哪些文件已废弃或不再参与运行

## MODIFIED Requirements
### Requirement: 本地任务管理一致性
系统 SHALL 在本地模式下对任务新增、编辑、删除、清空已完成等操作保持一致的数据规则、交互路径与反馈方式，并尽量复用公共实现以降低重复逻辑。

## REMOVED Requirements
### Requirement: 无
**Reason**: 本次修复以整理与统一现有本地主链路为主，不移除用户可见能力。
**Migration**: 无
