/**
 * ============================================
 * 铁腕任务管理工具 - 应用主逻辑模块
 * ============================================
 * 
 * 本模块实现完整的任务管理功能，包括：
 * - 初始化 CloudBase SDK
 * - 任务列表加载与显示
 * - 添加、完成、删除任务
 * - 清空已完成任务
 * - 事件绑定与 UI 更新
 * 
 * 依赖：cloudbase.js, auth.js
 * 使用方式：在 app.html 中作为模块导入
 */

// ============================================
// 1. 模块导入
// ============================================

import { initCloudBase, taskDB, auth as cloudbaseAuth } from './cloudbase.js';
import { requireAuth, handleLogout, getCurrentUser, updateUserDisplay } from './auth.js';

// ============================================
// 2. 全局状态管理
// ============================================

/** 当前任务列表数据 */
let currentTasks = [];

/** 当前选中的象限 */
let currentQuadrant = 'q1';

/** 是否正在加载中 */
let isLoading = false;

/** 当前用户信息 */
let currentUser = null;

/** 任务统计信息 */
let taskStats = {
  total: 0,
  completed: 0,
  pending: 0,
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0
};

// ============================================
// 3. 常量定义
// ============================================

/** 象限配置信息 */
const QUADRANT_CONFIG = {
  q1: {
    name: '重要且紧急',
    color: '#ff4d4f',
    bgColor: '#fff2f0',
    borderColor: '#ffccc7',
    description: '立即做'
  },
  q2: {
    name: '重要不紧急',
    color: '#faad14',
    bgColor: '#fffbe6',
    borderColor: '#ffe58f',
    description: '计划做'
  },
  q3: {
    name: '紧急不重要',
    color: '#1890ff',
    bgColor: '#e6f7ff',
    borderColor: '#91d5ff',
    description: '授权做'
  },
  q4: {
    name: '不重要不紧急',
    color: '#52c41a',
    bgColor: '#f6ffed',
    borderColor: '#b7eb8f',
    description: '少做'
  }
};

/** 本地存储键名 - 当前选中的象限 */
const STORAGE_KEY_QUADRANT = 'tiewan_current_quadrant';

/** 动画持续时间（毫秒） */
const ANIMATION_DURATION = 300;

// ============================================
// 4. 初始化函数
// ============================================

/**
 * 初始化应用
 * 
 * 功能说明：
 * 1. 检查用户登录状态
 * 2. 初始化 CloudBase SDK
 * 3. 加载用户任务列表
 * 4. 绑定事件监听器
 * 5. 更新 UI 显示
 */
async function initApp() {
  console.log('[App] 开始初始化应用');
  
  try {
    // 1. 检查登录状态
    const userInfo = await requireAuth();
    if (!userInfo) {
      console.log('[App] 用户未登录，停止初始化');
      return;
    }
    
    currentUser = userInfo;
    console.log('[App] 用户已登录:', userInfo.username);
    
    // 2. 初始化 CloudBase SDK
    initCloudBase();
    console.log('[App] CloudBase SDK 初始化成功');
    
    // 3. 更新用户信息显示
    updateUserDisplay();
    
    // 4. 恢复上次选中的象限
    restoreQuadrantSelection();
    
    // 5. 绑定事件监听器
    bindEventListeners();
    
    // 6. 加载任务列表
    await loadTasks();
    
    // 7. 更新象限标签显示
    updateQuadrantLabels();
    
    console.log('[App] 应用初始化完成');
    
  } catch (error) {
    console.error('[App] 应用初始化失败:', error);
    showError('应用初始化失败，请刷新页面重试');
  }
}

/**
 * 从本地存储恢复象限选择
 */
function restoreQuadrantSelection() {
  try {
    const savedQuadrant = localStorage.getItem(STORAGE_KEY_QUADRANT);
    if (savedQuadrant && QUADRANT_CONFIG[savedQuadrant]) {
      currentQuadrant = savedQuadrant;
      console.log('[App] 恢复象限选择:', currentQuadrant);
    }
    
    // 更新 UI 选中状态
    updateQuadrantSelectionUI();
  } catch (e) {
    console.warn('[App] 恢复象限选择失败:', e);
  }
}

