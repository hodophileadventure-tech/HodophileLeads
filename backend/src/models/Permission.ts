// ============================================================================
// MODEL: Permission Management
// ============================================================================

import { query } from '../utils/database';
import type { Permission } from '../types/task-management';

export const permissionModel = {
  
  async findAll(): Promise<Permission[]> {
    const result = await query(
      'SELECT * FROM permissions ORDER BY resource, action ASC'
    );
    return result.rows as Permission[];
  },

  async findByResourceAction(
    resource: string,
    action: string
  ): Promise<Permission | undefined> {
    const result = await query(
      'SELECT * FROM permissions WHERE resource = $1 AND action = $2',
      [resource, action]
    );
    return result.rows[0] as Permission | undefined;
  },

  async findById(id: string): Promise<Permission | undefined> {
    const result = await query(
      'SELECT * FROM permissions WHERE id = $1',
      [id]
    );
    return result.rows[0] as Permission | undefined;
  },

  async findByResource(resource: string): Promise<Permission[]> {
    const result = await query(
      'SELECT * FROM permissions WHERE resource = $1 ORDER BY action',
      [resource]
    );
    return result.rows as Permission[];
  },

  async create(data: {
    resource: string;
    action: string;
    display_name: string;
    description?: string;
  }): Promise<Permission> {
    const result = await query(
      `INSERT INTO permissions (resource, action, display_name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.resource, data.action, data.display_name, data.description || null]
    );
    return result.rows[0] as Permission;
  },

  async delete(id: string): Promise<boolean> {
    // Check if permission is used
    const usageResult = await query(
      'SELECT COUNT(*) as count FROM role_permissions WHERE permission_id = $1',
      [id]
    );
    const usageCount = parseInt(usageResult.rows[0].count);
    
    if (usageCount > 0) {
      throw new Error(`Cannot delete permission used by ${usageCount} roles`);
    }

    const result = await query(
      'DELETE FROM permissions WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }
};
