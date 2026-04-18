import { supabase, supabaseUrl } from './supabaseClient.js';
import CONFIG from './config.js';

const AuthErrorCode = {
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  EMAIL_NOT_CONFIRMED: 'EMAIL_NOT_CONFIRMED'
};

const PASSWORD_MIN_LENGTH = 6;

const ErrorMessages = {
  [AuthErrorCode.INVALID_EMAIL]: '邮箱格式不正确',
  [AuthErrorCode.INVALID_PASSWORD]: '密码不能为空',
  [AuthErrorCode.PASSWORD_TOO_SHORT]: `密码长度至少${PASSWORD_MIN_LENGTH}位`,
  [AuthErrorCode.PASSWORD_MISMATCH]: '两次输入的密码不一致',
  [AuthErrorCode.USER_NOT_FOUND]: '用户不存在或密码错误',
  [AuthErrorCode.WRONG_PASSWORD]: '用户不存在或密码错误',
  [AuthErrorCode.EMAIL_EXISTS]: '邮箱已被注册',
  [AuthErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络',
  [AuthErrorCode.SERVER_ERROR]: '服务器错误，请稍后重试',
  [AuthErrorCode.NOT_INITIALIZED]: '认证服务未初始化',
  [AuthErrorCode.UNKNOWN_ERROR]: '发生未知错误',
  // Supabase 错误码到本地错误码的映射
  [AuthErrorCode.EMAIL_NOT_CONFIRMED]: '邮箱尚未验证，请检查邮件完成验证'
};

function createError(code, message) {
  const error = new Error(message || ErrorMessages[code] || ErrorMessages[AuthErrorCode.UNKNOWN_ERROR]);
  error.code = code;
  return error;
}

/**
 * 将 Supabase 错误映射为本地错误
 * @param {Error} supabaseError - Supabase 返回的错误对象
 * @param {string} defaultCode - 默认错误码
 * @returns {Error} 本地化的错误对象
 */
function mapSupabaseError(supabaseError, defaultCode = AuthErrorCode.UNKNOWN_ERROR) {
  const supabaseCode = supabaseError?.code || supabaseError?.error_code || '';
  const supabaseMessage = supabaseError?.message || '';

  // 根据 Supabase 错误码映射到本地错误码
  let localCode = defaultCode;

  switch (supabaseCode) {
    case 'invalid_credentials':
    case 'user_not_found':
      localCode = AuthErrorCode.WRONG_PASSWORD;
      break;
    case 'user_already_exists':
    case 'email_exists':
      localCode = AuthErrorCode.EMAIL_EXISTS;
      break;
    case 'email_not_confirmed':
      localCode = AuthErrorCode.EMAIL_NOT_CONFIRMED;
      break;
    case 'network_error':
    case 'fetch_error':
      localCode = AuthErrorCode.NETWORK_ERROR;
      break;
    default:
      // 根据错误消息进行模糊匹配
      // 注意：default 分支依赖 Supabase 返回的英文错误消息格式进行匹配，
      // 如果 Supabase 未来版本更改了消息格式，此处可能需要同步更新
      if (supabaseMessage.includes('Email not confirmed')) {
        localCode = AuthErrorCode.EMAIL_NOT_CONFIRMED;
      } else if (supabaseMessage.includes('Invalid login credentials')) {
        localCode = AuthErrorCode.WRONG_PASSWORD;
      } else if (supabaseMessage.includes('User already registered')) {
        localCode = AuthErrorCode.EMAIL_EXISTS;
      }
      break;
  }

  // 使用本地化的错误消息，而不是 Supabase 的英文消息
  const localizedMessage = ErrorMessages[localCode] || ErrorMessages[AuthErrorCode.UNKNOWN_ERROR];
  return createError(localCode, localizedMessage);
}

function getLocationInfo() {
  const globalScope = typeof window !== 'undefined' ? window : globalThis;
  return globalScope.location || {
    protocol: 'http:',
    hostname: 'localhost',
    pathname: '/login.html'
  };
}

function resolveUrl(url) {
  if (/^https?:\/\//.test(url) || url.startsWith('/')) {
    return url;
  }
  const locationInfo = getLocationInfo();
  const pathname = locationInfo.pathname || '/';
  const basePath = pathname.slice(0, pathname.lastIndexOf('/') + 1);
  return `${basePath}${url}`;
}

function navigateTo(url) {
  const globalScope = typeof window !== 'undefined' ? window : globalThis;
  const targetUrl = resolveUrl(url);

  if (globalScope.location) {
    globalScope.location.href = targetUrl;
  }
  return targetUrl;
}

// 邮箱校验替代原来的用户名校验
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: createError(AuthErrorCode.INVALID_EMAIL) };
  }
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: createError(AuthErrorCode.INVALID_EMAIL) };
  }
  
  // 基础邮箱格式正则
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: createError(AuthErrorCode.INVALID_EMAIL) };
  }

  return { valid: true };
}

// 兼容老代码的导出
const validateUsername = validateEmail;

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: createError(AuthErrorCode.INVALID_PASSWORD) };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: createError(AuthErrorCode.PASSWORD_TOO_SHORT) };
  }
  return { valid: true };
}

function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return { valid: false, error: createError(AuthErrorCode.PASSWORD_MISMATCH) };
  }
  return { valid: true };
}

async function handleLogin(email, password, options = {}) {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.error };
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.error };
  }

  const skipRedirect = options.skipRedirect === true;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      // 使用错误映射函数，显示本地化中文错误信息
      throw mapSupabaseError(error, AuthErrorCode.WRONG_PASSWORD);
    }

    if (!skipRedirect) {
      navigateTo('app.html');
    }

    return {
      success: true,
      userInfo: {
        uid: data.user.id,
        email: data.user.email
      },
      mode: 'supabase'
    };
  } catch (error) {
    return {
      success: false,
      error
    };
  }
}