/**
 * 保存象限选择到本地存储
 */
function saveQuadrantSelection() {
  try {
    localStorage.setItem(STORAGE_KEY_QUADRANT, currentQuadrant);
  } catch (e) {
    console.warn('[App] 保存象限选择失败:', e);
  }
}

// ============================================
// 5. 任务列表加载
// ============================================

/**
 * 加载用户任务列表
 * 
 * 功能说明：
 * 1. 从 CloudBase 获取任务数据
 * 2. 按象限分组
 * 3. 更新任务统计
 * 4. 渲染任务列表
 * 5. 更新任务计数显示
 * 
 * @returns {Promise<boolean>} 加载是否成功
 */
async function loadTasks() {
  console.log('[App] 开始加载任务列表');
  
  // 显示加载状态
  showLoading(true);
  
  try {
    // 从 CloudBase 获取任务
    const result = await taskDB.getTasks();
    
    if (!result.success) {
      console.error('[App] 获取任务失败:', result.error);
      showError(result.error?.message || '获取任务列表失败');
      return false;
    }
    
    // 保存任务数据
    currentTasks = result.data || [];
    console.log('[App] 获取到任务数量:', currentTasks.length);
    
    // 计算任务统计
    calculateTaskStats();
    
    // 渲染任务列表
    renderTaskList();
    
    // 更新任务计数显示
    updateTaskCount();
    
    // 更新象限统计
    updateQuadrantStats();
    
    console.log('[App] 任务列表加载完成');
    return true;
    
  } catch (error) {
    console.error('[App] 加载任务列表失败:', error);
    showError('加载任务列表失败，请稍后重试');
    return false;
  } finally {
    // 隐藏加载状态
    showLoading(false);
  }
}

/**
 * 计算任务统计信息
 */
function calculateTaskStats() {
  taskStats = {
    total: currentTasks.length,
    completed: currentTasks.filter(t => t.completed).length,
    pending: currentTasks.filter(t => !t.completed).length,
    q1: currentTasks.filter(t => t.quadrant === 'q1' && !t.completed).length,
    q2: currentTasks.filter(t => t.quadrant === 'q2' && !t.completed).length,
    q3: currentTasks.filter(t => t.quadrant === 'q3' && !t.completed).length,
    q4: currentTasks.filter(t => t.quadrant === 'q4' && !t.completed).length
  };
  
  console.log('[App] 任务统计:', taskStats);
}

/**
 * 渲染任务列表
 * 
 * 功能说明：
 * 1. 按象限分组显示任务
 * 2. 未完成任务在前，已完成任务在后
 * 3. 添加动画效果
 */
function renderTaskList() {
  const container = document.getElementById('taskList');
  if (!container) {
    console.warn('[App] 未找到任务列表容器');
    return;
  }
  
  // 清空容器
  container.innerHTML = '';
  
  // 过滤当前象限的任务
  const quadrantTasks = currentTasks.filter(task => task.quadrant === currentQuadrant);
  
  // 分离已完成和未完成的任务
  const pendingTasks = quadrantTasks.filter(task => !task.completed);
  const completedTasks = quadrantTasks.filter(task => task.completed);
  
  // 按创建时间排序（新的在前）
  pendingTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  completedTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // 合并任务列表（未完成的在前）
  const sortedTasks = [...pendingTasks, ...completedTasks];
  
  // 如果没有任务，显示空状态
  if (sortedTasks.length === 0) {
    renderEmptyState(container);
    return;
  }
  
  // 渲染每个任务
  sortedTasks.forEach((task, index) => {
    const taskElement = createTaskElement(task);
    
    // 添加进入动画
    taskElement.style.animationDelay = `${index * 50}ms`;
    taskElement.classList.add('task-enter');
    
    container.appendChild(taskElement);
  });
  
  console.log('[App] 渲染任务数量:', sortedTasks.length);
}

