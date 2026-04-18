/**
 * 构建脚本：将环境变量注入到前端代码中
 * 
 * 工作原理：
 * 1. 将 viewer01 复制到 viewer01-dist（构建输出目录）
 * 2. 在副本中替换占位符为真实值
 * 3. 源文件保持占位符不变，不会泄露密钥
 * 
 * Vercel 部署时自动执行 `npm run build`
 * 本地开发时执行 `npm run dev` 会先构建再启动服务器
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'viewer01');
const DIST_DIR = path.join(ROOT_DIR, 'viewer01-dist');
const TARGET_FILE_REL = 'js/supabaseClient.js';

// 从环境变量或 .env.local 读取
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env.local');
  const env = {};
  const envLocalExists = fs.existsSync(envPath);

  // 先加载 .env.local
  if (envLocalExists) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      // 去除首尾空白
      const trimmed = line.trim();
      // 跳过空行和注释行
      if (!trimmed || trimmed.startsWith('#')) return;

      const match = trimmed.match(/^([A-Z_]+)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        // 去除行内注释（引号内的 # 不算注释）
        if (value.startsWith('"')) {
          const endQuote = value.indexOf('"', 1);
          if (endQuote !== -1) {
            value = value.substring(1, endQuote);
          }
        } else if (value.startsWith("'")) {
          const endQuote = value.indexOf("'", 1);
          if (endQuote !== -1) {
            value = value.substring(1, endQuote);
          }
        } else {
          // 无引号：去除 # 及其后的行内注释
          const commentIdx = value.indexOf(' #');
          if (commentIdx !== -1) {
            value = value.substring(0, commentIdx).trimEnd();
          }
        }
        env[match[1]] = value;
      }
    });
  }

  // 环境变量优先级更高（Vercel 注入的）
  if (process.env.SUPABASE_URL) env.SUPABASE_URL = process.env.SUPABASE_URL;
  if (process.env.SUPABASE_ANON_KEY) env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  return { env, envLocalExists };
}

// 递归复制目录
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function build() {
  const { env, envLocalExists } = loadEnv();

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    console.error('❌ 缺少环境变量: SUPABASE_URL 和 SUPABASE_ANON_KEY');
    if (!envLocalExists) {
      console.error('');
      console.error('   未找到 .env.local 文件，请按以下步骤操作：');
      console.error('   1. 在项目根目录创建 .env.local 文件');
      console.error('   2. 添加以下环境变量：');
      console.error('      SUPABASE_URL=你的Supabase项目URL');
      console.error('      SUPABASE_ANON_KEY=你的Supabase匿名Key');
      const examplePath = path.join(ROOT_DIR, '.env.local.example');
      if (fs.existsSync(examplePath)) {
        console.error('   3. 可参考 .env.local.example 文件格式');
      }
    } else {
      console.error('   请检查 .env.local 文件中是否已正确配置上述变量');
      console.error('   或在 Vercel Dashboard 中设置环境变量');
    }
    process.exit(1);
  }

  // 复制 viewer01 → viewer01-dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  copyDir(SRC_DIR, DIST_DIR);

  // 在副本中替换占位符
  const targetFile = path.join(DIST_DIR, TARGET_FILE_REL);
  let content = fs.readFileSync(targetFile, 'utf-8');

  content = content.replaceAll('__SUPABASE_URL__', env.SUPABASE_URL);
  content = content.replaceAll('__SUPABASE_ANON_KEY__', env.SUPABASE_ANON_KEY);

  // 检查是否还有未替换的占位符
  if (content.includes('__SUPABASE_URL__') || content.includes('__SUPABASE_ANON_KEY__')) {
    console.error('❌ 占位符替换失败');
    process.exit(1);
  }

  fs.writeFileSync(targetFile, content, 'utf-8');
  console.log('✅ Supabase 环境变量注入成功');
  console.log(`   输出目录: ${DIST_DIR}`);
}

build();
