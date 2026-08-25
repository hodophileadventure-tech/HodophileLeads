// ============================================================================
// ADMIN CONTROLLER: Role & User Management
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/database';
import { roleModel } from '../models/Role';
import { permissionModel } from '../models/Permission';
import { hashPassword } from '../utils/auth';

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

    // The role form does not expose permission selection yet. Creative roles
    // need the task permissions required by CreativeWorkPanel immediately.
    const normalizedSlug = String(slug).trim().toLowerCase();
    if (['content_creator', 'video_editor'].includes(normalizedSlug)) {
      const taskActions = ['view', 'start', 'submit'];
      await query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, p.id
         FROM permissions p
         WHERE p.resource = 'tasks' AND p.action = ANY($2::text[])
         ON CONFLICT DO NOTHING`,
        [createdRole.id, taskActions]
      );
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
    const {
      email, name, password, roleId, nic, dateOfBirth, joiningDate, salary,
      designation, emergencyContactNumber, address, bankName, accountNumber
    } = req.body;

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

    const hashedPassword = await hashPassword(password);

    // Create user
    const userResult = await query(
      `INSERT INTO users (
         email, name, password, role_id, nic, date_of_birth, joining_date,
         salary, designation, emergency_contact_number, address, bank_name, account_number
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, email, name, role_id, nic, date_of_birth, joining_date,
                 salary, designation, emergency_contact_number, address, bank_name, account_number`,
      [
        String(email).trim().toLowerCase(), String(name).trim(), hashedPassword, roleId,
        nic ? String(nic).trim() : null, dateOfBirth || null, joiningDate || null,
        salary === '' || salary === undefined ? null : Number(salary),
        designation ? String(designation).trim() : null,
        emergencyContactNumber ? String(emergencyContactNumber).trim() : null,
        address ? String(address).trim() : null,
        bankName ? String(bankName).trim() : null,
        accountNumber ? String(accountNumber).trim() : null
      ]
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
            `SELECT u.id, u.email, u.name, u.nic, u.date_of_birth, u.joining_date,
              u.salary, u.designation, u.emergency_contact_number, u.address,
              u.bank_name, u.account_number,
              r.name as role_name, r.slug as role_slug, u.created_at
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
            `SELECT u.id, u.email, u.name, u.role_id, u.nic, u.date_of_birth, u.joining_date,
              u.salary, u.designation, u.emergency_contact_number, u.address,
              u.bank_name, u.account_number,
              r.name as role_name, r.slug as role_slug, u.created_at
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
    const {
      name, email, roleId, nic, dateOfBirth, joiningDate, salary,
      designation, emergencyContactNumber, address, bankName, accountNumber
    } = req.body;

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
        role_id = COALESCE($3, role_id),
        nic = COALESCE($4, nic), date_of_birth = COALESCE($5, date_of_birth),
        joining_date = COALESCE($6, joining_date), salary = COALESCE($7, salary),
        designation = COALESCE($8, designation), emergency_contact_number = COALESCE($9, emergency_contact_number),
        address = COALESCE($10, address), bank_name = COALESCE($11, bank_name),
        account_number = COALESCE($12, account_number)
             WHERE id = $13`,
      [
        name, email, roleId, nic ? String(nic).trim() : null,
        dateOfBirth || null, joiningDate || null,
        salary === '' || salary === undefined ? null : Number(salary),
        designation ? String(designation).trim() : null,
        emergencyContactNumber ? String(emergencyContactNumber).trim() : null,
        address ? String(address).trim() : null,
        bankName ? String(bankName).trim() : null,
        accountNumber ? String(accountNumber).trim() : null, id
      ]
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

    const replacementAdmin = await query(
      `SELECT id FROM users WHERE role = 'admin' AND id <> $1 ORDER BY created_at ASC LIMIT 1`,
      [id]
    );
    if (replacementAdmin.rows.length === 0) {
      return res.status(400).json({ error: 'Another admin account is required before deleting this user.' });
    }
    const replacementAdminId = replacementAdmin.rows[0].id;

    const ownedLeads = await query('SELECT COUNT(*)::int AS count FROM leads WHERE agent_id = $1', [id]);
    let replacementAgentId = replacementAdminId;
    if (Number(ownedLeads.rows[0]?.count || 0) > 0) {
      const replacementAgent = await query(
        `SELECT id FROM users WHERE role = 'agent' AND id <> $1 ORDER BY created_at ASC LIMIT 1`,
        [id]
      );
      if (replacementAgent.rows.length === 0) {
        return res.status(400).json({ error: 'Another sales agent is required before deleting a user who owns leads.' });
      }
      replacementAgentId = replacementAgent.rows[0].id;
      await query('UPDATE leads SET agent_id = $1 WHERE agent_id = $2', [replacementAgentId, id]);
    }

    await query('UPDATE follow_ups SET assigned_to = $1 WHERE assigned_to = $2', [replacementAgentId, id]);
    await query('UPDATE follow_ups SET created_by = NULL, canceled_by = NULL WHERE created_by = $1 OR canceled_by = $1', [id]);
    await query('UPDATE tasks SET assigned_to = $1, created_by = $1 WHERE assigned_to = $2 OR created_by = $2', [replacementAdminId, id]);
    await query('UPDATE task_submissions SET submitted_by = $1, reviewer_id = NULL WHERE submitted_by = $2 OR reviewer_id = $2', [replacementAdminId, id]);
    await query('UPDATE task_comments SET commented_by = $1 WHERE commented_by = $2', [replacementAdminId, id]);
    await query('UPDATE task_attachments SET uploaded_by = $1 WHERE uploaded_by = $2', [replacementAdminId, id]);
    await query('UPDATE task_activity_logs SET performed_by = NULL WHERE performed_by = $1', [id]);
    await query('UPDATE attachments SET uploaded_by = NULL WHERE uploaded_by = $1', [id]);
    await query('UPDATE screen_captures SET agent_id = $1, requested_by = NULL WHERE agent_id = $2 OR requested_by = $2', [replacementAgentId, id]);

    // Preserve reports while removing the user reference so the FK does not block deletion.
    await query('UPDATE daily_reports SET user_id = NULL WHERE user_id = $1', [id]);
    await query('UPDATE notifications SET user_id = NULL WHERE user_id = $1', [id]);
    await query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [id]);
    await query(
      'UPDATE quote_requests SET requested_by = $1 WHERE requested_by = $2',
      [replacementAdminId, id]
    );
    await query(`
      UPDATE quote_requests
      SET created_by_manager = NULL,
          resolved_by = NULL,
          approved_by = NULL,
          rejected_by = NULL
      WHERE created_by_manager = $1
         OR resolved_by = $1
         OR approved_by = $1
         OR rejected_by = $1
    `, [id]);

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
