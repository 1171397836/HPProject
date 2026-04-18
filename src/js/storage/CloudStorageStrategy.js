import { StorageStrategy } from './StorageStrategy.js';
import { supabase } from '../supabaseClient.js';
import { getCurrentUser } from '../auth.js';

/**
 * 云端存储策略
 * 仅使用 Supabase 云端存储
 * 适用于多设备同步场景
 * 注意：敏感信息（如 API Key）不会被存储到云端
 */
export class CloudStorageStrategy extends StorageStrategy {
  constructor() {
    super();
    this.name = 'cloud';
    this.tableName = 'user_configs';
  }

  /**
   * 获取当前用户ID
   * @returns {string|null} 用户ID
   */
  _getUserId() {
    const user = getCurrentUser();
    return user?.uid || null;
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
   * @param {string} key - 存储键名
   * @returns {Promise<any>} 存储的值，如果不存在返回 null
   */
  async get(key) {
    const userId = this._getUserId();
    if (!userId) {
      console.warn('[CloudStorageStrategy] 用户未登录，无法获取云端配置');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('config')
        .eq('uid', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 记录不存在
          return null;
        }
        throw error;
      }

      return data?.config || null;
    } catch (error) {
      console.warn(`[CloudStorageStrategy] 获取键 "${key}" 失败:`, error);
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
    const userId = this._getUserId();
    if (!userId) {
      console.warn('[CloudStorageStrategy] 用户未登录，无法保存到云端');
      return false;
    }

    try {
      // 过滤敏感信息
      const safeValue = this._filterSensitiveData(value);
      const now = new Date().toISOString();

      const { error } = await supabase
        .from(this.tableName)
        .upsert({
          uid: userId,
          config: safeValue,
          updated_at: now
        }, { onConflict: 'uid' });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.warn(`[CloudStorageStrategy] 设置键 "${key}" 失败:`, error);
      return false;
    }
  }

  /**
   * 移除存储项
   * @param {string} key - 存储键名
   * @returns {Promise<boolean>} 是否移除成功
   */
  async remove(key) {
    const userId = this._getUserId();
    if (!userId) {
      console.warn('[CloudStorageStrategy] 用户未登录，无法移除云端配置');
      return false;
    }

    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('uid', userId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.warn(`[CloudStorageStrategy] 移除键 "${key}" 失败:`, error);
      return false;
    }
  }

  /**
   * 清空所有存储
   * @returns {Promise<boolean>} 是否清空成功
   */
  async clear() {
    return this.remove('config');
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
    const userId = this._getUserId();
    if (!userId) {
      return false;
    }

    try {
      const { error } = await supabase
        .from(this.tableName)
        .select('uid')
        .eq('uid', userId)
        .limit(1);

      return !error;
    } catch (error) {
      return false;
    }
  }
}

export default CloudStorageStrategy;
