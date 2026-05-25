import apiClient from './api';
import type { Lead, FollowUp, Itinerary, Payment, AvailabilityMatrix } from '../types';

export const leadsAPI = {
  list: () => apiClient.get<Lead[]>('/leads'),
  getById: (id: string) => apiClient.get<Lead>(`/leads/${id}`),
  getHealth: (id: string) => apiClient.get(`/leads/${id}/health`),
  create: (data: Partial<Lead>) => apiClient.post<Lead>('/leads', data),
  update: (id: string, data: Partial<Lead>) => apiClient.put<Lead>(`/leads/${id}`, data),
  updateStatus: (id: string, status: string) => apiClient.patch(`/leads/${id}/status`, { status }),
  updateStage: (id: string, stage: string) => apiClient.patch(`/leads/${id}/stage`, { stage }),
  delete: (id: string) => apiClient.delete(`/leads/${id}`)
};

// upload confirmation document for a lead (multipart/form-data)
(leadsAPI as any).uploadConfirmation = (id: string, formData: FormData) =>
  apiClient.post(`/leads/${id}/confirmation`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// attachments API
export const attachmentsAPI = {
  listByLead: (leadId: string) => apiClient.get(`/leads/${leadId}/attachments`)
};
(attachmentsAPI as any).delete = (leadId: string, attachmentId: string) => apiClient.delete(`/leads/${leadId}/attachments/${attachmentId}`);

// search leads by phone for profile-centric lookup
(leadsAPI as any).searchByPhone = (phone: string) => apiClient.get(`/leads/search`, { params: { phone } });

export const followUpsAPI = {
  list: (leadId?: string) => apiClient.get<FollowUp[]>('/follow-ups', { params: { leadId } }),
  create: (data: Partial<FollowUp>) => apiClient.post<FollowUp>('/follow-ups', data),
  update: (id: string, data: Partial<FollowUp>) => apiClient.put<FollowUp>(`/follow-ups/${encodeURIComponent(id)}`, data),
  complete: (id: string) => apiClient.patch(`/follow-ups/${encodeURIComponent(id)}/complete`, {}),
  delete: (id: string) => {
    if (!id) {
      return Promise.reject(new Error('Missing follow-up id'));
    }
    return apiClient.delete(`/follow-ups/${encodeURIComponent(id)}`);
  }
};

export const availabilityAPI = {
  getByLeadId: (leadId: string) => apiClient.get<AvailabilityMatrix>(`/availability/${leadId}`),
  update: (leadId: string, data: Partial<AvailabilityMatrix>) => apiClient.put<AvailabilityMatrix>(`/availability/${leadId}`, data),
  gates: (leadId: string) => apiClient.get(`/availability/${leadId}/gates`)
};

export const itinerariesAPI = {
  getByLeadId: (leadId: string) => apiClient.get<Itinerary>(`/itineraries/${leadId}`),
  create: (data: Partial<Itinerary>) => apiClient.post<Itinerary>('/itineraries', data),
  update: (id: string, data: Partial<Itinerary>) => apiClient.put<Itinerary>(`/itineraries/${id}`, data),
  generatePDF: (id: string) => apiClient.post(`/itineraries/${id}/generate-pdf`, {}, { responseType: 'blob' }),
  share: (id: string, method: 'email' | 'whatsapp') => apiClient.post(`/itineraries/${id}/share`, { method })
};

export const paymentsAPI = {
  list: (leadId?: string) => apiClient.get<Payment[]>('/payments', { params: { leadId } }),
  create: (data: Partial<Payment>) => apiClient.post<Payment>('/payments', data),
  confirm: (id: string) => apiClient.patch(`/payments/${id}/confirm`, {}),
  delete: (id: string) => apiClient.delete(`/payments/${id}`)
};

export const dashboardAPI = {
  getStats: () => apiClient.get('/dashboard/stats'),
  getPipeline: () => apiClient.get('/dashboard/pipeline'),
  getAnalytics: () => apiClient.get('/dashboard/analytics'),
  getHealthScore: () => apiClient.get('/dashboard/health')
};

export const adminAPI = {
  getRedFlags: () => apiClient.get('/admin/red-flags')
};

(adminAPI as any).getAgents = () => apiClient.get('/admin/agents');
(adminAPI as any).getAgentLeads = (agentId: string) => apiClient.get(`/admin/agents/${agentId}/leads`);
(adminAPI as any).updateAgent = (agentId: string, data: any) => apiClient.put(`/admin/agents/${agentId}`, data);
(adminAPI as any).resetAgentPassword = (agentId: string) => apiClient.post(`/admin/agents/${agentId}/reset-password`);
(adminAPI as any).getAgentsFollowUpStats = () => apiClient.get('/admin/agents/follow-up-stats');
(adminAPI as any).getAgentsRevenueStats = () => apiClient.get('/admin/agents/revenue-stats');
(adminAPI as any).createAgent = (data: { email: string; name: string; password: string; role?: string }) =>
  apiClient.post('/auth/register', data);

export const notificationsAPI = {
  list: () => apiClient.get('/notifications'),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`)
};
