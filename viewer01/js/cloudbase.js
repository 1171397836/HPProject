/**
 * CloudBase SDK 配置文件
 * 项目：铁腕任务管理工具
 * 环境 ID：ironhand-8gclol9h5c79d816
 * 
 * 功能说明：
 * 1. 初始化 CloudBase SDK
 * 2. 封装数据库操作（任务增删改查）
 * 3. 封装用户认证操作（注册、登录、登出）
 * 4. 统一错误处理
 */

// ============================================
// 1. SDK 初始化
// ============================================

/**
 * CloudBase 环境配置
 */
const CLOUDBASE_CONFIG = {
  // 腾讯云开发环境 ID
  env: 'ironhand-8gclol9h5c79d816',
  // 是否打印调试信息（开发环境开启，生产环境关闭）
  debug: false
};

/**
 * CloudBase 实例
 * 需要在 HTML 中先引入 CloudBase SDK：
 * <script src="https://imgcache.qq.com/qcloud/cloudbase-js-sdk/1.1.1/cloudbase.full.js"></script>
 */
let cloudbase = null;

/**
 * 初始化 CloudBase SDK
 * 必须在调用其他方法前执行
 * @returns {Object} cloudbase 实例
 */
function initCloudBase() {
  if (cloudbase) {
    return cloudbase;
  }

  // 检查 CloudBase SDK 是否已加载
  if (typeof window.cloudbase === 'undefined') {
    throw new Error('CloudBase SDK 未加载，请先在 HTML 中引入 SDK');
  }

  // 初始化 CloudBase
  cloudbase = window.cloudbase.init({
    env: CLOUDBASE_CONFIG.env,
    // 使用匿名登录作为默认登录方式
    persistence: 'local'
  });

  if (CLOUDBASE_CONFIG.debug) {
    console.log('[CloudBase] SDK 初始化成功，环境 ID:', CLOUDBASE_CONFIG.env);
  }

  return cloudbase;
}

/**
 * 获取 CloudBase 实例
 * 如果未初始化，会自动初始化
 * @returns {Object} cloudbase 实例
 */
function getCloudBase() {
  if (!cloudbase) {
    return initCloudBase();
  }
  return cloudbase;
}

// ============================================
// 2. 错误处理工具
// ============================================

/**
 * CloudBase 错误码映射表
 * 将技术错误码转换为用户友好的错误信息
 */
const ERROR_MESSAGES = {
  // 网络相关错误
  'NETWORK_ERROR': '网络连接失败，请检查网络后重试',
  'TIMEOUT': '请求超时，请稍后重试',
  'REQUEST_FAIL': '请求发送失败',
  
  // 认证相关错误
  'AUTH_FAIL': '登录已过期，请重新登录',
  'UNAUTHORIZED': '您没有权限执行此操作',
  'USER_NOT_EXIST': '用户不存在',
  'PASSWORD_ERROR': '密码错误',
  'USER_ALREADY_EXIST': '用户已存在',
  'INVALID_USERNAME': '用户名格式不正确',
  'INVALID_PASSWORD': '密码格式不正确',
  
  // 数据库相关错误
  'DB_ERROR': '数据库操作失败',
  'COLLECTION_NOT_EXIST': '数据集合不存在',
  'DOC_NOT_EXIST': '任务不存在或已被删除',
  'PERMISSION_DENIED': '权限不足，无法操作该数据',
  
  // 通用错误
  'UNKNOWN_ERROR': '发生未知错误，请稍后重试',
  'PARAM_ERROR': '参数错误，请检查输入内容'
};

/**
 * 统一错误处理函数
 * @param {Error} error - 原始错误对象
 * @param {string} defaultMessage - 默认错误信息
 * @returns {Object} 标准化的错误对象
 */
