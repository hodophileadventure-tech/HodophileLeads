import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import hodophileLogo from '../assets/hodophile-logo-black.png';
import nadraLogo from '../assets/logos/NADRA_logo-removebg-preview.png';
import pakistanGovLogo from '../assets/logos/pakistan-govt-logo-png_seeklogo-190628-removebg-preview.png';
import fbrLogo from '../assets/logos/images-removebg-preview.png';
import patoLogo from '../assets/logos/images__1_-removebg-preview.png';
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

  const downloadPDF = async () => {
    if (!previewRef.current) return;
    try {
      setMessage('Generating PDF...');
      const canvas = await html2canvas(previewRef.current, {
        scale: 1,
        backgroundColor: '#f2f2f2',
        useCORS: true,
        allowTaint: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = canvas.width;
      const pdfHeight = canvas.height;
      const pdf = new jsPDF({ unit: 'px', format: [pdfWidth, pdfHeight] });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const filename = `${documentType === 'quotation' ? data.quoteNumber || 'Quotation' : data.invoiceNumber || 'Invoice'} - ${data.customerName || 'Client'}.pdf`;
      pdf.save(filename);
      setMessage('PDF generated successfully.');
    } catch (error) {
      console.error(error);
      setMessage('Failed to generate PDF. Please try again.');
    }
  };

  const visibleRows = useMemo(() => {
    const rows = [...tableRows];
    while (rows.length < 5) {
      rows.push({ id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' });
    }
    return rows.slice(0, 5);
  }, [tableRows]);

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
            <button type="button" className="btn-primary" onClick={downloadPDF}>
              Download PDF
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
              <div className="pdf-header">
                <div className="pdf-header-image">
                  <img src={hodophileLogo} alt="Hodophile logo" />
                </div>
                <div className="pdf-brand-block">
                  <div className="pdf-brand-title">Hodophile Adventure</div>
                  <div className="pdf-brand-tagline">The perfect experience</div>
                  <div className="pdf-brand-address">
                    Suite # M2<br />
                    Mezzanine Floor<br />
                    Plot #111-113-C<br />
                    PECHS Block-2<br />
                    Tariq Road Karachi<br />
                    +92 337 7774460<br />
                    Government License #5436
                  </div>
                </div>
                <div className="pdf-title-block">
                  <h1 className="pdf-title">{documentType === 'quotation' ? 'QUOTATION' : 'INVOICE'}</h1>
                  <div className="pdf-meta">
                    <div className="pdf-meta-row">
                      <div className="pdf-label">{documentType === 'quotation' ? 'Quote #' : 'Invoice #'}</div>
                      <div className="pdf-colon">:</div>
                      <div className="pdf-value">{documentType === 'quotation' ? data.quoteNumber : data.invoiceNumber}</div>
                    </div>
                    <div className="pdf-meta-row">
                      <div className="pdf-label">{documentType === 'quotation' ? 'Quote Date' : 'Date'}</div>
                      <div className="pdf-colon">:</div>
                      <div className="pdf-value">{formatDate(data.date)}</div>
                    </div>
                    <div className="pdf-meta-row">
                      <div className="pdf-label">Destination</div>
                      <div className="pdf-colon">:</div>
                      <div className="pdf-value">{data.destination}</div>
                    </div>
                    <div className="pdf-meta-row">
                      <div className="pdf-label">Travel Date</div>
                      <div className="pdf-colon">:</div>
                      <div className="pdf-value">{formatDate(data.travelDate)}</div>
                    </div>
                    <div className="pdf-meta-row">
                      <div className="pdf-label">No. of Person(s)</div>
                      <div className="pdf-colon">:</div>
                      <div className="pdf-value">{data.persons}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pdf-top-divider" />

              <div className="pdf-customer-box">
                <p className="pdf-customer-box-title">Customer</p>
                <p className="pdf-customer-box-text"><strong>{data.customerName}</strong></p>
                <p className="pdf-customer-box-text">{data.phone}</p>
                <p className="pdf-customer-box-text">{data.city}</p>
              </div>

              <div className="pdf-table-section">
                <div className="pdf-table-wrapper">
                  <table className="pdf-table">
                    <colgroup>
                      <col />
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Particulars</th>
                        <th>Number of Person(s)</th>
                        <th>Price</th>
                        <th>Amount in PKR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {row.particulars ? <span className="pdf-package-title">{row.particulars}</span> : ''}
                            {!row.particulars && <span>&nbsp;</span>}
                          </td>
                          <td>{row.persons || ''}</td>
                          <td className="right">{row.price || ''}</td>
                          <td className="right">{row.amount || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pdf-summary-panel">
                  <div className="pdf-summary-row">
                    <div className="pdf-summary-label">Subtotal</div>
                    <div className="pdf-summary-value">{subtotalValue.toLocaleString('en-US')}</div>
                  </div>
                  <div className="pdf-summary-row">
                    <div className="pdf-summary-label">Discount</div>
                    <div className="pdf-summary-value">{discountValue.toLocaleString('en-US')}</div>
                  </div>
                  <div className="pdf-summary-row">
                    <div className="pdf-summary-label">Total Due</div>
                    <div className="pdf-summary-value">{totalDueValue.toLocaleString('en-US')}</div>
                  </div>
                  <div className="pdf-summary-row">
                    <div className="pdf-summary-label">Advance Amount</div>
                    <div className="pdf-summary-value">{advanceValue.toLocaleString('en-US')}</div>
                  </div>
                  <div className="pdf-summary-row">
                    <div className="pdf-summary-label">Balance Due</div>
                    <div className="pdf-summary-value">{balanceValue.toLocaleString('en-US')}</div>
                  </div>
                </div>
              </div>

              <div className="pdf-notes">
                <p className="pdf-notes-title">Notes</p>
                <ul className="pdf-notes-list">
                  {data.notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </div>

              {documentType === 'quotation' && (
                <div className="pdf-package-includes">
                  <p className="pdf-package-includes-title">Package Included:</p>
                  <ul className="pdf-package-includes-list">
                    {data.packageIncludes.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                  <p className="pdf-package-validity">Quotation valid only for 7 Days.</p>
                </div>
              )}

              <div className="pdf-footer">
                <div className="pdf-footer-logos">
                  <div className="pdf-footer-logo pdf-footer-logo--govt">
                    <img src={pakistanGovLogo} alt="Government of Pakistan logo" />
                  </div>
                  <div className="pdf-footer-logo pdf-footer-logo--fbr">
                    <img src={fbrLogo} alt="FBR logo" />
                  </div>
                  <div className="pdf-footer-logo pdf-footer-logo--pato">
                    <img src={patoLogo} alt="PATO logo" />
                  </div>
                  <div className="pdf-footer-logo pdf-footer-logo--nadra">
                    <img src={nadraLogo} alt="NADRA logo" />
                  </div>
                </div>
                <div className="pdf-footer-partners">
                  <div className="pdf-footer-partner">NADRA</div>
                  <div className="pdf-footer-partner">Government of Pakistan</div>
                  <div className="pdf-footer-partner">PATO</div>
                  <div className="pdf-footer-partner">FBR</div>
                </div>
                <div className="pdf-footer-bar">
                  <div className="pdf-footer-item">
                    <span className="pdf-footer-icon">W</span> hodophile.com
                  </div>
                  <div className="pdf-footer-item">
                    <span className="pdf-footer-icon">E</span> info@hodophile.com
                  </div>
                  <div className="pdf-footer-item">
                    <span className="pdf-footer-icon">P</span> +92 337 7774460
                  </div>
                  <div className="pdf-footer-item">
                    <span className="pdf-footer-icon">O</span> Bin Suleman Tower, Karachi
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
