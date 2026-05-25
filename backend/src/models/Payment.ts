import { query } from '../utils/database';
import type { Payment } from '../types';

const mapPaymentRow = (row: any) => {
  if (!row) return row;
  return {
    ...row,
    leadId: row.leadId || row.lead_id,
    dueDate: row.dueDate || row.due_date,
    paidDate: row.paidDate || row.paid_date,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at
  };
};

export const paymentsModel = {
  async findAllByLead(leadId: string) {
    const result = await query('SELECT * FROM payments WHERE lead_id = $1 ORDER BY due_date DESC', [leadId]);
    return result.rows.map(mapPaymentRow);
  },

  async create(data: Partial<Payment>) {
    const sql = `
      INSERT INTO payments (lead_id, amount, status, method, due_date, paid_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const params = [
      data.leadId,
      data.amount,
      data.status || 'pending',
      data.method,
      data.dueDate,
      data.paidDate || null,
      data.notes || ''
    ];
    const result = await query(sql, params);
    return mapPaymentRow(result.rows[0]);
  },

  async confirm(id: string, paidDate?: string) {
    const result = await query(
      'UPDATE payments SET status = $2, paid_date = $3, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, 'confirmed', paidDate || new Date().toISOString()]
    );
    return mapPaymentRow(result.rows[0]);
  },

  async update(id: string, data: Partial<Payment>) {
    const result = await query(
      `UPDATE payments
       SET amount = COALESCE($2, amount),
           status = COALESCE($3, status),
           method = COALESCE($4, method),
           due_date = COALESCE($5, due_date),
           paid_date = COALESCE($6, paid_date),
           notes = COALESCE($7, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, data.amount, data.status, data.method, data.dueDate, data.paidDate, data.notes]
    );
    return mapPaymentRow(result.rows[0]);
  },

  async delete(id: string) {
    const result = await query('DELETE FROM payments WHERE id = $1 RETURNING *', [id]);
    return mapPaymentRow(result.rows[0]);
  }
};

export default paymentsModel;
