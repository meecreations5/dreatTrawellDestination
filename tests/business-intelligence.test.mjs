import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBookingFinance, captureClosingBusiness, summarizeConfirmedBusiness, groupConfirmedBusiness
} from '../lib/reporting/businessIntelligence.mjs';
import { getDealWonEventDate, businessDateKey } from '../lib/reporting/leadReportingDates.mjs';

const february = { from:'2026-02-01', to:'2026-02-28' };
const october = { from:'2026-10-01', to:'2026-10-31' };
const mk = (id,fields={}) => ({
  id, leadCode:`DT-${id}`, stage:'converted', createdAt:'2026-09-15T05:00:00+05:30',
  dealWonDateKey:'2026-10-08', destinationName:'Thailand', agentId:'a1',
  agentName:'Test Agent', dealWonExecutiveUid:'e1', dealWonExecutiveName:'Executive A',
  confirmedBusiness: {version:1,verified:true,currency:'INR',sellingAmountInr:200000,
    vendorCostInr:170000,grossProfitInr:30000,source:'admin_verified'},
  ...fields
});

test('September lead confirmed in October counts once in October, not September',()=>{
  const lead=mk('1');
  const sept=summarizeConfirmedBusiness([lead],{from:'2026-09-01',to:'2026-09-30'});
  const oct=summarizeConfirmedBusiness([lead],october);
  assert.equal(sept.totals.wins,0);
  assert.equal(oct.totals.wins,1);
  assert.equal(oct.totals.sellingInr,200000);
  assert.equal(oct.totals.vendorCostInr,170000);
  assert.equal(oct.totals.grossProfitInr,30000);
  assert.equal(oct.totals.grossMarginPct,15);
});

test('Thailand and Malaysia in one enquiry remain one won booking',()=>{
  const lead=mk('2',{destinationName:'Thailand',requirement:'Thailand + Malaysia combined'});
  const s=summarizeConfirmedBusiness([lead],october);
  assert.equal(s.totals.wins,1);
  assert.equal(groupConfirmedBusiness(s,'destination').length,1);
  assert.equal(groupConfirmedBusiness(s,'destination')[0].sellingInr,200000);
});

test('duplicate id, deleted and reopened leads cannot inflate won counts',()=>{
  const same=mk('3'),deleted=mk('4',{deleted:true}),reopened=mk('5',{stage:'revision_required'});
  const s=summarizeConfirmedBusiness([same,same,deleted,reopened],october);
  assert.equal(s.totals.wins,1);
  assert.equal(s.totals.sellingInr,200000);
});

test('legacy lead without snapshot contributes one win but no guessed INR',()=>{
  const s=summarizeConfirmedBusiness([mk('6',{confirmedBusiness:null,finalQuotationAmount:3000,finalVendorCost:2800})],october);
  assert.equal(s.totals.wins,1);
  assert.equal(s.totals.pendingWins,1);
  assert.equal(s.totals.verifiedWins,0);
  assert.equal(s.totals.sellingInr,0);
  assert.equal(s.totals.grossProfitInr,0);
  assert.equal(s.totals.coveragePct,0);
});

test('conversion with explicit INR selling and INR vendor cost captures stable snapshot',()=>{
  const lead={finalQuotationAmount:35000,finalVendorCost:28000,finalCustomerQuoteCurrency:'INR',finalSelectedVendorCurrency:'INR'};
  const snap=captureClosingBusiness(lead,'2026-10-20');
  assert.equal(snap.verified,true);
  assert.equal(snap.grossProfitInr,7000);
  const saved=mk('7',{confirmedBusiness:snap,finalQuotationAmount:50000,finalVendorCost:500});
  const f=getBookingFinance(saved);
  assert.equal(f.grossProfitInr,7000);
  assert.equal(f.sellingInr,35000);
});

test('foreign customer or vendor currency cannot be silently treated as INR',()=>{
  for(const [c,v] of [['SGD','INR'],['INR','MYR'],['SGD','AED']]) {
    const s=captureClosingBusiness({finalQuotationAmount:1000,finalVendorCost:800,
      finalCustomerQuoteCurrency:c,finalSelectedVendorCurrency:v},'2026-10-20');
    assert.equal(s.verified,false);
    assert.equal(s.grossProfitInr,null);
  }
});

test('missing vendor cost is unknown, not a zero-cost highly profitable booking',()=>{
  const s=captureClosingBusiness({finalQuotationAmount:10000,finalVendorCost:undefined,
    finalCustomerQuoteCurrency:'INR',finalSelectedVendorCurrency:'INR'},'2026-10-20');
  assert.equal(s.verified,false);
  assert.equal(s.vendorCostInr,null);
});

