# REVISED ARCHITECTURE: ROLE-BASED TASK MANAGEMENT SYSTEM
## Lead Manager Application - Scalable RBAC & Task Management

**Status**: Architecture Review (DO NOT IMPLEMENT YET)  
**Date**: 2026-08-12  
**Author**: Development Analysis

---

## TABLE OF CONTENTS
1. [A. Revised Architecture Overview](#a-revised-architecture-overview)
2. [B. Database Schema (Complete)](#b-database-schema-complete)
3. [C. Relationship Diagram](#c-relationship-diagram)
4. [D. Permission Model](#d-permission-model)
5. [E. Task Lifecycle & State Machine](#e-task-lifecycle--state-machine)
6. [F. Role-Based UI Separation](#f-role-based-ui-separation)
7. [G. Migration Strategy](#g-migration-strategy)
8. [H. Files to Create/Modify](#h-files-to-createmodify)
9. [I. Risks & Backward Compatibility](#i-risks--backward-compatibility)
10. [J. Phase 2 Implementation Steps](#j-phase-2-implementation-steps)

---

# A. REVISED ARCHITECTURE OVERVIEW

## A.1 Core Principles

### ✅ Dynamic Roles (NOT Hardcoded)
- `roles` table stores role definitions
- Admin can create/edit/disable/delete roles
- NO database constraint CHECK on fixed role values
- Roles are metadata, not schema enforcement

### ✅ Separation of Concerns
```
ROLES          → What users are called (Video Editor, Content Creator, etc.)
PERMISSIONS    → What actions are allowed (tasks.create, leads.view, etc.)
ROLE_PERMS     → Which roles have which permissions (mapping table)
USERS          → Have ONE role + inherit permissions through that role
```

### ✅ RBAC Architecture
```
User.role_id → Role.id → Role_Permission (many) → Permission.id
                ↓
        User gets all permissions from assigned role
```

### ✅ Backward Compatibility
```
Existing "agent" users continue working
agent role becomes a managed role in roles table
No existing data lost
All existing APIs function unchanged
```

### ✅ Task Independence from Role
```
Task.assigned_to → User.id (direct assignment)
Task.created_by → User.id

When filtering tasks by role:
  Filter by (task.assigned_to → user.role_id → role.name = "Video Editor")
  
Task ownership never changes if user's role changes
Historical data remains accurate
```

### ✅ Flexible File Handling
```
entity_type + entity_id (polymorphic pattern)
Supports: tasks, leads, submissions, etc.
Per-entity file type/size configuration
```

---

# B. DATABASE SCHEMA (COMPLETE)

## B.1 USERS TABLE (MODIFIED)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Authentication
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  -- Profile
  name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255),
  
  -- Role Assignment (Foreign Key - NOT Hardcoded)
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  last_logout_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Index for frequent queries
  INDEX idx_email (email),
  INDEX idx_role_id (role_id),
  INDEX idx_is_active (is_active)
);
```

**MIGRATION NOTE**: 
- Change existing `role` VARCHAR to `role_id UUID`
- Create migration to populate roles table with existing "admin", "agent", "manager"
- Map existing users to new role records

---

## B.2 ROLES TABLE (NEW)

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name VARCHAR(100) UNIQUE NOT NULL,           -- "Video Editor", "Sales Executive", etc.
  slug VARCHAR(100) UNIQUE NOT NULL,           -- "video_editor", "sales_executive" (URL-safe)
  description TEXT,
  
  -- System Metadata
  is_system_role BOOLEAN DEFAULT false,        -- true for built-in roles (admin, agent, manager)
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_slug (slug),
  INDEX idx_is_active (is_active),
  INDEX idx_is_system_role (is_system_role)
);
```

**Initial Data** (seed):
```sql
INSERT INTO roles (name, slug, description, is_system_role) VALUES
  ('Admin', 'admin', 'System administrator', true),
  ('Sales Executive', 'agent', 'Sales executive / CRM agent', true),
  ('Sales Manager', 'manager', 'Sales team manager', true);
```

---

## B.3 PERMISSIONS TABLE (NEW)

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Naming
  resource VARCHAR(50) NOT NULL,               -- 'tasks', 'leads', 'quotations', etc.
  action VARCHAR(50) NOT NULL,                 -- 'create', 'read', 'update', 'delete', 'approve', etc.
  
  -- Display
  display_name VARCHAR(100) NOT NULL,          -- "Create Task", "Approve Quotation"
  description TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints & Indexes
  UNIQUE (resource, action),
  INDEX idx_resource (resource),
  INDEX idx_action (action)
);
```

**Initial Permissions** (sample, admin adds more):
```sql
-- Task Permissions
INSERT INTO permissions (resource, action, display_name) VALUES
  ('tasks', 'view', 'View Tasks'),
  ('tasks', 'view_all', 'View All Tasks'),
  ('tasks', 'create', 'Create Task'),
  ('tasks', 'assign', 'Assign Task'),
  ('tasks', 'reassign', 'Reassign Task'),
  ('tasks', 'edit', 'Edit Task'),
  ('tasks', 'start', 'Start Task'),
  ('tasks', 'submit', 'Submit Task'),
  ('tasks', 'review', 'Review Submission'),
  ('tasks', 'approve', 'Approve Task'),
  ('tasks', 'request_revision', 'Request Revision'),
  ('tasks', 'cancel', 'Cancel Task'),
  ('tasks', 'delete', 'Delete Task');

-- Lead Permissions (Sales)
INSERT INTO permissions (resource, action, display_name) VALUES
  ('leads', 'view', 'View Leads'),
  ('leads', 'view_all', 'View All Leads'),
  ('leads', 'create', 'Create Lead'),
  ('leads', 'edit', 'Edit Lead'),
  ('leads', 'delete', 'Delete Lead'),
  ('leads', 'transfer', 'Transfer Lead');

-- Quotation Permissions
INSERT INTO permissions (resource, action, display_name) VALUES
  ('quotations', 'view', 'View Quotations'),
  ('quotations', 'create', 'Create Quotation'),
  ('quotations', 'approve', 'Approve Quotation');

-- Reports
INSERT INTO permissions (resource, action, display_name) VALUES
  ('reports', 'view', 'View Reports'),
  ('reports', 'view_all', 'View All Reports');
```

---

## B.4 ROLE_PERMISSIONS TABLE (NEW)

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Composite unique key
  UNIQUE (role_id, permission_id),
  
  -- Indexes
  INDEX idx_role_id (role_id),
  INDEX idx_permission_id (permission_id)
);
```

**Initial Mappings** (sample):
```sql
-- Admin has ALL permissions
-- (Script fetches all permission IDs and grants to admin role)

-- Sales Executive (agent) has:
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.slug = 'agent' AND p.resource IN ('leads', 'quotations');

-- Video Editor has:
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'video_editor' AND p.resource = 'tasks' 
  AND p.action IN ('view', 'start', 'submit');
```

---

## B.5 TASKS TABLE (NEW)

```sql
CREATE TABLE tasks (
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
  started_at TIMESTAMP,              -- When employee actually started
  submitted_at TIMESTAMP,            -- When first submitted
  approved_at TIMESTAMP,             -- When admin approved
  completed_at TIMESTAMP,            -- When marked complete (after approval)
  cancelled_at TIMESTAMP,            -- When admin cancelled
  
  -- Metadata
  is_overdue BOOLEAN DEFAULT false,  -- Computed at query time or updated by worker
  cancellation_reason TEXT,          -- If cancelled
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN (
    'assigned', 'in_progress', 'submitted', 'revision_requested', 'approved', 'cancelled'
  )),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high')),
  
  -- Indexes
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_created_by (created_by),
  INDEX idx_status (status),
  INDEX idx_deadline (deadline),
  INDEX idx_priority (priority)
);
```

**Key Design Decisions**:
- `status` does NOT include 'overdue' as terminal state
- `is_overdue` is a boolean flag computed/updated by worker
- `status` remains 'in_progress' even when overdue
- UI displays OVERDUE when (deadline < NOW AND status != 'approved' AND status != 'cancelled')
- Backend validates status transitions, NOT frontend

---

## B.6 TASK_SUBMISSIONS TABLE (NEW)

```sql
CREATE TABLE task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Association
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Submission Content
  submission_notes TEXT,
  
  -- Metadata
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Review Status
  review_status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, approved, revision_requested
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,                   -- If revision requested
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_review_status CHECK (review_status IN ('pending', 'approved', 'revision_requested')),
  
  -- Indexes
  INDEX idx_task_id (task_id),
  INDEX idx_submitted_by (submitted_by),
  INDEX idx_review_status (review_status)
);
```

**Rationale**:
- Multiple submissions allowed (revised submissions create new submission records)
- Each submission tracks its own review status
- Activity log links submissions to task status changes

---

## B.7 TASK_ATTACHMENTS TABLE (NEW)

```sql
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Polymorphic Association
  entity_type VARCHAR(50) NOT NULL,        -- 'task', 'task_submission', etc.
  entity_id UUID NOT NULL,                 -- references task.id or task_submission.id
  
  -- File Information
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,   -- Sanitized, unique filename
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,         -- Relative path to file
  
  -- Upload Metadata
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Access Control
  is_deleted BOOLEAN DEFAULT false,        -- Soft delete for audit trail
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_entity_type_id (entity_type, entity_id),
  INDEX idx_uploaded_by (uploaded_by),
  INDEX idx_mime_type (mime_type)
);
```

**Advantages**:
- Supports tasks, submissions, and future entities
- File type/size validation configured per entity_type
- Authorization checks: can only access if can access parent entity
- Soft delete preserves audit trail

---

## B.8 TASK_COMMENTS TABLE (NEW)

```sql
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Association
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Content
  comment_text TEXT NOT NULL,
  
  -- Author
  commented_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Metadata
  is_system_comment BOOLEAN DEFAULT false,  -- true for automated messages (status changes, etc.)
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT comment_length CHECK (char_length(comment_text) > 0),
  
  -- Indexes
  INDEX idx_task_id (task_id),
  INDEX idx_commented_by (commented_by),
  INDEX idx_is_system_comment (is_system_comment)
);
```

---

## B.9 TASK_ACTIVITY_LOGS TABLE (NEW)

```sql
CREATE TABLE task_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Association
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Action Details
  action VARCHAR(50) NOT NULL,              -- 'created', 'assigned', 'started', 'submitted', 'approved', etc.
  details JSONB,                            -- Flexible storage for action-specific data
  
  -- Actor
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Timestamps
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_task_id (task_id),
  INDEX idx_action (action),
  INDEX idx_performed_by (performed_by),
  INDEX idx_performed_at (performed_at)
);
```

**Example Details Field**:
```json
{
  "action": "status_changed",
  "from_status": "in_progress",
  "to_status": "submitted",
  "submission_id": "uuid"
}

{
  "action": "revision_requested",
  "reviewer_id": "uuid",
  "revision_notes": "Please change opening hook"
}
```

---

## B.10 NOTIFICATIONS TABLE (EXISTING - ENHANCE)

```sql
-- Already exists, no schema change needed
-- Just add new notification types

ALTER TABLE notifications ADD COLUMN entity_type VARCHAR(50);  -- 'task', 'lead', etc.
ALTER TABLE notifications ADD COLUMN entity_id UUID;            -- task_id, lead_id, etc.

-- Keep existing columns
-- user_id, type, message, payload, is_read, created_at
```

**New Notification Types**:
```
task_assigned
task_deadline_approaching
task_overdue
task_submitted
task_revision_requested
task_approved
task_started
task_cancelled
```

---

## B.11 AUDIT_LOGS TABLE (EXISTING - REUSE)

```sql
-- Already exists in schema
-- Can be reused for task-related changes
-- No modification needed

-- Use existing structure:
-- entity_type, entity_id, action, changes, user_id, created_at
```

---

# C. RELATIONSHIP DIAGRAM

## C.1 Conceptual ERD

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION & ROLES                        │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │    USERS     │
    ├──────────────┤
    │ id (PK)      │
    │ email        │
    │ name         │
    │ role_id (FK) ├──────────┐
    │ is_active    │          │ ONE-TO-ONE
    └──────────────┘          │
                              │
                              ▼
                    ┌──────────────────┐
                    │     ROLES        │
                    ├──────────────────┤
                    │ id (PK)          │
                    │ name             │
                    │ slug             │
                    │ description      │
                    │ is_system_role   │
                    │ is_active        │
                    └──────────────────┘
                              │
                              │ ONE-TO-MANY
                              ▼
                    ┌──────────────────────────┐
                    │  ROLE_PERMISSIONS        │
                    ├──────────────────────────┤
                    │ id (PK)                  │
                    │ role_id (FK)             │
                    │ permission_id (FK) ──────┐
                    │ created_at               │  MANY-TO-MANY
                    └──────────────────────────┘  │
                                                   │
                                                   ▼
                                        ┌──────────────────────┐
                                        │   PERMISSIONS        │
                                        ├──────────────────────┤
                                        │ id (PK)              │
                                        │ resource             │
                                        │ action               │
                                        │ display_name         │
                                        └──────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      TASK MANAGEMENT                            │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │   TASKS      │
                    ├──────────────┤
                    │ id (PK)      │
                    │ title        │
                    │ description  │
                    │ created_by ──┼───────┐
                    │ assigned_to ─┼─┐     │
                    │ status       │ │     │
                    │ priority     │ │     │
                    │ deadline     │ │     │
                    │ started_at   │ │     │
                    │ submitted_at │ │     │
                    │ approved_at  │ │ ONE-TO-MANY (FK to users)
                    │ cancelled_at │ │     │
                    │ is_overdue   │ │     │
                    │ created_at   │ │     │
                    └──────────────┘ │     │
                              │      │     │
                    ONE-TO-MANY      │     │
                              │      │     │
        ┌─────────────────────┘      │     │
        │                            │     │
        ▼                            │     │
    ┌──────────────────┐             │     │
    │  TASK_COMMENTS   │◄────────────┘     │
    ├──────────────────┤                   │
    │ id (PK)          │              ┌────┘
    │ task_id (FK)     │              │
    │ comment_text     │              │
    │ commented_by ────┼──────────────┤
    │ is_system_comment│              │
    │ created_at       │              │
    └──────────────────┘              │
                                      ▼
                            ┌──────────────────────┐
        ┌───────────────────►│  TASK_SUBMISSIONS   │
        │                   ├──────────────────────┤
        │                   │ id (PK)              │
        │ ONE-TO-MANY       │ task_id (FK) ─────┐ │
        │                   │ submission_notes  │ │
        │  ┌────────────────┤ submitted_by      │ │ FK to users
        │  │                │ review_status     │ │
        │  │                │ reviewer_id ──────┼─┼────┐
        │  │                │ review_notes      │ │    │
        │  │                └──────────────────────┘    │
        │  │                         │                 │
        │  │              ONE-TO-MANY│                 │
        │  │                         ▼                 │
        │  │        ┌──────────────────────────────┐  │
        │  └────────┤  TASK_ATTACHMENTS            │  │
        │           ├──────────────────────────────┤  │
        │           │ id (PK)                      │  │
        │           │ entity_type                  │  │
        │           │ entity_id                    │  │
        │           │ stored_filename              │  │
        │           │ mime_type                    │  │
        │           │ file_size_bytes              │  │
        │           │ uploaded_by ─────────────────┼──┴─ FK to users
        │           │ uploaded_at                  │
        │           └──────────────────────────────┘
        │
        └──────────────────┐
                           │
        ┌──────────────────┘
        │ ONE-TO-MANY
        ▼
    ┌──────────────────┐
    │ TASK_ACTIVITY_   │
    │ LOGS             │
    ├──────────────────┤
    │ id (PK)          │
    │ task_id (FK)     │
    │ action           │
    │ details (JSONB)  │
    │ performed_by ────┼──── FK to users
    │ performed_at     │
    └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  NOTIFICATIONS (EXISTING)                       │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │  NOTIFICATIONS   │
    ├──────────────────┤
    │ id (PK)          │
    │ user_id (FK) ────┼──── to users
    │ entity_type      │     (NEW: can be 'task', 'lead', etc.)
    │ entity_id        │     (NEW: references entity)
    │ type             │     (task_assigned, revision_requested, etc.)
    │ message          │
    │ payload (JSONB)  │
    │ is_read          │
    │ created_at       │
    └──────────────────┘
```

---

# D. PERMISSION MODEL

## D.1 Permission Architecture

### Core Concept
```
Permission = (resource, action)

Example:
- (tasks, create)    → Can create tasks
- (tasks, approve)   → Can approve submitted tasks
- (leads, view)      → Can view leads
- (leads, view_all)  → Can view all leads (not just own)
```

### Resource Categories

**Tasks System**:
```
tasks.view              → View own tasks
tasks.view_all          → View all team tasks
tasks.create            → Create new task
tasks.assign            → Assign task to someone
tasks.reassign          → Change task assignment
tasks.edit              → Edit task details (title, description, deadline)
tasks.start             → Start working on task
tasks.submit            → Submit completed task
tasks.review            → Review submissions (admin only)
tasks.approve           → Approve submitted task
tasks.request_revision  → Request revision from employee
tasks.cancel            → Cancel task
tasks.delete            → Delete task permanently
```

**Leads System** (existing, preserved):
```
leads.view              → View own leads
leads.view_all          → View all leads
leads.create            → Create new lead
leads.edit              → Edit lead details
leads.delete            → Delete lead
leads.transfer          → Transfer lead to another agent
```

**Quotations** (existing, preserved):
```
quotations.view         → View quotations
quotations.create       → Create quotation
quotations.approve      → Approve quotation
```

**Invoices** (existing, preserved):
```
invoices.view           → View invoices
invoices.create         → Create invoice
```

**Reports** (existing, preserved):
```
reports.view            → View own reports
reports.view_all        → View all reports
```

**Admin System** (future):
```
roles.manage            → Create/edit/delete roles
permissions.manage      → Assign permissions to roles
users.manage            → Create/edit users
system.configure        → System-wide settings
```

---

## D.2 Role Permission Matrix

### Standard Roles & Their Permissions

#### **Admin**
```
✓ ALL permissions
```

#### **Sales Executive** (existing "agent" role)
```
✓ leads.view              (own leads)
✓ leads.create
✓ leads.edit              (own)
✓ leads.transfer          (own)
✓ quotations.view
✓ quotations.create
✗ quotations.approve      (manager or admin only)
✓ invoices.view
✗ reports.view_all        (manager/admin only)

✗ tasks.* (no access to task system)
```

#### **Sales Manager** (existing "manager" role)
```
✓ leads.view_all
✓ leads.transfer
✓ quotations.view
✓ quotations.create
✓ quotations.approve      (review level)
✓ invoices.view
✓ reports.view_all
✓ tasks.view_all
✓ tasks.create            (can assign to team)
✓ tasks.assign
✓ tasks.reassign
✓ tasks.review            (review submissions)
✗ tasks.approve           (admin only)
```

#### **Video Editor** (new non-sales role)
```
✓ tasks.view              (own tasks)
✓ tasks.start
✓ tasks.submit
✓ tasks.view_comments
✗ tasks.create
✗ tasks.assign
✗ tasks.approve
✗ tasks.delete

✗ leads.view
✗ quotations.view
✗ invoices.view
✗ reports.*
```

#### **Content Creator** (new non-sales role)
```
✓ tasks.view              (own tasks)
✓ tasks.start
✓ tasks.submit
✓ tasks.view_comments
✗ All sales features
```

#### **Social Media Marketer** (new non-sales role)
```
✓ tasks.view              (own tasks)
✓ tasks.start
✓ tasks.submit
✗ All sales features
```

---

## D.3 Authorization Service Pseudo-Code

```typescript
// Backend authorization service (centralized)

class AuthorizationService {
  
  // Check if user has permission
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const user = await userModel.findById(userId);
    const role = await roleModel.findById(user.role_id);
    
    const permission = await permissionModel.findByResourceAction(resource, action);
    
    const granted = await rolePermissionModel.exists(role.id, permission.id);
    
    return granted;
  }
  
  // Middleware for route protection
  requirePermission(resource: string, action: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const hasPermission = await authService.hasPermission(
        req.user.id,
        resource,
        action
      );
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      next();
    };
  }
  
  // Entity-level authorization
  async canAccessTask(userId: string, taskId: string): Promise<boolean> {
    const task = await taskModel.findById(taskId);
    
    // Employee can see own tasks
    if (task.assigned_to === userId) return true;
    
    // Admin/manager can see all tasks
    const hasViewAll = await this.hasPermission(userId, 'tasks', 'view_all');
    return hasViewAll;
  }
  
  async canApproveTask(userId: string, taskId: string): Promise<boolean> {
    const hasPermission = await this.hasPermission(userId, 'tasks', 'approve');
    if (!hasPermission) return false;
    
    // Optional: check if user is the one who created the task
    // const task = await taskModel.findById(taskId);
    // return task.created_by !== userId;  // Can't approve own task
    
    return true;
  }
  
  // Authorization guard for destructive operations
  async canDeleteTask(userId: string, taskId: string): Promise<boolean> {
    const hasPermission = await this.hasPermission(userId, 'tasks', 'delete');
    if (!hasPermission) return false;
    
    const task = await taskModel.findById(taskId);
    
    // Can only delete if task is still in 'assigned' status
    return task.status === 'assigned';
  }
}

// Usage in routes:
router.post('/tasks/:id/approve', 
  authMiddleware,
  authService.requirePermission('tasks', 'approve'),
  async (req, res) => {
    // Additional entity-level check
    const canApprove = await authService.canApproveTask(req.user.id, req.params.id);
    if (!canApprove) return res.status(403).json({ error: 'Cannot approve this task' });
    
    // Proceed with approval
  }
);
```

---

# E. TASK LIFECYCLE & STATE MACHINE

## E.1 Task Status States

```
ASSIGNED
├─→ IN_PROGRESS
│   ├─→ SUBMITTED
│   │   ├─→ APPROVED        (Admin approves)
│   │   └─→ REVISION_REQUESTED (Admin requests revision)
│   │       └─→ IN_PROGRESS (Employee starts revision)
│   │
│   └─→ OVERDUE (if deadline passes)
│       └─→ SUBMITTED        (Employee still can submit)
│
└─→ CANCELLED               (Admin cancels)
```

## E.2 Valid Status Transitions (Backend Enforced)

```typescript
const VALID_TRANSITIONS = {
  'assigned': ['in_progress', 'cancelled'],
  'in_progress': ['submitted', 'cancelled'],
  'submitted': ['approved', 'revision_requested', 'cancelled'],
  'revision_requested': ['in_progress', 'cancelled'],
  'approved': [],  // Terminal state
  'cancelled': []  // Terminal state
};

// Backend validation
function isValidTransition(fromStatus: string, toStatus: string): boolean {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}
```

## E.3 Overdue Handling (NOT a state, but a condition)

**Database Design**:
```sql
tasks.deadline          -- Store actual deadline timestamp
tasks.status            -- Remains in [assigned, in_progress, submitted, etc.]
tasks.is_overdue        -- Boolean flag (updated by worker or computed at query time)
```

**UI Display Logic**:
```
IF deadline < NOW AND status != 'approved' AND status != 'cancelled' THEN
  Display: OVERDUE
  But: Still show submission form
  Allow: Employee can still submit
ELSE IF deadline < NOW AND status = 'in_progress' THEN
  Display: "OVERDUE - Please submit immediately"
  Color: Red badge
```

**Backend Logic** (Worker Job):
```typescript
export const startTaskOverdueWorker = () => {
  setInterval(async () => {
    // Mark overdue tasks
    await db.query(`
      UPDATE tasks 
      SET is_overdue = true
      WHERE deadline < NOW()
        AND status NOT IN ('approved', 'cancelled')
    `);
    
    // Send notifications for newly overdue tasks
    const overdueNotifications = await db.query(`
      SELECT t.id, t.assigned_to, t.title
      FROM tasks t
      WHERE is_overdue = true
        AND status NOT IN ('approved', 'cancelled')
        AND NOT EXISTS (
          SELECT 1 FROM notifications 
          WHERE entity_type = 'task' AND entity_id = t.id 
          AND type = 'task_overdue'
          AND created_at > t.deadline
        )
    `);
    
    for (const task of overdueNotifications) {
      await notificationModel.create({
        user_id: task.assigned_to,
        type: 'task_overdue',
        entity_type: 'task',
        entity_id: task.id,
        message: `Task "${task.title}" is now overdue`
      });
    }
  }, 60000); // Check every minute
};
```

## E.4 Deadline Countdown (Frontend Calculation)

**Frontend Logic**:
```typescript
const calculateTimeRemaining = (deadlineISO: string, serverTime: Date): {
  isOverdue: boolean;
  timeRemaining: string;
  visual: 'normal' | 'approaching' | 'urgent' | 'overdue';
} => {
  const deadline = new Date(deadlineISO);
  const now = serverTime;
  const diffMs = deadline.getTime() - now.getTime();
  
  if (diffMs < 0) {
    const overdueMs = Math.abs(diffMs);
    return {
      isOverdue: true,
      timeRemaining: `OVERDUE by ${formatDuration(overdueMs)}`,
      visual: 'overdue'
    };
  }
  
  // Normal countdown
  const duration = formatDuration(diffMs);
  
  if (diffMs < 1 * 60 * 60 * 1000) {  // Less than 1 hour
    return { isOverdue: false, timeRemaining: duration, visual: 'urgent' };
  }
  if (diffMs < 8 * 60 * 60 * 1000) {  // Less than 8 hours
    return { isOverdue: false, timeRemaining: duration, visual: 'approaching' };
  }
  
  return { isOverdue: false, timeRemaining: duration, visual: 'normal' };
};
```

**Server Time Sync**:
```typescript
// API endpoint returns current server time
GET /api/time
Response: { timestamp: 1723489234, iso: "2026-08-12T14:30:34Z" }

// Frontend syncs on app load
useEffect(() => {
  const syncServerTime = async () => {
    const res = await fetch('/api/time');
    const { timestamp } = await res.json();
    const clientTime = Date.now();
    setTimeOffset(timestamp - clientTime);
  };
  syncServerTime();
}, []);

// Use offset in calculations
const getServerTime = () => new Date(Date.now() + timeOffset);
```

---

# F. ROLE-BASED UI SEPARATION

## F.1 Navigation Structure by Role

### **Sales Roles** (Admin, Sales Manager, Sales Executive/Agent)

```
Sidebar Navigation:
├─ Dashboard
├─ Leads
├─ Follow-ups
├─ Agent Panel
├─ Quotations & Invoices
├─ Reports
├─ Payments
└─ (Admin only) Settings
   ├─ Roles & Permissions
   ├─ Employee Management
   ├─ System Configuration
```

### **Non-Sales Roles** (Video Editor, Content Creator, Social Marketer, etc.)

```
Sidebar Navigation:
├─ Dashboard
├─ My Tasks
├─ Notifications
├─ Profile
└─ (Optional) Completed Tasks

NO ACCESS TO:
- Leads
- Follow-ups
- Agent Panel
- Quotations
- Invoices
- Sales Reports
```

### **Manager Roles** (Sales Manager)

```
Can additionally see:
├─ Task Management
│  ├─ Create Task
│  ├─ Assign Task
│  ├─ Review Submissions
│  ├─ Team Workload
```

---

## F.2 Frontend Route Protection

```typescript
// App.tsx route definition

// Define which roles can access which pages
const ROLE_PAGE_ACCESS = {
  'dashboard': ['admin', 'agent', 'manager', 'video_editor', 'content_creator', ...],
  'leads': ['admin', 'agent', 'manager'],
  'followups': ['admin', 'agent', 'manager'],
  'agent-panel': ['admin', 'agent', 'manager'],
  'quotations': ['admin', 'agent', 'manager'],
  'invoices': ['admin', 'agent', 'manager'],
  'sales-reports': ['admin', 'manager'],
  
  'my-tasks': ['video_editor', 'content_creator', 'social_marketer', ...],
  'admin-tasks': ['admin', 'manager'],
  'notifications': ['*'],  // All roles
  'profile': ['*'],
};

// Protected route component
const ProtectedRoute: React.FC<{ page: string }> = ({ page }) => {
  const { user } = useAuth();
  const allowedRoles = ROLE_PAGE_ACCESS[page];
  
  if (allowedRoles.includes(user.role.slug)) {
    return <PageComponent />;
  }
  
  return <Redirect to="/dashboard" />;
};

// Usage
<ProtectedRoute page="leads" />
<ProtectedRoute page="my-tasks" />
```

## F.3 Backend Route Protection

```typescript
// Enforce authorization on EVERY route

// Example: Only users with 'tasks.view_all' can see all tasks
router.get('/tasks',
  authMiddleware,
  authService.requirePermission('tasks', 'view_all'),
  async (req, res) => {
    const tasks = await taskModel.findAll();
    res.json({ data: tasks });
  }
);

// Example: Only assignee or admin can see specific task
router.get('/tasks/:id',
  authMiddleware,
  async (req, res) => {
    const task = await taskModel.findById(req.params.id);
    
    const canAccess = await authService.canAccessTask(req.user.id, task.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    res.json({ data: task });
  }
);

// Example: Only 'tasks.approve' permission allowed
router.post('/tasks/:id/approve',
  authMiddleware,
  authService.requirePermission('tasks', 'approve'),
  async (req, res) => {
    // Additional validation
    const task = await taskModel.findById(req.params.id);
    if (task.status !== 'submitted') {
      return res.status(400).json({ error: 'Task not in submitted state' });
    }
    
    // Approve
    await taskModel.updateStatus(task.id, 'approved', req.user.id);
    res.json({ data: task });
  }
);
```

---

# G. MIGRATION STRATEGY

## G.1 Phase 1: Create New Role System

### Step 1: Create roles table
```sql
-- Create new roles table
CREATE TABLE roles (...);

-- Seed initial system roles
INSERT INTO roles (name, slug, description, is_system_role) VALUES
  ('Admin', 'admin', 'System administrator', true),
  ('Sales Executive', 'agent', 'Sales executive / CRM agent', true),
  ('Sales Manager', 'manager', 'Sales team manager', true);
```

### Step 2: Create permissions table
```sql
CREATE TABLE permissions (...);
CREATE TABLE role_permissions (...);

-- Seed initial permissions
INSERT INTO permissions (...) VALUES (...);

-- Assign permissions to existing roles
INSERT INTO role_permissions (...) VALUES (...);
```

### Step 3: Migrate users table
```sql
-- Add role_id column
ALTER TABLE users ADD COLUMN role_id UUID;

-- Populate based on existing role
UPDATE users SET role_id = (
  SELECT id FROM roles WHERE slug = users.role
) WHERE users.role IN ('admin', 'agent', 'manager');

-- Remove old role column constraint
ALTER TABLE users DROP COLUMN role;

-- Make role_id NOT NULL and add FK
ALTER TABLE users 
  ALTER COLUMN role_id SET NOT NULL,
  ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id);
```

## G.2 Phase 2: Create Task Tables

```sql
CREATE TABLE tasks (...);
CREATE TABLE task_submissions (...);
CREATE TABLE task_attachments (...);
CREATE TABLE task_comments (...);
CREATE TABLE task_activity_logs (...);
```

## G.3 Data Migration Integrity

**Backward Compatibility Checks**:
```sql
-- Verify all users have valid role_id
SELECT COUNT(*) FROM users WHERE role_id IS NULL;  -- Should be 0

-- Verify role references are valid
SELECT COUNT(*) FROM users u 
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.id = u.role_id);  -- Should be 0

-- Verify admin role exists
SELECT COUNT(*) FROM roles WHERE slug = 'admin';  -- Should be 1
```

---

# H. FILES TO CREATE/MODIFY

## H.1 Backend Files

### CREATE (New Files)

```
backend/src/models/Role.ts
├─ findAll()
├─ findById()
├─ findBySlug()
├─ create()
├─ update()
├─ delete()
└─ isUsed()  -- Check if role has users

backend/src/models/Permission.ts
├─ findAll()
├─ findByResourceAction()
├─ create()
└─ delete()

backend/src/models/RolePermission.ts
├─ assignPermissionToRole()
├─ removePermissionFromRole()
├─ getPermissionsForRole()
└─ getRolesForPermission()

backend/src/models/Task.ts
├─ create()
├─ findById()
├─ findByAssignee()
├─ findByCreator()
├─ findAll()  // with filters
├─ update()
├─ updateStatus()
├─ delete()
├─ getTaskSubmissions()
└─ markOverdue()

backend/src/models/TaskSubmission.ts
├─ create()
├─ findById()
├─ findByTask()
├─ update()
└─ delete()

backend/src/models/TaskComment.ts
├─ create()
├─ findByTask()
├─ delete()
└─ addSystemComment()  -- For activity tracking

backend/src/models/TaskActivityLog.ts
├─ create()
├─ findByTask()
└─ getTimeline()

backend/src/models/TaskAttachment.ts
├─ create()
├─ findById()
├─ findByEntity()
├─ delete()  -- Soft delete
└─ validateFiletype()

backend/src/controllers/tasks-controller.ts
├─ POST /tasks (create)
├─ GET /tasks (list)
├─ GET /tasks/:id (get)
├─ PUT /tasks/:id (update)
├─ POST /tasks/:id/start (start)
├─ POST /tasks/:id/submit (submit)
├─ POST /tasks/:id/approve (approve)
├─ POST /tasks/:id/request-revision (revision)
├─ POST /tasks/:id/cancel (cancel)
├─ DELETE /tasks/:id (delete)
├─ GET /tasks/:id/submissions (get submissions)
├─ POST /tasks/:id/comments (add comment)
├─ GET /tasks/:id/activity (activity log)
└─ POST /tasks/:id/attachments (upload file)

backend/src/controllers/roles-controller.ts (Future admin UI)
├─ GET /roles
├─ POST /roles (create)
├─ PUT /roles/:id (update)
├─ DELETE /roles/:id (delete)
├─ GET /roles/:id/permissions
└─ PUT /roles/:id/permissions (assign)

backend/src/routes/tasks.ts
├─ Route definitions
├─ Middleware guards
└─ Error handlers

backend/src/routes/roles.ts (Future)
├─ Route definitions for role management

backend/src/services/task-service.ts
├─ createTask()
├─ assignTask()
├─ startTask()
├─ submitTask()
├─ approveTask()
├─ requestRevision()
├─ cancelTask()
├─ calculateDeadlineStatus()
└─ validateStatusTransition()

backend/src/services/authorization-service.ts
├─ hasPermission()
├─ requirePermission() -- middleware factory
├─ canAccessTask()
├─ canApproveTask()
├─ canDeleteTask()
├─ canReassignTask()
└─ getPermissionsForUser()

backend/src/utils/file-upload-config.ts
├─ validateTaskAttachmentFile()
├─ generateSafeFilename()
├─ getFileUploadPath()
└─ getFileSizeLimit() -- Per entity type

backend/src/workers/taskOverdueWorker.ts
├─ Check deadlines
├─ Update is_overdue flag
├─ Send notifications

backend/database/migrations/[date]-create-roles-tables.sql
├─ Create roles
├─ Create permissions
├─ Create role_permissions

backend/database/migrations/[date]-migrate-users-to-roles.sql
├─ Add role_id column
├─ Migrate data
├─ Remove old role column

backend/database/migrations/[date]-create-tasks-tables.sql
├─ Create tasks
├─ Create task_submissions
├─ Create task_comments
├─ Create task_attachments
├─ Create task_activity_logs

backend/database/seeds/roles-and-permissions-seed.sql
├─ Insert standard roles
├─ Insert permissions
├─ Assign permissions to roles
```

### MODIFY (Existing Files)

```
backend/src/index.ts
├─ Import tasks router
├─ Import roles router (if needed)
├─ Register routes

backend/src/middleware/auth.ts
├─ Extract role info from JWT
├─ (Keep existing structure compatible)

backend/src/types/index.ts
├─ Add Task interface
├─ Add TaskSubmission interface
├─ Add Role interface
├─ Add Permission interface
├─ Update User interface (role_id instead of role)
├─ Add TaskStatus, TaskPriority types

backend/src/models/User.ts
├─ Update queries to use role_id FK
├─ Update findById to include role

backend/src/controllers/auth-controller.ts
├─ Update login to return role info
├─ Update JWT payload

backend/src/utils/database.ts
├─ (No changes, schema-level)

backend/src/workers/followUpWorker.ts
├─ (No changes, but add reference to taskOverdueWorker)
```

---

## H.2 Frontend Files

### CREATE (New Files)

```
frontend/src/pages/AdminTaskDashboard.tsx
├─ Task list
├─ Filters
├─ Create task button
├─ Stats overview

frontend/src/pages/TeamMemberDashboard.tsx
├─ My tasks
├─ Quick stats
├─ Notifications

frontend/src/pages/MyTasksPage.tsx
├─ My tasks list
├─ Filters
├─ Status view

frontend/src/pages/TaskDetailsPage.tsx
├─ Task details
├─ Countdown timer
├─ Submission form
├─ Comments
├─ Activity timeline

frontend/src/pages/AdminTaskReviewPage.tsx
├─ Pending submissions
├─ Review interface
├─ Approve/revision buttons

frontend/src/components/TaskCard.tsx
├─ Task card display
├─ Priority badge
├─ Deadline countdown
├─ Status badge

frontend/src/components/TaskForm.tsx
├─ Create/edit task form
├─ Assign user
├─ Set deadline
├─ Add description

frontend/src/components/TaskSubmissionForm.tsx
├─ Notes textarea
├─ File upload
├─ Submit button

frontend/src/components/DeadlineCountdown.tsx
├─ Live countdown
├─ Server time sync
├─ Visual states (normal, approaching, urgent, overdue)

frontend/src/components/TaskActivityTimeline.tsx
├─ Activity log display
├─ Status changes
├─ Comments
├─ Revision history

frontend/src/components/RolePermissionManager.tsx (Future Admin UI)
├─ Role list
├─ Permission assignment
├─ Add/edit/delete roles

frontend/src/utils/task-service.ts
├─ API calls
├─ GET /tasks
├─ POST /tasks
├─ POST /tasks/:id/start
├─ POST /tasks/:id/submit
├─ POST /tasks/:id/approve
├─ POST /tasks/:id/request-revision
├─ GET /tasks/:id/submissions

frontend/src/utils/auth-service.ts
├─ Update login to handle role_id
├─ Update role permission checking

frontend/src/types/index.ts
├─ Add Task interface
├─ Add TaskSubmission interface
├─ Add Role interface
├─ Update User interface
```

### MODIFY (Existing Files)

```
frontend/src/pages/App.tsx
├─ Add role-based routing
├─ Add task management pages
├─ Hide sales pages for non-sales users
├─ Add role-based page guards

frontend/src/components/Sidebar.tsx
├─ Conditional navigation based on role
├─ Hide sales items for non-sales
├─ Add task menu for eligible roles
├─ Show/hide admin settings

frontend/src/components/Navbar.tsx
├─ Update notification types (add task notifications)
├─ Filter notifications by type
├─ Add task notification handling

frontend/src/context/auth.tsx
├─ Update user type with role_id
├─ Add permission checking helper
├─ Update login payload parsing

frontend/src/types/index.ts
├─ Update Role type
├─ Update User type
├─ Add Task types
├─ Add Permission types
```

---

## H.3 Database Files

### CREATE (New Files)

```
backend/database/migrations/001-create-roles-system.sql
├─ Create roles table
├─ Create permissions table
├─ Create role_permissions table
├─ Add indexes

backend/database/migrations/002-migrate-users-to-roles.sql
├─ Add role_id to users
├─ Migrate existing roles
├─ Remove role constraint
├─ Add foreign key

backend/database/migrations/003-create-tasks-system.sql
├─ Create tasks
├─ Create task_submissions
├─ Create task_comments
├─ Create task_attachments
├─ Create task_activity_logs
├─ Add indexes

backend/database/seeds/001-initialize-roles.sql
├─ Insert admin, agent, manager roles

backend/database/seeds/002-initialize-permissions.sql
├─ Insert all permissions

backend/database/seeds/003-assign-role-permissions.sql
├─ Assign permissions to roles
```

---

# I. RISKS & BACKWARD COMPATIBILITY

## I.1 Potential Risks

### **Risk 1: User Role Migration**
**Impact**: HIGH  
**Description**: Changing `users.role` VARCHAR to `role_id` UUID could break existing queries/code.

**Mitigation**:
- Create migration in separate transaction
- Backup database before migration
- Test migration on development first
- Update all code references simultaneously
- Verify data integrity after migration

### **Risk 2: Breaking Change for API Clients**
**Impact**: MEDIUM  
**Description**: JWT token structure changes (role → role object with id, name, slug).

**Mitigation**:
- Version API (v2)
- Or provide backward-compatible JWT (include both role string and role object)
- Update frontend to use new structure
- Document breaking changes

### **Risk 3: Permissions Not Initialized**
**Impact**: HIGH  
**Description**: If roles created but permissions not assigned, users lose access.

**Mitigation**:
- Create migration that seeds ALL permissions and role_permissions
- Use database transaction to ensure atomicity
- Verify in post-migration step that all roles have expected permissions

### **Risk 4: File Upload Authorization**
**Impact**: MEDIUM  
**Description**: Existing file upload endpoints might lack proper entity-level authorization.

**Mitigation**:
- Add authorization checks to file download endpoints
- Implement entity-level access control
- Validate user can access parent task/submission

### **Risk 5: Existing Sales Features Break**
**Impact**: CRITICAL  
**Description**: Any mistake in migration could break existing CRM.

**Mitigation**:
- Keep sales executive (agent) role name and slug unchanged
- Maintain all existing permission sets
- Test full sales workflow before deployment
- Keep rollback plan ready

---

## I.2 Backward Compatibility Strategy

### **What Stays The Same**
```
✅ JWT token still contains user.id, user.email, user.name
✅ Login endpoint unchanged (/auth/login)
✅ Existing leads, follow-ups, payments, etc. untouched
✅ Sales Executive CRM fully functional
✅ All existing API responses (unless explicitly updated)
✅ Database structure (only additions, no deletions)
✅ File upload infrastructure (multer, storage)
✅ Notification system table (only adds new type values)
```

### **What Changes**
```
JWT Token:
OLD: { id, email, name, role: "agent" }
NEW: { id, email, name, role_id: "uuid", role: { id, name, slug } }
     (Or keep old format for compat)

User Model:
OLD: users.role VARCHAR
NEW: users.role_id UUID → roles.id

API Responses:
OLD: { user: { role: "agent" } }
NEW: { user: { role_id: "uuid", role: { name: "Sales Executive", slug: "agent" } } }
     (Or provide both)
```

### **Deployment Strategy**
```
1. Create and test migration on dev environment
2. Backup production database
3. Run migrations in transaction
4. Deploy backend code (new auth service, new routes)
5. Deploy frontend code (updated role handling)
6. Smoke test sales workflow
7. Smoke test task system
8. Monitor for errors
9. Keep rollback ready for 24 hours
```

---

## I.3 Rollback Plan

```sql
-- If critical issue, revert users table:
ALTER TABLE users ADD COLUMN role VARCHAR(50);

UPDATE users SET role = r.slug
FROM roles r WHERE users.role_id = r.id;

ALTER TABLE users DROP COLUMN role_id;

-- Keep roles/permissions tables (no harm if present)
-- Redeploy old backend code
```

---

# J. PHASE 2 IMPLEMENTATION STEPS

## J.1 Pre-Implementation Checklist

- [ ] Production database backup created
- [ ] Development environment ready
- [ ] Feature branch created (`feature/task-management`)
- [ ] Team notified of deployment plan
- [ ] Rollback plan documented
- [ ] Testing environment setup

---

## J.2 Phase 2: Database & Schema (EXACT STEPS)

### Step 1: Create Migration Files

**File**: `backend/database/migrations/2026-08-12-001-create-roles-system.sql`
```sql
-- Create roles table
-- Create permissions table
-- Create role_permissions table
-- Add indexes
-- (FULL SQL PROVIDED IN SEPARATE DOCUMENT)
```

**File**: `backend/database/migrations/2026-08-12-002-migrate-users-to-roles.sql`
```sql
-- Add role_id column to users
-- Populate role_id from existing role strings
-- Verify data integrity
-- Remove old role column and constraint
-- Add foreign key constraint
-- (FULL SQL PROVIDED IN SEPARATE DOCUMENT)
```

**File**: `backend/database/migrations/2026-08-12-003-create-tasks-system.sql`
```sql
-- Create tasks table
-- Create task_submissions table
-- Create task_comments table
-- Create task_attachments table
-- Create task_activity_logs table
-- Add all indexes and constraints
-- (FULL SQL PROVIDED IN SEPARATE DOCUMENT)
```

### Step 2: Create Seed Files

**File**: `backend/database/seeds/2026-08-12-001-initialize-roles.sql`
```sql
-- INSERT INTO roles VALUES (...)
-- Seed: Admin, Sales Executive (agent), Sales Manager
```

**File**: `backend/database/seeds/2026-08-12-002-initialize-permissions.sql`
```sql
-- INSERT INTO permissions VALUES (...)
-- All task, lead, quotation, invoice, report permissions
```

**File**: `backend/database/seeds/2026-08-12-003-assign-role-permissions.sql`
```sql
-- INSERT INTO role_permissions VALUES (...)
-- Assign permissions to each role
-- Ensure admin has ALL permissions
-- Ensure agent/manager have sales permissions
-- (Non-sales roles have NO permissions initially)
```

### Step 3: Create TypeScript Type Definitions

**File**: `backend/src/types/index.ts` (ADD)
```typescript
// Add new types:
export type UserRole = 'admin' | 'agent' | 'manager' | ...;  // Deprecated, for compat

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  display_name: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role_id: string;           // NEW
  role?: Role;               // OPTIONAL (populated by JOIN)
  is_active: boolean;
  avatar_url?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'assigned' | 'in_progress' | 'submitted' | 'revision_requested' | 'approved' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';

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
  cancellation_reason?: string;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

// ... more interfaces
```

### Step 4: Create Model Classes

**File**: `backend/src/models/Role.ts`
```typescript
import { query } from '../utils/database';
import type { Role } from '../types';

export const roleModel = {
  async findAll(onlyActive = true) {
    const sql = `SELECT * FROM roles ${onlyActive ? 'WHERE is_active = true' : ''} ORDER BY name`;
    const result = await query(sql);
    return result.rows as Role[];
  },
  
  async findById(id: string) {
    const result = await query('SELECT * FROM roles WHERE id = $1', [id]);
    return result.rows[0] as Role | undefined;
  },
  
  async findBySlug(slug: string) {
    const result = await query('SELECT * FROM roles WHERE slug = $1', [slug]);
    return result.rows[0] as Role | undefined;
  },
  
  // ... more methods
};
```

### Step 5: Execute Migration

```bash
# In terminal:
cd backend

# Run migration (exact command depends on your setup)
npm run migrate

# Or manually:
psql -U user -d database -f database/migrations/2026-08-12-001-create-roles-system.sql
psql -U user -d database -f database/migrations/2026-08-12-002-migrate-users-to-roles.sql
psql -U user -d database -f database/migrations/2026-08-12-003-create-tasks-system.sql

# Seed data
psql -U user -d database -f database/seeds/2026-08-12-001-initialize-roles.sql
psql -U user -d database -f database/seeds/2026-08-12-002-initialize-permissions.sql
psql -U user -d database -f database/seeds/2026-08-12-003-assign-role-permissions.sql
```

### Step 6: Verify Migration

```sql
-- Run these checks:
SELECT COUNT(*) FROM roles;  -- Should be 3+ (admin, agent, manager)
SELECT COUNT(*) FROM permissions;  -- Should be 15+
SELECT COUNT(*) FROM role_permissions;  -- Should be 30+
SELECT COUNT(*) FROM users WHERE role_id IS NULL;  -- Should be 0
SELECT COUNT(*) FROM tasks;  -- Should be 0 (new table)
```

### Step 7: Update Backend Code References

**File**: `backend/src/models/User.ts`
```typescript
// Update queries to use role_id and JOIN with roles
async findById(id: string) {
  const result = await query(`
    SELECT u.*, r.id as role_id, r.name, r.slug
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = $1
  `, [id]);
  return result.rows[0];
}
```

---

## J.3 Phase 2 Deliverables

When Phase 2 is complete, you should have:

✅ **Database**:
- 5 new tables (roles, permissions, role_permissions, tasks, task_submissions, task_comments, task_attachments, task_activity_logs)
- All migrations applied
- All seed data populated
- No data loss
- Backward compatible schema

✅ **Backend Models**:
- Role.ts
- Permission.ts
- RolePermission.ts
- Task.ts
- TaskSubmission.ts
- TaskComment.ts
- TaskActivityLog.ts
- TaskAttachment.ts

✅ **TypeScript Types**:
- All new interfaces defined
- User type updated
- No compilation errors

✅ **Tests Passing**:
- Database connection verified
- All migrations reversible
- Data integrity checks pass
- Existing user queries still work

✅ **Documentation**:
- Schema diagram
- Migration guide
- Rollback procedure

---

# SUMMARY: APPROVAL NEEDED

## What I've Created:

✅ **A. Revised Architecture** - Dynamic roles, RBAC, scalable design  
✅ **B. Complete Database Schema** - 10 tables with proper relationships  
✅ **C. Relationship Diagram** - Visual ERD  
✅ **D. Permission Model** - Centralized RBAC system  
✅ **E. Task Lifecycle** - State machine with overdue handling  
✅ **F. UI Separation** - Role-based navigation  
✅ **G. Migration Strategy** - Safe, reversible migrations  
✅ **H. Files to Create/Modify** - Complete inventory  
✅ **I. Risks & Mitigation** - All risks documented  
✅ **J. Phase 2 Implementation** - Step-by-step guide  

---

## Questions for You:

**Before I proceed to Phase 2, please confirm:**

1. ✅ **Does the revised architecture meet your requirements?**
   - Dynamic roles (not hardcoded)?
   - RBAC with permissions table?
   - Backward compatible with existing sales system?
   - Scalable for future additions?

2. ✅ **Do you approve the database schema?**
   - 10 tables sufficient?
   - Relationships correct?
   - Overdue handling as condition (not state)?
   - Polymorphic attachments okay?

3. ✅ **Permission model clear?**
   - Resource + Action approach good?
   - Role_permissions mapping appropriate?
   - Authorization service correctly designed?

4. ✅ **Task lifecycle acceptable?**
   - 6 states vs 7? (No overdue state, just condition)
   - Valid transitions correct?
   - Employee can still submit when overdue?

5. ✅ **UI Separation acceptable?**
   - Sales users keep existing CRM?
   - Non-sales users get clean separate dashboard?
   - Backend enforcement via permissions?

6. ✅ **Any changes to the plan before Phase 2?**
   - Different table names?
   - Different permission resource/action scheme?
   - Different role management approach?

---

## Next: Phase 2

Once you approve this architecture, I will proceed with **PHASE 2: DATABASE SCHEMA & MIGRATION**

I will provide:
1. Complete SQL migration files
2. Seed data scripts
3. TypeScript model classes
4. Authorization service skeleton
5. Migration verification checklist
6. Rollback procedures

**Please review and confirm. DO NOT approve yet if you have changes.**
