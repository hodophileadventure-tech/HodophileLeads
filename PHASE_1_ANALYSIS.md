# PHASE 1: COMPREHENSIVE CODEBASE ANALYSIS
## Lead Manager Application at https://www.leadmanagerhodophile.nl/

Generated: 2026-08-12

---

## 1. CURRENT ARCHITECTURE OVERVIEW

### 1.1 Technology Stack
- **Frontend**: React 18+ (TypeScript, Vite)
- **Backend**: Node.js/Express (TypeScript)
- **Database**: PostgreSQL
- **Authentication**: JWT tokens
- **File Upload**: Multer (disk-based storage)
- **Styling**: Tailwind CSS
- **WebSocket**: ws (for real-time updates)

### 1.2 Project Structure
```
backend/src/
├── controllers/         (Business logic handlers)
├── middleware/          (Auth, error handling)
├── models/              (Database queries)
├── routes/              (API endpoint definitions)
├── services/            (Utility services)
├── types/               (TypeScript interfaces)
├── utils/               (Helper functions)
├── workers/             (Background jobs: follow-up, reports, outbox)
└── index.ts            (Express server entry point)

frontend/src/
├── pages/               (Main page components)
├── components/          (Reusable UI components)
├── context/             (Auth context, Zustand stores)
├── utils/               (API services, helpers)
└── types/               (TypeScript types)
```

---

## 2. EXISTING USER ROLES & PERMISSIONS

### 2.1 Current Roles (database: users.role)
```typescript
type UserRole = 'admin' | 'agent' | 'manager';

// Constraints in schema:
CONSTRAINT valid_role CHECK (role IN ('admin', 'agent', 'manager'))
```

### 2.2 Current Authorization Strategy
- **Implementation**: `roleMiddleware(allowedRoles: string[])` in `backend/src/middleware/auth.ts`
- **Pattern**: Backend routes use `roleMiddleware(['admin', 'manager'])` to restrict access
- **Frontend**: Navigation items conditionally shown based on user role
- **Weakness**: Frontend-only hiding without consistent backend authorization on all endpoints

### 2.3 Current Permission Matrix

| Feature | Admin | Manager | Agent |
|---------|-------|---------|-------|
| View Leads | ✅ | ✅ | ✅ (own) |
| Edit Leads | ✅ | ✅ | ✅ (own) |
| Create Tasks/Follow-ups | ✅ | ✅ | ✅ (own) |
| View Reports | ✅ | ✅ | ❌ |
| Admin Panel | ✅ | ✅ | ❌ |
| Transfer Leads | ✅ | ❌ | ❌ |
| Quote Approval | ✅ (final) | ✅ (review) | ❌ |

---

## 3. EXISTING AUTHENTICATION SYSTEM

### 3.1 Authentication Flow
```typescript
// middleware/auth.ts
export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json(...);
  req.user = decoded; // { id, email, name, role }
  next();
};
```

### 3.2 Token Structure
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "role": "admin|agent|manager"
}
```

### 3.3 Existing Endpoints
- `POST /auth/login` - Login with email/password
- `POST /auth/logout` - Logout
- `POST /auth/register` - Register (if enabled)
- All other endpoints require `authMiddleware`

---

## 4. EXISTING DATABASE STRUCTURE

### 4.1 Key Tables
```sql
users
├── id (UUID)
├── email (UNIQUE)
├── password (hashed)
├── role (admin|agent|manager)
├── avatar_url
├── last_login_at
└── created_at

leads
├── id (UUID)
├── client_name
├── phone
├── destination
├── travel_dates
├── budget
├── agent_id (FK → users.id)
├── status
├── temperature
└── ...

follow_ups
├── id (UUID)
├── lead_id (FK → leads.id)
├── title
├── description
├── due_date
├── status (overdue|today|upcoming|completed|canceled)
├── priority (low|medium|high)
├── assigned_to (FK → users.id)
├── created_by (FK → users.id)
├── completed_at
└── created_at

notifications
├── id (UUID)
├── user_id (FK → users.id)
├── lead_id (FK → leads.id, optional)
├── type
├── message
├── payload (JSONB)
├── is_read
└── created_at

attachments
├── id (UUID)
├── lead_id (FK → leads.id)
├── file_name
├── mime_type
├── url
├── size
├── uploaded_by (FK → users.id)
└── created_at

