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

globalThis.window = globalThis;
globalThis.localStorage = createMemoryStorage();
globalThis.location = {
  protocol: 'http:',
  hostname: 'localhost',
  pathname: '/viewer01/login.html',
  href: 'http://localhost:8080/viewer01/login.html'
};

const authModule = await import('../js/auth.js');
const cloudbaseModule = await import('../js/cloudbase.js');
const appModule = await import('../js/app.js');

const {
  checkAuthStatusSync,
  handleLogin,
  handleLogout,
  handleRegister
} = authModule;

const { taskDB } = cloudbaseModule;
const { groupTasksByQuadrant } = appModule;

localStorage.clear();

const registerResult = await handleRegister('smoke_user', '123456', '123456', { skipRedirect: true });
assert(registerResult.success, '注册失败');

const loginResult = await handleLogin('smoke_user', '123456', { skipRedirect: true });
assert(loginResult.success, '登录失败');
assert(checkAuthStatusSync()?.username === 'smoke_user', '登录态未写入本地存储');

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

const listAfterUpdate = await taskDB.getTasks();
const grouped = groupTasksByQuadrant(listAfterUpdate.data);

assert(grouped.q1.some(task => task._id === task1.data._id && task.completed), 'Q1 完成任务未保留');
assert(grouped.q4.some(task => task._id === task2.data._id && task.content === '整理下周迭代计划'), '任务未移动到 Q4');

const clearResult = await taskDB.clearCompleted();
assert(clearResult.success && clearResult.deletedCount === 1, '清空已完成失败');

const deleteResult = await taskDB.deleteTask(task3.data._id);
assert(deleteResult.success, '删除任务失败');

const finalList = await taskDB.getTasks();
assert(finalList.data.length === 1, '最终任务数量不正确');
assert(finalList.data[0]._id === task2.data._id, '最终保留任务不正确');

const logoutResult = await handleLogout({ skipRedirect: true });
assert(logoutResult.success, '退出登录失败');
assert(checkAuthStatusSync() === null, '退出后登录态未清理');

console.log('Smoke test passed: auth + task CRUD + quadrant grouping + logout all verified.');

