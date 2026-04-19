import {
  checkAuthStatusSync,
  handleLogin,
  handleRegister,
  navigateTo,
  validatePassword,
  validatePasswordMatch,
  validateUsername
} from './auth.js';
import { validateCode, useCode } from './invitationService.js';

function getElements() {
  return {
    loginPanel: document.getElementById('loginPanel'),
    registerPanel: document.getElementById('registerPanel'),
    showRegisterBtn: document.getElementById('showRegister'),
    showLoginBtn: document.getElementById('showLogin'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    registerEmail: document.getElementById('registerEmail'),
    registerPassword: document.getElementById('registerPassword'),
    registerConfirmPassword: document.getElementById('registerConfirmPassword'),
    registerInvitationCode: document.getElementById('registerInvitationCode'),
    toggleLoginPassword: document.getElementById('toggleLoginPassword'),
    toggleRegisterPassword: document.getElementById('toggleRegisterPassword'),
    toggleConfirmPassword: document.getElementById('toggleConfirmPassword'),
    loginBtn: document.getElementById('loginBtn'),
    registerBtn: document.getElementById('registerBtn'),
  };
}

function showFieldError(input, errorId, message) {
  input.classList.add('error');
  const errorElement = document.getElementById(errorId);
  if (errorElement) {
    errorElement.classList.add('show');
    errorElement.lastChild.textContent = ` ${message}`;
  }
}

function hideFieldError(input, errorId) {
  input.classList.remove('error');
  document.getElementById(errorId)?.classList.remove('show');
}

function clearFormErrors(form) {
  form.querySelectorAll('.form-input').forEach(input => {
    input.classList.remove('error');
  });

  form.querySelectorAll('.error-message').forEach(errorElement => {
    errorElement.classList.remove('show');
  });
}

function togglePasswordVisibility(input, button) {
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
}

function switchToRegister(elements) {
  clearFormErrors(elements.loginForm);
  elements.loginForm.reset();
  elements.loginPanel.classList.add('hidden');
  elements.registerPanel.classList.remove('hidden');
}

function switchToLogin(elements) {
  clearFormErrors(elements.registerForm);
  elements.registerForm.reset();
  elements.registerPanel.classList.add('hidden');
  elements.loginPanel.classList.remove('hidden');
}

function bindRealtimeValidation(elements) {
  elements.loginEmail.addEventListener('input', () => {
    if (validateUsername(elements.loginEmail.value).valid) {
      hideFieldError(elements.loginEmail, 'loginEmailError');
    }
  });

  elements.loginPassword.addEventListener('input', () => {
    if (validatePassword(elements.loginPassword.value).valid) {
      hideFieldError(elements.loginPassword, 'loginPasswordError');
    }
  });

  elements.registerEmail.addEventListener('input', () => {
    if (validateUsername(elements.registerEmail.value).valid) {
      hideFieldError(elements.registerEmail, 'registerEmailError');
    }
  });

  elements.registerPassword.addEventListener('input', () => {
    if (validatePassword(elements.registerPassword.value).valid) {
      hideFieldError(elements.registerPassword, 'registerPasswordError');
    }

    if (validatePasswordMatch(elements.registerPassword.value, elements.registerConfirmPassword.value).valid) {
      hideFieldError(elements.registerConfirmPassword, 'registerConfirmError');
    }
  });

  elements.registerConfirmPassword.addEventListener('input', () => {
    if (validatePasswordMatch(elements.registerPassword.value, elements.registerConfirmPassword.value).valid) {
      hideFieldError(elements.registerConfirmPassword, 'registerConfirmError');
    }
  });

  // 邀请码实时验证
  elements.registerInvitationCode.addEventListener('input', () => {
    hideFieldError(elements.registerInvitationCode, 'registerInvitationError');
  });
}

async function submitLogin(elements) {
  hideFieldError(elements.loginEmail, 'loginEmailError');
  hideFieldError(elements.loginPassword, 'loginPasswordError');

  const usernameResult = validateUsername(elements.loginEmail.value);
  const passwordResult = validatePassword(elements.loginPassword.value);

  if (!usernameResult.valid) {
    showFieldError(elements.loginEmail, 'loginEmailError', usernameResult.error.message);
  }

  if (!passwordResult.valid) {
    showFieldError(elements.loginPassword, 'loginPasswordError', passwordResult.error.message);
  }

  if (!usernameResult.valid || !passwordResult.valid) {
    return;
  }

  elements.loginBtn.disabled = true;
  elements.loginBtn.textContent = '登录中...';

  try {
    const result = await handleLogin(
      elements.loginEmail.value.trim(),
      elements.loginPassword.value
    );

    if (!result.success) {
      showFieldError(elements.loginPassword, 'loginPasswordError', result.error.message);
    }
  } finally {
    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = '登 录';
  }
}

async function submitRegister(elements) {
  hideFieldError(elements.registerEmail, 'registerEmailError');
  hideFieldError(elements.registerPassword, 'registerPasswordError');
  hideFieldError(elements.registerConfirmPassword, 'registerConfirmError');
  hideFieldError(elements.registerInvitationCode, 'registerInvitationError');

  const usernameResult = validateUsername(elements.registerEmail.value);
  const passwordResult = validatePassword(elements.registerPassword.value);
  const confirmResult = validatePasswordMatch(
    elements.registerPassword.value,
    elements.registerConfirmPassword.value
  );

  if (!usernameResult.valid) {
    showFieldError(elements.registerEmail, 'registerEmailError', usernameResult.error.message);
  }

  if (!passwordResult.valid) {
    showFieldError(elements.registerPassword, 'registerPasswordError', passwordResult.error.message);
  }

  if (!confirmResult.valid) {
    showFieldError(elements.registerConfirmPassword, 'registerConfirmError', confirmResult.error.message);
  }

  // 验证邀请码
  const invitationCode = elements.registerInvitationCode.value.trim();
  if (!invitationCode) {
    showFieldError(elements.registerInvitationCode, 'registerInvitationError', '请输入邀请码');
    return;
  }

  const codeValidation = await validateCode(invitationCode);
  if (!codeValidation.valid) {
    showFieldError(elements.registerInvitationCode, 'registerInvitationError', codeValidation.error);
    return;
  }

  if (!usernameResult.valid || !passwordResult.valid || !confirmResult.valid) {
    return;
  }

  elements.registerBtn.disabled = true;
  elements.registerBtn.textContent = '注册中...';

  try {
    const result = await handleRegister(
      elements.registerEmail.value.trim(),
      elements.registerPassword.value,
      elements.registerConfirmPassword.value,
      { skipRedirect: true }  // 先不跳转，等待使用邀请码完成
    );

    if (!result.success) {
      showFieldError(elements.registerEmail, 'registerEmailError', result.error.message);
    } else {
      // 注册成功，使用邀请码
      const useResult = await useCode(invitationCode);
      if (!useResult.success) {
        console.error('[Login] 使用邀请码失败:', useResult.error);
        // 不影响注册流程，仅记录错误
      }
      // 使用邀请码完成后，手动跳转到应用页面
      navigateTo('app.html');
    }
  } finally {
    elements.registerBtn.disabled = false;
    elements.registerBtn.textContent = '注 册';
  }
}

function bindEvents(elements) {
  elements.showRegisterBtn.addEventListener('click', () => switchToRegister(elements));
  elements.showLoginBtn.addEventListener('click', () => switchToLogin(elements));

  elements.toggleLoginPassword.addEventListener('click', () => {
    togglePasswordVisibility(elements.loginPassword, elements.toggleLoginPassword);
  });

  elements.toggleRegisterPassword.addEventListener('click', () => {
    togglePasswordVisibility(elements.registerPassword, elements.toggleRegisterPassword);
  });

  elements.toggleConfirmPassword.addEventListener('click', () => {
    togglePasswordVisibility(elements.registerConfirmPassword, elements.toggleConfirmPassword);
  });

  elements.loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    await submitLogin(elements);
  });

  elements.registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    await submitRegister(elements);
  });

  bindRealtimeValidation(elements);
}

function initLoginPage() {
  const currentUser = checkAuthStatusSync();
  if (currentUser) {
    navigateTo('app.html');
    return;
  }

  const elements = getElements();
  bindEvents(elements);
}

document.addEventListener('DOMContentLoaded', initLoginPage);