audit_logs
├── id (UUID)
├── entity_type
├── entity_id
├── action
├── changes (JSONB)
├── user_id (FK → users.id)
└── created_at
```

### 4.2 Key Observations
- **Foreign Keys**: Properly configured with ON DELETE CASCADE
- **Indexes**: Existing on frequently queried columns (agent_id, status, due_date)
- **Data Integrity**: Uses UUID primary keys, JSONB for flexible data
- **Audit Trail**: Existing audit_logs table for tracking changes
- **Attachments**: Already supports file storage tied to leads

---

## 5. EXISTING NOTIFICATION SYSTEM

### 5.1 Current Implementation
- **Table**: `notifications` (user_id, lead_id, type, message, payload, is_read)
- **API Endpoints**:
  - `GET /notifications` - List user's notifications
  - `PUT /notifications/:id/read` - Mark as read
  - `PUT /notifications/read-all` - Mark all as read
- **Frontend Integration**: Navbar displays notification bell with unread count
- **Refresh Rate**: Polls every 30 seconds from frontend
- **Real-time**: WebSocket support exists but primarily used for follow-ups/reports

### 5.2 Existing Notification Types
- Lead-related notifications
- Follow-up reminders
- System messages

---

## 6. EXISTING FILE UPLOAD SYSTEM

### 6.1 Implementation Details
- **Handler**: Multer (disk storage)
- **Paths**: `/uploads/issues`, `/uploads/screen-captures`, `/uploads/attachments`
- **Upload Flow**:
  ```typescript
  // Middleware configuration in routes/admin.ts
  const issueStorage = multer.diskStorage({
    destination: () => path.join(__dirname, '...', 'uploads', 'issues'),
    filename: () => `${Date.now()}-${safeName}`
  });
  
  const issueUpload = multer({
    storage: issueStorage,
    limits: { fileSize: 6 * 1024 * 1024 },  // 6 MB
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      cb(null, allowed.includes(file.mimetype));
    }
  });
  ```

### 6.2 Database Integration
- Files stored in `attachments` table with URL, size, mime type
- URL is relative path for serving static files
- No authorization check on file downloads currently

### 6.3 Limitations
- Only image files allowed for issues
- File type validation is basic
- No per-entity fine-grained permissions on file downloads

---

## 7. EXISTING FRONTEND COMPONENTS & NAVIGATION

### 7.1 Current Navigation Structure
```typescript
// App.tsx - Main page types
type Page = 
  | 'dashboard'
  | 'leads'
  | 'followups'
  | 'analytics'
  | 'agent'
  | 'quoteinvoice'
  | 'pending-quotes'
  | 'pending-invoices'
  | 'quotation-approvals'
  | 'report-issue'
  | 'daily-reports'
  | 'dev-panel'
  | 'manager-quotations'
  | 'hotels'
  | 'itineraries'
  | 'quick-summary'
  | 'lead-transfer'
  | 'created-quotations';
```

### 7.2 Current UI Components
- **Dashboard**: Overview page
- **LeadsPage**: Full lead management interface
- **AgentPanel**: Sales performance & lead tracking
- **AnalyticsDashboard**: Metrics and KPIs
- **TaskDashboard**: Follow-up tasks display
- **Navbar**: Top navigation with notifications
- **Sidebar**: Left navigation menu
- **PaymentsPanel**: Payment tracking for leads
- **QuoteInvoicePage**: Quote and invoice generation

### 7.3 Component Architecture
- Uses Zustand for state management (useUIStore, useDataStore)
- React Context for authentication (useAuth hook)
- API services abstracted in utils/api-service.ts
- Responsive design (Tailwind CSS)

---

## 8. EXISTING API ROUTES & PATTERNS

### 8.1 Route Structure
```
/auth              - Authentication (login, register, logout)
/leads             - Lead CRUD operations
/leads/:id/...     - Lead-specific endpoints (payments, itineraries)
/followups         - Follow-up CRUD and management
/notifications     - Notification list and mark-read
/admin/...         - Admin-only operations
/dashboard         - Dashboard stats
/hotels            - Hotel management
/payments          - Payment tracking
/quote-requests    - Quote/invoice workflow
/reports           - Daily reports
/availability      - Triple-lock availability checks
/itineraries       - Itinerary management
```

### 8.2 API Pattern
```typescript
// Typical controller pattern
export const leadsController = {
  async getAll(req: AuthenticatedRequest, res: Response) {
    const leads = await leadsModel.findAll(req.user.id);
    res.json({ data: leads });
  }
};

