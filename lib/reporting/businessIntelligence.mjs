/**
 * DreamTrawell confirmed-booking reporting, V2.7.5.12.24.
 * ONE active won lead = at most ONE booking, irrespective of destinations.
 * All booked finance is explicitly INR; unknown / mixed-currency legacy data
 * never silently becomes INR or a zero vendor cost.
 * Pure module shared by Admin, Leads, Agent and Relationship dashboards.
 */
import {
  businessDateKey, getDealWonEventDate, isCurrentWon,
  isWithinBusinessDates
} from './leadReportingDates.mjs';

const isRemoved = x => x?.deleted === true || x?.isDeleted === true || Boolean(x?.deletedAt);
const clean = x => String(x ?? '').trim();
const money = x => (x === null || x === undefined || x === '') ? null :
  (Number.isFinite(Number(x)) ? Math.round(Number(x) * 100) / 100 : null);
const present = x => x !== null && x !== undefined && x !== '';
const currency = x => clean(x).toUpperCase();

function picked(...values) {
  for (const value of values) if (present(value)) return value;
  return null;
}

export function getBookingFinance(lead = {}) {
  const snapshot = lead?.confirmedBusiness;
  const sale = money(snapshot?.sellingAmountInr);
  const cost = money(snapshot?.vendorCostInr);
  const valid = Boolean(
    snapshot?.version === 1 && snapshot?.verified === true &&
    snapshot?.currency === 'INR' && sale !== null && sale > 0 &&
    cost !== null && cost >= 0 && present(snapshot?.grossProfitInr) &&
    Math.abs(Number(snapshot?.grossProfitInr) - (sale - cost)) < 0.02
  );
  if (valid) return {
    verified: true, sellingInr: sale, vendorCostInr: cost,
    grossProfitInr: money(sale - cost), source: clean(snapshot.source) || 'admin_verified',
    status: 'reconciled'
  };

  // Diagnostics ONLY, never summed as booked INR or expected profit.
  const candidateSelling = money(picked(lead?.finalQuotationAmount, lead?.finalCustomerQuoteAmount));
  const candidateCost = money(picked(lead?.finalVendorCost, lead?.finalSelectedVendorCost));
  const customerCurrency = currency(picked(lead?.finalCustomerQuoteCurrency, lead?.latestCustomerQuoteCurrency));
  const vendorCurrency = currency(picked(lead?.finalSelectedVendorCurrency, lead?.latestSelectedVendorCurrency));
  const reasons = [];
  if (!candidateSelling || candidateSelling <= 0) reasons.push('confirmed selling amount missing');
  if (candidateCost === null) reasons.push('vendor cost missing');
  if (customerCurrency !== 'INR') reasons.push(`customer currency ${customerCurrency || 'unknown'} needs INR confirmation`);
  if (vendorCurrency !== 'INR') reasons.push(`vendor currency ${vendorCurrency || 'unknown'} needs INR confirmation`);
  if (snapshot?.verified) reasons.push('invalid stored INR reconciliation');
  if (!snapshot?.verified) reasons.push('closing financial snapshot not verified');
  return {
    verified: false, sellingInr: null, vendorCostInr: null, grossProfitInr: null,
    status: 'needs_review', reason: reasons.join('; '),
    candidateSelling, candidateCost, customerCurrency, vendorCurrency,
    source: clean(snapshot?.source) || 'historical_or_unverified'
  };
}

/** Capture a conversion-time INR snapshot only if source fields are explicitly INR.
 * It is a snapshot; later quotation edits cannot mutate it. For incomplete /
 * ambiguous source figures, capture the original diagnostic fields only.
 */
export function captureClosingBusiness(lead = {}, wonDateKey = '') {
  const candidate = getBookingFinance({ ...lead, confirmedBusiness: null });
  const sale = candidate.candidateSelling;
  const cost = candidate.candidateCost;
  const canCapture = sale !== null && sale > 0 && cost !== null && cost >= 0 &&
    candidate.customerCurrency === 'INR' && candidate.vendorCurrency === 'INR';
  return {
    version: 1,
    currency: 'INR',
    wonDateKey: clean(wonDateKey),
    source: canCapture ? 'closing_final_inr_fields' : 'closing_needs_financial_review',
    verified: canCapture,
    sellingAmountInr: canCapture ? sale : null,
    vendorCostInr: canCapture ? cost : null,
    grossProfitInr: canCapture ? money(sale - cost) : null,
    originalSellingAmount: candidate.candidateSelling,
    originalSellingCurrency: candidate.customerCurrency,
    originalVendorAmount: candidate.candidateCost,
    originalVendorCurrency: candidate.vendorCurrency,
    quotationId: clean(lead?.finalQuotationId || ''),
    needsReview: !canCapture
  };
}

