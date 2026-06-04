import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import './QuoteInvoicePage.css';

type DocItem = {
  id: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
};

type QuoteForm = {
  companyName: string;
  companyLicense: string;
  companyAddress: string;
  companyContact: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  quoteNumber: string;
  quoteDate: string;
  quoteEmail: string;
  quoteDiscount: number;
  quoteTax: number;
  quoteAccommodation: string;
  quoteTransportation: string;
  quoteDeparture: string;
  quoteValidity: number;
  quotePackageIncluded: string;
  quoteNotes: string;
};

type InvoiceForm = {
  companyName: string;
  companyLicense: string;
  companyAddress: string;
  companyContact: string;
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceEmail: string;
  invoiceDestination: string;
  invoiceTravelDate: string;
  invoicePersonCount: number;
  invoiceDiscount: number;
  invoiceTax: number;
  invoiceTerms: string;
};

type SavedDocument = {
  id: string;
  type: 'quotation' | 'invoice';
  documentNumber: string;
  companyName: string;
  companyLicense: string;
  companyAddress: string;
  companyContact: string;
  customerName: string;
  phone: string;
  email: string;
  date: string;
  createdDate: string;
  items: DocItem[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  tax: number;
  taxAmount: number;
  total: number;
  details: string;
  notes: string;
};

const quoteDefaults: QuoteForm = {
  companyName: 'Hodophile Adventures',
  companyLicense: '5436',
  companyAddress:
    'Suite#M2, Mazzanine floor, Bin Suleman Tower, Plot #111-113C, Block-2, P.E.C.H.S, Tariq Road, Karachi, Pakistan.',
  companyContact: '0337-7774460',
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  quoteNumber: '',
  quoteDate: new Date().toISOString().split('T')[0],
  quoteEmail: '',
  quoteDiscount: 0,
  quoteTax: 0,
  quoteAccommodation: '',
  quoteTransportation: '',
  quoteDeparture: '',
  quoteValidity: 7,
  quotePackageIncluded:
    'Transport\nAccommodation\nBreakfast & Dinner\nJeep Ride for Basho/Deosai and Jheel Saif-ul-Malook',
  quoteNotes: '',
};

const invoiceDefaults: InvoiceForm = {
  companyName: 'Hodophile Adventures',
  companyLicense: '5436',
  companyAddress:
    'Suite#M2, Mazzanine floor, Bin Suleman Tower, Plot #111-113C, Block-2, P.E.C.H.S, Tariq Road, Karachi, Pakistan.',
  companyContact: '0337-7774460',
  customerName: '',
  customerPhone: '',
  invoiceNumber: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  invoiceEmail: '',
  invoiceDestination: '',
  invoiceTravelDate: new Date().toISOString().split('T')[0],
  invoicePersonCount: 1,
  invoiceDiscount: 0,
  invoiceTax: 0,
  invoiceTerms: '',
};

const defaultItems = (): DocItem[] => [
  {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    price: 0,
    total: 0,
  },
];

const STORAGE_KEY = 'hodophile-quote-invoice-documents';
const QUOTE_COUNT_KEY = 'hodophile-quote-count';
const INVOICE_COUNT_KEY = 'hodophile-invoice-count';

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const formatFilename = (name: string, date: Date, type: 'quotation' | 'invoice') => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = String(date.getFullYear()).slice(-2);
  return `${type === 'quotation' ? 'Quotation' : 'Invoice'} for ${name} (${day}${month}'${year})`;
};

const loadSavedDocuments = (): SavedDocument[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedDocument[];
  } catch {
    return [];
  }
};

