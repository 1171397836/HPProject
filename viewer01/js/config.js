/**
 * 前端配置信息集中管理
 */

const globalScope = typeof window !== 'undefined' ? window : globalThis;
const hostname = globalScope.location ? globalScope.location.hostname : 'localhost';

const ENV = (hostname === 'localhost' || hostname === '127.0.0.1') ? 'local' : 'production';

const CONFIG = {
  ENV,
  API_BASE_URL: ENV === 'local' ? 'http://localhost:3000/api' : '/api',
  STORAGE_KEYS: {
    USER: 'tiewan_user',
    LOGIN_TIME: 'tiewan_login_time',
    USERS_DB: 'tiewan_users_db',
    TASKS_DB: 'tiewan_tasks_db',
    CURRENT_QUADRANT: 'tiewan_current_quadrant'
  }
};

export default CONFIG;
