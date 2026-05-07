-- ============================================
-- Workspace 功能数据库迁移脚本（生产安全版）
-- 在 Supabase SQL Editor 中按顺序执行
--
-- 安全策略：不立即设 NOT NULL，用触发器自动填充 workspace_id
-- 这样新老前端都能正常工作，无停机窗口
-- ============================================

-- Step 1: 创建 workspaces 表
CREATE TABLE workspaces (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_workspaces_user_default
  ON workspaces (user_id) WHERE is_default = true;
CREATE INDEX idx_workspaces_user_id ON workspaces (user_id);

-- Step 2: tasks 表新增 workspace_id 列（保持 nullable，兼容老前端）
ALTER TABLE tasks ADD COLUMN workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_workspace_id ON tasks (workspace_id);

-- Step 3: 为现有用户创建默认空间
INSERT INTO workspaces (user_id, name, is_default)
SELECT DISTINCT user_id, '默认', true FROM tasks
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 4: 把现有任务归入默认空间
UPDATE tasks SET workspace_id = w.id
FROM workspaces w
WHERE tasks.user_id = w.user_id AND w.is_default = true AND tasks.workspace_id IS NULL;

-- Step 5: 创建触发器 —— 老前端 INSERT 任务时自动填充 workspace_id
-- 这样即使前端不传 workspace_id，数据库也会自动归入默认空间
CREATE OR REPLACE FUNCTION auto_fill_workspace_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT id INTO NEW.workspace_id
    FROM workspaces
    WHERE user_id = NEW.user_id AND is_default = true
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_task_insert_fill_workspace
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_workspace_id();

-- Step 6: RLS 策略
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspaces"
  ON workspaces FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own workspaces"
  ON workspaces FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workspaces"
  ON workspaces FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete non-default workspaces"
  ON workspaces FOR DELETE USING (user_id = auth.uid() AND is_default = false);

-- Step 7: 新用户注册时自动创建默认空间
CREATE OR REPLACE FUNCTION create_default_workspace()
RETURNS trigger AS $$
BEGIN
  INSERT INTO workspaces (user_id, name, is_default) VALUES (NEW.id, '默认', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_workspace();

-- ============================================
-- Step 8（后续执行，确认新前端已全量上线后）:
-- 清理：将 workspace_id 改为 NOT NULL，删除自动填充触发器
--
-- ALTER TABLE tasks ALTER COLUMN workspace_id SET NOT NULL;
-- DROP TRIGGER IF EXISTS on_task_insert_fill_workspace ON tasks;
-- DROP FUNCTION IF EXISTS auto_fill_workspace_id();
-- ============================================
