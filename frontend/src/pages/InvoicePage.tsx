import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import logoImage from '../assets/hodophile-logo.png';
import watermarkImage from '../assets/invoice-watermark.jpg';
import './InvoicePage.css';

type Row = { id: string; particulars: string; persons: string; price: string; amount: string };

export const InvoicePage: React.FC = () => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [travelDate, setTravelDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [persons, setPersons] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [invoiceNumber] = useState<string>('2606011237');

  const [customerName, setCustomerName] = useState<string>('');
  const [number, setNumber] = useState<string>('');
  const [city, setCity] = useState<string>('');

  const [rows, setRows] = useState<Row[]>([
    { id: crypto.randomUUID(), particulars: '', persons: '', price: '', amount: '' },
  ]);

  const [discount, setDiscount] = useState<string>('');
  const [advance, setAdvance] = useState<string>('');

  const previewRef = useRef<HTMLDivElement | null>(null);

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
    if (!previewRef.current) return;
    try {
      const canvas = await html2canvas(previewRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
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

  return (
    <div className="invoice-page-root">
      <section className="invoice-form-panel">
        <h2>Invoice Form</h2>
        <div className="invoice-form-grid">
          <div>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
          </div>
        </div>
      </section>

      <section className="invoice-preview-panel">
        <h2>Preview</h2>
        <div ref={previewRef} className="invoice-preview-canvas">
          <div className="invoice-preview-doc">
            <section className="invoice-header">
              <div className="invoice-header-left">
                <div className="invoice-branding">
                  <div className="invoice-brand-logo">
                    <img src={logoImage} alt="Hodophile Adventures" />
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
                <div className="invoice-label">INVOICE</div>
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
                <div className="invoice-client-line">{customerName || 'Client Name'}</div>
                <div className="invoice-client-line">{number || 'Phone Number'}</div>
                <div className="invoice-client-line">{city || 'City'}</div>
              </div>
            </section>

            <section className="invoice-table-section">
              <div className="invoice-table-watermark">
                <img src={watermarkImage} alt="Invoice watermark" />
              </div>
              <table className="invoice-items-table">
                <thead>
                  <tr>
                    <th className="desc-col">Description</th>
                    <th className="qty-col">Persons</th>
                    <th className="price-col">Package Price</th>
                    <th className="amount-col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.particulars || destination || '—'}</td>
                      <td className="text-center">{r.persons || persons || ''}</td>
                      <td className="text-right">{r.price ? parseNumber(r.price).toLocaleString('en-US') : ''}</td>
                      <td className="text-right">{r.amount ? parseNumber(r.amount).toLocaleString('en-US') : ''}</td>
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
              <div className="summary-row summary-total">
                <span>Total Due</span>
                <span>{totalDue.toLocaleString('en-US')}</span>
              </div>
              <div className="summary-row">
                <span>Advance</span>
                <span>{parseNumber(advance).toLocaleString('en-US')}</span>
              </div>
              <div className="summary-row summary-balance">
                <span>Balance Due</span>
                <strong>{balance.toLocaleString('en-US')}</strong>
              </div>
            </section>

            <section className="invoice-footer-notes">
              <p>Remaining amount handed over to Driver cum Guide at departure is mandatory.</p>
              <p>Detailed itinerary has already been shared on WhatsApp.</p>
              <p>Terms & Conditions apply. Driver details will be shared one day before departure.</p>
            </section>

            <section className="invoice-footer-logos">
              <div className="footer-logo">Govt</div>
              <div className="footer-logo">Certification</div>
              <div className="footer-logo">Partner</div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InvoicePage;
