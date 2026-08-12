// ============================================================================
// TYPES: Role-Based Task Management System
// ============================================================================

// Existing types from backend/src/types/index.ts will be extended with these

// ============================================================================
// ROLES & PERMISSIONS
// ============================================================================

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  display_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

// Updated User type (replace existing in types/index.ts)
export interface User {
  id: string;
  email: string;
  name: string;
  role_id: string;              // NEW: FK to roles table
  role?: Role;                   // OPTIONAL: populated by JOIN
  is_active: boolean;
  avatar_url?: string;
  last_login_at?: string | null;
  last_logout_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TASKS & WORKFLOW
// ============================================================================

export type TaskStatus = 'assigned' | 'in_progress' | 'submitted' | 'revision_requested' | 'approved' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ReviewStatus = 'pending' | 'approved' | 'revision_requested';

export interface Task {
  id: string;
  title: string;
  description?: string;
  created_by: string;
  assigned_to: string;
  start_date?: string;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
  started_at?: string;
  submitted_at?: string;
  approved_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  is_overdue: boolean;
  cancellation_reason?: string;
  cancelled_by?: string;
  created_at: string;
  updated_at: string;
  
  // Populated by queries with JOINs (optional)
  created_by_name?: string;
  assigned_to_name?: string;
  created_by_email?: string;
  assigned_to_email?: string;
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  submission_notes?: string;
  submitted_by: string;
  submitted_at: string;
  review_status: ReviewStatus;
  reviewer_id?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
  
  // Populated by queries
  submitted_by_name?: string;
  reviewer_name?: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  comment_text: string;
  commented_by: string;
  is_system_comment: boolean;
  created_at: string;
  updated_at: string;
  
  // Populated by queries
  commented_by_name?: string;
}

export interface TaskAttachment {
  id: string;
  entity_type: string;
  entity_id: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size_bytes: number;
  file_path: string;
  uploaded_by: string;
  uploaded_at: string;
  is_deleted: boolean;
  created_at: string;
  
  // Populated by queries
  uploaded_by_name?: string;
}

export interface TaskActivityLog {
  id: string;
  task_id: string;
  action: string;
  details?: Record<string, any>;
  performed_by?: string;
  performed_at: string;
  
  // Populated by queries
  performed_by_name?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateTaskRequest {
  title: string;
  description?: string;
  assigned_to: string;
  start_date?: string;
  deadline: string;
  priority: TaskPriority;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  deadline?: string;
  priority?: TaskPriority;
  assigned_to?: string;
}

export interface SubmitTaskRequest {
  submission_notes?: string;
  // Files handled separately via multipart form
}

export interface ApproveTaskRequest {
  review_notes?: string;
}

export interface RequestRevisionRequest {
  review_notes: string;
}

export interface CancelTaskRequest {
  cancellation_reason: string;
}

// ============================================================================
// AUTHORIZATION TYPES
// ============================================================================

export interface AuthorizationContext {
  userId: string;
  roleId: string;
  role: Role;
  permissions: Permission[];
}

export interface PermissionCheck {
  resource: string;
  action: string;
}

// ============================================================================
// NOTIFICATION TYPES (EXTEND EXISTING)
// ============================================================================

export type NotificationType = 
  | 'lead_created'
  | 'follow_up_reminder'
  | 'task_assigned'
  | 'task_deadline_approaching'
  | 'task_overdue'
  | 'task_submitted'
  | 'task_revision_requested'
  | 'task_approved'
  | 'task_started'
  | 'task_cancelled'
  | 'quotation_created'
  | 'quotation_approved';

export interface Notification {
  id: string;
  user_id: string;
  entity_type?: string;    // 'task', 'lead', etc.
  entity_id?: string;      // UUID of entity
  type: NotificationType;
  message: string;
  payload?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}
