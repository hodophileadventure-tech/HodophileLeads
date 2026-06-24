import type { LeadTemperature } from '../types';

export const calculateLeadTemperature = (lead: {
  sourceType?: string;
  responsionTime?: number;
  followUpCount?: number;
  daysInPipeline?: number;
}): LeadTemperature => {
  let score = 0;

  // Source quality
  if (lead.sourceType === 'referral' || lead.sourceType === 'repeat_client') score += 40;
  if (lead.sourceType === 'website') score += 35;
  if (lead.sourceType === 'organic' || lead.sourceType === 'direct') score += 30;
  if (lead.sourceType === 'paid_ad') score += 20;

  // Response time (days)
  if (lead.responsionTime && lead.responsionTime <= 1) score += 30;
  if (lead.responsionTime && lead.responsionTime <= 3) score += 20;
  if (lead.responsionTime && lead.responsionTime > 7) score -= 10;

  // Follow-up engagement
  if (lead.followUpCount && lead.followUpCount >= 5) score += 20;
  if (lead.followUpCount && lead.followUpCount >= 3) score += 10;

  // Days in pipeline
  if (lead.daysInPipeline && lead.daysInPipeline <= 7) score += 10;
  if (lead.daysInPipeline && lead.daysInPipeline > 30) score -= 20;

  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  if (score >= 10) return 'cold';
  return 'dead';
};

export const getHealthColor = (score: number): 'red' | 'yellow' | 'green' => {
  if (score < 50) return 'red';
  if (score < 80) return 'yellow';
  return 'green';
};

export const calculateBookingHealthScore = (factors: {
  tripleLockComplete: boolean;
  clientApproved: boolean;
  paymentReceived: boolean;
  preDepartureTasksDone: boolean;
}) => {
  const score =
    (factors.tripleLockComplete ? 40 : 0) +
    (factors.clientApproved ? 20 : 0) +
    (factors.paymentReceived ? 25 : 0) +
    (factors.preDepartureTasksDone ? 15 : 0);

  return {
    score,
    health: getHealthColor(score)
  };
};

// Calculate lead data health based on how many fields are filled
export const calculateLeadDataHealth = (lead: any): number => {
  let filledFields = 0;
  const totalWeightedFields = 15; // maximum points

  // Essential fields (1 point each)
  if (lead.clientName && lead.clientName.trim()) filledFields += 1;
  if (lead.email && lead.email.trim()) filledFields += 1;
  if (lead.phone && lead.phone.trim()) filledFields += 1;

  // Important fields (1 point each)
  if (lead.destination && lead.destination.trim()) filledFields += 1;
  if (lead.travelDates) {
    if (typeof lead.travelDates === 'string') {
      try {
        const parsed = JSON.parse(lead.travelDates);
        if (parsed.from && parsed.to) filledFields += 1;
      } catch {
        if (lead.travelDates.from && lead.travelDates.to) filledFields += 1;
      }
    } else if (lead.travelDates.from && lead.travelDates.to) {
      filledFields += 1;
    }
  }
  if (lead.persons && lead.persons > 0) filledFields += 1;
  if (lead.budget && lead.budget > 0) filledFields += 1;

  // Additional details (1 point each)
  if (lead.adults && lead.adults > 0) filledFields += 1;
  if (lead.kids && lead.kids >= 0) filledFields += 1;
  if (lead.tourType && lead.tourType.trim()) filledFields += 1;
  if (lead.specialRequests && lead.specialRequests.trim()) filledFields += 1;
  if (lead.transportPreference && lead.transportPreference.trim()) filledFields += 1;
  if (lead.hotelPreference && lead.hotelPreference.trim()) filledFields += 1;

  // Hotel options/info (2 points if filled)
  if (lead.hotelOptions && Array.isArray(lead.hotelOptions) && lead.hotelOptions.length > 0) {
    filledFields += 2;
  } else if (lead.hotelInfo && (typeof lead.hotelInfo === 'string' ? lead.hotelInfo.trim() : true)) {
    filledFields += 1;
  }

  // Destinations array (1 point if multiple destinations)
  if (lead.destinations && Array.isArray(lead.destinations) && lead.destinations.length > 1) {
    filledFields += 1;
  }

  // Cap at 100 (in case of extra fields)
  return Math.min(Math.round((filledFields / totalWeightedFields) * 100), 100);
};

export const generateFollowUpTasks = async (leadId: string, eventType: string) => {
  const now = new Date();

  const templates: Record<string, Array<{ title: string; offsetHours: number; priority: 'low' | 'medium' | 'high' }>> = {
    itinerary_sent: [
      { title: 'Follow up on itinerary approval', offsetHours: 24, priority: 'high' }
    ],
    approval_received: [
      { title: 'Payment reminder after approval', offsetHours: 12, priority: 'high' }
    ],
    booking_confirmed: [
      { title: 'Pre-departure reminder (7 days)', offsetHours: 24 * 7, priority: 'medium' },
      { title: 'Pre-departure reminder (3 days)', offsetHours: 24 * 3, priority: 'medium' },
      { title: 'Pre-departure reminder (1 day)', offsetHours: 24, priority: 'high' }
    ],
    on_trip: [
      { title: 'Mid-trip check-in', offsetHours: 24 * 2, priority: 'medium' }
    ],
    post_trip: [
      { title: 'Review request and thank-you', offsetHours: 24, priority: 'medium' },
      { title: 'Loyalty teaser follow-up', offsetHours: 24 * 7, priority: 'low' }
    ]
  };

  const selected = templates[eventType] || [];
  return selected.map((task, index) => ({
    id: `${leadId}-${eventType}-${index}`,
    leadId,
    type: 'auto',
    reminderType: 'standard',
    title: task.title,
    dueDate: new Date(now.getTime() + task.offsetHours * 60 * 60 * 1000).toISOString(),
    priority: task.priority,
    status: 'upcoming'
  }));
};
