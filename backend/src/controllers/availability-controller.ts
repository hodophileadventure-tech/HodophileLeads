import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { availabilityModel } from '../models/Availability';

export const availabilityController = {
  async getByLead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const record = await availabilityModel.getByLeadId(req.params.leadId);
      if (!record) {
        return res.json({
          lead_id: req.params.leadId,
          hotel_status: 'not_checked',
          transport_status: 'not_checked',
          guide_status: 'not_checked',
          client_approved: false
        });
      }
      res.json(record);
    } catch (error) {
      next(error);
    }
  },

  async upsert(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const record = await availabilityModel.upsert(req.params.leadId, req.user.id, req.body || {});
      res.json(record);
    } catch (error) {
      next(error);
    }
  },

  async gateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const record = await availabilityModel.getByLeadId(req.params.leadId);
      const canGenerateItinerary = availabilityModel.canGenerateItinerary(record);
      const canOpenPayment = availabilityModel.canOpenPayment(record);

      res.json({
        canGenerateItinerary,
        canOpenPayment,
        reasons: {
          hotelConfirmed: record?.hotel_status === 'confirmed',
          transportConfirmed: record?.transport_status === 'confirmed',
          guideConfirmed: record?.guide_status === 'confirmed',
          clientApproved: !!record?.client_approved
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
