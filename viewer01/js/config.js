/**
 * 前端配置信息集中管理
 */

const globalScope = typeof window !== 'undefined' ? window : globalThis;
const hostname = globalScope.location ? globalScope.location.hostname : 'localhost';

const ENV = (hostname === 'localhost' || hostname === '127.0.0.1') ? 'local' : 'production';

const CONFIG = {
  ENV,
  STORAGE_KEYS: {
    CURRENT_QUADRANT: 'tiewan_current_quadrant'
  }
};

export default CONFIG;
