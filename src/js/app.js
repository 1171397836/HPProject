/**
 * 应用页统一任务逻辑
 * - 与 login 共用 auth.js / storage.js
 * - 本地模式支持注册登录后直接增删改查
 * - 直接渲染四象限矩阵
 * - 新增 AI 助手功能
 */

import { MAX_TASK_LENGTH, MAX_AI_MESSAGE_LENGTH } from './storage.js';
import { handleLogout, requireAuth, updateUserDisplay } from './auth.js';
import { checkIsAdmin } from './invitationService.js';

// 导入控制器模块
import {
  addTask,
  deleteTask,
  editTask,
  getCurrentTasks,
  getTaskStats,
  loadTasks,
  moveTask,
  runConfirmedAction,
  setCurrentTasks,
  toggleTask
} from './taskController.js';

import {
  QUADRANT_CONFIG,
  getCurrentQuadrant,
  renderTaskMatrix,
  restoreQuadrantSelection,
  saveQuadrantSelection,
  setCurrentQuadrant,
  showError,
  showInfo,
  showLoading,
  showSuccess,
  updateHeaderStats,
  updateQuadrantSelectorUI
} from './uiController.js';

import {
  bindDrawerEventListeners,
  renderDrawerTasks
} from './drawerController.js';

import {
  bindAIEventListeners,
  getIsAIMode,
  initAIChat,
  initAIConfig,
  setCurrentTasks as setAITasks,
  setCurrentUser as setAIUser
} from './aiController.js';

let currentUser = null;
let isLogoutSubmitting = false;

/**
 * 初始化应用
 */
async function initApp() {
  const userInfo = await requireAuth({ sync: true });
  if (!userInfo) {
    return;
  }

  currentUser = userInfo;

  // 恢复象限选择
  restoreQuadrantSelection(currentUser);

  // 更新用户显示
  updateUserDisplay('userName', 'userAvatar');

  // 检查管理员权限并显示/隐藏邀请码管理按钮
  await checkAndShowAdminMenu();

  // 绑定事件监听器
  bindEventListeners();

  // 初始化 AI 配置
  await initAIConfig();

  // 设置 AI 控制器状态
  setAIUser(currentUser);

  // 加载任务
  await refreshTasks();

  // 初始化 AI 聊天
  initAIChat();
}

/**
 * 检查管理员权限并显示邀请码管理菜单
 */
async function checkAndShowAdminMenu() {
  try {
    const { isAdmin } = await checkIsAdmin();
    const invitationBtn = document.getElementById('drawerInvitationBtn');
    if (invitationBtn && isAdmin) {
      invitationBtn.style.display = 'flex';
    }
  } catch (err) {
    console.error('[App] 检查管理员权限失败:', err);
  }
}

/**
 * 刷新任务列表
 */
async function refreshTasks() {
  showLoading(true);

  try {
    const success = await loadTasks();
    if (success) {
      const tasks = getCurrentTasks();
      setAITasks(tasks);
      renderTaskMatrix(tasks, {
        onToggle: handleToggleTask,
        onEdit: handleEditTask,
        onDelete: handleDeleteTask,
        onDragEnd: handleDragEnd
      });
      renderDrawerTasks(tasks, {
        onToggleTask: handleToggleTask,
        onDeleteTask: handleDeleteTask
      });
      updateHeaderStats(getTaskStats().pending);
    }
  } catch (error) {
    console.error('[App] 刷新任务失败', error);
    showError('加载任务失败，请稍后重试');
  } finally {
    showLoading(false);
  }
}

/**
 * 统一刷新 UI 界面
 * 更新任务矩阵、抽屉任务、AI 任务状态和头部统计
 * @param {Object} options - 配置选项
 * @param {boolean} options.updateAITasks - 是否更新 AI 任务状态，默认为 true
 * @param {boolean} options.updateCurrentTasks - 是否更新当前任务状态，默认为 false
 */
function refreshUI(options = {}) {
  const { updateAITasks = true, updateCurrentTasks = false } = options;
  const tasks = getCurrentTasks();

  if (updateAITasks) {
    setAITasks(tasks);
  }
  if (updateCurrentTasks) {
    setCurrentTasks(tasks);
  }

  renderTaskMatrix(tasks, {
    onToggle: handleToggleTask,
    onEdit: handleEditTask,
    onDelete: handleDeleteTask,
    onDragEnd: handleDragEnd
  });
  renderDrawerTasks(tasks, {
    onToggleTask: handleToggleTask,
    onDeleteTask: handleDeleteTask
  });
  updateHeaderStats(getTaskStats().pending);
}

/**
 * 处理任务切换完成状态
 */
async function handleToggleTask(taskId, completed, taskElement, triggerElement) {
  const success = await toggleTask(taskId, completed, taskElement, triggerElement);
  if (success) {
    refreshUI({ updateAITasks: true });
  }
}

