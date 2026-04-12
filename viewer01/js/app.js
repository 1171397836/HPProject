/**
 * 应用页统一任务逻辑
 * - 与 login 共用 auth.js / storage.js
 * - 本地模式支持注册登录后直接增删改查
 * - 直接渲染四象限矩阵
 * - 新增 AI 助手功能
 */

import { MAX_TASK_LENGTH, taskDB, validateTaskContent } from './storage.js';
import { handleLogout, requireAuth, updateUserDisplay, getCurrentUser } from './auth.js';
import { createDialogContent, openStackedDialog } from './dialog.js';
import {
  AI_PROVIDERS,
  getAIConfig,
  getProviderDefaultModel,
  getProviderModels,
  isAIConfigReady,
  saveAIConfig,
  validateAIConfig,
  initAIConfig
} from './aiConfig.js';
import {
  addMessage,
  clearChatHistory,
  createNewSession,
  switchSession,
  getCurrentSession,
  getMessages,
  getWelcomeMessage,
  initChat,
  MESSAGE_TYPE,
  sendMessage,
  setCallbacks
} from './aiChat.js';
import CONFIG from './config.js';

const STORAGE_KEY_QUADRANT = CONFIG.STORAGE_KEYS.CURRENT_QUADRANT;

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
let isLogoutSubmitting = false;

// AI 模式状态
let isAIMode = false;
let isAIInitialized = false;

function getSafeStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function getQuadrantStorageKey() {
  const user = currentUser || getCurrentUser();
  if (user && user.uid) {
    return `${STORAGE_KEY_QUADRANT}_${user.uid}`;
  }
  return STORAGE_KEY_QUADRANT;
}

function restoreQuadrantSelection() {
  const storage = getSafeStorage();
  const savedQuadrant = storage?.getItem(getQuadrantStorageKey());

  if (savedQuadrant && QUADRANT_CONFIG[savedQuadrant]) {
    currentQuadrant = savedQuadrant;
  }
}

function saveQuadrantSelection() {
  const storage = getSafeStorage();
  storage?.setItem(getQuadrantStorageKey(), currentQuadrant);
}

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

function getTaskStats() {
  return {
    total: currentTasks.length,
    completed: currentTasks.filter(task => task.completed).length,
    pending: currentTasks.filter(task => !task.completed).length
  };
}

function validateTaskInput(content) {
  const validation = validateTaskContent(content);

  if (!validation.valid) {
    showError(validation.error?.message || '任务内容不合法');
    return null;
  }

  return validation.normalizedContent;
}

async function initApp() {
  const userInfo = await requireAuth({ sync: true });
  if (!userInfo) {
    return;
  }

  currentUser = userInfo;
  // 初始化已移除，不再需要 CloudBase
  restoreQuadrantSelection();
  updateUserDisplay('userName', 'userAvatar');
  bindEventListeners();
  bindAIEventListeners();
  updateQuadrantSelectorUI();
  await initAIConfig();
  await loadTasks();

  // 初始化 AI 聊天
  initAIChat();
}

// ==================== AI 助手功能 ====================

/**
 * 初始化 AI 聊天
 */
function initAIChat() {
  if (isAIInitialized) return;

  initChat({
    onMessageUpdate: (message, allMessages) => {
      renderAIChatMessages(allMessages);
    },
    onSessionUpdate: (sessions, currentSessionId) => {
      renderAIChatSessions(sessions, currentSessionId);
    },
    onError: (error) => {
      showError('AI 响应出错: ' + error.message);
    }
  });

  isAIInitialized = true;
}

/**
 * 渲染 AI 会话列表
 */
function renderAIChatSessions(sessions, currentSessionId) {
  const container = document.getElementById('aiChatSessionList');
  if (!container) return;

  container.innerHTML = '';

  if (!sessions || sessions.length === 0) {
    return;
  }

  sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = `ai-chat-session-item ${session.id === currentSessionId ? 'active' : ''}`;
    item.dataset.sessionId = session.id;
    
    item.innerHTML = `
      <div class="ai-chat-session-title">${escapeHtml(session.title || '新对话')}</div>
      <div class="ai-chat-session-date">${formatTime(session.updatedAt)}</div>
    `;

    item.addEventListener('click', () => {
      if (session.id !== currentSessionId) {
        switchSession(session.id);
      }
    });

    container.appendChild(item);
  });
}