// Typical route pattern
leadsRouter.get('/', authMiddleware, leadsController.getAll);
leadsRouter.post('/', authMiddleware, roleMiddleware(['admin', 'agent']), leadsController.create);
```

### 8.3 Authorization Pattern
- **Implemented**: Role-based checks on routes
- **Missing**: Consistent entity-level authorization (e.g., can agent edit only their own leads?)
- **Issue**: Some endpoints lack proper authorization (file downloads)

---

## 9. EXISTING FOLLOW-UP SYSTEM (REFERENCE)

### 9.1 Follow-ups Schema
```sql
follow_ups (
  id UUID,
  lead_id UUID NOT NULL,
  type VARCHAR (manual|auto),
  title VARCHAR,
  description TEXT,
  due_date TIMESTAMP,
  status VARCHAR (overdue|today|upcoming|completed|canceled),
  priority VARCHAR (low|medium|high),
  assigned_to UUID,
  created_by UUID,
  completed_at TIMESTAMP,
  canceled_reason TEXT,
  canceled_by UUID,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP
)
```

### 9.2 Follow-up Features
- ✅ Multiple status types
- ✅ Priority levels
- ✅ Assignment to users
- ✅ Completion tracking with timestamp
- ✅ Cancellation with reason tracking
- ✅ Activity audit trail via audit_logs
- ✅ Background worker that handles overdue detection

### 9.3 Key Insight
**The follow-ups system is well-designed and can serve as a template for the new task management system.**

---

## 10. EXISTING WORKERS & BACKGROUND JOBS

### 10.1 Current Workers
```
followUpWorker    - Processes follow-up reminders/status updates
reportWorker      - Generates daily reports
outboxWorker      - Handles reliable event delivery
```

### 10.2 Relevant Pattern
```typescript
// Example from followUpWorker
export const startFollowUpWorker = () => {
  setInterval(async () => {
    // Update overdue follow-ups
    // Send notifications
  }, 60000);
};
```

---

## 11. EXISTING MIDDLEWARE & SERVICES

### 11.1 Middleware Stack
- `authMiddleware` - Verifies JWT token
- `roleMiddleware(roles)` - Checks user role
- `validateUserExists` - Ensures user still exists in DB
- `errorHandler` - Global error handling

### 11.2 Utility Services
- `auth.ts` - Token generation/verification
- `database.ts` - Database connection pool
- `wsServer.ts` - WebSocket server for real-time updates
- `export-date-range.ts` - Query filtering utilities

---

## 12. FRONTEND STATE MANAGEMENT

### 12.1 Zustand Stores
```typescript
useUIStore
├── sidebarOpen
├── darkMode
├── selectedLead
└── toggleSidebar(), toggleDarkMode()

useDataStore
├── leads
├── followUps
├── itineraries
├── payments
├── notifications
└── setLeads(), updateLead(), etc.
```

### 12.2 Context
- **AuthContext**: Provides `user`, `login()`, `logout()`
- No role-based UI routing middleware currently

---

## 13. AREAS OF CONCERN & GAPS

### 13.1 Critical Issues
1. **No entity-level authorization** - A user can potentially access/modify data not assigned to them
2. **Frontend-only role checking** - Direct API calls to `/leads` from a content creator would fail gracefully, but no explicit API-level denial
3. **No multi-role support** - Users have exactly ONE role, can't be "admin + content creator"
4. **No permission model** - Roles are hardcoded; new roles require schema migration

### 13.2 Existing Patterns I Can Leverage
- ✅ Notification system foundation
- ✅ File upload infrastructure
- ✅ Middleware & authorization patterns
- ✅ Background workers
- ✅ Database structure conventions
- ✅ API response patterns
- ✅ Frontend component patterns

---

## 14. PROPOSED ROLE EXPANSION

### 14.1 New Roles to Add
```sql
ALTER TABLE users DROP CONSTRAINT valid_role;
ALTER TABLE users ADD CONSTRAINT valid_role CHECK (
  role IN (
    'admin',           -- System administrator
    'agent',           -- Sales executive (keep existing)
    'manager',         -- Sales manager (keep existing)
    'content_creator', -- Create marketing content
    'video_editor',    -- Edit videos
    'graphic_designer',-- Design graphics
    'social_marketer', -- Social media marketing
    'operations',      -- Operations team
    'hr_admin',        -- HR administration
    'tour_manager'     -- Manage tours
  )
);
```

### 14.2 Scalable Permission Architecture
Instead of hardcoding role checks, introduce a `permissions` table:
```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  role VARCHAR,
  resource VARCHAR,      -- 'leads', 'tasks', 'reports', etc.
  action VARCHAR,        -- 'create', 'read', 'update', 'delete', 'approve'
  UNIQUE(role, resource, action)
);

