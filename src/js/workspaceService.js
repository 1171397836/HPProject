import { supabase } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';
import CONFIG from './config.js';
import localStore from './localStore.js';

const STORAGE_KEY_WORKSPACE = CONFIG.STORAGE_KEYS.CURRENT_WORKSPACE;
const MAX_WORKSPACE_NAME_LENGTH = 20;
const MAX_WORKSPACES_PER_USER = 10;

let currentWorkspaceId = null;
let workspaceList = [];
let changeListeners = [];

function normalizeWorkspace(workspace) {
  return {
    ...workspace,
    _id: workspace.id,
    uid: workspace.user_id,
    isDefault: workspace.is_default,
    createdAt: workspace.created_at,
    updatedAt: workspace.updated_at
  };
}

function getStorageKey() {
  const user = getCurrentUser();
  const userId = user ? user.uid : 'default';
  return `${STORAGE_KEY_WORKSPACE}_${userId}`;
}

function validateWorkspaceName(name) {
  const normalized = typeof name === 'string' ? name.trim() : '';
  if (!normalized) {
    return { valid: false, normalized, error: '请输入工作区名称' };
  }
  if (normalized.length > MAX_WORKSPACE_NAME_LENGTH) {
    return { valid: false, normalized, error: `工作区名称不能超过${MAX_WORKSPACE_NAME_LENGTH}个字符` };
  }
  return { valid: true, normalized, error: null };
}

async function initWorkspace() {
  const user = getCurrentUser();
  if (!user?.uid) {
    return { success: false, workspaces: [], activeWorkspaceId: null };
  }

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', user.uid)
      .order('created_at', { ascending: true });

    if (error) throw error;

    workspaceList = (data || []).map(normalizeWorkspace);

    if (workspaceList.length === 0) {
      const created = await ensureDefaultWorkspace();
      if (created.success) {
        workspaceList = [created.data];
      }
    }

    const savedId = localStore.get(getStorageKey());
    const savedExists = workspaceList.some(w => w._id === savedId);

    if (savedId && savedExists) {
      currentWorkspaceId = savedId;
    } else {
      const defaultWs = workspaceList.find(w => w.isDefault);
      currentWorkspaceId = defaultWs ? defaultWs._id : workspaceList[0]?._id || null;
    }

    if (currentWorkspaceId) {
      localStore.set(getStorageKey(), currentWorkspaceId);
    }

    return {
      success: true,
      workspaces: workspaceList,
      activeWorkspaceId: currentWorkspaceId
    };
  } catch (error) {
    console.error('[WorkspaceService] initWorkspace error', error);
    return { success: false, workspaces: [], activeWorkspaceId: null };
  }
}

async function ensureDefaultWorkspace() {
  const user = getCurrentUser();
  if (!user?.uid) {
    return { success: false, data: null, error: '用户未登录' };
  }

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .insert([{ user_id: user.uid, name: '默认', is_default: true }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: normalizeWorkspace(data), error: null };
  } catch (error) {
    console.error('[WorkspaceService] ensureDefaultWorkspace error', error);
    return { success: false, data: null, error: '创建默认工作区失败' };
  }
}

function getWorkspaces() {
  return workspaceList;
}

function getActiveWorkspaceId() {
  return currentWorkspaceId;
}

function getActiveWorkspace() {
  return workspaceList.find(w => w._id === currentWorkspaceId) || null;
}

async function setActiveWorkspace(workspaceId) {
  const target = workspaceList.find(w => w._id === workspaceId);
  if (!target) {
    return { success: false, error: '工作区不存在' };
  }

  currentWorkspaceId = workspaceId;
  localStore.set(getStorageKey(), workspaceId);

  for (const listener of changeListeners) {
    try {
      await listener(workspaceId);
    } catch (err) {
      console.error('[WorkspaceService] change listener error', err);
    }
  }

  return { success: true };
}

async function createWorkspace(name) {
  const validation = validateWorkspaceName(name);
  if (!validation.valid) {
    return { success: false, data: null, error: validation.error };
  }

  if (workspaceList.length >= MAX_WORKSPACES_PER_USER) {
    return { success: false, data: null, error: `最多创建${MAX_WORKSPACES_PER_USER}个工作区` };
  }

  const user = getCurrentUser();
  if (!user?.uid) {
    return { success: false, data: null, error: '用户未登录' };
  }

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .insert([{ user_id: user.uid, name: validation.normalized, is_default: false }])
      .select()
      .single();

    if (error) throw error;

    const workspace = normalizeWorkspace(data);
    workspaceList.push(workspace);
    return { success: true, data: workspace, error: null };
  } catch (error) {
    console.error('[WorkspaceService] createWorkspace error', error);
    return { success: false, data: null, error: '创建工作区失败' };
  }
}

async function renameWorkspace(workspaceId, newName) {
  const validation = validateWorkspaceName(newName);
  if (!validation.valid) {
    return { success: false, data: null, error: validation.error };
  }

  const user = getCurrentUser();
  if (!user?.uid) {
    return { success: false, data: null, error: '用户未登录' };
  }

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .update({ name: validation.normalized, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)
      .eq('user_id', user.uid)
      .select()
      .single();

    if (error) throw error;

    const updated = normalizeWorkspace(data);
    const idx = workspaceList.findIndex(w => w._id === workspaceId);
    if (idx !== -1) workspaceList[idx] = updated;

    return { success: true, data: updated, error: null };
  } catch (error) {
    console.error('[WorkspaceService] renameWorkspace error', error);
    return { success: false, data: null, error: '重命名工作区失败' };
  }
}

async function deleteWorkspace(workspaceId) {
  const target = workspaceList.find(w => w._id === workspaceId);
  if (!target) {
    return { success: false, error: '工作区不存在' };
  }
  if (target.isDefault) {
    return { success: false, error: '不能删除默认工作区' };
  }

  const user = getCurrentUser();
  if (!user?.uid) {
    return { success: false, error: '用户未登录' };
  }

  try {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)
      .eq('user_id', user.uid);

    if (error) throw error;

    workspaceList = workspaceList.filter(w => w._id !== workspaceId);

    if (currentWorkspaceId === workspaceId) {
      const defaultWs = workspaceList.find(w => w.isDefault);
      await setActiveWorkspace(defaultWs ? defaultWs._id : workspaceList[0]._id);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('[WorkspaceService] deleteWorkspace error', error);
    return { success: false, error: '删除工作区失败' };
  }
}

function onWorkspaceChange(callback) {
  if (typeof callback === 'function') {
    changeListeners.push(callback);
  }
}

function removeWorkspaceChangeListener(callback) {
  changeListeners = changeListeners.filter(fn => fn !== callback);
}

export {
  initWorkspace,
  getWorkspaces,
  getActiveWorkspaceId,
  getActiveWorkspace,
  setActiveWorkspace,
  createWorkspace,
  renameWorkspace,
  deleteWorkspace,
  onWorkspaceChange,
  removeWorkspaceChangeListener,
  MAX_WORKSPACE_NAME_LENGTH,
  MAX_WORKSPACES_PER_USER
};
