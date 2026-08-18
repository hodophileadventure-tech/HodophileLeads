// ============================================================================
// ADMIN CONTROLLER: Role & User Management
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/database';
import { roleModel } from '../models/Role';
import { permissionModel } from '../models/Permission';
import crypto from 'crypto';

interface AdminRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
  };
}

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

/**
 * Create a new custom role
 * POST /api/admin/roles
 */
export async function createRole(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { name, slug, description, permissions } = req.body;

    // Validate input
    if (!name || !slug) {
      return res.status(400).json({ 
        error: 'name and slug are required' 
      });
    }

    // Check if role already exists
    const existing = await query(
      'SELECT id FROM roles WHERE slug = $1',
      [slug]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        error: `Role '${slug}' already exists` 
      });
    }

    // Create role
    const roleResult = await query(
      `INSERT INTO roles (name, slug, description, is_system_role, created_by)
       VALUES ($1, $2, $3, false, $4)
       RETURNING id, name, slug, description`,
      [name, slug, description || null, req.user?.id]
    );

    const createdRole = roleResult.rows[0];

    // Assign permissions if provided
    if (Array.isArray(permissions) && permissions.length > 0) {
      for (const permissionId of permissions) {
        await query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [createdRole.id, permissionId]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: `Role '${name}' created successfully`,
      role: createdRole
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all roles
 * GET /api/admin/roles
 */
export async function listRoles(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT r.id, r.name, r.slug, r.description, r.is_system_role,
              COUNT(rp.id) as permission_count
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       GROUP BY r.id
       ORDER BY r.name`
    );

    res.json({
      success: true,
      roles: result.rows
    });
  } catch (error: any) {
    const code = error?.code || '';
    const message = String(error?.message || '');
    if (code === '42P01' || message.includes('does not exist') || message.includes('relation "roles"')) {
      return res.json({
        success: true,
        roles: []
      });
    }
    next(error);
  }
}

/**
 * Get specific role with permissions
 * GET /api/admin/roles/:id
 */
export async function getRole(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const roleResult = await query(
      'SELECT * FROM roles WHERE id = $1',
      [id]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const permResult = await query(
      `SELECT p.id, p.resource, p.action, p.display_name
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.action`,
      [id]
    );

    res.json({
      success: true,
      role: roleResult.rows[0],
      permissions: permResult.rows
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update role
 * PUT /api/admin/roles/:id
 */
export async function updateRole(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    // Check if role exists
    const existing = await query('SELECT id FROM roles WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Update role
    await query(
      'UPDATE roles SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3',
      [name, description, id]
    );

    // Update permissions if provided
    if (Array.isArray(permissions)) {
      // Remove old permissions
      await query('DELETE FROM role_permissions WHERE role_id = $1', [id]);

      // Add new permissions
      for (const permissionId of permissions) {
        await query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [id, permissionId]
        );
      }
    }

    res.json({
      success: true,
      message: 'Role updated successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete role
 * DELETE /api/admin/roles/:id
 */
export async function deleteRole(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Check if system role
    const roleResult = await query(
      'SELECT is_system_role FROM roles WHERE id = $1',
      [id]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (roleResult.rows[0].is_system_role) {
      return res.status(403).json({ 
        error: 'Cannot delete system roles' 
      });
    }

    // Check if role has users
    const usersResult = await query(
      'SELECT COUNT(*) FROM users WHERE role_id = $1',
      [id]
    );

    if (parseInt(usersResult.rows[0].count) > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete role with assigned users' 
      });
    }

    // Delete role (cascade will handle role_permissions)
    await query('DELETE FROM roles WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Create new user
 * POST /api/admin/users
 */
export async function createUser(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { email, name, password, roleId } = req.body;

    // Validate input
    if (!email || !name || !password || !roleId) {
      return res.status(400).json({ 
        error: 'email, name, password, and roleId are required' 
      });
    }

    // Check if user exists
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        error: 'User with this email already exists' 
      });
    }

    // Check if role exists
    const roleCheck = await query(
      'SELECT id FROM roles WHERE id = $1',
      [roleId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid roleId' 
      });
    }

    // Hash password (simple SHA256 - in production use bcrypt)
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, name, password, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role_id`,
      [email, name, hashedPassword, roleId]
    );

    const createdUser = userResult.rows[0];

    res.status(201).json({
      success: true,
      message: `User '${name}' created successfully`,
      user: createdUser
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all users with roles
 * GET /api/admin/users
 */
export async function listUsers(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, r.name as role_name, r.slug as role_slug, u.created_at
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );

    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get specific user
 * GET /api/admin/users/:id
 */
export async function getUser(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const userResult = await query(
      `SELECT u.id, u.email, u.name, u.role_id, r.name as role_name, r.slug as role_slug, u.created_at
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user permissions
    const permResult = await query(
      `SELECT DISTINCT p.id, p.resource, p.action
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.action`,
      [user.role_id]
    );

    res.json({
      success: true,
      user: {
        ...user,
        permissions: permResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user
 * PUT /api/admin/users/:id
 */
export async function updateUser(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, email, roleId } = req.body;

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if new email is available
    if (email) {
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    // Check if role exists
    if (roleId) {
      const roleCheck = await query(
        'SELECT id FROM roles WHERE id = $1',
        [roleId]
      );
      if (roleCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid roleId' });
      }
    }

    // Update user
    await query(
      `UPDATE users SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role_id = COALESCE($3, role_id)
       WHERE id = $4`,
      [name, email, roleId, id]
    );

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete user
 * DELETE /api/admin/users/:id
 */
export async function deleteUser(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user?.id) {
      return res.status(403).json({ 
        error: 'Cannot delete your own user account' 
      });
    }

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user
    await query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Assign role to user
 * POST /api/admin/users/:id/assign-role
 */
export async function assignRole(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      return res.status(400).json({ error: 'roleId is required' });
    }

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if role exists
    const roleCheck = await query('SELECT id FROM roles WHERE id = $1', [roleId]);
    if (roleCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Role not found' });
    }

    // Assign role
    await query(
      'UPDATE users SET role_id = $1 WHERE id = $2',
      [roleId, id]
    );

    res.json({
      success: true,
      message: 'Role assigned successfully'
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// PERMISSIONS MANAGEMENT
// ============================================================================

/**
 * List all permissions
 * GET /api/admin/permissions
 */
export async function listPermissions(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT id, resource, action, display_name, description
       FROM permissions
       ORDER BY resource, action`
    );

    res.json({
      success: true,
      permissions: result.rows
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Assign permissions to role
 * POST /api/admin/roles/:roleId/permissions
 */
export async function assignPermissions(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body;

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ 
        error: 'permissionIds must be an array' 
      });
    }

    // Check if role exists
    const roleCheck = await query('SELECT id FROM roles WHERE id = $1', [roleId]);
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Remove existing permissions
    await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    // Add new permissions
    for (const permissionId of permissionIds) {
      await query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleId, permissionId]
      );
    }

    res.json({
      success: true,
      message: 'Permissions assigned successfully'
    });
  } catch (error) {
    next(error);
  }
}

export const adminRoleUserController = {
  createRole,
  listRoles,
  getRole,
  updateRole,
  deleteRole,
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  assignRole,
  listPermissions,
  assignPermissions
};