/**
 * 处理编辑任务
 */
async function handleEditTask(taskId) {
  const success = await editTask(taskId, { defaultQuadrant: getCurrentQuadrant() });
  if (success) {
    refreshUI({ updateAITasks: true });
  }
}

/**
 * 处理删除任务
 */
async function handleDeleteTask(taskId) {
  const success = await deleteTask(taskId);
  if (success) {
    refreshUI({ updateAITasks: true, updateCurrentTasks: true });
  }
}

/**
 * 处理拖拽移动任务
 */
async function handleDragEnd(taskId, targetQuadrant) {
  const success = await moveTask(taskId, targetQuadrant);
  if (success) {
    refreshUI({ updateAITasks: true });
  }
}

/**
 * 处理添加任务
 */
async function handleAddTask() {
  if (getIsAIMode()) return;

  const input = document.getElementById('taskInput');
  const content = input?.value || '';
  const quadrant = getCurrentQuadrant();

  const success = await addTask(content, quadrant);
  if (success) {
    refreshUI({ updateAITasks: true, updateCurrentTasks: true });

    // 清空输入框并聚焦
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

/**
 * 设置当前象限
 */
function setQuadrant(quadrant) {
  if (!QUADRANT_CONFIG[quadrant]) {
    return;
  }

  setCurrentQuadrant(quadrant);
  saveQuadrantSelection(currentUser);
  updateQuadrantSelectorUI();
}

/**
 * 绑定事件监听器
 */
function bindEventListeners() {
  // 发送按钮
  document.getElementById('sendBtn')?.addEventListener('click', handleAddTask);

  // 输入框回车事件
  document.getElementById('taskInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (getIsAIMode()) return;
      handleAddTask();
    }
  });

  // 输入框长度限制 - 根据当前模式动态调整
  document.getElementById('taskInput')?.addEventListener('input', event => {
    const input = event.currentTarget;
    const isAIMode = getIsAIMode();
    const maxLength = isAIMode ? MAX_AI_MESSAGE_LENGTH : MAX_TASK_LENGTH;
    const contentType = isAIMode ? 'AI 消息' : '任务内容';

    if (input.value.length > maxLength) {
      input.value = input.value.slice(0, maxLength);
      showInfo(`${contentType}已限制在 ${maxLength} 字以内`);
    }
  });

  // 任务类型切换按钮
  document.getElementById('taskTypeBtn')?.addEventListener('click', () => {
    const quadrants = Object.keys(QUADRANT_CONFIG);
    const currentQ = getCurrentQuadrant();
    const currentIndex = quadrants.indexOf(currentQ);
    const nextQuadrant = quadrants[(currentIndex + 1) % quadrants.length];
    setQuadrant(nextQuadrant);
  });

  // 登出按钮
  document.getElementById('logoutBtn')?.addEventListener('click', async event => {
    await confirmBeforeLogout({ triggerElement: event.currentTarget });
  });

  // 绑定抽屉事件
  bindDrawerEventListeners({
    onRenderTasks: () => {
      const tasks = getCurrentTasks();
      renderDrawerTasks(tasks, {
        onToggleTask: handleToggleTask,
        onDeleteTask: handleDeleteTask
      });
    }
  });

  // 绑定 AI 事件
  bindAIEventListeners();

  // 绑定邀请码管理按钮点击事件
  document.getElementById('drawerInvitationBtn')?.addEventListener('click', () => {
    window.location.href = 'admin.html';
  });

  // 象限点击切换
  document.querySelectorAll('.quadrant').forEach(element => {
    element.addEventListener('click', () => {
      setQuadrant(element.dataset.quadrant);
    });
  });

  // 页面可见性变化时刷新任务
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUser) {
      refreshTasks();
    }
  });
}

/**
 * 确认登出
 */
async function confirmBeforeLogout(options = {}) {
  const {
    message = '确定要退出登录吗？',
    confirmFn = null,
    logoutFn = handleLogout,
    triggerElement = null
  } = options;

  return runConfirmedAction({
    title: '退出确认',
    message,
    confirmText: '退出',
    confirmFn,
    actionFn: logoutFn,
    guard: () => {
      if (!isLogoutSubmitting) {
        return null;
      }

      return {
        success: false,
        ignored: true
      };
    },
    beforeAction: () => {
      isLogoutSubmitting = true;

      if (triggerElement) {
        triggerElement.disabled = true;
      }
    },
    afterAction: () => {
      isLogoutSubmitting = false;

      if (triggerElement) {
        triggerElement.disabled = false;
      }
    }
  });
}

// DOM 加载完成后初始化
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initApp);
}

// 导出 API
export {
  QUADRANT_CONFIG,
  confirmBeforeLogout,
  getCurrentQuadrant,
  getCurrentTasks,
  getTaskStats,
  initApp,
  refreshTasks,
  setQuadrant
};

export default {
  initApp,
  refreshTasks
};
