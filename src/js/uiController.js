/**
 * UI 控制器模块
 * 处理 UI 更新、Toast 提示、象限选择等界面相关逻辑
 */

import CONFIG from './config.js';

const STORAGE_KEY_QUADRANT = CONFIG.STORAGE_KEYS.CURRENT_QUADRANT;

// 象限配置
const QUADRANT_CONFIG = {
  q1: { containerId: 'quadrant-1', label: '立即做', fullName: '重要且紧急', shortCode: 'Q1' },
  q2: { containerId: 'quadrant-2', label: '计划做', fullName: '重要不紧急', shortCode: 'Q2' },
  q3: { containerId: 'quadrant-3', label: '委托做', fullName: '紧急不重要', shortCode: 'Q3' },
  q4: { containerId: 'quadrant-4', label: '不做', fullName: '不重要不紧急', shortCode: 'Q4' }
};

// 状态
let currentQuadrant = 'q1';
let isLoading = false;

/**
 * 获取当前象限
 * @returns {string} 当前象限
 */
function getCurrentQuadrant() {
  return currentQuadrant;
}

/**
 * 设置当前象限
 * @param {string} quadrant - 象限标识
 */
function setCurrentQuadrant(quadrant) {
  if (!QUADRANT_CONFIG[quadrant]) {
    return;
  }
  currentQuadrant = quadrant;
}

/**
 * 获取安全的 localStorage 引用
 * @returns {Storage|null}
 */
function getSafeStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

/**
 * 获取象限存储键
 * @param {Object} currentUser - 当前用户
 * @returns {string} 存储键
 */
function getQuadrantStorageKey(currentUser) {
  if (currentUser && currentUser.uid) {
    return `${STORAGE_KEY_QUADRANT}_${currentUser.uid}`;
  }
  return STORAGE_KEY_QUADRANT;
}

/**
 * 恢复象限选择
 * @param {Object} currentUser - 当前用户
 */
function restoreQuadrantSelection(currentUser) {
  const storage = getSafeStorage();
  const savedQuadrant = storage?.getItem(getQuadrantStorageKey(currentUser));

  if (savedQuadrant && QUADRANT_CONFIG[savedQuadrant]) {
    currentQuadrant = savedQuadrant;
  }
}

/**
 * 保存象限选择
 * @param {Object} currentUser - 当前用户
 */
function saveQuadrantSelection(currentUser) {
  const storage = getSafeStorage();
  storage?.setItem(getQuadrantStorageKey(currentUser), currentQuadrant);
}

/**
 * 设置加载状态
 * @param {boolean} loading - 是否加载中
 */
function showLoading(loading) {
  isLoading = loading;
  document.body.classList.toggle('app-loading', loading);
}

/**
 * 获取加载状态
 * @returns {boolean}
 */
function getIsLoading() {
  return isLoading;
}

/**
 * 显示 Toast 提示
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (success/error/info/warning)
 */
function showToast(message, type = 'info') {
  if (typeof document === 'undefined') {
    return;
  }

  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.position = 'fixed';
    container.style.top = '16px';
    container.style.right = '16px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);
  }

  const palette = {
    success: '#16a34a',
    error: '#dc2626',
    info: '#2563eb',
    warning: '#d97706'
  };

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.background = palette[type] || palette.info;
  toast.style.color = '#fff';
  toast.style.padding = '10px 14px';
  toast.style.borderRadius = '10px';
  toast.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
  toast.style.fontSize = '12px';
  toast.style.maxWidth = '260px';
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2500);
}

/**
 * 显示错误提示
 * @param {string} message - 错误消息
 */
function showError(message) {
  showToast(message, 'error');
}

/**
 * 显示成功提示
 * @param {string} message - 成功消息
 */
function showSuccess(message) {
  showToast(message, 'success');
}

/**
 * 显示信息提示
 * @param {string} message - 信息消息
 */
function showInfo(message) {
  showToast(message, 'info');
}

/**
 * 格式化时间
 * @param {string|number} timestamp - 时间戳
 * @returns {string} 格式化后的时间
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  if (isToday) {
    return `今天 ${hour}:${minute}`;
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${hour}:${minute}`;
}

/**
 * HTML 转义
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 更新象限选择器 UI
 */
function updateQuadrantSelectorUI() {
  const taskTypeButton = document.getElementById('taskTypeBtn');
  const taskInput = document.getElementById('taskInput');

  if (taskTypeButton) {
    taskTypeButton.textContent = QUADRANT_CONFIG[currentQuadrant].shortCode;
    taskTypeButton.title = `当前新增到${QUADRANT_CONFIG[currentQuadrant].fullName}，点击切换`;
  }

  if (taskInput) {
    taskInput.placeholder = `添加${QUADRANT_CONFIG[currentQuadrant].label}任务，例如：下午3点开会...`;
  }

  document.querySelectorAll('.quadrant').forEach(element => {
    element.classList.toggle('quadrant-selected', element.dataset.quadrant === currentQuadrant);
  });
}

