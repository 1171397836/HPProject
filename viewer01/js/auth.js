import { supabase } from './supabaseClient.js';
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
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
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
  [AuthErrorCode.UNKNOWN_ERROR]: '发生未知错误'
};

function createError(code, message) {
  const error = new Error(message || ErrorMessages[code] || ErrorMessages[AuthErrorCode.UNKNOWN_ERROR]);
  error.code = code;
  return error;
}

function getLocationInfo() {
  const globalScope = typeof window !== 'undefined' ? window : globalThis;
  return globalScope.location || {
    protocol: 'http:',
    hostname: 'localhost',
    pathname: '/viewer01/login.html'
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
      throw createError(AuthErrorCode.WRONG_PASSWORD, error.message);
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
      throw createError(AuthErrorCode.EMAIL_EXISTS, error.message);
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
    if (!options.skipRedirect) {
      navigateTo('login.html');
    }
    return {
      success: false,
      error: createError(AuthErrorCode.UNKNOWN_ERROR, error?.message || '退出失败')
    };
  }
}

// 提供同步获取用户信息的函数（尽最大努力返回，可能为空），以兼容旧版代码
function checkAuthStatusSync() {
  const globalScope = typeof window !== 'undefined' ? window : globalThis;
  const storageStr = globalScope.localStorage?.getItem('sb-rgxulfvkvrxglupdlrhf-auth-token');
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
