const { test } = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('Invoice totals and GST breakdown match the amount billed for an HSN item with a coupon', () => {
  const items = [{ id: 4, name: 'Rice', sku: 'RICE-4', hsn: '1006', price: 600, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = { id: 4, date: '22/11/2026', customer: 'Test', items, coupon: 'SAVE10', total: billed.total, tax: billed.tax };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, billed.subtotal);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(figures.rows[0].lineTax, billed.lines[0].tax);
});

test('Invoice uses the configured HSN slab for GST', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const orderTotals = pricing.computeTotals(items, '');
  const order = { id: 1, date: '22/11/2026', customer: 'Test', items, coupon: '', total: orderTotals.total, tax: orderTotals.tax };
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(orderTotals.tax, 5);
  assert.equal(orderTotals.total, 105);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
});

test('Invoice applies the coupon to subtotal before calculating GST, matching billed totals', () => {
  const items = [{ id: 2, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 600, qty: 1 }];
  const orderTotals = pricing.computeTotals(items, 'SAVE10');
  const order = { id: 2, date: '22/11/2026', customer: 'Test', items, coupon: 'SAVE10', total: orderTotals.total, tax: orderTotals.tax };
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(orderTotals.discount, 60);
  assert.equal(orderTotals.tax, 27);
  assert.equal(orderTotals.total, 567);
  assert.equal(invoiceFigures.discount, 60);
  assert.equal(invoiceFigures.tax, 27);
  assert.equal(invoiceFigures.total, 567);
});

test('GST reconciliation reports billed totals and taxes as matched', () => {
  const items = [{ id: 3, name: 'Rice', sku: 'RICE-3', hsn: '1006', price: 600, qty: 1 }];
  const totals = pricing.computeTotals(items, 'SAVE10');
  const order = { id: 3, date: '22/11/2026', customer: 'Test', items, coupon: 'SAVE10', subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total };
  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.deepEqual(
    { ledgerTax: reconciliation.rows[0].ledgerTax, invoiceTax: reconciliation.rows[0].invoiceTax, delta: reconciliation.rows[0].delta, matched: reconciliation.rows[0].matched },
    { ledgerTax: 27, invoiceTax: 27, delta: 0, matched: true }
  );
});