const saveDocumentsToStorage = (documents: SavedDocument[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
};

const getNextDocumentNumber = (type: 'quote' | 'invoice'): string => {
  const key = type === 'quote' ? QUOTE_COUNT_KEY : INVOICE_COUNT_KEY;
  const current = Number(window.localStorage.getItem(key) || 0) + 1;
  window.localStorage.setItem(key, String(current));
  return String(current).padStart(9, '0');
};

function waitForImages(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
  if (!imgs.length) return Promise.resolve();

  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
}

export const QuoteInvoicePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'quote' | 'invoice' | 'ledger'>('quote');
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(quoteDefaults);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(invoiceDefaults);
  const [quoteItems, setQuoteItems] = useState<DocItem[]>(defaultItems());
  const [invoiceItems, setInvoiceItems] = useState<DocItem[]>(defaultItems());
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<SavedDocument | null>(null);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchDocNumber, setSearchDocNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDocuments(loadSavedDocuments());
  }, []);

  useEffect(() => {
    saveDocumentsToStorage(documents);
  }, [documents]);

  const quoteSubtotal = useMemo(
    () => quoteItems.reduce((sum, item) => sum + item.total, 0),
    [quoteItems],
  );

  const invoiceSubtotal = useMemo(
    () => invoiceItems.reduce((sum, item) => sum + item.total, 0),
    [invoiceItems],
  );

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesPhone = searchPhone ? doc.phone.includes(searchPhone) : true;
      const matchesDoc = searchDocNumber ? doc.documentNumber.includes(searchDocNumber) : true;
      return matchesPhone && matchesDoc;
    });
  }, [documents, searchPhone, searchDocNumber]);

  const updateItem = (
    id: string,
    changes: Partial<Pick<DocItem, 'description' | 'quantity' | 'price'>>,
    type: 'quote' | 'invoice',
  ) => {
    const setter = type === 'quote' ? setQuoteItems : setInvoiceItems;
    const items = type === 'quote' ? quoteItems : invoiceItems;

    setter(
      items.map((item) =>
        item.id !== id
          ? item
          : {
              ...item,
              quantity: changes.quantity ?? item.quantity,
              price: changes.price ?? item.price,
              description: changes.description ?? item.description,
              total:
                (changes.quantity ?? item.quantity) * (changes.price ?? item.price),
            },
      ),
    );
  };

  const addRow = (type: 'quote' | 'invoice') => {
    const setter = type === 'quote' ? setQuoteItems : setInvoiceItems;
    const items = type === 'quote' ? quoteItems : invoiceItems;
    setter([
      ...items,
      { id: crypto.randomUUID(), description: '', quantity: 1, price: 0, total: 0 },
    ]);
  };

  const removeRow = (id: string, type: 'quote' | 'invoice') => {
    const setter = type === 'quote' ? setQuoteItems : setInvoiceItems;
    const items = type === 'quote' ? quoteItems : invoiceItems;
    if (items.length === 1) return;
    setter(items.filter((item) => item.id !== id));
  };

  const getQuoteDocument = () => {
    const dateValue = new Date(quoteForm.quoteDate || new Date().toISOString());
    const discountAmount = quoteSubtotal * (quoteForm.quoteDiscount / 100);
    const taxableAmount = quoteSubtotal - discountAmount;
    const taxAmount = taxableAmount * (quoteForm.quoteTax / 100);
    const total = taxableAmount + taxAmount;
    const quoteNumber = quoteForm.quoteNumber || getNextDocumentNumber('quote');

    return {
      id: crypto.randomUUID(),
      type: 'quotation' as const,
      documentNumber: quoteNumber,
      companyName: quoteForm.companyName,
      companyLicense: quoteForm.companyLicense,
      companyAddress: quoteForm.companyAddress,
      companyContact: quoteForm.companyContact,
      customerName: quoteForm.customerName,
      phone: quoteForm.customerPhone,
      email: quoteForm.quoteEmail,
      date: dateValue.toISOString(),
      createdDate: new Date().toISOString(),
      items: quoteItems,
      subtotal: quoteSubtotal,
      discount: quoteForm.quoteDiscount,
      discountAmount,
      tax: quoteForm.quoteTax,
      taxAmount,
      total,
      details: [quoteForm.quoteAccommodation, quoteForm.quoteTransportation, quoteForm.quoteDeparture]
        .filter(Boolean)
        .join(' | '),
      notes: quoteForm.quoteNotes,
    };
  };

  const getInvoiceDocument = () => {
    const dateValue = new Date(invoiceForm.invoiceDate || new Date().toISOString());
    const discountAmount = invoiceSubtotal * (invoiceForm.invoiceDiscount / 100);
    const taxableAmount = invoiceSubtotal - discountAmount;
    const taxAmount = taxableAmount * (invoiceForm.invoiceTax / 100);
    const total = taxableAmount + taxAmount;
    const invoiceNumber = invoiceForm.invoiceNumber || getNextDocumentNumber('invoice');

    return {
      id: crypto.randomUUID(),
      type: 'invoice' as const,
      documentNumber: invoiceNumber,
      companyName: invoiceForm.companyName,
      companyLicense: invoiceForm.companyLicense,
      companyAddress: invoiceForm.companyAddress,
      companyContact: invoiceForm.companyContact,
      customerName: invoiceForm.customerName,
      phone: invoiceForm.customerPhone,
      email: invoiceForm.invoiceEmail,
      date: dateValue.toISOString(),
      createdDate: new Date().toISOString(),
      items: invoiceItems,
      subtotal: invoiceSubtotal,
      discount: invoiceForm.invoiceDiscount,
      discountAmount,
      tax: invoiceForm.invoiceTax,
      taxAmount,
      total,
      details: `${invoiceForm.invoiceDestination} • ${invoiceForm.invoiceTravelDate}`,
      notes: invoiceForm.invoiceTerms,
    };
  };

  const handleQuoteSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!quoteForm.customerName.trim()) {
      setErrorMessage('Customer name is required for quotation.');
      return;
    }
    const document = getQuoteDocument();
    setDocuments((current) => [document, ...current]);
    setPreviewData(document);
    setPreviewOpen(true);
    setErrorMessage('');
  };

  const handleInvoiceSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!invoiceForm.customerName.trim()) {
      setErrorMessage('Customer name is required for invoice.');
      return;
    }
    const document = getInvoiceDocument();
    setDocuments((current) => [document, ...current]);
    setPreviewData(document);
    setPreviewOpen(true);
    setErrorMessage('');
  };

  const downloadPreview = async () => {
    if (!previewRef.current || !previewData) return;
    await waitForImages(previewRef.current);
    const canvas = await html2canvas(previewRef.current, {
      scale: window.devicePixelRatio || 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      allowTaint: false,
      imageTimeout: 15000,
    });
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blobData) => {
        if (blobData) resolve(blobData);
        else reject(new Error('Failed to create JPEG blob'));
      }, 'image/jpeg', 0.95);
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formatFilename(previewData.customerName, new Date(previewData.date), previewData.type)}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearSearch = () => {
    setSearchPhone('');
    setSearchDocNumber('');
  };

  const deleteDocument = (id: string) => {
    if (!confirm('Delete this document?')) return;
    setDocuments((current) => current.filter((doc) => doc.id !== id));
  };

  const docStats = useMemo(() => {
    const quotes = documents.filter((doc) => doc.type === 'quotation').length;
    const invoices = documents.filter((doc) => doc.type === 'invoice').length;
    const revenue = documents.reduce((sum, doc) => sum + doc.total, 0);
    return { quotes, invoices, revenue };
  }, [documents]);

  return (
    <div className="quote-invoice-root space-y-6">
      <div className="flex flex-wrap gap-3">
        {['quote', 'invoice', 'ledger'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`btn-primary ${activeTab === tab ? 'opacity-100' : 'opacity-60'}`}
            onClick={() => setActiveTab(tab as 'quote' | 'invoice' | 'ledger')}
          >
            {tab === 'quote' ? 'Quotation' : tab === 'invoice' ? 'Invoice' : 'Ledger'}
          </button>
        ))}
      </div>

      {activeTab === 'quote' && (
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <form className="card space-y-6" onSubmit={handleQuoteSubmit}>
            <div>
              <h2 className="text-2xl font-semibold mb-3">Create Quotation</h2>
              <p className="text-sm text-slate-600">Generate a quotation with automatic pricing, discount, tax, and preview.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="font-medium">Company Name</label>
                <input
                  className="input-field"
                  value={quoteForm.companyName}
                  onChange={(e) => setQuoteForm({ ...quoteForm, companyName: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Government License #</label>
                <input
                  className="input-field"
                  value={quoteForm.companyLicense}
                  onChange={(e) => setQuoteForm({ ...quoteForm, companyLicense: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="font-medium">Company Address</label>
                <input
                  className="input-field"
                  value={quoteForm.companyAddress}
                  onChange={(e) => setQuoteForm({ ...quoteForm, companyAddress: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="font-medium">Company Contact</label>
                <input
                  className="input-field"
                  value={quoteForm.companyContact}
                  onChange={(e) => setQuoteForm({ ...quoteForm, companyContact: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="font-medium">Customer Name *</label>
                <input
                  className="input-field"
                  required
                  value={quoteForm.customerName}
                  onChange={(e) => setQuoteForm({ ...quoteForm, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Quote Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={quoteForm.quoteDate}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoteDate: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Quote Number</label>
                <input
                  className="input-field"
                  value={quoteForm.quoteNumber}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoteNumber: e.target.value })}
                  placeholder="Auto-generated"
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Customer Phone</label>
                <input
                  className="input-field"
                  value={quoteForm.customerPhone}
                  onChange={(e) => setQuoteForm({ ...quoteForm, customerPhone: e.target.value })}
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <label className="font-medium">Customer Address</label>
                <input
                  className="input-field"
                  value={quoteForm.customerAddress}
                  onChange={(e) => setQuoteForm({ ...quoteForm, customerAddress: e.target.value })}
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <label className="font-medium">Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={quoteForm.quoteEmail}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoteEmail: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Items</h3>
                <button type="button" className="btn-secondary" onClick={() => addRow('quote')}>
                  + Add Item
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Price</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="p-3">
                          <textarea
                            className="input-field resize-none h-20"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, { description: e.target.value }, 'quote')}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            className="input-field"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) }, 'quote')}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            className="input-field"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, { price: Number(e.target.value) }, 'quote')}
                          />
                        </td>
                        <td className="p-3 font-semibold text-right">{item.total.toFixed(2)}</td>
                        <td className="p-3">
                          <button type="button" className="btn-secondary" onClick={() => removeRow(item.id, 'quote')}>
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="font-medium">Discount (%)</label>
                <input
                  type="number"
                  className="input-field"
                  value={quoteForm.quoteDiscount}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoteDiscount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Tax (%)</label>
                <input
                  type="number"
                  className="input-field"
                  value={quoteForm.quoteTax}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoteTax: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="font-medium">Accommodation Type</label>
                <input
                  className="input-field"
                  value={quoteForm.quoteAccommodation}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoteAccommodation: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Transportation Type</label>
                <input
                  className="input-field"
                  value={quoteForm.quoteTransportation}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoteTransportation: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Departure Location</label>
                <input
                  className="input-field"
                  value={quoteForm.quoteDeparture}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoteDeparture: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Validity (Days)</label>
                <input
                  type="number"
                  className="input-field"
                  min={1}
                  value={quoteForm.quoteValidity}
                  onChange={(e) => setQuoteForm({ ...quoteForm, quoteValidity: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="font-medium">Package Included</label>
              <textarea
                className="input-field resize-none h-30"
                rows={5}
                value={quoteForm.quotePackageIncluded}
                onChange={(e) => setQuoteForm({ ...quoteForm, quotePackageIncluded: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <label className="font-medium">Additional Notes</label>
              <textarea
                className="input-field resize-none h-24"
                value={quoteForm.quoteNotes}
                onChange={(e) => setQuoteForm({ ...quoteForm, quoteNotes: e.target.value })}
              />
            </div>

            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

            <button type="submit" className="btn-primary w-full">
              Preview & Download
            </button>
          </form>

          <div className="space-y-6">
            <section className="card">
              <h3 className="text-xl font-semibold mb-3">Quote Summary</h3>
              <dl className="grid gap-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{quoteSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount</span>
                  <span>{((quoteSubtotal * quoteForm.quoteDiscount) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>{(((quoteSubtotal - (quoteSubtotal * quoteForm.quoteDiscount) / 100) * quoteForm.quoteTax) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 font-semibold">
                  <span>Total</span>
                  <span>{(quoteSubtotal - (quoteSubtotal * quoteForm.quoteDiscount) / 100 + (((quoteSubtotal - (quoteSubtotal * quoteForm.quoteDiscount) / 100) * quoteForm.quoteTax) / 100)).toFixed(2)}</span>
                </div>
              </dl>
            </section>

            <section className="card">
              <h3 className="text-xl font-semibold mb-3">How it works</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>Fill customer details and items.</li>
                <li>Click Preview & Download.</li>
                <li>Then use the JPEG download button in the preview.</li>
              </ul>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'invoice' && (
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <form className="card space-y-6" onSubmit={handleInvoiceSubmit}>
            <div>
              <h2 className="text-2xl font-semibold mb-3">Create Invoice</h2>
              <p className="text-sm text-slate-600">Build invoices with payment terms, travel details, and itemized totals.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="font-medium">Company Name</label>
                <input
                  className="input-field"
                  value={invoiceForm.companyName}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, companyName: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Government License #</label>
                <input
                  className="input-field"
                  value={invoiceForm.companyLicense}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, companyLicense: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="font-medium">Company Address</label>
                <input
                  className="input-field"
                  value={invoiceForm.companyAddress}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, companyAddress: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="font-medium">Company Contact</label>
                <input
                  className="input-field"
                  value={invoiceForm.companyContact}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, companyContact: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="font-medium">Customer Name *</label>
                <input
                  className="input-field"
                  required
                  value={invoiceForm.customerName}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Invoice Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={invoiceForm.invoiceDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Destination/Details</label>
                <input
                  className="input-field"
                  value={invoiceForm.invoiceDestination}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDestination: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Travel Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={invoiceForm.invoiceTravelDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceTravelDate: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Invoice Number</label>
                <input
                  className="input-field"
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  placeholder="Auto-generated"
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">No. of Persons</label>
                <input
                  type="number"
                  className="input-field"
                  min={1}
                  value={invoiceForm.invoicePersonCount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoicePersonCount: Number(e.target.value) })}
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="font-medium">Phone</label>
                <input
                  className="input-field"
                  value={invoiceForm.customerPhone}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customerPhone: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <label className="font-medium">Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={invoiceForm.invoiceEmail}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceEmail: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Items</h3>
                <button type="button" className="btn-secondary" onClick={() => addRow('invoice')}>
                  + Add Item
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Price</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="p-3">
                          <textarea
                            className="input-field resize-none h-20"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, { description: e.target.value }, 'invoice')}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            className="input-field"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) }, 'invoice')}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            className="input-field"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, { price: Number(e.target.value) }, 'invoice')}
                          />
                        </td>
                        <td className="p-3 font-semibold text-right">{item.total.toFixed(2)}</td>
                        <td className="p-3">
                          <button type="button" className="btn-secondary" onClick={() => removeRow(item.id, 'invoice')}>
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="font-medium">Discount (%)</label>
                <input
                  type="number"
                  className="input-field"
                  value={invoiceForm.invoiceDiscount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDiscount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-3">
                <label className="font-medium">Tax (%)</label>
                <input
                  type="number"
                  className="input-field"
                  value={invoiceForm.invoiceTax}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceTax: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="font-medium">Payment Terms</label>
              <textarea
                className="input-field resize-none h-24"
                value={invoiceForm.invoiceTerms}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceTerms: e.target.value })}
              />
            </div>

            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

            <button type="submit" className="btn-primary w-full">
              Preview & Download
            </button>
          </form>

          <div className="space-y-6">
            <section className="card">
              <h3 className="text-xl font-semibold mb-3">Invoice Summary</h3>
              <dl className="grid gap-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{invoiceSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount</span>
                  <span>{((invoiceSubtotal * invoiceForm.invoiceDiscount) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>{(((invoiceSubtotal - (invoiceSubtotal * invoiceForm.invoiceDiscount) / 100) * invoiceForm.invoiceTax) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 font-semibold">
                  <span>Total Due</span>
                  <span>{(invoiceSubtotal - (invoiceSubtotal * invoiceForm.invoiceDiscount) / 100 + (((invoiceSubtotal - (invoiceSubtotal * invoiceForm.invoiceDiscount) / 100) * invoiceForm.invoiceTax) / 100)).toFixed(2)}</span>
                </div>
              </dl>
            </section>
            <section className="card">
              <h3 className="text-xl font-semibold mb-3">Need help?</h3>
              <p className="text-sm text-slate-600">The invoice preview uses the same layout and images used in downloads. Save as JPEG by clicking the download button.</p>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="grid gap-6 md:grid-cols-[0.9fr_0.7fr]">
          <section className="card space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-3">Ledger & History</h2>
              <p className="text-sm text-slate-600">Search your saved quotes and invoices, and export or delete records.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="input-field"
                placeholder="Search by phone"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
              />
              <input
                className="input-field"
                placeholder="Search by document number"
                value={searchDocNumber}
                onChange={(e) => setSearchDocNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-secondary" onClick={clearSearch}>
                Clear
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Doc #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No documents found.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold">{doc.type === 'quotation' ? 'Quotation' : 'Invoice'}</td>
                        <td className="px-4 py-3">{doc.documentNumber}</td>
                        <td className="px-4 py-3">{doc.customerName}</td>
                        <td className="px-4 py-3">{doc.phone || 'N/A'}</td>
                        <td className="px-4 py-3">{formatDisplayDate(new Date(doc.createdDate))}</td>
                        <td className="px-4 py-3 text-right font-semibold">{doc.total.toFixed(2)}</td>
                        <td className="px-4 py-3 space-x-2">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setPreviewData(doc);
                              setPreviewOpen(true);
                            }}
                          >
                            View
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => deleteDocument(doc.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card space-y-5">
            <div>
              <h3 className="text-xl font-semibold mb-3">Ledger Stats</h3>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Total Quotations</p>
                <p className="text-3xl font-semibold">{docStats.quotes}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Total Invoices</p>
                <p className="text-3xl font-semibold">{docStats.invoices}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Total Revenue</p>
                <p className="text-3xl font-semibold">{docStats.revenue.toFixed(2)}</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {previewOpen && previewData && (
        <div className="quote-invoice-modal">
          <div className="quote-invoice-modal-backdrop" onClick={() => setPreviewOpen(false)} />
          <div className="quote-invoice-modal-panel">
            <div className="flex items-center justify-between gap-4 p-4 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-semibold">Preview {previewData.type === 'quotation' ? 'Quotation' : 'Invoice'}</h3>
                <p className="text-sm text-slate-600">This preview will match the downloaded JPEG layout.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>

            <div className="quote-invoice-modal-content" ref={previewRef}>
              <div className="preview-document">
                <div className="preview-header">
                  <div className="preview-header-brand">
                    <img src="/quote-invoice/logo.png" alt="Logo" className="preview-logo" />
                    <div>
                      <h1 className="preview-company">{previewData.companyName}</h1>
                      <p className="preview-company-meta">Government Licensed # {previewData.companyLicense}</p>
                    </div>
                  </div>
                  <div className="preview-title">
                    <div className="preview-tag">{previewData.type === 'quotation' ? 'QUOTATION' : 'INVOICE'}</div>
                    <div className="preview-details">
                      <div><strong>{previewData.type === 'quotation' ? 'Document #' : 'Invoice #'}</strong> {previewData.documentNumber}</div>
                      <div><strong>Date:</strong> {formatDisplayDate(new Date(previewData.date))}</div>
                      {previewData.type === 'invoice' && <div><strong>Destination:</strong> {previewData.details}</div>}
                    </div>
                  </div>
                </div>

                <div className="preview-meta-grid">
                  <div className="preview-box">
                    <h4 className="preview-box-title">Customer</h4>
                    <p>{previewData.customerName}</p>
                    <p>{previewData.phone}</p>
                    <p>{previewData.email}</p>
                  </div>
                  <div className="preview-box">
                    <h4 className="preview-box-title">Company</h4>
                    <p>{previewData.companyName}</p>
                    <p>{previewData.companyContact}</p>
                    <p>{previewData.companyAddress}</p>
                  </div>
                </div>

                <div className="preview-table-wrap">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.description}</td>
                          <td>{item.quantity}</td>
                          <td>{item.price.toFixed(2)}</td>
                          <td>{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="preview-summary-grid">
                  <div className="preview-summary-notes">
                    <h4 className="preview-box-title">Notes</h4>
                    <p>{previewData.notes || 'No extra notes provided.'}</p>
                  </div>
                  <div className="preview-summary-total">
                    <div className="preview-summary-row">
                      <span>Subtotal</span>
                      <span>{previewData.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="preview-summary-row">
                      <span>Discount</span>
                      <span>{previewData.discountAmount.toFixed(2)}</span>
                    </div>
                    <div className="preview-summary-row">
                      <span>Tax</span>
                      <span>{previewData.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="preview-summary-row preview-summary-total-row">
                      <span>Total</span>
                      <span>{previewData.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 p-4 border-t border-slate-200">
              <button type="button" className="btn-primary" onClick={downloadPreview}>
                📥 Download as JPEG
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPreviewOpen(false)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
