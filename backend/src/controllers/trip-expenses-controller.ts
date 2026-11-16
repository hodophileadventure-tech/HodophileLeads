import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../utils/database';

const expenseFields = [
  'hotel_cost',
  'transport_cost',
  'fuel_cost',
  'toll_taxes_cost',
  'parking_cost',
  'food_cost',
  'tour_guide_cost',
  'other_cost'
] as const;

const mapExpense = (row: any) => ({
  leadId: row.lead_id,
  clientName: row.client_name,
  phone: row.phone,
  destination: row.destination,
  soldPrice: row.sold_price == null ? null : Number(row.sold_price),
  hasExpenses: row.has_expenses === true || row.has_expenses === 't' || Boolean(row.updated_at),
  hotelCost: Number(row.hotel_cost || 0),
  transportCost: Number(row.transport_cost || 0),
  fuelCost: Number(row.fuel_cost || 0),
  tollTaxesCost: Number(row.toll_taxes_cost || 0),
  parkingCost: Number(row.parking_cost || 0),
  foodCost: Number(row.food_cost || 0),
  tourGuideCost: Number(row.tour_guide_cost || 0),
  otherCost: Number(row.other_cost || 0),
  otherExpenseNote: row.other_expense_note || '',
  updatedAt: row.updated_at || null
});

const confirmedLeadCondition = `(
  (l.status = 'booked' OR l.lead_outcome = 'confirmed' OR l.pipeline_stage = 'confirmed')
  AND COALESCE(l.status, '') NOT IN ('canceled', 'cancelled')
)`;

export const tripExpensesController = {
  async list(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await query(`
        SELECT
          l.id AS lead_id,
          l.client_name,
          l.phone,
          l.destination,
          l.actual_price AS sold_price,
          (e.lead_id IS NOT NULL) AS has_expenses,
          COALESCE(e.hotel_cost, 0) AS hotel_cost,
          COALESCE(e.transport_cost, 0) AS transport_cost,
          COALESCE(e.fuel_cost, 0) AS fuel_cost,
          COALESCE(e.toll_taxes_cost, 0) AS toll_taxes_cost,
          COALESCE(e.parking_cost, 0) AS parking_cost,
          COALESCE(e.food_cost, 0) AS food_cost,
          COALESCE(e.tour_guide_cost, 0) AS tour_guide_cost,
          COALESCE(e.other_cost, 0) AS other_cost,
          COALESCE(e.other_expense_note, '') AS other_expense_note,
          e.updated_at
        FROM leads l
        LEFT JOIN lead_trip_expenses e ON e.lead_id = l.id
        WHERE ${confirmedLeadCondition}
        ORDER BY l.created_at DESC
      `);

      res.json(result.rows.map(mapExpense));
    } catch (error) {
      next(error);
    }
  },

  async save(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const values = expenseFields.map((field) => Number(req.body?.[field.replace(/_([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())] ?? 0));
      if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 999999999999.99)) {
        return res.status(400).json({ message: 'Expense amounts must be valid non-negative numbers.' });
      }

      const note = String(req.body?.otherExpenseNote || '').trim();
      if (note.length > 500) {
        return res.status(400).json({ message: 'Other expense note must be 500 characters or fewer.' });
      }

      const result = await query(`
        INSERT INTO lead_trip_expenses (
          lead_id, hotel_cost, transport_cost, fuel_cost, toll_taxes_cost,
          parking_cost, food_cost, tour_guide_cost, other_cost, other_expense_note, updated_by
        )
        SELECT l.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        FROM leads l
        WHERE l.id = $1 AND ${confirmedLeadCondition}
        ON CONFLICT (lead_id) DO UPDATE SET
          hotel_cost = EXCLUDED.hotel_cost,
          transport_cost = EXCLUDED.transport_cost,
          fuel_cost = EXCLUDED.fuel_cost,
          toll_taxes_cost = EXCLUDED.toll_taxes_cost,
          parking_cost = EXCLUDED.parking_cost,
          food_cost = EXCLUDED.food_cost,
          tour_guide_cost = EXCLUDED.tour_guide_cost,
          other_cost = EXCLUDED.other_cost,
          other_expense_note = EXCLUDED.other_expense_note,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `, [req.params.leadId, ...values, note, req.user?.id || null]);

      if (!result.rows[0]) {
        return res.status(404).json({ message: 'Confirmed lead not found.' });
      }

      const leadResult = await query(`
        SELECT id AS lead_id, client_name, phone, destination, actual_price AS sold_price
        FROM leads WHERE id = $1
      `, [req.params.leadId]);

      res.json(mapExpense({ ...leadResult.rows[0], ...result.rows[0], has_expenses: true }));
    } catch (error) {
      next(error);
    }
  }
};