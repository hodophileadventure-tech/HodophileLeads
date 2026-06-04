import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import quoteHeaderImage from '../assets/quote-header.png';
import quoteFooterImage from '../assets/quote-footer.jpeg';
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
  quoteNumber: 'QT-000142',
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

export const QuoteInvoicePage: React.FC = () => {
  const [documentType, setDocumentType] = useState<'quotation' | 'invoice'>('quotation');
  const [data, setData] = useState<DocumentData>(defaultData);
  const [tableRows, setTableRows] = useState<TableRow[]>(getDefaultRows());
  const [message, setMessage] = useState<string>('');
  const previewRef = useRef<HTMLDivElement | null>(null);

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

  const visibleRows = useMemo(() => {
    const rows = [...tableRows];
    while (rows.length < 5) {
      rows.push({ id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' });
    }
    return rows.slice(0, 5);
  }, [tableRows]);

  const previewRows = useMemo(
    () =>
      visibleRows.map((row, index) => ({
        ...row,
        keepDefaultValues: index === 0 && !row.particulars && !row.persons && !row.price && !row.amount,
      })),
    [visibleRows],
  );

  return (
    <div className="quote-invoice-root">
      <div className="quote-invoice-shell">
        <div className="quote-invoice-sidebar">
          <div className="quote-invoice-panel">
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
                <input value={documentType === 'quotation' ? data.quoteNumber : data.invoiceNumber} onChange={(event) => updateField(documentType === 'quotation' ? 'quoteNumber' : 'invoiceNumber', event.target.value)} />
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
            <button type="button" className="btn-primary" onClick={downloadJPEG}>
              Download JPEG
            </button>
            {message && <small>{message}</small>}
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
                  <div className="pdf-header-info-left">
                    <div className="pdf-header-info-label">Customer</div>
                    <div className="pdf-header-info-value">{data.customerName}</div>
                    <div className="pdf-header-info-value">{data.phone}</div>
                    <div className="pdf-header-info-value">{data.city}</div>
                  </div>
                  <div className="pdf-header-info-right">
                    <div className="pdf-quotation-title">QUOTATION</div>
                    <div className="pdf-quote-meta">
                      <div className="pdf-quote-meta-row">
                        <span>Quote #</span>
                        <strong>{data.quoteNumber}</strong>
                      </div>
                      <div className="pdf-quote-meta-row">
                        <span>Quote Date</span>
                        <strong>{formatDate(data.date)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pdf-table-wrapper">
                  <table className="pdf-main-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Description</th>
                        <th>Price</th>
                        <th>Number of Person</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => {
                        const useDefault = row.keepDefaultValues;
                        const title = row.particulars || (useDefault ? data.packageName : '');
                        const price = useDefault ? data.price : row.price;
                        const persons = useDefault ? data.persons : row.persons;
                        const amount = useDefault ? subtotalValue.toLocaleString('en-US') : row.amount;

                        return (
                          <tr key={row.id}>
                            <td>
                              <div className="pdf-table-item-title">{title}</div>
                            </td>
                            <td>
                              {index === 0 && (row.particulars || useDefault) ? (
                                <>
                                  <div className="pdf-table-description-text">{data.packageDescription}</div>
                                  <div className="pdf-table-detail-text">{data.persons} Persons (Family Trip)</div>
                                  <div className="pdf-table-detail-text">03 Rooms each night</div>
                                </>
                              ) : null}
                            </td>
                            <td className="pdf-table-price-column">{price}</td>
                            <td className="pdf-table-persons-column">{persons}</td>
                            <td className="pdf-table-amount-column">{amount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="pdf-bottom-content">
                  <div className="pdf-notes-panel">
                    <div className="pdf-notes-heading">NOTES:</div>
                    <div className="pdf-note-line"><span>Accommodation Type:</span> {data.accommodationType}</div>
                    <div className="pdf-note-line"><span>Transportation Type:</span> {data.transportationType}</div>
                    <div className="pdf-note-line"><span>Departure Location:</span> {data.departureLocation}</div>
                    <div className="pdf-package-includes-title">Package included:</div>
                    <ul className="pdf-package-includes-list">
                      {data.packageIncludes.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                    <div className="pdf-package-validity">Quotation valid only for 7 Days.</div>
                  </div>
                  <div className="pdf-summary-panel">
                    <div className="pdf-summary-row">
                      <span>Subtotal</span>
                      <strong>{subtotalValue.toLocaleString('en-US')}</strong>
                    </div>
                    <div className="pdf-summary-row">
                      <span>Total</span>
                      <strong>{totalDueValue.toLocaleString('en-US')}</strong>
                    </div>
                    <div className="pdf-summary-row">
                      <span>Amount Paid</span>
                      <strong>{advanceValue.toLocaleString('en-US')}</strong>
                    </div>
                    <div className="pdf-summary-row pdf-summary-row-total">
                      <span>Quote</span>
                      <strong>{balanceValue.toLocaleString('en-US')}</strong>
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
