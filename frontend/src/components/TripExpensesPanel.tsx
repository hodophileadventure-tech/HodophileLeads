import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BadgeCheck, Building2, CircleDollarSign, Search, Save, TrendingUp, Wallet } from 'lucide-react';
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

  const portfolio = useMemo(() => {
    const savedLeads = leads.filter((lead) => lead.hasExpenses);
    const recordedCost = savedLeads.reduce((sum, lead) => sum + getExpenseTotal(toDraft(lead)), 0);
    const recordedProfit = savedLeads.reduce((sum, lead) => (
      lead.soldPrice == null ? sum : sum + lead.soldPrice - getExpenseTotal(toDraft(lead))
    ), 0);

    return { savedLeads: savedLeads.length, recordedCost, recordedProfit };
  }, [leads]);

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

  const metrics = [
    { label: 'Confirmed bookings', value: String(leads.length), note: 'Current portfolio', icon: Building2, tint: 'bg-amber-50 text-amber-800' },
    { label: 'Cost sheets saved', value: `${portfolio.savedLeads} / ${leads.length}`, note: `${leads.length - portfolio.savedLeads} still to record`, icon: BadgeCheck, tint: 'bg-emerald-50 text-emerald-800' },
    { label: 'Recorded trip costs', value: currency(portfolio.recordedCost), note: 'Saved bookings only', icon: Wallet, tint: 'bg-sky-50 text-sky-800' },
    { label: 'Net profit', value: currency(portfolio.recordedProfit), note: 'Invoice less recorded costs', icon: TrendingUp, tint: 'bg-lime-50 text-lime-900' }
  ];

  return (
    <section className="trip-expenses-panel space-y-6">
      <header className="relative overflow-hidden border-b border-emerald-200 pb-5">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[linear-gradient(120deg,transparent,rgba(16,185,129,0.07))] md:block" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Travel finance
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-950">Trip expenses</h1>
            <p className="mt-2 text-sm text-slate-600">Confirmed bookings <span className="px-1 text-slate-300">/</span> Cost and margin overview</p>
          </div>
          <label className="relative w-full md:max-w-sm">
            <span className="sr-only">Search confirmed leads</span>
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search client, phone, destination"
            />
          </label>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {saved && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"><BadgeCheck size={17} /> Trip expenses saved.</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                  <p className="mt-2 truncate text-xl font-bold tabular-nums text-slate-950">{metric.value}</p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.tint}`}><Icon size={18} strokeWidth={1.8} /></span>
              </div>
              <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-500">{metric.note}</p>
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.75fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">Bookings</p>
              <h2 className="mt-1 text-base font-bold text-slate-950">Confirmed leads</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tabular-nums text-slate-700">{filteredLeads.length} shown</span>
          </div>

          {loading ? (
            <div className="flex min-h-52 items-center justify-center text-sm text-slate-500">Loading confirmed bookings…</div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Building2 size={21} /></span>
              <p className="mt-3 text-sm font-semibold text-slate-800">No confirmed bookings found</p>
              <p className="mt-1 text-xs text-slate-500">Try another search.</p>
            </div>
          ) : (
            <div className="max-h-[72vh] divide-y divide-slate-100 overflow-y-auto">
              {filteredLeads.map((lead) => {
                const leadCost = getExpenseTotal(toDraft(lead));
                const leadProfit = lead.soldPrice == null ? null : lead.soldPrice - leadCost;
                const selected = selectedLead?.leadId === lead.leadId;

                return (
                  <button
                    key={lead.leadId}
                    type="button"
                    onClick={() => selectLead(lead)}
                    aria-pressed={selected}
                    className={`group block w-full px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 sm:px-5 ${selected ? 'bg-emerald-50/70' : 'bg-white hover:bg-slate-50/80'}`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${selected ? 'bg-emerald-900 text-white' : 'bg-amber-100 text-amber-950'}`}>
                          {(lead.clientName || '?').trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950">{lead.clientName || 'Unnamed client'}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{[lead.destination, lead.phone].filter(Boolean).join(' · ') || 'Booking details unavailable'}</p>
                        </div>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${lead.hasExpenses ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${lead.hasExpenses ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                        {lead.hasExpenses ? 'Saved' : 'Pending'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200/80 pt-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Invoice</p>
                        <p className="mt-1 truncate text-xs font-semibold tabular-nums text-slate-800 sm:text-sm">{lead.soldPrice == null ? '—' : currency(lead.soldPrice)}</p>
                      </div>
                      <div className="min-w-0 border-l border-slate-200 pl-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Trip cost</p>
                        <p className="mt-1 truncate text-xs font-semibold tabular-nums text-slate-800 sm:text-sm">{lead.hasExpenses ? currency(leadCost) : '—'}</p>
                      </div>
                      <div className="min-w-0 border-l border-slate-200 pl-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Net profit</p>
                        <p className={`mt-1 truncate text-xs font-bold tabular-nums sm:text-sm ${leadProfit != null && leadProfit < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                          {lead.hasExpenses && leadProfit != null ? currency(leadProfit) : '—'}
                        </p>
                      </div>
                    </div>
                    <span className="sr-only">Open expense sheet</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          {!selectedLead ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-950 text-amber-300"><CircleDollarSign size={25} strokeWidth={1.7} /></span>
              <p className="mt-4 text-base font-bold text-slate-950">Expense worksheet</p>
              <p className="mt-1 max-w-xs text-sm text-slate-500">Choose a booking to view its financial breakdown.</p>
            </div>
          ) : (
            <>
              <div className="trip-expense-hero bg-emerald-950 px-5 py-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-amber-300">Cost breakdown</p>
                    <h2 className="mt-2 truncate text-xl font-bold text-white">{selectedLead.clientName || 'Unnamed client'}</h2>
                    <p className="mt-1 truncate text-sm text-emerald-100/75">{[selectedLead.destination, selectedLead.phone].filter(Boolean).join(' · ') || 'Booking details unavailable'}</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-amber-300"><CircleDollarSign size={21} /></span>
                </div>
                <div className="mt-5 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-4">
                  <div className="min-w-0 pr-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/70">Invoice</p>
                    <p className="trip-expense-hero-value mt-1 truncate text-sm font-semibold tabular-nums text-white">{selectedLead.soldPrice == null ? 'Unavailable' : currency(selectedLead.soldPrice)}</p>
                  </div>
                  <div className="min-w-0 px-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/70">Trip cost</p>
                    <p className="trip-expense-hero-value mt-1 truncate text-sm font-semibold tabular-nums text-white">{currency(totalCost)}</p>
                  </div>
                  <div className="min-w-0 pl-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/70">Net profit</p>
                    <p className={`mt-1 truncate text-sm font-bold tabular-nums ${netProfit != null && netProfit < 0 ? 'text-rose-300' : 'text-amber-300'}`}>{netProfit == null ? 'Unavailable' : currency(netProfit)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Trip costs</h3>
                    <p className="mt-1 text-xs text-slate-500">Amounts in PKR</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${selectedLead.hasExpenses ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                    {selectedLead.hasExpenses ? 'Saved sheet' : 'New sheet'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                  {expenseFields.map((field) => (
                    <label key={field.key} className="block min-w-0 text-xs font-semibold text-slate-700">
                      {field.label}
                      <span className="mt-1.5 flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-white transition focus-within:border-emerald-700 focus-within:ring-4 focus-within:ring-emerald-700/10">
                        <span className="border-r border-slate-100 px-2.5 text-[10px] font-semibold text-slate-400">PKR</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 text-sm font-semibold tabular-nums text-slate-900 outline-none focus:ring-0"
                          value={draft[field.key]}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.key]: Math.max(0, Number(event.target.value) || 0) }))}
                        />
                      </span>
                    </label>
                  ))}
                </div>

                <label className="block text-xs font-semibold text-slate-700">
                  Other expense details
                  <input
                    type="text"
                    maxLength={500}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
                    value={draft.otherExpenseNote}
                    onChange={(event) => setDraft((current) => ({ ...current, otherExpenseNote: event.target.value }))}
                    placeholder="Optional note"
                  />
                </label>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <p className="text-xs text-slate-500">Total trip cost <span className="ml-1 font-bold tabular-nums text-slate-900">{currency(totalCost)}</span></p>
                  <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500 bg-amber-400 px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30 disabled:cursor-wait disabled:opacity-60">
                    <Save size={16} aria-hidden="true" />
                    {saving ? 'Saving…' : selectedLead.hasExpenses ? 'Save changes' : 'Save expenses'}
                    {!saving && <ArrowUpRight size={15} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
};