/**
 * 切换 AI 模式
 */
function toggleAIMode() {
  isAIMode = !isAIMode;

  const aiBtn = document.getElementById('aiAssistantBtn');
  const taskMatrixContainer = document.getElementById('taskMatrixContainer');
  const aiChatContainer = document.getElementById('aiChatContainer');
  const inputBar = document.querySelector('.demo-input-bar');
  const taskInput = document.getElementById('taskInput');

  if (isAIMode) {
    // 切换到 AI 模式
    aiBtn.classList.add('active');
    taskMatrixContainer.classList.add('slide-out');

    setTimeout(() => {
      aiChatContainer.hidden = false;
      // 强制重绘以触发过渡动画
      void aiChatContainer.offsetHeight;
      aiChatContainer.classList.add('show');
    }, 100);

    inputBar.classList.add('ai-mode');
    taskInput.placeholder = '和 AI 助手对话...';

    // 检查配置
    if (!isAIConfigReady()) {
      // 显示欢迎消息和配置提示
      renderAIChatMessages([{
        id: 'welcome',
        type: MESSAGE_TYPE.SYSTEM,
        content: getWelcomeMessage() + '\n\n⚠️ 你还没有配置 AI 服务。点击左侧菜单中的"AI 设置"来配置你的 API Key。',
        timestamp: Date.now()
      }]);
    } else {
      // 显示欢迎消息
      const session = getCurrentSession();
      if (!session || session.messages.length === 0) {
        addMessage(MESSAGE_TYPE.SYSTEM, getWelcomeMessage());
      } else {
        renderAIChatMessages(session.messages);
      }
    }

    taskInput.focus();
  } else {
    // 切换回任务模式
    aiBtn.classList.remove('active');
    aiChatContainer.classList.remove('show');

    setTimeout(() => {
      aiChatContainer.hidden = true;
      taskMatrixContainer.classList.remove('slide-out');
    }, 300);

    inputBar.classList.remove('ai-mode');
    updateQuadrantSelectorUI();
  }
}

/**
 * 渲染 AI 聊天消息
 */
function renderAIChatMessages(messages) {
  const container = document.getElementById('aiChatMessages');
  if (!container) return;

  container.innerHTML = '';

  messages.forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = `ai-message ${msg.type}`;

    let avatarText = '';
    if (msg.type === MESSAGE_TYPE.USER) {
      avatarText = currentUser?.username?.charAt(0).toUpperCase() || 'U';
    } else if (msg.type === MESSAGE_TYPE.AI) {
      avatarText = 'AI';
    } else if (msg.type === MESSAGE_TYPE.SYSTEM) {
      avatarText = '⚡';
    } else if (msg.type === MESSAGE_TYPE.ERROR) {
      avatarText = '!';
    }

    msgEl.innerHTML = `
      <div class="ai-message-avatar">${avatarText}</div>
      <div class="ai-message-content">${escapeHtml(msg.content)}</div>
    `;

    container.appendChild(msgEl);
  });

  // 滚动到底部
  container.scrollTop = container.scrollHeight;
}

/**
 * 发送 AI 消息
 */
async function sendAIMessage() {
  const input = document.getElementById('taskInput');
  const content = input?.value?.trim();

  if (!content) return;

  // 检查配置
  if (!isAIConfigReady()) {
    showError('请先配置 AI 服务，点击左侧菜单中的"AI 设置"');
    return;
  }

  // 清空输入框
  input.value = '';

  // 显示打字指示器
  showAITypingIndicator();

  // 发送消息
  const result = await sendMessage(content, currentTasks);

  // 移除打字指示器
  hideAITypingIndicator();

  if (!result.success) {
    showError(result.error || '发送失败');
  }
}

/**
 * 显示 AI 打字指示器
 */