-- Examples:
(admin, tasks, create)
(admin, tasks, approve)
(content_creator, tasks, view)
(content_creator, tasks, submit)
(video_editor, tasks, start)
(video_editor, tasks, submit)
```

---

## 15. IMPLEMENTATION STRATEGY

### 15.1 Phase Breakdown

**PHASE 1**: Analysis (COMPLETE ✅)

**PHASE 2**: Database Schema
- Add new `tasks` table
- Add `task_submissions` table
- Add `task_comments` table
- Add `task_activity_logs` table
- Add migration script
- ✅ Extend users.role constraint
- ✅ (Optional) Create permissions table

**PHASE 3**: Backend - Models & Services
- Create Task model (CRUD operations)
- Create TaskSubmission model
- Create TaskComment model
- Implement authorization service
- Implement deadline calculation service

**PHASE 4**: Backend - API Routes & Controllers
- `POST /tasks` - Create task
- `GET /tasks` - List tasks (with authorization)
- `GET /tasks/:id` - Get task details
- `POST /tasks/:id/start` - Start task
- `POST /tasks/:id/submit` - Submit task
- `POST /tasks/:id/approve` - Approve task
- `POST /tasks/:id/request-revision` - Request revision
- `POST /tasks/:id/comments` - Add comment
- Implement full authorization checks on ALL endpoints

**PHASE 5**: Frontend - Admin Task Management
- Admin Task Dashboard
- Create Task Form
- Task List with Filters
- Pending Submissions Review Panel

**PHASE 6**: Frontend - Non-Sales Employee Dashboard
- New role-based routing (redirect to team dashboard if not sales)
- Team Member Dashboard
- My Tasks Page
- Task Details View with countdown timer
- Submission Form

**PHASE 7**: Notifications & Real-time
- Extend notification types (task_assigned, revision_requested, etc.)
- Update Navbar to show task notifications
- WebSocket integration for real-time updates

**PHASE 8**: Activity History & Comments
- Activity timeline display
- Comment system
- Revision history tracking

**PHASE 9**: Testing & Refinement
- End-to-end workflow testing
- Authorization testing
- UI/UX refinement

---

## 16. FILES TO MODIFY/CREATE

### 16.1 Database Files
```
✅ CREATE: database/migrations/[date]-create-tasks-tables.sql
```

### 16.2 Backend Files
```
📝 MODIFY: backend/src/types/index.ts
   - Add new role types
   - Add Task interfaces
   - Add TaskSubmission interfaces

✅ CREATE: backend/src/models/Task.ts
✅ CREATE: backend/src/models/TaskSubmission.ts
✅ CREATE: backend/src/models/TaskComment.ts
✅ CREATE: backend/src/models/TaskActivityLog.ts

✅ CREATE: backend/src/controllers/tasks-controller.ts
✅ CREATE: backend/src/routes/tasks.ts

📝 MODIFY: backend/src/index.ts
   - Import tasks router
   - Register tasks router

📝 MODIFY: backend/src/middleware/auth.ts
   - Add authorization service
   - Add permission checking middleware (optional for phase 2)

✅ CREATE: backend/src/utils/authorization.ts
   - Centralized permission checking
   - Role-based access control helpers

✅ CREATE: backend/src/services/task-service.ts
   - Business logic for task operations
   - Deadline calculations
   - Status transitions
```

### 16.3 Frontend Files
```
📝 MODIFY: frontend/src/types/index.ts
   - Add Task interface
   - Add TaskSubmission interface
   - Add new role types

📝 MODIFY: frontend/src/pages/App.tsx
   - Add role-based routing
   - Add team member dashboard pages
   - Adjust navigation based on role

✅ CREATE: frontend/src/pages/AdminTaskDashboard.tsx
✅ CREATE: frontend/src/pages/TeamMemberDashboard.tsx
✅ CREATE: frontend/src/pages/MyTasksPage.tsx
✅ CREATE: frontend/src/pages/TaskDetailsPage.tsx

