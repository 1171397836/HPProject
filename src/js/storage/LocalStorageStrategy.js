import { StorageStrategy } from './StorageStrategy.js';

/**
 * 本地存储策略
 * 仅使用 localStorage 进行数据存储
 * 适用于不想将数据同步到云端的场景
 */
export class LocalStorageStrategy extends StorageStrategy {
  constructor() {
    super();
    this.name = 'local';
  }

  /**
   * 获取存储项
   * @param {string} key - 存储键名
   * @returns {Promise<any>} 存储的值，如果不存在返回 null
   */
  async get(key) {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        return null;
      }
      return JSON.parse(stored);
    } catch (error) {
      console.warn(`[LocalStorageStrategy] 获取键 "${key}" 失败:`, error);
      return null;
    }
  }

  /**
   * 设置存储项
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值
   * @returns {Promise<boolean>} 是否保存成功
   */
  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[LocalStorageStrategy] 设置键 "${key}" 失败:`, error);
      return false;
    }
  }

  /**
   * 移除存储项
   * @param {string} key - 存储键名
   * @returns {Promise<boolean>} 是否移除成功
   */
  async remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`[LocalStorageStrategy] 移除键 "${key}" 失败:`, error);
      return false;
    }
  }

  /**
   * 清空所有存储
   * @returns {Promise<boolean>} 是否清空成功
   */
  async clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('[LocalStorageStrategy] 清空存储失败:', error);
      return false;
    }
  }

  /**
   * 获取策略名称
   * @returns {string} 策略名称
   */
  getStrategyName() {
    return this.name;
  }

  /**
   * 检查策略是否可用
   * @returns {Promise<boolean>} 策略是否可用
   */
  async isAvailable() {
    try {
      const testKey = '__local_storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default LocalStorageStrategy;
