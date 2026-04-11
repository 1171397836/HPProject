/**
 * 登录/注册共享认证模块
 * 目标：
 * 1. 本地开发默认可注册、可登录；
 * 2. login/app 共用同一套认证状态与用户库；
 * 3. CloudBase 可用时仍保留云端认证能力。
 */

const STORAGE_KEY_USER = 'tiewan_user';
const STORAGE_KEY_LOGIN_TIME = 'tiewan_login_time';
const STORAGE_KEY_USERS_DB = 'tiewan_users_db';

const LOGIN_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 6;
const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 20;
const CLOUDBASE_ENV = 'ironhand-8gclol9h5c79d816';

const globalScope = typeof window !== 'undefined' ? window : globalThis;

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
    },
    clear() {
      store.clear();
    }
  };
}

const safeStorage = (() => {
  try {
    if (globalScope.localStorage) {
      return globalScope.localStorage;
    }
  } catch (error) {
    console.warn('[Auth] localStorage 不可用，回退到内存存储', error);
  }

  return createMemoryStorage();
})();

const AuthErrorCode = {
  INVALID_USERNAME: 'INVALID_USERNAME',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  USERNAME_EXISTS: 'USERNAME_EXISTS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

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

function createError(code, message) {
  const error = new Error(message || ErrorMessages[code] || ErrorMessages[AuthErrorCode.UNKNOWN_ERROR]);
  error.code = code;
  return error;
}

function getLocationInfo() {
  return globalScope.location || {
    protocol: 'http:',
    hostname: 'localhost',
    pathname: '/viewer01/login.html'
  };
}

function shouldUseLocalAuth() {
  const locationInfo = getLocationInfo();

  if (locationInfo.protocol === 'file:') {
    return true;
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '']);
  return localHosts.has(locationInfo.hostname || '');
}

function getCloudBaseGlobal() {
  if (typeof globalScope.cloudbase !== 'undefined') {
    return globalScope.cloudbase;
  }

  return null;
}

function getCloudBaseApp() {
  if (shouldUseLocalAuth()) {
    return null;
  }

  const cloudbase = getCloudBaseGlobal();
  if (!cloudbase || typeof cloudbase.init !== 'function') {
    return null;
  }

  try {
    if (cloudbase.config?.env === CLOUDBASE_ENV) {
      return cloudbase;
    }

    return cloudbase.init({
      env: CLOUDBASE_ENV,
      persistence: 'local'
    });
  } catch (error) {
    console.warn('[Auth] CloudBase 初始化失败，转为本地认证模式', error);
    return null;
  }
}

function getCloudAuth() {
  const app = getCloudBaseApp();

  try {
    return app && typeof app.auth === 'function' ? app.auth() : null;
  } catch (error) {
    console.warn('[Auth] 获取 CloudBase Auth 失败', error);
    return null;
  }
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: createError(AuthErrorCode.INVALID_USERNAME) };
  }

  const trimmed = username.trim();

  if (!trimmed) {
    return { valid: false, error: createError(AuthErrorCode.INVALID_USERNAME) };
  }

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return { valid: false, error: createError(AuthErrorCode.INVALID_USERNAME, `用户名至少需要${USERNAME_MIN_LENGTH}个字符`) };
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return { valid: false, error: createError(AuthErrorCode.INVALID_USERNAME, `用户名不能超过${USERNAME_MAX_LENGTH}个字符`) };
  }

  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(trimmed)) {
    return { valid: false, error: createError(AuthErrorCode.INVALID_USERNAME, '用户名只能包含字母、数字、中文和下划线') };
  }

  return { valid: true };
}

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

