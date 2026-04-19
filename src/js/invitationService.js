import { supabase } from './supabaseClient.js';

/**
 * 邀请码服务模块
 * 提供邀请码的验证、使用、生成和查询功能
 */

/**
 * 生成6位随机邀请码（字母数字组合）
 * @returns {string} 6位邀请码
 */
function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 验证邀请码格式
 * @param {string} code - 邀请码
 * @returns {boolean} 格式是否有效
 */
function isValidCodeFormat(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }
  // 6位字母数字组合
  const codeRegex = /^[A-Za-z0-9]{6}$/;
  return codeRegex.test(code.trim());
}

/**
 * 验证邀请码是否有效且还有剩余次数
 * @param {string} code - 邀请码
 * @returns {Promise<{valid: boolean, error?: string, data?: object}>}
 */
async function validateCode(code) {
  try {
    // 格式校验
    if (!isValidCodeFormat(code)) {
      return {
        valid: false,
        error: '邀请码格式不正确，请输入6位字母数字组合'
      };
    }

    const trimmedCode = code.trim().toUpperCase();

    // 查询邀请码
    const { data, error } = await supabase
      .from('invitation_codes')
      .select('*')
      .eq('code', trimmedCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 未找到记录
        return {
          valid: false,
          error: '邀请码无效'
        };
      }
      console.error('[InvitationService] 验证邀请码失败:', error);
      return {
        valid: false,
        error: '验证邀请码时发生错误，请稍后重试'
      };
    }

    if (!data) {
      return {
        valid: false,
        error: '邀请码无效'
      };
    }

    // 检查是否还有剩余次数
    if (data.used_count >= data.max_uses) {
      return {
        valid: false,
        error: '邀请码已被用完'
      };
    }

    return {
      valid: true,
      data: data
    };
  } catch (err) {
    console.error('[InvitationService] 验证邀请码异常:', err);
    return {
      valid: false,
      error: '验证邀请码时发生错误，请稍后重试'
    };
  }
}

/**
 * 使用邀请码（增加使用次数）
 * @param {string} code - 邀请码
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function useCode(code) {
  try {
    if (!isValidCodeFormat(code)) {
      return {
        success: false,
        error: '邀请码格式不正确'
      };
    }

    const trimmedCode = code.trim().toUpperCase();

    // 先验证邀请码是否有效
    const validation = await validateCode(trimmedCode);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // 更新使用次数
    const { error } = await supabase
      .from('invitation_codes')
      .update({
        used_count: validation.data.used_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('code', trimmedCode);

    if (error) {
      console.error('[InvitationService] 更新邀请码使用次数失败:', error);
      return {
        success: false,
        error: '使用邀请码失败，请稍后重试'
      };
    }

    return {
      success: true
    };
  } catch (err) {
    console.error('[InvitationService] 使用邀请码异常:', err);
    return {
      success: false,
      error: '使用邀请码时发生错误，请稍后重试'
    };
  }
}

/**
 * 生成新邀请码
 * @param {number} maxUses - 最大使用次数，默认为1
 * @returns {Promise<{success: boolean, code?: string, error?: string}>}
 */
async function generateCode(maxUses = 1) {
  try {
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: '请先登录'
      };
    }

    // 生成唯一邀请码
    let code = generateRandomCode();
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const { data } = await supabase
        .from('invitation_codes')
        .select('code')
        .eq('code', code)
        .single();

      if (!data) {
        isUnique = true;
      } else {
        code = generateRandomCode();
        attempts++;
      }
    }

    if (!isUnique) {
      return {
        success: false,
        error: '生成邀请码失败，请稍后重试'
      };
    }

    // 插入新邀请码
    const { error } = await supabase
      .from('invitation_codes')
      .insert({
        code: code,
        max_uses: Math.max(1, parseInt(maxUses) || 1),
        used_count: 0,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('[InvitationService] 创建邀请码失败:', error);
      return {
        success: false,
        error: '创建邀请码失败，请稍后重试'
      };
    }

    return {
      success: true,
      code: code
    };
  } catch (err) {
    console.error('[InvitationService] 生成邀请码异常:', err);
    return {
      success: false,
      error: '生成邀请码时发生错误，请稍后重试'
    };
  }
}

/**
 * 获取所有邀请码列表（管理后台用）
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
async function getAllCodes() {
  try {
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: '请先登录'
      };
    }

    const { data, error } = await supabase
      .from('invitation_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[InvitationService] 获取邀请码列表失败:', error);
      return {
        success: false,
        error: '获取邀请码列表失败，请稍后重试'
      };
    }

    // 计算剩余次数
    const codesWithRemaining = data.map(item => ({
      ...item,
      remaining: item.max_uses - item.used_count
    }));

    return {
      success: true,
      data: codesWithRemaining
    };
  } catch (err) {
    console.error('[InvitationService] 获取邀请码列表异常:', err);
    return {
      success: false,
      error: '获取邀请码列表时发生错误，请稍后重试'
    };
  }
}

/**
 * 检查当前用户是否为管理员
 * @returns {Promise<{isAdmin: boolean, error?: string}>}
 */
async function checkIsAdmin() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { isAdmin: false };
    }

    const { data, error } = await supabase
      .from('user_configs')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return { isAdmin: false };
    }

    return { isAdmin: !!data.is_admin };
  } catch (err) {
    console.error('[InvitationService] 检查管理员权限异常:', err);
    return { isAdmin: false };
  }
}

export {
  checkIsAdmin,
  generateCode,
  generateRandomCode,
  getAllCodes,
  isValidCodeFormat,
  useCode,
  validateCode
};

export default {
  validateCode,
  useCode,
  generateCode,
  getAllCodes,
  checkIsAdmin,
  isValidCodeFormat,
  generateRandomCode
};
