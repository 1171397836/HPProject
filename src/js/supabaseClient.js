import { createClient } from '@supabase/supabase-js';

// 兼容 Vite 和 Node.js 环境
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

// 检查是否配置了环境变量
if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Supabase] 检测到占位符未被替换（supabaseUrl 或 supabaseKey 仍为默认值）。\n' +
    '请先运行 npm run build 构建项目，使构建脚本注入正确的环境变量后再使用。\n' +
    '当前 supabaseUrl: "' + supabaseUrl + '"，supabaseKey: "' + (supabaseKey ? supabaseKey.substring(0, 8) + '...' : '未定义') + '"'
  );
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');
export { supabaseUrl };
