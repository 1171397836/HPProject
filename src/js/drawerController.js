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
 * 获取日期所在周的周一日期
 * @param {Date} date - 输入日期
 * @returns {Date} 该周的周一日期（零点）
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay() || 7; // 周日转为7
  d.setDate(d.getDate() - dayOfWeek + 1);
  return d;
}

/**
 * 获取ISO周数
 * @param {Date} date - 输入日期
 * @returns {number} 周数
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // 设为该年1月4日（ISO周定义：包含1月4日的周为第1周）
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const mondayOfJan4 = getMondayOfWeek(jan4);
  const diff = d.getTime() - mondayOfJan4.getTime();
  return Math.round(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/**
 * 将历史任务按年→月→周三级分组
 * @param {Array} tasks - 已过滤的历史任务列表
 * @returns {Object} 三级树形结构 { yearKey: { year, months: { monthKey: { month, weeks: { weekKey: { weekNum, startDate, endDate, tasks: [] } } } } } }
 */
function groupTasksByYearMonthWeek(tasks) {
  const tree = {};

  tasks.forEach(task => {
    const completedDate = new Date(task.completedAt || task.updatedAt || task.createdAt);
    const monday = getMondayOfWeek(completedDate);

    // 跨月周按周一所在月份分配
    const year = monday.getFullYear();
    const month = monday.getMonth() + 1; // 1-12
    const weekNum = getWeekNumber(monday);

    const yearKey = String(year);
    const monthKey = String(month);
    // 周key用周一的日期字符串，保证唯一
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

    if (!tree[yearKey]) {
      tree[yearKey] = { year, months: {} };
    }
    if (!tree[yearKey].months[monthKey]) {
      tree[yearKey].months[monthKey] = { month, weeks: {} };
    }
    if (!tree[yearKey].months[monthKey].weeks[weekKey]) {
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      tree[yearKey].months[monthKey].weeks[weekKey] = {
        weekNum,
        startDate: monday,
        endDate: sunday,
        tasks: []
      };
    }
    tree[yearKey].months[monthKey].weeks[weekKey].tasks.push(task);
  });

  return tree;
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

  // history Tab 使用三级折叠渲染
  if (activeTab === 'history') {
    renderHistoryCollapsible(drawerContent, filteredTasks, onToggleTask, onDeleteTask);
    return;
  }

  // today 和 week Tab 保持平铺渲染
  filteredTasks.forEach(task => {
    const item = createTaskItemElement(task, onToggleTask, onDeleteTask);
    drawerContent.appendChild(item);
  });
}

/**
 * 创建单个任务项 DOM 元素
 * @param {Object} task - 任务对象
 * @param {Function} onToggleTask - 切换完成状态回调
 * @param {Function} onDeleteTask - 删除任务回调
 * @returns {HTMLElement} 任务项元素
 */
function createTaskItemElement(task, onToggleTask, onDeleteTask) {
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

  return item;
}

/**
 * 渲染历史已完成的三级折叠结构
 * @param {HTMLElement} container - 容器元素
 * @param {Array} tasks - 已过滤的历史任务列表
 * @param {Function} onToggleTask - 切换完成状态回调
 * @param {Function} onDeleteTask - 删除任务回调
 */
function renderHistoryCollapsible(container, tasks, onToggleTask, onDeleteTask) {
  const tree = groupTasksByYearMonthWeek(tasks);

  // 找到最近一周的key，用于默认展开
  const latestWeekKey = findLatestWeekKey(tree);

  // 年份降序
  const yearKeys = Object.keys(tree).sort((a, b) => Number(b) - Number(a));

  yearKeys.forEach(yearKey => {
    const yearData = tree[yearKey];
    const isLatestYear = latestWeekKey && latestWeekKey.yearKey === yearKey;

    const yearGroup = createCollapseGroup('year', `${yearKey}年`, yearData, isLatestYear, (countAllTasksInYear(yearData)), () => {
      // 月份降序
      const monthKeys = Object.keys(yearData.months).sort((a, b) => Number(b) - Number(a));
      return monthKeys.map(monthKey => {
        const monthData = yearData.months[monthKey];
        const isLatestMonth = isLatestYear && latestWeekKey.monthKey === monthKey;

        const monthGroup = createCollapseGroup('month', `${monthKey}月`, monthData, isLatestMonth, countAllTasksInMonth(monthData), () => {
          // 周降序（按周一日期降序）
          const weekKeys = Object.keys(monthData.weeks).sort((a, b) => b.localeCompare(a));
          return weekKeys.map(weekKey => {
            const weekData = monthData.weeks[weekKey];
            const isLatestWeek = isLatestMonth && latestWeekKey.weekKey === weekKey;

            const startM = weekData.startDate.getMonth() + 1;
            const startD = weekData.startDate.getDate();
            const endM = weekData.endDate.getMonth() + 1;
            const endD = weekData.endDate.getDate();
            const label = `第${weekData.weekNum}周 ${startM}/${startD} - ${endM}/${endD}`;

            const weekGroup = createCollapseGroup('week', label, weekData, isLatestWeek, weekData.tasks.length, () => {
              // 叶子节点：渲染任务列表
              const fragment = document.createDocumentFragment();
              weekData.tasks.forEach(task => {
                fragment.appendChild(createTaskItemElement(task, onToggleTask, onDeleteTask));
              });
              return fragment;
            });

            return weekGroup;
          });
        });

        return monthGroup;
      });
    });

    container.appendChild(yearGroup);
  });
}

