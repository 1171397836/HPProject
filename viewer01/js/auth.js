/**
 * ============================================
 * 铁腕任务管理工具 - 用户认证模块
 * ============================================
 * 
 * 本模块处理用户认证相关功能，包括：
 * - 用户登录
 * - 用户注册
 * - 用户退出
 * - 登录状态检查
 * - 页面访问保护
 * 
 * 依赖：CloudBase JavaScript SDK
 * 使用方式：import { handleLogin, handleRegister, ... } from './js/auth.js';
 */

// ============================================
// 常量定义
// ============================================

/** 本地存储键名 - 用户信息 */
const STORAGE_KEY_USER = 'tiewan_user';

/** 本地存储键名 - 登录时间戳 */
const STORAGE_KEY_LOGIN_TIME = 'tiewan_login_time';

/** 登录状态有效期（毫秒）- 7天 */
const LOGIN_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000;

/** 密码最小长度 */
const PASSWORD_MIN_LENGTH = 6;

/** 用户名最小长度 */
const USERNAME_MIN_LENGTH = 2;

/** 用户名最大长度 */
const USERNAME_MAX_LENGTH = 20;

// ============================================
// 错误码定义
// ============================================

/** 认证错误码 */
const AuthErrorCode = {
  // 输入验证错误
  INVALID_USERNAME: 'INVALID_USERNAME',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  
  // 认证错误
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  USERNAME_EXISTS: 'USERNAME_EXISTS',
  
  // 系统错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/** 错误信息映射表 */
const ErrorMessages = {
  [AuthErrorCode.INVALID_USERNAME]: '用户名不能为空',
  [AuthErrorCode.INVALID_PASSWORD]: '密码不能为空',
  [AuthErrorCode.PASSWORD_TOO_SHORT]: `密码长度至少${PASSWORD_MIN_LENGTH}位`,
  [AuthErrorCode.PASSWORD_MISMATCH]: '两次输入的密码不一致',
  [AuthErrorCode.USER_NOT_FOUND]: '用户不存在',
  [AuthErrorCode.WRONG_PASSWORD]: '密码错误',
  [AuthErrorCode.USERNAME_EXISTS]: '用户名已被注册',
  [AuthErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络',
  [AuthErrorCode.SERVER_ERROR]: '服务器错误，请稍后重试',
  [AuthErrorCode.NOT_INITIALIZED]: '认证服务未初始化',
  [AuthErrorCode.UNKNOWN_ERROR]: '发生未知错误'
};

// ============================================
// CloudBase 相关
// ============================================

/**
 * 获取 CloudBase 实例
 * 注意：需要先在页面中引入 CloudBase SDK
 * @returns {Object|null} CloudBase 实例或 null
 */
function getCloudBase() {
  // 检查全局变量中是否存在 CloudBase
  if (typeof cloudbase !== 'undefined') {
    return cloudbase;
  }
  
  // 检查 window 对象
  if (typeof window !== 'undefined' && window.cloudbase) {
    return window.cloudbase;
  }
  
  return null;
}

/**
 * 检查 CloudBase 是否已初始化
 * @returns {boolean} 是否已初始化
 */
function isCloudBaseInitialized() {
  const app = getCloudBase();
  if (!app) return false;
  
  // 检查是否有初始化标志或 auth 对象
  try {
    return !!app.auth;
  } catch (e) {
    return false;
  }
}

/**
 * 获取 CloudBase Auth 实例
 * @returns {Object|null} Auth 实例或 null
 */
function getAuth() {
  const app = getCloudBase();
  if (!app) return null;
  
  try {
    return app.auth();
  } catch (e) {
    console.error('[Auth] 获取 Auth 实例失败:', e);
    return null;
  }
}

// ============================================
// 工具函数
// ============================================

/**
 * 创建错误对象
 * @param {string} code - 错误码
 * @param {string} [message] - 错误信息（可选，默认使用映射表）
 * @returns {Error} 错误对象
 */
function createError(code, message) {
  const error = new Error(message || ErrorMessages[code] || ErrorMessages[AuthErrorCode.UNKNOWN_ERROR]);
  error.code = code;
  return error;
}

/**
 * 验证用户名
 * @param {string} username - 用户名
 * @returns {Object} 验证结果 { valid: boolean, error?: Error }
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: createError(AuthErrorCode.INVALID_USERNAME) };
  }
  
  const trimmed = username.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: createError(AuthErrorCode.INVALID_USERNAME) };
  }
  
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return { 
      valid: false, 
      error: createError(AuthErrorCode.INVALID_USERNAME, `用户名至少需要${USERNAME_MIN_LENGTH}个字符`) 
    };
  }
  
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return { 
      valid: false, 
      error: createError(AuthErrorCode.INVALID_USERNAME, `用户名不能超过${USERNAME_MAX_LENGTH}个字符`) 
    };
  }
  
  // 检查是否只包含字母、数字、中文和下划线
  const validPattern = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
  if (!validPattern.test(trimmed)) {
    return { 
      valid: false, 
      error: createError(AuthErrorCode.INVALID_USERNAME, '用户名只能包含字母、数字、中文和下划线') 
    };
  }
  
  return { valid: true };
}

/**
 * 验证密码
 * @param {string} password - 密码
 * @returns {Object} 验证结果 { valid: boolean, error?: Error }
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: createError(AuthErrorCode.INVALID_PASSWORD) };
  }
  
  if (password.length === 0) {
    return { valid: false, error: createError(AuthErrorCode.INVALID_PASSWORD) };
  }
  
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: createError(AuthErrorCode.PASSWORD_TOO_SHORT) };
  }
  
  return { valid: true };
}

/**
 * 验证两次密码是否一致
 * @param {string} password - 密码
 * @param {string} confirmPassword - 确认密码
 * @returns {Object} 验证结果 { valid: boolean, error?: Error }
 */
function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return { valid: false, error: createError(AuthErrorCode.PASSWORD_MISMATCH) };
  }
  return { valid: true };
}

