import { StorageFactory } from './storage/index.js';
import { getCurrentUser } from './auth.js';

/**
 * AI 配置管理模块
 * 管理 LLM 提供商、API Key、模型选择等配置
 * 使用策略模式支持本地存储和云端同步
 * API Key 始终只保存在本地，不上传到云端
 */

const AI_CONFIG_KEY = 'tiewan_ai_config';

const AI_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    apiBase: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3.2 (通用)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (推理)' }
    ],
    defaultModel: 'deepseek-chat'
  },
  kimi: {
    name: 'Kimi (Moonshot)',
    apiBase: 'https://api.moonshot.cn/v1',
    models: [
      { id: 'kimi-k2.5', name: 'Kimi K2.5 (旗舰, 256K)' },
      { id: 'kimi-k2-0905-preview', name: 'Kimi K2 0905 预览版' },
      { id: 'kimi-k2-0711-preview', name: 'Kimi K2 0711 预览版' },
      { id: 'kimi-k2-turbo-preview', name: 'Kimi K2 Turbo' },
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K (轻量)' },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K' }
    ],
    defaultModel: 'kimi-k2.5'
  },
  glm: {
    name: '智谱 GLM',
    apiBase: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-4.6', name: 'GLM-4.6 (最新)' },
      { id: 'glm-4.6V', name: 'GLM-4.6V (视觉多模态)' },
      { id: 'glm-4-plus', name: 'GLM-4-Plus (高智能)' },
      { id: 'glm-4-air-250414', name: 'GLM-4-Air-250414' },
      { id: 'glm-4-airx', name: 'GLM-4-AirX (高速)' },
      { id: 'glm-4-flash', name: 'GLM-4-Flash (轻量)' }
    ],
    defaultModel: 'glm-4.6'
  },
  qwen: {
    name: '通义千问',
    apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen3.6-plus', name: 'Qwen 3.6 Plus (最新, 100万上下文)' },
      { id: 'qwen3.5-plus', name: 'Qwen 3.5 Plus' },
      { id: 'qwen3.5-flash', name: 'Qwen 3.5 Flash (轻量)' },
      { id: 'qwen3.5-max', name: 'Qwen 3.5 Max (旗舰)' },
      { id: 'qwen-plus', name: 'Qwen-Plus (128K)' },
      { id: 'qwen-turbo', name: 'Qwen-Turbo (1M上下文)' }
    ],
    defaultModel: 'qwen3.6-plus'
  },
  openai: {
    name: 'OpenAI',
    apiBase: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4.5', name: 'GPT-4.5 (最新)' },
      { id: 'gpt-4o', name: 'GPT-4o (多模态)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (轻量)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ],
    defaultModel: 'gpt-4o'
  },
  custom: {
    name: '自定义',
    apiBase: '',
    models: [],
    defaultModel: ''
  }
};

const DEFAULT_CONFIG = {
  provider: 'deepseek',
  apiKey: '',
  model: 'deepseek-chat',
  customApiBase: '',
  customModel: '',
  syncToCloud: false  // 新增：是否同步到云端
};

// 内存中缓存配置，支持同步读取
let cachedConfig = { ...DEFAULT_CONFIG };
let isInitialized = false;
let currentStorageStrategy = null;

/**
 * 获取当前存储策略
 * @returns {StorageStrategy} 存储策略实例
 */
function getStorageStrategy() {
  if (!currentStorageStrategy) {
    currentStorageStrategy = StorageFactory.createStrategy(cachedConfig.syncToCloud);
  }
  return currentStorageStrategy;
}

/**
 * 重新初始化存储策略
 * 当 syncToCloud 设置改变时调用
 */
function reinitializeStorageStrategy() {
  currentStorageStrategy = StorageFactory.createStrategy(cachedConfig.syncToCloud);
}

/**
 * 初始化 AI 配置
 * 根据 syncToCloud 设置选择存储策略
 */
