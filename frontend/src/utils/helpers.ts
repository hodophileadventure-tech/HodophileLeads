import type { LeadTemperature } from '../types';

export type LeadLifecycleState = 'potential' | 'in_progress' | 'dead' | 'confirmed' | 'new';

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
    canceled: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100'
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

export const getLeadLifecycleState = (lead: {
  potential?: boolean;
  temperature?: string;
  status?: string;
  pipelineStage?: string;
  leadOutcome?: string | null;
}): LeadLifecycleState => {
  if (lead.potential) return 'potential';
  if (lead.leadOutcome === 'confirmed') return 'confirmed';
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
