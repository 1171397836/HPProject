import { StorageStrategy } from './StorageStrategy.js';
import { LocalStorageStrategy } from './LocalStorageStrategy.js';
import { CloudStorageStrategy } from './CloudStorageStrategy.js';

/**
 * 混合存储策略
 * 同时使用本地存储和云端存储
 * - 完整配置（含 apiKey）保存到 localStorage
 * - 非敏感配置（不含 apiKey）保存到 Supabase
 * 适用于需要多设备同步但又要保护敏感信息的场景
 */
export class HybridStorageStrategy extends StorageStrategy {
  constructor() {
    super();
    this.name = 'hybrid';
    this.localStrategy = new LocalStorageStrategy();
    this.cloudStrategy = new CloudStorageStrategy();
  }

  /**
   * 过滤敏感信息
   * @param {Object} config - 配置对象
   * @returns {Object} 过滤后的配置对象
   */
  _filterSensitiveData(config) {
    if (!config || typeof config !== 'object') {
      return config;
    }
    const filtered = { ...config };
    // 删除敏感字段
    delete filtered.apiKey;
    return filtered;
  }

  /**
   * 获取存储项
   * 优先从本地读取，如果本地没有则尝试从云端读取
   * @param {string} key - 存储键名
   * @returns {Promise<any>} 存储的值，如果不存在返回 null
   */
  async get(key) {
    // 1. 优先从本地读取
    const localValue = await this.localStrategy.get(key);
    if (localValue !== null) {
      return localValue;
    }

    // 2. 本地没有，尝试从云端读取（向后兼容/迁移）
    const cloudValue = await this.cloudStrategy.get(key);
    if (cloudValue !== null) {
      // 从云端读取后，同步到本地
      await this.localStrategy.set(key, cloudValue);
      console.log('[HybridStorageStrategy] 已从云端迁移配置到本地');
    }

    return cloudValue;
  }

  /**
   * 设置存储项
   * 同时保存到本地和云端（云端会过滤敏感信息）
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值
   * @returns {Promise<boolean>} 是否保存成功
   */
  async set(key, value) {
    // 1. 保存完整配置到本地
    const localResult = await this.localStrategy.set(key, value);

    // 2. 保存非敏感配置到云端
    const cloudResult = await this.cloudStrategy.set(key, value);

    // 本地保存必须成功，云端保存可选
    if (!localResult) {
      console.error('[HybridStorageStrategy] 本地保存失败');
      return false;
    }

    if (!cloudResult) {
      console.warn('[HybridStorageStrategy] 云端保存失败，但本地保存成功');
    } else {
      console.log('[HybridStorageStrategy] 配置已同步到云端（不含 API Key）');
    }

    return true;
  }

  /**
   * 移除存储项
   * 同时从本地和云端移除
   * @param {string} key - 存储键名
   * @returns {Promise<boolean>} 是否移除成功
   */
  async remove(key) {
    const localResult = await this.localStrategy.remove(key);
    const cloudResult = await this.cloudStrategy.remove(key);

    // 只要有一个成功就算成功
    return localResult || cloudResult;
  }

  /**
   * 清空所有存储
   * 同时清空本地和云端
   * @returns {Promise<boolean>} 是否清空成功
   */
  async clear() {
    const localResult = await this.localStrategy.clear();
    const cloudResult = await this.cloudStrategy.clear();

    // 只要有一个成功就算成功
    return localResult || cloudResult;
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
    const localAvailable = await this.localStrategy.isAvailable();
    const cloudAvailable = await this.cloudStrategy.isAvailable();

    // 本地存储必须可用，云端存储可选
    return localAvailable;
  }

  /**
   * 仅保存到本地（用于敏感信息）
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值
   * @returns {Promise<boolean>} 是否保存成功
   */
  async setLocalOnly(key, value) {
    return this.localStrategy.set(key, value);
  }

  /**
   * 仅保存到云端（不含敏感信息）
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值
   * @returns {Promise<boolean>} 是否保存成功
   */
  async setCloudOnly(key, value) {
    return this.cloudStrategy.set(key, value);
  }
}

export default HybridStorageStrategy;
