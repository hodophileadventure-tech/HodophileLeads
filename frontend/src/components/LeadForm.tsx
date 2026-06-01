import React, { useEffect, useState } from 'react';
import { leadsAPI } from '../utils/api-service';
import type { Lead } from '../types';
import { Button, Modal } from './common';

interface LeadFormProps {
  onSuccess?: (lead: Lead) => void;
  initialData?: Partial<Lead>;
  onOpenChange?: (isOpen: boolean) => void;
}

export const LeadForm: React.FC<LeadFormProps> = ({ onSuccess, initialData, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<any>(
    initialData || {
      clientName: '',
      email: '',
      phone: '',
      address: '',
      gender: '',
      age: '',
      destination: '',
      travelDates: { from: '', to: '' },
      persons: 1,
      agentRemarks: '',
      remarks: '',
      potential: false,
      leadStatus: 'new'
    }
  );

  useEffect(() => {
    if (initialData) {
      setFormData({
        clientName: initialData.clientName || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        address: initialData.address || '',
        gender: (initialData as any).gender || '',
        age: (initialData as any).age ?? '',
        destination: initialData.destination || '',
        travelDates: initialData.travelDates || { from: '', to: '' },
        persons: initialData.persons || 1,
        agentRemarks: (initialData as any).agentRemarks || '',
        remarks: (initialData as any).remarks || '',
        potential: (initialData as any).potential || false,
        leadStatus: (initialData as any).potential ? 'potential' : (initialData as any).pipelineStage === 'confirmed' || (initialData as any).status === 'booked' ? 'confirmed' : (initialData as any).status === 'completed' ? 'dead' : 'new'
      });
    }
  }, [initialData]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTravelDateChange = (field: 'from' | 'to', value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      travelDates: {
        ...prev.travelDates!,
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const gender = typeof (formData as any).gender === 'string' && (formData as any).gender.trim()
        ? (formData as any).gender.trim()
        : undefined;

      const payload = {
        clientName: formData.clientName,
        email: formData.email,
        phone: formData.phone,
        address: (formData as any).address,
        gender,
        destination: formData.destination,
        travelDates: formData.travelDates,
        persons: formData.persons,
        agentRemarks: (formData as any).agentRemarks,
        remarks: (formData as any).remarks,
        potential: (formData as any).potential
      };

      const ageValue = (formData as any).age;
      if (ageValue !== '' && ageValue !== null && ageValue !== undefined) {
        (payload as any).age = typeof ageValue === 'number' ? ageValue : parseInt(String(ageValue), 10);
      }

      // Map selected leadStatus into payload fields
      const status = (formData as any).leadStatus || 'new';
      if (status === 'potential') {
        payload.potential = true;
      } else {
        payload.potential = false;
      }

      if (status === 'dead') {
        // mark as completed/dead
        (payload as any).status = 'completed';
      } else if (status === 'confirmed') {
        (payload as any).pipelineStage = 'confirmed';
      } else if (status === 'in_progress') {
        (payload as any).pipelineStage = (formData as any).pipelineStage || 'contacted';
      } else if (status === 'new') {
        (payload as any).pipelineStage = (formData as any).pipelineStage || 'new_lead';
      }

      if (initialData?.id) {
        const response = await leadsAPI.update(initialData.id, payload);
        onSuccess?.(response.data as Lead);
      } else {
        const response = await leadsAPI.create(payload);
        onSuccess?.(response.data as Lead);
      }
      setIsOpen(false);
      onOpenChange?.(false);
      setFormData({
        clientName: '',
        email: '',
        phone: '',
        address: '',
        gender: '',
        age: '',
        destination: '',
        travelDates: { from: '', to: '' },
        persons: 1,
        agentRemarks: '',
        remarks: '',
        potential: false
      });
    } catch (error) {
      console.error('Form submission error:', error);
      setError('Could not create lead. Please check all fields and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => { setIsOpen(true); onOpenChange?.(true); }} variant="primary">
        {initialData ? 'Edit Lead' : 'New Lead'}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); onOpenChange?.(false); }}
        title={initialData ? 'Edit Lead' : 'Create New Lead'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => { setIsOpen(false); onOpenChange?.(false); }}>
              Cancel
            </Button>
            <Button type="submit" form="lead-form" variant="primary" loading={loading}>
              {initialData ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form id="lead-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Enter Name</label>
            <input
              type="text"
              placeholder="Client Name"
              value={formData.clientName || ''}
              onChange={(e) => handleChange('clientName', e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Enter Email</label>
            <input
              type="email"
              placeholder="Email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Enter Number</label>
            <input
              type="tel"
              placeholder="Phone"
              value={formData.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input
              type="text"
              placeholder="Address"
              value={(formData as any).address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Enter Destination</label>
            <input
              type="text"
              placeholder="Destination (e.g., Dubai, UAE)"
              value={formData.destination || ''}
              onChange={(e) => handleChange('destination', e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Enter Travel Date From</label>
              <input
                type="date"
                value={formData.travelDates?.from || ''}
                onChange={(e) => handleTravelDateChange('from', e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Enter Travel Date To</label>
              <input
                type="date"
                value={formData.travelDates?.to || ''}
                onChange={(e) => handleTravelDateChange('to', e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Enter Number of Persons</label>
            <input
              type="number"
              placeholder="Number of Persons"
              value={formData.persons || 1}
              onChange={(e) => handleChange('persons', parseInt(e.target.value || '1', 10))}
              className="input-field"
              min="1"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Gender</label>
              <select className="input-field" value={(formData as any).gender || ''} onChange={(e) => handleChange('gender', e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <input type="number" className="input-field" value={(formData as any).age ?? ''} onChange={(e) => handleChange('age', e.target.value === '' ? '' : parseInt(e.target.value, 10))} min={0} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Lead Status</label>
              <select
                className="input-field"
                value={(formData as any).leadStatus || ((formData as any).potential ? 'potential' : 'new')}
                onChange={(e) => handleChange('leadStatus', e.target.value)}
              >
                <option value="new">New</option>
                <option value="potential">Potential</option>
                <option value="in_progress">In Progress</option>
                <option value="dead">Dead</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Agent Remarks</label>
            <textarea
              placeholder="Agent remarks"
              value={(formData as any).agentRemarks || ''}
              onChange={(e) => handleChange('agentRemarks', e.target.value)}
              className="input-field"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Remarks</label>
            <textarea
              placeholder="Remarks"
              value={(formData as any).remarks || ''}
              onChange={(e) => handleChange('remarks', e.target.value)}
              className="input-field"
              rows={2}
            />
          </div>
        </form>
      </Modal>
    </>
  );
};