✅ CREATE: frontend/src/components/TaskCard.tsx
✅ CREATE: frontend/src/components/TaskForm.tsx
✅ CREATE: frontend/src/components/TaskSubmissionForm.tsx
✅ CREATE: frontend/src/components/TaskActivityTimeline.tsx
✅ CREATE: frontend/src/components/DeadlineCountdown.tsx

📝 MODIFY: frontend/src/components/Navbar.tsx
   - Update notification types
   - Add task-specific notifications

📝 MODIFY: frontend/src/components/Sidebar.tsx
   - Conditional navigation based on role
   - Hide sales items for non-sales users

✅ CREATE: frontend/src/utils/task-service.ts
   - API calls for task operations
```

### 16.4 Other Files
```
📝 MODIFY: backend/src/workers/followUpWorker.ts (if needed)
   - Add task deadline checking if similar pattern desired

📝 MODIFY: README.md
   - Document new features
   - Add setup instructions for new roles
```

---

## 17. MIGRATION CONSIDERATIONS

### 17.1 Database Migration
- Use transactional migrations to ensure atomicity
- Create backup before migration
- Test on development environment first
- No data loss expected (pure additions)

### 17.2 User Data Migration
- Existing users keep 'admin' or 'agent' or 'manager' roles
- New team members assigned appropriate roles during creation
- No existing role changes needed

### 17.3 Backwards Compatibility
- ✅ Existing Sales Executive flow unchanged
- ✅ All current URLs/APIs remain functional
- ✅ No breaking changes to existing API responses
- ✅ Existing leads, follow-ups, payments all continue working

---

## 18. TESTING STRATEGY

### 18.1 Unit Tests
- Task model CRUD operations
- Authorization checks
- Deadline calculations
- Status transition validations

### 18.2 Integration Tests
- Full task workflow (create → assign → start → submit → approve)
- Revision workflow
- Authorization enforcement
- Notification triggering

### 18.3 E2E Tests
- Admin creates task → Employee receives notification → Employee completes task → Admin approves
- Permission testing (content creator cannot access sales leads)
- Role-based UI visibility

---

## 19. SECURITY CONSIDERATIONS

### 19.1 Authorization
- ✅ Server-side authorization on ALL endpoints
- ✅ Entity-level checks (user can only see own tasks)
- ✅ Role-based checks before operations
- ✅ Audit logging of all task operations

### 19.2 File Uploads
- ✅ Validate file types
- ✅ Limit file size (suggest 50 MB for task submissions)
- ✅ Generate unique filenames to prevent collisions
- ✅ Prevent path traversal attacks
- ✅ Check authorization before serving files

### 19.3 Data Isolation
- ✅ Content creator cannot access leads/follow-ups (backend enforced)
- ✅ Employees cannot see other employees' private tasks
- ✅ Only assigned employees can submit tasks

---

## 20. DEPLOYMENT CHECKLIST

- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] Backend restarted
- [ ] Frontend rebuilt
- [ ] Smoke tests passed
- [ ] Admin dashboard tested
- [ ] Team member dashboard tested
- [ ] Notification system tested
- [ ] File upload tested
- [ ] Authorization tested (attempt to access unauthorized endpoints)
- [ ] Existing CRM features verified still working
- [ ] Backup taken before deployment

---

## SUMMARY: WHAT WE FOUND

### ✅ Existing Infrastructure Ready to Use
1. JWT-based authentication system
2. Role middleware for authorization
3. PostgreSQL database with proper structure
4. Multer file upload capability
5. Notification system foundation
6. Background workers pattern
7. Audit logging support
8. Well-organized frontend components

### ⚠️ Gaps to Address
1. Multi-role not supported yet (need role extension)
2. Entity-level authorization incomplete
3. Some API endpoints lack proper authorization checks
4. No scalable permission model (hardcoded role checks)

### 🚀 Ready to Proceed to PHASE 2

---

## NEXT STEPS

I am ready to proceed with:

**PHASE 2: DATABASE SCHEMA & MIGRATION**

Once you confirm, I will:

1. Create the SQL migration file with:
   - `tasks` table
   - `task_submissions` table
   - `task_comments` table
   - `task_activity_logs` table
   - Proper foreign keys and indexes
   - Updated `users.role` constraint

2. Create TypeScript type definitions

3. Provide the complete schema diagram

**DO YOU WANT TO PROCEED WITH PHASE 2?**

Or would you like me to make any adjustments to the analysis?
