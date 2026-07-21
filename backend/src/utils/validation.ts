import Joi from 'joi';

export const hotelInfoSchema = Joi.object({
  hotelName: Joi.string().allow('').optional(),
  roomType: Joi.string().allow('').optional(),
  roomPrice: Joi.number().min(0).optional(),
  checkIn: Joi.string().allow('').optional(),
  checkOut: Joi.string().allow('').optional()
});

export const authLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required()
});

export const authRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'agent', 'manager').optional()
});

export const leadSchema = Joi.object({
  clientName: Joi.string().min(2).allow('').optional(),
  email: Joi.string().email().allow('').optional(),
  phone: Joi.string().min(7).required(),
  address: Joi.string().allow('').optional(),
  gender: Joi.string().valid('male','female','other').optional(),
  destination: Joi.string().min(2).allow('').optional(),
  travelDates: Joi.object({
    from: Joi.string().allow('').optional(),
    to: Joi.string().allow('').optional()
  }).optional(),
  age: Joi.number().integer().min(0).optional().empty(''),
  adults: Joi.number().integer().min(1).optional().empty(''),
  kids: Joi.number().integer().min(0).max(7).optional().empty(''),
  persons: Joi.number().integer().min(1).optional().empty(''),
  budget: Joi.number().min(0).optional(),
  tripBudget: Joi.number().min(0).optional(),
  status: Joi.string().valid('new', 'contacted', 'interested', 'negotiation', 'booked', 'completed', 'canceled', 'spam').optional(),
  temperature: Joi.string().valid('hot', 'warm', 'cold', 'dead').optional(),
  pipelineStage: Joi.string().valid('new_lead', 'availability_check', 'quoted', 'payment_pending', 'confirmed', 'on_trip', 'completed').optional(),
  leadOutcome: Joi.string().valid('confirmed', 'budget_issue', 'no_reply').optional(),
  transportPreference: Joi.string().allow('').optional(),
  hotelPreference: Joi.string().allow('').optional(),
  createdAt: Joi.string().isoDate().optional(),
  tourType: Joi.string().allow('').optional(),
  hotelInfo: hotelInfoSchema.optional(),
  hotelOptions: Joi.array().items(hotelInfoSchema).optional(),
  destinations: Joi.array().items(Joi.string()).optional(),
  agentId: Joi.string().optional(),
  agentRemarks: Joi.string().allow('').optional(),
  remarks: Joi.string().allow('').optional(),
  potential: Joi.boolean().optional(),
  isB2b: Joi.boolean().optional(),
  source: Joi.string().valid('facebook', 'instagram', 'whatsapp', 'direct').optional(),
  canceledReason: Joi.string().allow('').optional(),
  canceledBy: Joi.string().optional(),
  islamabadStay: Joi.string().valid('yes', 'no').optional().allow('')
});

export const followUpSchema = Joi.object({
  leadId: Joi.string().required(),
  assignedTo: Joi.string().optional(),
  title: Joi.string().min(2).required(),
  description: Joi.string().min(2).optional(),
  dueDate: Joi.string().required(),
  status: Joi.string().valid('overdue', 'today', 'upcoming', 'completed', 'canceled').optional(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  reminderType: Joi.string().valid('client_requested', 'standard').optional(),
  whatsappNumber: Joi.string().allow('').optional(),
  whatsappLink: Joi.string().allow('').optional(),
  canceledReason: Joi.string().allow('').optional(),
  canceledBy: Joi.string().optional()
});

export const paymentSchema = Joi.object({
  leadId: Joi.string().required(),
  amount: Joi.number().min(0).required(),
  status: Joi.string().valid('pending', 'approved', 'confirmed', 'failed').optional(),
  method: Joi.string().valid('cash', 'card', 'bank_transfer').required(),
  dueDate: Joi.string().required(),
  paidDate: Joi.string().allow('').optional(),
  notes: Joi.string().allow('').optional()
});

export const validatePayload = <T>(schema: Joi.ObjectSchema, payload: T) => {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map((detail) => detail.message).join(', ');
    const err: any = new Error(message);
    err.status = 400;
    throw err;
  }
  return value;
};

export const validateUuid = (value: string, name = 'id') => {
  const { error } = Joi.string().guid({ version: ['uuidv1', 'uuidv4', 'uuidv5'] }).validate(value);
  if (error) {
    const err: any = new Error(`${name} must be a valid UUID`);
    err.status = 400;
    throw err;
  }
  return value;
};

