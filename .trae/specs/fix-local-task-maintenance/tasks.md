# Tasks

- [x] Task 1: 统一任务内容校验
  - [x] SubTask 1.1: 梳理新增任务与编辑任务当前校验入口
  - [x] SubTask 1.2: 提炼或下沉统一校验逻辑
  - [x] SubTask 1.3: 确保新增与编辑在非法输入下反馈一致

- [x] Task 2: 统一登录成功后的导航逻辑
  - [x] SubTask 2.1: 梳理 login.js 与 auth.js 当前跳转实现
  - [x] SubTask 2.2: 复用统一导航能力替换直接路径跳转
  - [x] SubTask 2.3: 验证登录页与应用页在本地访问下跳转正常

- [x] Task 3: 简化本地“清空已完成”实现
  - [x] SubTask 3.1: 梳理 app.js 与 cloudbase.js 中清空逻辑的职责边界
  - [x] SubTask 3.2: 在不处理云端 P1 的前提下简化本地流程与反馈
  - [x] SubTask 3.3: 验证删除后列表与计数展示正确

- [x] Task 4: 降噪非主流程入口与占位脚本
  - [x] SubTask 4.1: 确认旧入口与占位脚本的实际引用情况
  - [x] SubTask 4.2: 通过最小改动清晰表达其非主流程定位
  - [x] SubTask 4.3: 避免影响当前 login.html 与 app.html 主链路

- [x] Task 5: 完成回归验证
  - [x] SubTask 5.1: 运行现有本地冒烟测试
  - [x] SubTask 5.2: 补充验证新增、编辑、删除、清空、登录跳转关键路径
  - [x] SubTask 5.3: 检查静态诊断，确认未引入新错误

# Task Dependencies

- Task 2 依赖 Task 1 仅限共享校验逻辑时的接口稳定；否则可并行推进
- Task 3 依赖当前任务数据结构不变
- Task 4 应在主流程验证清晰后进行，避免误删有效引用
- Task 5 依赖 Task 1、Task 2、Task 3、Task 4
