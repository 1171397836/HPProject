/**
 * AI 控制器模块
 * 处理 AI 助手相关逻辑，包括聊天界面、设置对话框和流式响应
 */

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
  cancelStream,
  clearChatHistory,
  createNewSession,
  switchSession,
  getCurrentSession,
  getMessages,
  getWelcomeMessage,
  initChat,
  isGenerating,
  MESSAGE_TYPE,
  sendMessageStream,
  setCallbacks
} from './aiChat.js';
import { createDialogContent, openStackedDialog } from './dialog.js';
import { escapeHtml, formatTime, showError, showSuccess } from './uiController.js';

// AI 状态
let isAIMode = false;
let isAIInitialized = false;
let currentUser = null;
let currentTasks = [];
let isGeneratingState = false;
let currentGeneratingMessageId = null; // 当前正在生成的消息ID

/**
 * 设置当前用户
 * @param {Object} user - 用户对象
 */
function setCurrentUser(user) {
  currentUser = user;
}

/**
 * 设置当前任务列表
 * @param {Array} tasks - 任务列表
 */
function setCurrentTasks(tasks) {
  currentTasks = tasks;
}

/**
 * 获取 AI 模式状态
 * @returns {boolean}
 */
function getIsAIMode() {
  return isAIMode;
}

/**
 * 设置 AI 模式状态
 * @param {boolean} mode - AI 模式状态
 */
function setIsAIMode(mode) {
  isAIMode = mode;
}

/**
 * 初始化 AI 聊天
 */
function initAIChat() {
  if (isAIInitialized) return;

  initChat({
    onMessageUpdate: (message, allMessages) => {
      // 传递生成状态信息给渲染函数
      renderAIChatMessages(allMessages, {
        isGenerating: isGeneratingState,
        generatingMessageId: currentGeneratingMessageId
      });
    },
    onSessionUpdate: (sessions, currentSessionId) => {
      renderAIChatSessions(sessions, currentSessionId);
    },
    onStreamStart: (messageId) => {
      // 流式响应开始，记录正在生成的消息ID
      console.log('[AIController] 流式响应开始，消息ID:', messageId);
      isGeneratingState = true;
      currentGeneratingMessageId = messageId;
      updateSendButtonState(true);
      // 立即重新渲染以显示转圈
      const session = getCurrentSession();
      if (session) {
        renderAIChatMessages(session.messages, {
          isGenerating: true,
          generatingMessageId: messageId
        });
      }
    },
    onStreamEnd: (message) => {
      // 流式响应结束
      console.log('[AIController] 流式响应结束');
      isGeneratingState = false;
      currentGeneratingMessageId = null;
      updateSendButtonState(false);
      // 重新渲染消息列表以移除转圈指示器
      const session = getCurrentSession();
      if (session) {
        renderAIChatMessages(session.messages);
      }
    },
    onError: (error) => {
      showError('AI 响应出错: ' + error.message);
      isGeneratingState = false;
      currentGeneratingMessageId = null;
      updateSendButtonState(false);
    }
  });

  isAIInitialized = true;
}

/**
 * 渲染 AI 会话列表
 * @param {Array} sessions - 会话列表
 * @param {string} currentSessionId - 当前会话ID
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

    // 初始化发送按钮状态
    updateSendButtonState(isGeneratingState);

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
    // 恢复任务输入框占位符
    const taskTypeBtn = document.getElementById('taskTypeBtn');
    if (taskTypeBtn && taskInput) {
      const quadrant = taskTypeBtn.textContent.toLowerCase().replace('q', 'q');
      const quadrantNames = {
        q1: '立即做',
        q2: '计划做',
        q3: '委托做',
        q4: '不做'
      };
      taskInput.placeholder = `添加${quadrantNames[quadrant] || '任务'}任务，例如：下午3点开会...`;
    }
  }
}

/**
 * 渲染 AI 聊天消息
 * @param {Array} messages - 消息列表
 * @param {Object} options - 渲染选项
 * @param {boolean} options.isGenerating - 是否正在生成中
 * @param {string} options.generatingMessageId - 正在生成的消息ID
 */
