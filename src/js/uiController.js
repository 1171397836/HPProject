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
    container.style.top = '80px';
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
  const { onToggle, onEdit, onDelete, onDragEnd } = callbacks;
  const hasNotes = task.notes && String(task.notes).trim().length > 0;

  const taskElement = document.createElement('div');
  taskElement.className = `matrix-task-item ${task.completed ? 'is-completed' : ''}`;
  taskElement.dataset.taskId = task._id;
  taskElement.dataset.quadrant = task.quadrant;
  taskElement.draggable = true;

  // 构建任务内容HTML
  let notesHtml = '';
  if (hasNotes) {
    notesHtml = `
      <div class="matrix-task-notes" style="display: none; margin-top: 4px; padding-left: 24px; font-size: 12px; color: #6b7280; line-height: 1.4;">
        ${escapeHtml(task.notes)}
      </div>
    `;
  }

  taskElement.innerHTML = `
    <button class="matrix-task-check ${task.completed ? 'done' : 'pending'}" type="button" title="${task.completed ? '标记为未完成' : '标记为完成'}">
      ${task.completed ? '✓' : '○'}
    </button>
    <div class="matrix-task-content" style="flex: 1; min-width: 0;">
      <div class="matrix-task-text" style="display: flex; align-items: center; gap: 6px;">
        ${escapeHtml(task.content)}
        ${hasNotes ? `<span class="matrix-task-notes-icon" style="cursor: pointer; font-size: 14px; user-select: none;" title="点击查看备注">💬</span>` : ''}
      </div>
      ${notesHtml}
    </div>
    <div class="matrix-task-actions">
      <button type="button" class="matrix-action-btn matrix-action-delete" data-action="delete" title="删除任务">×</button>
    </div>
  `;

  const checkbox = taskElement.querySelector('.matrix-task-check');
  const deleteButton = taskElement.querySelector('[data-action="delete"]');
  const notesIcon = taskElement.querySelector('.matrix-task-notes-icon');
  const notesContent = taskElement.querySelector('.matrix-task-notes');

  // 拖拽状态标记
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  // 复选框点击事件
  checkbox.addEventListener('click', event => {
    event.stopPropagation();
    if (onToggle) {
      onToggle(task._id, !task.completed, taskElement, checkbox);
    }
  });

  // 删除按钮点击事件
  deleteButton.addEventListener('click', async event => {
    event.stopPropagation();
    if (onDelete) {
      await onDelete(task._id);
    }
  });

  // 备注图标点击事件 - 展开/收起备注
  if (notesIcon && notesContent) {
    notesIcon.addEventListener('click', event => {
      event.stopPropagation();
      const isVisible = notesContent.style.display !== 'none';
      notesContent.style.display = isVisible ? 'none' : 'block';
      notesIcon.title = isVisible ? '点击查看备注' : '点击收起备注';
    });
  }

  // 卡片点击事件 - 编辑任务（排除复选框、删除按钮、备注图标）
  taskElement.addEventListener('click', async event => {
    // 如果正在拖拽，不触发编辑
    if (isDragging) {
      return;
    }
    // 检查点击目标是否在排除元素内
    if (event.target.closest('.matrix-task-check') ||
        event.target.closest('.matrix-action-btn') ||
        event.target.closest('.matrix-task-notes-icon')) {
      return;
    }
    if (onEdit) {
      await onEdit(task._id);
    }
  });

  // 拖拽事件
  taskElement.addEventListener('dragstart', event => {
    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    taskElement.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task._id);
    // 延迟添加半透明效果，避免拖拽预览图也半透明
    setTimeout(() => {
      taskElement.classList.add('dragging-ghost');
    }, 0);
  });

  taskElement.addEventListener('dragend', () => {
    taskElement.classList.remove('dragging', 'dragging-ghost');
    // 清除所有象限的高亮
    document.querySelectorAll('.quadrant').forEach(quadrant => {
      quadrant.classList.remove('drag-over');
    });
    // 延迟重置拖拽状态，避免点击事件被触发
    setTimeout(() => {
      isDragging = false;
    }, 100);
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

  const { onDragEnd } = callbacks;

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

  // 为象限容器添加拖拽事件
  setupQuadrantDragEvents(onDragEnd);

  updateQuadrantSelectorUI();
}

// 用于存储拖拽事件处理函数的 WeakMap，避免内存泄漏
const dragEventHandlers = new WeakMap();

/**
 * 设置象限容器的拖拽事件
 * @param {Function} onDragEnd - 拖拽完成回调
 */
function setupQuadrantDragEvents(onDragEnd) {
  document.querySelectorAll('.quadrant').forEach(quadrant => {
    const quadrantId = quadrant.dataset.quadrant;
    if (!quadrantId) return;

    // 如果已经绑定过事件，先移除旧的事件监听器
    const existingHandlers = dragEventHandlers.get(quadrant);
    if (existingHandlers) {
      quadrant.removeEventListener('dragover', existingHandlers.dragover);
      quadrant.removeEventListener('dragleave', existingHandlers.dragleave);
      quadrant.removeEventListener('drop', existingHandlers.drop);
    }

    // 创建新的事件处理函数
    const dragoverHandler = event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      quadrant.classList.add('drag-over');
    };

    const dragleaveHandler = event => {
      // 只有当离开象限本身时才移除高亮（不是子元素）
      if (!quadrant.contains(event.relatedTarget)) {
        quadrant.classList.remove('drag-over');
      }
    };

    const dropHandler = async event => {
      event.preventDefault();
      quadrant.classList.remove('drag-over');

      const taskId = event.dataTransfer.getData('text/plain');
      if (!taskId || !onDragEnd) return;

      // 找到拖拽的任务元素
      const draggedElement = document.querySelector(`[data-task-id="${taskId}"]`);
      if (!draggedElement) return;

      const sourceQuadrant = draggedElement.dataset.quadrant;
      // 如果拖拽到相同象限，不执行操作
      if (sourceQuadrant === quadrantId) return;

      // 调用回调更新任务象限
      await onDragEnd(taskId, quadrantId);
    };

    // 绑定新的事件监听器
    quadrant.addEventListener('dragover', dragoverHandler);
    quadrant.addEventListener('dragleave', dragleaveHandler);
    quadrant.addEventListener('drop', dropHandler);

    // 存储处理函数引用，以便下次移除
    dragEventHandlers.set(quadrant, {
      dragover: dragoverHandler,
      dragleave: dragleaveHandler,
      drop: dropHandler
    });
  });
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
  setupQuadrantDragEvents,
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
  saveQuadrantSelection,
  setupQuadrantDragEvents
};
