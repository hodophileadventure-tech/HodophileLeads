# Admin Role & User Management System

## Overview

This document describes the complete admin system for managing roles, users, and permissions in TripNexus.

## Features

### ✅ Admin Can Create Custom Roles

Create specialized roles with custom names and permissions:

```typescript
// Create Video Editor role
POST /api/admin/roles
{
  "name": "Video Editor",
  "slug": "video_editor",
  "description": "Professional video editor with editing tools access",
  "permissions": [/* permission IDs */]
}

// Create Content Creator role
POST /api/admin/roles
{
  "name": "Content Creator",
  "slug": "content_creator",
  "description": "Content creation specialist",
  "permissions": [/* permission IDs */]
}
```

### ✅ Custom Roles Get Different UIs

Each role receives a completely different interface:

| Role | UI Theme | Color | Features |
|------|----------|-------|----------|
| **Sales Agent** | Sales CRM | Blue | Leads, Tasks, Quotes, Follow-ups |
| **Sales Manager** | Sales CRM (Enhanced) | Green | Team management, Reports, Approvals |
| **Video Editor** | Editor Suite | Dark Red | Video editing, Projects, Export |
| **Content Creator** | Content Studio | Dark Amber | Content management, Media library |
| **Admin** | Admin Panel | Purple | System management, User management |

### ✅ Admin Creates Users & Assigns Roles

```typescript
// Create user as Video Editor
POST /api/admin/users
{
  "email": "john.smith@studio.com",
  "name": "John Smith",
  "password": "SecurePass123!",
  "roleId": "<video-editor-role-id>"
}
```

## API Endpoints

### Role Management

#### Create Role
```
POST /api/admin/roles
Authorization: Bearer <admin-token>

Body: {
  "name": string,           // Role display name
  "slug": string,           // Unique identifier (lowercase, underscores)
  "description": string,    // Optional description
  "permissions": string[]   // Optional permission IDs
}

Response: 201 Created
{
  "success": true,
  "role": {
    "id": "uuid",
    "name": "Video Editor",
    "slug": "video_editor",
    "description": "..."
  }
}
```

#### List All Roles
```
GET /api/admin/roles
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "success": true,
  "roles": [
    {
      "id": "uuid",
      "name": "Video Editor",
      "slug": "video_editor",
      "is_system_role": false,
      "permission_count": 12
    },
    ...
  ]
}
```

#### Get Role Details
```
GET /api/admin/roles/:id
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "success": true,
  "role": {
    "id": "uuid",
    "name": "Video Editor",
    "slug": "video_editor",
    ...
  },
  "permissions": [
    {
      "id": "uuid",
      "resource": "tasks",
      "action": "create",
      "display_name": "Create Task"
    },
    ...
  ]
}
```

#### Update Role
```
PUT /api/admin/roles/:id
Authorization: Bearer <admin-token>

Body: {
  "name": string,           // Optional
  "description": string,    // Optional
  "permissions": string[]   // Optional - replaces existing
}

Response: 200 OK
{
  "success": true,
  "message": "Role updated successfully"
}
```

#### Delete Role
```
DELETE /api/admin/roles/:id
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "success": true,
  "message": "Role deleted successfully"
}

Errors:
- 403: Cannot delete system roles
- 409: Cannot delete role with assigned users
```

### User Management

#### Create User
```
POST /api/admin/users
Authorization: Bearer <admin-token>

Body: {
  "email": string,        // Unique email
  "name": string,         // User name
  "password": string,     // Initial password
  "roleId": string        // Role UUID
}

Response: 201 Created
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "john.smith@studio.com",
    "name": "John Smith",
    "role_id": "uuid"
  }
}
```

#### List All Users
```
GET /api/admin/users
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "success": true,
  "users": [
    {
      "id": "uuid",
      "email": "john.smith@studio.com",
      "name": "John Smith",
      "role_name": "Video Editor",
      "role_slug": "video_editor",
      "created_at": "2026-08-13T..."
    },
    ...
  ]
}
```

#### Get User Details
```
GET /api/admin/users/:id
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "john.smith@studio.com",
    "name": "John Smith",
    "role_name": "Video Editor",
    "role_slug": "video_editor",
    "permissions": [
      {
        "id": "uuid",
        "resource": "tasks",
        "action": "view",
        "display_name": "View Tasks"
      },
      ...
    ]
  }
}
```

