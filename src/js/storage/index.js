/**
 * 存储策略模块统一导出
 * 提供多种存储策略实现，支持本地存储、云端存储和混合存储
 */

// 导出抽象基类
export { StorageStrategy } from './StorageStrategy.js';

// 导出具体策略实现
export { LocalStorageStrategy } from './LocalStorageStrategy.js';
export { CloudStorageStrategy } from './CloudStorageStrategy.js';
export { HybridStorageStrategy } from './HybridStorageStrategy.js';

// 导出工厂类
export { StorageFactory } from './StorageFactory.js';

// 默认导出工厂类
export { StorageFactory as default } from './StorageFactory.js';
