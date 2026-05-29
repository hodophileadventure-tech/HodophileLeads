export type UserRole = 'admin' | 'agent';
export type LeadTemperature = 'hot' | 'warm' | 'cold' | 'dead';
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'negotiation' | 'booked' | 'completed' | 'canceled';
export type PipelineStage =
  | 'new_lead'
  | 'availability_check'
  | 'quoted'
  | 'payment_pending'
  | 'confirmed'
  | 'on_trip'
  | 'completed';
export type TaskStatus = 'overdue' | 'today' | 'upcoming' | 'completed' | 'canceled';
export type HealthScore = 'red' | 'yellow' | 'green';
export type FollowUpPriority = 'low' | 'medium' | 'high';
export type AvailabilityStatus = 'not_checked' | 'on_hold' | 'confirmed' | 'unavailable';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  lastLoginAt?: string | null;
  lastLogoutAt?: string | null;
}

export interface Lead {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  destination: string;
  destinations?: string[];
  travelDates: {
    from: string;
    to: string;
  };
  persons: number;
  budget: number;
  source: string;
  leadSource?: 'whatsapp' | 'call' | 'insta' | 'form';
  budgetRange?: 'economy' | 'standard' | 'premium';
  adults?: number;
  kids?: number;
  seniors?: number;
  temperature: LeadTemperature;
  status: LeadStatus;
  pipelineStage?: PipelineStage;
  agentId: string;
  notes?: string;
  specialRequests?: string;
  transportPreference?: string;
  hotelPreference?: string;
  hotelInfo?: LeadHotelInfo;
  hotelOptions?: LeadHotelInfo[];
  createdAt: string;
  updatedAt: string;
  canceledReason?: string | null;
  canceledBy?: string | null;
  canceledAt?: string | null;
}

export interface LeadHotelInfo {
  hotelName: string;
  roomType: string;
  roomPrice: number;
}

export interface FollowUp {
  id: string;
  leadId: string;
  type: 'manual' | 'auto';
  reminderType?: 'client_requested' | 'standard';
  title: string;
  description?: string;
  dueDate: string;
  status: TaskStatus;
  priority: FollowUpPriority;
  assignedTo: string;
  whatsappNumber?: string;
  whatsappLink?: string;
  completedAt?: string;
  createdAt: string;
  canceledReason?: string | null;
  canceledBy?: string | null;
  canceledAt?: string | null;
}

export interface AvailabilityMatrix {
  id: string;
  leadId: string;
  hotelStatus: AvailabilityStatus;
  transportStatus: AvailabilityStatus;
  guideStatus: AvailabilityStatus;
  holdExpiry?: string;
  providerName?: string;
  providerContact?: string;
  bookingReference?: string;
  evidenceNote?: string;
  clientApproved: boolean;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Itinerary {
  id: string;
  leadId: string;
  tripPlan: any[];
  hotelInfo: any;
  transportInfo: any;
  guideInfo: any;
  totalCost: number;
  status: 'draft' | 'approved' | 'shared' | 'finalized';
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  leadId: string;
  amount: number;
  status: 'pending' | 'approved' | 'confirmed' | 'failed';
  method: 'cash' | 'card' | 'bank_transfer';
  dueDate: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  leadId?: string;
  type: string;
  message: string;
  payload?: any;
  is_read: boolean;
  created_at: string;
}