function handleError(error, defaultMessage = '操作失败') {
  console.error('[CloudBase Error]', error);

  let errorCode = 'UNKNOWN_ERROR';
  let errorMessage = defaultMessage;

  // 解析 CloudBase 错误
  if (error && error.code) {
    errorCode = error.code;
    
    // 根据错误码映射友好信息
    switch (error.code) {
      // 网络错误
      case 'NETWORK_ERROR':
      case 'ETIMEDOUT':
      case 'ECONNREFUSED':
        errorCode = 'NETWORK_ERROR';
        break;
        
      // 认证错误
      case 'AUTH_FAIL':
      case 'LOGIN_FAIL':
        errorCode = 'AUTH_FAIL';
        break;
      case 'UNAUTHORIZED':
        errorCode = 'UNAUTHORIZED';
        break;
        
      // 数据库权限错误
      case 'PERMISSION_DENIED':
      case 'NO_PERMISSION':
        errorCode = 'PERMISSION_DENIED';
        break;
        
      // 文档不存在
      case 'DOCUMENT_NOT_EXIST':
      case 'DOC_NOT_FOUND':
        errorCode = 'DOC_NOT_EXIST';
        break;
        
      default:
        // 尝试从错误消息中识别
        if (error.message) {
          if (error.message.includes('network')) {
            errorCode = 'NETWORK_ERROR';
          } else if (error.message.includes('permission')) {
            errorCode = 'PERMISSION_DENIED';
          } else if (error.message.includes('not found')) {
            errorCode = 'DOC_NOT_EXIST';
          }
        }
    }
  }

  // 获取友好的错误信息
  errorMessage = ERROR_MESSAGES[errorCode] || defaultMessage;

  const standardizedError = {
    code: errorCode,
    message: errorMessage,
    originalError: error,
    timestamp: new Date().toISOString()
  };

  if (CLOUDBASE_CONFIG.debug) {
    console.error('[CloudBase] 标准化错误:', standardizedError);
  }

  return standardizedError;
}

// ============================================
// 3. 数据库操作封装 - 任务相关
// ============================================

/**
 * 任务数据库操作对象
 * 提供任务增删改查的封装方法
 */