async function initAIConfig() {
  // 先尝试从本地读取配置（包含 syncToCloud 设置）
  const localStrategy = StorageFactory.createStrategy(false);
  const localConfig = await localStrategy.get(AI_CONFIG_KEY);

  if (localConfig) {
    cachedConfig = { ...DEFAULT_CONFIG, ...localConfig };
  }

  // 根据 syncToCloud 设置初始化存储策略
  reinitializeStorageStrategy();

  // 如果使用云端同步，尝试从云端获取更新的配置
  if (cachedConfig.syncToCloud) {
    const user = getCurrentUser();
    if (user && user.uid) {
      try {
        const cloudConfig = await getStorageStrategy().get(AI_CONFIG_KEY);
        if (cloudConfig) {
          // 合并云端配置（云端配置优先级更高，但不覆盖本地 API Key）
          const localApiKey = cachedConfig.apiKey;
          cachedConfig = { ...cachedConfig, ...cloudConfig };
          cachedConfig.apiKey = localApiKey || cloudConfig.apiKey || '';
        }
      } catch (error) {
        console.warn('[AIConfig] 从云端加载配置失败', error);
      }
    }
  }

  isInitialized = true;
}

/**
 * 读取 AI 配置 (同步，返回缓存)
 * @returns {Object} AI 配置对象
 */
function getAIConfig() {
  return { ...cachedConfig };
}

/**
 * 保存 AI 配置
 * 根据 syncToCloud 设置决定存储策略
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否启动保存
 */
function saveAIConfig(config) {
  const newConfig = { ...DEFAULT_CONFIG, ...config };
  cachedConfig = newConfig;

  // 如果 syncToCloud 设置改变，重新初始化存储策略
  if (currentStorageStrategy && currentStorageStrategy.getStrategyName() !== (newConfig.syncToCloud ? 'hybrid' : 'local')) {
    reinitializeStorageStrategy();
  }

  // 使用当前存储策略保存配置
  const strategy = getStorageStrategy();
  strategy.set(AI_CONFIG_KEY, newConfig).then(success => {
    if (success) {
      console.log(`[AIConfig] 配置已保存（策略: ${strategy.getStrategyName()}）`);
    } else {
      console.error('[AIConfig] 配置保存失败');
    }
  });

  return true;
}

function validateAIConfig(config) {
  if (!config) return { valid: false, error: '配置不能为空' };
  if (!config.provider) return { valid: false, error: '请选择 LLM 提供商' };
  if (!AI_PROVIDERS[config.provider]) return { valid: false, error: '未知的提供商' };
  if (!config.apiKey || config.apiKey.trim().length < 10) return { valid: false, error: '请输入有效的 API Key' };

  if (config.provider === 'custom') {
    if (!config.customApiBase || !config.customApiBase.trim()) return { valid: false, error: '请输入自定义 API 地址' };
    if (!config.customModel || !config.customModel.trim()) return { valid: false, error: '请输入自定义模型名称' };
  } else {
    if (!config.model) return { valid: false, error: '请选择模型' };
  }

  return { valid: true, error: null };
}

function getApiBase(config) {
  if (config.provider === 'custom') return config.customApiBase?.trim() || '';
  return AI_PROVIDERS[config.provider]?.apiBase || '';
}

function getModelId(config) {
  if (config.provider === 'custom') return config.customModel?.trim() || '';
  return config.model || AI_PROVIDERS[config.provider]?.defaultModel || '';
}

function getProviderModels(provider) {
  return AI_PROVIDERS[provider]?.models || [];
}

function getProviderDefaultModel(provider) {
  return AI_PROVIDERS[provider]?.defaultModel || '';
}

function isAIConfigReady() {
  const config = getAIConfig();
  return !!config.apiKey && config.apiKey.trim().length >= 10;
}

/**
 * 清除 AI 配置
 * 同时清除本地和云端配置
 */
async function clearAIConfig() {
  cachedConfig = { ...DEFAULT_CONFIG };

  // 清除本地存储
  const localStrategy = StorageFactory.createStrategy(false);
  await localStrategy.remove(AI_CONFIG_KEY);

  // 清除云端配置
  const user = getCurrentUser();
  if (user && user.uid) {
    const hybridStrategy = StorageFactory.createStrategy(true);
    await hybridStrategy.remove(AI_CONFIG_KEY);
  }

  currentStorageStrategy = null;
}

export {
  AI_CONFIG_KEY,
  AI_PROVIDERS,
  DEFAULT_CONFIG,
  clearAIConfig,
  getAIConfig,
  getApiBase,
  getModelId,
  getProviderDefaultModel,
  getProviderModels,
  isAIConfigReady,
  saveAIConfig,
  validateAIConfig,
  initAIConfig
};

export default {
  AI_PROVIDERS,
  DEFAULT_CONFIG,
  getAIConfig,
  saveAIConfig,
  validateAIConfig,
  isAIConfigReady,
  getApiBase,
  getModelId,
  getProviderModels,
  getProviderDefaultModel,
  clearAIConfig,
  initAIConfig
};
