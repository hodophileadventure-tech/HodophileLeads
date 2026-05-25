import React, { useState } from 'react';
import { Button, Modal } from './common';
import { leadsAPI, paymentsAPI } from '../utils/api-service';
import type { Lead } from '../types';

interface Props {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (lead: Lead) => void;
}

export const ConfirmedLeadForm: React.FC<Props> = ({ lead, isOpen, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [hotelName, setHotelName] = useState(lead.hotelInfo?.hotelName || '');
  const [roomType, setRoomType] = useState(lead.hotelInfo?.roomType || '');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [roomPrice, setRoomPrice] = useState(lead.hotelInfo?.roomPrice || 0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState('');
  const [total, setTotal] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [method, setMethod] = useState('cash');

  const handleSave = async () => {
    setLoading(true);
    try {
      const hotelInfo: any = { hotelName, roomType, roomPrice, checkIn, checkOut };
      const updatePayload: Partial<Lead> = {
        hotelInfo,
        transportPreference: vehicle
      };

      // First update lead fields (hotel info, transport)
      const updated = await leadsAPI.update(lead.id as string, updatePayload);

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
      await leadsAPI.updateStage(lead.id as string, 'confirmed');

      if (total > 0) {
        const dueDate = checkIn || new Date().toISOString();
        await paymentsAPI.create({ leadId: lead.id, amount: advance, method, status: 'pending', dueDate, notes: 'Advance on confirmation' } as any);
      }

      onSaved?.(updated.data as Lead);
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
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Hotel Name</label>
          <input className="input-field" value={hotelName} onChange={(e) => setHotelName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Room Type</label>
          <input className="input-field" value={roomType} onChange={(e) => setRoomType(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Check-in</label>
            <input type="date" className="input-field" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Check-out</label>
            <input type="date" className="input-field" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Room Price</label>
          <input type="number" className="input-field" value={roomPrice} onChange={(e) => setRoomPrice(parseFloat(e.target.value || '0'))} />
        </div>

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
              <option value="bank">Bank Transfer</option>
              <option value="card">Card</option>
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmedLeadForm;