/**
 * 渲染空状态
 * @param {HTMLElement} container - 容器元素
 */
function renderEmptyState(container) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  
  const config = QUADRANT_CONFIG[currentQuadrant];
  
  emptyState.innerHTML = `
    <div class="empty-icon">📋</div>
    <div class="empty-text">暂无任务</div>
    <div class="empty-hint">在"${config.name}"象限添加你的第一个任务吧</div>
  `;
  
  container.appendChild(emptyState);
}

/**
 * 创建任务元素
 * @param {Object} task - 任务数据
 * @returns {HTMLElement} 任务元素
 */
function createTaskElement(task) {
  const taskItem = document.createElement('div');
  taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
  taskItem.dataset.taskId = task._id;
  
  const config = QUADRANT_CONFIG[task.quadrant];
  
  taskItem.innerHTML = `
    <div class="task-checkbox" style="border-color: ${config.color}">
      ${task.completed ? '<span class="check-icon">✓</span>' : ''}
    </div>
    <div class="task-content">
      <div class="task-text">${escapeHtml(task.content)}</div>
      <div class="task-time">${formatTime(task.createdAt)}</div>
    </div>
    <div class="task-actions">
      <button class="task-delete-btn" title="删除任务" data-task-id="${task._id}">
        <span>🗑️</span>
      </button>
    </div>
  `;
  
  // 绑定任务项点击事件（切换完成状态）
  const checkbox = taskItem.querySelector('.task-checkbox');
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTask(task._id, !task.completed);
  });
  
  // 绑定删除按钮点击事件
  const deleteBtn = taskItem.querySelector('.task-delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task._id);
  });
  
  return taskItem;
}

// ============================================
// 6. 任务操作函数
// ============================================

/**
 * 添加新任务
 * 
 * 功能说明：
 * 1. 验证输入内容
 * 2. 保存到 CloudBase
 * 3. 刷新任务列表
 * 4. 清空输入框
 * 
 * @param {string} content - 任务内容
 * @param {string} quadrant - 任务象限（可选，默认使用当前选中象限）
 * @returns {Promise<boolean>} 添加是否成功
 */
async function addTask(content, quadrant = currentQuadrant) {
  console.log('[App] 添加任务:', { content, quadrant });
  
  // 1. 验证输入
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    showError('请输入任务内容');
    return false;
  }
  
  if (trimmedContent.length > 200) {
    showError('任务内容不能超过200个字符');
    return false;
  }
  
  // 2. 验证象限值
  const validQuadrants = ['q1', 'q2', 'q3', 'q4'];
  if (!validQuadrants.includes(quadrant)) {
    showError('无效的象限值');
    return false;
  }
  
  // 显示加载状态
  showLoading(true);
  
  try {
    // 3. 保存到 CloudBase
    const result = await taskDB.addTask(trimmedContent, quadrant);
    
    if (!result.success) {
      console.error('[App] 添加任务失败:', result.error);
      showError(result.error?.message || '添加任务失败');
      return false;
    }
    
    console.log('[App] 任务添加成功:', result.data);
    
    // 4. 清空输入框
    const input = document.getElementById('taskInput');
    if (input) {
      input.value = '';
      input.focus();
    }
    
    // 5. 刷新任务列表
    await loadTasks();
    
    // 6. 显示成功提示
    showSuccess('任务添加成功');
    
    return true;
    
  } catch (error) {
    console.error('[App] 添加任务失败:', error);
    showError('添加任务失败，请稍后重试');
    return false;
  } finally {
    showLoading(false);
  }
}

/**
 * 切换任务完成状态
 * 
 * 功能说明：
 * 1. 更新任务完成状态
 * 2. 同步到 CloudBase
 * 3. 更新 UI 显示
 * 
 * @param {string} taskId - 任务 ID
 * @param {boolean} completed - 完成状态
 * @returns {Promise<boolean>} 操作是否成功
 */
