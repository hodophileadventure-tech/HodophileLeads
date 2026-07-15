import React from 'react';
import { formatDate, formatCurrency, getStatusColor, getKarachiLocalDateTimeString, getLeadLifecycleStyle, parseKarachiDateTimeToISOString } from '../utils/helpers';
import type { Lead } from '../types';
import { Badge } from './common';
import { availabilityAPI, leadsAPI, followUpsAPI } from '../utils/api-service';
import { Modal, Button } from './common';
import { useDataStore } from '../context/store';

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onClick }) => {
  const [tab, setTab] = React.useState<'overview' | 'availability'>('overview');
  const [availability, setAvailability] = React.useState<any>(null);
  const [health, setHealth] = React.useState<{ score: number; health: 'red' | 'yellow' | 'green' } | null>(null);
  const [now, setNow] = React.useState(Date.now());
  const [showReminderModal, setShowReminderModal] = React.useState(false);
  const [reminderTitle, setReminderTitle] = React.useState('');
  const [reminderWhen, setReminderWhen] = React.useState('');
  const [reminderNote, setReminderNote] = React.useState('');
  const [showHotelModal, setShowHotelModal] = React.useState(false);
  const [hotelForm, setHotelForm] = React.useState({
    hotelName: lead.hotelInfo?.hotelName || '',
    roomType: lead.hotelInfo?.roomType || '',
    roomPrice: lead.hotelInfo?.roomPrice || 0
  });
  const notifications = useDataStore((s) => s.notifications);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const loadMeta = async () => {
      try {
        const availabilityResponse = await availabilityAPI.getByLeadId(lead.id);
        const healthResponse = await leadsAPI.getHealth(lead.id);
        
        setAvailability(availabilityResponse.data);
        setHealth(healthResponse.data);
      } catch {
        setAvailability(null);
      }
    };
    loadMeta();
  }, [lead.id]);

  const holdExpiryText = React.useMemo(() => {
    if (!availability?.hold_expiry) return null;
    const msLeft = new Date(availability.hold_expiry).getTime() - now;
    if (msLeft <= 0) return 'Hold expired';
    const hours = Math.floor(msLeft / (1000 * 60 * 60));
    const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m left`;
  }, [availability?.hold_expiry, now]);

  const followUps = useDataStore((s) => s.followUps);
  const nextFollowUp = React.useMemo(() => {
    const pending = followUps
      .filter((item) => String(item.leadId) === String(lead.id))
      .filter((item) => item.status !== 'completed' && item.status !== 'canceled')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return pending[0] || null;
  }, [followUps, lead.id]);

  const followUpBadge = React.useMemo(() => {
    if (!nextFollowUp) return null;
    const dueAt = new Date(nextFollowUp.dueDate).getTime();
    const diffMs = dueAt - Date.now();
    if (Number.isNaN(dueAt)) return null;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    let label = 'Follow-up scheduled';
    if (diffMs <= 0) {
      label = 'Follow-up overdue';
    } else if (days > 0) {
      label = `Follow-up scheduled • in ${days}d ${hours}h`;
    } else if (hours > 0) {
      label = `Follow-up scheduled • in ${hours}h ${minutes}m`;
    } else {
      label = `Follow-up scheduled • in ${minutes}m`;
    }
    return label;
  }, [nextFollowUp]);

  const healthColor = health?.health === 'green'
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : health?.health === 'yellow'
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

  const createdAtDate = React.useMemo(() => {
    const value = lead.createdAt;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(value);
  }, [lead.createdAt]);

  const lifecycle = getLeadLifecycleStyle(lead);

  return (
    <div className={`card hover:shadow-lg transition-all ${lifecycle.ring}`}>
      {/* show unread notification badge for this lead */}
      {notifications.some((n: any) => !n.is_read && n.leadId === lead.id) && (
        <div className="absolute -top-1 -right-1">
          <span className="inline-block w-3 h-3 bg-red-600 rounded-full" />
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg break-words">{lead.clientName}</h3>
            {(lead as any).islamabadStay && (
              <span className={`text-xs px-2 py-1 rounded font-medium ${(lead as any).islamabadStay === 'yes' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                Islamabad: {(lead as any).islamabadStay === 'yes' ? '✓ Yes' : '✗ No'}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <p className="text-sm text-slate-600 dark:text-slate-400">📍 {lead.destination} {lead.travelDates?.from ? '• ' + new Date(lead.travelDates.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + new Date(lead.travelDates.to || lead.travelDates.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Created: {createdAtDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {createdAtDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
            {followUpBadge && (
              <p className="text-xs text-blue-700 dark:text-blue-200">{followUpBadge}</p>
            )}
            {lead.destinations && lead.destinations.length > 1 && (
              <p className="text-xs text-slate-500">+{lead.destinations.length - 1} more destinations</p>
            )}
          </div>
          {lead.hotelInfo && (
            <p className="text-xs text-slate-500 mt-1 truncate">
              {lead.hotelInfo.hotelName} · {formatCurrency(lead.hotelInfo.roomPrice)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge color={lifecycle.badge}>
            {lifecycle.label.toUpperCase()}
          </Badge>
          {health && <Badge color={healthColor}>Health {health.score}%</Badge>}
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={`text-xs px-2 py-1 rounded ${tab === 'overview' ? 'bg-primary-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab('availability')}
          className={`text-xs px-2 py-1 rounded ${tab === 'availability' ? 'bg-primary-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
          Availability
        </button>
      </div>

      {tab === 'overview' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-sm">
        <div className="min-w-0">
          <p className="text-slate-600 dark:text-slate-400">Email</p>
          <p className="font-medium break-all">{lead.email}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-600 dark:text-slate-400">Phone</p>
          <p className="font-medium break-all">{lead.phone}</p>
        </div>
        <div className="min-w-0">
          <p className="text-slate-600 dark:text-slate-400">Travel Date</p>
          <p className="font-medium text-xs sm:text-sm break-words">
            {lead.travel_date ? formatDate(lead.travel_date) : 'Not set'}
          </p>
        </div>
        <div>
          <p className="text-slate-600 dark:text-slate-400">Budget</p>
          <p className="font-medium">{formatCurrency(lead.budget)}</p>
        </div>
        <div>
          <p className="text-slate-600 dark:text-slate-400">Created Date</p>
          <p className="font-medium text-xs sm:text-sm">{formatDate(lead.createdAt)}</p>
        </div>
        <div>
          <p className="text-slate-600 dark:text-slate-400">Tour Type</p>
          <p className="font-medium">{lead.tourType ? lead.tourType.charAt(0).toUpperCase() + lead.tourType.slice(1) : 'Not set'}</p>
        </div>
        <div>
          <p className="text-slate-600 dark:text-slate-400">Source</p>
          <p className="font-medium capitalize">{lead.source || 'Direct'}</p>
        </div>
        {lead.agentRemarks && (
          <div className="sm:col-span-2">
            <p className="text-slate-600 dark:text-slate-400">Agent Remarks</p>
            <p className="font-medium text-xs break-words">{lead.agentRemarks}</p>
          </div>
        )}
        {lead.hotelInfo && (
          <div className="sm:col-span-2 rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-slate-600 dark:text-slate-400">Hotel Details</p>
              <button type="button" onClick={() => setShowHotelModal(true)} className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700">Edit</button>
            </div>
            <p className="font-medium">{lead.hotelInfo.hotelName}</p>
            <p className="text-xs text-slate-500">{lead.hotelInfo.roomType} · {formatCurrency(lead.hotelInfo.roomPrice)}</p>
          </div>
        )}
      </div>
      )}

      {tab === 'availability' && (
        <div className="space-y-2 mb-3 text-sm">
          <div className="flex justify-between"><span>Hotel</span><span className="capitalize">{availability?.hotel_status || 'not_checked'}</span></div>
          <div className="flex justify-between"><span>Transport</span><span className="capitalize">{availability?.transport_status || 'not_checked'}</span></div>
          <div className="flex justify-between"><span>Guide</span><span className="capitalize">{availability?.guide_status || 'not_checked'}</span></div>
          {holdExpiryText && (
            <div className={`text-xs font-medium ${holdExpiryText === 'Hold expired' ? 'text-red-500' : 'text-amber-500'}`}>
              Hold Timer: {holdExpiryText}
              {holdExpiryText !== 'Hold expired' && availability?.hold_expiry && new Date(availability.hold_expiry).getTime() - Date.now() <= 2 * 60 * 60 * 1000 ? ' (Expiry alert)' : ''}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge color={getStatusColor(lead.status)}>
          {lead.status.replace('_', ' ').toUpperCase()}
        </Badge>
        <button
          type="button"
          onClick={() => {
            setReminderTitle('Follow up with client');
            setReminderWhen(getKarachiLocalDateTimeString(new Date(Date.now() + 24 * 3600 * 1000)));
            setReminderNote('');
            setShowReminderModal(true);
          }}
          className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 ml-2"
        >
          Add Reminder
        </button>

        {showReminderModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 w-full max-w-md">
              <h3 className="font-semibold mb-2">Schedule Reminder</h3>
              <label className="block text-xs text-slate-600">Title</label>
              <input value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} className="w-full p-2 rounded mb-2 bg-slate-50 dark:bg-slate-700" />
              <label className="block text-xs text-slate-600">Due (local datetime)</label>
              <input type="datetime-local" value={reminderWhen} onChange={(e) => setReminderWhen(e.target.value)} className="w-full p-2 rounded mb-4 bg-slate-50 dark:bg-slate-700" />
              <label className="block text-xs text-slate-600">Note</label>
              <textarea value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} className="w-full p-2 rounded mb-4 bg-slate-50 dark:bg-slate-700" rows={4} placeholder="Add a note for this follow-up" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowReminderModal(false)} className="px-3 py-1 rounded bg-slate-200">Cancel</button>
                <button onClick={async () => {
                  // client-side validation
                  if (!reminderTitle || reminderTitle.trim().length < 2) {
                    alert('Please enter a title for the reminder (at least 2 characters).');
                    return;
                  }
                  if (!reminderWhen) {
                    alert('Please choose a due date/time.');
                    return;
                  }
                  if (!reminderNote || reminderNote.trim().length < 2) {
                    alert('Please enter a note for the reminder (at least 2 characters).');
                    return;
                  }
                  try {
                    const iso = parseKarachiDateTimeToISOString(reminderWhen);
                    await followUpsAPI.create({ leadId: lead.id, title: reminderTitle, description: reminderNote.trim(), dueDate: iso, assignedTo: lead.agentId });
                    setShowReminderModal(false);
                    alert('Reminder scheduled');
                  } catch (err: any) {
                    const msg = err?.response?.data?.message || err?.message || 'Failed to create reminder';
                    alert(msg);
                  }
                }} className="px-3 py-1 rounded bg-primary-500 text-white">Save</button>
              </div>
            </div>
          </div>
        )}
        <span className="text-xs text-slate-500">
          {Math.ceil((new Date().getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))}d ago
        </span>
        {onClick && (
          <button
            type="button"
            onClick={onClick}
            className="ml-auto text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            Open
          </button>
        )}
      </div>

      <Modal
        isOpen={showHotelModal}
        onClose={() => setShowHotelModal(false)}
        title="Edit Hotel Details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowHotelModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={async () => {
              try {
                await leadsAPI.update(lead.id, { hotelInfo: hotelForm });
                setShowHotelModal(false);
                window.location.reload();
              } catch (e) {
                alert('Failed to update hotel details');
              }
            }}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Hotel Name</label>
            <input className="input-field" value={hotelForm.hotelName} onChange={(e) => setHotelForm((s) => ({ ...s, hotelName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm mb-1">Room Type</label>
            <input className="input-field" value={hotelForm.roomType} onChange={(e) => setHotelForm((s) => ({ ...s, roomType: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm mb-1">Room Price</label>
            <input type="number" className="input-field" value={hotelForm.roomPrice} onChange={(e) => setHotelForm((s) => ({ ...s, roomPrice: Number(e.target.value) }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

interface LeadListProps {
  leads: Lead[];
  onSelectLead?: (lead: Lead) => void;
}

export const LeadList: React.FC<LeadListProps> = ({ leads, onSelectLead }) => {
  if (leads.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-slate-600 dark:text-slate-400">No leads found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onClick={() => onSelectLead?.(lead)} />
      ))}
    </div>
  );
};
