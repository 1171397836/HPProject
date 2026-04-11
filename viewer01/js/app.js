/**
 * 应用页统一任务逻辑
 * - 与 login 共用 auth.js / cloudbase.js
 * - 本地模式支持注册登录后直接增删改查
 * - 直接渲染四象限矩阵
 */

import { initCloudBase, taskDB } from './cloudbase.js';
import { handleLogout, requireAuth, updateUserDisplay } from './auth.js';

const STORAGE_KEY_QUADRANT = 'tiewan_current_quadrant';
const MAX_TASK_LENGTH = 200;

const QUADRANT_CONFIG = {
  q1: { containerId: 'quadrant-1', label: '立即做', fullName: '重要且紧急', shortCode: 'Q1' },
  q2: { containerId: 'quadrant-2', label: '计划做', fullName: '重要不紧急', shortCode: 'Q2' },
  q3: { containerId: 'quadrant-3', label: '委托做', fullName: '紧急不重要', shortCode: 'Q3' },
  q4: { containerId: 'quadrant-4', label: '不做', fullName: '不重要不紧急', shortCode: 'Q4' }
};

let currentTasks = [];
let currentQuadrant = 'q1';
let currentUser = null;
let isLoading = false;

function getSafeStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function restoreQuadrantSelection() {
  const storage = getSafeStorage();
  const savedQuadrant = storage?.getItem(STORAGE_KEY_QUADRANT);

  if (savedQuadrant && QUADRANT_CONFIG[savedQuadrant]) {
    currentQuadrant = savedQuadrant;
  }
}

function saveQuadrantSelection() {
  const storage = getSafeStorage();
  storage?.setItem(STORAGE_KEY_QUADRANT, currentQuadrant);
}

function groupTasksByQuadrant(tasks) {
  return Object.keys(QUADRANT_CONFIG).reduce((accumulator, quadrant) => {
    const quadrantTasks = tasks
      .filter(task => task.quadrant === quadrant)
      .sort((left, right) => {
        if (left.completed !== right.completed) {
          return Number(left.completed) - Number(right.completed);
        }

        return new Date(right.createdAt) - new Date(left.createdAt);
      });

    accumulator[quadrant] = quadrantTasks;
    return accumulator;
  }, {});
}

function getTaskStats() {
  return {
    total: currentTasks.length,
    completed: currentTasks.filter(task => task.completed).length,
    pending: currentTasks.filter(task => !task.completed).length
  };
}

async function initApp() {
  const userInfo = await requireAuth({ sync: true });
  if (!userInfo) {
    return;
  }

  currentUser = userInfo;
  initCloudBase();
  restoreQuadrantSelection();
  updateUserDisplay('userName', 'userAvatar');
  bindEventListeners();
  updateQuadrantSelectorUI();
  await loadTasks();
}

async function loadTasks() {
  showLoading(true);

  try {
    const result = await taskDB.getTasks();

    if (!result.success) {
      showError(result.error?.message || '获取任务失败');
      return false;
    }

    currentTasks = result.data || [];
    renderTaskMatrix();
    updateHeaderStats();
    return true;
  } catch (error) {
    console.error('[App] 加载任务失败', error);
    showError('加载任务失败，请稍后重试');
    return false;
  } finally {
    showLoading(false);
  }
}

function renderTaskMatrix() {
  if (typeof document === 'undefined') {
    return;
  }

  const buckets = groupTasksByQuadrant(currentTasks);

  Object.entries(QUADRANT_CONFIG).forEach(([quadrant, config]) => {
    const container = document.getElementById(config.containerId);
    if (!container) {
      return;
    }

    container.innerHTML = '';
    const tasks = buckets[quadrant] || [];

    if (tasks.length === 0) {
      const emptyElement = document.createElement('div');
      emptyElement.className = 'matrix-task-empty';
      emptyElement.textContent = `暂无${config.label}任务`;
      container.appendChild(emptyElement);
      return;
    }

    tasks.forEach(task => {
      container.appendChild(createTaskElement(task));
    });
  });

  updateQuadrantSelectorUI();
}

