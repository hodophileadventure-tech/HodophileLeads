import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth';
import { paymentsController } from '../controllers/payments-controller';

// Configure multer for payment proof uploads
const proofDir = path.join(__dirname, '..', '..', 'uploads', 'payment-proofs');
try {
  fs.mkdirSync(proofDir, { recursive: true });
} catch (e) {
  // ignore
}

const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, proofDir);
  },
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`);
  }
});

const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  }
});

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);
paymentsRouter.get('/', paymentsController.list);
paymentsRouter.post('/', paymentsController.create);
paymentsRouter.put('/:id', paymentsController.update);
paymentsRouter.patch('/:id/confirm', proofUpload.single('proof'), paymentsController.confirm);
paymentsRouter.delete('/:id', paymentsController.delete);