/**
 * 保存用户登录状态到本地存储
 * @param {Object} userInfo - 用户信息
 */
function saveLoginState(userInfo) {
  try {
    const data = {
      username: userInfo.username,
      uid: userInfo.uid,
      loginTime: Date.now()
    };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEY_LOGIN_TIME, Date.now().toString());
  } catch (e) {
    console.warn('[Auth] 保存登录状态失败:', e);
  }
}

/**
 * 清除本地登录状态
 */
function clearLoginState() {
  try {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_LOGIN_TIME);
  } catch (e) {
    console.warn('[Auth] 清除登录状态失败:', e);
  }
}

/**
 * 从本地存储获取用户信息
 * @returns {Object|null} 用户信息或 null
 */
function getStoredUserInfo() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USER);
    if (!data) return null;
    
    return JSON.parse(data);
  } catch (e) {
    console.warn('[Auth] 读取用户信息失败:', e);
    return null;
  }
}

/**
 * 检查登录状态是否过期
 * @returns {boolean} 是否过期
 */
function isLoginExpired() {
  try {
    const loginTime = localStorage.getItem(STORAGE_KEY_LOGIN_TIME);
    if (!loginTime) return true;
    
    const elapsed = Date.now() - parseInt(loginTime, 10);
    return elapsed > LOGIN_EXPIRE_TIME;
  } catch (e) {
    return true;
  }
}

/**
 * 页面跳转
 * @param {string} url - 目标页面 URL
 */
function navigateTo(url) {
  window.location.href = url;
}

// ============================================
// 主要功能函数
// ============================================

/**
 * 处理用户登录
 * 
 * 功能说明：
 * 1. 验证用户名和密码输入
 * 2. 调用 CloudBase 登录接口
 * 3. 登录成功保存状态并跳转
 * 4. 登录失败返回错误信息
 * 
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<Object>} 登录结果
 *   - success: 是否成功
 *   - userInfo: 用户信息（成功时）
 *   - error: 错误信息（失败时）
 * 
 * @example
 * const result = await handleLogin('zhangsan', '123456');
 * if (result.success) {
 *   console.log('登录成功:', result.userInfo);
 * } else {
 *   console.error('登录失败:', result.error);
 * }
 */
