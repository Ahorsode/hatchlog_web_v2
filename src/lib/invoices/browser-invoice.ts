const configuredTaxRate = Number(process.env.NEXT_PUBLIC_INVOICE_TAX_RATE ?? '0.15');
const DEFAULT_TAX_RATE = Number.isFinite(configuredTaxRate) && configuredTaxRate >= 0 ? configuredTaxRate : 0.15;

export interface BrowserInvoiceOrder {
  id: string;
  invoiceNumber?: number | null;
  orderDate?: string | Date;
  paidAt?: string | Date | null;
  status: string;
  totalAmount: number;
  subtotalAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  customer?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

function money(value: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS'
  }).format(Number(value || 0));
}

function compactMoney(value: number) {
  return `GHS ${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function invoiceDate(order: BrowserInvoiceOrder) {
  const value = order.orderDate || order.paidAt || new Date();
  return new Date(value).toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatInvoiceNumber(order: BrowserInvoiceOrder) {
  const year = new Date(order.orderDate || new Date()).getFullYear();
  const invoiceNumber = order.invoiceNumber != null
    ? String(order.invoiceNumber).padStart(6, '0')
    : order.id.slice(-6).toUpperCase();

  return `HL-${year}-${invoiceNumber}`;
}

function fileSafe(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'WalkIn';
}

async function loadLogoDataUrl() {
  try {
    const response = await fetch('/logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadSalesInvoicePdf(order: BrowserInvoiceOrder) {
  // Load jsPDF only when the user requests a browser-side invoice download.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const invoiceNumber = formatInvoiceNumber(order);
  const logoDataUrl = await loadLogoDataUrl();
  const isPaid = ['PAID', 'COMPLETED'].includes(String(order.status || '').toUpperCase());

  const grossTotal = Number(order.totalAmount || 0);
  const storedTax = Number(order.taxAmount || 0);
  const taxAmount = storedTax > 0 ? storedTax : grossTotal - (grossTotal / (1 + DEFAULT_TAX_RATE));
  const taxableBase = grossTotal - taxAmount;
  const subtotal = Number(order.subtotalAmount || order.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0));
  const discount = Number(order.discountAmount || 0);

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 122, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 48, 34, 54, 54);
  } else {
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(48, 34, 54, 54, 6, 6, 'F');
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('HatchLog', 116, 54);
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Farm-Gate Sales Invoice', 116, 74);

  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.text(`Invoice ${invoiceNumber}`, pageWidth - 48, 48, { align: 'right' });
  doc.text(`Date ${invoiceDate(order)}`, pageWidth - 48, 66, { align: 'right' });
  doc.text(`Status ${String(order.status || 'PENDING').toUpperCase()}`, pageWidth - 48, 84, { align: 'right' });

  if (isPaid) {
    doc.setTextColor(209, 250, 229);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(96);
    doc.text('PAID', pageWidth / 2, 360, { align: 'center', angle: -24 });
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Bill To', 48, 166);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(order.customer?.name || 'Walk-in Customer', 48, 185);
  if (order.customer?.phone) doc.text(order.customer.phone, 48, 201);
  if (order.customer?.address) doc.text(order.customer.address, 48, 217);

  doc.setFillColor(240, 253, 244);
  doc.roundedRect(pageWidth - 216, 152, 168, 72, 6, 6, 'F');
  doc.setTextColor(5, 150, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL RECEIPT', pageWidth - 132, 176, { align: 'center' });
  doc.setFontSize(18);
  doc.text(compactMoney(grossTotal), pageWidth - 132, 200, { align: 'center' });

  const tableTop = 266;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(48, tableTop - 24, pageWidth - 96, 30, 5, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Description', 62, tableTop - 5);
  doc.text('Qty', 326, tableTop - 5, { align: 'right' });
  doc.text('Unit', 424, tableTop - 5, { align: 'right' });
  doc.text('Total', pageWidth - 62, tableTop - 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  let y = tableTop + 18;
  order.items.forEach((item, index) => {
    if (y > 690) {
      doc.addPage();
      y = 72;
    }

    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(48, y - 14, pageWidth - 96, 28, 'F');
    }

    doc.text(item.description || 'Sale Item', 62, y, { maxWidth: 230 });
    doc.text(String(item.quantity || 0), 326, y, { align: 'right' });
    doc.text(money(Number(item.unitPrice || 0)), 424, y, { align: 'right' });
    doc.text(money(Number(item.totalPrice || 0)), pageWidth - 62, y, { align: 'right' });
    y += 30;
  });

  const totalsTop = Math.max(y + 24, 520);
  const labelX = pageWidth - 230;
  const valueX = pageWidth - 62;
  const row = (label: string, value: string, offset: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(bold ? 15 : 71, bold ? 23 : 85, bold ? 42 : 105);
    doc.text(label, labelX, totalsTop + offset);
    doc.text(value, valueX, totalsTop + offset, { align: 'right' });
  };

  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, totalsTop - 18, valueX, totalsTop - 18);
  row('Line Subtotal', money(subtotal), 0);
  row('Discount', `-${money(discount)}`, 22);
  row(`Tax (${Math.round(DEFAULT_TAX_RATE * 100)}% incl.)`, money(taxAmount), 44);
  row('Taxable Base', money(taxableBase), 66);
  row('Amount Paid', money(grossTotal), 94, true);

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 776, pageWidth, 66, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Generated by HatchLog. Keep this invoice as the official farm-gate transaction receipt.', pageWidth / 2, 812, { align: 'center' });

  const filename = `${invoiceNumber}_${fileSafe(order.customer?.name || 'WalkIn')}.pdf`;
  doc.save(filename);
  return filename;
}

export function normalizeWhatsAppPhone(phone?: string | null) {
  if (!phone) return '';
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = `233${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppInvoiceUrl(order: BrowserInvoiceOrder) {
  const invoiceNumber = formatInvoiceNumber(order);
  const message = [
    `HatchLog invoice ${invoiceNumber}`,
    `Customer: ${order.customer?.name || 'Walk-in Customer'}`,
    `Amount: ${compactMoney(Number(order.totalAmount || 0))}`,
    `Status: ${String(order.status || 'PENDING').toUpperCase()}`,
    'The PDF invoice has been downloaded on this computer and is ready to attach.'
  ].join('\n');

  const phone = normalizeWhatsAppPhone(order.customer?.phone);
  const phoneParam = phone ? `phone=${phone}&` : '';

  return `https://web.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(message)}`;
}
