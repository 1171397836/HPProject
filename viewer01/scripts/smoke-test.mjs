function createMemoryStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.tokens = new Set();
  }

  setFromString(value = '') {
    this.tokens = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  add(...tokens) {
    tokens.filter(Boolean).forEach(token => this.tokens.add(token));
  }

  remove(...tokens) {
    tokens.forEach(token => this.tokens.delete(token));
  }

  toggle(token, force) {
    if (force === true) {
      this.tokens.add(token);
      return true;
    }

    if (force === false) {
      this.tokens.delete(token);
      return false;
    }

    if (this.tokens.has(token)) {
      this.tokens.delete(token);
      return false;
    }

    this.tokens.add(token);
    return true;
  }

  contains(token) {
    return this.tokens.has(token);
  }

  toString() {
    return Array.from(this.tokens).join(' ');
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
    this.textContent = '';
  }

  get className() {
    return this.classList.toString();
  }

  set className(value) {
    this.classList.setFromString(value);
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) {
      return;
    }

    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) {
      this.parentNode.children.splice(index, 1);
    }

    this.parentNode = null;
  }

  setAttribute(name, value) {
    const normalizedValue = String(value);
    this.attributes.set(name, normalizedValue);

    if (name === 'class') {
      this.className = normalizedValue;
      return;
    }

    if (name.startsWith('data-')) {
      const datasetKey = name
        .slice(5)
        .replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      this.dataset[datasetKey] = normalizedValue;
    }
  }

  removeAttribute(name) {
    this.attributes.delete(name);

    if (name === 'class') {
      this.className = '';
      return;
    }

    if (name.startsWith('data-')) {
      const datasetKey = name
        .slice(5)
        .replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      delete this.dataset[datasetKey];
    }
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    this.listeners.set(type, handlers.filter(item => item !== handler));
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  querySelector(selector) {
    const matcher = createFakeSelectorMatcher(selector);
    const queue = [...this.children];

    while (queue.length > 0) {
      const current = queue.shift();
      if (matcher(current)) {
        return current;
      }

      queue.unshift(...current.children);
    }

    return null;
  }

  set innerHTML(value) {
    this.children = [];
    this.textContent = '';

    const markup = String(value || '').trim();
    if (!markup) {
      return;
    }

    if (markup.includes('task-dialog-mask') && markup.includes('task-dialog-panel')) {
      buildFakeDialogShell(this, markup);
      return;
    }

    throw new Error(`FakeElement 暂不支持解析该 innerHTML: ${markup.slice(0, 80)}`);
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body', this);
    this.activeElement = this.body;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

function createFakeSelectorMatcher(selector) {
  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    return element => element.classList.contains(className);
  }

  const dataRoleMatch = selector.match(/^\[data-role="([^"]+)"\]$/);
  if (dataRoleMatch) {
    const [, role] = dataRoleMatch;
    return element => element.dataset.role === role;
  }

  return () => false;
}

function buildFakeDialogShell(root, markup) {
  const titleMatch = markup.match(/<h3 class="task-dialog-title" id="([^"]+)">([\s\S]*?)<\/h3>/);
  const panelClassMatch = markup.match(/<div class="([^"]*task-dialog-panel[^"]*)"/);

  const mask = root.ownerDocument.createElement('div');
  mask.className = 'task-dialog-mask';
  mask.setAttribute('data-role', 'mask');

  const panel = root.ownerDocument.createElement('div');
  panel.className = panelClassMatch?.[1] || 'task-dialog-panel';

  const header = root.ownerDocument.createElement('div');
  header.className = 'task-dialog-header';

  const title = root.ownerDocument.createElement('h3');
  title.className = 'task-dialog-title';
  if (titleMatch?.[1]) {
    title.setAttribute('id', titleMatch[1]);
  }
  title.textContent = titleMatch?.[2] || '';

  const closeButton = root.ownerDocument.createElement('button');
  closeButton.className = 'task-dialog-close';
  closeButton.setAttribute('data-role', 'cancel');

  const body = root.ownerDocument.createElement('div');
  body.className = 'task-dialog-body';
  body.setAttribute('data-role', 'body');

  header.appendChild(title);
  header.appendChild(closeButton);
  panel.appendChild(header);
  panel.appendChild(body);

  root.appendChild(mask);
  root.appendChild(panel);
}

