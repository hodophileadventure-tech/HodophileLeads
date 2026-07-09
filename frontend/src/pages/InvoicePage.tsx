import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
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
            <header className="invoice-preview-header">
              <div className="invoice-company-info">
                <div className="invoice-company-name">HODOPHILE ADVENTURES</div>
                <div className="invoice-company-address">
                  Suite# M2, Mazzanine floor, Plot#111-113-C,<br />
                  Block-2, P.E.C.H.S, Tariq Road,<br />
                  Karachi, Pakistan.<br />
                  Contact# 0337-7777460<br />
                  Govt. License# 5436
                </div>
              </div>
              <div className="invoice-label-block">
                <div className="invoice-label">INVOICE</div>
              </div>
            </header>

            <div className="invoice-meta-grid">
              <div>
                <div className="meta-label">Invoice Number</div>
                <div className="meta-value">{invoiceNumber}</div>
              </div>
              <div>
                <div className="meta-label">Date</div>
                <div className="meta-value">{new Date(date).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="meta-label">Destination</div>
                <div className="meta-value">{destination}</div>
              </div>
              <div>
                <div className="meta-label">Travel Date</div>
                <div className="meta-value">{new Date(travelDate).toLocaleDateString()}</div>
              </div>
              <div className="meta-full">
                <div className="meta-label">No. of Person(s)</div>
                <div className="meta-value">{persons}</div>
              </div>
            </div>

            <div className="invoice-bill-to-card">
              <div className="bill-to-title">Bill To</div>
              <div className="bill-to-content">
                <div className="bill-to-name">{customerName || 'Client Name'}</div>
                <div>{city}</div>
                <div>{number}</div>
              </div>
            </div>

            <div className="invoice-items-wrapper">
              <table className="invoice-items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Package Price</th>
                    <th>No. of Person(s)</th>
                    <th>Amount In PKR</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.particulars || destination}</td>
                      <td className="text-right">{r.price ? parseNumber(r.price).toLocaleString('en-US') : ''}</td>
                      <td className="text-center">{r.persons || persons}</td>
                      <td className="text-right">{r.amount ? parseNumber(r.amount).toLocaleString('en-US') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="invoice-summary-card">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>{subtotal.toLocaleString('en-US')}</strong>
                </div>
                <div className="summary-row">
                  <span>Discount</span>
                  <strong>{discountValue.toLocaleString('en-US')}</strong>
                </div>
                <div className="summary-row">
                  <span>Total Due</span>
                  <strong>{totalDue.toLocaleString('en-US')}</strong>
                </div>
                <div className="summary-row">
                  <span>Advance Amount</span>
                  <strong>{parseNumber(advance).toLocaleString('en-US')}</strong>
                </div>
                <div className="summary-row total-row">
                  <span>Balance Due</span>
                  <strong>{balance.toLocaleString('en-US')}</strong>
                </div>
              </div>
            </div>

            <div className="invoice-preview-footer">
              <div>Remaining amount handed over to Driver cum Guide at the time of departure is mandatory.</div>
              <div>Detailed itinerary already shared with you via provided WhatsApp number.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InvoicePage;
