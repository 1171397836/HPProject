/**
 * 任务数据统一访问层
 * - 本地开发默认走 localStorage，解除 CloudBase 域名限制导致的本地阻塞
 * - 线上如可用，仍可继续接入 CloudBase
 */

import { CLOUDBASE_ENV, getCurrentUser, shouldUseLocalAuth } from './auth.js';

const globalScope = typeof window !== 'undefined' ? window : globalThis;
const STORAGE_KEY_TASKS = 'tiewan_tasks_db';
const VALID_QUADRANTS = ['q1', 'q2', 'q3', 'q4'];

const ERROR_MESSAGES = {
  AUTH_FAIL: '登录已过期，请重新登录',
  DB_ERROR: '数据库操作失败',
  DOC_NOT_EXIST: '任务不存在或已被删除',
  INVALID_QUADRANT: '无效的象限值',
  NETWORK_ERROR: '网络连接失败，请稍后重试',
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

let cloudbase = null;

function handleError(error, defaultMessage = '操作失败') {
  const errorCode = error?.code || 'UNKNOWN_ERROR';

  return {
    code: errorCode,
    message: ERROR_MESSAGES[errorCode] || defaultMessage,
    originalError: error || null,
    timestamp: new Date().toISOString()
  };
}

function shouldUseLocalTaskMode() {
  return shouldUseLocalAuth();
}

function initCloudBase() {
  if (shouldUseLocalTaskMode()) {
    return null;
  }

  if (cloudbase) {
    return cloudbase;
  }

  if (typeof globalScope.cloudbase === 'undefined' || typeof globalScope.cloudbase.init !== 'function') {
    return null;
  }

  try {
    cloudbase = globalScope.cloudbase.init({
      env: CLOUDBASE_ENV,
      persistence: 'local'
    });
  } catch (error) {
    console.warn('[TaskDB] CloudBase 初始化失败，回退到本地任务模式', error);
    cloudbase = null;
  }

  return cloudbase;
}

function getCloudBase() {
  return cloudbase || initCloudBase();
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

const localTaskAdapter = {
  getTasks(user) {
    const tasks = readTasks()
      .filter(task => task.uid === user.uid)
      .map(normalizeTask)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

    return {
      success: true,
      data: tasks,
      error: null
    };
  },

  addTask(user, content, quadrant) {
    const tasks = readTasks();
    const now = new Date().toISOString();
    const task = {
      _id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      uid: user.uid,
      content: content.trim(),
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

  updateTask(user, taskId, updates) {
    const tasks = readTasks();
    const taskIndex = tasks.findIndex(task => task._id === taskId && task.uid === user.uid);

    if (taskIndex === -1) {
      return {
        success: false,
        data: null,
        error: handleError({ code: 'DOC_NOT_EXIST' }, '任务不存在')
      };
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeTasks(tasks);

    return {
      success: true,
      data: tasks[taskIndex],
      error: null
    };
  },

  deleteTask(user, taskId) {
    const tasks = readTasks();
    const nextTasks = tasks.filter(task => !(task._id === taskId && task.uid === user.uid));

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

  clearCompleted(user) {
    const tasks = readTasks();
    const completedTasks = tasks.filter(task => task.uid === user.uid && task.completed);
    const nextTasks = tasks.filter(task => !(task.uid === user.uid && task.completed));

    writeTasks(nextTasks);

    return {
      success: true,
      deletedCount: completedTasks.length,
      error: null
    };
  }
};

function getCloudAuthUser() {
  try {
    const app = getCloudBase();
    const auth = app?.auth?.();
    return auth?.currentUser || null;
  } catch (error) {
    return null;
  }
}

function getDB() {
  const app = getCloudBase();
  return app?.database?.() || null;
}

const taskDB = {
  collectionName: 'tasks',

  async getTasks() {
    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, data: [], error: authState.error };
    }

    if (shouldUseLocalTaskMode()) {
      return localTaskAdapter.getTasks(authState.user);
    }

    try {
      const db = getDB();
      const cloudUser = getCloudAuthUser();

      if (!db || !cloudUser) {
        return localTaskAdapter.getTasks(authState.user);
      }

      const result = await db.collection(this.collectionName)
        .where({ _openid: cloudUser.uid })
        .orderBy('createdAt', 'desc')
        .get();

      return {
        success: true,
        data: (result.data || []).map(normalizeTask),
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: handleError(error, '获取任务列表失败')
      };
    }
  },

  async addTask(content, quadrant) {
    if (!content || typeof content !== 'string' || !content.trim()) {
      return { success: false, data: null, error: handleError({ code: 'PARAM_ERROR' }, '任务内容不能为空') };
    }

    if (!VALID_QUADRANTS.includes(quadrant)) {
      return { success: false, data: null, error: handleError({ code: 'INVALID_QUADRANT' }, '无效的象限值') };
    }

    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, data: null, error: authState.error };
    }

    if (shouldUseLocalTaskMode()) {
      return localTaskAdapter.addTask(authState.user, content, quadrant);
    }

    try {
      const db = getDB();
      const cloudUser = getCloudAuthUser();

      if (!db || !cloudUser) {
        return localTaskAdapter.addTask(authState.user, content, quadrant);
      }

      const taskData = {
        content: content.trim(),
        quadrant,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await db.collection(this.collectionName).add(taskData);

      return {
        success: true,
        data: {
          _id: result.id,
          ...taskData
        },
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: handleError(error, '添加任务失败')
      };
    }
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

    if (updateData.content !== undefined && !String(updateData.content).trim()) {
      return { success: false, data: null, error: handleError({ code: 'PARAM_ERROR' }, '任务内容不能为空') };
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

    if (sanitizedUpdates.content !== undefined) {
      sanitizedUpdates.content = String(sanitizedUpdates.content).trim();
    }

    if (shouldUseLocalTaskMode()) {
      return localTaskAdapter.updateTask(authState.user, taskId, sanitizedUpdates);
    }

    try {
      const db = getDB();
      const cloudUser = getCloudAuthUser();

      if (!db || !cloudUser) {
        return localTaskAdapter.updateTask(authState.user, taskId, sanitizedUpdates);
      }

      await db.collection(this.collectionName)
        .doc(taskId)
        .update({
          ...sanitizedUpdates,
          updatedAt: new Date().toISOString()
        });

      return {
        success: true,
        data: {
          _id: taskId,
          ...sanitizedUpdates,
          updatedAt: new Date().toISOString()
        },
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: handleError(error, '更新任务失败')
      };
    }
  },

  async deleteTask(taskId) {
    if (!taskId || typeof taskId !== 'string') {
      return { success: false, error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空') };
    }

    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, error: authState.error };
    }

    if (shouldUseLocalTaskMode()) {
      return localTaskAdapter.deleteTask(authState.user, taskId);
    }

    try {
      const db = getDB();
      const cloudUser = getCloudAuthUser();

      if (!db || !cloudUser) {
        return localTaskAdapter.deleteTask(authState.user, taskId);
      }

      await db.collection(this.collectionName).doc(taskId).remove();
      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error: handleError(error, '删除任务失败')
      };
    }
  },

  async clearCompleted() {
    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, deletedCount: 0, error: authState.error };
    }

    if (shouldUseLocalTaskMode()) {
      return localTaskAdapter.clearCompleted(authState.user);
    }

    try {
      const db = getDB();
      const cloudUser = getCloudAuthUser();

      if (!db || !cloudUser) {
        return localTaskAdapter.clearCompleted(authState.user);
      }

      const queryResult = await db.collection(this.collectionName)
        .where({
          _openid: cloudUser.uid,
          completed: true
        })
        .get();

      const completedTasks = queryResult.data || [];
      await Promise.all(completedTasks.map(task => db.collection(this.collectionName).doc(task._id).remove()));

      return {
        success: true,
        deletedCount: completedTasks.length,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        deletedCount: 0,
        error: handleError(error, '清空已完成任务失败')
      };
    }
  }
};

const auth = {
  getCurrentUser
};

export {
  ERROR_MESSAGES,
  auth,
  cloudbase,
  getCloudBase,
  handleError,
  initCloudBase,
  shouldUseLocalTaskMode,
  taskDB
};

export default {
  initCloudBase,
  taskDB,
  shouldUseLocalTaskMode
};