async function toggleTask(taskId, completed) {
  console.log('[App] 切换任务状态:', { taskId, completed });
  
  if (!taskId) {
    showError('任务ID不能为空');
    return false;
  }
  
  // 乐观更新 UI
  const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
  if (taskElement) {
    taskElement.classList.toggle('completed', completed);
    const checkbox = taskElement.querySelector('.task-checkbox');
    checkbox.innerHTML = completed ? '<span class="check-icon">✓</span>' : '';
  }
  
  try {
    // 更新 CloudBase
    const result = await taskDB.updateTask(taskId, completed);
    
    if (!result.success) {
      console.error('[App] 更新任务状态失败:', result.error);
      showError(result.error?.message || '更新任务状态失败');
      
      // 恢复 UI 状态
      if (taskElement) {
        taskElement.classList.toggle('completed', !completed);
        const checkbox = taskElement.querySelector('.task-checkbox');
        checkbox.innerHTML = !completed ? '<span class="check-icon">✓</span>' : '';
      }
      
      return false;
    }
    
    console.log('[App] 任务状态更新成功');
    
    // 更新本地数据
    const task = currentTasks.find(t => t._id === taskId);
    if (task) {
      task.completed = completed;
    }
    
    // 更新统计和 UI
    calculateTaskStats();
    updateTaskCount();
    updateQuadrantStats();
    
    // 播放完成音效（可选）
    if (completed) {
      playCompleteSound();
    }
    
    return true;
    
  } catch (error) {
    console.error('[App] 切换任务状态失败:', error);
    showError('更新任务状态失败');
    
    // 恢复 UI 状态
    if (taskElement) {
      taskElement.classList.toggle('completed', !completed);
      const checkbox = taskElement.querySelector('.task-checkbox');
      checkbox.innerHTML = !completed ? '<span class="check-icon">✓</span>' : '';
    }
    
    return false;
  }
}

/**
 * 删除任务
 * 
 * 功能说明：
 * 1. 从 CloudBase 删除任务
 * 2. 刷新任务列表
 * 
 * @param {string} taskId - 任务 ID
 * @returns {Promise<boolean>} 删除是否成功
 */
async function deleteTask(taskId) {
  console.log('[App] 删除任务:', taskId);
  
  if (!taskId) {
    showError('任务ID不能为空');
    return false;
  }
  
  // 确认删除
  if (!confirm('确定要删除这个任务吗？')) {
    return false;
  }
  
  // 找到任务元素并添加删除动画
  const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
  if (taskElement) {
    taskElement.classList.add('task-deleting');
  }
  
  try {
    // 从 CloudBase 删除
    const result = await taskDB.deleteTask(taskId);
    
    if (!result.success) {
      console.error('[App] 删除任务失败:', result.error);
      showError(result.error?.message || '删除任务失败');
      
      // 恢复动画
      if (taskElement) {
        taskElement.classList.remove('task-deleting');
      }
      
      return false;
    }
    
    console.log('[App] 任务删除成功');
    
    // 等待动画完成后刷新列表
    setTimeout(async () => {
      // 从本地数据中移除
      currentTasks = currentTasks.filter(t => t._id !== taskId);
      
      // 更新统计和 UI
      calculateTaskStats();
      renderTaskList();
      updateTaskCount();
      updateQuadrantStats();
      
      showSuccess('任务已删除');
    }, ANIMATION_DURATION);
    
    return true;
    
  } catch (error) {
    console.error('[App] 删除任务失败:', error);
    showError('删除任务失败');
    
    // 恢复动画
    if (taskElement) {
      taskElement.classList.remove('task-deleting');
    }
    
    return false;
  }
}

