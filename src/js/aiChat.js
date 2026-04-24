/**
 * AI 聊天核心逻辑模块
 * 处理与 LLM API 的通信、消息管理、流式输出等
 */

import { getAIConfig, getApiBase, getModelId, validateAIConfig } from './aiConfig.js';
import { AI_PERSONA, ANSWER_STYLE } from './prompts/roleConfig.js';
import { AI_CAPABILITIES, QUADRANT_RULES } from './prompts/taskRules.js';
import { WELCOME_MESSAGE, EMPTY_TASK_MESSAGE } from './prompts/uiMessages.js';
import { getCurrentUser } from './auth.js';
import { getMondayOfWeek } from './drawerController.js';

// 消息类型定义
const MESSAGE_TYPE = {
  USER: 'user',
  AI: 'ai',
  SYSTEM: 'system',
  ERROR: 'error',
  LOADING: 'loading'
};

const MAX_HISTORY_LENGTH = 50; // 最多保留 50 条消息

// 会话管理状态
let sessions = [];
let currentSessionId = null;
let isStreaming = false;
let abortController = null;
let saveHistoryTimer = null;

// 回调函数存储
const callbacks = {
  onMessageUpdate: null,
  onSessionUpdate: null,
  onStreamStart: null,
  onStreamEnd: null,
  onError: null
};

function getStorageKey() {
  const user = getCurrentUser();
  const userId = user ? user.uid : 'default';
  return `tiewan_ai_chat_history_${userId}`;
}

/**
 * 获取安全的 localStorage 引用
 */
function getSafeStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    console.warn('[AIChat] localStorage 不可用', error);
  }
  return null;
}

/**
 * 加载聊天历史
 */
function loadChatHistory() {
  const storage = getSafeStorage();
  if (!storage) return;

  try {
    const saved = storage.getItem(getStorageKey());
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        sessions = parsed;
      }
    }
  } catch (error) {
    console.warn('[AIChat] 加载历史失败', error);
  }

  if (sessions.length === 0) {
    createNewSession(false);
  } else {
    // 降序排序，最新的在前面
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    currentSessionId = sessions[0].id;
  }
  
  if (callbacks.onSessionUpdate) {
    callbacks.onSessionUpdate(sessions, currentSessionId);
  }
}

/**
 * 保存聊天历史
 */
function saveChatHistory() {
  const storage = getSafeStorage();
  if (!storage) return;

  try {
    // 限制每个会话的消息数量
    sessions.forEach(session => {
      if (session.messages.length > MAX_HISTORY_LENGTH) {
        session.messages = session.messages.slice(-MAX_HISTORY_LENGTH);
      }
    });
    storage.setItem(getStorageKey(), JSON.stringify(sessions));
  } catch (error) {
    console.warn('[AIChat] 保存历史失败', error);
  }
}

/**
 * 创建新会话
 */
function createNewSession(notify = true) {
  const current = getCurrentSession();
  // 如果当前会话没有任何用户消息，直接复用
  if (current && current.messages.filter(m => m.type === MESSAGE_TYPE.USER).length === 0) {
    if (notify && callbacks.onSessionUpdate) {
      callbacks.onSessionUpdate(sessions, currentSessionId);
    }
    if (notify && callbacks.onMessageUpdate) {
      callbacks.onMessageUpdate(null, current.messages);
    }
    return current;
  }

  const newSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: '新对话',
    messages: [],
    updatedAt: Date.now()
  };
  sessions.unshift(newSession);
  currentSessionId = newSession.id;
  saveChatHistory();
  
  if (notify && callbacks.onSessionUpdate) {
    callbacks.onSessionUpdate(sessions, currentSessionId);
  }
  if (notify && callbacks.onMessageUpdate) {
    callbacks.onMessageUpdate(null, []);
  }
  return newSession;
}

/**
 * 切换会话
 */
function switchSession(sessionId) {
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    currentSessionId = sessionId;
    if (callbacks.onSessionUpdate) {
      callbacks.onSessionUpdate(sessions, currentSessionId);
    }
    if (callbacks.onMessageUpdate) {
      callbacks.onMessageUpdate(null, session.messages);
    }
  }
}

