import React, { useMemo, useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { quoteRequestsAPI } from '../utils/api-service';
import watermarkImage from '../assets/invoice-watermark.jpg';
// Prefer a bundled asset inside the project so the logo works in all environments.
// Place your image at `frontend/src/assets/hodophile-logo.jpeg` (or .png) and it'll be used.
// Prefer loading the logo from the public `assets/` folder so builds don't fail
// if a project-local image wasn't added. Place the image at `frontend/public/assets/hodophile-logo.jpeg`.
// Prefer the PNG (removebg) if present; fallback to JPEG is handled by the browser cache/fetch.
const hodophileLogoPath = '/assets/hodophile-logo.png';
import invoiceLogoImage from '../assets/invoice-logo.png';
import invoiceHeadingImage from '../assets/INVOICE.png';
import govtLogo from '../assets/logos/pakistan-govt-logo-png_seeklogo-190628-removebg-preview.png';
import nadraLogo from '../assets/logos/NADRA_logo-removebg-preview.png';
import patoLogo from '../assets/logos/images__1_-removebg-preview.png';
import fbrLogo from '../assets/logos/images-removebg-preview.png';
import './InvoicePage.css';

type Row = { id: string; particulars: string; persons: string; price: string; amount: string };

type InvoicePageProps = {
  onPreviewGenerated?: (dataUrl: string) => void;
  generatePreviewOnMount?: boolean;
  hidePreview?: boolean;
};

export const InvoicePage: React.FC<InvoicePageProps> = ({
  onPreviewGenerated,
  generatePreviewOnMount = false,
  hidePreview = false,
}) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [travelDate, setTravelDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [persons, setPersons] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const defaultInvoiceNumber = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '0000001101';
    const yy = String(parsed.getFullYear()).slice(-2);
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}1101`;
  };

  const fetchNextInvoiceNumber = async (dateString: string): Promise<string> => {
    try {
      const response = await quoteRequestsAPI.getNextQuotationNumber(dateString);
      return response.data.quotationNumber;
    } catch (error) {
      console.error('Failed to fetch next invoice number:', error);
      return defaultInvoiceNumber(dateString);
    }
  };

  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => defaultInvoiceNumber(new Date().toISOString().split('T')[0]));

  const [customerName, setCustomerName] = useState<string>('');
  const [number, setNumber] = useState<string>('');
  const [city, setCity] = useState<string>('');

  const [rows, setRows] = useState<Row[]>([
    { id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' },
  ]);

  const [discount, setDiscount] = useState<string>('');
  const [advance, setAdvance] = useState<string>('');

  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const previewDocRef = useRef<HTMLDivElement | null>(null);

  // Debug helper: if `?forcePreview=1` or `?mockInvoice=1` is present, populate sample data
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('forcePreview') === '1' || params.get('mockInvoice') === '1') {
        setCustomerName('Test Client');
        setNumber('0337-7777460');
        setCity('Karachi');
        setDestination('Sample Destination');
        setRows([
          { id: crypto.randomUUID(), particulars: 'Tour Package A', persons: '2', price: '50000', amount: '100000' },
          { id: crypto.randomUUID(), particulars: 'Hotel (2 nights)', persons: '2', price: '20000', amount: '40000' },
          { id: crypto.randomUUID(), particulars: 'Transport', persons: '2', price: '5000', amount: '10000' },
        ]);
        setDiscount('5');
        setAdvance('20000');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadInvoiceNumber = async () => {
      const nextNumber = await fetchNextInvoiceNumber(date);
      if (active) {
        setInvoiceNumber(nextNumber);
      }
    };
    loadInvoiceNumber();
    return () => {
      active = false;
    };
  }, [date]);


  const parseNumber = (v: string) => {
    const n = Number(String(v).replace(/[^0-9.]/g, ''));
    return Number.isNaN(n) ? 0 : n;
  };

  const updateRow = (id: string, field: keyof Omit<Row, 'id'>, value: string) => {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const syncRowAmounts = () => {
    setRows((current) =>
      current.map((r) => {
        const p = parseNumber(r.price);
        const ps = parseNumber(r.persons) || parseNumber(persons);
        const amount = p * ps;
        return { ...r, amount: amount ? String(amount) : r.amount };
      })
    );
  };

  const addRow = () =>
    setRows((c) => [...c, { id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' }]);
  const removeRow = (id: string) => setRows((c) => c.filter((r) => r.id !== id));

  const subtotal = useMemo(() => rows.reduce((s, r) => s + parseNumber(r.amount), 0), [rows]);
  const discountValue = useMemo(() => Math.round((subtotal * parseNumber(discount)) / 100), [subtotal, discount]);
  const totalDue = useMemo(() => subtotal - discountValue, [subtotal, discountValue]);
  const balance = useMemo(() => Math.max(totalDue - parseNumber(advance), 0), [totalDue, advance]);

  const previewRows = useMemo(() => {
    const filled = [...rows];
    while (filled.length < 6) {
      filled.push({ id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' });
    }
    return filled.slice(0, 6);
  }, [rows]);

  const generatePreview = React.useCallback(async () => {
    if (!previewDocRef.current) return null;
    try {
      const canvas = await html2canvas(previewDocRef.current, {
        scale: 1,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
      });
      const jpegData = canvas.toDataURL('image/jpeg', 0.95);
      if (onPreviewGenerated) {
        onPreviewGenerated(jpegData);
      }
      return jpegData;
    } catch (error) {
      console.error('Failed to generate preview:', error);
      return null;
    }
  }, [onPreviewGenerated]);

  React.useEffect(() => {
    if (!generatePreviewOnMount || !onPreviewGenerated) return;
    generatePreview();
  }, [generatePreview, generatePreviewOnMount, onPreviewGenerated]);

  React.useEffect(() => {
    const listener = async () => {
      await generatePreview();
    };
    window.addEventListener('generate-invoice-preview', listener);
    return () => window.removeEventListener('generate-invoice-preview', listener);
  }, [generatePreview]);

  const formattedDate = useMemo(() => {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-GB');
  }, [date]);

  const formattedTravelDate = useMemo(() => {
    const parsed = new Date(travelDate);
    return Number.isNaN(parsed.getTime())
      ? travelDate
      : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }, [travelDate]);

  const downloadJPEG = async () => {
    const target = previewDocRef.current;
    if (!target) return;
    try {
      // Temporarily enforce A4 width while allowing height to grow so the footer and separators are fully captured
      const previousStyle = target.getAttribute('style') || '';
      try {
        const el = target as HTMLElement;
        el.style.width = '210mm';
        el.style.maxWidth = 'none';
        el.style.height = 'auto';
        el.style.minHeight = '297mm';
        el.style.maxHeight = 'none';
        el.style.overflow = 'visible';
      } catch (e) {
        // ignore
      }
      // allow layout to settle
      await new Promise((r) => setTimeout(r, 120));
      const width = target.scrollWidth;
      const height = target.scrollHeight;
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
      });
      // restore inline style
      try {
        target.setAttribute('style', previousStyle);
      } catch (e) {
        // ignore
      }
      const data = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = data;
      link.download = `Invoice-${customerName || 'Invoice'}.jpeg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate JPEG', err);
    }
  };

  const saveInvoice = () => {
    const invoiceData = {
      invoiceNumber,
      date,
      travelDate,
      destination,
      persons,
      customerName,
      number,
      city,
      discount,
      advance,
      subtotal,
      discountValue,
      totalDue,
      balance,
      rows,
    };

    const blob = new Blob([JSON.stringify(invoiceData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-${invoiceNumber || 'Invoice'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="invoice-page-root">
      <section className="invoice-form-panel">
        <h2>Invoice Form</h2>
        <div className="invoice-form-grid">
          <div>
            <label>Invoice #</label>
            <input type="text" value={invoiceNumber} readOnly style={{ fontSize: '14px', fontWeight: '600' }} />
          </div>
          <div>
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setInvoiceNumber(defaultInvoiceNumber(e.target.value));
              }}
            />
          </div>
          <div>
            <label>Travel Date</label>
            <input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
          </div>
          <div>
            <label>No. of Persons</label>
            <input value={persons} onChange={(e) => { setPersons(e.target.value); syncRowAmounts(); }} />
          </div>
          <div>
            <label>Destination</label>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} />
          </div>

          <div>
            <label>Customer Name</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label>Number</label>
            <input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <label>City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>

          <div className="invoice-form-spanning">
            <label>Invoice Items</label>
            <div className="invoice-items-grid">
              {rows.map((r) => (
                <div key={r.id} className="invoice-item-row">
                  <input placeholder="Particulars" value={r.particulars} onChange={(e) => updateRow(r.id, 'particulars', e.target.value)} />
                  <input placeholder="Pax" value={r.persons || persons} onChange={(e) => { updateRow(r.id, 'persons', e.target.value); }} />
                  <input placeholder="Price" value={r.price} onChange={(e) => { updateRow(r.id, 'price', e.target.value); syncRowAmounts(); }} />
                  <input placeholder="Amount" value={r.amount} onChange={(e) => updateRow(r.id, 'amount', e.target.value)} />
                </div>
              ))}
              <div className="invoice-item-actions">
                <button type="button" onClick={addRow}>Add row</button>
                <button type="button" onClick={() => { if (rows.length > 1) removeRow(rows[rows.length - 1].id); }}>Remove last</button>
              </div>
            </div>
          </div>

          <div>
            <label>Subtotal</label>
            <input value={subtotal.toLocaleString('en-US')} readOnly />
          </div>
          <div>
            <label>Discount %</label>
            <input value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div>
            <label>Total Due</label>
            <input value={totalDue.toLocaleString('en-US')} readOnly />
          </div>
          <div>
            <label>Advance Amount</label>
            <input value={advance} onChange={(e) => setAdvance(e.target.value)} />
          </div>
          <div>
            <label>Balance Due</label>
            <input value={balance.toLocaleString('en-US')} readOnly />
          </div>

          <div className="invoice-form-actions">
            <button type="button" onClick={downloadJPEG}>Download JPEG</button>
            <button type="button" onClick={saveInvoice}>Save Invoice</button>
          </div>
        </div>
      </section>

      <section className="invoice-preview-panel" style={hidePreview ? { position: 'absolute', left: '-10000px', top: 0, opacity: 0, pointerEvents: 'none' } : undefined} aria-hidden={hidePreview ? 'true' : undefined}>
        <h2>Preview</h2>
        <div ref={previewCanvasRef} className="invoice-preview-canvas">
          <div ref={previewDocRef} className="invoice-preview-doc">
            <section className="invoice-header">
              <div className="invoice-header-left">
                <div className="invoice-branding">
                  <div className="invoice-brand-logo">
                    <img
                      src={hodophileLogoPath}
                      alt="Hodophile logo"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = invoiceLogoImage; }}
                    />
                  </div>
                  <div className="invoice-brand-details">
                    <div className="invoice-brand-name">HODOPHILE ADVENTURES</div>
                    <div className="invoice-brand-address">Suite# M2, Mazzanine floor, Plot#111-113-C, Block-2, P.E.C.H.S, Tariq Road, Karachi, Pakistan.</div>
                    <div className="invoice-brand-contact">Contact: 0337-7777460</div>
                    <div className="invoice-brand-license">Govt. License: 5436</div>
                  </div>
                </div>
              </div>

              <div className="invoice-header-right">
                <div className="invoice-label">
                  <img src={invoiceHeadingImage} alt="INVOICE" className="invoice-heading-image" />
                </div>
                <div className="invoice-meta-list">
                  <div className="invoice-meta-row">
                    <span>Invoice #</span>
                    <span>:</span>
                    <strong>{invoiceNumber}</strong>
                  </div>
                  <div className="invoice-meta-row">
                    <span>Date</span>
                    <span>:</span>
                    <strong>{formattedDate}</strong>
                  </div>
                  <div className="invoice-meta-row">
                    <span>Destination</span>
                    <span>:</span>
                    <strong>{destination || '—'}</strong>
                  </div>
                  <div className="invoice-meta-row">
                    <span>Travel Date</span>
                    <span>:</span>
                    <strong>{formattedTravelDate}</strong>
                  </div>
                  <div className="invoice-meta-row">
                    <span>Persons</span>
                    <span>:</span>
                    <strong>{persons || '—'}</strong>
                  </div>
                </div>
              </div>
            </section>

            <div className="invoice-divider" />

            <section className="invoice-client-section">
              <div className="invoice-client-title">Bill To</div>
              <div className="invoice-client-details">
                <div className="invoice-client-name">{customerName || 'Client Name'}</div>
                <div className="invoice-client-phone">{number || 'Phone Number'}</div>
                <div className="invoice-client-city">{city || 'City'}</div>
              </div>
            </section>

            <section className="invoice-table-section">
              <div className="invoice-table-watermark">
                <img src={watermarkImage} alt="Invoice watermark" />
              </div>
              <table className="invoice-items-table">
                <thead>
                  <tr>
                    <th className="desc-col" style={{ fontSize: '14px' }}>Particulars</th>
                    <th className="qty-col text-center" style={{ fontSize: '14px' }}>Number of Person(s)</th>
                    <th className="price-col text-center" style={{ fontSize: '14px' }}>Price</th>
                    <th className="amount-col text-center" style={{ fontSize: '14px' }}>Amount in PKR</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.id}>
                      <td className="desc-col" style={{ fontSize: '14px' }}>{r.particulars || ''}</td>
                      <td className="qty-col text-center" style={{ fontSize: '14px' }}>{r.persons || ''}</td>
                      <td className="price-col text-center" style={{ fontSize: '14px' }}>{r.price ? parseNumber(r.price).toLocaleString('en-US') : ''}</td>
                      <td className="amount-col text-center" style={{ fontSize: '14px' }}>{r.amount ? parseNumber(r.amount).toLocaleString('en-US') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="invoice-summary-section">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{subtotal.toLocaleString('en-US')}</span>
              </div>
              <div className="summary-row">
                <span>Discount</span>
                <span>{discountValue.toLocaleString('en-US')}</span>
              </div>
              <div className="summary-divider" />
              <div className="summary-row summary-total-row">
                <span>Total Due</span>
                <span>{totalDue.toLocaleString('en-US')}</span>
              </div>
              <div className="summary-row">
                <span>Advance Amount</span>
                <span>{parseNumber(advance).toLocaleString('en-US')}</span>
              </div>
              <div className="summary-divider" />
              <div className="summary-row summary-balance-row">
                <span>Balance Due</span>
                <strong>{balance.toLocaleString('en-US')}</strong>
              </div>
            </section>

            <section className="invoice-footer-notes">
              <ul>
                <li>Detailed Itinerary already shared with you via provided WhatsApp number. <strong>ONLY ONE JEEP ride includes in package.</strong></li>
                <li><strong className="invoice-note">NOTE:</strong> ONLY ONE JEEP ride includes in package, other than pay yourself.</li>
                <li>You are requested to read and follow our <strong>TERMS & CONDITIONS</strong> as mentioned in detailed trip itinerary.</li>
                <li>Please cooperate with your Driver cum Guide.</li>
              </ul>
            </section>

            <section className="invoice-footer-logos">
              <div className="footer-logo">
                <img src={govtLogo} alt="Government of Pakistan" />
              </div>
              <div className="footer-logo">
                <img src={nadraLogo} alt="NADRA" />
              </div>
              <div className="footer-logo">
                <img src={patoLogo} alt="PATO" />
              </div>
              <div className="footer-logo">
                <img src={fbrLogo} alt="FBR" />
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InvoicePage;
