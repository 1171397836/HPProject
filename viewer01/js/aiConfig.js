import { supabase } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';

/**
 * AI 配置管理模块
 * 管理 LLM 提供商、API Key、模型选择等配置
 * 配置迁移到 Supabase 的 user_configs 表中，使用内存缓存以兼容同步读取
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
  customModel: ''
};

// 内存中缓存配置，支持同步读取
let cachedConfig = { ...DEFAULT_CONFIG };
let isInitialized = false;

/**
 * 初始化 AI 配置，从 Supabase 获取
 */
async function initAIConfig() {
  const user = getCurrentUser();
  if (!user || !user.uid) return;

  try {
    const { data, error } = await supabase
      .from('user_configs')
      .select('config')
      .eq('uid', user.uid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('[AIConfig] 获取云端配置失败', error);
    }

    if (data && data.config) {
      cachedConfig = { ...DEFAULT_CONFIG, ...data.config };
    }
  } catch (error) {
    console.warn('[AIConfig] 初始化配置失败', error);
  } finally {
    isInitialized = true;
  }
}

/**
 * 读取 AI 配置 (同步，返回缓存)
 * @returns {Object} AI 配置对象
 */
function getAIConfig() {
  return { ...cachedConfig };
}

/**
 * 保存 AI 配置到缓存和 Supabase
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否启动保存
 */
function saveAIConfig(config) {
  const newConfig = { ...DEFAULT_CONFIG, ...config };
  cachedConfig = newConfig;

  const user = getCurrentUser();
  if (user && user.uid) {
    const now = new Date().toISOString();
    supabase
      .from('user_configs')
      .upsert({
        uid: user.uid,
        config: newConfig,
        updated_at: now
      }, { onConflict: 'uid' })
      .then(({ error }) => {
        if (error) {
          console.error('[AIConfig] 保存云端配置失败', error);
        }
      });
    return true;
  }
  return false;
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

function clearAIConfig() {
  cachedConfig = { ...DEFAULT_CONFIG };
  const user = getCurrentUser();
  if (user && user.uid) {
    supabase
      .from('user_configs')
      .delete()
      .eq('uid', user.uid)
      .then();
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