/**
 * 获取当前会话
 */
function getCurrentSession() {
  return sessions.find(s => s.id === currentSessionId);
}

/**
 * 更新会话标题
 */
function updateSessionTitle(session) {
  if (session && session.messages.length > 0) {
    const firstUserMsg = session.messages.find(m => m.type === MESSAGE_TYPE.USER);
    if (firstUserMsg) {
      let title = firstUserMsg.content.trim();
      session.title = title.substring(0, 15) + (title.length > 15 ? '...' : '');
    }
  }
}

/**
 * 清空聊天历史
 */
function clearChatHistory() {
  sessions = [];
  createNewSession(true);
}

/**
 * 设置回调函数
 * @param {Object} newCallbacks - 回调函数对象
 */
function setCallbacks(newCallbacks) {
  Object.assign(callbacks, newCallbacks);
}

/**
 * 添加消息到会话
 * @param {string} type - 消息类型
 * @param {string} content - 消息内容
 * @param {Object} metadata - 额外元数据
 * @returns {Object} 创建的消息对象
 */
function addMessage(type, content, metadata = {}) {
  const session = getCurrentSession();
  if (!session) return null;

  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    content,
    timestamp: Date.now(),
    ...metadata
  };

  session.messages.push(message);
  session.updatedAt = Date.now();
  
  if (type === MESSAGE_TYPE.USER && session.messages.filter(m => m.type === MESSAGE_TYPE.USER).length === 1) {
    updateSessionTitle(session);
    if (callbacks.onSessionUpdate) {
      callbacks.onSessionUpdate(sessions, currentSessionId);
    }
  }
  
  saveChatHistory();

  if (callbacks.onMessageUpdate) {
    callbacks.onMessageUpdate(message, session.messages);
  }

  return message;
}

/**
 * 更新消息内容（用于流式输出）
 * @param {string} messageId - 消息 ID
 * @param {string} content - 新内容
 */
function updateMessage(messageId, content) {
  const session = getCurrentSession();
  if (!session) return;

  const message = session.messages.find(m => m.id === messageId);
  if (message) {
    message.content = content;
    message.timestamp = Date.now();
    session.updatedAt = Date.now();

    if (callbacks.onMessageUpdate) {
      callbacks.onMessageUpdate(message, session.messages);
    }

    if (isStreaming) {
      if (saveHistoryTimer) clearTimeout(saveHistoryTimer);
      saveHistoryTimer = setTimeout(() => {
        saveChatHistory();
        saveHistoryTimer = null;
      }, 800);
    } else {
      saveChatHistory();
    }
  }
}

/**
 * 获取所有任务数据的系统提示词
 * @param {Array} tasks - 任务列表
 * @returns {string} 系统提示词
 */
function buildSystemPrompt(tasks) {
  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  // 计算当日和本周完成的任务
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // 获取本周一零点
  const mondayOfWeek = getMondayOfWeek(now);

  // 当日完成的任务（今天0点到现在）
  const todayCompletedTasks = completedTasks.filter(task => {
    if (!task.completedAt) return false;
    const completedDate = new Date(task.completedAt);
    return completedDate >= now;
  });

  // 本周完成的任务（本周一0点到现在）
  const weekCompletedTasks = completedTasks.filter(task => {
    if (!task.completedAt) return false;
    const completedDate = new Date(task.completedAt);
    return completedDate >= mondayOfWeek;
  });

  // 按象限分组
  const quadrantNames = {
    q1: '重要且紧急（立即做）',
    q2: '重要不紧急（计划做）',
    q3: '紧急不重要（委托做）',
    q4: '不重要不紧急（不做）'
  };

  const tasksByQuadrant = {};
  pendingTasks.forEach(task => {
    if (!tasksByQuadrant[task.quadrant]) {
      tasksByQuadrant[task.quadrant] = [];
    }
    tasksByQuadrant[task.quadrant].push(task);
  });

  let taskDescription = '';
  Object.entries(tasksByQuadrant).forEach(([quadrant, quadrantTasks]) => {
    taskDescription += `\n【${quadrantNames[quadrant]}】\n`;
    quadrantTasks.forEach((task, index) => {
      taskDescription += `${index + 1}. ${task.content}\n`;
    });
  });

  if (pendingTasks.length === 0) {
    taskDescription = EMPTY_TASK_MESSAGE;
  }

  // 构建当日和本周完成任务列表字符串
  const todayTaskList = todayCompletedTasks.length > 0
    ? todayCompletedTasks.map(t => t.content).join('、')
    : '无';
  const weekTaskList = weekCompletedTasks.length > 0
    ? weekCompletedTasks.map(t => t.content).join('、')
    : '无';

  return `${AI_PERSONA}

## 当前用户的任务情况
待办任务总数：${pendingTasks.length} 个
已完成任务：${completedTasks.length} 个
当日完成：${todayCompletedTasks.length} 个（${todayTaskList}）
本周完成：${weekCompletedTasks.length} 个（${weekTaskList}）

## 待办任务详情${taskDescription}

${AI_CAPABILITIES}

${ANSWER_STYLE}

${QUADRANT_RULES}`;
}