/**
 * 清空所有已完成的任务
 * 
 * 功能说明：
 * 1. 删除所有 completed=true 的任务
 * 2. 刷新任务列表
 * 
 * @returns {Promise<boolean>} 清空是否成功
 */
async function clearCompleted() {
  console.log('[App] 清空已完成任务');
  
  // 检查是否有已完成的任务
  const completedCount = currentTasks.filter(t => t.completed).length;
  if (completedCount === 0) {
    showInfo('没有已完成的任务');
    return true;
  }
  
  // 确认清空
  if (!confirm(`确定要清空 ${completedCount} 个已完成的任务吗？`)) {
    return false;
  }
  
  showLoading(true);
  
  try {
    // 从 CloudBase 清空
    const result = await taskDB.clearCompleted();
    
    if (!result.success) {
      console.error('[App] 清空完成任务失败:', result.error);
      showError(result.error?.message || '清空完成任务失败');
      return false;
    }
    
    console.log('[App] 清空完成任务成功，删除数量:', result.deletedCount);
    
    // 刷新任务列表
    await loadTasks();
    
    showSuccess(`已清空 ${result.deletedCount} 个完成任务`);
    
    return true;
    
  } catch (error) {
    console.error('[App] 清空完成任务失败:', error);
    showError('清空完成任务失败');
    return false;
  } finally {
    showLoading(false);
  }
}

// ============================================
// 7. 事件绑定
// ============================================

/**
 * 绑定事件监听器
 * 
 * 功能说明：
 * - 发送按钮点击
 * - 回车键提交
 * - 任务项点击（完成/取消）
 * - 清空按钮点击
 * - 退出按钮点击
 * - 象限切换点击
 */
function bindEventListeners() {
  console.log('[App] 绑定事件监听器');
  
  // 1. 发送按钮点击事件
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendClick);
  }
  
  // 2. 输入框回车键事件
  const taskInput = document.getElementById('taskInput');
  if (taskInput) {
    taskInput.addEventListener('keypress', handleInputKeypress);
    taskInput.addEventListener('input', handleInputChange);
  }
  
  // 3. 清空已完成按钮点击事件
  const clearBtn = document.getElementById('clearCompletedBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', handleClearClick);
  }
  
  // 4. 退出按钮点击事件
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogoutClick);
  }
  
  // 5. 象限切换按钮点击事件
  const quadrantBtns = document.querySelectorAll('.quadrant-btn');
  quadrantBtns.forEach(btn => {
    btn.addEventListener('click', handleQuadrantClick);
  });
  
  // 6. 刷新按钮点击事件（如果有）
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefreshClick);
  }
  
  console.log('[App] 事件监听器绑定完成');
}

/**
 * 处理发送按钮点击
 */
function handleSendClick() {
  const input = document.getElementById('taskInput');
  if (input) {
    const content = input.value.trim();
    if (content) {
      addTask(content);
    } else {
      showError('请输入任务内容');
      input.focus();
    }
  }
}

/**
 * 处理输入框回车键
 * @param {KeyboardEvent} e - 键盘事件
 */
function handleInputKeypress(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSendClick();
  }
}

/**
 * 处理输入框内容变化
 * @param {InputEvent} e - 输入事件
 */
function handleInputChange(e) {
  const input = e.target;
  const sendBtn = document.getElementById('sendBtn');
  
  if (sendBtn) {
    // 根据输入内容启用/禁用发送按钮
    sendBtn.disabled = !input.value.trim();
  }
  
  // 限制输入长度
  if (input.value.length > 200) {
    input.value = input.value.substring(0, 200);
    showWarning('任务内容不能超过200个字符');
  }
}

/**
 * 处理清空按钮点击
 */
function handleClearClick() {
  clearCompleted();
}

/**
 * 处理退出按钮点击
 */
async function handleLogoutClick() {
  if (confirm('确定要退出登录吗？')) {
    await handleLogout();
  }
}

/**
 * 处理象限切换点击
 * @param {MouseEvent} e - 鼠标事件
 */
