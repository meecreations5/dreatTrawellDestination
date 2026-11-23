/* Pure invoice calculations shared by UI, persistence and tests. No exchange-rate guessing. */
export const INVOICE_CURRENCIES = ["INR", "AED", "SGD", "THB", "MYR", "IDR", "VND", "USD", "EUR", "LKR", "TRY", "MVR"];
export const INVOICE_TAX_MODES = ["none", "cgst_sgst", "igst"];
export const INVOICE_TYPES = { OUTGOING: "outgoing", INCOMING: "incoming" };

export const text = value => String(value ?? "").trim();
export const money = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0;
};
export const positive = value => Number.isFinite(Number(value)) && Number(value) > 0;
export const validCurrency = value => INVOICE_CURRENCIES.includes(text(value).toUpperCase());
export const normalizeCurrency = value => validCurrency(value) ? text(value).toUpperCase() : "INR";
export const normalizeTaxMode = value => INVOICE_TAX_MODES.includes(value) ? value : "none";
export const formatInvoiceMoney = (amount, currency = "INR") => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: normalizeCurrency(currency), minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(money(amount));
export const toINR = (amount, currency, fxRate) => {
  if (normalizeCurrency(currency) === "INR") return money(amount);
  if (!positive(fxRate)) throw new Error("Enter a positive INR exchange rate for foreign currency.");
  return money(money(amount) * Number(fxRate));
};

