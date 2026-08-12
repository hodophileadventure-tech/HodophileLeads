// ============================================================================
// MODEL: Role Management
// ============================================================================

import { query } from '../utils/database';
import type { Role } from '../types/task-management';

export const roleModel = {
  
  async findAll(onlyActive = true): Promise<Role[]> {
    const sql = `
      SELECT * FROM roles 
      ${onlyActive ? 'WHERE is_active = true' : ''}
      ORDER BY name ASC
    `;
    const result = await query(sql);
    return result.rows as Role[];
  },

  async findById(id: string): Promise<Role | undefined> {
    const result = await query(
      'SELECT * FROM roles WHERE id = $1',
      [id]
    );
    return result.rows[0] as Role | undefined;
  },

  async findBySlug(slug: string): Promise<Role | undefined> {
    const result = await query(
      'SELECT * FROM roles WHERE slug = $1',
      [slug]
    );
    return result.rows[0] as Role | undefined;
  },

  async create(data: {
    name: string;
    slug: string;
    description?: string;
    created_by?: string;
  }): Promise<Role> {
    const result = await query(
      `INSERT INTO roles (name, slug, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.slug, data.description || null, data.created_by || null]
    );
    return result.rows[0] as Role;
  },

  async update(
    id: string,
    data: { name?: string; description?: string; is_active?: boolean }
  ): Promise<Role> {
    const updates: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(data.name);
      paramIndex++;
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(data.description);
      paramIndex++;
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(data.is_active);
      paramIndex++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(
      `UPDATE roles
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params
    );
    return result.rows[0] as Role;
  },

  async delete(id: string): Promise<boolean> {
    // Check if role has users
    const usersResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
      [id]
    );
    const userCount = parseInt(usersResult.rows[0].count);
    
    if (userCount > 0) {
      throw new Error(`Cannot delete role with ${userCount} assigned users`);
    }

    const result = await query(
      'DELETE FROM roles WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  },

  async isUsed(id: string): Promise<boolean> {
    const result = await query(
      'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
      [id]
    );
    return parseInt(result.rows[0].count) > 0;
  }
};
