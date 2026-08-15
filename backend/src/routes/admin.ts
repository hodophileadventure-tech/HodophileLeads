import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import { adminController } from '../controllers/admin-controller';
import { quoteRequestsController } from '../controllers/quote-requests-controller';
import { adminRoleUserController } from '../controllers/admin-role-user-controller';

export const adminRouter = Router();

adminRouter.use(authMiddleware);
// configure multer for issue attachments
const issueStorage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		const uploadPath = path.join(__dirname, '..', '..', 'uploads', 'issues');
		cb(null, uploadPath);
	},
	filename: (_req, file, cb) => {
		const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
		const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-\_]/g, '_');
		cb(null, `${unique}-${safeName}`);
	}
});

const issueUpload = multer({
	storage: issueStorage,
	limits: { fileSize: 6 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		const allowed = ['image/jpeg', 'image/png', 'image/webp'];
		if (allowed.includes(file.mimetype)) cb(null, true);
		else cb(null, false);
	}
});
adminRouter.get('/red-flags', roleMiddleware(['admin']), adminController.redFlags);
adminRouter.get('/overview', roleMiddleware(['admin', 'manager']), adminController.overview);
adminRouter.get('/leads/export', roleMiddleware(['admin', 'manager', 'agent']), adminController.exportLeadsSpreadsheet);
adminRouter.post('/leads/:id/transfer', roleMiddleware(['admin', 'manager']), adminController.transferLead);
 
// Agents management
adminRouter.get('/agents', roleMiddleware(['admin', 'manager']), adminController.listAgents);
adminRouter.get('/agents/:id/leads', roleMiddleware(['admin', 'manager']), adminController.getAgentLeads);
adminRouter.put('/agents/:id', roleMiddleware(['admin']), adminController.updateAgent);
adminRouter.delete('/agents/:id', roleMiddleware(['admin']), adminController.deleteAgent);
adminRouter.post('/agents/:id/reset-password', roleMiddleware(['admin']), adminController.resetAgentPassword);
adminRouter.post('/agents/:id/screenshot-request', roleMiddleware(['admin']), adminController.requestAgentScreenshot);
// follow-up stats per agent
adminRouter.get('/agents/follow-up-stats', roleMiddleware(['admin', 'manager']), adminController.followUpStats);
// revenue stats per agent
adminRouter.get('/agents/revenue-stats', roleMiddleware(['admin', 'manager']), adminController.revenueStats);
adminRouter.get('/quote-requests', roleMiddleware(['admin']), quoteRequestsController.listPending);
adminRouter.post('/screen-captures/:requestId', roleMiddleware(['agent']), adminController.submitScreenCapture);
// Issue reporting
// allow optional attachment during issue creation
adminRouter.post('/issues', issueUpload.single('attachment'), adminController.createIssue);
adminRouter.get('/issues', roleMiddleware(['admin', 'manager', 'agent']), adminController.listIssues);
adminRouter.put('/issues/:id', roleMiddleware(['admin']), adminController.updateIssue);
adminRouter.post('/issues/:id/attachments', roleMiddleware(['admin']), issueUpload.single('attachment'), adminController.uploadIssueAttachment);

// ============================================================================
// ROLE MANAGEMENT (Admin Only)
// ============================================================================

// Create new role
adminRouter.post('/roles', roleMiddleware(['admin']), adminRoleUserController.createRole);

// List all roles
adminRouter.get('/roles', roleMiddleware(['admin']), adminRoleUserController.listRoles);

// Get specific role with permissions
adminRouter.get('/roles/:id', roleMiddleware(['admin']), adminRoleUserController.getRole);

// Update role
adminRouter.put('/roles/:id', roleMiddleware(['admin']), adminRoleUserController.updateRole);

// Delete role
adminRouter.delete('/roles/:id', roleMiddleware(['admin']), adminRoleUserController.deleteRole);

// Assign permissions to role
adminRouter.post('/roles/:roleId/permissions', roleMiddleware(['admin']), adminRoleUserController.assignPermissions);

// ============================================================================
// USER MANAGEMENT (Admin Only)
// ============================================================================

// Create new user
adminRouter.post('/users', roleMiddleware(['admin']), adminRoleUserController.createUser);

// List all users
adminRouter.get('/users', roleMiddleware(['admin']), adminRoleUserController.listUsers);

// Get specific user
adminRouter.get('/users/:id', roleMiddleware(['admin']), adminRoleUserController.getUser);

// Update user
adminRouter.put('/users/:id', roleMiddleware(['admin']), adminRoleUserController.updateUser);

// Delete user
adminRouter.delete('/users/:id', roleMiddleware(['admin']), adminRoleUserController.deleteUser);

// Assign role to user
adminRouter.post('/users/:id/assign-role', roleMiddleware(['admin']), adminRoleUserController.assignRole);

// ============================================================================
// PERMISSIONS MANAGEMENT
// ============================================================================

// List all available permissions
adminRouter.get('/permissions', roleMiddleware(['admin']), adminRoleUserController.listPermissions);