export function summarizeConfirmedBusiness(leads = [], { from = '', to = '' } = {}) {
  const seen = new Set();
  const rows = [];
  (Array.isArray(leads) ? leads : []).forEach(lead => {
    const id = clean(lead?.id || lead?.leadId || lead?.leadCode);
    if (!id || seen.has(id) || isRemoved(lead) || !isCurrentWon(lead)) return;
    const eventDate = getDealWonEventDate(lead);
    if (!eventDate || !isWithinBusinessDates(eventDate, from, to)) return;
    seen.add(id);
    const f = getBookingFinance(lead);
    rows.push({
      id, leadCode: clean(lead.leadCode || id),
      date: businessDateKey(eventDate),
      agentId: clean(lead.agentId || lead.travelAgentId),
      agentName: clean(lead.agentName || lead.agencyName || lead.travelAgentName) || 'Unmapped agent',
      destination: clean(lead.destinationName || lead.destination) || 'Unspecified destination',
      executiveUid: clean(lead.dealWonExecutiveUid || lead.assignedToUid || lead.ownerUid),
      executiveName: clean(lead.dealWonExecutiveName || lead.assignedToName || lead.ownerName) || 'Unassigned',
      financial: f, href: `/admin/leads/${encodeURIComponent(id)}`
    });
  });
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.leadCode.localeCompare(b.leadCode));
  const verified = rows.filter(row => row.financial.verified);
  const incomplete = rows.filter(row => !row.financial.verified);
  const sellingInr = money(verified.reduce((sum, row) => sum + row.financial.sellingInr, 0));
  const vendorCostInr = money(verified.reduce((sum, row) => sum + row.financial.vendorCostInr, 0));
  const grossProfitInr = money(sellingInr - vendorCostInr);
  const totals = {
    wins: rows.length, verifiedWins: verified.length, pendingWins: incomplete.length,
    sellingInr, vendorCostInr, grossProfitInr,
    grossMarginPct: sellingInr > 0 ? Math.round(grossProfitInr / sellingInr * 10000) / 100 : null,
    averageBookingInr: verified.length ? money(sellingInr / verified.length) : null,
    coveragePct: rows.length ? Math.round(verified.length / rows.length * 100) : 100
  };
  return { rows, verified, incomplete, totals };
}

export function groupConfirmedBusiness(summary, key) {
  const result = new Map();
  (summary?.rows || []).forEach(row => {
    const label = clean(row[key]) || 'Unspecified';
    // Never merge two different travel agents/executives solely because names
    // happen to match. Missing identities fall back to the displayed name.
    const identity = key === 'agentName' && row.agentId ? `agent:${row.agentId}`
      : key === 'executiveName' && row.executiveUid ? `executive:${row.executiveUid}`
      : `label:${label}`;
    if (!result.has(identity)) result.set(identity, { name: label, identity, wins: 0, verifiedWins: 0, pendingWins: 0, sellingInr: 0, vendorCostInr: 0, grossProfitInr: 0 });
    const group = result.get(identity);
    group.wins++;
    if (row.financial.verified) {
      group.verifiedWins++;
      group.sellingInr += row.financial.sellingInr;
      group.vendorCostInr += row.financial.vendorCostInr;
      group.grossProfitInr += row.financial.grossProfitInr;
    } else group.pendingWins++;
  });
  const groups = Array.from(result.values());
  const labelFrequency = new Map();
  groups.forEach(group => labelFrequency.set(group.name, (labelFrequency.get(group.name) || 0) + 1));
  return groups.sort((a, b) => b.sellingInr - a.sellingInr || b.wins - a.wins)
    .map(group => ({
      ...group,
      // Distinguish duplicate agent/executive names in charts as well as totals.
      name: labelFrequency.get(group.name) > 1 ? `${group.name} (${group.identity.split(':').slice(1).join(':').slice(0, 8)})` : group.name,
      sellingInr: money(group.sellingInr), vendorCostInr: money(group.vendorCostInr), grossProfitInr: money(group.grossProfitInr)
    }));
}

export function formatInr(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? 'Pending verification'
    : `₹${Number(value).toLocaleString('en-IN', {maximumFractionDigits: 2})}`;
}
