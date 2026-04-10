#!/usr/bin/env node

/**
 * 铁腕任务管理工具 - CloudBase 配置脚本
 * 使用方式: node cloudbase-setup.js
 * 前提: 已安装 @cloudbase/cli (npm install -g @cloudbase/cli)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置信息
const CONFIG = {
  envId: 'ironhand-8gclol9h5c79d816',
  collectionName: 'tasks',
  region: 'ap-guangzhou' // 广州节点
};

// 安全规则配置
const SECURITY_RULES = {
  collections: {
    [CONFIG.collectionName]: {
      read: 'doc._openid == auth.openid',
      write: 'doc._openid == auth.openid'
    }
  }
};

// 数据库索引配置
const INDEXES = [
  { field: '_openid', type: 'asc' },
  { field: 'createTime', type: 'desc' },
  { field: 'completed', type: 'asc' }
];

console.log('🚀 铁腕任务管理工具 - CloudBase 配置脚本\n');
console.log(`环境 ID: ${CONFIG.envId}\n`);

// 检查 CloudBase CLI 是否安装
function checkCLI() {
  try {
    execSync('tcb --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// 登录 CloudBase
function login() {
  console.log('📱 步骤 1: 登录 CloudBase');
  console.log('如果浏览器没有自动打开，请手动访问 https://console.cloud.tencent.com/tcb\n');
  try {
    execSync('tcb login', { stdio: 'inherit' });
    console.log('✅ 登录成功\n');
    return true;
  } catch (error) {
    console.error('❌ 登录失败:', error.message);
    return false;
  }
}

// 创建数据库集合
function createCollection() {
  console.log(`📦 步骤 2: 创建数据库集合 "${CONFIG.collectionName}"`);
  try {
    // 创建集合
    execSync(`tcb db:create ${CONFIG.collectionName} --envId ${CONFIG.envId}`, {
      stdio: 'inherit'
    });
    console.log(`✅ 集合 "${CONFIG.collectionName}" 创建成功\n`);
    return true;
  } catch (error) {
    // 集合已存在的情况
    if (error.message.includes('already exists')) {
      console.log(`ℹ️ 集合 "${CONFIG.collectionName}" 已存在\n`);
      return true;
    }
    console.error('❌ 创建集合失败:', error.message);
    return false;
  }
}

// 配置安全规则
function configureSecurityRules() {
  console.log('🔒 步骤 3: 配置数据库安全规则');
  
  const rulesFile = path.join(__dirname, 'security-rules.json');
  fs.writeFileSync(rulesFile, JSON.stringify(SECURITY_RULES, null, 2));
  
  try {
    execSync(`tcb db:rules:update ${rulesFile} --envId ${CONFIG.envId}`, {
      stdio: 'inherit'
    });
    console.log('✅ 安全规则配置成功\n');
    
    // 清理临时文件
    fs.unlinkSync(rulesFile);
    return true;
  } catch (error) {
    console.error('❌ 配置安全规则失败:', error.message);
    console.log('请手动在控制台配置安全规则:\n', JSON.stringify(SECURITY_RULES, null, 2));
    return false;
  }
}

// 开启静态网站托管
function enableHosting() {
  console.log('🌐 步骤 4: 开启静态网站托管');
  try {
    execSync(`tcb hosting --envId ${CONFIG.envId}`, { stdio: 'inherit' });
    console.log('✅ 静态网站托管已开启\n');
    return true;
  } catch (error) {
    console.error('❌ 开启静态托管失败:', error.message);
    return false;
  }
}

// 获取静态托管信息
function getHostingInfo() {
  console.log('📋 步骤 5: 获取静态托管信息');
  try {
    const result = execSync(`tcb hosting:detail --envId ${CONFIG.envId}`, {
      encoding: 'utf-8'
    });
    console.log(result);
    console.log('✅ 静态托管信息获取成功\n');
    return true;
  } catch (error) {
    console.error('❌ 获取静态托管信息失败:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('='.repeat(50));
  console.log('开始配置 CloudBase 环境\n');
  
  // 检查 CLI
  if (!checkCLI()) {
    console.error('❌ 未检测到 CloudBase CLI');
    console.log('请先安装: npm install -g @cloudbase/cli\n');
    process.exit(1);
  }
  
  console.log('✅ CloudBase CLI 已安装\n');
  
  // 执行配置步骤
  const steps = [
    { name: '登录', fn: login },
    { name: '创建集合', fn: createCollection },
    { name: '配置安全规则', fn: configureSecurityRules },
    { name: '开启静态托管', fn: enableHosting },
    { name: '获取托管信息', fn: getHostingInfo }
  ];
  
  for (const step of steps) {
    const success = await step.fn();
    if (!success && step.name !== '获取托管信息') {
      console.error(`\n❌ 配置在 "${step.name}" 步骤失败`);
      console.log('请检查错误信息后重试，或手动在控制台完成配置\n');
      process.exit(1);
    }
  }
  
  console.log('='.repeat(50));
  console.log('🎉 CloudBase 配置完成！\n');
  console.log('下一步:');
  console.log('1. 运行 npm run deploy 部署前端代码');
  console.log('2. 访问静态托管域名查看网站\n');
}

// 运行主函数
main().catch(error => {
  console.error('配置过程出错:', error);
  process.exit(1);
});
