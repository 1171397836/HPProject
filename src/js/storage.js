import { supabase } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';
import CONFIG from './config.js';

const MAX_TASK_LENGTH = 20;
const MAX_NOTE_LENGTH = 100;
const MAX_AI_MESSAGE_LENGTH = 500;
const VALID_QUADRANTS = ['q1', 'q2', 'q3', 'q4'];

const ERROR_MESSAGES = {
  AUTH_FAIL: '登录已过期，请重新登录',
  DB_ERROR: '数据库操作失败',
  DOC_NOT_EXIST: '任务不存在或已被删除',
  INVALID_QUADRANT: '无效的象限值',
  PARAM_ERROR: '参数错误，请检查输入内容',
  UNKNOWN_ERROR: '发生未知错误，请稍后重试'
};

function handleError(error, defaultMessage = '操作失败') {
  const errorCode = error?.code || 'UNKNOWN_ERROR';
  return {
    code: errorCode,
    message: ERROR_MESSAGES[errorCode] || defaultMessage,
    originalError: error || null,
    timestamp: new Date().toISOString()
  };
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

function validateTaskNote(note) {
  if (note === undefined || note === null) {
    return {
      valid: true,
      normalizedNote: null,
      error: null
    };
  }

  const normalizedNote = typeof note === 'string' ? note.trim() : '';

  if (normalizedNote.length > MAX_NOTE_LENGTH) {
    return {
      valid: false,
      normalizedNote,
      error: {
        code: 'PARAM_ERROR',
        message: `备注不能超过${MAX_NOTE_LENGTH}个字符`,
        originalError: null,
        timestamp: new Date().toISOString()
      }
    };
  }

  return {
    valid: true,
    normalizedNote: normalizedNote || null,
    error: null
  };
}

function normalizeTask(task) {
  return {
    ...task,
    _id: task.id, // map Supabase id to _id for frontend compatibility
    uid: task.user_id, // map user_id to uid
    createdAt: task.created_at || new Date().toISOString(),
    updatedAt: task.updated_at || new Date().toISOString(),
    completedAt: task.completed_at || null,
    notes: task.notes || null
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

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', authState.user.uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tasks = (data || []).map(normalizeTask);

      return {
        success: true,
        data: tasks,
        error: null
      };
    } catch (error) {
      console.error('[TaskDB] getTasks error', error);
      return { success: false, data: [], error: handleError({ code: 'DB_ERROR' }, '获取任务失败') };
    }
  },

  async addTask(content, quadrant, notes) {
    const contentValidation = validateTaskContent(content);
    if (!contentValidation.valid) {
      return { success: false, data: null, error: contentValidation.error };
    }

    const noteValidation = validateTaskNote(notes);
    if (!noteValidation.valid) {
      return { success: false, data: null, error: noteValidation.error };
    }

    if (!VALID_QUADRANTS.includes(quadrant)) {
      return { success: false, data: null, error: handleError({ code: 'INVALID_QUADRANT' }, '无效的象限值') };
    }

    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, data: null, error: authState.error };
    }

    const now = new Date().toISOString();
    const newTask = {
      user_id: authState.user.uid,
      content: contentValidation.normalizedContent,
      quadrant,
      completed: false,
      created_at: now,
      updated_at: now,
      notes: noteValidation.normalizedNote
    };

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([newTask])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: normalizeTask(data),
        error: null
      };
    } catch (error) {
      console.error('[TaskDB] addTask error', error);
      return { success: false, data: null, error: handleError({ code: 'DB_ERROR' }, '添加任务失败') };
    }
  },

  async updateTask(taskId, completed) {
    if (!taskId || (typeof taskId !== 'string' && typeof taskId !== 'number')) {
      return { success: false, data: null, error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空') };
    }

    if (typeof completed !== 'boolean') {
      return { success: false, data: null, error: handleError({ code: 'PARAM_ERROR' }, '任务状态不合法') };
    }

    return this.updateTaskContent(taskId, { completed });
  },

  async updateTaskContent(taskId, updateData = {}) {
    if (!taskId || (typeof taskId !== 'string' && typeof taskId !== 'number')) {
      return { success: false, data: null, error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空') };
    }

    let contentValidation = null;
    if (updateData.content !== undefined) {
      contentValidation = validateTaskContent(updateData.content);
      if (!contentValidation.valid) {
        return { success: false, data: null, error: contentValidation.error };
      }
    }

    let noteValidation = null;
    if (updateData.notes !== undefined) {
      noteValidation = validateTaskNote(updateData.notes);
      if (!noteValidation.valid) {
        return { success: false, data: null, error: noteValidation.error };
      }
    }

    if (updateData.quadrant !== undefined && !VALID_QUADRANTS.includes(updateData.quadrant)) {
      return { success: false, data: null, error: handleError({ code: 'INVALID_QUADRANT' }, '无效的象限值') };
    }

    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, data: null, error: authState.error };
    }

    const sanitizedUpdates = {};
    if (updateData.completed !== undefined) {
      sanitizedUpdates.completed = updateData.completed;
      // 当任务标记为完成时，同步更新 completed_at 字段
      if (updateData.completed === true) {
        sanitizedUpdates.completed_at = new Date().toISOString();
      } else if (updateData.completed === false) {
        // 注意：将 completed_at 设为 null 依赖数据库 completed_at 列允许 NULL 值。
        // 如果列定义为 NOT NULL，则需要改为设为空字符串或其他默认值。
        sanitizedUpdates.completed_at = null;
      }
    }
    if (updateData.quadrant !== undefined) sanitizedUpdates.quadrant = updateData.quadrant;
    if (contentValidation) {
      sanitizedUpdates.content = contentValidation.normalizedContent;
    }
    if (noteValidation) {
      sanitizedUpdates.notes = noteValidation.normalizedNote;
    }
    sanitizedUpdates.updated_at = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(sanitizedUpdates)
        .eq('id', taskId)
        .eq('user_id', authState.user.uid)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, data: null, error: handleError({ code: 'DOC_NOT_EXIST' }, '任务不存在') };
        }
        throw error;
      }

      return {
        success: true,
        data: normalizeTask(data),
        error: null
      };
    } catch (error) {
      console.error('[TaskDB] updateTask error', error);
      return { success: false, data: null, error: handleError({ code: 'DB_ERROR' }, '更新任务失败') };
    }
  },

  async deleteTask(taskId) {
    if (!taskId || (typeof taskId !== 'string' && typeof taskId !== 'number')) {
      return { success: false, error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空') };
    }

    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, error: authState.error };
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', authState.user.uid);

      if (error) throw error;

      return {
        success: true,
        error: null
      };
    } catch (error) {
      console.error('[TaskDB] deleteTask error', error);
      return { success: false, error: handleError({ code: 'DB_ERROR' }, '删除任务失败') };
    }
  },

  async clearCompleted() {
    const authState = getUserOrAuthError();
    if (!authState.success) {
      return { success: false, deletedCount: 0, error: authState.error };
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', authState.user.uid)
        .eq('completed', true)
        .select();

      if (error) throw error;

      return {
        success: true,
        deletedCount: data?.length || 0,
        error: null
      };
    } catch (error) {
      console.error('[TaskDB] clearCompleted error', error);
      return { success: false, deletedCount: 0, error: handleError({ code: 'DB_ERROR' }, '清理已完成任务失败') };
    }
  }
};

const auth = {
  getCurrentUser
};

export {
  ERROR_MESSAGES,
  MAX_TASK_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_AI_MESSAGE_LENGTH,
  auth,
  handleError,
  taskDB,
  validateTaskContent,
  validateTaskNote
};

export default {
  taskDB
};