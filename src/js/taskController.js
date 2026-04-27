/**
 * 任务控制器模块
 * 处理任务的增删改查 (CRUD) 相关逻辑
 */

import { MAX_TASK_LENGTH, MAX_NOTE_LENGTH, taskDB, validateTaskContent } from './storage.js';
import { createDialogContent, openStackedDialog } from './dialog.js';
import { showError, showSuccess, QUADRANT_CONFIG, escapeHtml } from './uiController.js';

// 任务状态
let currentTasks = [];

/**
 * 获取当前任务列表
 * @returns {Array} 当前任务列表
 */
function getCurrentTasks() {
  return currentTasks;
}

/**
 * 设置当前任务列表
 * @param {Array} tasks - 任务列表
 */
function setCurrentTasks(tasks) {
  currentTasks = tasks;
}

/**
 * 按象限分组任务
 * @param {Array} tasks - 任务列表
 * @returns {Object} 按象限分组的任务
 */
function groupTasksByQuadrant(tasks) {
  return Object.keys(QUADRANT_CONFIG).reduce((accumulator, quadrant) => {
    const quadrantTasks = tasks
      .filter(task => task.quadrant === quadrant && !task.completed)
      .sort((left, right) => {
        return new Date(right.createdAt) - new Date(left.createdAt);
      });

    accumulator[quadrant] = quadrantTasks;
    return accumulator;
  }, {});
}

/**
 * 获取任务统计信息
 * @returns {Object} 任务统计
 */
function getTaskStats() {
  return {
    total: currentTasks.length,
    completed: currentTasks.filter(task => task.completed).length,
    pending: currentTasks.filter(task => !task.completed).length
  };
}

/**
 * 验证任务输入
 * @param {string} content - 任务内容
 * @returns {string|null} 验证通过返回规范化内容，否则返回 null
 */
function validateTaskInput(content) {
  const validation = validateTaskContent(content);

  if (!validation.valid) {
    showError(validation.error?.message || '任务内容不合法');
    return null;
  }

  return validation.normalizedContent;
}

/**
 * 加载任务
 * @returns {Promise<boolean>} 是否加载成功
 */
async function loadTasks() {
  try {
    const result = await taskDB.getTasks();

    if (!result.success) {
      showError(result.error?.message || '获取任务失败');
      return false;
    }

    currentTasks = result.data || [];
    return true;
  } catch (error) {
    console.error('[TaskController] 加载任务失败', error);
    showError('加载任务失败，请稍后重试');
    return false;
  }
}

/**
 * 添加任务
 * @param {string} content - 任务内容
 * @param {string} quadrant - 任务象限
 * @returns {Promise<boolean>} 是否添加成功
 */
async function addTask(content, quadrant) {
  if (!quadrant || !QUADRANT_CONFIG[quadrant]) {
    showError('无效的象限选择');
    return false;
  }
  const trimmedContent = validateTaskInput(content);
  if (!trimmedContent) {
    return false;
  }

  try {
    const result = await taskDB.addTask(trimmedContent, quadrant);

    if (!result.success) {
      showError(result.error?.message || '添加任务失败');
      return false;
    }

    currentTasks.unshift(result.data);
    showSuccess(`已添加到${QUADRANT_CONFIG[quadrant].label}`);
    return true;
  } catch (error) {
    console.error('[TaskController] 添加任务失败', error);
    showError('添加任务失败，请稍后重试');
    return false;
  }
}

/**
 * 切换任务完成状态
 * @param {string} taskId - 任务ID
 * @param {boolean} completed - 是否完成
 * @param {HTMLElement} taskElement - 任务DOM元素（可选）
 * @param {HTMLElement} triggerElement - 触发元素（可选）
 * @returns {Promise<boolean>} 是否切换成功
 */
