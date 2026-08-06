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

const allowedStatuses = new Set(['new', 'contacted', 'interested', 'negotiation', 'booked', 'completed', 'canceled', 'spam', 'potential', 'in_progress']);

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

export const buildLeadExportFilters = (options: LeadExportFilterOptions, startIndex = 1): LeadExportFilterResult => {
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
  let index = startIndex;

  if (statusFilter) {
    if (statusFilter === 'potential') {
      clauses.push("l.potential = true AND l.status NOT IN ('booked', 'completed', 'canceled', 'negotiation', 'interested', 'contacted')");
    } else if (statusFilter === 'in_progress') {
      clauses.push("l.status IN ('negotiation', 'interested', 'contacted')");
    } else {
      clauses.push(`l.status = $${index}`);
      params.push(statusFilter);
      index += 1;
    }
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
    whereClause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
};
