const globalScope = typeof window !== 'undefined' ? window : globalThis;

function getStorage() {
  try {
    if (globalScope.localStorage) {
      return globalScope.localStorage;
    }
  } catch {
    // private browsing or SecurityError
  }
  return null;
}

function get(key) {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function getJSON(key) {
  const raw = get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function set(key, value) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function keys() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const result = [];
    for (let i = 0; i < storage.length; i++) {
      result.push(storage.key(i));
    }
    return result;
  } catch {
    return [];
  }
}

export default { get, getJSON, set, remove, keys };
