/**
 * 前端配置信息集中管理
 */

const globalScope = typeof window !== 'undefined' ? window : globalThis;
const hostname = globalScope.location ? globalScope.location.hostname : 'localhost';

const ENV = (hostname === 'localhost' || hostname === '127.0.0.1') ? 'local' : 'production';

const CONFIG = {
  ENV,
  STORAGE_KEYS: {
    CURRENT_QUADRANT: 'tiewan_current_quadrant',
    CURRENT_WORKSPACE: 'tiewan_current_workspace',
    AI_CHAT_HISTORY: 'tiewan_ai_chat_history',
    AI_CONFIG: 'tiewan_ai_config'
  }
};

export default CONFIG;
