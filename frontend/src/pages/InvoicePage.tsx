import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';

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
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ flex: '0 0 380px' }}>
        <h2>Invoice Form</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          <label>Date:</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <label>Travel Date:</label>
          <input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />

          <label>No. of Persons:</label>
          <input value={persons} onChange={(e) => { setPersons(e.target.value); syncRowAmounts(); }} />

          <label>Destination:</label>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} />

          <hr />

          <label>Customer Name:</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />

          <label>Number:</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} />

          <label>City:</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} />

          <hr />

          <label>Particulars / Items</label>
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 80px', gap: 8 }}>
                <input placeholder="Particulars" value={r.particulars} onChange={(e) => updateRow(r.id, 'particulars', e.target.value)} />
                <input placeholder="Pax" value={r.persons || persons} onChange={(e) => { updateRow(r.id, 'persons', e.target.value); }} />
                <input placeholder="Price" value={r.price} onChange={(e) => { updateRow(r.id, 'price', e.target.value); syncRowAmounts(); }} />
                <input placeholder="Amount" value={r.amount} onChange={(e) => updateRow(r.id, 'amount', e.target.value)} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={addRow}>Add row</button>
              <button type="button" onClick={() => { if (rows.length > 1) removeRow(rows[rows.length - 1].id); }}>Remove last</button>
            </div>
          </div>

          <hr />

          <label>Subtotal:</label>
          <input value={subtotal.toLocaleString('en-US')} readOnly />

          <label>Discount %:</label>
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} />

          <label>Total Due:</label>
          <input value={totalDue.toLocaleString('en-US')} readOnly />

          <label>Advance Amount:</label>
          <input value={advance} onChange={(e) => setAdvance(e.target.value)} />

          <label>Balance Due:</label>
          <input value={balance.toLocaleString('en-US')} readOnly />

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={downloadJPEG}>Download JPEG</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <h2>Preview</h2>
        <div ref={previewRef} style={{ width: 800, padding: 24, background: '#fff', color: '#111', boxShadow: '0 0 6px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: '55%' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>HODOPHILE ADVENTURES</div>
              <div style={{ marginTop: 8, lineHeight: 1.3 }}>
                Suite# M2, Mazzanine floor, Plot#111-113-C,<br />
                Block-2, P.E.C.H.S, Tariq Road,<br />
                Karachi, Pakistan.<br />
                Contact# 0337-7777460<br />
                Govt. License# 5436
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 48, color: '#f7c600', fontWeight: 800 }}>INVOICE</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <div>
              <div style={{ marginBottom: 6 }}><strong>Invoice Number</strong></div>
              <div>{invoiceNumber}</div>
            </div>
            <div>
              <div style={{ marginBottom: 6 }}><strong>Date</strong></div>
              <div>{new Date(date).toLocaleDateString()}</div>
            </div>
            <div>
              <div style={{ marginBottom: 6 }}><strong>Destination</strong></div>
              <div>{destination}</div>
            </div>
            <div>
              <div style={{ marginBottom: 6 }}><strong>Travel Date</strong></div>
              <div>{new Date(travelDate).toLocaleDateString()}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ marginBottom: 6 }}><strong>No. of Person(s)</strong></div>
              <div>{persons}</div>
            </div>
          </div>

          <hr style={{ margin: '20px 0', borderColor: '#000' }} />

          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Bill To</div>
            <div style={{ border: '1px solid #ccc', padding: 12, background: '#f5f5f5' }}>
              <div style={{ fontWeight: 700 }}>{customerName || 'Client Name'}</div>
              <div>{city}</div>
              <div>{number}</div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 8, background: '#000', color: '#FCC000' }}>Particulars</th>
                    <th style={{ padding: 8, width: 160, textAlign: 'center', background: '#FCC000', color: '#000' }}>Number of Person(s)</th>
                    <th style={{ padding: 8, width: 120, textAlign: 'right', background: '#000', color: '#FCC000' }}>Price</th>
                    <th style={{ padding: 8, width: 160, textAlign: 'right', background: '#FCC000', color: '#000' }}>Amount In PKR</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #e6e6e6' }}>
                      <td style={{ padding: 12 }}>{r.particulars || destination}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>{r.persons || persons}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>{r.price ? parseNumber(r.price).toLocaleString('en-US') : ''}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>{r.amount ? parseNumber(r.amount).toLocaleString('en-US') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ width: 280 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: 6 }}>Subtotal</td>
                    <td style={{ padding: 6, textAlign: 'right' }}>{subtotal.toLocaleString('en-US')}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 6 }}>Discount</td>
                    <td style={{ padding: 6, textAlign: 'right' }}>{discountValue.toLocaleString('en-US')}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 6 }}>Total Due</td>
                    <td style={{ padding: 6, textAlign: 'right' }}>{totalDue.toLocaleString('en-US')}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 6 }}>Advance Amount</td>
                    <td style={{ padding: 6, textAlign: 'right' }}>{parseNumber(advance).toLocaleString('en-US')}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 6, fontWeight: 700 }}>Balance Due</td>
                    <td style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>{balance.toLocaleString('en-US')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 18, fontSize: 12, color: '#666' }}>
            <div>- Remaining amount handed over to Driver cum Guide at the time of departure is mandatory.</div>
            <div>- Detailed itinerary already shared with you via provided WhatsApp number.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePage;
