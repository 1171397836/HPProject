import { LocalStorageStrategy } from './LocalStorageStrategy.js';
import { HybridStorageStrategy } from './HybridStorageStrategy.js';
import { CloudStorageStrategy } from './CloudStorageStrategy.js';

/**
 * 存储策略工厂类
 * 根据用户选择创建对应的存储策略实例
 * 支持：本地存储、云端存储、混合存储
 */
export class StorageFactory {
  /**
   * 创建存储策略实例
   * @param {boolean} syncToCloud - 是否同步到云端
   * @returns {StorageStrategy} 存储策略实例
   */
  static createStrategy(syncToCloud = false) {
    if (syncToCloud) {
      return new HybridStorageStrategy();
    }
    return new LocalStorageStrategy();
  }

  /**
   * 根据策略名称创建存储策略实例
   * @param {string} strategyName - 策略名称: 'local' | 'cloud' | 'hybrid'
   * @returns {StorageStrategy} 存储策略实例
   */
  static createStrategyByName(strategyName) {
    switch (strategyName) {
      case 'local':
        return new LocalStorageStrategy();
      case 'cloud':
        return new CloudStorageStrategy();
      case 'hybrid':
        return new HybridStorageStrategy();
      default:
        console.warn(`[StorageFactory] 未知的策略名称 "${strategyName}"，使用默认本地存储策略`);
        return new LocalStorageStrategy();
    }
  }

  /**
   * 获取所有可用的策略名称
   * @returns {Array<{name: string, label: string, description: string}>} 策略列表
   */
  static getAvailableStrategies() {
    return [
      {
        name: 'local',
        label: '仅本地存储',
        description: '配置仅保存在浏览器本地，换设备后需要重新配置'
      },
      {
        name: 'hybrid',
        label: '同步到云端',
        description: '非敏感配置同步到云端，换设备登录后可恢复（API Key 始终仅保存在本地）'
      }
    ];
  }

  /**
   * 检查策略是否可用
   * @param {string} strategyName - 策略名称
   * @returns {Promise<boolean>} 策略是否可用
   */
  static async isStrategyAvailable(strategyName) {
    const strategy = this.createStrategyByName(strategyName);
    return strategy.isAvailable();
  }
}

export default StorageFactory;