const taskDB = {
  // 集合名称
  collectionName: 'tasks',

  /**
   * 获取数据库引用
   * @returns {Object} 数据库实例
   */
  getDB() {
    const app = getCloudBase();
    return app.database();
  },

  /**
   * 获取当前用户的所有任务
   * 按创建时间倒序排列（最新的在前）
   * 
   * @returns {Promise<Object>} 返回结果对象 { success: boolean, data: Array, error: Object }
   * 
   * 使用示例：
   * const result = await taskDB.getTasks();
   * if (result.success) {
   *   console.log('任务列表:', result.data);
   * }
   */
  async getTasks() {
    try {
      const db = this.getDB();
      const app = getCloudBase();
      
      // 获取当前登录用户
      const auth = app.auth();
      const user = auth.currentUser;
      
      if (!user) {
        return {
          success: false,
          data: [],
          error: handleError({ code: 'AUTH_FAIL' }, '用户未登录')
        };
      }

      // 查询当前用户的所有任务
      const result = await db.collection(this.collectionName)
        .where({
          _openid: user.uid  // 根据用户 openid 过滤
        })
        .orderBy('createdAt', 'desc')  // 按创建时间倒序
        .get();

      if (CLOUDBASE_CONFIG.debug) {
        console.log('[CloudBase] 获取任务成功:', result.data);
      }

      return {
        success: true,
        data: result.data || [],
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

  /**
   * 添加新任务
   * 
   * @param {string} content - 任务内容
   * @param {string} quadrant - 任务象限（'q1'|'q2'|'q3'|'q4'）
   * @returns {Promise<Object>} 返回结果对象 { success: boolean, data: Object, error: Object }
   * 
   * 使用示例：
   * const result = await taskDB.addTask('完成报告', 'q1');
   * if (result.success) {
   *   console.log('新增任务:', result.data);
   * }
   */
  async addTask(content, quadrant) {
    try {
      // 参数验证
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PARAM_ERROR' }, '任务内容不能为空')
        };
      }

      // 验证象限值
      const validQuadrants = ['q1', 'q2', 'q3', 'q4'];
      if (!validQuadrants.includes(quadrant)) {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PARAM_ERROR' }, '无效的象限值')
        };
      }

      const db = this.getDB();
      const app = getCloudBase();
      const user = app.auth().currentUser;

      if (!user) {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'AUTH_FAIL' }, '用户未登录')
        };
      }

      // 构建任务数据
      const taskData = {
        content: content.trim(),
        quadrant: quadrant,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 添加到数据库
      const result = await db.collection(this.collectionName).add(taskData);

      if (CLOUDBASE_CONFIG.debug) {
        console.log('[CloudBase] 添加任务成功:', result);
      }

      return {
        success: true,
        data: {
          id: result.id,
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

  /**
   * 更新任务完成状态
   * 
   * @param {string} taskId - 任务 ID
   * @param {boolean} completed - 完成状态
   * @returns {Promise<Object>} 返回结果对象 { success: boolean, data: Object, error: Object }
   * 
   * 使用示例：
   * const result = await taskDB.updateTask('task-123', true);
   * if (result.success) {
   *   console.log('任务已标记为完成');
   * }
   */
  async updateTask(taskId, completed) {
    try {
      // 参数验证
      if (!taskId || typeof taskId !== 'string') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空')
        };
      }

      if (typeof completed !== 'boolean') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PARAM_ERROR' }, '完成状态必须是布尔值')
        };
      }

      const db = this.getDB();
      const app = getCloudBase();
      const user = app.auth().currentUser;

      if (!user) {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'AUTH_FAIL' }, '用户未登录')
        };
      }

      // 更新任务状态
      const result = await db.collection(this.collectionName)
        .doc(taskId)
        .update({
          completed: completed,
          updatedAt: new Date()
        });

      if (CLOUDBASE_CONFIG.debug) {
        console.log('[CloudBase] 更新任务成功:', result);
      }

      return {
        success: true,
        data: {
          id: taskId,
          completed: completed,
          updatedAt: new Date()
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

  /**
   * 删除单个任务
   * 
   * @param {string} taskId - 任务 ID
   * @returns {Promise<Object>} 返回结果对象 { success: boolean, error: Object }
   * 
   * 使用示例：
   * const result = await taskDB.deleteTask('task-123');
   * if (result.success) {
   *   console.log('任务已删除');
   * }
   */
  async deleteTask(taskId) {
    try {
      // 参数验证
      if (!taskId || typeof taskId !== 'string') {
        return {
          success: false,
          error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空')
        };
      }

      const db = this.getDB();
      const app = getCloudBase();
      const user = app.auth().currentUser;

      if (!user) {
        return {
          success: false,
          error: handleError({ code: 'AUTH_FAIL' }, '用户未登录')
        };
      }

      // 删除任务
      await db.collection(this.collectionName)
        .doc(taskId)
        .remove();

      if (CLOUDBASE_CONFIG.debug) {
        console.log('[CloudBase] 删除任务成功:', taskId);
      }

      return {
        success: true,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        error: handleError(error, '删除任务失败')
      };
    }
  },

  /**
   * 清空所有已完成的任务
   * 
   * @returns {Promise<Object>} 返回结果对象 { success: boolean, deletedCount: number, error: Object }
   * 
   * 使用示例：
   * const result = await taskDB.clearCompleted();
   * if (result.success) {
   *   console.log(`已清理 ${result.deletedCount} 个完成任务`);
   * }
   */
  async clearCompleted() {
    try {
      const db = this.getDB();
      const app = getCloudBase();
      const user = app.auth().currentUser;

      if (!user) {
        return {
          success: false,
          deletedCount: 0,
          error: handleError({ code: 'AUTH_FAIL' }, '用户未登录')
        };
      }

      // 先查询所有已完成的任务
      const queryResult = await db.collection(this.collectionName)
        .where({
          _openid: user.uid,
          completed: true
        })
        .get();

      const completedTasks = queryResult.data || [];
      
      if (completedTasks.length === 0) {
        return {
          success: true,
          deletedCount: 0,
          error: null
        };
      }

      // 批量删除已完成的任务
      // 注意：CloudBase 批量删除需要逐个删除
      const deletePromises = completedTasks.map(task => 
        db.collection(this.collectionName).doc(task._id).remove()
      );

      await Promise.all(deletePromises);

      if (CLOUDBASE_CONFIG.debug) {
        console.log('[CloudBase] 清空完成任务成功，删除数量:', completedTasks.length);
      }

      return {
        success: true,
        deletedCount: completedTasks.length,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        deletedCount: 0,
        error: handleError(error, '清空完成任务失败')
      };
    }
  },

  /**
   * 更新任务内容（扩展方法）
   * 
   * @param {string} taskId - 任务 ID
   * @param {Object} updateData - 要更新的数据 { content?: string, quadrant?: string }
   * @returns {Promise<Object>} 返回结果对象
   */
  async updateTaskContent(taskId, updateData) {
    try {
      if (!taskId || typeof taskId !== 'string') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PARAM_ERROR' }, '任务ID不能为空')
        };
      }

      const db = this.getDB();
      const app = getCloudBase();
      const user = app.auth().currentUser;

      if (!user) {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'AUTH_FAIL' }, '用户未登录')
        };
      }

      // 构建更新数据
      const dataToUpdate = {
        updatedAt: new Date()
      };

      if (updateData.content !== undefined) {
        dataToUpdate.content = updateData.content.trim();
      }

      if (updateData.quadrant !== undefined) {
        const validQuadrants = ['q1', 'q2', 'q3', 'q4'];
        if (!validQuadrants.includes(updateData.quadrant)) {
          return {
            success: false,
            data: null,
            error: handleError({ code: 'PARAM_ERROR' }, '无效的象限值')
          };
        }
        dataToUpdate.quadrant = updateData.quadrant;
      }

      const result = await db.collection(this.collectionName)
        .doc(taskId)
        .update(dataToUpdate);

      return {
        success: true,
        data: {
          id: taskId,
          ...dataToUpdate
        },
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: handleError(error, '更新任务内容失败')
      };
    }
  }
};