#### Update User
```
PUT /api/admin/users/:id
Authorization: Bearer <admin-token>

Body: {
  "name": string,         // Optional
  "email": string,        // Optional
  "roleId": string        // Optional - change role
}

Response: 200 OK
{
  "success": true,
  "message": "User updated successfully"
}
```

#### Delete User
```
DELETE /api/admin/users/:id
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "success": true,
  "message": "User deleted successfully"
}

Error:
- 403: Cannot delete your own account
```

#### Assign Role to User
```
POST /api/admin/users/:id/assign-role
Authorization: Bearer <admin-token>

Body: {
  "roleId": string        // Role UUID
}

Response: 200 OK
{
  "success": true,
  "message": "Role assigned successfully"
}
```

### Permission Management

#### List All Permissions
```
GET /api/admin/permissions
Authorization: Bearer <admin-token>

Response: 200 OK
{
  "success": true,
  "permissions": [
    {
      "id": "uuid",
      "resource": "tasks",
      "action": "view",
      "display_name": "View Tasks",
      "description": "Can view assigned tasks"
    },
    {
      "id": "uuid",
      "resource": "tasks",
      "action": "create",
      "display_name": "Create Task",
      "description": "Can create new tasks"
    },
    ...
  ]
}
```

#### Assign Permissions to Role
```
POST /api/admin/roles/:roleId/permissions
Authorization: Bearer <admin-token>

Body: {
  "permissionIds": [
    "uuid1",
    "uuid2",
    ...
  ]
}

Response: 200 OK
{
  "success": true,
  "message": "Permissions assigned successfully"
}
```

## Role-Based UI Routing

### Configuration File
`backend/src/config/role-based-ui.ts` defines different UI layouts for each role:

```typescript
export function getRoleUIConfig(roleSlug: string): UIConfig {
  const ROLE_UI_MAP = {
    admin: ADMIN_UI,
    'sales executive': SALES_AGENT_UI,
    'video_editor': VIDEO_EDITOR_UI,
    'content_creator': CONTENT_CREATOR_UI,
    ...
  };
  return ROLE_UI_MAP[roleSlug] || SALES_AGENT_UI;
}
```

### Frontend Component Usage

```typescript
import { RoleBasedLayout } from './components/RoleBasedLayout';

function App() {
  const { user } = useAuth();
  
  return (
    <RoleBasedLayout user={user}>
      <Routes>
        {/* Define routes for each role */}
      </Routes>
    </RoleBasedLayout>
  );
}
```

### UI Customization

Each role has:

1. **Navigation Items** - Different menu options per role
2. **Dashboard Components** - Custom widgets shown to role
3. **Styling** - Role-specific theme colors and logos
4. **Features** - Permission-based feature access
5. **Permissions** - Granular permission array

Example - Video Editor UI:

```typescript
const VIDEO_EDITOR_UI: UIConfig = {
  layout: 'editor-suite',
  navigation: [
    { id: 'editor', label: 'Editor', icon: 'film', path: '/editor' },
    { id: 'projects', label: 'Projects', icon: 'folder', path: '/editor/projects' },
    { id: 'tasks', label: 'Edit Tasks', icon: 'list', path: '/editor/tasks' },
    { id: 'assets', label: 'Assets', icon: 'layers', path: '/editor/assets' },
    { id: 'export', label: 'Export', icon: 'download', path: '/editor/export' },
  ],
  styling: {
    theme: 'dark',
    accentColor: '#ef4444', // red
    logo: '/logo-editor.svg'
  },
  permissions: [
    'videos.create',
    'videos.edit',
    'videos.submit',
    'assets.view',
    'tasks.view',
    ...
  ]
};
```

## Frontend Implementation

### Admin Management Page

Located at: `frontend/src/pages/AdminPage.tsx`

Features:
- Tab navigation between Roles and Users
- Create role form with name, slug, description
- Role list with permission counts
- Create user form with email, name, password, role selection
- User table with role assignments
- Delete options for custom roles and users

### Role-Based Layout Component

Located at: `frontend/src/components/RoleBasedLayout.tsx`

