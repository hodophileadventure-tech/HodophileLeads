import type { LeadTemperature } from '../types';

export type LeadLifecycleState = 'potential' | 'in_progress' | 'dead' | 'confirmed' | 'new' | 'spam';

/**
 * Calculate lead temperature based on engagement metrics
 */
export const calculateLeadTemperature = (lead: {
  sourceType?: string;
  responsionTime?: number;
  followUpCount?: number;
  daysInPipeline?: number;
}): LeadTemperature => {
  let score = 0;

  // Source quality
  if (lead.sourceType === 'referral' || lead.sourceType === 'repeat_client') score += 40;
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

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR'
  }).format(value);
};

export const formatDate = (date: string | Date): string => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(value);
};

export const getTemperatureColor = (temp: LeadTemperature): string => {
  const colors = {
    hot: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    warm: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    cold: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    dead: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  };
  return colors[temp];
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-900',
    contacted: 'bg-green-100 text-green-800 dark:bg-green-900',
    interested: 'bg-purple-100 text-purple-800 dark:bg-purple-900',
    negotiation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900',
    booked: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700',
    canceled: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
    spam: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100'
  };
  return colors[status] || colors.new;
};

export const getHealthScoreColor = (score: string): string => {
  const colors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };
  return colors[score as keyof typeof colors] || 'bg-gray-500';
};

export const calculateLeadDataHealth = (lead: any): number => {
  
  let filledFields = 0;
  const totalWeightedFields = 15;

  // Helper to safely check string fields (camelCase or snake_case)
  const hasField = (camelCase: string, snakeCase: string) => {
    const camelVal = lead[camelCase];
    const snakeVal = lead[snakeCase];
    const value = camelVal ?? snakeVal;
    
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0;
    }
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
  };

  // Essential fields - these are the minimum
  if (hasField('clientName', 'client_name')) filledFields += 1;
  if (hasField('email', 'email')) filledFields += 1;
  if (hasField('phone', 'phone')) filledFields += 1;

  // Important fields
  if (hasField('destination', 'destination')) filledFields += 1;
  
  const travelDates = lead.travelDates ?? lead.travel_dates;
  if (travelDates) {
    try {
      const dates = typeof travelDates === 'string' ? JSON.parse(travelDates) : travelDates;
      if (dates?.from && dates?.to) filledFields += 1;
    } catch {
      // ignore parse errors
    }
  }
  
  const persons = lead.persons ?? lead.person;
  if (persons && persons > 0) filledFields += 1;
  
  const budget = lead.budget ?? lead.budget;
  if (budget && budget > 0) filledFields += 1;

  // Additional details
  const adults = lead.adults ?? lead.adults;
  if (adults && adults > 0) filledFields += 1;
  
  const kids = lead.kids ?? lead.kids;
  if (kids !== undefined && kids !== null && kids >= 0) filledFields += 1;
  
  if (hasField('tourType', 'tour_type')) filledFields += 1;
  if (hasField('specialRequests', 'special_requests')) filledFields += 1;
  if (hasField('transportPreference', 'transport_preference')) filledFields += 1;
  if (hasField('hotelPreference', 'hotel_preference')) filledFields += 1;

  // Hotel info
  const hotelOptions = lead.hotelOptions ?? lead.hotel_options;
  if (hotelOptions && Array.isArray(hotelOptions) && hotelOptions.length > 0) {
    filledFields += 2;
  } else {
    const hotelInfo = lead.hotelInfo ?? lead.hotel_info;
    if (hotelInfo) filledFields += 1;
  }

  const destinations = lead.destinations ?? lead.destinations;
  if (destinations && Array.isArray(destinations) && destinations.length > 1) {
    filledFields += 1;
  }

  // Calculate percentage with minimum of 10% if phone exists
  const healthScore = Math.round((filledFields / totalWeightedFields) * 100);
  const phoneValue = lead.phone ?? lead.phone_number ?? lead.contact_number;
  const hasPhone = !!phoneValue && String(phoneValue).trim().length > 0;
  
  // ALWAYS log to window object for manual inspection
  (window as any).__lastHealthCalc = {
    leadName: lead.clientName || lead.client_name || 'Unknown',
    filledFields,
    totalFields: totalWeightedFields,
    healthScore,
    hasPhone,
    phoneValue,
    finalResult: hasPhone ? Math.max(healthScore, 10) : healthScore
  };
  
  // If lead has a phone (which is required), minimum health is 10%
  // If no phone, health is 0%
  if (hasPhone) {
    return Math.max(healthScore, 10);
  }
  
  return Math.min(healthScore, 100);
};

