import React, { useEffect, useState } from 'react';
import { Button, Modal } from './common';
import { leadsAPI, paymentsAPI } from '../utils/api-service';
import type { Lead } from '../types';

interface HotelOptionForm {
  hotelName: string;
  roomType: string;
  roomPrice: number;
  checkIn: string;
  checkOut: string;
}

interface Props {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (lead: Lead) => void;
}

export const ConfirmedLeadForm: React.FC<Props> = ({ lead, isOpen, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hotelOptions, setHotelOptions] = useState<HotelOptionForm[]>(
    lead.hotelOptions && lead.hotelOptions.length > 0
      ? lead.hotelOptions.map((option) => ({
          hotelName: option.hotelName || '',
          roomType: option.roomType || '',
          roomPrice: option.roomPrice || 0,
          checkIn: option.checkIn || '',
          checkOut: option.checkOut || ''
        }))
      : [{
          hotelName: lead.hotelInfo?.hotelName || '',
          roomType: lead.hotelInfo?.roomType || '',
          roomPrice: lead.hotelInfo?.roomPrice || 0,
          checkIn: lead.hotelInfo?.checkIn || '',
          checkOut: lead.hotelInfo?.checkOut || ''
        }]
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState('');
  const [total, setTotal] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [method, setMethod] = useState('cash');

  useEffect(() => {
    setHotelOptions(
      lead.hotelOptions && lead.hotelOptions.length > 0
        ? lead.hotelOptions.map((option) => ({
            hotelName: option.hotelName || '',
            roomType: option.roomType || '',
            roomPrice: option.roomPrice || 0,
            checkIn: option.checkIn || '',
            checkOut: option.checkOut || ''
          }))
        : [{
            hotelName: lead.hotelInfo?.hotelName || '',
            roomType: lead.hotelInfo?.roomType || '',
            roomPrice: lead.hotelInfo?.roomPrice || 0,
            checkIn: lead.hotelInfo?.checkIn || '',
            checkOut: lead.hotelInfo?.checkOut || ''
          }]
    );
    setValidationError(null);
  }, [lead]);

  const handleSave = async () => {
    // Validate required fields for ALL leads - both new and existing confirmed
    setValidationError(null);

    // Check if at least one hotel option has required fields (hotelName, roomType, checkIn, checkOut)
    // Note: roomPrice is NOT mandatory
    const hasValidHotel = hotelOptions.some(
      (option) => option.hotelName && option.roomType && option.checkIn && option.checkOut
    );

    if (!hasValidHotel) {
      setValidationError('Lead is not confirmed. Please fill the hotel fields (name, room type, check-in, and check-out dates are required)');
      // If lead was already confirmed, unconfirm it
      if (lead.leadOutcome === 'confirmed' || lead.status === 'booked' || lead.pipelineStage === 'confirmed') {
        try {
          await leadsAPI.update(lead.id as string, { leadOutcome: null, status: 'contacted', pipelineStage: 'contacted' } as any);
        } catch (err) {
          console.error('Failed to unconfirm lead:', err);
        }
      }
      return;
    }

    // Check if transport/vehicle is filled
    if (!vehicle || vehicle.trim() === '') {
      setValidationError('Lead is not confirmed. Please fill the transport field');
      // If lead was already confirmed, unconfirm it
      if (lead.leadOutcome === 'confirmed' || lead.status === 'booked' || lead.pipelineStage === 'confirmed') {
        try {
          await leadsAPI.update(lead.id as string, { leadOutcome: null, status: 'contacted', pipelineStage: 'contacted' } as any);
        } catch (err) {
          console.error('Failed to unconfirm lead:', err);
        }
      }
      return;
    }

    setLoading(true);
    try {
      const validHotelOptions = hotelOptions
        .filter((option) => option.hotelName || option.roomType || option.roomPrice || option.checkIn || option.checkOut)
        .map((option) => ({
          hotelName: option.hotelName,
          roomType: option.roomType,
          roomPrice: option.roomPrice,
          checkIn: option.checkIn,
          checkOut: option.checkOut
        }));

      const updatePayload: Partial<Lead> = {
        hotelInfo: validHotelOptions[0] || null,
        hotelOptions: validHotelOptions,
        transportPreference: vehicle
      };

      // First update lead fields (hotel info, transport)
      await leadsAPI.update(lead.id as string, updatePayload);

      // If a file was selected, upload it as multipart to keep files off the JSON payload
      if (selectedFile) {
        try {
          const form = new FormData();
          form.append('file', selectedFile);
          await (leadsAPI as any).uploadConfirmation(lead.id as string, form);
          // refresh lead from API to get attachments/metadata
          try {
            const refreshed = await leadsAPI.getById(lead.id as string);
            onSaved?.(refreshed.data as Lead);
          } catch {
            // ignore refresh errors
          }
        } catch (e) {
          console.error('File upload failed', e);
        }
      }

      // Now confirm the lead (this is only done after validation passes)
      const bookedResponse = await leadsAPI.update(lead.id as string, { leadOutcome: 'confirmed', status: 'booked' } as any);
      const finalLead = bookedResponse.data as Lead;

      if (total > 0 && advance > 0) {
        const dueDate = hotelOptions[0]?.checkIn || new Date().toISOString();
        await paymentsAPI.create({ leadId: lead.id, amount: advance, method, status: 'pending', dueDate, notes: 'Advance on confirmation' } as any);
      }

      if (selectedFile) {
        try {
          const form = new FormData();
          form.append('file', selectedFile);
          await (leadsAPI as any).uploadConfirmation(lead.id as string, form);
        } catch (e) {
          console.error('File upload failed', e);
        }
      }

      let refreshedLead = finalLead;
      try {
        const refreshed = await leadsAPI.getById(lead.id as string);
        refreshedLead = refreshed.data as Lead;
      } catch {
        // ignore refresh errors
      }

      onSaved?.(refreshedLead);
      window.dispatchEvent(new Event('dashboard-refresh'));
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Confirm Lead - ${lead.clientName || ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={loading} onClick={handleSave}>Save & Confirm</Button>
        </>
      }
    >
      {validationError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {validationError}
        </div>
      )}
      <div className="space-y-3">
        {hotelOptions.map((option, index) => (
          <div key={index} className="p-3 border rounded-lg">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="font-medium">Hotel Option {index + 1}</p>
              {hotelOptions.length > 1 && (
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => setHotelOptions((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hotel Name</label>
              <input
                className="input-field"
                value={option.hotelName}
                onChange={(e) => setHotelOptions((prev) => prev.map((item, i) => i === index ? { ...item, hotelName: e.target.value } : item))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Room Type</label>
              <input
                className="input-field"
                value={option.roomType}
                onChange={(e) => setHotelOptions((prev) => prev.map((item, i) => i === index ? { ...item, roomType: e.target.value } : item))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Check-in</label>
                <input
                  type="date"
                  className="input-field"
                  value={option.checkIn}
                  onChange={(e) => setHotelOptions((prev) => prev.map((item, i) => i === index ? { ...item, checkIn: e.target.value } : item))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Check-out</label>
                <input
                  type="date"
                  className="input-field"
                  value={option.checkOut}
                  onChange={(e) => setHotelOptions((prev) => prev.map((item, i) => i === index ? { ...item, checkOut: e.target.value } : item))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Room Price</label>
              <input
                type="number"
                className="input-field"
                value={option.roomPrice}
                onChange={(e) => setHotelOptions((prev) => prev.map((item, i) => i === index ? { ...item, roomPrice: parseFloat(e.target.value || '0') } : item))}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-slate-700 hover:text-slate-900"
          onClick={() => setHotelOptions((prev) => [...prev, { hotelName: '', roomType: '', roomPrice: 0, checkIn: '', checkOut: '' }])}
        >
          + Add another hotel option
        </button>

        <div>
          <label className="block text-sm font-medium mb-1">Hotel Confirmation (optional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => {
              setFileError(null);
              const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
              if (f && f.size > 5 * 1024 * 1024) {
                setSelectedFile(null);
                setFileError('File must be smaller than 5MB');
                return;
              }
              setSelectedFile(f);
            }}
            className="mt-1"
          />
          {selectedFile && (
            <div className="text-sm mt-1">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
              <button type="button" className="ml-3 text-red-500" onClick={() => setSelectedFile(null)}>Remove</button>
            </div>
          )}
          {fileError && <div className="text-sm text-red-500 mt-1">{fileError}</div>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Vehicle</label>
          <input className="input-field" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Total</label>
            <input type="number" className="input-field" value={total} onChange={(e) => setTotal(parseFloat(e.target.value || '0'))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Advance</label>
            <input type="number" className="input-field" value={advance} onChange={(e) => setAdvance(parseFloat(e.target.value || '0'))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Method</label>
            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmedLeadForm;
