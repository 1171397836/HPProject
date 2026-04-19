import { checkAuthStatus, handleLogout, navigateTo, updateUserDisplay } from './auth.js';
import { checkIsAdmin, generateCode, getAllCodes } from './invitationService.js';

/**
 * 管理后台逻辑
 */

// DOM 元素
let elements = {};

/**
 * 初始化页面
 */
async function initAdminPage() {
  // 检查登录状态
  const user = await checkAuthStatus();
  if (!user) {
    navigateTo('login.html');
    return;
  }

  // 检查管理员权限
  const { isAdmin } = await checkIsAdmin();
  if (!isAdmin) {
    alert('您没有管理员权限');
    navigateTo('app.html');
    return;
  }

  // 初始化 DOM 元素引用
  initElements();

  // 更新用户信息显示
  updateUserDisplay('adminUserName', 'adminUserAvatar');

  // 绑定事件
  bindEvents();

  // 加载邀请码列表
  await loadInvitationCodes();
}

/**
 * 初始化 DOM 元素引用
 */
function initElements() {
  elements = {
    // 用户信息
    adminUserName: document.getElementById('adminUserName'),
    adminUserAvatar: document.getElementById('adminUserAvatar'),

    // 返回按钮
    backBtn: document.getElementById('backBtn'),

    // 退出登录
    logoutBtn: document.getElementById('logoutBtn'),

    // 生成邀请码表单
    generateForm: document.getElementById('generateForm'),
    maxUsesInput: document.getElementById('maxUsesInput'),
    generateBtn: document.getElementById('generateBtn'),

    // 生成的邀请码展示
    generatedCode: document.getElementById('generatedCode'),
    generatedCodeValue: document.getElementById('generatedCodeValue'),

    // 错误提示
    errorAlert: document.getElementById('errorAlert'),

    // 邀请码列表
    codeListContainer: document.getElementById('codeListContainer'),
    loadingState: document.getElementById('loadingState'),
    emptyState: document.getElementById('emptyState'),
    codeTable: document.getElementById('codeTable'),
    codeTableBody: document.getElementById('codeTableBody')
  };
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 返回应用
  elements.backBtn.addEventListener('click', () => navigateTo('app.html'));

  // 退出登录
  elements.logoutBtn.addEventListener('click', handleLogout);

  // 生成邀请码表单提交
  elements.generateForm.addEventListener('submit', handleGenerateCode);
}

/**
 * 显示错误提示
 * @param {string} message - 错误消息
 */
function showError(message) {
  elements.errorAlert.textContent = message;
  elements.errorAlert.classList.add('show');
  setTimeout(() => {
    elements.errorAlert.classList.remove('show');
  }, 5000);
}

/**
 * 隐藏错误提示
 */
function hideError() {
  elements.errorAlert.classList.remove('show');
}

/**
 * 处理生成邀请码
 * @param {Event} event - 表单提交事件
 */
async function handleGenerateCode(event) {
  event.preventDefault();
  hideError();

  const maxUses = parseInt(elements.maxUsesInput.value) || 1;

  // 验证输入
  if (maxUses < 1 || maxUses > 100) {
    showError('最大使用次数必须在 1-100 之间');
    return;
  }

  // 禁用按钮
  elements.generateBtn.disabled = true;
  const originalText = elements.generateBtn.innerHTML;
  elements.generateBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
    生成中...
  `;

  try {
    const result = await generateCode(maxUses);

    if (result.success) {
      // 显示生成的邀请码
      elements.generatedCodeValue.textContent = result.code;
      elements.generatedCode.classList.add('show');

      // 刷新列表
      await loadInvitationCodes();

      // 重置表单
      elements.maxUsesInput.value = '1';
    } else {
      showError(result.error || '生成邀请码失败');
    }
  } catch (err) {
    console.error('[Admin] 生成邀请码异常:', err);
    showError('生成邀请码时发生错误，请稍后重试');
  } finally {
    // 恢复按钮
    elements.generateBtn.disabled = false;
    elements.generateBtn.innerHTML = originalText;
  }
}

/**
 * 加载邀请码列表
 */
async function loadInvitationCodes() {
  // 显示加载状态
  elements.loadingState.style.display = 'block';
  elements.emptyState.style.display = 'none';
  elements.codeTable.style.display = 'none';

  try {
    const result = await getAllCodes();

    if (!result.success) {
      showError(result.error || '获取邀请码列表失败');
      elements.loadingState.style.display = 'none';
      return;
    }

    const codes = result.data || [];

    // 隐藏加载状态
    elements.loadingState.style.display = 'none';

    if (codes.length === 0) {
      // 显示空状态
      elements.emptyState.style.display = 'block';
      elements.codeTable.style.display = 'none';
    } else {
      // 渲染表格
      renderCodeTable(codes);
      elements.emptyState.style.display = 'none';
      elements.codeTable.style.display = 'table';
    }
  } catch (err) {
    console.error('[Admin] 加载邀请码列表异常:', err);
    showError('加载邀请码列表时发生错误，请稍后重试');
    elements.loadingState.style.display = 'none';
  }
}

/**
 * 渲染邀请码表格
 * @param {Array} codes - 邀请码列表
 */
function renderCodeTable(codes) {
  elements.codeTableBody.innerHTML = codes.map(code => {
    const isActive = code.used_count < code.max_uses;
    const usagePercent = (code.used_count / code.max_uses) * 100;
    const remaining = code.max_uses - code.used_count;

    // 格式化日期
    const createdDate = new Date(code.created_at);
    const formattedDate = createdDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    return `
      <tr>
        <td>
          <span class="code-value">${code.code}</span>
        </td>
        <td>
          <span class="code-status ${isActive ? 'active' : 'used'}">
            <span class="code-status-dot"></span>
            ${isActive ? '可用' : '已用完'}
          </span>
        </td>
        <td>
          <div class="usage-bar">
            <div class="usage-bar-fill" style="width: ${usagePercent}%"></div>
          </div>
          <div class="usage-text">${code.used_count} / ${code.max_uses}</div>
        </td>
        <td>${remaining}</td>
        <td class="code-date">${formattedDate}</td>
      </tr>
    `;
  }).join('');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initAdminPage);
