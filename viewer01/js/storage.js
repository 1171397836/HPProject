/**
 * 任务数据统一访问层
 * - 仅使用 localStorage 进行本地存储
 */

import { getCurrentUser } from './auth.js';
import CONFIG from './config.js';

const globalScope = typeof window !== 'undefined' ? window : globalThis;
const STORAGE_KEY_TASKS = CONFIG.STORAGE_KEYS.TASKS_DB;
const MAX_TASK_LENGTH = 200;
const VALID_QUADRANTS = ['q1', 'q2', 'q3', 'q4'];

const ERROR_MESSAGES = {
  AUTH_FAIL: '登录已过期，请重新登录',
  DB_ERROR: '数据库操作失败',
  DOC_NOT_EXIST: '任务不存在或已被删除',
  INVALID_QUADRANT: '无效的象限值',
  PARAM_ERROR: '参数错误，请检查输入内容',
  UNKNOWN_ERROR: '发生未知错误，请稍后重试'
};

function createMemoryStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

const safeStorage = (() => {
  try {
    if (globalScope.localStorage) {
      return globalScope.localStorage;
    }
  } catch (error) {
    console.warn('[TaskDB] localStorage 不可用，回退到内存存储', error);
  }

  return createMemoryStorage();
})();

function handleError(error, defaultMessage = '操作失败') {
  const errorCode = error?.code || 'UNKNOWN_ERROR';

  return {
    code: errorCode,
    message: ERROR_MESSAGES[errorCode] || defaultMessage,
    originalError: error || null,
    timestamp: new Date().toISOString()
  };
}

function readTasks() {
  try {
    const rawValue = safeStorage.getItem(STORAGE_KEY_TASKS);
    return rawValue ? JSON.parse(rawValue) : [];
  } catch (error) {
    console.warn('[TaskDB] 读取本地任务失败', error);
    return [];
  }
}

function writeTasks(tasks) {
  safeStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
}

function validateTaskContent(content) {
  const normalizedContent = typeof content === 'string' ? content.trim() : '';

  if (!normalizedContent) {
    return {
      valid: false,
      normalizedContent,
      error: {
        code: 'PARAM_ERROR',
        message: '请输入任务内容',
        originalError: null,
        timestamp: new Date().toISOString()
      }
    };
  }

  if (normalizedContent.length > MAX_TASK_LENGTH) {
    return {
      valid: false,
      normalizedContent,
      error: {
        code: 'PARAM_ERROR',
        message: `任务内容不能超过${MAX_TASK_LENGTH}个字符`,
        originalError: null,
        timestamp: new Date().toISOString()
      }
    };
  }

  return {
    valid: true,
    normalizedContent,
    error: null
  };
}

function normalizeTask(task) {
  return {
    ...task,
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString()
  };
}

function getUserOrAuthError() {
  const user = getCurrentUser();

  if (!user?.uid) {
    return {
      success: false,
      error: handleError({ code: 'AUTH_FAIL' }, '用户未登录')
    };
  }

  return {
    success: true,
    user
  };
}

const taskDB = {
  async getTasks() {
    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, data: [], error: authState.error };
    }

    const tasks = readTasks()
      .filter(task => task.uid === authState.user.uid)
      .map(normalizeTask)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

    return {
      success: true,
      data: tasks,
      error: null
    };
  },

  async addTask(content, quadrant) {
    const contentValidation = validateTaskContent(content);
    if (!contentValidation.valid) {
      return { success: false, data: null, error: contentValidation.error };
    }

    if (!VALID_QUADRANTS.includes(quadrant)) {
      return { success: false, data: null, error: handleError({ code: 'INVALID_QUADRANT' }, '无效的象限值') };
    }

    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, data: null, error: authState.error };
    }

    const tasks = readTasks();
    const now = new Date().toISOString();
    const task = {
      _id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      uid: authState.user.uid,
      content: contentValidation.normalizedContent,
      quadrant,
      completed: false,
      createdAt: now,
      updatedAt: now
    };

    tasks.push(task);
    writeTasks(tasks);

    return {
      success: true,
      data: task,
      error: null
    };
  },

  async updateTask(taskId, completed) {
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, data: null, error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空') };
    }

    if (typeof completed !== 'boolean') {
      return { success: false, data: null, error: handleError({ code: 'PARAM_ERROR' }, '任务状态不合法') };
    }

    return this.updateTaskContent(taskId, { completed });
  },

  async updateTaskContent(taskId, updateData = {}) {
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, data: null, error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空') };
    }

    let contentValidation = null;
    if (updateData.content !== undefined) {
      contentValidation = validateTaskContent(updateData.content);
      if (!contentValidation.valid) {
        return { success: false, data: null, error: contentValidation.error };
      }
    }

    if (updateData.quadrant !== undefined && !VALID_QUADRANTS.includes(updateData.quadrant)) {
      return { success: false, data: null, error: handleError({ code: 'INVALID_QUADRANT' }, '无效的象限值') };
    }

    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, data: null, error: authState.error };
    }

    const sanitizedUpdates = {
      ...updateData
    };

    if (contentValidation) {
      sanitizedUpdates.content = contentValidation.normalizedContent;
    }

    const tasks = readTasks();
    const taskIndex = tasks.findIndex(task => task._id === taskId && task.uid === authState.user.uid);

    if (taskIndex === -1) {
      return {
        success: false,
        data: null,
        error: handleError({ code: 'DOC_NOT_EXIST' }, '任务不存在')
      };
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...sanitizedUpdates,
      updatedAt: new Date().toISOString()
    };
    writeTasks(tasks);

    return {
      success: true,
      data: tasks[taskIndex],
      error: null
    };
  },

  async deleteTask(taskId) {
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空') };
    }

    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, error: authState.error };
    }

    const tasks = readTasks();
    const nextTasks = tasks.filter(task => !(task._id === taskId && task.uid === authState.user.uid));

    if (nextTasks.length === tasks.length) {
      return {
        success: false,
        error: handleError({ code: 'DOC_NOT_EXIST' }, '任务不存在')
      };
    }

    writeTasks(nextTasks);

    return {
      success: true,
      error: null
    };
  },

  async clearCompleted() {
    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, deletedCount: 0, error: authState.error };
    }

    const tasks = readTasks();
    const completedTasks = tasks.filter(task => task.uid === authState.user.uid && task.completed);
    const nextTasks = tasks.filter(task => !(task.uid === authState.user.uid && task.completed));

    writeTasks(nextTasks);

    return {
      success: true,
      deletedCount: completedTasks.length,
      error: null
    };
  }
};

const auth = {
  getCurrentUser
};

export {
  ERROR_MESSAGES,
  MAX_TASK_LENGTH,
  auth,
  handleError,
  taskDB,
  validateTaskContent
};

export default {
  taskDB
};