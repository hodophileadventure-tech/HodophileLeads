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
}> = ({ leadId, requestId, onSaved, onClose }) => {
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice'>('quotation');
  const [data, setData] = useState<DocumentData>(defaultData);
  const [tableRows, setTableRows] = useState<TableRow[]>(getDefaultRows());
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(!!leadId);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const displayQuoteNumber = data.quoteNumber || previewQuoteNumber(data.date);

  // Load lead data if leadId is provided
  useEffect(() => {
    if (!leadId) return;

    const loadLeadData = async () => {
      try {
        setLoading(true);
        const response = await leadsAPI.getById(leadId);
        const lead = response.data;

        setData((current) => ({
          ...current,
          customerName: lead.clientName || '',
          phone: lead.phone || '',
          city: lead.address || '',
          destination: Array.isArray(lead.destinations) ? lead.destinations.join(', ') : lead.destination || '',
          travelDate: lead.travelDates?.from ? new Date(lead.travelDates.from).toISOString().split('T')[0] : current.travelDate,
        }));

        setDocumentType((current) => {
          if (requestId) {
            // Keep the document type from request if available
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
    if (documentType === 'quotation' && !data.quoteNumber) {
      const generated = previewQuoteNumber(data.date);
      setData((current) => ({ ...current, quoteNumber: generated }));
    }
  }, [data.date, documentType, data.quoteNumber]);

  const visibleRows = useMemo(() => {
    const rows = [...tableRows];
    while (rows.length < 5) {
      rows.push({ id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' });
    }
    return rows.slice(0, 5);
  }, [tableRows]);

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
      .map((row) => {
        const rowAmountValue = row.amount
          ? parseNumber(row.amount)
          : parseNumber(row.price) * parseNumber(row.persons);
        const displayAmount = rowAmountValue > 0 ? formatAmount(rowAmountValue) : '';
        return { ...row, displayAmount };
      })
      .filter((row, index) => {
        if (index === 0) return true;
        return Boolean(row.particulars || row.persons || row.price || row.amount);
      });
  }, [visibleRows]);

  const updateField = (field: keyof DocumentData, value: string | string[]) => {
    setData((current) => ({ ...current, [field]: value }));
  };

  const updateRow = (id: string, field: keyof Omit<TableRow, 'id'>, value: string) => {
    setTableRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
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

  const downloadPDF = async () => {
    if (!previewRef.current) return;
    try {
      setMessage('Generating PDF...');
      const canvas = await html2canvas(previewRef.current, {
        scale: 1,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
      });
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

  return (
    <div className="quote-invoice-root">
      <div className="quote-invoice-shell">
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
                    <input value={data.customerName} onChange={(event) => updateField('customerName', event.target.value)} />
                  </div>
                  <div>
                    <label>Phone Number</label>
                    <input value={data.phone} onChange={(event) => updateField('phone', event.target.value)} />
                  </div>
                </div>
                <div className="field-row">
                  <div>
                    <label>City</label>
                    <input value={data.city} onChange={(event) => updateField('city', event.target.value)} />
                  </div>
                  <div>
                <label>Destination</label>
                <input value={data.destination} onChange={(event) => updateField('destination', event.target.value)} />
              </div>
            </div>
            <div className="field-row-sm">
              <div>
                <label>{documentType === 'quotation' ? 'Quote #' : 'Invoice #'}</label>
                <input value={documentType === 'quotation' ? displayQuoteNumber : data.invoiceNumber} onChange={(event) => updateField(documentType === 'quotation' ? 'quoteNumber' : 'invoiceNumber', event.target.value)} />
              </div>
              <div>
                <label>{documentType === 'quotation' ? 'Quote Date' : 'Date'}</label>
                <input type="date" value={data.date} onChange={(event) => updateField('date', event.target.value)} />
              </div>
              <div>
                <label>Travel Date</label>
                <input type="date" value={data.travelDate} onChange={(event) => updateField('travelDate', event.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div>
                <label>Package Name</label>
                <input value={data.packageName} onChange={(event) => updateField('packageName', event.target.value)} />
              </div>
              <div>
                <label>No. of Person(s)</label>
                <input value={data.persons} onChange={(event) => updateField('persons', event.target.value)} />
              </div>
            </div>
            <div>
              <label>Package Description</label>
              <textarea value={data.packageDescription} onChange={(event) => updateField('packageDescription', event.target.value)} />
            </div>
            <div className="field-row">
              <div>
                <label>Accommodation Type</label>
                <input value={data.accommodationType} onChange={(event) => updateField('accommodationType', event.target.value)} />
              </div>
              <div>
                <label>Transportation Type</label>
                <input value={data.transportationType} onChange={(event) => updateField('transportationType', event.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div>
                <label>Departure Location</label>
                <input value={data.departureLocation} onChange={(event) => updateField('departureLocation', event.target.value)} />
              </div>
            </div>
            <div className="field-row-sm">
              <div>
                <label>Price</label>
                <input value={data.price} onChange={(event) => updateField('price', event.target.value)} />
              </div>
              <div>
                <label>Discount %</label>
                <input value={data.discount} onChange={(event) => updateField('discount', event.target.value)} />
              </div>
              <div>
                <label>Advance Amount</label>
                <input value={data.advanceAmount} onChange={(event) => updateField('advanceAmount', event.target.value)} />
              </div>
            </div>
            <div>
              <label>Package Includes</label>
              <textarea value={data.packageIncludes.join('\n')} onChange={(event) => updateField('packageIncludes', event.target.value.split('\n'))} />
              <small>Enter each item on a new line.</small>
            </div>
            <div>
              <label>Notes</label>
              <textarea value={data.notes.join('\n')} onChange={(event) => updateField('notes', event.target.value.split('\n'))} />
              <small>Enter each note on a new line.</small>
            </div>
            <div className="download-actions">
              <button type="button" className="btn-primary" onClick={downloadJPEG}>
                Download JPEG
              </button>
              <button type="button" className="btn-primary btn-secondary" onClick={downloadPDF}>
                Download PDF
              </button>
              {requestId && (
                <button type="button" className="btn-primary" style={{ gridColumn: '1 / -1', backgroundColor: '#10b981' }} onClick={saveQuotation}>
                  Save Quotation
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
                  <input value={row.particulars} placeholder={index === 0 ? 'Package title' : ''} onChange={(event) => updateRow(row.id, 'particulars', event.target.value)} />
                  <input value={row.persons} placeholder="Pax" onChange={(event) => updateRow(row.id, 'persons', event.target.value)} />
                  <input value={row.price} placeholder="Price" onChange={(event) => updateRow(row.id, 'price', event.target.value)} />
                  <input value={row.amount} placeholder="Amount" onChange={(event) => updateRow(row.id, 'amount', event.target.value)} />
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