/**
 * 发送消息到 LLM API（非流式）
 * @param {string} userMessage - 用户消息
 * @param {Array} tasks - 当前用户的所有任务
 * @returns {Promise<Object>} 响应结果
 */
async function sendMessage(userMessage, tasks = []) {
  const config = getAIConfig();
  const validation = validateAIConfig(config);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      message: null
    };
  }

  // 添加用户消息
  addMessage(MESSAGE_TYPE.USER, userMessage);

  const apiBase = getApiBase(config);
  const modelId = getModelId(config);

  // 构建消息历史
  const session = getCurrentSession();
  const systemPrompt = buildSystemPrompt(tasks);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...session.messages
      .filter(m => m.type === MESSAGE_TYPE.USER || m.type === MESSAGE_TYPE.AI)
      .slice(-10) // 只保留最近 10 轮对话
      .map(m => ({
        role: m.type === MESSAGE_TYPE.USER ? 'user' : 'assistant',
        content: m.content
      }))
      .filter(m => m.content && m.content.trim() !== '') // 过滤掉内容为空的消息
  ];

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        temperature: 1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || '';

    // 添加 AI 回复
    const aiMessage = addMessage(MESSAGE_TYPE.AI, aiContent);

    return {
      success: true,
      message: aiMessage,
      content: aiContent
    };

  } catch (error) {
    console.error('[AIChat] 发送消息失败:', error);

    const errorMessage = addMessage(MESSAGE_TYPE.ERROR, `发送失败: ${error.message}`);

    if (callbacks.onError) {
      callbacks.onError(error);
    }

    return {
      success: false,
      error: error.message,
      message: errorMessage
    };
  }
}

/**
 * 发送消息到 LLM API（流式输出）
 * @param {string} userMessage - 用户消息
 * @param {Array} tasks - 当前用户的所有任务
 * @returns {Promise<Object>} 响应结果
 */
