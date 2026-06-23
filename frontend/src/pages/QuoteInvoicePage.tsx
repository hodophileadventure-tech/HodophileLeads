import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { quoteRequestsAPI, leadsAPI } from '../utils/api-service';
import html2canvas from 'html2canvas';
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
  requestId?: string;
  requestType?: 'quotation' | 'invoice';
  requestStatus?: 'requested' | 'saved' | 'manager_pending' | 'admin_pending' | 'approved' | 'rejected';
  initialDocumentData?: any;
  viewOnly?: boolean;
  generatePreviewOnMount?: boolean;
  onPreviewGenerated?: (dataUrl: string) => void;
  onSaved?: () => void;
  onClose?: () => void;
  hidePreview?: boolean;
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
  {
    id: crypto.randomUUID(),
    particulars: '8 Days Hunza & Skardu (By Road)',
    persons: '04',
    price: '160,000',
    amount: '640,000',
  },
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
  packageName: '8 Days Hunza & Skardu (By Road)',
  packageDescription: 'A premium mountain experience with luxury camps and private transport.',
  persons: '04',
  price: '160,000',
  subtotal: '640,000',
  discount: '5',
  totalDue: '608,000',
  advanceAmount: '200,000',
  balanceDue: '408,000',
  notes: [
    'Remaining amount handed over to Driver cum Guide at departure is mandatory.',
    'Detailed itinerary already shared.',
    'Read Terms & Conditions.',
  ],
  packageIncludes: ['Transport', 'Accommodation', 'Breakfast & Dinner', 'Jeep Ride'],
  accommodationType: 'Standard Accommodation',
  transportationType: 'ISB-to-ISB',
  departureLocation: 'Grand Cabin',
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

export const QuoteInvoicePage: React.FC<QuoteInvoicePageProps> = ({
  leadId: _leadId,
  requestId: _requestId,
  requestType: _requestType,
  requestStatus,
  initialDocumentData,
  viewOnly = false,
  generatePreviewOnMount = false,
  onPreviewGenerated,
  onSaved: _onSaved,
  onClose: _onClose,
  hidePreview = false,
}) => {
  const { user } = useAuth();
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice'>(_requestType || 'quotation');
  const [data, setData] = useState<DocumentData>(defaultData);
  const [tableRows, setTableRows] = useState<TableRow[]>(getDefaultRows());
  const [message, setMessage] = useState<string>('');
  const [isLoadingQuoteNumber, setIsLoadingQuoteNumber] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const displayQuoteNumber = data.quoteNumber || (isLoadingQuoteNumber ? 'Loading...' : '');

  useEffect(() => {
    if (_requestType) {
      setDocumentType(_requestType);
    }
  }, [_requestType]);

  useEffect(() => {
    if (initialDocumentData) {
      setData((current) => ({
        ...current,
        ...initialDocumentData,
        quoteNumber: initialDocumentData.quoteNumber || current.quoteNumber,
        invoiceNumber: initialDocumentData.invoiceNumber || current.invoiceNumber
      }));
      if (Array.isArray(initialDocumentData.tableRows) && initialDocumentData.tableRows.length > 0) {
        setTableRows(initialDocumentData.tableRows);
      }
    }
  }, [initialDocumentData]);

  // Auto-populate form with lead details
  useEffect(() => {
    if (_leadId && !initialDocumentData) {
      leadsAPI.getById(_leadId)
        .then((response) => {
          const lead = response.data;
          setData((current) => ({
            ...current,
            customerName: lead.clientName || current.customerName,
            phone: lead.phone || current.phone,
            city: lead.address || current.city,
            destination: lead.destination || current.destination,
            persons: lead.persons ? String(lead.persons) : current.persons,
            accommodationType: lead.hotelPreference || current.accommodationType,
            transportationType: lead.transportPreference || current.transportationType,
            travelDate: lead.travelDates?.from || (lead.travel_date ? lead.travel_date.split('T')[0] : current.travelDate),
          }));
        })
        .catch((error) => {
          console.error('Failed to load lead details:', error);
        });
    }
  }, [_leadId, initialDocumentData]);

  useEffect(() => {
    if (documentType === 'quotation' && !data.quoteNumber) {
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
  }, [data.date, documentType, data.quoteNumber]);

  useEffect(() => {
    if (generatePreviewOnMount && previewRef.current && onPreviewGenerated) {
      const generatePreview = async () => {
        try {
          const canvas = await html2canvas(previewRef.current!, {
            scale: 1,
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

  useEffect(() => {
    const handleGenerateQuotePreview = async () => {
      if (previewRef.current && onPreviewGenerated) {
        try {
          const canvas = await html2canvas(previewRef.current, {
            scale: 1,
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
      const amount = Number(row.amount.replace(/[^0-9.]/g, '')) || 0;
      return sum + amount;
    }, 0);
    return total;
  }, [tableRows]);

  const discountValue = useMemo(() => {
    const discount = Number(data.discount.replace(/[^0-9.]/g, '')) || 0;
    return Math.round((subtotalValue * discount) / 100);
  }, [data.discount, subtotalValue]);

  const totalDueValue = useMemo(() => subtotalValue - discountValue, [subtotalValue, discountValue]);
  const advanceValue = useMemo(() => Number(data.advanceAmount.replace(/[^0-9.]/g, '')) || 0, [data.advanceAmount]);
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

  const canSaveRequest = !!_requestId && requestStatus === 'requested' && user?.role === 'manager' && !viewOnly;

  const saveQuoteRequest = async () => {
    if (!_requestId) {
      return;
    }

    try {
      setMessage('Saving quotation...');
      await quoteRequestsAPI.save(_requestId, {
        documentData: {
          ...data,
          tableRows
        }
      });
      setMessage('Quotation saved successfully.');
      window.dispatchEvent(new Event('quote-request-saved'));
      _onSaved?.();
    } catch (error) {
      console.error('Failed to save quote request:', error);
      setMessage('Failed to save quotation.');
    }
  };

  const downloadJPEG = async () => {
    if (!previewRef.current) return;
    try {
      setMessage('Generating JPEG...');
      const canvas = await html2canvas(previewRef.current, {
        scale: 1,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
      });
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
    <div className="quote-invoice-root">
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
            <div>
              <label>Notes</label>
              <textarea value={data.notes.join('\n')} onChange={(event) => updateField('notes', event.target.value.split('\n'))} />
              <small>Enter each note on a new line.</small>
            </div>
            <div className="space-y-2">
              <button type="button" className="btn-primary" onClick={downloadJPEG} disabled={viewOnly}>
                Download JPEG
              </button>
              {canSaveRequest && (
                <button type="button" className="btn-primary" onClick={saveQuoteRequest}>
                  Save Quotation
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

        {!hidePreview && (
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
                        <th>No. of Person(s)</th>
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
                        </td>
                        <td className="pdf-price-cell text-right"><strong>{data.price}</strong></td>
                        <td className="pdf-person-cell text-center">{data.persons}</td>
                        <td className="pdf-amount-cell text-right">
                          <strong>{formatAmount(parseNumber(data.price) * parseNumber(data.persons))}</strong>
                        </td>
                      </tr>
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
        )}
      </div>
    </div>
  );
};