async function handleRegister(email, password, confirmPassword, options = {}) {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.error };
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.error };
  }

  const passwordMatchValidation = validatePasswordMatch(password, confirmPassword);
  if (!passwordMatchValidation.valid) {
    return { success: false, error: passwordMatchValidation.error };
  }

  const skipRedirect = options.skipRedirect === true;

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password
    });

    if (error) {
      // 使用错误映射函数，显示本地化中文错误信息
      throw mapSupabaseError(error, AuthErrorCode.EMAIL_EXISTS);
    }

    if (!skipRedirect) {
      navigateTo('app.html');
    }

    return {
      success: true,
      userInfo: {
        uid: data.user.id,
        email: data.user.email
      },
      mode: 'supabase'
    };
  } catch (error) {
    return {
      success: false,
      error
    };
  }
}

async function handleLogout(options = {}) {
  try {
    await supabase.auth.signOut();
    if (!options.skipRedirect) {
      navigateTo('login.html');
    }
    return { success: true };
  } catch (error) {
    // 即使 signOut 失败（如断网），也要清理本地缓存，避免死循环
    clearAuthStorage();
    if (!options.skipRedirect) {
      navigateTo('login.html');
    }
    return {
      success: false,
      error: createError(AuthErrorCode.UNKNOWN_ERROR, error?.message || '退出失败')
    };
  }
}

/**
 * 清除本地存储的认证相关数据
 */
function clearAuthStorage() {
  const globalScope = typeof window !== 'undefined' ? window : globalThis;
  if (!globalScope.localStorage) return;

  // 获取 Supabase 项目 ID 并构建 token 键名
  const projectId = getSupabaseProjectId();
  const authTokenKey = projectId ? `sb-${projectId}-auth-token` : null;

  // 清除 Supabase auth token
  if (authTokenKey) {
    globalScope.localStorage.removeItem(authTokenKey);
  }

  // 清除其他可能的认证相关键
  const keysToRemove = [];
  for (let i = 0; i < globalScope.localStorage.length; i++) {
    const key = globalScope.localStorage.key(i);
    if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => globalScope.localStorage.removeItem(key));
}

/**
 * 从 Supabase URL 中提取项目 ID
 * 注意：当前仅匹配 supabase.co 域名格式（如 xxx.supabase.co），
 * 如果使用自托管 Supabase 或其他域名，此函数将返回 null
 */
function getSupabaseProjectId() {
  try {
    if (!supabaseUrl) return null;
    const url = new URL(supabaseUrl);
    const hostname = url.hostname;
    const match = hostname.match(/^([^.]+)\.supabase\.co$/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

// 提供同步获取用户信息的函数（尽最大努力返回，可能为空），以兼容旧版代码
function checkAuthStatusSync() {
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  // 动态获取 Supabase auth token 键名
  const projectId = getSupabaseProjectId();
  const authTokenKey = projectId ? `sb-${projectId}-auth-token` : null;

  // 如果没有获取到项目ID，尝试查找所有可能的 Supabase auth token
  let storageStr = null;
  if (authTokenKey) {
    storageStr = globalScope.localStorage?.getItem(authTokenKey);
  }

  // 如果指定键名没找到，尝试查找任何匹配的 sb-*-auth-token 键
  if (!storageStr && globalScope.localStorage) {
    for (let i = 0; i < globalScope.localStorage.length; i++) {
      const key = globalScope.localStorage.key(i);
      if (key && key.match(/^sb-[^-]+-auth-token$/)) {
        storageStr = globalScope.localStorage.getItem(key);
        if (storageStr) break;
      }
    }
  }

  if (storageStr) {
    try {
      const session = JSON.parse(storageStr);
      if (session && session.user) {
        return {
          uid: session.user.id,
          email: session.user.email,
          username: session.user.email.split('@')[0]
        };
      }
    } catch (e) {
      // do nothing
    }
  }
  return null;
}

async function checkAuthStatus() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    return {
      uid: session.user.id,
      email: session.user.email,
      username: session.user.email.split('@')[0]
    };
  }
  return null;
}

async function requireAuth(options = {}) {
  const { loginPage = 'login.html', sync = false } = options;
  const userInfo = sync ? checkAuthStatusSync() : await checkAuthStatus();

  if (!userInfo) {
    navigateTo(loginPage);
    return null;
  }
  return userInfo;
}

function getCurrentUser() {
  return checkAuthStatusSync();
}

function updateUserDisplay(elementId = 'userName', avatarId = 'userAvatar') {
  if (typeof document === 'undefined') return;

  const userInfo = getCurrentUser();
  if (!userInfo) return;

  const nameElement = document.getElementById(elementId);
  const avatarElement = document.getElementById(avatarId);
  
  const displayName = userInfo.username || userInfo.email;

  if (nameElement) {
    nameElement.textContent = displayName;
  }

  if (avatarElement) {
    avatarElement.textContent = displayName.charAt(0).toUpperCase();
  }
}

export {
  AuthErrorCode,
  ErrorMessages,
  checkAuthStatus,
  checkAuthStatusSync,
  createError,
  getCurrentUser,
  handleLogin,
  handleLogout,
  handleRegister,
  navigateTo,
  requireAuth,
  updateUserDisplay,
  validatePassword,
  validatePasswordMatch,
  validateUsername,
  validateEmail
};

export default {
  handleLogin,
  handleRegister,
  handleLogout,
  checkAuthStatus,
  checkAuthStatusSync,
  requireAuth,
  getCurrentUser,
  updateUserDisplay
};
