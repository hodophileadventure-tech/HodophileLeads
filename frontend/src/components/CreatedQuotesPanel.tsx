import React, { useEffect, useState } from 'react';
import { quoteRequestsAPI } from '../utils/api-service';
import type { QuoteRequest } from '../types';
import { Button } from './common';

const CreatedQuotesPanel: React.FC<{ onOpen: (r: QuoteRequest) => void }> = ({ onOpen }) => {
  const [items, setItems] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await quoteRequestsAPI.list();
        if (!mounted) return;
        setItems((res.data || []).filter((r: QuoteRequest) => ['saved', 'created'].includes(r.status)));
        setError(null);
      } catch (err) {
        console.error('Failed to load created quotes', err);
        setError('Failed to load created quotations.');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
    const handler = () => void load();
    window.addEventListener('quote-request-saved', handler as EventListener);
    return () => { mounted = false; window.removeEventListener('quote-request-saved', handler as EventListener); };
  }, []);

  if (loading) return <div className="card"><p className="p-4">Loading created quotations...</p></div>;
  if (error) return <div className="card"><p className="p-4 text-rose-600">{error}</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">My Created Quotations</h2>
        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="card text-center p-8">No created quotations yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((r) => (
            <div key={r.id} className="p-4 border rounded hover:bg-slate-50">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{r.leadClientName || 'Unknown'}</h3>
                  <p className="text-sm text-slate-600">{r.leadPhone} • {r.requestType}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button size="sm" variant="primary" onClick={() => onOpen(r)}>Open</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatedQuotesPanel;