export const getDataHealthColor = (healthScore: number): { bg: string; text: string; label: string } => {
  if (healthScore === 0) return { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', label: 'Empty' };
  if (healthScore < 33) return { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200', label: 'Low' };
  if (healthScore < 66) return { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', label: 'Medium' };
  return { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', label: 'High' };
};

export const getLeadLifecycleState = (lead: {
  potential?: boolean;
  temperature?: string;
  status?: string;
  pipelineStage?: string;
  leadOutcome?: string | null;
}): LeadLifecycleState => {
  if (lead.potential) return 'potential';
  if (lead.leadOutcome === 'confirmed') return 'confirmed';
  if (lead.status === 'spam') return 'spam';
  // Only use temperature value if explicitly set to 'dead' - don't auto-set from status
  if (lead.temperature === 'dead') return 'dead';
  if (lead.pipelineStage === 'confirmed' || lead.status === 'booked') return 'confirmed';

  const inProgressStages = new Set([
    'contacted',
    'interested',
    'negotiation',
    'availability_check',
    'quoted',
    'payment_pending',
    'on_trip'
  ]);

  if (lead.pipelineStage && inProgressStages.has(lead.pipelineStage)) return 'in_progress';
  if (lead.status && inProgressStages.has(lead.status)) return 'in_progress';

  return 'new';
};

export const KARACHI_TIME_ZONE = 'Asia/Karachi';

export const parseKarachiDateTimeToISOString = (localDateTime: string) => {
  if (!localDateTime) return new Date().toISOString();
  if (localDateTime.includes('Z') || /[+-][0-9]{2}:[0-9]{2}$/.test(localDateTime)) {
    return new Date(localDateTime).toISOString();
  }
  const offsetDateTime = `${localDateTime}:00+05:00`;
  return new Date(offsetDateTime).toISOString();
};

export const formatKarachiDateTime = (dateTime: string) => {
  try {
    return new Date(dateTime).toLocaleString('en-PK', {
      timeZone: KARACHI_TIME_ZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return new Date(dateTime).toLocaleString();
  }
};

const getDayOrdinal = (day: number) => {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

export const formatKarachiFollowUpReminder = (dateTime: string) => {
  try {
    const value = new Date(dateTime);
    if (Number.isNaN(value.getTime())) return 'Unknown date';

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: KARACHI_TIME_ZONE,
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).formatToParts(value);

    const dayPart = parts.find((part) => part.type === 'day')?.value || '';
    const monthPart = parts.find((part) => part.type === 'month')?.value || '';
    const hourPart = parts.find((part) => part.type === 'hour')?.value || '';
    const minutePart = parts.find((part) => part.type === 'minute')?.value || '';
    const day = Number(dayPart);
    const ordinal = Number.isFinite(day) ? getDayOrdinal(day) : 'th';

    return `Follow up on ${dayPart}${ordinal} ${monthPart} ${hourPart}:${minutePart}`;
  } catch {
    return new Date(dateTime).toLocaleString();
  }
};

export const getKarachiLocalDateTimeString = (date: Date) => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const karachi = new Date(utc + 5 * 60 * 60000);
  return karachi.toISOString().slice(0, 16);
};

export const getLeadLifecycleStyle = (lead: {
  potential?: boolean;
  temperature?: string;
  status?: string;
  pipelineStage?: string;
}) => {
  const state = getLeadLifecycleState(lead);

  const styles: Record<LeadLifecycleState, { badge: string; ring: string; row: string; label: string }> = {
    potential: {
      badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      ring: 'ring-green-400/70 dark:ring-green-500/50',
      row: 'border-green-300 bg-green-50/70 dark:border-green-800 dark:bg-green-950/20',
      label: 'Potential'
    },
    in_progress: {
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      ring: 'ring-amber-400/70 dark:ring-amber-500/50',
      row: 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20',
      label: 'In Progress'
    },
    dead: {
      badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
      ring: 'ring-slate-400/70 dark:ring-slate-500/50',
      row: 'border-slate-300 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/30',
      label: 'Dead'
    },
    confirmed: {
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      ring: 'ring-blue-400/70 dark:ring-blue-500/50',
      row: 'border-blue-300 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/20',
      label: 'Confirmed'
    },
    spam: {
      badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
      ring: 'ring-rose-400/70 dark:ring-rose-500/50',
      row: 'border-rose-300 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/20',
      label: 'Spam'
    },
    new: {
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      ring: 'ring-slate-300/70 dark:ring-slate-600/50',
      row: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
      label: 'New'
    }
  };

  return { state, ...styles[state] };
};

export const generateBookingReference = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TRX-${timestamp}-${random}`;
};