function createTaskElement(task) {
  const taskElement = document.createElement('div');
  taskElement.className = `matrix-task-item ${task.completed ? 'is-completed' : ''}`;
  taskElement.dataset.taskId = task._id;

  taskElement.innerHTML = `
    <button class="matrix-task-check ${task.completed ? 'done' : 'pending'}" type="button" title="${task.completed ? '标记为未完成' : '标记为完成'}">
      ${task.completed ? '✓' : '○'}
    </button>
    <div class="matrix-task-body">
      <div class="matrix-task-text">${escapeHtml(task.content)}</div>
      <div class="matrix-task-meta">${formatTime(task.updatedAt || task.createdAt)}</div>
    </div>
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
    toggleTask(task._id, !task.completed);
  });

  editButton.addEventListener('click', event => {
    event.stopPropagation();
    editTask(task._id);
  });

  deleteButton.addEventListener('click', event => {
    event.stopPropagation();
    deleteTask(task._id);
  });

  return taskElement;
}

async function addTask(content, quadrant = currentQuadrant) {
  const trimmedContent = String(content || '').trim();

  if (!trimmedContent) {
    showError('请输入任务内容');
    return false;
  }

  if (trimmedContent.length > MAX_TASK_LENGTH) {
    showError(`任务内容不能超过${MAX_TASK_LENGTH}个字符`);
    return false;
  }

  showLoading(true);

  try {
    const result = await taskDB.addTask(trimmedContent, quadrant);

    if (!result.success) {
      showError(result.error?.message || '添加任务失败');
      return false;
    }

    currentTasks.unshift(result.data);
    renderTaskMatrix();
    updateHeaderStats();

    const input = document.getElementById('taskInput');
    if (input) {
      input.value = '';
      input.focus();
    }

    showSuccess(`已添加到${QUADRANT_CONFIG[quadrant].label}`);
    return true;
  } finally {
    showLoading(false);
  }
}

async function toggleTask(taskId, completed) {
  const result = await taskDB.updateTask(taskId, completed);

  if (!result.success) {
    showError(result.error?.message || '更新任务状态失败');
    return false;
  }

  currentTasks = currentTasks.map(task => (
    task._id === taskId
      ? { ...task, completed, updatedAt: result.data?.updatedAt || new Date().toISOString() }
      : task
  ));

  renderTaskMatrix();
  updateHeaderStats();
  return true;
}

async function editTask(taskId) {
  const task = currentTasks.find(item => item._id === taskId);
  if (!task) {
    showError('任务不存在');
    return false;
  }

  const nextContent = window.prompt('编辑任务内容', task.content);
  if (nextContent === null) {
    return false;
  }

  const trimmedContent = nextContent.trim();
  if (!trimmedContent) {
    showError('任务内容不能为空');
    return false;
  }

  const nextQuadrant = window.prompt('输入象限编号（q1/q2/q3/q4）', task.quadrant);
  if (nextQuadrant === null) {
    return false;
  }

  const normalizedQuadrant = nextQuadrant.trim().toLowerCase();
  if (!QUADRANT_CONFIG[normalizedQuadrant]) {
    showError('象限编号必须是 q1 / q2 / q3 / q4');
    return false;
  }

  const result = await taskDB.updateTaskContent(taskId, {
    content: trimmedContent,
    quadrant: normalizedQuadrant
  });

  if (!result.success) {
    showError(result.error?.message || '更新任务失败');
    return false;
  }

  currentTasks = currentTasks.map(item => (
    item._id === taskId
      ? {
          ...item,
          content: trimmedContent,
          quadrant: normalizedQuadrant,
          updatedAt: result.data?.updatedAt || new Date().toISOString()
        }
      : item
  ));

  renderTaskMatrix();
  updateHeaderStats();
  showSuccess('任务已更新');
  return true;
}

async function deleteTask(taskId) {
  if (!window.confirm('确定删除这个任务吗？')) {
    return false;
  }

  const result = await taskDB.deleteTask(taskId);

  if (!result.success) {
    showError(result.error?.message || '删除任务失败');
    return false;
  }

  currentTasks = currentTasks.filter(task => task._id !== taskId);
  renderTaskMatrix();
  updateHeaderStats();
  showSuccess('任务已删除');
  return true;
}

async function clearCompleted() {
  const completedCount = currentTasks.filter(task => task.completed).length;

  if (completedCount === 0) {
    showInfo('没有已完成任务');
    return true;
  }

  if (!window.confirm(`确定清空 ${completedCount} 个已完成任务吗？`)) {
    return false;
  }

  showLoading(true);

  try {
    const result = await taskDB.clearCompleted();

    if (!result.success) {
      showError(result.error?.message || '清空已完成任务失败');
      return false;
    }

    currentTasks = currentTasks.filter(task => !task.completed);
    renderTaskMatrix();
    updateHeaderStats();
    showSuccess(`已清空 ${result.deletedCount} 个任务`);
    return true;
  } finally {
    showLoading(false);
  }
}

function setCurrentQuadrant(quadrant) {
  if (!QUADRANT_CONFIG[quadrant]) {
    return;
  }

  currentQuadrant = quadrant;
  saveQuadrantSelection();
  updateQuadrantSelectorUI();
}

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

function updateHeaderStats() {
  const stats = getTaskStats();
  const badge = document.getElementById('questionsBadge');
  const clearButton = document.getElementById('clearBtn');

  if (badge) {
    badge.textContent = `今日剩余 ${stats.pending} 个任务`;
  }

  if (clearButton) {
    clearButton.textContent = stats.completed > 0 ? `清空已完成（${stats.completed}）` : '清空已完成';
  }

  document.title = stats.pending > 0 ? `(${stats.pending}) 铁腕 | 智能任务管理` : '铁腕 | 智能任务管理';
}

function bindEventListeners() {
  document.getElementById('sendBtn')?.addEventListener('click', () => {
    const input = document.getElementById('taskInput');
    addTask(input?.value || '', currentQuadrant);
  });

  document.getElementById('taskInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const input = event.currentTarget;
      addTask(input.value, currentQuadrant);
    }
  });

  document.getElementById('taskInput')?.addEventListener('input', event => {
    const input = event.currentTarget;
    if (input.value.length > MAX_TASK_LENGTH) {
      input.value = input.value.slice(0, MAX_TASK_LENGTH);
      showInfo(`任务内容已限制在 ${MAX_TASK_LENGTH} 字以内`);
    }
  });

  document.getElementById('taskTypeBtn')?.addEventListener('click', () => {
    const quadrants = Object.keys(QUADRANT_CONFIG);
    const currentIndex = quadrants.indexOf(currentQuadrant);
    const nextQuadrant = quadrants[(currentIndex + 1) % quadrants.length];
    setCurrentQuadrant(nextQuadrant);
  });

  document.getElementById('clearBtn')?.addEventListener('click', clearCompleted);
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (window.confirm('确定要退出登录吗？')) {
      await handleLogout();
    }
  });

  document.querySelectorAll('.quadrant').forEach(element => {
    element.addEventListener('click', () => {
      setCurrentQuadrant(element.dataset.quadrant);
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUser) {
      loadTasks();
    }
  });
}

function showLoading(loading) {
  isLoading = loading;
  document.body.classList.toggle('app-loading', loading);
}

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

function showError(message) {
  showToast(message, 'error');
}

function showSuccess(message) {
  showToast(message, 'success');
}

function showInfo(message) {
  showToast(message, 'info');
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initApp);
}

export {
  QUADRANT_CONFIG,
  addTask,
  clearCompleted,
  currentQuadrant,
  currentTasks,
  deleteTask,
  editTask,
  formatTime,
  groupTasksByQuadrant,
  initApp,
  loadTasks,
  showToast,
  toggleTask
};

export default {
  initApp,
  loadTasks,
  addTask,
  toggleTask,
  editTask,
  deleteTask,
  clearCompleted
};
