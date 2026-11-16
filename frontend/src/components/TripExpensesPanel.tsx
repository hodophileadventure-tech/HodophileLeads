import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI, type TripExpenseRecord, type TripExpenseUpdate } from '../utils/api-service';
import { formatCurrency } from '../utils/helpers';

const expenseFields: { key: keyof TripExpenseUpdate; label: string }[] = [
  { key: 'hotelCost', label: 'Hotels' },
  { key: 'transportCost', label: 'Transport' },
  { key: 'fuelCost', label: 'Fuel' },
  { key: 'tollTaxesCost', label: 'Toll taxes' },
  { key: 'parkingCost', label: 'Parking' },
  { key: 'foodCost', label: 'Food' },
  { key: 'tourGuideCost', label: 'Tour guide expense' },
  { key: 'otherCost', label: 'Others' }
];

const currency = (amount: number) => formatCurrency(amount || 0);

const getExpenseTotal = (record: TripExpenseUpdate) => expenseFields.reduce(
  (total, field) => total + (field.key === 'otherExpenseNote' ? 0 : Number(record[field.key]) || 0),
  0
);

const emptyDraft = (): TripExpenseUpdate => ({
  hotelCost: 0,
  transportCost: 0,
  fuelCost: 0,
  tollTaxesCost: 0,
  parkingCost: 0,
  foodCost: 0,
  tourGuideCost: 0,
  otherCost: 0,
  otherExpenseNote: ''
});

const toDraft = (record: TripExpenseRecord): TripExpenseUpdate => ({
  hotelCost: record.hotelCost,
  transportCost: record.transportCost,
  fuelCost: record.fuelCost,
  tollTaxesCost: record.tollTaxesCost,
  parkingCost: record.parkingCost,
  foodCost: record.foodCost,
  tourGuideCost: record.tourGuideCost,
  otherCost: record.otherCost,
  otherExpenseNote: record.otherExpenseNote
});

export const TripExpensesPanel: React.FC = () => {
  const [leads, setLeads] = useState<TripExpenseRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState<TripExpenseRecord | null>(null);
  const [draft, setDraft] = useState<TripExpenseUpdate>(emptyDraft);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    adminAPI.getTripExpenses()
      .then((response) => {
        if (active) setLeads(response.data);
      })
      .catch(() => {
        if (active) setError('Could not load confirmed leads and trip expenses.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return leads;
    return leads.filter((lead) => [lead.clientName, lead.phone, lead.destination]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [leads, search]);

  const totalCost = getExpenseTotal(draft);
  const netProfit = selectedLead?.soldPrice == null ? null : selectedLead.soldPrice - totalCost;

  const selectLead = (lead: TripExpenseRecord) => {
    setSelectedLead(lead);
    setDraft(toDraft(lead));
    setError('');
    setSaved(false);
  };

  const save = async () => {
    if (!selectedLead) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await adminAPI.saveTripExpenses(selectedLead.leadId, draft);
      const updated = response.data;
      setLeads((current) => current.map((lead) => lead.leadId === updated.leadId ? updated : lead));
      setSelectedLead(updated);
      setDraft(toDraft(updated));
      setSaved(true);
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Could not save trip expenses.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Booking costs</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Trip Expenses</h1>
        </div>
        <label className="w-full sm:max-w-xs">
          <span className="sr-only">Search confirmed leads</span>
          <input
            className="input-field"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client, phone, destination"
          />
        </label>
      </header>

      {error && <div role="alert" className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {saved && <div role="status" className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Trip expenses saved.</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">Confirmed leads</h2>
            <span className="text-sm text-slate-500">{filteredLeads.length}</span>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading leads…</p>
          ) : filteredLeads.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No confirmed leads found.</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                  <tr><th className="px-4 py-3">Client</th><th className="px-4 py-3">Destination</th><th className="px-4 py-3 text-right">Invoice</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.leadId}>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => selectLead(lead)}
                          className={`text-left font-semibold hover:text-emerald-700 ${selectedLead?.leadId === lead.leadId ? 'text-emerald-700' : 'text-slate-900 dark:text-white'}`}
                        >
                          {lead.clientName || 'Unnamed client'}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">{lead.phone || 'No phone'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.destination || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                        {lead.soldPrice == null ? '—' : currency(lead.soldPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          {!selectedLead ? (
            <div className="flex min-h-56 items-center justify-center text-sm text-slate-500">Select a confirmed lead to enter trip costs.</div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected booking</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{selectedLead.clientName || 'Unnamed client'}</h2>
                <p className="text-sm text-slate-500">{selectedLead.destination || 'Destination not set'}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 border-y border-slate-200 py-4 dark:border-slate-700">
                <div><p className="text-xs text-slate-500">Invoice price</p><p className="mt-1 font-semibold">{selectedLead.soldPrice == null ? 'Unavailable' : currency(selectedLead.soldPrice)}</p></div>
                <div><p className="text-xs text-slate-500">Trip cost</p><p className="mt-1 font-semibold">{currency(totalCost)}</p></div>
                <div><p className="text-xs text-slate-500">Net profit</p><p className={`mt-1 font-bold ${netProfit != null && netProfit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{netProfit == null ? 'Unavailable' : currency(netProfit)}</p></div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {expenseFields.map((field) => (
                  <label key={field.key} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {field.label}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-field mt-1"
                      value={draft[field.key]}
                      onChange={(event) => setDraft((current) => ({ ...current, [field.key]: Math.max(0, Number(event.target.value) || 0) }))}
                    />
                  </label>
                ))}
              </div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Other expense details
                <input
                  type="text"
                  maxLength={500}
                  className="input-field mt-1"
                  value={draft.otherExpenseNote}
                  onChange={(event) => setDraft((current) => ({ ...current, otherExpenseNote: event.target.value }))}
                  placeholder="Optional note"
                />
              </label>

              <button type="button" onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-60">
                {saving ? 'Saving…' : 'Save trip expenses'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};