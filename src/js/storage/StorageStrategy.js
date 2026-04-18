/**
 * 存储策略抽象基类
 * 定义存储策略的标准接口
 * 所有具体的存储策略都需要继承此类并实现其方法
 */
export class StorageStrategy {
  /**
   * 获取存储项
   * @param {string} key - 存储键名
   * @returns {Promise<any>} 存储的值
   * @throws {Error} 必须由子类实现
   */
  async get(key) {
    throw new Error('StorageStrategy.get() must be implemented by subclass');
  }

  /**
   * 设置存储项
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值
   * @returns {Promise<boolean>} 是否保存成功
   * @throws {Error} 必须由子类实现
   */
  async set(key, value) {
    throw new Error('StorageStrategy.set() must be implemented by subclass');
  }

  /**
   * 移除存储项
   * @param {string} key - 存储键名
   * @returns {Promise<boolean>} 是否移除成功
   * @throws {Error} 必须由子类实现
   */
  async remove(key) {
    throw new Error('StorageStrategy.remove() must be implemented by subclass');
  }

  /**
   * 清空所有存储
   * @returns {Promise<boolean>} 是否清空成功
   * @throws {Error} 必须由子类实现
   */
  async clear() {
    throw new Error('StorageStrategy.clear() must be implemented by subclass');
  }

  /**
   * 获取策略名称
   * @returns {string} 策略名称
   */
  getStrategyName() {
    return 'base';
  }

  /**
   * 检查策略是否可用
   * @returns {Promise<boolean>} 策略是否可用
   */
  async isAvailable() {
    return true;
  }
}

export default StorageStrategy;
