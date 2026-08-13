-- ============================================================================
-- MIGRATION: Create Task Management System Tables
-- Date: 2026-08-12
-- Description: Create tables for task workflow, submissions, attachments, comments
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity & Content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Assignment
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Scheduling
  start_date TIMESTAMP,
  deadline TIMESTAMP NOT NULL,
  
  -- Status & Priority
  status VARCHAR(50) NOT NULL DEFAULT 'assigned',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  
  -- Timestamps
  started_at TIMESTAMP,
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Metadata
  is_overdue BOOLEAN DEFAULT false,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN (
    'assigned', 'in_progress', 'submitted', 'revision_requested', 'approved', 'cancelled'
  )),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high'))
);

-- Indexes for tasks table
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_is_overdue ON tasks(is_overdue);

-- ============================================================================
-- 2. CREATE TASK_SUBMISSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Association
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Submission Content
  submission_notes TEXT,
  
  -- Metadata
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Review Status
  review_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_review_status CHECK (review_status IN (
    'pending', 'approved', 'revision_requested'
  ))
);

-- Indexes for task_submissions table
CREATE INDEX idx_task_submissions_task_id ON task_submissions(task_id);
CREATE INDEX idx_task_submissions_submitted_by ON task_submissions(submitted_by);
CREATE INDEX idx_task_submissions_review_status ON task_submissions(review_status);
CREATE INDEX idx_task_submissions_reviewer_id ON task_submissions(reviewer_id);

-- ============================================================================
-- 3. CREATE TASK_COMMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Association
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Content
  comment_text TEXT NOT NULL,
  
  -- Author
  commented_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Metadata
  is_system_comment BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT comment_length CHECK (char_length(comment_text) > 0)
);

-- Indexes for task_comments table
CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_commented_by ON task_comments(commented_by);
CREATE INDEX idx_task_comments_is_system ON task_comments(is_system_comment);

-- ============================================================================
-- 4. CREATE TASK_ATTACHMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Polymorphic Association
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  
  -- File Information
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  
  -- Upload Metadata
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Access Control
  is_deleted BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for task_attachments table
CREATE INDEX idx_task_attachments_entity ON task_attachments(entity_type, entity_id);
CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);
CREATE INDEX idx_task_attachments_mime_type ON task_attachments(mime_type);

-- ============================================================================
-- 5. CREATE TASK_ACTIVITY_LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Association
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Action Details
  action VARCHAR(50) NOT NULL,
  details JSONB,
  
  -- Actor
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Timestamps
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for task_activity_logs table
CREATE INDEX idx_task_activity_logs_task_id ON task_activity_logs(task_id);
CREATE INDEX idx_task_activity_logs_action ON task_activity_logs(action);
CREATE INDEX idx_task_activity_logs_performed_by ON task_activity_logs(performed_by);
CREATE INDEX idx_task_activity_logs_performed_at ON task_activity_logs(performed_at);

-- ============================================================================
-- 6. ENHANCE NOTIFICATIONS TABLE (ADD COLUMNS IF NOT EXISTS)
-- ============================================================================
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Add index for entity lookups
CREATE INDEX IF NOT EXISTS idx_notifications_entity 
ON notifications(entity_type, entity_id);

-- ============================================================================
-- 7. VERIFICATION CHECKS
-- ============================================================================

-- Check all tables created
SELECT 
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tasks', 'task_submissions', 'task_comments', 
    'task_attachments', 'task_activity_logs'
  )
ORDER BY tablename;

COMMIT;