export function computeInvoiceTotals(invoice = {}) {
  if (!validCurrency(invoice.currency)) throw new Error("Choose a supported invoice currency.");
  const currency = normalizeCurrency(invoice.currency);
  const taxMode = normalizeTaxMode(invoice.taxMode);
  const rateINR = currency === "INR" ? 1 : Number(invoice.fxRateINR);
  if (!Array.isArray(invoice.lines) || !invoice.lines.length) throw new Error("At least one invoice line is required.");
  if (invoice.lines.length > 40) throw new Error("Maximum 40 invoice lines are supported.");
  let subtotal = 0, discount = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
  const lines = invoice.lines.map((line, index) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const discountRate = Number(line.discountRate || 0);
    const taxRate = Number(line.taxRate || 0);
    if (!text(line.description)) throw new Error(`Line ${index + 1}: description is required.`);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Line ${index + 1}: quantity and unit price must be valid.`);
    }
    if (![discountRate, taxRate].every(Number.isFinite) || discountRate < 0 || discountRate > 100 || taxRate < 0 || taxRate > 100) {
      throw new Error(`Line ${index + 1}: enter valid discount and tax percentages (0-100).`);
    }
    const base = money(quantity * unitPrice);
    const lineDiscount = money(base * discountRate / 100);
    const lineTaxable = money(base - lineDiscount);
    const lineTax = taxMode === "none" ? 0 : money(lineTaxable * taxRate / 100);
    const halfTax = taxMode === "cgst_sgst" ? money(lineTax / 2) : 0;
    const lineCgst = halfTax;
    const lineSgst = taxMode === "cgst_sgst" ? money(lineTax - halfTax) : 0;
    const lineIgst = taxMode === "igst" ? lineTax : 0;
    subtotal = money(subtotal + base);
    discount = money(discount + lineDiscount);
    taxable = money(taxable + lineTaxable);
    cgst = money(cgst + lineCgst);
    sgst = money(sgst + lineSgst);
    igst = money(igst + lineIgst);
    return { ...line, description: text(line.description), sac: text(line.sac), quantity, unitPrice: money(unitPrice), discountRate, taxRate: taxMode === "none" ? 0 : taxRate, base, discount: lineDiscount, taxable: lineTaxable, cgst: lineCgst, sgst: lineSgst, igst: lineIgst, total: money(lineTaxable + lineTax) };
  });
  const totalTax = money(cgst + sgst + igst);
  const total = money(taxable + totalTax);
  return { lines, currency, taxMode, subtotal, discount, taxable, cgst, sgst, igst, totalTax, total, fxRateINR: currency === "INR" ? 1 : rateINR, totalINR: toINR(total, currency, rateINR) };
}

export function fiscalYearForDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(isoDate))) throw new Error("Use YYYY-MM-DD for the invoice date.");
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) throw new Error("Invalid invoice date.");
  const year = date.getUTCMonth() < 3 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
  return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
}
export function formatIssuedInvoiceNumber(fy, number) {
  if (!/^\d{2}-\d{2}$/.test(fy) || !Number.isSafeInteger(number) || number < 1 || number > 999999) {
    throw new Error("Invalid financial year or invoice counter.");
  }
  const result = `DT/${fy}/${String(number).padStart(5, "0")}`;
  if (result.length > 16) throw new Error("Invoice serial number exceeds GST length limit.");
  return result;
}
export function vendorInvoiceDocId(vendorId, vendorInvoiceNumber) {
  const vendor = text(vendorId);
  const number = text(vendorInvoiceNumber).replace(/\s+/g, " ").toUpperCase();
  if (!vendor || !number) throw new Error("Vendor and vendor invoice number are required.");
  const key = `${encodeURIComponent(vendor)}__${encodeURIComponent(number)}`;
  if (key.length > 700) throw new Error("Vendor invoice identifier is too long.");
  return key;
}
export function validateGstin(value) {
  return !text(value) || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(text(value).toUpperCase());
}
export function validateOutgoingInvoice(data = {}, { issue = false } = {}) {
  if (!text(data.leadId)) throw new Error("Select a booking/lead.");
  if (!text(data.recipient?.name)) throw new Error("Travel agent/recipient name is required.");
  if (!text(data.supplier?.name)) throw new Error("Supplier company name is required.");
  const totals = computeInvoiceTotals(data);
  if (totals.total <= 0) throw new Error("Invoice total must be greater than zero.");
  if (![data.recipient?.gstin, data.supplier?.gstin].every(validateGstin)) throw new Error("Check the GSTIN format.");
  if (issue) {
    if (text(data.stage) !== "converted") throw new Error("Only a Closed-Won booking can be invoiced.");
    if (!text(data.supplier?.address)) throw new Error("Enter supplier registered address in Invoice Settings.");
    if (!text(data.recipient?.address)) throw new Error("Enter travel agent billing address.");
    if (!text(data.issueDate)) throw new Error("Invoice date is required.");
    fiscalYearForDate(data.issueDate);
    if (text(data.dueDate)) {
      fiscalYearForDate(data.dueDate);
      if (data.dueDate < data.issueDate) throw new Error("Payment due date cannot be before the issue date.");
    }
    if (totals.taxMode !== "none") {
      if (!text(data.supplier?.gstin)) throw new Error("Supplier GSTIN is required for a tax invoice.");
      if (!text(data.placeOfSupply)) throw new Error("Place of supply is required for a tax invoice.");
      if (totals.lines.some(line => line.taxRate > 0 && !line.sac)) throw new Error("SAC/HSN is required for taxable invoice lines.");
    }
  }
  return totals;
}
export function validateIncomingInvoice(data = {}) {
  if (!text(data.leadId)) throw new Error("Select the related booking/lead.");
  if (!text(data.vendorId)) throw new Error("Select the vendor.");
  if (!text(data.vendorInvoiceNumber)) throw new Error("Vendor invoice number is required.");
  if (!text(data.vendorInvoiceDate)) throw new Error("Vendor invoice date is required.");
  fiscalYearForDate(data.vendorInvoiceDate);
  if (!text(data.originalFilePath) && !text(data.originalFileUrl)) throw new Error("Upload the original vendor invoice.");
  const totals = computeInvoiceTotals(data);
  if (totals.total <= 0) throw new Error("Vendor invoice total must be greater than zero.");
  return totals;
}
export function invoicePaymentStatus(invoiceTotal, linkedAmounts = []) {
  const total = money(invoiceTotal);
  const received = money(linkedAmounts.reduce((sum, amount) => sum + money(amount), 0));
  const balance = money(Math.max(0, total - received));
  return { received, balance, status: received <= 0 ? "unpaid" : balance <= 0 ? "paid" : "part_paid", excess: money(Math.max(0, received - total)) };
}
