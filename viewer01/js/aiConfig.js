import { getCurrentUser } from './auth.js';

/**
 * AI 配置管理模块
 * 管理 LLM 提供商、API Key、模型选择等配置
 * 配置存储在 localStorage 中，key 为动态生成
 */

// 动态获取当前用户的 storage key
function getStorageKey() {
  const user = getCurrentUser();
  if (user && user.uid) {
    return `tiewan_ai_config_${user.uid}`;
  }
  return 'tiewan_ai_config_default';
}

// 兼容旧版配置或对外导出
const AI_CONFIG_KEY = 'tiewan_ai_config';

// 支持的 LLM 提供商配置 (2026年最新模型)
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

// 默认配置 (2026年最新默认模型)
const DEFAULT_CONFIG = {
  provider: 'deepseek',
  apiKey: '',
  model: 'deepseek-chat',
  customApiBase: '',
  customModel: ''
};

/**
 * 获取安全的 localStorage 引用
 */
function getSafeStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    console.warn('[AIConfig] localStorage 不可用', error);
  }
  return null;
}

/**
 * 读取 AI 配置
 * @returns {Object} AI 配置对象
 */
function getAIConfig() {
  const storage = getSafeStorage();
  if (!storage) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const key = getStorageKey();
    let saved = storage.getItem(key);

    if (saved) {
      const parsed = JSON.parse(saved);
      // 合并默认配置，确保新字段存在
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (error) {
    console.warn('[AIConfig] 读取配置失败', error);
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * 保存 AI 配置
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否保存成功
 */
function saveAIConfig(config) {
  const storage = getSafeStorage();
  if (!storage) {
    return false;
  }

  try {
    const key = getStorageKey();
    storage.setItem(key, JSON.stringify(config));
    return true;
  } catch (error) {
    console.warn('[AIConfig] 保存配置失败', error);
    return false;
  }
}

/**
 * 验证配置是否有效
 * @param {Object} config - 配置对象
 * @returns {Object} 验证结果 { valid: boolean, error: string|null }
 */
function validateAIConfig(config) {
  if (!config) {
    return { valid: false, error: '配置不能为空' };
  }

  if (!config.provider) {
    return { valid: false, error: '请选择 LLM 提供商' };
  }

  if (!AI_PROVIDERS[config.provider]) {
    return { valid: false, error: '未知的提供商' };
  }

  if (!config.apiKey || config.apiKey.trim().length < 10) {
    return { valid: false, error: '请输入有效的 API Key' };
  }

  if (config.provider === 'custom') {
    if (!config.customApiBase || !config.customApiBase.trim()) {
      return { valid: false, error: '请输入自定义 API 地址' };
    }
    if (!config.customModel || !config.customModel.trim()) {
      return { valid: false, error: '请输入自定义模型名称' };
    }
  } else {
    if (!config.model) {
      return { valid: false, error: '请选择模型' };
    }
  }

  return { valid: true, error: null };
}

/**
 * 获取当前生效的 API 基础地址
 * @param {Object} config - 配置对象
 * @returns {string} API 基础地址
 */
function getApiBase(config) {
  if (config.provider === 'custom') {
    return config.customApiBase?.trim() || '';
  }
  return AI_PROVIDERS[config.provider]?.apiBase || '';
}

/**
 * 获取当前生效的模型 ID
 * @param {Object} config - 配置对象
 * @returns {string} 模型 ID
 */
function getModelId(config) {
  if (config.provider === 'custom') {
    return config.customModel?.trim() || '';
  }
  return config.model || AI_PROVIDERS[config.provider]?.defaultModel || '';
}

/**
 * 获取提供商的模型列表
 * @param {string} provider - 提供商 ID
 * @returns {Array} 模型列表
 */
function getProviderModels(provider) {
  return AI_PROVIDERS[provider]?.models || [];
}

/**
 * 获取提供商的默认模型
 * @param {string} provider - 提供商 ID
 * @returns {string} 默认模型 ID
 */
function getProviderDefaultModel(provider) {
  return AI_PROVIDERS[provider]?.defaultModel || '';
}

/**
 * 检查配置是否已设置（有 API Key）
 * @returns {boolean}
 */
function isAIConfigReady() {
  const config = getAIConfig();
  return !!config.apiKey && config.apiKey.trim().length >= 10;
}

/**
 * 清除 AI 配置
 */
function clearAIConfig() {
  const storage = getSafeStorage();
  if (storage) {
    try {
      const key = getStorageKey();
      storage.removeItem(key);
    } catch (error) {
      console.warn('[AIConfig] 清除配置失败', error);
    }
  }
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
  validateAIConfig
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
  clearAIConfig
};