function showAITypingIndicator() {
  const container = document.getElementById('aiChatMessages');
  if (!container) return;

  const indicator = document.createElement('div');
  indicator.className = 'ai-message ai typing-indicator-container';
  indicator.id = 'aiTypingIndicator';
  indicator.innerHTML = `
    <div class="ai-message-avatar">AI</div>
    <div class="ai-message-content">
      <div class="ai-typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;

  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

/**
 * 隐藏 AI 打字指示器
 */
function hideAITypingIndicator() {
  const indicator = document.getElementById('aiTypingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

/**
 * 打开 AI 设置弹窗
 */
async function openAISettingsDialog() {
  const config = getAIConfig();

  return openStackedDialog({
    title: 'AI 设置',
    panelClassName: '',
    render: ({ body, close }) => {
      const providerOptions = Object.entries(AI_PROVIDERS).map(([key, p]) =>
        `<option value="${key}" ${config.provider === key ? 'selected' : ''}>${p.name}</option>`
      ).join('');

      const modelOptions = config.provider === 'custom'
        ? `<option value="">自定义模型</option>`
        : getProviderModels(config.provider).map(m =>
            `<option value="${m.id}" ${config.model === m.id ? 'selected' : ''}>${m.name}</option>`
          ).join('');

      const content = createDialogContent(`
        <form class="ai-settings-form" id="aiSettingsForm">
          <div class="ai-settings-field">
            <label class="ai-settings-label" for="aiProvider">LLM 提供商</label>
            <select class="ai-settings-select" id="aiProvider">
              ${providerOptions}
            </select>
          </div>

          <div class="ai-settings-field" id="customApiBaseField" ${config.provider !== 'custom' ? 'style="display:none"' : ''}>
            <label class="ai-settings-label" for="aiCustomApiBase">自定义 API 地址</label>
            <input type="text" class="ai-settings-input" id="aiCustomApiBase"
              placeholder="https://api.example.com/v1"
              value="${escapeHtml(config.customApiBase || '')}">
          </div>

          <div class="ai-settings-field" id="modelField" ${config.provider === 'custom' ? 'style="display:none"' : ''}>
            <label class="ai-settings-label" for="aiModel">模型</label>
            <select class="ai-settings-select" id="aiModel">
              ${modelOptions}
            </select>
          </div>

          <div class="ai-settings-field" id="customModelField" ${config.provider !== 'custom' ? 'style="display:none"' : ''}>
            <label class="ai-settings-label" for="aiCustomModel">自定义模型名称</label>
            <input type="text" class="ai-settings-input" id="aiCustomModel"
              placeholder="model-name"
              value="${escapeHtml(config.customModel || '')}">
          </div>

          <div class="ai-settings-field">
            <label class="ai-settings-label" for="aiApiKey">API Key</label>
            <input type="password" class="ai-settings-input" id="aiApiKey"
              placeholder="sk-..."
              value="${escapeHtml(config.apiKey || '')}">
            <p class="ai-settings-hint">你的 API Key 仅存储在本地浏览器中，不会上传到任何服务器。</p>
          </div>

          <div class="ai-settings-error" id="aiSettingsError"></div>

          <div class="task-dialog-actions">
            <button type="button" class="task-dialog-btn secondary" id="aiSettingsCancel">取消</button>
            <button type="submit" class="task-dialog-btn primary">保存</button>
          </div>
        </form>
      `, element => {
        const form = element;
        const providerSelect = element.querySelector('#aiProvider');
        const modelSelect = element.querySelector('#aiModel');
        const customApiBaseField = element.querySelector('#customApiBaseField');
        const modelField = element.querySelector('#modelField');
        const customModelField = element.querySelector('#customModelField');
        const customApiBaseInput = element.querySelector('#aiCustomApiBase');
        const customModelInput = element.querySelector('#aiCustomModel');
        const apiKeyInput = element.querySelector('#aiApiKey');
        const errorEl = element.querySelector('#aiSettingsError');
        const cancelBtn = element.querySelector('#aiSettingsCancel');

        // 提供商切换
        const handleProviderChange = () => {
          const provider = providerSelect.value;

          if (provider === 'custom') {
            customApiBaseField.style.display = 'block';
            customModelField.style.display = 'block';
            modelField.style.display = 'none';
          } else {
            customApiBaseField.style.display = 'none';
            customModelField.style.display = 'none';
            modelField.style.display = 'block';

            // 更新模型选项
            const models = getProviderModels(provider);
            const defaultModel = getProviderDefaultModel(provider);
            modelSelect.innerHTML = models.map(m =>
              `<option value="${m.id}" ${m.id === defaultModel ? 'selected' : ''}>${m.name}</option>`
            ).join('');
          }
        };

        // 提交表单
        const handleSubmit = (e) => {
          e.preventDefault();
          errorEl.textContent = '';

          const newConfig = {
            provider: providerSelect.value,
            apiKey: apiKeyInput.value.trim(),
            model: providerSelect.value === 'custom' ? '' : modelSelect.value,
            customApiBase: customApiBaseInput?.value?.trim() || '',
            customModel: customModelInput?.value?.trim() || ''
          };

          const validation = validateAIConfig(newConfig);
          if (!validation.valid) {
            errorEl.textContent = validation.error;
            return;
          }

          if (saveAIConfig(newConfig)) {
            showSuccess('设置已保存');
            close({ saved: true });
          } else {
            errorEl.textContent = '保存失败，请重试';
          }
        };

        const handleCancel = () => {
          close({ cancelled: true });
        };

        providerSelect.addEventListener('change', handleProviderChange);
        form.addEventListener('submit', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);

        return {
          cleanup: () => {
            providerSelect.removeEventListener('change', handleProviderChange);
            form.removeEventListener('submit', handleSubmit);
            cancelBtn.removeEventListener('click', handleCancel);
          },
          focusTarget: apiKeyInput.value ? null : apiKeyInput
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
 * 绑定 AI 相关事件监听器
 */
function bindAIEventListeners() {
  // AI 助手按钮
  document.getElementById('aiAssistantBtn')?.addEventListener('click', toggleAIMode);

  // AI 发送按钮
  document.getElementById('aiSendBtn')?.addEventListener('click', sendAIMessage);

  // AI 模式下按 Enter 发送
  document.getElementById('taskInput')?.addEventListener('keydown', event => {
    if (isAIMode && event.key === 'Enter') {
      event.preventDefault();
      sendAIMessage();
    }
  });

  // 抽屉菜单中的设置按钮
  document.getElementById('drawerSettingsBtn')?.addEventListener('click', async () => {
    await openAISettingsDialog();
  });

  // 新建会话按钮
  document.getElementById('aiChatNewBtn')?.addEventListener('click', () => {
    const session = createNewSession(true);
    if (session.messages.length === 0) {
      addMessage(MESSAGE_TYPE.SYSTEM, getWelcomeMessage());
    }
    document.getElementById('taskInput')?.focus();
  });
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
    renderDrawerTasks();
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
    toggleTask(task._id, !task.completed, taskElement, checkbox);
  });

  editButton.addEventListener('click', async event => {
    event.stopPropagation();
    await editTask(task._id);
  });

  deleteButton.addEventListener('click', async event => {
    event.stopPropagation();
    await deleteTask(task._id);
  });

  return taskElement;
}

function createTaskEditDialogContent(task, close) {
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
    const quadrant = element.querySelector('#taskEditQuadrant');
    const error = element.querySelector('[data-role="error"]');
    const cancelButton = element.querySelector('[data-role="cancel"]');

    content.value = task.content || '';
    quadrant.value = QUADRANT_CONFIG[task.quadrant] ? task.quadrant : currentQuadrant;
    error.textContent = '';

    const handleCancel = () => {
      close({ cancelled: true });
    };

    const handleSubmit = event => {
      event.preventDefault();

      const nextContent = content.value.trim();
      const nextQuadrant = quadrant.value.trim().toLowerCase();
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
        quadrant: nextQuadrant
      });
    };

    cancelButton.addEventListener('click', handleCancel);
    form.addEventListener('submit', handleSubmit);

    return {
      cleanup: () => {
        cancelButton.removeEventListener('click', handleCancel);
        form.removeEventListener('submit', handleSubmit);
      },
      focusTarget: content
    };
  });
}

function openTaskEditDialog(task) {
  return openStackedDialog({
    title: '编辑任务',
    render: ({ body, close }) => {
      const content = createTaskEditDialogContent(task, close);
      body.appendChild(content.element);
      return {
        cleanup: content.cleanup,
        focusTarget: content.focusTarget
      };
    }
  });
}

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

function collectTaskEditInput(task, options = {}) {
  const {
    promptFn = typeof window !== 'undefined' && typeof window.prompt === 'function'
      ? window.prompt.bind(window)
      : null
  } = options;

  if (typeof document !== 'undefined' && !options.forcePrompt) {
    return openTaskEditDialog(task);
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

async function addTask(content, quadrant = currentQuadrant) {
  const trimmedContent = validateTaskInput(content);
  if (!trimmedContent) {
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
    renderDrawerTasks();
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

async function toggleTask(taskId, completed, taskElement = null, triggerElement = null) {
  if (completed && taskElement) {
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
    
    taskElement.style.transition = 'all 0.3s ease';
    taskElement.style.opacity = '0';
    taskElement.style.height = taskElement.offsetHeight + 'px';
    
    // Trigger reflow
    void taskElement.offsetHeight;
    
    taskElement.style.height = '0';
    taskElement.style.padding = '0';
    taskElement.style.margin = '0';
    taskElement.style.overflow = 'hidden';
    
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

  renderTaskMatrix();
  renderDrawerTasks();
  updateHeaderStats();
  return true;
}

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
      quadrant: editResult.quadrant
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
            updatedAt: result.data?.updatedAt || new Date().toISOString()
          }
        : item
    ));

    renderTaskMatrix();
    renderDrawerTasks();
    updateHeaderStats();
    showSuccess('任务已更新');
    return true;
  } catch (error) {
    console.error('[App] 编辑任务失败', error);
    showError('编辑任务失败，请稍后重试');
    return false;
  }
}

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
  renderTaskMatrix();
  renderDrawerTasks();
  updateHeaderStats();
  showSuccess('任务已删除');
  return true;
}



function setCurrentQuadrant(quadrant) {
  if (!QUADRANT_CONFIG[quadrant]) {
    return;
  }

  currentQuadrant = quadrant;
  saveQuadrantSelection();
  updateQuadrantSelectorUI();
}

function renderDrawerTasks() {
  const drawerContent = document.getElementById('drawerContent');
  if (!drawerContent) return;

  const activeTab = document.querySelector('.drawer-tab.active')?.dataset.tab || 'today';
  
  const completedTasks = currentTasks
    .filter(t => t.completed)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay() || 7; // Convert Sunday(0) to 7
  startOfWeek.setDate(startOfWeek.getDate() - day + 1);

  const filteredTasks = completedTasks.filter(task => {
    const taskDate = new Date(task.updatedAt || task.createdAt);
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
      toggleTask(task._id, false);
    });

    const deleteBtn = item.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener('click', () => {
      deleteTask(task._id);
    });

    drawerContent.appendChild(item);
  });
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

  if (badge) {
    badge.textContent = `今日剩余 ${stats.pending} 个任务`;
  }

  document.title = stats.pending > 0 ? `(${stats.pending}) 铁腕 | 智能任务管理` : '铁腕 | 智能任务管理';
}

function bindEventListeners() {
  document.getElementById('sendBtn')?.addEventListener('click', () => {
    if (isAIMode) return;
    const input = document.getElementById('taskInput');
    addTask(input?.value || '', currentQuadrant);
  });

  document.getElementById('taskInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (isAIMode) return;
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

  document.getElementById('logoutBtn')?.addEventListener('click', async event => {
    await confirmBeforeLogout({ triggerElement: event.currentTarget });
  });

  // 抽屉相关事件
  document.getElementById('menuBtn')?.addEventListener('click', () => {
    document.getElementById('completedDrawer')?.classList.add('show');
    document.getElementById('drawerOverlay')?.classList.add('show');
    document.body.classList.add('drawer-open');
    renderDrawerTasks();
  });

  document.getElementById('drawerCloseBtn')?.addEventListener('click', () => {
    document.getElementById('completedDrawer')?.classList.remove('show');
    document.getElementById('drawerOverlay')?.classList.remove('show');
    document.body.classList.remove('drawer-open');
  });

  document.getElementById('drawerOverlay')?.addEventListener('click', () => {
    document.getElementById('completedDrawer')?.classList.remove('show');
    document.getElementById('drawerOverlay')?.classList.remove('show');
    document.body.classList.remove('drawer-open');
  });

  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderDrawerTasks();
    });
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
  collectTaskEditInput,
  confirmBeforeDeleteTask,
  confirmBeforeLogout,
  currentQuadrant,
  currentTasks,
  deleteTask,
  editTask,
  formatTime,
  groupTasksByQuadrant,
  initApp,
  loadTasks,
  runConfirmedAction,
  showToast,
  toggleTask
};

export default {
  initApp,
  loadTasks,
  addTask,
  toggleTask,
  editTask,
  deleteTask
};