globalThis.window = globalThis;
globalThis.localStorage = createMemoryStorage();
globalThis.location = {
  protocol: 'http:',
  hostname: 'localhost',
  pathname: '/viewer01/login.html',
  href: 'http://localhost:8080/viewer01/login.html'
};

const authModule = await import('../js/auth.js');
const cloudbaseModule = await import('../js/storage.js');
const appModule = await import('../js/app.js');

const {
  checkAuthStatusSync,
  handleLogin,
  handleLogout,
  handleRegister
} = authModule;

const { MAX_TASK_LENGTH, taskDB, validateTaskContent } = cloudbaseModule;
const {
  collectTaskEditInput,
  confirmBeforeClearCompleted,
  confirmBeforeDeleteTask,
  confirmBeforeLogout,
  groupTasksByQuadrant,
  runConfirmedAction
} = appModule;

localStorage.clear();

const registerResult = await handleRegister('smoke_user', '123456', '123456', { skipRedirect: true });
assert(registerResult.success, '注册失败');

const loginResult = await handleLogin('smoke_user', '123456', { skipRedirect: true });
assert(loginResult.success, '登录失败');
assert(checkAuthStatusSync()?.username === 'smoke_user', '登录态未写入本地存储');

const oversizedContent = '超'.repeat(MAX_TASK_LENGTH + 1);
const emptyValidation = validateTaskContent('   ');
const oversizedValidation = validateTaskContent(oversizedContent);
assert(emptyValidation.valid === false, '空任务内容校验未拦截');
assert(emptyValidation.error?.message === '请输入任务内容', '空任务内容提示不正确');
assert(oversizedValidation.valid === false, '超长任务内容校验未拦截');
assert(oversizedValidation.error?.message === `任务内容不能超过${MAX_TASK_LENGTH}个字符`, '超长任务内容提示不正确');

const invalidAddResult = await taskDB.addTask(oversizedContent, 'q1');
assert(invalidAddResult.success === false, '新增超长任务未被拦截');

const task1 = await taskDB.addTask('修复登录页', 'q1');
const task2 = await taskDB.addTask('整理迭代计划', 'q2');
const task3 = await taskDB.addTask('通知测试回归', 'q3');

assert(task1.success && task2.success && task3.success, '新增任务失败');

const listAfterCreate = await taskDB.getTasks();
assert(listAfterCreate.success, '查询任务失败');
assert(listAfterCreate.data.length === 3, '新增后任务数量不正确');

const completeResult = await taskDB.updateTask(task1.data._id, true);
assert(completeResult.success, '更新完成状态失败');

const editResult = await taskDB.updateTaskContent(task2.data._id, {
  content: '整理下周迭代计划',
  quadrant: 'q4'
});
assert(editResult.success, '编辑任务失败');

let promptCallCount = 0;
const collectedEditInput = await collectTaskEditInput(
  { content: '原始任务', quadrant: 'q2' },
  {
    forcePrompt: true,
    promptFn(message, defaultValue) {
      promptCallCount += 1;

      if (promptCallCount === 1) {
        assert(message === '编辑任务内容', '编辑内容提示文案不正确');
        assert(defaultValue === '原始任务', '编辑内容默认值不正确');
        return '更新后的任务';
      }

      assert(message === '输入象限编号（q1/q2/q3/q4）', '编辑象限提示文案不正确');
      assert(defaultValue === 'q2', '编辑象限默认值不正确');
      return 'q3';
    }
  }
);
assert(collectedEditInput.cancelled === false, '编辑输入采集被错误取消');
assert(collectedEditInput.content === '更新后的任务', '编辑输入内容未正确返回');
assert(collectedEditInput.quadrant === 'q3', '编辑输入象限未正确返回');