async function handleLogin(username, password) {
  console.log('[Auth] 开始登录流程:', { username });
  
  try {
    // 1. 验证输入
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      console.warn('[Auth] 用户名验证失败:', usernameValidation.error.message);
      return { success: false, error: usernameValidation.error };
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      console.warn('[Auth] 密码验证失败:', passwordValidation.error.message);
      return { success: false, error: passwordValidation.error };
    }
    
    // 2. 检查 CloudBase 是否可用
    if (!isCloudBaseInitialized()) {
      console.warn('[Auth] CloudBase 未初始化');
      // 开发阶段：模拟登录成功
      console.log('[Auth] 开发模式：模拟登录成功');
      const mockUserInfo = {
        username: username.trim(),
        uid: 'mock_' + Date.now(),
        loginTime: Date.now()
      };
      saveLoginState(mockUserInfo);
      navigateTo('app.html');
      return { success: true, userInfo: mockUserInfo };
    }
    
    // 3. 调用 CloudBase 登录
    const auth = getAuth();
    if (!auth) {
      throw createError(AuthErrorCode.NOT_INITIALIZED);
    }
    
    // 使用邮箱格式登录（CloudBase 要求）
    // 将用户名转换为邮箱格式：username@tiewan.local
    const email = `${username.trim()}@tiewan.local`;
    
    console.log('[Auth] 调用 CloudBase 登录...');
    const loginResult = await auth.signInWithEmailAndPassword(email, password);
    
    if (!loginResult || !loginResult.user) {
      throw createError(AuthErrorCode.UNKNOWN_ERROR, '登录失败，请重试');
    }
    
    // 4. 登录成功处理
    const userInfo = {
      username: username.trim(),
      uid: loginResult.user.uid,
      email: loginResult.user.email,
      loginTime: Date.now()
    };
    
    // 保存登录状态
    saveLoginState(userInfo);
    
    console.log('[Auth] 登录成功:', userInfo);
    
    // 跳转到应用页面
    navigateTo('app.html');
    
    return { success: true, userInfo };
    
  } catch (error) {
    console.error('[Auth] 登录失败:', error);
    
    // 解析 CloudBase 错误
    let authError;
    if (error.code) {
      switch (error.code) {
        case 'auth/user-not-found':
          authError = createError(AuthErrorCode.USER_NOT_FOUND);
          break;
        case 'auth/wrong-password':
          authError = createError(AuthErrorCode.WRONG_PASSWORD);
          break;
        case 'auth/invalid-email':
          authError = createError(AuthErrorCode.INVALID_USERNAME, '用户名格式不正确');
          break;
        case 'auth/user-disabled':
          authError = createError(AuthErrorCode.UNKNOWN_ERROR, '账号已被禁用');
          break;
        case 'auth/too-many-requests':
          authError = createError(AuthErrorCode.UNKNOWN_ERROR, '登录尝试次数过多，请稍后再试');
          break;
        case 'auth/network-request-failed':
          authError = createError(AuthErrorCode.NETWORK_ERROR);
          break;
        default:
          authError = createError(AuthErrorCode.UNKNOWN_ERROR, error.message);
      }
    } else {
      authError = error.code ? error : createError(AuthErrorCode.UNKNOWN_ERROR, error.message);
    }
    
    return { success: false, error: authError };
  }
}

/**
 * 处理用户注册
 * 
 * 功能说明：
 * 1. 验证用户名、密码和确认密码
 * 2. 调用 CloudBase 注册接口
 * 3. 注册成功后自动登录并跳转
 * 4. 注册失败返回错误信息
 * 
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {string} confirmPassword - 确认密码
 * @returns {Promise<Object>} 注册结果
 *   - success: 是否成功
 *   - userInfo: 用户信息（成功时）
 *   - error: 错误信息（失败时）
 * 
 * @example
 * const result = await handleRegister('zhangsan', '123456', '123456');
 * if (result.success) {
 *   console.log('注册成功:', result.userInfo);
 * } else {
 *   console.error('注册失败:', result.error);
 * }
 */
