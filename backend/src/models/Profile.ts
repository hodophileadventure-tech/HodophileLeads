import { query } from '../utils/database';

export const profileModel = {
  async findByPhone(phone: string) {
    const result = await query('SELECT * FROM client_profiles WHERE phone = $1', [phone]);
    return result.rows[0] || null;
  },

  async create(data: { phone: string; name?: string; email?: string; address?: string; gender?: string; age?: number }) {
    const sql = `INSERT INTO client_profiles (phone, name, email, address, gender, age) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
    const params = [data.phone, data.name || null, data.email || null, data.address || null, data.gender || null, data.age || null];
    const result = await query(sql, params);
    return result.rows[0];
  }
};

export default profileModel;