test('explicit zero vendor cost may be verified but missing cost cannot',()=>{
  const s=captureClosingBusiness({finalQuotationAmount:10000,finalVendorCost:0,
    finalCustomerQuoteCurrency:'INR',finalSelectedVendorCurrency:'INR'},'2026-10-20');
  assert.equal(s.verified,true);
  assert.equal(s.grossProfitInr,10000);
});

test('invalid INR financial snapshot does not enter totals',()=>{
  const wrongGP=mk('8',{confirmedBusiness:{version:1,verified:true,currency:'INR',sellingAmountInr:100,
    vendorCostInr:50,grossProfitInr:90}});
  const nullGP=mk('9',{confirmedBusiness:{version:1,verified:true,currency:'INR',sellingAmountInr:50,
    vendorCostInr:50,grossProfitInr:null}});
  const wrongCurrency=mk('10',{confirmedBusiness:{version:1,verified:true,currency:'SGD',sellingAmountInr:50,
    vendorCostInr:50,grossProfitInr:0}});
  const s=summarizeConfirmedBusiness([wrongGP,nullGP,wrongCurrency],october);
  assert.equal(s.totals.pendingWins,3);
  assert.equal(s.totals.sellingInr,0);
});

test('destination, executive and agent group totals equal the booked value, never double it',()=>{
  const items=[mk('11'),mk('12',{agentName:'Other Agent',agentId:'a2',destinationName:'Malaysia',dealWonExecutiveName:'Executive B',
    confirmedBusiness:{version:1,verified:true,currency:'INR',sellingAmountInr:80000,vendorCostInr:60000,grossProfitInr:20000}}),
    mk('13',{confirmedBusiness:null})];
  const s=summarizeConfirmedBusiness(items,october);
  for(const key of ['destination','executiveName','agentName']){
    const sum=groupConfirmedBusiness(s,key).reduce((n,r)=>n+r.sellingInr,0);
    assert.equal(sum,s.totals.sellingInr);
    assert.equal(groupConfirmedBusiness(s,key).reduce((n,r)=>n+r.wins,0),3);
  }
});

test('booking confirmation date takes priority over created and updated dates',()=>{
  const lead=mk('14',{updatedAt:'2026-11-09T14:00:00+05:30',dealWonDateKey:'2026-10-30'});
  assert.equal(businessDateKey(getDealWonEventDate(lead)),'2026-10-30');
});

test('auto-payment conversion must not enter booked INR until finance checks it',()=>{
  const lead=mk('15',{dealWonDateSource:'customer_payment_auto',
    confirmedBusiness:{...captureClosingBusiness({finalQuotationAmount:30000,finalVendorCost:28000,
      finalCustomerQuoteCurrency:'INR',finalSelectedVendorCurrency:'INR'},'2026-10-08'),
      source:'customer_payment_auto_needs_review',verified:false,sellingAmountInr:null,vendorCostInr:null,grossProfitInr:null}});
  const s=summarizeConfirmedBusiness([lead],october);
  assert.equal(s.totals.wins,1);
  assert.equal(s.totals.pendingWins,1);
  assert.equal(s.totals.sellingInr,0);
});

test('booked INR is unrelated to subsequent payments in November',()=>{
  const lead=mk('16',{payments:[{paymentDate:'2026-11-02',amount:120000}]});
  const oct=summarizeConfirmedBusiness([lead],october);
  assert.equal(oct.totals.sellingInr,200000);
  assert.equal(summarizeConfirmedBusiness([lead],{from:'2026-11-01',to:'2026-11-30'}).totals.wins,0);
});

test('agents with identical names but different IDs are not merged in booked performance',()=>{
  const first=mk('17',{agentId:'agent-x',agentName:'Same Brand'});
  const second=mk('18',{agentId:'agent-y',agentName:'Same Brand'});
  const result=groupConfirmedBusiness(summarizeConfirmedBusiness([first,second],october),'agentName');
  assert.equal(result.length,2);
  assert.equal(result.reduce((v,row)=>v+row.sellingInr,0),400000);
});

test('executives with identical names but different UIDs remain distinct closers',()=>{
  const first=mk('19',{dealWonExecutiveUid:'uid-a',dealWonExecutiveName:'E Sales'});
  const second=mk('20',{dealWonExecutiveUid:'uid-b',dealWonExecutiveName:'E Sales'});
  assert.equal(groupConfirmedBusiness(summarizeConfirmedBusiness([first,second],october),'executiveName').length,2);
});