Returns different layout components based on user role:
- `SalesTeamLayout` - For agents and managers
- `ContentCreatorLayout` - For content creators
- `VideoEditorLayout` - For video editors
- `AdminLayout` - For system admins

## Example Usage

### 1. Admin Creates New Role

```bash
# Call admin endpoint to create Video Editor role
POST /api/admin/roles
{
  "name": "Video Editor",
  "slug": "video_editor",
  "description": "Professional video editing access"
}
```

### 2. Admin Creates User with Role

```bash
# Create user and assign Video Editor role
POST /api/admin/users
{
  "email": "john@studio.com",
  "name": "John Smith",
  "password": "SecurePass123!",
  "roleId": "video-editor-role-id"
}
```

### 3. User Logs In

```javascript
// Login returns user with role_slug
POST /api/auth/login
{
  "email": "john@studio.com",
  "password": "SecurePass123!"
}

// Response
{
  "token": "...",
  "user": {
    "id": "...",
    "email": "john@studio.com",
    "name": "John Smith",
    "role_slug": "video_editor",
    "role_name": "Video Editor"
  }
}
```

### 4. Frontend Routes Based on Role

```typescript
// In App.tsx or Router.tsx
const roleConfig = getRoleUIConfig(user.role_slug);

// User with role_slug='video_editor' sees:
// - Video Editor navigation
// - Editor Suite layout
// - Dark red theme
// - Video editing features

// User with role_slug='content_creator' sees:
// - Content Creator navigation
// - Content Studio layout
// - Dark amber theme
// - Content management features
```

## Testing

### Demo Script

Run: `node backend/demo-admin-roles.js`

This script demonstrates:
1. Creating Video Editor role
2. Creating Content Creator role
3. Creating users with those roles
4. Assigning permissions
5. Verifying all setup

### Manual Testing

```bash
# 1. Get admin token
TOKEN=$(npm run get-token)

# 2. Create role
curl -X POST http://localhost:5000/api/admin/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Video Editor",
    "slug": "video_editor",
    "description": "Professional video editor"
  }'

# 3. Create user
curl -X POST http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@studio.com",
    "name": "John Smith",
    "password": "SecurePass123!",
    "roleId": "<role-id-from-step-2>"
  }'

# 4. List users
curl http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer $TOKEN"
```

## Database Schema

### Roles Table
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);
```

### Role Permissions Join
```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(role_id, permission_id)
);
```

### Users Table (Updated)
```sql
ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id);
```

## Security Considerations

### Authorization
- All admin endpoints require `admin` role
- Use `roleMiddleware(['admin'])` to protect routes
- Token validation in JWT middleware

### Input Validation
- Email uniqueness checked
- Slug lowercase and underscore-only format
- Password stored hashed (SHA256)
- Required fields validated

### Protection
- System roles cannot be deleted
- Users cannot delete themselves
- Role with assigned users cannot be deleted
- Permission inheritance from role to user

## Next Steps

1. **Frontend Integration**
   - Add AdminPage to routing
   - Connect API calls to components
   - Test role creation workflow

2. **UI Customization**
   - Create custom dashboards for each role
   - Implement role-specific navigation
   - Build specialized components

3. **Permission Assignment**
   - Create permission assignment UI
   - Link roles to specific permissions
   - Test permission-based access control

4. **Testing**
   - Run demo script
   - Test manual role creation
   - Verify UI differences by role
   - Test user creation and assignment

## File Structure

```
backend/
├── src/
│   ├── controllers/
│   │   └── admin-role-user-controller.ts  (13 functions)
│   ├── config/
│   │   └── role-based-ui.ts               (UI configurations)
│   └── routes/
│       └── admin.ts                        (Endpoints)
├── demo-admin-roles.js                    (Demo script)
└── scripts/
    └── migrate.js                          (Creates roles, permissions)

frontend/
├── src/
│   ├── pages/
│   │   └── AdminPage.tsx                  (Admin UI)
│   └── components/
│       └── RoleBasedLayout.tsx            (Layout routing)
└── database/
    └── migrations/
        ├── 2026-08-12-001-create-roles-system.sql
        ├── 2026-08-12-002-migrate-users-to-roles.sql
        └── 2026-08-12-003-create-tasks-system.sql
```

---

**Status**: ✅ Complete and ready for testing

**Last Updated**: 2026-08-13
