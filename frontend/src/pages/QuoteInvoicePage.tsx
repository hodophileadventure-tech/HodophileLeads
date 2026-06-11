import React, { useMemo, useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import quoteHeaderImage from '../assets/quote-header.png';
import quoteFooterImage from '../assets/quote-footer.jpeg';
import nadraLogo from '../assets/logos/NADRA_logo-removebg-preview.png';
import pakistanGovtLogo from '../assets/logos/pakistan-govt-logo-png_seeklogo-190628-removebg-preview.png';
import patoLogo from '../assets/logos/images__1_-removebg-preview.png';
import fbrLogo from '../assets/logos/images-removebg-preview.png';
import { leadsAPI, quoteRequestsAPI } from '../utils/api-service';
import type { Lead } from '../types';
import './QuoteInvoicePage.css';

type TableRow = {
  id: string;
  particulars: string;
  persons: string;
  price: string;
  amount: string;
};

type DocumentData = {
  customerName: string;
  phone: string;
  city: string;
  invoiceNumber: string;
  quoteNumber: string;
  date: string;
  travelDate: string;
  destination: string;
  packageName: string;
  packageDescription: string;
  persons: string;
  price: string;
  subtotal: string;
  discount: string;
  totalDue: string;
  advanceAmount: string;
  balanceDue: string;
  notes: string[];
  packageIncludes: string[];
  accommodationType: string;
  transportationType: string;
  departureLocation: string;
};

const getDefaultRows = (): TableRow[] => [
  { id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' },
  { id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' },
  { id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' },
  { id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' },
  { id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' },
];

const defaultData: DocumentData = {
  customerName: '',
  phone: '',
  city: '',
  invoiceNumber: '',
  quoteNumber: '',
  date: new Date().toISOString().split('T')[0],
  travelDate: new Date().toISOString().split('T')[0],
  destination: '',
  packageName: '',
  packageDescription: '',
  persons: '',
  price: '',
  subtotal: '',
  discount: '',
  totalDue: '',
  advanceAmount: '',
  balanceDue: '',
  notes: [
    'Remaing amount to be handed over to guide cum driver at the time of departure is mandatory.',
    'Detailed itinerary is already shared.',
    'Read Terms & Conditions.'
  ],
  packageIncludes: [
    '2 nightstays Islamabad',
    'Toyota Corolla GLI',
    'Guide Expense',
    'Fuel',
    'Toll - Tax',
    '4x4 Jeep ride ( - )',
    'Standard Accommodation',
    'Breakfast',
    'Bonfire',
    'Dinner'
  ],
  accommodationType: '',
  transportationType: '',
  departureLocation: '',
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const parseNumber = (value: string) => {
  const num = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isNaN(num) ? 0 : num;
};

const formatAmount = (value: number) => value.toLocaleString('en-US');

const formatQuoteNumber = (dateString: string, count: number) => {
  const date = new Date(dateString);
  const normalizedDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = String(normalizedDate.getFullYear()).slice(-2);
  const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
  const day = String(normalizedDate.getDate()).padStart(2, '0');
  const sequence = 1100 + count;
  return `${year}${month}${day}${sequence}`;
};

const getQuoteCounterKey = (dateString: string) => {
  const date = new Date(dateString);
  const normalizedDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = normalizedDate.getFullYear();
  const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
  const day = String(normalizedDate.getDate()).padStart(2, '0');
  return `quote-counter-${year}${month}${day}`;
};

const previewQuoteNumber = (dateString: string) => {
  if (typeof window === 'undefined') return formatQuoteNumber(dateString, 1);
  const counterKey = getQuoteCounterKey(dateString);
  const existing = Number(window.localStorage.getItem(counterKey) || '0');
  return formatQuoteNumber(dateString, existing + 1);
};

export const QuoteInvoicePage: React.FC<{
  leadId?: string;
  requestId?: string;
  onSaved?: (requestId: string) => void;
  onClose?: () => void;
  viewOnly?: boolean;
}> = ({ leadId, requestId, onSaved, onClose, viewOnly = false }) => {
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice'>('quotation');
  const [data, setData] = useState<DocumentData>(defaultData);
  const [tableRows, setTableRows] = useState<TableRow[]>(getDefaultRows());
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(!!leadId || !!requestId);
  const [leadData, setLeadData] = useState<Lead | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const displayQuoteNumber = data.quoteNumber || previewQuoteNumber(data.date);

  // Load lead data if leadId is provided
  useEffect(() => {
    if (!leadId || requestId) return; // Skip lead data loading if viewing a saved quotation

    const loadLeadData = async () => {
      try {
        setLoading(true);
        const response = await leadsAPI.getById(leadId);
        const lead = response.data;

        setLeadData(lead);
        const totalPersons = ((lead.adults ?? 0) + (lead.kids ?? 0)) || lead.persons || 0;
        const destinationValue = Array.isArray(lead.destinations) && lead.destinations.length > 0
          ? lead.destinations.join(', ')
          : lead.destination || '';

        setData((current) => ({
          ...current,
          customerName: lead.clientName || '',
          phone: lead.phone || '',
          city: lead.address || '',
          destination: destinationValue,
          travelDate: lead.travelDates?.from ? new Date(lead.travelDates.from).toISOString().split('T')[0] : current.travelDate,
          persons: totalPersons > 0 ? String(totalPersons).padStart(2, '0') : current.persons,
          packageName: lead.tourType ? `${lead.tourType} Tour Package` : current.packageName,
          transportationType: lead.transportPreference || current.transportationType,
          accommodationType: lead.hotelPreference || current.accommodationType,
        }));

        setDocumentType((current) => {
          if (requestId) {
            return current;
          }
          return 'quotation';
        });

        setLoading(false);
        setMessage('Lead data loaded successfully');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Failed to load lead:', error);
        setMessage('Failed to load lead data');
        setLoading(false);
      }
    };

    loadLeadData();
  }, [leadId, requestId]);

  useEffect(() => {
    if (!requestId) return;

    const loadRequest = async () => {
      try {
        setLoading(true);
        const response = await quoteRequestsAPI.getById(requestId);
        const request = response.data;

        // Load lead data for display
        if (request.leadId) {
          try {
            const leadResponse = await leadsAPI.getById(request.leadId);
            setLeadData(leadResponse.data);
          } catch (err) {
            console.error('Failed to load lead data:', err);
          }
        }

        if (request.documentData) {
          const payload = request.documentData;
          setData((current) => ({
            ...current,
            customerName: payload.customerName ?? current.customerName,
            phone: payload.phone ?? current.phone,
            city: payload.city ?? current.city,
            destination: payload.destination ?? current.destination,
            invoiceNumber: payload.invoiceNumber ?? current.invoiceNumber,
            quoteNumber: payload.quoteNumber ?? current.quoteNumber,
            date: payload.date ?? current.date,
            travelDate: payload.travelDate ?? current.travelDate,
            packageName: payload.packageName ?? current.packageName,
            packageDescription: payload.packageDescription ?? current.packageDescription,
            persons: payload.persons ?? current.persons,
            price: payload.price ?? current.price,
            subtotal: payload.subtotal ?? current.subtotal,
            discount: payload.discount ?? current.discount,
            totalDue: payload.totalDue ?? current.totalDue,
            advanceAmount: payload.advanceAmount ?? current.advanceAmount,
            balanceDue: payload.balanceDue ?? current.balanceDue,
            notes: Array.isArray(payload.notes) ? payload.notes : current.notes,
            packageIncludes: Array.isArray(payload.packageIncludes) ? payload.packageIncludes : current.packageIncludes,
            accommodationType: payload.accommodationType ?? current.accommodationType,
            transportationType: payload.transportationType ?? current.transportationType,
            departureLocation: payload.departureLocation ?? current.departureLocation,
          }));

          if (Array.isArray(payload.tableRows) && payload.tableRows.length > 0) {
            setTableRows(payload.tableRows.map((row: any) => ({
              id: crypto.randomUUID(),
              particulars: row.particulars || '',
              persons: row.persons || '',
              price: row.price || '',
              amount: row.amount || ''
            })));
          }
        }
      } catch (error) {
        console.error('Failed to load quote request:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequest();
  }, [requestId]);

  useEffect(() => {
    if (documentType === 'quotation' && !data.quoteNumber) {
      const generated = previewQuoteNumber(data.date);
      setData((current) => ({ ...current, quoteNumber: generated }));
    }
  }, [data.date, documentType, data.quoteNumber]);

  const effectiveRows = useMemo(() => {
    return tableRows.map((row, index) => {
      if (index !== 0) return row;
      return {
        ...row,
        particulars: data.packageName,
        persons: data.persons,
        price: data.price,
      };
    });
  }, [tableRows, data.packageName, data.persons, data.price]);

  const visibleRows = useMemo(() => {
    const rows = [...effectiveRows];
    while (rows.length < 5) {
      rows.push({ id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' });
    }
    return rows.slice(0, 5);
  }, [effectiveRows]);

  const subtotalValue = useMemo(() => {
    return visibleRows.reduce((sum, row) => {
      const rowAmount = row.amount
        ? parseNumber(row.amount)
        : parseNumber(row.price) * parseNumber(row.persons);
      return sum + rowAmount;
    }, 0);
  }, [visibleRows]);

  const discountValue = useMemo(() => {
    const discount = Number(data.discount.replace(/[^0-9.]/g, '')) || 0;
    return Math.round((subtotalValue * discount) / 100);
  }, [data.discount, subtotalValue]);

  const totalDueValue = useMemo(() => Math.max(subtotalValue - discountValue, 0), [subtotalValue, discountValue]);
  const advanceValue = useMemo(() => Number(data.advanceAmount.replace(/[^0-9.]/g, '')) || 0, [data.advanceAmount]);
  const balanceValue = useMemo(() => Math.max(totalDueValue - advanceValue, 0), [totalDueValue, advanceValue]);

  const previewRows = useMemo(() => {
    return visibleRows
      .map((row, index) => {
        const details = index === 0 ? {
          ...row,
          particulars: data.packageName,
          persons: data.persons,
          price: data.price,
        } : row;
        const rowAmountValue = details.amount
          ? parseNumber(details.amount)
          : parseNumber(details.price) * parseNumber(details.persons);
        const displayAmount = rowAmountValue > 0 ? formatAmount(rowAmountValue) : '';
        return { ...details, displayAmount };
      })
      .filter((row, index) => {
        if (index === 0) return true;
        return Boolean(row.particulars || row.persons || row.price || row.amount);
      });
  }, [visibleRows, data.packageName, data.persons, data.price]);

  const updateField = (field: keyof DocumentData, value: string | string[]) => {
    if (viewOnly) return;
    setData((current) => ({ ...current, [field]: value }));
  };

  const updateRow = (id: string, field: keyof Omit<TableRow, 'id'>, value: string) => {
    if (viewOnly) return;
    setTableRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const captureFullDocument = async () => {
    if (!previewRef.current) return null;

    const original = previewRef.current;
    const clone = original.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.position = 'absolute';
    clone.style.top = '-99999px';
    clone.style.left = '-99999px';
    clone.style.width = `${original.scrollWidth}px`;
    clone.style.height = `${original.scrollHeight}px`;
    clone.style.overflow = 'visible';
    clone.style.visibility = 'visible';
    clone.style.pointerEvents = 'none';

    document.body.appendChild(clone);
    try {
      const canvas = await html2canvas(clone, {
        scale: window.devicePixelRatio || 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
      });
      return canvas;
    } finally {
      document.body.removeChild(clone);
    }
  };

  const downloadJPEG = async () => {
    try {
      if (!previewRef.current) return;
      setMessage('Generating JPEG...');
      const canvas = await captureFullDocument();
      if (!canvas) {
        setMessage('Failed to generate JPEG. Please try again.');
        return;
      }
      const jpegData = canvas.toDataURL('image/jpeg', 0.95);
      const filename = `${documentType === 'quotation' ? data.quoteNumber || 'Quotation' : data.invoiceNumber || 'Invoice'} - ${data.customerName || 'Client'}.jpeg`;
      const link = document.createElement('a');
      link.href = jpegData;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMessage('JPEG generated successfully.');
    } catch (error) {
      console.error(error);
      setMessage('Failed to generate JPEG. Please try again.');
    }
  };

  const downloadPDF = async () => {
    if (!previewRef.current) return;
    try {
      setMessage('Generating PDF...');
      const canvas = await captureFullDocument();
      if (!canvas) {
        setMessage('Failed to generate PDF. Please try again.');
        return;
      }
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      const filename = `${documentType === 'quotation' ? data.quoteNumber || 'Quotation' : data.invoiceNumber || 'Invoice'} - ${data.customerName || 'Client'}.pdf`;
      pdf.save(filename);
      setMessage('PDF generated successfully.');
    } catch (error) {
      console.error(error);
      setMessage('Failed to generate PDF. Please try again.');
    }
  };

  const saveQuotation = async () => {
    if (!requestId) {
      setMessage('No request ID available. Cannot save quotation.');
      return;
    }

    try {
      setMessage('Saving quotation...');
      const documentData = {
        customerName: data.customerName,
        phone: data.phone,
        city: data.city,
        destination: data.destination,
        invoiceNumber: data.invoiceNumber,
        quoteNumber: data.quoteNumber,
        date: data.date,
        travelDate: data.travelDate,
        packageName: data.packageName,
        packageDescription: data.packageDescription,
        persons: data.persons,
        price: data.price,
        subtotal: data.subtotal,
        discount: data.discount,
        totalDue: data.totalDue,
        advanceAmount: data.advanceAmount,
        balanceDue: data.balanceDue,
        notes: data.notes,
        packageIncludes: data.packageIncludes,
        accommodationType: data.accommodationType,
        transportationType: data.transportationType,
        departureLocation: data.departureLocation,
        tableRows: tableRows.filter((row) => row.particulars || row.persons || row.price || row.amount),
      };

      await quoteRequestsAPI.save(requestId, documentData);
      setMessage('Quotation saved successfully!');
      window.dispatchEvent(new CustomEvent('quote-request-saved', { detail: { requestId } }));
      if (onSaved) {
        onSaved(requestId);
      }
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to save quotation:', error);
      setMessage('Failed to save quotation. Please try again.');
    }
  };

  const handleReRequest = async () => {
    if (!requestId) {
      setMessage('No request ID available. Cannot re-request quotation.');
      return;
    }

    const notes = window.prompt('What changes would you like to make to this quotation?', '');
    if (!notes || notes.trim() === '') {
      return;
    }

    try {
      setMessage('Submitting re-request...');
      await quoteRequestsAPI.reRequest(requestId, notes);
      setMessage('Re-request submitted successfully! Admin will be notified.');
      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to re-request quotation:', error);
      setMessage('Failed to re-request quotation. Please try again.');
    }
  };

  const showLeadDetails = Boolean(leadData || (leadId && requestId));
  const shellStyle = showLeadDetails
    ? { gridTemplateColumns: 'minmax(0, 420px) minmax(0, 560px) minmax(0, 1fr)' }
    : undefined;

  return (
    <div className="quote-invoice-root">
      <div className="quote-invoice-shell" style={shellStyle}>
        {showLeadDetails && (
          <div className="quote-invoice-sidebar">
            <div className="quote-invoice-panel">
              <h2>Agent Lead Details</h2>
              {loading && !leadData ? (
                <div className="text-center py-8 text-slate-500">
                  <p>Loading lead details...</p>
                </div>
              ) : (
                <>
                  <div className="field-row">
                    <div>
                      <label>Name</label>
                      <div className="field-value">{leadData?.clientName || '—'}</div>
                    </div>
                    <div>
                      <label>Phone</label>
                      <div className="field-value">{leadData?.phone || '—'}</div>
                    </div>
                  </div>
                  <div className="field-row">
                    <div>
                      <label>Email</label>
                      <div className="field-value">{leadData?.email || '—'}</div>
                    </div>
                    <div>
                      <label>Address</label>
                      <div className="field-value">{leadData?.address || '—'}</div>
                    </div>
                  </div>
                  <div className="field-row">
                    <div>
                      <label>Destination</label>
                      <div className="field-value">{leadData?.destination || '—'}</div>
                    </div>
                    <div>
                      <label>Travel Dates</label>
                      <div className="field-value">
                        {leadData?.travelDates?.from || '—'} — {leadData?.travelDates?.to || '—'}
                      </div>
                    </div>
                  </div>
                  {leadData?.tourType && (
                    <div className="field-row">
                      <div>
                        <label>Tour Type</label>
                        <div className="field-value">{leadData.tourType}</div>
                      </div>
                    </div>
                  )}
                  <div className="field-row">
                    <div>
                      <label>Adults</label>
                      <div className="field-value">{leadData?.adults ?? '—'}</div>
                    </div>
                    <div>
                      <label>Kids</label>
                      <div className="field-value">{leadData?.kids ?? '—'}</div>
                    </div>
                  </div>
                  <div className="field-row-sm">
                    <div>
                      <label>Gender</label>
                      <div className="field-value">{leadData?.gender || '—'}</div>
                    </div>
                    <div>
                      <label>Age</label>
                      <div className="field-value">{leadData?.age ?? '—'}</div>
                    </div>
                    <div>
                      <label>Status</label>
                      <div className="field-value">
                        {leadData?.leadStatus || leadData?.status || (leadData?.potential ? 'Potential' : 'New')}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label>Agent Remarks</label>
                    <div className="field-value">{leadData?.agentRemarks || '—'}</div>
                  </div>
                  <div>
                    <label>Remarks</label>
                    <div className="field-value">{leadData?.remarks || '—'}</div>
                  </div>
                  <div className="field-row">
                    <div>
                      <label>Created</label>
                      <div className="field-value">{leadData?.createdAt ? formatDate(leadData.createdAt) : '—'}</div>
                    </div>
                    <div>
                      <label>Lead Source</label>
                      <div className="field-value">{leadData?.leadSource || leadData?.source || '—'}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <div className="quote-invoice-sidebar">
          <div className="quote-invoice-panel">
            {loading && (
              <div className="text-center py-8 text-slate-500">
                <p>Loading lead data...</p>
              </div>
            )}
            {!loading && (
              <>
                <h2>Invoice & Quotation Generator</h2>
                <div className="quote-tabs">
                  <button type="button" className={`quote-tab ${documentType === 'quotation' ? 'active' : ''}`} onClick={() => setDocumentType('quotation')}>
                    Quotation
                  </button>
                  <button type="button" className={`quote-tab ${documentType === 'invoice' ? 'active' : ''}`} onClick={() => setDocumentType('invoice')}>
                    Invoice
                  </button>
                </div>
                <div className="field-row">
                  <div>
                    <label>Customer Name</label>
                    <input value={data.customerName} disabled={viewOnly} onChange={(event) => updateField('customerName', event.target.value)} />
                  </div>
                  <div>
                    <label>Phone Number</label>
                    <input value={data.phone} disabled={viewOnly} onChange={(event) => updateField('phone', event.target.value)} />
                  </div>
                </div>
                <div className="field-row">
                  <div>
                    <label>City</label>
                    <input value={data.city} disabled={viewOnly} onChange={(event) => updateField('city', event.target.value)} />
                  </div>
                  <div>
                    <label>Destination</label>
                    <input value={data.destination} disabled={viewOnly} onChange={(event) => updateField('destination', event.target.value)} />
                  </div>
                </div>
                <div className="field-row-sm">
                  <div>
                    <label>{documentType === 'quotation' ? 'Quote #' : 'Invoice #'}</label>
                    <input value={documentType === 'quotation' ? displayQuoteNumber : data.invoiceNumber} disabled={viewOnly} onChange={(event) => updateField(documentType === 'quotation' ? 'quoteNumber' : 'invoiceNumber', event.target.value)} />
                  </div>
                  <div>
                    <label>{documentType === 'quotation' ? 'Quote Date' : 'Date'}</label>
                    <input type="date" value={data.date} disabled={viewOnly} onChange={(event) => updateField('date', event.target.value)} />
                  </div>
                  <div>
                    <label>Travel Date</label>
                    <input type="date" value={data.travelDate} disabled={viewOnly} onChange={(event) => updateField('travelDate', event.target.value)} />
                  </div>
                </div>
                <div className="field-row">
                  <div>
                    <label>Package Name</label>
                    <input value={data.packageName} disabled={viewOnly} onChange={(event) => updateField('packageName', event.target.value)} />
                  </div>
                  <div>
                    <label>No. of Person(s)</label>
                    <input value={data.persons} disabled={viewOnly} onChange={(event) => updateField('persons', event.target.value)} />
                  </div>
                </div>
                <div>
                  <label>Package Description</label>
                  <textarea value={data.packageDescription} disabled={viewOnly} onChange={(event) => updateField('packageDescription', event.target.value)} />
                </div>
                <div className="field-row">
                  <div>
                    <label>Accommodation Type</label>
                    <input value={data.accommodationType} disabled={viewOnly} onChange={(event) => updateField('accommodationType', event.target.value)} />
                  </div>
                  <div>
                    <label>Transportation Type</label>
                    <input value={data.transportationType} disabled={viewOnly} onChange={(event) => updateField('transportationType', event.target.value)} />
                  </div>
                </div>
                <div className="field-row">
                  <div>
                    <label>Departure Location</label>
                    <input value={data.departureLocation} disabled={viewOnly} onChange={(event) => updateField('departureLocation', event.target.value)} />
                  </div>
                </div>
                <div className="field-row-sm">
                  <div>
                    <label>Price</label>
                    <input value={data.price} disabled={viewOnly} onChange={(event) => updateField('price', event.target.value)} />
                  </div>
                  <div>
                    <label>Discount %</label>
                    <input value={data.discount} disabled={viewOnly} onChange={(event) => updateField('discount', event.target.value)} />
                  </div>
                  <div>
                    <label>Advance Amount</label>
                    <input value={data.advanceAmount} disabled={viewOnly} onChange={(event) => updateField('advanceAmount', event.target.value)} />
                  </div>
                </div>
                <div>
                  <label>Package Includes</label>
                  <textarea value={data.packageIncludes.join('\n')} disabled={viewOnly} onChange={(event) => updateField('packageIncludes', event.target.value.split('\n'))} />
                  <small>Enter each item on a new line.</small>
                </div>
                <div>
                  <label>Notes</label>
                  <textarea value={data.notes.join('\n')} disabled={viewOnly} onChange={(event) => updateField('notes', event.target.value.split('\n'))} />
                  <small>Enter each note on a new line.</small>
                </div>
            <div className="download-actions">
              <button type="button" className="btn-primary" onClick={downloadJPEG}>
                Download JPEG
              </button>
              <button type="button" className="btn-primary btn-secondary" onClick={downloadPDF}>
                Download PDF
              </button>
              {requestId && !viewOnly && (
                <button type="button" className="btn-primary" style={{ gridColumn: '1 / -1', backgroundColor: '#10b981' }} onClick={saveQuotation}>
                  Save Quotation
                </button>
              )}
              {requestId && viewOnly && (
                <button type="button" className="btn-primary" style={{ gridColumn: '1 / -1', backgroundColor: '#f59e0b' }} onClick={handleReRequest}>
                  Re-request Changes
                </button>
              )}
            </div>
            {message && <small style={{ color: message.includes('saved') || message.includes('successfully') ? '#10b981' : '#ef4444' }}>{message}</small>}
              </>
            )}
          </div>
          <div className="quote-invoice-panel">
            <h2>Table Rows</h2>
            <div style={{ display: 'grid', gap: '14px' }}>
              {visibleRows.map((row, index) => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                  <input value={row.particulars} placeholder={index === 0 ? 'Package title' : ''} disabled={viewOnly} onChange={(event) => updateRow(row.id, 'particulars', event.target.value)} />
                  <input value={row.persons} placeholder="Pax" disabled={viewOnly} onChange={(event) => updateRow(row.id, 'persons', event.target.value)} />
                  <input value={row.price} placeholder="Price" disabled={viewOnly} onChange={(event) => updateRow(row.id, 'price', event.target.value)} />
                  <input value={row.amount} placeholder="Amount" disabled={viewOnly} onChange={(event) => updateRow(row.id, 'amount', event.target.value)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="quote-invoice-preview">
          <div className="pdf-page">
            <div className="pdf-canvas" ref={previewRef}>
              <div className="pdf-background">
                <div className="pdf-header-image">
                  <img src={quoteHeaderImage} alt="Hodophile header" />
                </div>
                <div className="pdf-header-info-box">
                  <div className="pdf-header-top">
                    <div className="pdf-customer-box">
                      <div className="pdf-header-info-label">Customer</div>
                      <div className="pdf-header-info-value">{data.customerName}</div>
                      <div className="pdf-header-info-value">{data.phone}</div>
                      <div className="pdf-header-info-value">{data.city}</div>
                    </div>
                    <div className="pdf-quote-right">
                      <div className="pdf-quotation-title">{documentType === 'quotation' ? 'QUOTATION' : 'INVOICE'}</div>
                      <div className="pdf-quote-meta-block">
                        <div className="pdf-quote-meta-row">
                          <span>{documentType === 'quotation' ? 'Quote #' : 'Invoice #'}</span>
                          <strong>{documentType === 'quotation' ? displayQuoteNumber : data.invoiceNumber}</strong>
                        </div>
                        <div className="pdf-quote-meta-row">
                          <span>{documentType === 'quotation' ? 'Quote Date' : 'Date'}</span>
                          <strong>{formatDate(data.date)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pdf-table-wrapper">
                  <table className="pdf-main-table">
                    <colgroup>
                      <col className="col-desc" />
                      <col className="col-price" />
                      <col className="col-person" />
                      <col className="col-amount" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Package Price</th>
                        <th>No. of Person(s)</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => (
                        <tr key={row.id} className={index === previewRows.length - 1 ? 'pdf-last-item-row' : ''}>
                          <td className="pdf-description-cell">
                            {index === 0 ? (
                              <>
                                <div className="pdf-package-title">{data.packageName}</div>
                                <div className="pdf-package-description">{data.packageDescription}</div>
                                <div className="pdf-package-info-group">
                                  <div className="pdf-package-info-line">
                                    <span>Accommodation Type</span>
                                    <strong>{data.accommodationType}</strong>
                                  </div>
                                  <div className="pdf-package-info-line">
                                    <span>Transportation Type</span>
                                    <strong>{data.transportationType}</strong>
                                  </div>
                                  <div className="pdf-package-info-line">
                                    <span>Departure Location</span>
                                    <strong>{data.departureLocation}</strong>
                                  </div>
                                  <div className="pdf-package-info-line">
                                    <span>Package Includes</span>
                                    <strong>{data.packageIncludes.join(', ')}</strong>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="pdf-package-title">{row.particulars}</div>
                            )}
                          </td>
                          <td className="pdf-price-cell text-right"><strong>{row.price}</strong></td>
                          <td className="pdf-person-cell text-center">{row.persons}</td>
                          <td className="pdf-amount-cell text-right"><strong>{row.displayAmount}</strong></td>
                        </tr>
                      ))}
                      <tr className="pdf-footer-row">
                        <td colSpan={3}>
                          <div className="pdf-left-box">
                            <div className="pdf-notes">
                              <div className="notes-title">NOTES:</div>
                              {data.notes.map((note, index) => (
                                <div key={index}><strong>{note}</strong></div>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td>
                          <table className="pdf-summary">
                            <colgroup>
                              <col style={{ width: '60%' }} />
                              <col style={{ width: '40%' }} />
                            </colgroup>
                            <tbody>
                              <tr>
                                <td className="label">Subtotal</td>
                                <td className="value"><strong>{subtotalValue.toLocaleString('en-US')}</strong></td>
                              </tr>
                              <tr>
                                <td className="label">Discount</td>
                                <td className="value"><strong>{discountValue.toLocaleString('en-US')}</strong></td>
                              </tr>
                              <tr>
                                <td className="label">Total Due</td>
                                <td className="value"><strong>{totalDueValue.toLocaleString('en-US')}</strong></td>
                              </tr>
                              <tr>
                                <td className="label">Amount Paid</td>
                                <td className="value"><strong>{advanceValue.toLocaleString('en-US')}</strong></td>
                              </tr>
                              <tr>
                                <td className="label">Balance Due</td>
                                <td className="value"><strong>{balanceValue.toLocaleString('en-US')}</strong></td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="pdf-logos-section">
                  <div className="pdf-logos-container">
                    <div className="pdf-logo-item">
                      <img src={pakistanGovtLogo} alt="Government of Pakistan" />
                    </div>
                    <div className="pdf-logo-item">
                      <img src={nadraLogo} alt="NADRA" />
                    </div>
                    <div className="pdf-logo-item">
                      <img src={patoLogo} alt="PATO" />
                    </div>
                    <div className="pdf-logo-item">
                      <img src={fbrLogo} alt="FBR" />
                    </div>
                  </div>
                </div>
                <div className="pdf-footer-image">
                  <img src={quoteFooterImage} alt="Footer" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
