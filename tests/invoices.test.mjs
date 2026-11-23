import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInvoiceTotals, toINR, formatIssuedInvoiceNumber, fiscalYearForDate,
  vendorInvoiceDocId, validateOutgoingInvoice, validateIncomingInvoice,
  invoicePaymentStatus
} from '../lib/invoiceCore.mjs';
const item = { description: 'Dubai package', sac: '9985', quantity: 2, unitPrice: 1000, taxRate: 18, discountRate: 10 };
test('INR calculation, tax split and discount', () => {
  const d = computeInvoiceTotals({ currency:'INR', taxMode:'cgst_sgst', lines:[item] });
  assert.deepEqual([d.subtotal,d.discount,d.taxable,d.cgst,d.sgst,d.total,d.totalINR],[2000,200,1800,162,162,2124,2124]);
});
test('IGST and foreign currency INR ledger snapshot', () => {
  const d = computeInvoiceTotals({currency:'SGD',fxRateINR:65,taxMode:'igst',lines:[item]});
  assert.deepEqual([d.igst,d.total,d.totalINR],[324,2124,138060]);
});
test('no silent foreign currency conversion', () => {
  assert.throws(()=>toINR(100,'AED',0),/positive INR exchange rate/);
});
test('no tax is not treated as auto 18 percent',()=>{
  const d=computeInvoiceTotals({currency:'INR',taxMode:'none',lines:[item]});
  assert.equal(d.total,1800); assert.equal(d.totalTax,0);
});
test('financial year and invoice numbering',()=>{
  assert.equal(fiscalYearForDate('2026-03-31'),'25-26');
  assert.equal(fiscalYearForDate('2026-04-01'),'26-27');
  assert.equal(formatIssuedInvoiceNumber('26-27',15),'DT/26-27/00015');
  assert.throws(()=>formatIssuedInvoiceNumber('26-27',1000000),/Invalid/);
});
test('unique identity for case-insensitive vendor invoice number',()=>{
  assert.equal(vendorInvoiceDocId('vendor1',' Inv/4 '), vendorInvoiceDocId('vendor1','inv/4'));
  assert.notEqual(vendorInvoiceDocId('vendor1','INV4'),vendorInvoiceDocId('vendor2','INV4'));
});
test('cannot issue without converted lead, address or GST particulars',()=>{
  const base={leadId:'lead1',stage:'quote_sent',recipient:{name:'Agent',address:'Mumbai'},supplier:{name:'DreamTrawell',address:'Mumbai'},lines:[item],currency:'INR',taxMode:'none',issueDate:'2026-11-14'};
  assert.throws(()=>validateOutgoingInvoice(base,{issue:true}),/Closed-Won/);
  assert.ok(validateOutgoingInvoice({...base,stage:'converted'},{issue:true}));
  assert.throws(()=>validateOutgoingInvoice({...base,stage:'converted',taxMode:'igst'},{issue:true}),/GSTIN/);
});
test('vendor received invoice must be backed by a file',()=>{
  const base={leadId:'x',vendorId:'v',vendorInvoiceNumber:'1',vendorInvoiceDate:'2026-11-14',lines:[item],currency:'INR',taxMode:'none'};
  assert.throws(()=>validateIncomingInvoice(base),/Upload/);
  assert.ok(validateIncomingInvoice({...base,originalFilePath:'invoices/vendor/x.pdf'}));
});
test('payment reconciliation does not double count or go negative',()=>{
  assert.deepEqual(invoicePaymentStatus(100,[40,20]),{received:60,balance:40,status:'part_paid',excess:0});
  assert.deepEqual(invoicePaymentStatus(100,[150]),{received:150,balance:0,status:'paid',excess:50});
});
test('finance has invoice permissions while engagement executives cannot access invoice records', async () => {
  const { canAccess, canAccessAdminModule } = await import('../lib/rolePermissions.js');
  const finance = {uid:'finance',role:'finance',active:true};
  const relation = {uid:'rel',role:'employee',active:true};
  const operation = {uid:'ops',role:'operation_executive',active:true};
  const manager = {uid:'manager',role:'manager',active:true};
  assert.equal(canAccess(finance, 'invoices.outgoing.issue'),true);
  assert.equal(canAccess(finance, 'invoices.vendor.verify'),true);
  assert.equal(canAccess(relation,'invoices.vendor.view'),false);
  assert.equal(canAccess(operation,'invoices.outgoing.view'),true);
  assert.equal(canAccess(operation,'invoices.vendor.view'),false);
  assert.equal(canAccess(manager,'invoices.outgoing.issue'),false);
  assert.equal(canAccess(manager,'invoices.vendor.view'),true);
  assert.equal(canAccessAdminModule(finance,'invoices'),true);
});
test('unknown invoice currency is rejected instead of silently becoming INR',()=>{
  assert.throws(()=>computeInvoiceTotals({currency:'SGG',taxMode:'none',lines:[item]}),/supported invoice currency/);
});
test('due date cannot precede invoice date',()=>{
  const base={leadId:'lead1',stage:'converted',recipient:{name:'Agent',address:'Mumbai'},supplier:{name:'DreamTrawell',address:'Mumbai'},lines:[item],currency:'INR',taxMode:'none',issueDate:'2026-11-14',dueDate:'2026-11-10'};
  assert.throws(()=>validateOutgoingInvoice(base,{issue:true}),/Payment due date/);
});
