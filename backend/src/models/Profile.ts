import { query } from '../utils/database';

const normalizePhone = (phone: string) => phone.replace(/[^0-9+]/g, '').trim();

export const profileModel = {
  async findByPhone(phone: string) {
    const normalizedPhone = normalizePhone(phone);
    const result = await query(
      `SELECT *
       FROM client_profiles
       WHERE phone = $1
          OR regexp_replace(phone, '[^0-9+]', '', 'g') = $2
       LIMIT 1`,
      [normalizedPhone, normalizedPhone]
    );
    return result.rows[0] || null;
  },

  async create(data: { phone: string; name?: string; email?: string; address?: string; gender?: string; age?: number }) {
    const normalizedPhone = normalizePhone(data.phone);
    const sql = `
      INSERT INTO client_profiles (phone, name, email, address, gender, age)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (phone) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, client_profiles.name),
        email = COALESCE(EXCLUDED.email, client_profiles.email),
        address = COALESCE(EXCLUDED.address, client_profiles.address),
        gender = COALESCE(EXCLUDED.gender, client_profiles.gender),
        age = COALESCE(EXCLUDED.age, client_profiles.age),
        updated_at = NOW()
      RETURNING *`;
    const params = [normalizedPhone, data.name || null, data.email || null, data.address || null, data.gender || null, data.age || null];
    const result = await query(sql, params);
    return result.rows[0];
  }
};

export default profileModel;
