import React, { useMemo } from 'react';
import type { Lead } from '../types';
import { LeadCard } from './LeadCard';
import { getLeadLifecycleStyle } from '../utils/helpers';
import { followUpsAPI } from '../utils/api-service';
import { normalizeFollowUp } from '../utils/followup-utils';

interface KanbanPipelineProps {
  leads: Lead[];
  onSelectLead?: (lead: Lead) => void;
  onMoveStage: (leadId: string, stage: string) => Promise<void>;
}

const COLUMNS: Array<{ key: string; label: string }> = [
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
      const stage = (lead.pipelineStage || (lead as any).pipeline_stage || 'new_lead') as string;
      const target = bucket[stage] ? stage : 'new_lead';
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
    <div className="overflow-x-auto">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setOverdueOnly(false)} className={`text-xs px-3 py-1 rounded ${!overdueOnly ? 'bg-primary-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
          All Leads
        </button>
        <button onClick={() => setOverdueOnly(true)} className={`text-xs px-3 py-1 rounded ${overdueOnly ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`}>
          Overdue Reminders ({overdueLeadIds.length})
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-4 min-w-[1200px] xl:min-w-0">
        {COLUMNS.map((column) => (
          <div
            key={column.key}
            className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 min-h-[300px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropCard(e, column.key)}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-sm">{column.label}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700">
                {grouped[column.key].length}
              </span>
            </div>
            <div className="space-y-3">
              {grouped[column.key].map((lead) => {
                const lifecycle = getLeadLifecycleStyle(lead as any);
                const wrapperClass = `${lifecycle.row} rounded-lg`;
                const overdueClass = overdueLeadIds.includes(lead.id) ? 'animate-pulse ring-2 ring-red-500' : '';
                return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/leadId', lead.id)}
                  >
                    <div className={`${wrapperClass} ${overdueClass}`.trim()}>
                      <LeadCard lead={lead} onClick={() => onSelectLead?.(lead)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