function handleQuadrantClick(e) {
  const btn = e.currentTarget;
  const quadrant = btn.dataset.quadrant;
  
  if (quadrant && quadrant !== currentQuadrant) {
    currentQuadrant = quadrant;
    saveQuadrantSelection();
    updateQuadrantSelectionUI();
    renderTaskList();
    updateInputPlaceholder();
    
    console.log('[App] 切换到象限:', quadrant);
  }
}

/**
 * 处理刷新按钮点击
 */
async function handleRefreshClick() {
  await loadTasks();
  showSuccess('任务列表已刷新');
}

// ============================================
// 8. UI 更新函数
// ============================================

/**
 * 更新象限选择 UI
 */
function updateQuadrantSelectionUI() {
  const quadrantBtns = document.querySelectorAll('.quadrant-btn');
  
  quadrantBtns.forEach(btn => {
    const quadrant = btn.dataset.quadrant;
    btn.classList.toggle('active', quadrant === currentQuadrant);
  });
  
  // 更新输入框占位符
  updateInputPlaceholder();
}

/**
 * 更新输入框占位符
 */
function updateInputPlaceholder() {
  const input = document.getElementById('taskInput');
  if (input) {
    const config = QUADRANT_CONFIG[currentQuadrant];
    input.placeholder = `添加${config.name}任务...`;
  }
}

/**
 * 更新象限标签显示
 */
function updateQuadrantLabels() {
  const quadrantHeaders = document.querySelectorAll('.quadrant-header');
  
  quadrantHeaders.forEach(header => {
    const quadrant = header.dataset.quadrant;
    if (quadrant && QUADRANT_CONFIG[quadrant]) {
      const config = QUADRANT_CONFIG[quadrant];
      const nameEl = header.querySelector('.quadrant-name');
      const descEl = header.querySelector('.quadrant-desc');
      
      if (nameEl) nameEl.textContent = config.name;
      if (descEl) descEl.textContent = config.description;
      
      // 设置颜色
      header.style.borderLeftColor = config.color;
    }
  });
}

/**
 * 更新象限统计显示
 */
function updateQuadrantStats() {
  Object.keys(QUADRANT_CONFIG).forEach(quadrant => {
    const countEl = document.querySelector(`.quadrant-count[data-quadrant="${quadrant}"]`);
    if (countEl) {
      const count = taskStats[quadrant];
      countEl.textContent = count;
      countEl.classList.toggle('has-tasks', count > 0);
    }
  });
}

/**
 * 更新任务计数显示
 */
function updateTaskCount() {
  // 更新总任务数
  const totalEl = document.getElementById('totalCount');
  if (totalEl) {
    totalEl.textContent = taskStats.total;
  }
  
  // 更新已完成任务数
  const completedEl = document.getElementById('completedCount');
  if (completedEl) {
    completedEl.textContent = taskStats.completed;
  }
  
  // 更新待办任务数
  const pendingEl = document.getElementById('pendingCount');
  if (pendingEl) {
    pendingEl.textContent = taskStats.pending;
  }
  
  // 更新当前象限任务数
  const currentCountEl = document.getElementById('currentCount');
  if (currentCountEl) {
    currentCountEl.textContent = taskStats[currentQuadrant];
  }
  
  // 更新页面标题（显示待办数量）
  if (taskStats.pending > 0) {
    document.title = `(${taskStats.pending}) 铁腕任务管理`;
  } else {
    document.title = '铁腕任务管理';
  }
}

/**
 * 显示/隐藏加载状态
 * @param {boolean} show - 是否显示
 */
function showLoading(show) {
  isLoading = show;
  
  const loadingEl = document.getElementById('loadingIndicator');
  if (loadingEl) {
    loadingEl.classList.toggle('show', show);
  }
  
  // 禁用/启用操作按钮
  const buttons = document.querySelectorAll('.action-btn, .send-btn');
  buttons.forEach(btn => {
    btn.disabled = show;
  });
}

