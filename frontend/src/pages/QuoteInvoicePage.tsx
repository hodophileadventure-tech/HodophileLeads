import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { quoteRequestsAPI, leadsAPI } from '../utils/api-service';
import html2canvas from 'html2canvas';
import type { Lead } from '../types';
import quoteHeaderImage from '../assets/quote-header.png';
import quoteFooterImage from '../assets/quote-footer.jpeg';
import nadraLogo from '../assets/logos/NADRA_logo-removebg-preview.png';
import pakistanGovtLogo from '../assets/logos/pakistan-govt-logo-png_seeklogo-190628-removebg-preview.png';
import patoLogo from '../assets/logos/images__1_-removebg-preview.png';
import fbrLogo from '../assets/logos/images-removebg-preview.png';
import './QuoteInvoicePage.css';

type TableRow = {
  id: string;
  particulars: string;
  persons: string;
  price: string;
  amount: string;
};

type QuoteInvoicePageProps = {
  leadId?: string;
  leadData?: any; // If provided, use this instead of fetching
  requestId?: string;
  requestType?: 'quotation' | 'invoice';
  requestStatus?: 'requested' | 'saved' | 'created' | 'manager_pending' | 'admin_pending' | 'approved' | 'rejected';
  initialDocumentData?: any;
  initialQuotationNumber?: string | null;
  viewOnly?: boolean;
  generatePreviewOnMount?: boolean;
  onPreviewGenerated?: (dataUrl: string) => void;
  onSaved?: () => void;
  onClose?: () => void;
  hidePreview?: boolean;
  embedded?: boolean;
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
  customerName: 'Farhan Ahmed',
  phone: '+92 300 1234567',
  city: 'Karachi',
  invoiceNumber: 'INV-000142',
  quoteNumber: '',
  date: new Date().toISOString().split('T')[0],
  travelDate: new Date().toISOString().split('T')[0],
  destination: 'Gilgit Baltistan',
  packageName: 'Gilgit Baltistan',
  packageDescription: 'A premium travel package with accommodation, meals, and guided tours.',
  persons: '',
  price: '',
  subtotal: '0',
  discount: '',
  totalDue: '0',
  advanceAmount: '',
  balanceDue: '0',
  packageIncludes: ['Transport', 'Accommodation', 'Breakfast & Dinner', 'Guided Tours'],
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

// Fetch next quotation number from server (server handles atomic incrementing)
const fetchNextQuotationNumber = async (dateString: string): Promise<string> => {
  try {
    const response = await quoteRequestsAPI.getNextQuotationNumber(dateString);
    return response.data.quotationNumber;
  } catch (error) {
    console.error('Failed to fetch quotation number:', error);
    // Fallback: generate locally based on date (but this won't be persisted)
    const date = new Date(dateString);
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}1101`;
  }
};

const hydrateLeadFields = (current: DocumentData, leadData: any): DocumentData => {
  const destination = !current.destination || current.destination === defaultData.destination ? (leadData.destination || current.destination) : current.destination;
  return {
    ...current,
    customerName: !current.customerName || current.customerName === defaultData.customerName ? (leadData.clientName || current.customerName) : current.customerName,
    phone: !current.phone || current.phone === defaultData.phone ? (leadData.phone || current.phone) : current.phone,
    city: !current.city || current.city === defaultData.city ? (leadData.address || current.city) : current.city,
    destination: destination,
    packageName: destination,
    persons: !current.persons || current.persons === defaultData.persons ? (leadData.persons ? String(leadData.persons) : current.persons) : current.persons,
    accommodationType: !current.accommodationType || current.accommodationType === defaultData.accommodationType ? (leadData.hotelPreference || current.accommodationType) : current.accommodationType,
    transportationType: !current.transportationType || current.transportationType === defaultData.transportationType ? (leadData.transportPreference || current.transportationType) : current.transportationType,
    travelDate: !current.travelDate || current.travelDate === defaultData.travelDate ? (leadData.travelDates?.from || current.travelDate) : current.travelDate,
  };
};

export const QuoteInvoicePage: React.FC<QuoteInvoicePageProps> = ({
  leadId: _leadId,
  leadData: _leadData,
  requestId: _requestId,
  requestType: _requestType,
  requestStatus,
  initialDocumentData,
  initialQuotationNumber,
  viewOnly = false,
  generatePreviewOnMount = false,
  onPreviewGenerated,
  onSaved: _onSaved,
  onClose: _onClose,
  hidePreview = false,
  embedded = false,
}) => {
  const { user } = useAuth();
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice'>(_requestType || 'quotation');
  const [data, setData] = useState<DocumentData>(defaultData);
  const [tableRows, setTableRows] = useState<TableRow[]>(getDefaultRows());
  const [message, setMessage] = useState<string>('');
  const [isLoadingQuoteNumber, setIsLoadingQuoteNumber] = useState(false);
  const [isSaved, setIsSaved] = useState(requestStatus === 'manager_pending' || requestStatus === 'admin_pending' || requestStatus === 'saved' || requestStatus === 'created' || requestStatus === 'approved' || requestStatus === 'rejected');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const displayQuoteNumber = data.quoteNumber || initialQuotationNumber || (isLoadingQuoteNumber ? 'Loading...' : '');
  const previewHiddenStyle = hidePreview
    ? {
        position: 'absolute' as const,
        left: '-10000px',
        top: 0,
        width: '2550px',
        pointerEvents: 'none' as const
      }
    : undefined;

  useEffect(() => {
    if (_requestType) {
      setDocumentType(_requestType);
    }
  }, [_requestType]);

  useEffect(() => {
    setIsSaved(['manager_pending', 'admin_pending', 'saved', 'created', 'approved', 'rejected'].includes(requestStatus || ''));
  }, [requestStatus]);

  useEffect(() => {
    if (initialDocumentData) {
      const canonicalQuoteNumber = initialQuotationNumber || initialDocumentData.quoteNumber || '';
      const nextData = {
        ...defaultData,
        ...initialDocumentData,
        quoteNumber: canonicalQuoteNumber
      };
      setData(_leadData ? hydrateLeadFields(nextData, _leadData) : nextData);
      if (Array.isArray(initialDocumentData.tableRows) && initialDocumentData.tableRows.length > 0) {
        setTableRows(initialDocumentData.tableRows);
      } else {
        setTableRows(getDefaultRows());
      }
    }
  }, []); // Only run once on mount

  // Auto-populate form with lead details (only on first mount or when request ID changes)
  useEffect(() => {
    // If leadData is provided directly (from parent), use it
    if (_leadData) {
      console.log('✅ Using provided lead data:', _leadData);
      setData((current) => {
        return hydrateLeadFields(current, _leadData);
      });
      return;
    }

    // Otherwise, fetch using leadId
    if (_leadId) {
      console.log('🔍 Fetching lead details for leadId:', _leadId);
      
      leadsAPI.getById(_leadId)
        .then((response) => {
          const lead = response.data;
          console.log('✅ Lead data fetched:', lead);
          
          setData((current) => {
            // Only update if form hasn't been modified yet
            const isFormEmpty = current.customerName === defaultData.customerName &&
                               current.packageName === defaultData.packageName;
            
            if (!isFormEmpty) {
              return current;
            }

            const updated = {
              ...current,
              customerName: lead.clientName || '',
              phone: lead.phone || '',
              city: lead.address || '',
              destination: lead.destination || '',
              persons: lead.persons ? String(lead.persons) : '',
              accommodationType: lead.hotelPreference || '',
              transportationType: lead.transportPreference || '',
              travelDate: lead.travelDates?.from || new Date().toISOString().split('T')[0],
            };
            console.log('📝 Updated form data:', updated);
            return updated;
          });
        })
        .catch((error) => {
          console.error('❌ Failed to load lead details:', error);
          setMessage(`Error loading lead details: ${error?.response?.data?.message || error.message}`);
        });
    }
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    if (!initialDocumentData && documentType === 'quotation' && !data.quoteNumber && !initialQuotationNumber) {
      setIsLoadingQuoteNumber(true);
      fetchNextQuotationNumber(data.date)
        .then((generated) => {
          setData((current) => ({ ...current, quoteNumber: generated }));
          setIsLoadingQuoteNumber(false);
        })
        .catch(() => {
          setIsLoadingQuoteNumber(false);
        });
    }
  }, [data.date, documentType, data.quoteNumber, initialQuotationNumber]);

  // Sync packageName with destination
  useEffect(() => {
    if (data.destination && data.packageName !== data.destination) {
      setData((current) => ({ ...current, packageName: current.destination }));
    }
  }, [data.destination]);

  useEffect(() => {
    if (generatePreviewOnMount && previewRef.current && onPreviewGenerated) {
      const generatePreview = async () => {
        try {
          const targetEl = previewRef.current ? (previewRef.current.closest('.pdf-page') as HTMLElement) || previewRef.current : null;
          if (!targetEl) return;
          const canvas = await html2canvas(targetEl, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: false,
          });
          const jpegData = canvas.toDataURL('image/jpeg', 0.95);
          onPreviewGenerated(jpegData);
        } catch (error) {
          console.error('Failed to generate preview:', error);
        }
      };
      const timer = setTimeout(generatePreview, 500);
      return () => clearTimeout(timer);
    }
  }, [generatePreviewOnMount, onPreviewGenerated, data, tableRows]);

  // Debug: Log data state changes
  useEffect(() => {
    console.log('📝 Form data state updated:', {
      packageName: data.packageName,
      accommodationType: data.accommodationType,
      transportationType: data.transportationType,
      customerName: data.customerName,
      price: data.price,
      discount: data.discount,
      advanceAmount: data.advanceAmount
    });
  }, [data]);

  useEffect(() => {
    const handleGenerateQuotePreview = async () => {
      if (previewRef.current && onPreviewGenerated) {
          try {
            const targetEl = (previewRef.current.closest('.pdf-page') as HTMLElement) || previewRef.current;
            if (!targetEl) return;
            const canvas = await html2canvas(targetEl, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              allowTaint: false,
            });
            const jpegData = canvas.toDataURL('image/jpeg', 0.95);
            onPreviewGenerated(jpegData);
          } catch (error) {
            console.error('Failed to generate preview:', error);
          }
        }
    };
    window.addEventListener('generate-quote-preview', handleGenerateQuotePreview);
    return () => window.removeEventListener('generate-quote-preview', handleGenerateQuotePreview);
  }, [onPreviewGenerated]);

  const subtotalValue = useMemo(() => {
    const total = tableRows.reduce((sum, row) => {
      const amount = parseNumber(row.amount || '');
      return sum + amount;
    }, 0);
    return total;
  }, [tableRows]);

  const discountValue = useMemo(() => {
    const discount = parseNumber(data.discount || '');
    return Math.round((subtotalValue * discount) / 100);
  }, [data.discount, subtotalValue]);

  const totalDueValue = useMemo(() => subtotalValue - discountValue, [subtotalValue, discountValue]);
  const advanceValue = useMemo(() => parseNumber(data.advanceAmount || ''), [data.advanceAmount]);
  const balanceValue = useMemo(() => Math.max(totalDueValue - advanceValue, 0), [totalDueValue, advanceValue]);

  const updateField = (field: keyof DocumentData, value: string | string[]) => {
    if (viewOnly) return;
    setData((current) => ({ ...current, [field]: value }));
  };

  const updateRow = (id: string, field: keyof Omit<TableRow, 'id'>, value: string) => {
    if (viewOnly) return;
    setTableRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const visibleRows = useMemo(() => {
    const rows = [...tableRows];
    while (rows.length < 5) {
      rows.push({ id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' });
    }
    return rows.slice(0, 5);
  }, [tableRows]);

  useEffect(() => {
    const packageAmount = formatAmount(parseNumber(data.price || '') * parseNumber(data.persons || ''));
    setTableRows((current) => {
      if (!current.length) {
        return current;
      }

      if (current[0].amount === packageAmount) {
        return current;
      }

      const nextRows = [...current];
      nextRows[0] = { ...nextRows[0], amount: packageAmount };
      return nextRows;
    });
  }, [data.price, data.persons]);

  const canSaveRequest = !!_requestId && requestStatus && ['requested', 'manager_pending', 'admin_pending', 'saved', 'created', 'rejected'].includes(requestStatus) && ['manager', 'admin'].includes(user?.role || '') && !viewOnly;
  const canSendForApproval = !!_requestId && isSaved && requestStatus && (requestStatus === 'manager_pending' || requestStatus === 'saved') && user?.role === 'manager' && !viewOnly;

  useEffect(() => {
    console.log('🔍 Send for Approval Debug:', {
      _requestId,
      isSaved,
      requestStatus,
      userRole: user?.role,
      viewOnly,
      condition1: !!_requestId,
      condition2: isSaved,
      condition3: !!requestStatus,
      condition4: requestStatus === 'manager_pending' || requestStatus === 'saved',
      condition5: user?.role === 'manager',
      condition6: !viewOnly,
      canSendForApproval
    });
  }, [_requestId, isSaved, requestStatus, user?.role, viewOnly, canSendForApproval]);

  const saveQuoteRequest = async () => {
    if (!_requestId) {
      return;
    }

    try {
      setMessage('Saving quotation...');
      const saveData = {
        documentData: {
          ...data,
          subtotal: String(subtotalValue),
          totalDue: String(totalDueValue),
          balanceDue: String(balanceValue),
          tableRows
        }
      };
      const response = await quoteRequestsAPI.save(_requestId, saveData.documentData);
      let refreshedLead: Lead | null = null;
      if (response.data?.lead) {
        refreshedLead = response.data.lead;
      } else if (_leadId) {
        const leadResponse = await leadsAPI.getById(_leadId);
        refreshedLead = leadResponse.data;
      }
      setData((current) => ({
        ...current,
        ...(response.data?.documentData || saveData.documentData),
        quoteNumber: response.data?.quotationNumber || response.data?.documentData?.quoteNumber || initialQuotationNumber || saveData.documentData.quoteNumber || current.quoteNumber
      }));
      setIsSaved(true);
      setMessage('Quotation saved successfully.');
      window.dispatchEvent(new CustomEvent('quote-request-saved', { detail: { leadId: _leadId || null, lead: refreshedLead } }));
      window.dispatchEvent(new CustomEvent('lead-payment-pricing-updated', { detail: { leadId: _leadId || null, requestId: _requestId, lead: refreshedLead } }));
      _onSaved?.();
    } catch (error) {
      console.error('Failed to save quote request:', error);
      setMessage('Failed to save quotation.');
    }
  };

  const sendForApproval = async () => {
    if (!_requestId) {
      return;
    }

    try {
      setIsSubmittingApproval(true);
      setMessage('Sending for approval...');
      await quoteRequestsAPI.sendForApproval(_requestId);
      setMessage('✅ Quotation sent to admin for approval. Awaiting admin review...');
      window.dispatchEvent(new Event('quote-request-sent-approval'));
      _onSaved?.();
      setTimeout(() => {
        _onClose?.();
      }, 2000);
    } catch (error) {
      console.error('Failed to send for approval:', error);
      setMessage('Failed to send quotation for approval.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const downloadJPEG = async () => {
    if (!previewRef.current) return;
    try {
      setMessage('Generating JPEG...');
      const targetEl = (previewRef.current.closest('.pdf-page')) || previewRef.current;
      if (!targetEl) return;
      // Temporarily enforce A4 sizing to avoid wrapper/layout differences on deployed builds
      const previousStyle = targetEl.getAttribute('style') || '';
      try {
        const el = targetEl as HTMLElement;
        el.style.width = '210mm';
        el.style.height = '297mm';
        el.style.maxWidth = 'none';
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 80));
      const canvas = await html2canvas(targetEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
      });
      try { targetEl.setAttribute('style', previousStyle); } catch (e) {}
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

  return (
    <div className={`quote-invoice-root ${hidePreview || embedded ? 'embedded' : ''}`}>
      <div className={`quote-invoice-shell ${hidePreview ? 'hide-preview' : ''}`}>
        <div className="quote-invoice-sidebar">
          <div className="quote-invoice-panel">
            <h2>Invoice & Quotation Generator</h2>
            <div className="quote-tabs">
              <button type="button" className={`quote-tab ${documentType === 'quotation' ? 'active' : ''}`} onClick={() => !viewOnly && setDocumentType('quotation')} disabled={viewOnly}>
                Quotation
              </button>
              <button type="button" className={`quote-tab ${documentType === 'invoice' ? 'active' : ''}`} onClick={() => !viewOnly && setDocumentType('invoice')} disabled={viewOnly}>
                Invoice
              </button>
            </div>
            <div className="field-row">
              <div>
                <label>Customer Name</label>
                <input disabled={viewOnly} value={data.customerName} onChange={(event) => updateField('customerName', event.target.value)} />
              </div>
              <div>
                <label>Phone Number</label>
                <input disabled={viewOnly} value={data.phone} onChange={(event) => updateField('phone', event.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div>
                <label>City</label>
                <input disabled={viewOnly} value={data.city} onChange={(event) => updateField('city', event.target.value)} />
              </div>
              <div>
                <label>Destination</label>
                <input disabled={viewOnly} value={data.destination} onChange={(event) => updateField('destination', event.target.value)} />
              </div>
            </div>
            <div className="field-row-sm">
              <div>
                <label>{documentType === 'quotation' ? 'Quote #' : 'Invoice #'}</label>
                <input disabled={viewOnly} value={documentType === 'quotation' ? displayQuoteNumber : data.invoiceNumber} onChange={(event) => updateField(documentType === 'quotation' ? 'quoteNumber' : 'invoiceNumber', event.target.value)} />
              </div>
              <div>
                <label>{documentType === 'quotation' ? 'Quote Date' : 'Date'}</label>
                <input disabled={viewOnly} type="date" value={data.date} onChange={(event) => updateField('date', event.target.value)} />
              </div>
              <div>
                <label>Travel Date</label>
                <input disabled={viewOnly} type="date" value={data.travelDate} onChange={(event) => updateField('travelDate', event.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div>
                <label>Package Name</label>
                <input disabled={viewOnly} value={data.packageName} onChange={(event) => updateField('packageName', event.target.value)} />
              </div>
              <div>
                <label>No. of Person(s)</label>
                <input disabled={viewOnly} value={data.persons} onChange={(event) => updateField('persons', event.target.value)} />
              </div>
            </div>
            <div>
              <label>Package Description</label>
              <textarea disabled={viewOnly} value={data.packageDescription} onChange={(event) => updateField('packageDescription', event.target.value)} />
            </div>
            <div className="field-row">
              <div>
                <label>Accommodation Type</label>
                <input disabled={viewOnly} value={data.accommodationType} onChange={(event) => updateField('accommodationType', event.target.value)} />
              </div>
              <div>
                <label>Transportation Type</label>
                <input disabled={viewOnly} value={data.transportationType} onChange={(event) => updateField('transportationType', event.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div>
                <label>Departure Location</label>
                <input disabled={viewOnly} value={data.departureLocation} onChange={(event) => updateField('departureLocation', event.target.value)} />
              </div>
            </div>
            <div className="field-row-sm">
              <div>
                <label>Price</label>
                <input disabled={viewOnly} value={data.price} onChange={(event) => updateField('price', event.target.value)} />
              </div>
              <div>
                <label>Discount %</label>
                <input disabled={viewOnly} value={data.discount} onChange={(event) => updateField('discount', event.target.value)} />
              </div>
              <div>
                <label>Advance Amount</label>
                <input disabled={viewOnly} value={data.advanceAmount} onChange={(event) => updateField('advanceAmount', event.target.value)} />
              </div>
            </div>
            <div>
              <label>Package Includes</label>
              <textarea disabled={viewOnly} value={data.packageIncludes.join('\n')} onChange={(event) => updateField('packageIncludes', event.target.value.split('\n'))} />
              <small>Enter each item on a new line.</small>
            </div>
            <div className="space-y-2">
              <button type="button" className="btn-primary" onClick={downloadJPEG}>
                Download JPEG
              </button>
              {canSaveRequest && (
                <button type="button" className="btn-primary" onClick={saveQuoteRequest}>
                  Save Quotation
                </button>
              )}
              {canSendForApproval && (
                <button 
                  type="button" 
                  className="btn-success" 
                  onClick={sendForApproval}
                  disabled={isSubmittingApproval}
                >
                  {isSubmittingApproval ? 'Sending...' : '📤 Send for Approval'}
                </button>
              )}
            </div>
            {message && <small>{message}</small>}
          </div>
          <div className="quote-invoice-panel">
            <h2>Table Rows</h2>
            <div style={{ display: 'grid', gap: '14px' }}>
              {visibleRows.map((row, index) => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                  <input disabled={viewOnly} value={row.particulars} placeholder={index === 0 ? 'Package title' : ''} onChange={(event) => updateRow(row.id, 'particulars', event.target.value)} />
                  <input disabled={viewOnly} value={row.persons} placeholder="Pax" onChange={(event) => updateRow(row.id, 'persons', event.target.value)} />
                  <input disabled={viewOnly} value={row.price} placeholder="Price" onChange={(event) => updateRow(row.id, 'price', event.target.value)} />
                  <input disabled={viewOnly} value={row.amount} placeholder="Amount" onChange={(event) => updateRow(row.id, 'amount', event.target.value)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="quote-invoice-preview" style={previewHiddenStyle} aria-hidden={hidePreview ? 'true' : undefined}>
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
                      <div className="pdf-quote-meta-block">
                        <div className="pdf-quote-meta-row">
                          <span>Quote #</span>
                          <strong>{displayQuoteNumber}</strong>
                        </div>
                        <div className="pdf-quote-meta-row">
                          <span>Quote Date</span>
                          <strong>{formatDate(data.date)}</strong>
                        </div>
                      </div>
                      <div className="pdf-quotation-title">QUOTATION</div>
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
                        <th className="text-center">No. of Person(s)</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="pdf-description-cell">
                          <div className="pdf-package-title">{data.packageName}</div>
                          <div className="pdf-package-description">{data.packageDescription}</div>
                          <div className="pdf-package-info-group">
                            <div className="pdf-package-info-line">
                              <strong>Accommodation Type</strong>
                              <span>{data.accommodationType}</span>
                            </div>
                            <div className="pdf-package-info-line">
                              <strong>Transportation Type</strong>
                              <span>{data.transportationType}</span>
                            </div>
                            <div className="pdf-package-info-line">
                              <strong>Departure Location</strong>
                              <span>{data.departureLocation}</span>
                            </div>
                          </div>
                        </td>
                        <td className="pdf-price-cell text-right"><strong>{data.price}</strong></td>
                        <td className="pdf-person-cell text-center">
                          <div className="pdf-person-value">{data.persons}</div>
                        </td>
                        <td className="pdf-amount-cell text-right">
                          <strong>{formatAmount(parseNumber(data.price) * parseNumber(data.persons))}</strong>
                        </td>
                      </tr>
                      <tr className="pdf-footer-row">
                        <td colSpan={3}>
                          <div className="pdf-left-box">
                            <div className="pdf-notes pdf-package-includes-box">
                              <div className="notes-title">PACKAGE INCLUDES:</div>
                              {data.packageIncludes.map((item, index) => (
                                <div key={index}>{item}</div>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td>
                          <table className="pdf-summary">
                            <tbody>
                              <tr>
                                <td className="label">Subtotal</td>
                                <td className="value"><strong>{subtotalValue.toLocaleString('en-US')}</strong></td>
                              </tr>
                              <tr>
                                <td className="label">Total Amount Paid</td>
                                <td className="value"><strong>{advanceValue.toLocaleString('en-US')}</strong></td>
                              </tr>
                              <tr>
                                <td className="label">Quote</td>
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
