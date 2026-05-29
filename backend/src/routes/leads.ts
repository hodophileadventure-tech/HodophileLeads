import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../middleware/auth';
import { leadsController } from '../controllers/leads-controller';

export const leadsRouter = Router();

// configure multer storage for confirmation documents
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		const uploadPath = path.join(__dirname, '..', '..', 'uploads');
		cb(null, uploadPath);
	},
	filename: (_req, file, cb) => {
		const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
		const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-\_]/g, '_');
		cb(null, `${unique}-${safeName}`);
	}
});
// Accept only JPEG/PNG/PDF and limit size to 5MB
const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
		if (allowed.includes(file.mimetype)) cb(null, true);
		else cb(new Error('Unsupported file type'));
	}
});

leadsRouter.use(authMiddleware);

leadsRouter.get('/', leadsController.list);
leadsRouter.get('/search', leadsController.searchByPhone);
leadsRouter.post('/', leadsController.create);
leadsRouter.get('/:id', leadsController.getById);
leadsRouter.get('/:id/health', leadsController.getHealthScore);
leadsRouter.put('/:id', leadsController.update);
leadsRouter.patch('/:id/status', leadsController.updateStatus);
leadsRouter.patch('/:id/cancel', leadsController.cancel);
leadsRouter.patch('/:id/stage', leadsController.updateStage);
leadsRouter.delete('/:id', leadsController.delete);

// Upload hotel confirmation document (optional)
leadsRouter.post('/:id/confirmation', upload.single('file'), leadsController.uploadConfirmation);
// list attachments for a lead
leadsRouter.get('/:id/attachments', leadsController.getAttachments);
// delete attachment
leadsRouter.delete('/:id/attachments/:attachmentId', leadsController.deleteAttachment);