// ============================================
// 4. 用户认证封装
// ============================================

/**
 * 用户认证操作对象
 * 提供注册、登录、登出等认证相关方法
 */
const auth = {
  /**
   * 获取 CloudBase Auth 实例
   * @returns {Object} Auth 实例
   */
  getAuth() {
    const app = getCloudBase();
    return app.auth();
  },

  /**
   * 用户注册
   * 使用邮箱+密码方式注册
   * 
   * @param {string} username - 用户名（邮箱格式）
   * @param {string} password - 密码（至少6位）
   * @returns {Promise<Object>} 返回结果对象 { success: boolean, data: Object, error: Object }
   * 
   * 使用示例：
   * const result = await auth.register('user@example.com', 'password123');
   * if (result.success) {
   *   console.log('注册成功:', result.data);
   * }
   */
  async register(username, password) {
    try {
      // 参数验证
      if (!username || typeof username !== 'string') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PARAM_ERROR' }, '用户名不能为空')
        };
      }

      if (!password || typeof password !== 'string') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PARAM_ERROR' }, '密码不能为空')
        };
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(username)) {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'INVALID_USERNAME' }, '请输入有效的邮箱地址')
        };
      }

      // 验证密码长度
      if (password.length < 6) {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'INVALID_PASSWORD' }, '密码长度至少6位')
        };
      }

      const authInstance = this.getAuth();

      // 使用邮箱密码注册
      const result = await authInstance.signUpWithEmailAndPassword(username, password);

      if (CLOUDBASE_CONFIG.debug) {
        console.log('[CloudBase] 注册成功:', result);
      }

      return {
        success: true,
        data: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          emailVerified: result.user.emailVerified
        },
        error: null
      };
    } catch (error) {
      // 处理特定错误码
      if (error.code === 'auth/email-already-in-use') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'USER_ALREADY_EXIST' }, '该邮箱已被注册')
        };
      }

      return {
        success: false,
        data: null,
        error: handleError(error, '注册失败')
      };
    }
  },

  /**
   * 用户登录
   * 使用邮箱+密码方式登录
   * 
   * @param {string} username - 用户名（邮箱）
   * @param {string} password - 密码
   * @returns {Promise<Object>} 返回结果对象 { success: boolean, data: Object, error: Object }
   * 
   * 使用示例：
   * const result = await auth.login('user@example.com', 'password123');
   * if (result.success) {
   *   console.log('登录成功:', result.data);
   * }
   */
  async login(username, password) {
    try {
      // 参数验证
      if (!username || typeof username !== 'string') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PARAM_ERROR' }, '用户名不能为空')
        };
      }

      if (!password || typeof password !== 'string') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PARAM_ERROR' }, '密码不能为空')
        };
      }

      const authInstance = this.getAuth();

      // 使用邮箱密码登录
      const result = await authInstance.signInWithEmailAndPassword(username, password);

      if (CLOUDBASE_CONFIG.debug) {
        console.log('[CloudBase] 登录成功:', result);
      }

      return {
        success: true,
        data: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          emailVerified: result.user.emailVerified,
          isAnonymous: result.user.isAnonymous
        },
        error: null
      };
    } catch (error) {
      // 处理特定错误码
      if (error.code === 'auth/user-not-found') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'USER_NOT_EXIST' }, '用户不存在')
        };
      }

      if (error.code === 'auth/wrong-password') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'PASSWORD_ERROR' }, '密码错误')
        };
      }

      if (error.code === 'auth/invalid-email') {
        return {
          success: false,
          data: null,
          error: handleError({ code: 'INVALID_USERNAME' }, '邮箱格式不正确')
        };
      }

      return {
        success: false,
        data: null,
        error: handleError(error, '登录失败')
      };
    }
  },

  /**
   * 用户登出
   * 
   * @returns {Promise<Object>} 返回结果对象 { success: boolean, error: Object }
   * 
   * 使用示例：
   * const result = await auth.logout();
   * if (result.success) {
   *   console.log('已退出登录');
   * }
   */
  async logout() {
    try {
      const authInstance = this.getAuth();
      
      // 执行登出
      await authInstance.signOut();

      if (CLOUDBASE_CONFIG.debug) {
        console.log('[CloudBase] 登出成功');
      }

      return {
        success: true,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        error: handleError(error, '登出失败')
      };
    }
  },

  /**
   * 获取当前登录用户
   * 
   * @returns {Object|null} 当前用户信息，未登录返回 null
   * 
   * 使用示例：
   * const user = auth.getCurrentUser();
   * if (user) {
   *   console.log('当前用户:', user.email);
   * }
   */
  getCurrentUser() {
    try {
      const authInstance = this.getAuth();
      const user = authInstance.currentUser;

      if (!user) {
        return null;
      }

      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        photoURL: user.photoURL,
        metadata: {
          creationTime: user.metadata?.creationTime,
          lastSignInTime: user.metadata?.lastSignInTime
        }
      };
    } catch (error) {
      console.error('[CloudBase] 获取当前用户失败:', error);
      return null;
    }
  },

  /**
   * 检查用户是否已登录
   * 
   * @returns {boolean} 已登录返回 true，否则返回 false
   * 
   * 使用示例：
   * if (auth.isLoggedIn()) {
   *   // 执行需要登录的操作
   * }
   */
  isLoggedIn() {
    try {
      const authInstance = this.getAuth();
      return !!authInstance.currentUser;
    } catch (error) {
      return false;
    }
  },

  /**
   * 匿名登录（扩展方法）
   * 用于快速体验功能，无需注册
   * 
   * @returns {Promise<Object>} 返回结果对象
   */
  async anonymousLogin() {
    try {
      const authInstance = this.getAuth();
      
      const result = await authInstance.signInAnonymously();

      if (CLOUDBASE_CONFIG.debug) {
        console.log('[CloudBase] 匿名登录成功:', result);
      }

      return {
        success: true,
        data: {
          uid: result.user.uid,
          isAnonymous: true
        },
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: handleError(error, '匿名登录失败')
      };
    }
  },

  /**
   * 发送密码重置邮件（扩展方法）
   * 
   * @param {string} email - 用户邮箱
   * @returns {Promise<Object>} 返回结果对象
   */
  async sendPasswordResetEmail(email) {
    try {
      if (!email || typeof email !== 'string') {
        return {
          success: false,
          error: handleError({ code: 'PARAM_ERROR' }, '邮箱不能为空')
        };
      }

      const authInstance = this.getAuth();
      await authInstance.sendPasswordResetEmail(email);

      return {
        success: true,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        error: handleError(error, '发送重置邮件失败')
      };
    }
  }
};

// ============================================
// 5. 导出模块
// ============================================

/**
 * 导出 CloudBase 相关功能
 * 
 * 使用方式：
 * 
 * 1. 在 HTML 中引入 SDK：
 *    <script src="https://imgcache.qq.com/qcloud/cloudbase-js-sdk/1.1.1/cloudbase.full.js"></script>
 * 
 * 2. 在 JS 中导入本模块：
 *    import { cloudbase, taskDB, auth, initCloudBase } from './js/cloudbase.js';
 * 
 * 3. 初始化并使用：
 *    initCloudBase();
 *    const result = await taskDB.getTasks();
 */
export {
  // CloudBase 实例和初始化
  cloudbase,
  initCloudBase,
  getCloudBase,
  
  // 数据库操作
  taskDB,
  
  // 用户认证
  auth,
  
  // 错误处理（如需自定义错误处理可导出）
  handleError,
  ERROR_MESSAGES
};

// 默认导出 cloudbase 实例
export default cloudbase;