async function handleRegister(username, password, confirmPassword) {
  console.log('[Auth] 开始注册流程:', { username });
  
  try {
    // 1. 验证输入
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      console.warn('[Auth] 用户名验证失败:', usernameValidation.error.message);
      return { success: false, error: usernameValidation.error };
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      console.warn('[Auth] 密码验证失败:', passwordValidation.error.message);
      return { success: false, error: passwordValidation.error };
    }
    
    const matchValidation = validatePasswordMatch(password, confirmPassword);
    if (!matchValidation.valid) {
      console.warn('[Auth] 密码不匹配');
      return { success: false, error: matchValidation.error };
    }
    
    // 2. 检查 CloudBase 是否可用
    if (!isCloudBaseInitialized()) {
      console.warn('[Auth] CloudBase 未初始化');
      // 开发阶段：模拟注册成功
      console.log('[Auth] 开发模式：模拟注册成功');
      const mockUserInfo = {
        username: username.trim(),
        uid: 'mock_' + Date.now(),
        loginTime: Date.now()
      };
      saveLoginState(mockUserInfo);
      navigateTo('app.html');
      return { success: true, userInfo: mockUserInfo };
    }
    
    // 3. 调用 CloudBase 注册
    const auth = getAuth();
    if (!auth) {
      throw createError(AuthErrorCode.NOT_INITIALIZED);
    }
    
    // 使用邮箱格式注册（CloudBase 要求）
    const email = `${username.trim()}@tiewan.local`;
    
    console.log('[Auth] 调用 CloudBase 注册...');
    const registerResult = await auth.signUpWithEmailAndPassword(email, password);
    
    if (!registerResult || !registerResult.user) {
      throw createError(AuthErrorCode.UNKNOWN_ERROR, '注册失败，请重试');
    }
    
    // 4. 注册成功处理（自动登录）
    const userInfo = {
      username: username.trim(),
      uid: registerResult.user.uid,
      email: registerResult.user.email,
      loginTime: Date.now()
    };
    
    // 保存登录状态
    saveLoginState(userInfo);
    
    console.log('[Auth] 注册成功:', userInfo);
    
    // 跳转到应用页面
    navigateTo('app.html');
    
    return { success: true, userInfo };
    
  } catch (error) {
    console.error('[Auth] 注册失败:', error);
    
    // 解析 CloudBase 错误
    let authError;
    if (error.code) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          authError = createError(AuthErrorCode.USERNAME_EXISTS);
          break;
        case 'auth/invalid-email':
          authError = createError(AuthErrorCode.INVALID_USERNAME, '用户名格式不正确');
          break;
        case 'auth/weak-password':
          authError = createError(AuthErrorCode.PASSWORD_TOO_SHORT, '密码强度不够');
          break;
        case 'auth/network-request-failed':
          authError = createError(AuthErrorCode.NETWORK_ERROR);
          break;
        default:
          authError = createError(AuthErrorCode.UNKNOWN_ERROR, error.message);
      }
    } else {
      authError = error.code ? error : createError(AuthErrorCode.UNKNOWN_ERROR, error.message);
    }
    
    return { success: false, error: authError };
  }
}

/**
 * 处理用户退出登录
 * 
 * 功能说明：
 * 1. 调用 CloudBase 退出接口
 * 2. 清除本地登录状态
 * 3. 跳转到登录页面
 * 
 * @returns {Promise<Object>} 退出结果
 *   - success: 是否成功
 *   - error: 错误信息（失败时）
 * 
 * @example
 * const result = await handleLogout();
 * if (result.success) {
 *   console.log('退出成功');
 * }
 */
async function handleLogout() {
  console.log('[Auth] 开始退出流程');
  
  try {
    // 1. 调用 CloudBase 退出（如果可用）
    if (isCloudBaseInitialized()) {
      const auth = getAuth();
      if (auth && auth.signOut) {
        await auth.signOut();
        console.log('[Auth] CloudBase 退出成功');
      }
    }
    
    // 2. 清除本地状态
    clearLoginState();
    
    console.log('[Auth] 退出成功');
    
    // 3. 跳转到登录页面
    navigateTo('login.html');
    
    return { success: true };
    
  } catch (error) {
    console.error('[Auth] 退出失败:', error);
    
    // 即使 CloudBase 退出失败，也要清除本地状态
    clearLoginState();
    navigateTo('login.html');
    
    return { 
      success: false, 
      error: createError(AuthErrorCode.UNKNOWN_ERROR, error.message) 
    };
  }
}

/**
 * 检查当前登录状态
 * 
 * 功能说明：
 * 1. 检查本地存储的登录状态
 * 2. 检查登录是否过期
 * 3. 如果 CloudBase 可用，验证云端登录状态
 * 4. 返回用户信息或 null
 * 
 * @returns {Promise<Object|null>} 用户信息或 null
 *   - 已登录: 返回 { username, uid, loginTime, ... }
 *   - 未登录: 返回 null
 * 
 * @example
 * const userInfo = await checkAuthStatus();
 * if (userInfo) {
 *   console.log('当前用户:', userInfo.username);
 * } else {
 *   console.log('未登录');
 * }
 */
async function checkAuthStatus() {
  console.log('[Auth] 检查登录状态');
  
  try {
    // 1. 检查本地存储
    const storedUser = getStoredUserInfo();
    if (!storedUser) {
      console.log('[Auth] 本地无登录状态');
      return null;
    }
    
    // 2. 检查是否过期
    if (isLoginExpired()) {
      console.log('[Auth] 登录状态已过期');
      clearLoginState();
      return null;
    }
    
    // 3. 如果 CloudBase 可用，验证云端状态
    if (isCloudBaseInitialized()) {
      const auth = getAuth();
      if (auth) {
        try {
          // 获取当前登录用户
          const currentUser = auth.currentUser;
          if (!currentUser) {
            console.log('[Auth] CloudBase 未登录');
            clearLoginState();
            return null;
          }
          
          // 验证 UID 是否匹配
          if (currentUser.uid !== storedUser.uid) {
            console.warn('[Auth] UID 不匹配，清除本地状态');
            clearLoginState();
            return null;
          }
          
          console.log('[Auth] 登录状态有效:', storedUser);
          return {
            ...storedUser,
            email: currentUser.email,
            emailVerified: currentUser.emailVerified
          };
        } catch (e) {
          console.warn('[Auth] 验证云端状态失败:', e);
          // 云端验证失败，但本地状态有效，仍返回本地信息
          return storedUser;
        }
      }
    }
    
    // 开发模式：直接返回本地存储的用户信息
    console.log('[Auth] 开发模式：返回本地登录状态:', storedUser);
    return storedUser;
    
  } catch (error) {
    console.error('[Auth] 检查登录状态失败:', error);
    return null;
  }
}

