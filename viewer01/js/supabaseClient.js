import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// 部署时由构建脚本从环境变量注入，本地开发从 .env.local 加载
const supabaseUrl = '__SUPABASE_URL__';
const supabaseKey = '__SUPABASE_ANON_KEY__';

// 运行时占位符检测：如果构建脚本未替换占位符，提示开发者先执行构建
if (supabaseUrl === '__SUPABASE_URL__' || supabaseKey === '__SUPABASE_ANON_KEY__') {
  console.error(
    '[Supabase] 检测到占位符未被替换（supabaseUrl 或 supabaseKey 仍为默认值）。\n' +
    '请先运行 npm run build 构建项目，使构建脚本注入正确的环境变量后再使用。\n' +
    '当前 supabaseUrl: "' + supabaseUrl + '"，supabaseKey: "' + supabaseKey.substring(0, 8) + '..."'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
export { supabaseUrl };