function readJSON(key, fallback) {
  try {
    const rawValue = safeStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch (error) {
    console.warn(`[Auth] 读取 ${key} 失败`, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  safeStorage.setItem(key, JSON.stringify(value));
}

const LocalUserDB = {
  getDB() {
    return readJSON(STORAGE_KEY_USERS_DB, {});
  },

  saveDB(db) {
    writeJSON(STORAGE_KEY_USERS_DB, db);
    return true;
  },

  findUser(username) {
    const db = this.getDB();
    return db[username.trim()] || null;
  },

  createUser(username, password) {
    const trimmedUsername = username.trim();
    const db = this.getDB();

    if (db[trimmedUsername]) {
      return { success: false, error: createError(AuthErrorCode.USERNAME_EXISTS) };
    }

    const user = {
      username: trimmedUsername,
      uid: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      password,
      createdAt: new Date().toISOString()
    };

    db[trimmedUsername] = user;
    this.saveDB(db);

    return { success: true, user };
  },

  verifyUser(username, password) {
    const user = this.findUser(username);

    if (!user) {
      return { success: false, error: createError(AuthErrorCode.USER_NOT_FOUND) };
    }

    if (user.password !== password) {
      return { success: false, error: createError(AuthErrorCode.WRONG_PASSWORD) };
    }

    return { success: true, user };
  }
};

function saveLoginState(userInfo) {
  const loginTime = Date.now();

  writeJSON(STORAGE_KEY_USER, {
    username: userInfo.username,
    uid: userInfo.uid,
    email: userInfo.email || null,
    loginTime
  });
  safeStorage.setItem(STORAGE_KEY_LOGIN_TIME, String(loginTime));
}

function clearLoginState() {
  safeStorage.removeItem(STORAGE_KEY_USER);
  safeStorage.removeItem(STORAGE_KEY_LOGIN_TIME);
}

function getStoredUserInfo() {
  return readJSON(STORAGE_KEY_USER, null);
}

function isLoginExpired() {
  try {
    const loginTime = Number(safeStorage.getItem(STORAGE_KEY_LOGIN_TIME));

    if (!loginTime) {
      return true;
    }

    return Date.now() - loginTime > LOGIN_EXPIRE_TIME;
  } catch (error) {
    return true;
  }
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
  const targetUrl = resolveUrl(url);

  if (globalScope.location) {
    globalScope.location.href = targetUrl;
  }

  return targetUrl;
}

function mapCloudAuthError(error) {
  switch (error?.code) {
    case 'auth/user-not-found':
      return createError(AuthErrorCode.USER_NOT_FOUND);
    case 'auth/wrong-password':
      return createError(AuthErrorCode.WRONG_PASSWORD);
    case 'auth/email-already-in-use':
      return createError(AuthErrorCode.USERNAME_EXISTS);
    case 'auth/invalid-email':
      return createError(AuthErrorCode.INVALID_USERNAME, '用户名格式不正确');
    case 'auth/weak-password':
      return createError(AuthErrorCode.PASSWORD_TOO_SHORT, '密码强度不够');
    case 'auth/network-request-failed':
      return createError(AuthErrorCode.NETWORK_ERROR);
    default:
      return createError(AuthErrorCode.UNKNOWN_ERROR, error?.message || '认证失败');
  }
}

async function handleLogin(username, password, options = {}) {
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return { success: false, error: usernameValidation.error };
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.error };
  }

  const skipRedirect = options.skipRedirect === true;
  const useLocalAuth = shouldUseLocalAuth();

  try {
    let userInfo;

    if (useLocalAuth) {
      const verifyResult = LocalUserDB.verifyUser(username, password);

      if (!verifyResult.success) {
        throw verifyResult.error;
      }

      userInfo = {
        username: verifyResult.user.username,
        uid: verifyResult.user.uid,
        loginTime: Date.now()
      };
    } else {
      const auth = getCloudAuth();

      if (!auth) {
        throw createError(AuthErrorCode.NOT_INITIALIZED);
      }

      const email = `${username.trim()}@tiewan.local`;
      const loginResult = await auth.signInWithEmailAndPassword(email, password);

      if (!loginResult?.user) {
        throw createError(AuthErrorCode.UNKNOWN_ERROR, '登录失败，请重试');
      }

      userInfo = {
        username: username.trim(),
        uid: loginResult.user.uid,
        email: loginResult.user.email || email,
        loginTime: Date.now()
      };
    }

    saveLoginState(userInfo);

    if (!skipRedirect) {
      navigateTo('app.html');
    }

    return {
      success: true,
      userInfo,
      mode: useLocalAuth ? 'local' : 'cloud'
    };
  } catch (error) {
    return {
      success: false,
      error: useLocalAuth ? error : mapCloudAuthError(error)
    };
  }
}

async function handleRegister(username, password, confirmPassword, options = {}) {
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return { success: false, error: usernameValidation.error };
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
  const useLocalAuth = shouldUseLocalAuth();

  try {
    let userInfo;

    if (useLocalAuth) {
      const createResult = LocalUserDB.createUser(username, password);

      if (!createResult.success) {
        throw createResult.error;
      }

      userInfo = {
        username: createResult.user.username,
        uid: createResult.user.uid,
        loginTime: Date.now()
      };
    } else {
      const auth = getCloudAuth();

      if (!auth) {
        throw createError(AuthErrorCode.NOT_INITIALIZED);
      }

      const email = `${username.trim()}@tiewan.local`;
      const registerResult = await auth.signUpWithEmailAndPassword(email, password);

      if (!registerResult?.user) {
        throw createError(AuthErrorCode.UNKNOWN_ERROR, '注册失败，请重试');
      }

      userInfo = {
        username: username.trim(),
        uid: registerResult.user.uid,
        email: registerResult.user.email || email,
        loginTime: Date.now()
      };
    }

    saveLoginState(userInfo);

    if (!skipRedirect) {
      navigateTo('app.html');
    }

    return {
      success: true,
      userInfo,
      mode: useLocalAuth ? 'local' : 'cloud'
    };
  } catch (error) {
    return {
      success: false,
      error: useLocalAuth ? error : mapCloudAuthError(error)
    };
  }
}

async function handleLogout(options = {}) {
  const useLocalAuth = shouldUseLocalAuth();

  try {
    if (!useLocalAuth) {
      const auth = getCloudAuth();
      if (auth?.signOut) {
        await auth.signOut();
      }
    }

    clearLoginState();

    if (!options.skipRedirect) {
      navigateTo('login.html');
    }

    return { success: true };
  } catch (error) {
    clearLoginState();

    if (!options.skipRedirect) {
      navigateTo('login.html');
    }

    return {
      success: false,
      error: createError(AuthErrorCode.UNKNOWN_ERROR, error?.message || '退出失败')
    };
  }
}

function checkAuthStatusSync() {
  const storedUser = getStoredUserInfo();

  if (!storedUser) {
    return null;
  }

  if (isLoginExpired()) {
    clearLoginState();
    return null;
  }

  return storedUser;
}

async function checkAuthStatus() {
  const storedUser = checkAuthStatusSync();
  if (!storedUser) {
    return null;
  }

  if (shouldUseLocalAuth()) {
    return storedUser;
  }

  try {
    const auth = getCloudAuth();
    const currentUser = auth?.currentUser;

    if (!currentUser) {
      return storedUser;
    }

    if (currentUser.uid && currentUser.uid !== storedUser.uid) {
      clearLoginState();
      return null;
    }

    return {
      ...storedUser,
      email: currentUser.email || storedUser.email || null
    };
  } catch (error) {
    console.warn('[Auth] 云端登录态校验失败，继续使用本地会话', error);
    return storedUser;
  }
}

async function requireAuth(options = {}) {
  const {
    loginPage = 'login.html',
    sync = false
  } = options;

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
  if (typeof document === 'undefined') {
    return;
  }

  const userInfo = getCurrentUser();
  if (!userInfo) {
    return;
  }

  const nameElement = document.getElementById(elementId);
  const avatarElement = document.getElementById(avatarId);

  if (nameElement) {
    nameElement.textContent = userInfo.username;
  }

  if (avatarElement) {
    avatarElement.textContent = userInfo.username.charAt(0).toUpperCase();
  }
}

export {
  AuthErrorCode,
  CLOUDBASE_ENV,
  ErrorMessages,
  LocalUserDB,
  checkAuthStatus,
  checkAuthStatusSync,
  clearLoginState,
  createError,
  getCurrentUser,
  getStoredUserInfo,
  handleLogin,
  handleLogout,
  handleRegister,
  isLoginExpired,
  navigateTo,
  requireAuth,
  saveLoginState,
  shouldUseLocalAuth,
  updateUserDisplay,
  validatePassword,
  validatePasswordMatch,
  validateUsername
};

export default {
  handleLogin,
  handleRegister,
  handleLogout,
  checkAuthStatus,
  checkAuthStatusSync,
  requireAuth,
  getCurrentUser,
  updateUserDisplay,
  shouldUseLocalAuth
};