function renderAIChatMessages(messages, options = {}) {
  const container = document.getElementById('aiChatMessages');
  if (!container) return;

  container.innerHTML = '';

  messages.forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = `ai-message ${msg.type}`;
    msgEl.dataset.messageId = msg.id;

    let avatarText = '';
    let contentHtml = '';

    if (msg.type === MESSAGE_TYPE.USER) {
      avatarText = currentUser?.username?.charAt(0).toUpperCase() || 'U';
      contentHtml = `<div class="ai-message-content">${escapeHtml(msg.content)}</div>`;
    } else if (msg.type === MESSAGE_TYPE.AI) {
      avatarText = 'AI';
      // 检查是否正在生成这条消息
      const isThisGenerating = options.isGenerating && options.generatingMessageId === msg.id;
      const indicatorHtml = isThisGenerating ? '<div class="ai-generating-indicator"></div>' : '';
      contentHtml = `
        <div class="ai-message-content-wrapper">
          <div class="ai-message-content">${escapeHtml(msg.content)}</div>
          ${indicatorHtml}
        </div>
      `;
    } else if (msg.type === MESSAGE_TYPE.SYSTEM) {
      avatarText = '⚡';
      contentHtml = escapeHtml(msg.content);
    } else if (msg.type === MESSAGE_TYPE.ERROR) {
      avatarText = '!';
      contentHtml = escapeHtml(msg.content);
    } else if (msg.type === MESSAGE_TYPE.LOADING) {
      avatarText = 'AI';
      contentHtml = `
        <div class="ai-loading-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="ai-message-avatar">${avatarText}</div>
      <div class="ai-message-content-outer">${contentHtml}</div>
    `;

    container.appendChild(msgEl);
  });

  // 滚动到底部
  container.scrollTop = container.scrollHeight;
}

/**
 * 显示 AI 打字指示器
 */
function showAITypingIndicator() {
  const container = document.getElementById('aiChatMessages');
  if (!container) return;

  // 如果已存在则不再添加
  if (document.getElementById('aiTypingIndicator')) return;

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
 * 更新发送/停止按钮状态
 * @param {boolean} generating - 是否正在生成
 */
function updateSendButtonState(generating) {
  isGeneratingState = generating;
  const sendBtn = document.getElementById('aiSendBtn');
  const stopBtn = document.getElementById('aiStopBtn');

  if (generating) {
    // 显示停止按钮，隐藏发送按钮
    if (sendBtn) sendBtn.hidden = true;
    if (stopBtn) stopBtn.hidden = false;
  } else {
    // 显示发送按钮，隐藏停止按钮
    if (sendBtn) sendBtn.hidden = false;
    if (stopBtn) stopBtn.hidden = true;
  }
}

/**
 * 停止 AI 生成
 */
function stopAIGeneration() {
  if (isGeneratingState) {
    cancelStream();
    isGeneratingState = false;
    currentGeneratingMessageId = null;
    updateSendButtonState(false);
    // 重新渲染以移除转圈
    const session = getCurrentSession();
    if (session) {
      renderAIChatMessages(session.messages);
    }
  }
}

/**
 * 发送 AI 消息（使用流式响应）
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

  // 更新按钮为停止状态
  updateSendButtonState(true);

  // 使用流式发送消息
  const result = await sendMessageStream(content, currentTasks);

  // 恢复按钮为发送状态
  updateSendButtonState(false);

  if (!result.success && !result.cancelled) {
    showError(result.error || '发送失败');
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

          <div class="ai-settings-field">
            <div class="ai-settings-toggle-wrapper">
              <label class="ai-settings-toggle-label" for="aiSyncToCloud">
                <span class="ai-settings-toggle-text">同步到云端</span>
                <span class="ai-settings-toggle-switch">
                  <input type="checkbox" id="aiSyncToCloud" ${config.syncToCloud ? 'checked' : ''}>
                  <span class="ai-settings-toggle-slider"></span>
                </span>
              </label>
              <p class="ai-settings-hint">开启后，非敏感配置将同步到云端，换设备登录时可恢复（API Key 始终仅保存在本地）</p>
            </div>
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
        const syncToCloudInput = element.querySelector('#aiSyncToCloud');
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
            customModel: customModelInput?.value?.trim() || '',
            syncToCloud: syncToCloudInput?.checked || false
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
 * @param {Object} callbacks - 回调函数
 */
function bindAIEventListeners(callbacks = {}) {
  // AI 助手按钮
  document.getElementById('aiAssistantBtn')?.addEventListener('click', toggleAIMode);

  // AI 发送按钮
  document.getElementById('aiSendBtn')?.addEventListener('click', sendAIMessage);

  // AI 停止按钮
  document.getElementById('aiStopBtn')?.addEventListener('click', stopAIGeneration);

  // AI 模式下按 Enter 发送
  document.getElementById('taskInput')?.addEventListener('keydown', event => {
    if (isAIMode && event.key === 'Enter') {
      event.preventDefault();
      if (isGeneratingState) {
        stopAIGeneration();
      } else {
        sendAIMessage();
      }
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

export {
  bindAIEventListeners,
  getIsAIMode,
  initAIChat,
  initAIConfig,
  openAISettingsDialog,
  renderAIChatMessages,
  renderAIChatSessions,
  sendAIMessage,
  setCurrentTasks,
  setCurrentUser,
  setIsAIMode,
  toggleAIMode,
  MESSAGE_TYPE,
  addMessage,
  createNewSession,
  getCurrentSession,
  getWelcomeMessage
};

export default {
  initAIChat,
  initAIConfig,
  toggleAIMode,
  sendAIMessage,
  openAISettingsDialog,
  bindAIEventListeners,
  renderAIChatMessages,
  renderAIChatSessions,
  setCurrentUser,
  setCurrentTasks,
  getIsAIMode,
  setIsAIMode
};