// ============================================
// 9. 消息提示函数
// ============================================

/**
 * 显示错误提示
 * @param {string} message - 错误信息
 */
function showError(message) {
  showToast(message, 'error');
}

/**
 * 显示成功提示
 * @param {string} message - 成功信息
 */
function showSuccess(message) {
  showToast(message, 'success');
}

/**
 * 显示警告提示
 * @param {string} message - 警告信息
 */
function showWarning(message) {
  showToast(message, 'warning');
}

/**
 * 显示信息提示
 * @param {string} message - 信息内容
 */
function showInfo(message) {
  showToast(message, 'info');
}

/**
 * 显示 Toast 提示
 * @param {string} message - 提示内容
 * @param {string} type - 提示类型 (error|success|warning|info)
 * @param {number} duration - 显示时长（毫秒）
 */
function showToast(message, type = 'info', duration = 3000) {
  console.log(`[App] ${type}:`, message);
  
  // 查找或创建 Toast 容器
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  // 创建 Toast 元素
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // 设置图标
  const icons = {
    error: '❌',
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  
  // 添加到容器
  toastContainer.appendChild(toast);
  
  // 触发动画
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // 自动移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// ============================================
// 10. 工具函数
// ============================================

/**
 * HTML 转义，防止 XSS 攻击
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (!text) return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化时间显示
 * @param {string|Date} timestamp - 时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  
  // 检查是否是今天
  const isToday = date.toDateString() === now.toDateString();
  
  // 检查是否是昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  if (isToday) {
    return `今天 ${hours}:${minutes}`;
  } else if (isYesterday) {
    return `昨天 ${hours}:${minutes}`;
  } else {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  }
}

/**
 * 播放完成音效（可选功能）
 */
function playCompleteSound() {
  try {
    // 创建简单的提示音
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    // 忽略音频播放错误
  }
}

// ============================================
// 11. 页面可见性处理
// ============================================

/**
 * 处理页面可见性变化
 * 当用户返回页面时，刷新任务列表
 */
function handleVisibilityChange() {
  if (!document.hidden) {
    console.log('[App] 页面变为可见，刷新任务列表');
    loadTasks();
  }
}

// 监听页面可见性变化
document.addEventListener('visibilitychange', handleVisibilityChange);

// ============================================
// 12. 键盘快捷键
// ============================================

/**
 * 处理键盘快捷键
 * @param {KeyboardEvent} e - 键盘事件
 */
function handleKeyboardShortcut(e) {
  // Ctrl/Cmd + Enter: 添加任务
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const taskInput = document.getElementById('taskInput');
    if (document.activeElement === taskInput) {
      handleSendClick();
    }
  }
  
  // Ctrl/Cmd + R: 刷新任务列表
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    loadTasks();
  }
  
  // Esc: 清空输入框
  if (e.key === 'Escape') {
    const taskInput = document.getElementById('taskInput');
    if (taskInput && document.activeElement === taskInput) {
      taskInput.value = '';
      taskInput.blur();
    }
  }
}

// 监听键盘事件
document.addEventListener('keydown', handleKeyboardShortcut);

// ============================================
// 13. 应用启动
// ============================================

/**
 * 当 DOM 加载完成后初始化应用
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('[App] DOM 加载完成，开始初始化');
  initApp();
});

// ============================================
// 14. 导出模块
// ============================================

export {
  // 主要功能
  initApp,
  loadTasks,
  addTask,
  toggleTask,
  deleteTask,
  clearCompleted,
  
  // 状态管理
  currentTasks,
  currentQuadrant,
  taskStats,
  
  // 工具函数
  escapeHtml,
  formatTime,
  
  // UI 更新
  showToast,
  showError,
  showSuccess,
  showWarning,
  showInfo,
  showLoading
};

// 默认导出
export default {
  initApp,
  loadTasks,
  addTask,
  toggleTask,
  deleteTask,
  clearCompleted
};