/**
 * 更新头部统计信息
 * @param {number} pendingCount - 待办任务数
 */
function updateHeaderStats(pendingCount) {
  const badge = document.getElementById('questionsBadge');

  if (badge) {
    badge.textContent = `今日剩余 ${pendingCount} 个任务`;
  }

  document.title = pendingCount > 0 ? `(${pendingCount}) 铁腕 | 智能任务管理` : '铁腕 | 智能任务管理';
}

/**
 * 创建任务元素
 * @param {Object} task - 任务对象
 * @param {Object} callbacks - 回调函数
 * @returns {HTMLElement} 任务元素
 */
function createTaskElement(task, callbacks = {}) {
  const { onToggle, onEdit, onDelete } = callbacks;

  const taskElement = document.createElement('div');
  taskElement.className = `matrix-task-item ${task.completed ? 'is-completed' : ''}`;
  taskElement.dataset.taskId = task._id;

  taskElement.innerHTML = `
    <button class="matrix-task-check ${task.completed ? 'done' : 'pending'}" type="button" title="${task.completed ? '标记为未完成' : '标记为完成'}">
      ${task.completed ? '✓' : '○'}
    </button>
    <div class="matrix-task-text">${escapeHtml(task.content)}</div>
    <div class="matrix-task-actions">
      <button type="button" class="matrix-action-btn" data-action="edit" title="编辑任务">编</button>
      <button type="button" class="matrix-action-btn" data-action="delete" title="删除任务">删</button>
    </div>
  `;

  const checkbox = taskElement.querySelector('.matrix-task-check');
  const editButton = taskElement.querySelector('[data-action="edit"]');
  const deleteButton = taskElement.querySelector('[data-action="delete"]');

  checkbox.addEventListener('click', event => {
    event.stopPropagation();
    if (onToggle) {
      onToggle(task._id, !task.completed, taskElement, checkbox);
    }
  });

  editButton.addEventListener('click', async event => {
    event.stopPropagation();
    if (onEdit) {
      await onEdit(task._id);
    }
  });

  deleteButton.addEventListener('click', async event => {
    event.stopPropagation();
    if (onDelete) {
      await onDelete(task._id);
    }
  });

  return taskElement;
}

/**
 * 渲染任务矩阵
 * @param {Array} tasks - 任务列表
 * @param {Object} callbacks - 回调函数
 */
function renderTaskMatrix(tasks, callbacks = {}) {
  if (typeof document === 'undefined') {
    return;
  }

  // 按象限分组
  const buckets = Object.keys(QUADRANT_CONFIG).reduce((accumulator, quadrant) => {
    const quadrantTasks = tasks
      .filter(task => task.quadrant === quadrant && !task.completed)
      .sort((left, right) => {
        return new Date(right.createdAt) - new Date(left.createdAt);
      });

    accumulator[quadrant] = quadrantTasks;
    return accumulator;
  }, {});

  Object.entries(QUADRANT_CONFIG).forEach(([quadrant, config]) => {
    const container = document.getElementById(config.containerId);
    if (!container) {
      return;
    }

    container.innerHTML = '';
    const quadrantTasks = buckets[quadrant] || [];

    if (quadrantTasks.length === 0) {
      const emptyElement = document.createElement('div');
      emptyElement.className = 'matrix-task-empty';
      emptyElement.textContent = `暂无${config.label}任务`;
      container.appendChild(emptyElement);
      return;
    }

    quadrantTasks.forEach(task => {
      container.appendChild(createTaskElement(task, callbacks));
    });
  });

  updateQuadrantSelectorUI();
}

export {
  QUADRANT_CONFIG,
  createTaskElement,
  escapeHtml,
  formatTime,
  getCurrentQuadrant,
  getIsLoading,
  getQuadrantStorageKey,
  getSafeStorage,
  renderTaskMatrix,
  restoreQuadrantSelection,
  saveQuadrantSelection,
  setCurrentQuadrant,
  showError,
  showInfo,
  showLoading,
  showSuccess,
  showToast,
  updateHeaderStats,
  updateQuadrantSelectorUI
};

export default {
  QUADRANT_CONFIG,
  renderTaskMatrix,
  createTaskElement,
  showToast,
  showError,
  showSuccess,
  showInfo,
  showLoading,
  updateHeaderStats,
  updateQuadrantSelectorUI,
  formatTime,
  escapeHtml,
  getCurrentQuadrant,
  setCurrentQuadrant,
  restoreQuadrantSelection,
  saveQuadrantSelection
};