/**
 * 同步检查登录状态（不等待异步操作）
 * 用于快速检查，不验证云端状态
 * 
 * @returns {Object|null} 用户信息或 null
 */
function checkAuthStatusSync() {
  try {
    const storedUser = getStoredUserInfo();
    if (!storedUser) return null;
    if (isLoginExpired()) {
      clearLoginState();
      return null;
    }
    return storedUser;
  } catch (e) {
    return null;
  }
}

/**
 * 页面访问保护
 * 
 * 功能说明：
 * 1. 检查用户是否已登录
 * 2. 未登录时跳转到登录页面
 * 3. 已登录时继续执行
 * 
 * 使用场景：在需要登录才能访问的页面（如 app.html）中调用
 * 
 * @param {Object} [options] - 配置选项
 * @param {string} [options.loginPage='login.html'] - 登录页面 URL
 * @param {boolean} [options.sync=false] - 是否使用同步检查（默认异步）
 * @returns {Promise<Object|null>} 用户信息或 null（未登录时跳转，不会返回 null）
 * 
 * @example
 * // 在 app.html 中使用
 * import { requireAuth } from './js/auth.js';
 * 
 * // 页面加载时检查
 * document.addEventListener('DOMContentLoaded', async () => {
 *   const userInfo = await requireAuth();
 *   console.log('当前用户:', userInfo.username);
 * });
 */
async function requireAuth(options = {}) {
  const { loginPage = 'login.html', sync = false } = options;
  
  console.log('[Auth] 检查页面访问权限');
  
  let userInfo;
  
  if (sync) {
    userInfo = checkAuthStatusSync();
  } else {
    userInfo = await checkAuthStatus();
  }
  
  if (!userInfo) {
    console.log('[Auth] 未登录，跳转到登录页面');
    navigateTo(loginPage);
    return null;
  }
  
  console.log('[Auth] 已登录，允许访问:', userInfo);
  return userInfo;
}

/**
 * 获取当前用户信息
 * 
 * @returns {Object|null} 用户信息或 null
 */
function getCurrentUser() {
  return checkAuthStatusSync();
}

/**
 * 更新当前用户信息显示
 * 
 * @param {string} [elementId='userName'] - 用户名显示元素 ID
 * @param {string} [avatarId='userAvatar'] - 用户头像元素 ID
 */
function updateUserDisplay(elementId = 'userName', avatarId = 'userAvatar') {
  const userInfo = getCurrentUser();
  
  if (userInfo) {
    // 更新用户名显示
    const nameElement = document.getElementById(elementId);
    if (nameElement) {
      nameElement.textContent = userInfo.username;
    }
    
    // 更新头像显示
    const avatarElement = document.getElementById(avatarId);
    if (avatarElement) {
      // 取用户名的第一个字符作为头像
      avatarElement.textContent = userInfo.username.charAt(0).toUpperCase();
    }
  }
}

// ============================================
// 导出模块
// ============================================

export {
  // 主要功能
  handleLogin,
  handleRegister,
  handleLogout,
  checkAuthStatus,
  checkAuthStatusSync,
  requireAuth,
  getCurrentUser,
  updateUserDisplay,
  
  // 工具函数
  validateUsername,
  validatePassword,
  validatePasswordMatch,
  
  // 错误相关
  AuthErrorCode,
  ErrorMessages,
  createError,
  
  // 状态管理
  saveLoginState,
  clearLoginState,
  getStoredUserInfo,
  isLoginExpired
};

// 默认导出
export default {
  handleLogin,
  handleRegister,
  handleLogout,
  checkAuthStatus,
  checkAuthStatusSync,
  requireAuth,
  getCurrentUser,
  updateUserDisplay,
  AuthErrorCode,
  ErrorMessages
};