const cancelledEditInput = await collectTaskEditInput(
  { content: '原始任务', quadrant: 'q2' },
  {
    forcePrompt: true,
    promptFn() {
      return null;
    }
  }
);
assert(cancelledEditInput.cancelled === true, '编辑输入取消状态不正确');

const invalidEditResult = await taskDB.updateTaskContent(task2.data._id, {
  content: oversizedContent
});
assert(invalidEditResult.success === false, '编辑超长任务未被拦截');

const listAfterUpdate = await taskDB.getTasks();
const grouped = groupTasksByQuadrant(listAfterUpdate.data);

assert(grouped.q1.some(task => task._id === task1.data._id && task.completed), 'Q1 完成任务未保留');
assert(grouped.q4.some(task => task._id === task2.data._id && task.content === '整理下周迭代计划'), '任务未移动到 Q4');

let sharedConfirmMessage = '';
let sharedActionTriggered = false;
const sharedCancelResult = await runConfirmedAction({
  message: '确认执行通用操作吗？',
  confirmFn(message) {
    sharedConfirmMessage = message;
    return false;
  },
  async actionFn() {
    sharedActionTriggered = true;
    return { success: true };
  }
});

assert(sharedConfirmMessage === '确认执行通用操作吗？', '通用确认文案不正确');
assert(sharedCancelResult.cancelled === true, '通用确认取消时未返回取消状态');
assert(sharedActionTriggered === false, '通用确认取消后仍触发了实际操作');

let clearConfirmMessage = '';
let clearTriggered = false;
const cancelClearResult = await confirmBeforeClearCompleted({
  completedCount: 1,
  confirmFn(message) {
    clearConfirmMessage = message;
    return false;
  },
  async clearFn() {
    clearTriggered = true;
    return { success: true, deletedCount: 1 };
  }
});

assert(clearConfirmMessage === '确定清空 1 个已完成任务吗？', '清空确认文案不正确');
assert(cancelClearResult.cancelled === true, '取消清空时未返回取消状态');
assert(clearTriggered === false, '取消清空后仍触发了清空逻辑');

const clearResult = await confirmBeforeClearCompleted({
  completedCount: 1,
  confirmFn() {
    return true;
  },
  async clearFn() {
    clearTriggered = true;
    return taskDB.clearCompleted();
  }
});
assert(clearResult.success && clearResult.deletedCount === 1, '确认清空已完成失败');

let deleteConfirmMessage = '';
let deleteTriggered = false;
const cancelDeleteResult = await confirmBeforeDeleteTask({
  taskId: task3.data._id,
  confirmFn(message) {
    deleteConfirmMessage = message;
    return false;
  },
  async deleteFn() {
    deleteTriggered = true;
    return { success: true };
  }
});

assert(deleteConfirmMessage === '确定删除这个任务吗？', '删除确认文案不正确');
assert(cancelDeleteResult.cancelled === true, '取消删除时未返回取消状态');
assert(deleteTriggered === false, '取消删除后仍触发了删除逻辑');

const deleteResult = await confirmBeforeDeleteTask({
  taskId: task3.data._id,
  confirmFn() {
    return true;
  },
  async deleteFn(taskId) {
    deleteTriggered = true;
    return taskDB.deleteTask(taskId);
  }
});
assert(deleteResult.success, '确认后删除任务失败');

const finalList = await taskDB.getTasks();
assert(finalList.data.length === 1, '最终任务数量不正确');
assert(finalList.data[0]._id === task2.data._id, '最终保留任务不正确');

let confirmMessage = '';
let logoutTriggered = false;
const cancelLogoutResult = await confirmBeforeLogout({
  confirmFn(message) {
    confirmMessage = message;
    return false;
  },
  async logoutFn() {
    logoutTriggered = true;
    return { success: true };
  }
});

assert(confirmMessage === '确定要退出登录吗？', '退出确认文案不正确');
assert(cancelLogoutResult.cancelled === true, '取消退出时未返回取消状态');
assert(logoutTriggered === false, '取消退出后仍触发了退出逻辑');

const confirmLogoutResult = await confirmBeforeLogout({
  confirmFn() {
    return true;
  },
  async logoutFn() {
    logoutTriggered = true;
    return { success: true, mocked: true };
  }
});

