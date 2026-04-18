/**
 * 抽屉控制器模块
 * 处理抽屉菜单相关逻辑，包括已完成任务列表的展示和交互
 */

import { formatTime, escapeHtml, showLoading } from './uiController.js';

// 抽屉状态
let drawerCallbacks = {};

/**
 * 设置抽屉回调函数
 * @param {Object} callbacks - 回调函数对象
 */
function setDrawerCallbacks(callbacks) {
  drawerCallbacks = { ...drawerCallbacks, ...callbacks };
}

/**
 * 打开抽屉
 */
function openDrawer() {
  document.getElementById('completedDrawer')?.classList.add('show');
  document.getElementById('drawerOverlay')?.classList.add('show');
  document.body.classList.add('drawer-open');
}

/**
 * 关闭抽屉
 */
function closeDrawer() {
  document.getElementById('completedDrawer')?.classList.remove('show');
  document.getElementById('drawerOverlay')?.classList.remove('show');
  document.body.classList.remove('drawer-open');
}

/**
 * 渲染抽屉任务列表
 * @param {Array} tasks - 所有任务列表
 * @param {Object} callbacks - 操作回调函数 { onToggleTask, onDeleteTask }
 */
function renderDrawerTasks(tasks, callbacks = {}) {
  const drawerContent = document.getElementById('drawerContent');
  if (!drawerContent) return;

  const { onToggleTask, onDeleteTask } = callbacks;
  const activeTab = document.querySelector('.drawer-tab.active')?.dataset.tab || 'today';

  const completedTasks = tasks
    .filter(t => t.completed)
    .sort((a, b) => new Date(b.completedAt || b.updatedAt || b.createdAt) - new Date(a.completedAt || a.updatedAt || a.createdAt));

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay() || 7; // Convert Sunday(0) to 7
  startOfWeek.setDate(startOfWeek.getDate() - day + 1);

  const filteredTasks = completedTasks.filter(task => {
    const taskDate = new Date(task.completedAt || task.updatedAt || task.createdAt);
    if (activeTab === 'today') {
      return taskDate >= now;
    } else if (activeTab === 'week') {
      return taskDate >= startOfWeek && taskDate < now;
    } else {
      return taskDate < startOfWeek;
    }
  });

  drawerContent.innerHTML = '';

  if (filteredTasks.length === 0) {
    drawerContent.innerHTML = '<div class="matrix-task-empty">暂无数据</div>';
    return;
  }

  filteredTasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'drawer-task-item';
    item.innerHTML = `
      <div class="drawer-task-check done" title="标记为未完成">✓</div>
      <div class="drawer-task-body">
        <div class="matrix-task-text">${escapeHtml(task.content)}</div>
        <div class="matrix-task-meta">${formatTime(task.updatedAt || task.createdAt)}</div>
      </div>
      <div class="matrix-task-actions">
        <button type="button" class="matrix-action-btn" data-action="delete" title="删除任务">删</button>
      </div>
    `;

    const checkBtn = item.querySelector('.drawer-task-check');
    checkBtn.addEventListener('click', () => {
      if (onToggleTask) {
        onToggleTask(task._id, false);
      }
    });

    const deleteBtn = item.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener('click', () => {
      if (onDeleteTask) {
        onDeleteTask(task._id);
      }
    });

    drawerContent.appendChild(item);
  });
}

/**
 * 切换抽屉标签页
 * @param {string} tabName - 标签页名称
 */
function switchDrawerTab(tabName) {
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
}

/**
 * 获取当前激活的标签页
 * @returns {string} 标签页名称
 */
function getActiveTab() {
  return document.querySelector('.drawer-tab.active')?.dataset.tab || 'today';
}

/**
 * 绑定抽屉相关事件监听器
 * @param {Object} callbacks - 回调函数
 */
function bindDrawerEventListeners(callbacks = {}) {
  const { onRenderTasks, onToggleTask, onDeleteTask } = callbacks;

  // 菜单按钮 - 打开抽屉
  document.getElementById('menuBtn')?.addEventListener('click', () => {
    openDrawer();
    if (onRenderTasks) {
      onRenderTasks();
    }
  });

  // 关闭按钮
  document.getElementById('drawerCloseBtn')?.addEventListener('click', closeDrawer);

  // 遮罩层点击关闭
  document.getElementById('drawerOverlay')?.addEventListener('click', closeDrawer);

  // 标签页切换
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      if (onRenderTasks) {
        onRenderTasks();
      }
    });
  });
}

export {
  bindDrawerEventListeners,
  closeDrawer,
  getActiveTab,
  openDrawer,
  renderDrawerTasks,
  setDrawerCallbacks,
  switchDrawerTab
};

export default {
  openDrawer,
  closeDrawer,
  renderDrawerTasks,
  bindDrawerEventListeners,
  switchDrawerTab,
  getActiveTab,
  setDrawerCallbacks
};
