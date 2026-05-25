import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { generateItineraryPdfBuffer } from '../services/pdf-service';

export const itinerariesController = {
  async generatePdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const leadId = req.params.id;
      const pdfBuffer = await generateItineraryPdfBuffer(leadId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="itinerary-${leadId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
};

export default itinerariesController;