async function toggleTask(taskId, completed, taskElement = null, triggerElement = null) {
  if (completed && taskElement) {
    // 1. 先更新勾选框为绿色 ✓
    if (triggerElement) {
      triggerElement.classList.remove('pending');
      triggerElement.classList.add('done');
      triggerElement.textContent = '✓';
    }

    // 2. 触发彩纸动画
    if (window.confetti) {
      const rect = triggerElement ? triggerElement.getBoundingClientRect() : taskElement.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;
      window.confetti({
        particleCount: 20,
        spread: 25,
        startVelocity: 15,
        scalar: 0.5,
        origin: { x, y },
        zIndex: 9999
      });
    }

    // 3. 延迟 0.5 秒，让用户看到绿色勾选状态
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. 开始消失动画
    taskElement.style.transition = 'all 0.3s ease';
    taskElement.style.opacity = '0';
    taskElement.style.height = taskElement.offsetHeight + 'px';

    // Trigger reflow
    void taskElement.offsetHeight;

    taskElement.style.height = '0';
    taskElement.style.padding = '0';
    taskElement.style.margin = '0';
    taskElement.style.overflow = 'hidden';

    // 5. 等待消失动画完成
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const result = await taskDB.updateTask(taskId, completed);

  if (!result.success) {
    showError(result.error?.message || '更新任务状态失败');
    if (completed && taskElement) {
      taskElement.style.opacity = '1';
      taskElement.style.height = 'auto';
      taskElement.style.padding = '';
      taskElement.style.margin = '';
    }
    return false;
  }

  currentTasks = currentTasks.map(task => (
    task._id === taskId
      ? { ...task, completed, updatedAt: result.data?.updatedAt || new Date().toISOString() }
      : task
  ));

  return true;
}

/**
 * 创建任务编辑对话框内容
 * @param {Object} task - 任务对象
 * @param {Function} close - 关闭对话框函数
 * @param {string} defaultQuadrant - 默认象限
 * @returns {Object} 对话框内容
 */
function createTaskEditDialogContent(task, close, defaultQuadrant = 'q1') {
  return createDialogContent(`
    <form class="task-dialog-form">
      <label class="task-dialog-label" for="taskEditContent">任务内容</label>
      <textarea
        id="taskEditContent"
        class="task-dialog-input"
        rows="4"
        maxlength="${MAX_TASK_LENGTH}"
        placeholder="请输入任务内容"
      ></textarea>
      <div class="task-dialog-char-count" id="taskContentCharCount">0/${MAX_TASK_LENGTH}</div>
      <label class="task-dialog-label" for="taskEditNote">任务备注</label>
      <textarea
        id="taskEditNote"
        class="task-dialog-input"
        rows="3"
        maxlength="${MAX_NOTE_LENGTH}"
        placeholder="添加任务备注（可选）"
      ></textarea>
      <div class="task-dialog-char-count" id="taskNoteCharCount">0/${MAX_NOTE_LENGTH}</div>
      <label class="task-dialog-label" for="taskEditQuadrant">任务象限</label>
      <select id="taskEditQuadrant" class="task-dialog-select">
        ${Object.entries(QUADRANT_CONFIG).map(([value, config]) => `<option value="${value}">${config.shortCode} · ${config.label}</option>`).join('')}
      </select>
      <div class="task-dialog-error" data-role="error" aria-live="polite"></div>
      <div class="task-dialog-actions">
        <button type="button" class="task-dialog-btn secondary" data-role="cancel">取消</button>
        <button type="submit" class="task-dialog-btn primary">保存</button>
      </div>
    </form>
  `, element => {
    const form = element;
    const content = element.querySelector('#taskEditContent');
    const note = element.querySelector('#taskEditNote');
    const contentCharCount = element.querySelector('#taskContentCharCount');
    const noteCharCount = element.querySelector('#taskNoteCharCount');
    const quadrant = element.querySelector('#taskEditQuadrant');
    const error = element.querySelector('[data-role="error"]');
    const cancelButton = element.querySelector('[data-role="cancel"]');

    content.value = task.content || '';
    note.value = task.notes || '';
    quadrant.value = QUADRANT_CONFIG[task.quadrant] ? task.quadrant : defaultQuadrant;
    error.textContent = '';

    // 更新字数统计显示
    const updateCharCount = (input, countElement, maxLength) => {
      const currentLength = input.value.length;
      countElement.textContent = `${currentLength}/${maxLength}`;
      // 当字数接近上限时改变颜色提示
      if (currentLength >= maxLength * 0.9) {
        countElement.classList.add('warning');
      } else {
        countElement.classList.remove('warning');
      }
    };

    // 初始化字数统计
    updateCharCount(content, contentCharCount, MAX_TASK_LENGTH);
    updateCharCount(note, noteCharCount, MAX_NOTE_LENGTH);

    // 监听输入事件，实时更新字数显示
    const handleContentInput = () => updateCharCount(content, contentCharCount, MAX_TASK_LENGTH);
    const handleNoteInput = () => updateCharCount(note, noteCharCount, MAX_NOTE_LENGTH);

    content.addEventListener('input', handleContentInput);
    note.addEventListener('input', handleNoteInput);

    const handleCancel = () => {
      close({ cancelled: true });
    };

    const handleSubmit = event => {
      event.preventDefault();

      const nextContent = content.value.trim();
      const nextQuadrant = quadrant.value.trim().toLowerCase();
      const nextNote = note.value.trim();
      const validation = validateTaskContent(nextContent);

      if (!validation.valid) {
        error.textContent = validation.error?.message || '任务内容不合法';
        content.focus();
        return;
      }

      if (!QUADRANT_CONFIG[nextQuadrant]) {
        error.textContent = '象限编号必须是 q1 / q2 / q3 / q4';
        quadrant.focus();
        return;
      }

      close({
        cancelled: false,
        content: validation.normalizedContent,
        quadrant: nextQuadrant,
        notes: nextNote
      });
    };

    cancelButton.addEventListener('click', handleCancel);
    form.addEventListener('submit', handleSubmit);

    return {
      cleanup: () => {
        cancelButton.removeEventListener('click', handleCancel);
        form.removeEventListener('submit', handleSubmit);
        content.removeEventListener('input', handleContentInput);
        note.removeEventListener('input', handleNoteInput);
      },
      focusTarget: content
    };
  });
}

/**
 * 打开任务编辑对话框
 * @param {Object} task - 任务对象
 * @param {string} defaultQuadrant - 默认象限
 * @returns {Promise<Object>} 编辑结果
 */
function openTaskEditDialog(task, defaultQuadrant = 'q1') {
  return openStackedDialog({
    title: '编辑任务',
    render: ({ body, close }) => {
      const content = createTaskEditDialogContent(task, close, defaultQuadrant);
      body.appendChild(content.element);
      return {
        cleanup: content.cleanup,
        focusTarget: content.focusTarget
      };
    }
  });
}

/**
 * 收集任务编辑输入
 * @param {Object} task - 任务对象
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 编辑结果
 */
async function collectTaskEditInput(task, options = {}) {
  const {
    promptFn = typeof window !== 'undefined' && typeof window.prompt === 'function'
      ? window.prompt.bind(window)
      : null,
    defaultQuadrant = 'q1'
  } = options;

  if (typeof document !== 'undefined' && !options.forcePrompt) {
    return openTaskEditDialog(task, defaultQuadrant);
  }

  if (typeof promptFn !== 'function') {
    return Promise.resolve({
      cancelled: true,
      error: new Error('当前环境不支持任务编辑输入')
    });
  }

  const nextContent = promptFn('编辑任务内容', task.content);
  if (nextContent === null) {
    return Promise.resolve({ cancelled: true });
  }

  const trimmedContent = validateTaskInput(nextContent);
  if (!trimmedContent) {
    return Promise.resolve({ cancelled: true, invalid: true });
  }

  const nextQuadrant = promptFn('输入象限编号（q1/q2/q3/q4）', task.quadrant);
  if (nextQuadrant === null) {
    return Promise.resolve({ cancelled: true });
  }

  const normalizedQuadrant = nextQuadrant.trim().toLowerCase();
  if (!QUADRANT_CONFIG[normalizedQuadrant]) {
    showError('象限编号必须是 q1 / q2 / q3 / q4');
    return Promise.resolve({ cancelled: true, invalid: true });
  }

  return Promise.resolve({
    cancelled: false,
    content: trimmedContent,
    quadrant: normalizedQuadrant
  });
}

/**
 * 编辑任务
 * @param {string} taskId - 任务ID
 * @param {Object} options - 选项
 * @returns {Promise<boolean>} 是否编辑成功
 */
async function editTask(taskId, options = {}) {
  const task = currentTasks.find(item => item._id === taskId);
  if (!task) {
    showError('任务不存在');
    return false;
  }

  try {
    const editResult = await collectTaskEditInput(task, options);
    if (!editResult || editResult.cancelled) {
      return false;
    }

    const result = await taskDB.updateTaskContent(taskId, {
      content: editResult.content,
      quadrant: editResult.quadrant,
      notes: editResult.notes
    });

    if (!result.success) {
      showError(result.error?.message || '更新任务失败');
      return false;
    }

    currentTasks = currentTasks.map(item => (
      item._id === taskId
        ? {
            ...item,
            content: editResult.content,
            quadrant: editResult.quadrant,
            notes: editResult.notes,
            updatedAt: result.data?.updatedAt || new Date().toISOString()
          }
        : item
    ));

    showSuccess('任务已更新');
    return true;
  } catch (error) {
    console.error('[TaskController] 编辑任务失败', error);
    showError('编辑任务失败，请稍后重试');
    return false;
  }
}

/**
 * 打开确认对话框
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 确认结果
 */
function openConfirmDialog(options = {}) {
  const {
    title = '操作确认',
    message = '确定继续此操作吗？',
    confirmText = '确定',
    cancelText = '取消',
    confirmButtonVariant = 'primary'
  } = options;

  return openStackedDialog({
    title,
    panelClassName: 'is-compact',
    render: ({ body, close }) => {
      const content = createDialogContent(`
        <div class="task-dialog-confirm">
          <p class="task-dialog-message">${escapeHtml(message)}</p>
          <div class="task-dialog-actions">
            <button type="button" class="task-dialog-btn secondary" data-role="cancel">${escapeHtml(cancelText)}</button>
            <button type="button" class="task-dialog-btn ${escapeHtml(confirmButtonVariant)}" data-role="confirm">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      `, element => {
        const cancelButton = element.querySelector('[data-role="cancel"]');
        const confirmButton = element.querySelector('[data-role="confirm"]');
        const handleCancel = () => {
          close({ cancelled: true });
        };
        const handleConfirm = () => {
          close({ cancelled: false, confirmed: true });
        };

        cancelButton.addEventListener('click', handleCancel);
        confirmButton.addEventListener('click', handleConfirm);

        return {
          cleanup: () => {
            cancelButton.removeEventListener('click', handleCancel);
            confirmButton.removeEventListener('click', handleConfirm);
          },
          focusTarget: confirmButton
        };
      });

      body.appendChild(content.element);

      return {
        cleanup: content.cleanup,
        focusTarget: content.focusTarget
      };
    }
  });
}

/**
 * 执行确认操作
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 操作结果
 */
async function runConfirmedAction(options = {}) {
  const {
    message = '确定继续此操作吗？',
    title = '操作确认',
    confirmText = '确定',
    cancelText = '取消',
    confirmButtonVariant = 'primary',
    confirmFn = null,
    actionFn = async () => ({ success: true }),
    beforeAction,
    afterAction,
    guard
  } = options;

  const guardResult = typeof guard === 'function' ? await Promise.resolve(guard()) : null;

  if (guardResult) {
    return guardResult;
  }

  let confirmed = false;
  if (typeof confirmFn === 'function') {
    confirmed = await Promise.resolve(confirmFn(message));
  } else if (typeof document !== 'undefined') {
    const dialogResult = await openConfirmDialog({
      title,
      message,
      confirmText,
      cancelText,
      confirmButtonVariant
    });
    confirmed = dialogResult?.confirmed === true;
  } else {
    const fallbackConfirm = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm.bind(window)
      : () => true;
    confirmed = await Promise.resolve(fallbackConfirm(message));
  }

  if (!confirmed) {
    return {
      success: false,
      cancelled: true
    };
  }

  await Promise.resolve(beforeAction?.());

  try {
    return await actionFn();
  } finally {
    await Promise.resolve(afterAction?.());
  }
}

/**
 * 删除任务前确认
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 操作结果
 */
async function confirmBeforeDeleteTask(options = {}) {
  const {
    taskId,
    message = '确定删除这个任务吗？',
    confirmFn = null,
    deleteFn = taskDB.deleteTask.bind(taskDB)
  } = options;

  return runConfirmedAction({
    title: '删除任务',
    message,
    confirmText: '删除',
    confirmButtonVariant: 'danger',
    confirmFn,
    actionFn: () => deleteFn(taskId)
  });
}

/**
 * 移动任务到指定象限
 * @param {string} taskId - 任务ID
 * @param {string} targetQuadrant - 目标象限
 * @returns {Promise<boolean>} 是否移动成功
 */
async function moveTask(taskId, targetQuadrant) {
  if (!taskId || (typeof taskId !== 'string' && typeof taskId !== 'number')) {
    showError('任务ID不能为空');
    return false;
  }

  if (!QUADRANT_CONFIG[targetQuadrant]) {
    showError('无效的象限选择');
    return false;
  }

  const task = currentTasks.find(item => item._id === taskId);
  if (!task) {
    showError('任务不存在');
    return false;
  }

  // 如果已经在目标象限，不需要移动
  if (task.quadrant === targetQuadrant) {
    return true;
  }

  try {
    const result = await taskDB.updateTaskContent(taskId, {
      quadrant: targetQuadrant
    });

    if (!result.success) {
      showError(result.error?.message || '移动任务失败');
      return false;
    }

    // 更新本地任务数据
    currentTasks = currentTasks.map(item => (
      item._id === taskId
        ? {
            ...item,
            quadrant: targetQuadrant,
            updatedAt: result.data?.updatedAt || new Date().toISOString()
          }
        : item
    ));

    showSuccess(`任务已移动到${QUADRANT_CONFIG[targetQuadrant].label}`);
    return true;
  } catch (error) {
    console.error('[TaskController] 移动任务失败', error);
    showError('移动任务失败，请稍后重试');
    return false;
  }
}

/**
 * 删除任务
 * @param {string} taskId - 任务ID
 * @returns {Promise<boolean>} 是否删除成功
 */
async function deleteTask(taskId) {
  const result = await confirmBeforeDeleteTask({ taskId });

  if (result?.cancelled) {
    return false;
  }

  if (!result.success) {
    showError(result.error?.message || '删除任务失败');
    return false;
  }

  currentTasks = currentTasks.filter(task => task._id !== taskId);
  showSuccess('任务已删除');
  return true;
}

export {
  addTask,
  collectTaskEditInput,
  confirmBeforeDeleteTask,
  deleteTask,
  editTask,
  getCurrentTasks,
  getTaskStats,
  groupTasksByQuadrant,
  loadTasks,
  moveTask,
  runConfirmedAction,
  setCurrentTasks,
  toggleTask,
  validateTaskInput
};

export default {
  addTask,
  toggleTask,
  editTask,
  deleteTask,
  moveTask,
  loadTasks,
  getCurrentTasks,
  setCurrentTasks,
  getTaskStats,
  groupTasksByQuadrant
};
