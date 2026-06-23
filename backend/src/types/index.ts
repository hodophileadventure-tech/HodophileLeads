export type UserRole = 'admin' | 'agent' | 'manager';
export type LeadTemperature = 'hot' | 'warm' | 'cold' | 'dead';
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'negotiation' | 'booked' | 'completed' | 'canceled';
export type LeadOutcome = 'confirmed' | 'budget_issue' | 'no_reply';
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
  tourType?: string;
  leadSource?: 'whatsapp' | 'call' | 'insta' | 'form';
  budgetRange?: 'economy' | 'standard' | 'premium';
  adults?: number;
  kids?: number;
  seniors?: number;
  temperature: LeadTemperature;
  status: LeadStatus;
  leadOutcome?: LeadOutcome | null;
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
  checkIn?: string;
  checkOut?: string;
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
  proofUrl?: string;
  proof_url?: string;
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

export interface QuoteRequest {
  id: string;
  leadId: string;
  requestedBy: string;
  requestType: 'quotation' | 'invoice';
  status: 'requested' | 'saved' | 'manager_pending' | 'admin_pending' | 'approved' | 'rejected';
  documentData?: any;
  createdByManager?: string | null;
  createdByManagerAt?: string | null;
  managerNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  reRequestNotes?: string | null;
  parentRequestId?: string | null;
  createdAt: string;
  updatedAt: string;
  requestedByName?: string | null;
  leadClientName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  leadDestination?: string | null;
  leadDestinations?: string[] | null;
  leadTravelDates?: { from: string; to: string } | null;
  leadPersons?: number | null;
  leadAdults?: number | null;
  leadKids?: number | null;
  leadSeniors?: number | null;
  leadBudget?: number | null;
  leadTourType?: string | null;
  leadSource?: string | null;
  leadStatus?: string | null;
  leadRemarks?: string | null;
  leadSpecialRequests?: string | null;
  leadLeadOutcome?: string | null;
  leadAgentRemarks?: string | null;
  leadIslamabadStay?: string | null;
}