async function sendMessageStream(userMessage, tasks = []) {
  const config = getAIConfig();
  const validation = validateAIConfig(config);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      message: null
    };
  }

  // 添加用户消息
  addMessage(MESSAGE_TYPE.USER, userMessage);

  // 创建 loading 状态消息占位符
  const loadingMessage = addMessage(MESSAGE_TYPE.LOADING, '');

  // 创建 AbortController 用于取消请求
  abortController = new AbortController();
  isStreaming = true;

  const apiBase = getApiBase(config);
  const modelId = getModelId(config);

  // 构建消息历史
  const session = getCurrentSession();
  const systemPrompt = buildSystemPrompt(tasks);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...session.messages
      .filter(m => m.type === MESSAGE_TYPE.USER || m.type === MESSAGE_TYPE.AI)
      .slice(-10)
      .map(m => ({
        role: m.type === MESSAGE_TYPE.USER ? 'user' : 'assistant',
        content: m.content
      }))
      .filter(m => m.content && m.content.trim() !== '') // 过滤掉内容为空的消息
  ];

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        temperature: 1,
        max_tokens: 2000,
        stream: true
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    // 收到第一个响应后，将 loading 消息替换为 AI 消息
    // 先移除 loading 消息
    const loadingIndex = session.messages.findIndex(m => m.id === loadingMessage.id);
    if (loadingIndex !== -1) {
      session.messages.splice(loadingIndex, 1);
    }
    // 创建实际的 AI 消息
    const aiMessage = addMessage(MESSAGE_TYPE.AI, '');

    // 通知流式开始，传递消息ID
    if (callbacks.onStreamStart) {
      callbacks.onStreamStart(aiMessage.id);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.trim() === 'data: [DONE]') continue;

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              updateMessage(aiMessage.id, fullContent);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    isStreaming = false;
    if (saveHistoryTimer) { clearTimeout(saveHistoryTimer); saveHistoryTimer = null; }
    saveChatHistory();

    if (callbacks.onStreamEnd) {
      callbacks.onStreamEnd(aiMessage);
    }

    return {
      success: true,
      message: aiMessage,
      content: fullContent
    };

  } catch (error) {
    isStreaming = false;

    // 移除 loading 消息
    const session = getCurrentSession();
    const loadingIndex = session.messages.findIndex(m => m.id === loadingMessage.id);
    if (loadingIndex !== -1) {
      session.messages.splice(loadingIndex, 1);
      saveChatHistory();
      if (callbacks.onMessageUpdate) {
        callbacks.onMessageUpdate(null, session.messages);
      }
    }

    if (error.name === 'AbortError') {
      if (saveHistoryTimer) { clearTimeout(saveHistoryTimer); saveHistoryTimer = null; }
      saveChatHistory();
      return {
        success: true,
        message: null,
        content: '',
        cancelled: true
      };
    }

    console.error('[AIChat] 流式发送失败:', error);

    // 添加错误消息
    const errorMessage = addMessage(MESSAGE_TYPE.ERROR, `发送失败: ${error.message}`);

    if (callbacks.onError) {
      callbacks.onError(error);
    }

    return {
      success: false,
      error: error.message,
      message: errorMessage
    };
  }
}

/**
 * 取消当前的流式请求
 */
function cancelStream() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  isStreaming = false;
  if (saveHistoryTimer) { clearTimeout(saveHistoryTimer); saveHistoryTimer = null; }
  saveChatHistory();
}

/**
 * 检查是否正在流式生成
 * @returns {boolean}
 */
function isGenerating() {
  return isStreaming;
}

/**
 * 获取当前会话的所有消息
 * @returns {Array} 消息列表
 */
function getMessages() {
  const session = getCurrentSession();
  return session ? [...session.messages] : [];
}

/**
 * 初始化聊天会话
 * @param {Object} options - 初始化选项
 */
function initChat(options = {}) {
  // 设置回调
  if (options.onMessageUpdate) {
    callbacks.onMessageUpdate = options.onMessageUpdate;
  }
  if (options.onSessionUpdate) {
    callbacks.onSessionUpdate = options.onSessionUpdate;
  }
  if (options.onStreamStart) {
    callbacks.onStreamStart = options.onStreamStart;
  }
  if (options.onStreamEnd) {
    callbacks.onStreamEnd = options.onStreamEnd;
  }
  if (options.onError) {
    callbacks.onError = options.onError;
  }
  
  // 加载历史消息
  loadChatHistory();
}

/**
 * 获取欢迎消息
 * @returns {string}
 */
function getWelcomeMessage() {
  return WELCOME_MESSAGE;
}

export {
  MESSAGE_TYPE,
  addMessage,
  buildSystemPrompt,
  cancelStream,
  clearChatHistory,
  createNewSession,
  switchSession,
  getCurrentSession,
  getMessages,
  getWelcomeMessage,
  initChat,
  isGenerating,
  loadChatHistory,
  saveChatHistory,
  sendMessage,
  sendMessageStream,
  setCallbacks
};

export default {
  initChat,
  sendMessage,
  sendMessageStream,
  cancelStream,
  isGenerating,
  getMessages,
  addMessage,
  clearChatHistory,
  createNewSession,
  switchSession,
  getCurrentSession,
  setCallbacks,
  getWelcomeMessage,
  buildSystemPrompt,
  MESSAGE_TYPE
};
