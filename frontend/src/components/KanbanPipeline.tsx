import React, { useMemo } from 'react';
import type { Lead } from '../types';
import { LeadCard } from './LeadCard';
import { getLeadLifecycleStyle, getLeadLifecycleState } from '../utils/helpers';
import { followUpsAPI } from '../utils/api-service';
import { normalizeFollowUp } from '../utils/followup-utils';

interface KanbanPipelineProps {
  leads: Lead[];
  onSelectLead?: (lead: Lead) => void;
  onMoveStage: (leadId: string, stage: string) => Promise<void>;
}

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'new_label', label: 'New Leads' },
  { key: 'new_lead', label: 'New Lead' },
  { key: 'availability_check', label: 'Availability Check' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'payment_pending', label: 'Payment Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'on_trip', label: 'On Trip' },
  { key: 'completed', label: 'Completed' }
];

export const KanbanPipeline: React.FC<KanbanPipelineProps> = ({ leads, onSelectLead, onMoveStage }) => {
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [overdueLeadIds, setOverdueLeadIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await followUpsAPI.list();
        const now = Date.now();
        const normalized = (res.data || []).map(normalizeFollowUp);
        const ids = normalized
          .filter((f: any) => f.status !== 'completed' && new Date(f.dueDate || f.due_date).getTime() < now)
          .map((f: any) => String(f.leadId || f.lead_id));
        setOverdueLeadIds(Array.from(new Set(ids)));
      } catch (e) {
        setOverdueLeadIds([]);
      }
    };
    load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, []);

  const grouped = useMemo(() => {
    const bucket: Record<string, Lead[]> = {};
    for (const col of COLUMNS) {
      bucket[col.key] = [];
    }

    const visibleLeads = overdueOnly ? leads.filter((lead) => overdueLeadIds.includes(lead.id)) : leads;

    for (const lead of visibleLeads) {
      const lifecycleState = getLeadLifecycleState(lead);
      if (lifecycleState === 'new') {
        bucket.new_label.push(lead);
        continue;
      }
      const stage = (lead.pipelineStage || (lead as any).pipeline_stage || 'new_lead') as string;
      const target = bucket[stage] ? stage : 'new_label';
      bucket[target].push(lead);
    }

    return bucket;
  }, [leads, overdueOnly, overdueLeadIds]);

  const onDropCard = async (e: React.DragEvent<HTMLDivElement>, stage: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/leadId');
    if (!leadId) return;
    await onMoveStage(leadId, stage);
  };

  return (
    <div className="space-y-4">
      {/* Premium Filter Bar */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <span className="text-sm font-semibold text-slate-700">View:</span>
        <button 
          onClick={() => setOverdueOnly(false)} 
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            !overdueOnly 
              ? 'bg-amber-500 text-white shadow-md hover:shadow-lg' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All Leads
        </button>
        <button 
          onClick={() => setOverdueOnly(true)} 
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            overdueOnly 
              ? 'bg-red-500 text-white shadow-md hover:shadow-lg animate-pulse' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span className="text-lg">⚠️</span>
          Overdue ({overdueLeadIds.length})
        </button>
      </div>

      {/* Kanban Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-4 min-w-[1200px] xl:min-w-0">
          {COLUMNS.map((column) => (
            <div
              key={column.key}
              className="kanban-column flex flex-col min-h-[500px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropCard(e, column.key)}
            >
              {/* Column Header */}
              <div className="kanban-column-header sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wide">{column.label}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-white rounded-full text-xs font-bold text-slate-700 border border-slate-300">
                      {grouped[column.key].length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Column Cards */}
              <div className="flex-1 overflow-y-auto space-y-3 p-3">
                {grouped[column.key].map((lead) => {
                  const lifecycle = getLeadLifecycleStyle(lead as any);
                  const overdueClass = overdueLeadIds.includes(lead.id) 
                    ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse' 
                    : '';
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/leadId', lead.id)}
                      className="transition-transform hover:scale-105 active:scale-95"
                    >
                      <div className={`${overdueClass}`.trim()}>
                        <LeadCard lead={lead} onClick={() => onSelectLead?.(lead)} />
                      </div>
                    </div>
                  );
                })}
                
                {/* Empty State */}
                {grouped[column.key].length === 0 && (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <div className="text-center">
                      <p className="text-sm">No leads</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
