export interface LeadExportFilterOptions {
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface LeadQueryFilterOptions {
  phone?: string;
  startDate?: string;
  endDate?: string;
}

export interface LeadExportFilterResult {
  whereClause: string;
  params: any[];
}

export interface LeadQueryFilterResult {
  clauses: string[];
  params: any[];
}

const allowedStatuses = new Set(['new', 'contacted', 'interested', 'negotiation', 'booked', 'completed', 'canceled', 'spam']);

export const buildLeadQueryFilters = (options: LeadQueryFilterOptions, startIndex = 1): LeadQueryFilterResult => {
  const clauses: string[] = [];
  const params: any[] = [];
  let index = startIndex;

  const phone = String(options.phone || '').trim();
  const startDate = String(options.startDate || '').trim();
  const endDate = String(options.endDate || '').trim();

  if (phone) {
    clauses.push(`l.phone ILIKE $${index}`);
    params.push(`%${phone}%`);
    index += 1;
  }

  if (startDate) {
    clauses.push(`l.created_at::date >= $${index}::date`);
    params.push(startDate);
    index += 1;
  }

  if (endDate) {
    clauses.push(`l.created_at::date <= $${index}::date`);
    params.push(endDate);
  }

  return {
    clauses,
    params
  };
};

export const buildLeadExportFilters = (options: LeadExportFilterOptions): LeadExportFilterResult => {
  const statusParam = String(options.status || '').trim().toLowerCase();
  const startDate = String(options.startDate || '').trim();
  const endDate = String(options.endDate || '').trim();

  let statusFilter: string | undefined;
  if (statusParam && statusParam !== 'all') {
    if (!allowedStatuses.has(statusParam)) {
      throw new Error('Invalid status filter');
    }
    statusFilter = statusParam;
  }

  const clauses: string[] = [];
  const params: any[] = [];

  if (statusFilter) {
    clauses.push('l.status = $1');
    params.push(statusFilter);
  }

  if (startDate) {
    clauses.push(`l.created_at::date >= $${params.length + 1}::date`);
    params.push(startDate);
  }

  if (endDate) {
    clauses.push(`l.created_at::date <= $${params.length + 1}::date`);
    params.push(endDate);
  }

  return {
    whereClause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
};