/**
 * 找到最近一周的key信息，用于默认展开
 * @param {Object} tree - 三级树形结构
 * @returns {Object|null} { yearKey, monthKey, weekKey }
 */
function findLatestWeekKey(tree) {
  let latest = null;
  let latestTime = -1;

  for (const yearKey in tree) {
    for (const monthKey in tree[yearKey].months) {
      for (const weekKey in tree[yearKey].months[monthKey].weeks) {
        const weekData = tree[yearKey].months[monthKey].weeks[weekKey];
        const weekStart = weekData.startDate.getTime();
        if (weekStart > latestTime) {
          latestTime = weekStart;
          latest = { yearKey, monthKey, weekKey };
        }
      }
    }
  }

  return latest;
}

/**
 * 统计年份下所有任务数
 * @param {Object} yearData - 年份数据
 * @returns {number} 任务总数
 */
function countAllTasksInYear(yearData) {
  let count = 0;
  for (const monthKey in yearData.months) {
    count += countAllTasksInMonth(yearData.months[monthKey]);
  }
  return count;
}

/**
 * 统计月份下所有任务数
 * @param {Object} monthData - 月份数据
 * @returns {number} 任务总数
 */
function countAllTasksInMonth(monthData) {
  let count = 0;
  for (const weekKey in monthData.weeks) {
    count += monthData.weeks[weekKey].tasks.length;
  }
  return count;
}

/**
 * 创建折叠组 DOM 元素
 * @param {string} level - 层级 'year' | 'month' | 'week'
 * @param {string} label - 标题文本
 * @param {Object} data - 该层级的数据
 * @param {boolean} isDefaultExpanded - 是否默认展开
 * @param {number} taskCount - 该分组下的任务数量
 * @param {Function} renderChildren - 渲染子内容的函数，返回 HTMLElement 或 DocumentFragment
 * @returns {HTMLElement} 折叠组元素
 */
function createCollapseGroup(level, label, data, isDefaultExpanded, taskCount, renderChildren) {
  const group = document.createElement('div');
  group.className = 'drawer-collapse-group';

  const header = document.createElement('div');
  header.className = 'drawer-collapse-header';
  header.dataset.level = level;

  const arrow = document.createElement('span');
  arrow.className = 'drawer-collapse-arrow';
  arrow.textContent = '▶';

  const title = document.createElement('span');
  title.className = 'drawer-collapse-title';
  title.textContent = label;

  const count = document.createElement('span');
  count.className = 'drawer-collapse-count';
  count.textContent = taskCount;

  header.appendChild(arrow);
  header.appendChild(title);
  header.appendChild(count);

  const body = document.createElement('div');
  body.className = 'drawer-collapse-body';

  if (isDefaultExpanded) {
    group.classList.add('expanded');
    // 渲染子内容
    const children = renderChildren();
    if (children instanceof DocumentFragment || children instanceof HTMLElement) {
      body.appendChild(children);
    } else if (Array.isArray(children)) {
      children.forEach(child => {
        if (child) body.appendChild(child);
      });
    }
  }

  // 点击标题行切换展开/折叠
  header.addEventListener('click', () => {
    const isExpanded = group.classList.contains('expanded');
    if (isExpanded) {
      group.classList.remove('expanded');
    } else {
      // 首次展开时懒加载子内容
      if (body.children.length === 0) {
        const children = renderChildren();
        if (children instanceof DocumentFragment || children instanceof HTMLElement) {
          body.appendChild(children);
        } else if (Array.isArray(children)) {
          children.forEach(child => {
            if (child) body.appendChild(child);
          });
        }
      }
      group.classList.add('expanded');
    }
  });

  group.appendChild(header);
  group.appendChild(body);

  return group;
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