assert(confirmLogoutResult.success === true, '确认退出后未执行退出逻辑');
assert(logoutTriggered === true, '确认退出后未触发退出逻辑');

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalHTMLElement = globalThis.HTMLElement;

globalThis.window = {
  setTimeout(handler) {
    handler();
    return 0;
  }
};
globalThis.document = new FakeDocument();
globalThis.HTMLElement = FakeElement;

const {
  getDialogStackSize,
  openStackedDialog,
  resetDialogStackForTests
} = await import('../js/dialog.js');

let outerFocusTarget = null;
let nestedFocusTarget = null;
let closeOuterDialog = null;
let closeNestedDialog = null;

const outerDialogPromise = openStackedDialog({
  title: '第一层弹窗',
  render({ body, close, depth }) {
    assert(depth === 0, '首层弹窗层级不正确');
    closeOuterDialog = close;
    outerFocusTarget = document.createElement('button');
    outerFocusTarget.className = 'outer-focus-target';
    body.appendChild(outerFocusTarget);
    return { focusTarget: outerFocusTarget };
  }
});

assert(getDialogStackSize() === 1, '首层弹窗打开后栈数量不正确');
assert(document.body.classList.contains('task-dialog-open'), '首层弹窗打开后未锁定页面滚动');
assert(document.body.children.length === 1, '弹窗宿主节点未挂载到 body');
assert(document.body.children[0].children[0].classList.contains('task-dialog') === true, '首层弹窗根节点未创建');
assert(document.body.children[0].children[0].classList.contains('task-dialog--nested') === false, '首层弹窗不应被标记为嵌套层');
assert(document.activeElement === outerFocusTarget, '首层弹窗未聚焦到指定元素');

const nestedDialogPromise = openStackedDialog({
  title: '第二层弹窗',
  panelClassName: 'is-compact',
  render({ body, close, depth }) {
    assert(depth === 1, '第二层弹窗层级不正确');
    closeNestedDialog = close;
    nestedFocusTarget = document.createElement('button');
    nestedFocusTarget.className = 'nested-focus-target';
    body.appendChild(nestedFocusTarget);
    return { focusTarget: nestedFocusTarget };
  }
});

const dialogHost = document.body.children[0];
const firstDialog = dialogHost.children[0];
const secondDialog = dialogHost.children[1];

assert(getDialogStackSize() === 2, '第二层弹窗打开后栈数量不正确');
assert(firstDialog.classList.contains('task-dialog--nested') === false, '首层弹窗不应增加嵌套遮罩样式');
assert(secondDialog.classList.contains('task-dialog--nested') === true, '第二层弹窗未标记为嵌套层');
assert(document.activeElement === nestedFocusTarget, '第二层弹窗未聚焦到指定元素');

closeNestedDialog({ cancelled: false, confirmed: true });
const nestedDialogResult = await nestedDialogPromise;
assert(nestedDialogResult.confirmed === true, '第二层弹窗关闭结果不正确');
assert(getDialogStackSize() === 1, '关闭第二层弹窗后栈数量不正确');
assert(document.activeElement === outerFocusTarget, '关闭第二层弹窗后未恢复首层焦点');

closeOuterDialog({ cancelled: true });
const outerDialogResult = await outerDialogPromise;
assert(outerDialogResult.cancelled === true, '首层弹窗关闭结果不正确');
assert(getDialogStackSize() === 0, '关闭全部弹窗后栈数量不正确');
assert(document.body.classList.contains('task-dialog-open') === false, '关闭全部弹窗后页面滚动锁定未释放');

resetDialogStackForTests();
globalThis.window = originalWindow;
globalThis.document = originalDocument;
globalThis.HTMLElement = originalHTMLElement;

const logoutResult = await handleLogout({ skipRedirect: true });
assert(logoutResult.success, '退出登录失败');
assert(checkAuthStatusSync() === null, '退出后登录态未清理');

console.log('Smoke test passed: auth + task CRUD + shared confirm flow + quadrant grouping + stacked dialog behavior all verified.');

