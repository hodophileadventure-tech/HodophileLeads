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

  // Helper to safely check string/number fields
  const hasField = (value: any): boolean => {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
  };

  // Essential fields (1 point each)
  if (hasField(lead.clientName || lead.client_name)) filledFields += 1;
  if (hasField(lead.email)) filledFields += 1;
  if (hasField(lead.phone)) filledFields += 1;

  // Important fields (1 point each)
  if (hasField(lead.destination)) filledFields += 1;
  
  const travelDates = lead.travelDates || lead.travel_dates;
  if (travelDates) {
    try {
      const dates = typeof travelDates === 'string' ? JSON.parse(travelDates) : travelDates;
      if (dates?.from && dates?.to) filledFields += 1;
    } catch {
      // ignore parse errors
    }
  }
  
  const persons = lead.persons || lead.person;
  if (hasField(persons)) filledFields += 1;
  
  if (hasField(lead.budget)) filledFields += 1;

  // Additional details (1 point each)
  const adults = lead.adults;
  if (hasField(adults)) filledFields += 1;
  
  const kids = lead.kids;
  if (kids !== undefined && kids !== null && kids >= 0) filledFields += 1;
  
  if (hasField(lead.tourType || lead.tour_type)) filledFields += 1;
  if (hasField(lead.specialRequests || lead.special_requests)) filledFields += 1;
  if (hasField(lead.transportPreference || lead.transport_preference)) filledFields += 1;
  if (hasField(lead.hotelPreference || lead.hotel_preference)) filledFields += 1;

  // Hotel options/info (2 points if filled)
  const hotelOptions = lead.hotelOptions || lead.hotel_options;
  if (hotelOptions && Array.isArray(hotelOptions) && hotelOptions.length > 0) {
    filledFields += 2;
  } else {
    const hotelInfo = lead.hotelInfo || lead.hotel_info;
    if (hotelInfo) filledFields += 1;
  }

  // Destinations array (1 point if multiple destinations)
  const destinations = lead.destinations;
  if (destinations && Array.isArray(destinations) && destinations.length > 1) {
    filledFields += 1;
  }

  // Calculate percentage with minimum of 10% if phone exists
  const healthScore = Math.round((filledFields / totalWeightedFields) * 100);
  const hasPhone = hasField(lead.phone);
  
  // If lead has a phone (which is required), minimum health is 10%
  // If no phone, health is 0%
  if (healthScore === 0 && hasPhone) {
    return 10;
  }
  
  return Math.min(healthScore, 100);
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
