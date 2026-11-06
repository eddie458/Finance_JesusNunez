import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toCsv } from './csv.js'
import { exportFilename, transactionColumns } from './exportTransactions.js'

const base = { occurred_on:'2026-10-03', type:'expense', merchant:'Oxxo', category_name:'Food', amount_cents:12345, from_account_name:'Debit', to_account_name:null, note:null, is_historical:0, exclude_from_insights:0 }
const lines = (...rows) => toCsv(transactionColumns('MXN'),rows).split('\r\n')

test('writes a header and one line per transaction', () => {
  assert.deepEqual(lines(base),['Date,Type,Merchant,Category,Amount,Currency,From account,To account,Note,Changes balances,Hidden from insights','2026-10-03,expense,Oxxo,Food,-123.45,MXN,Debit,,,Yes,No'])
})

test('signs amounts like the ledger, without floating point drift', () => {
  const amountOf = t => lines({...base,...t})[1].split(',')[4]
  assert.equal(amountOf({type:'expense',amount_cents:1}),'-0.01')
  assert.equal(amountOf({type:'income',amount_cents:1999}),'19.99')
  assert.equal(amountOf({type:'transfer',amount_cents:30000}),'300.00')
  assert.equal(amountOf({type:'income',amount_cents:'110'}),'1.10')
  assert.equal(amountOf({type:'income',amount_cents:900719925474099}),'9007199254740.99')
})

test('quotes commas, quotes and line breaks', () => {
  const [,row]=toCsv(transactionColumns('MXN'),[{...base,merchant:'Tacos, "El Güero"',note:'line one\nline two'}]).split(/\r\n/)
  assert.ok(row.includes('"Tacos, ""El Güero"""'))
  assert.ok(row.includes('"line one\nline two"'))
})

test('defuses text that a spreadsheet would run as a formula', () => {
  for (const merchant of ['=HYPERLINK("http://example.com")','+1-800-FLOWERS','-Uber','@SUM(A1)']) {
    const csv=toCsv([{label:'Merchant',value:t=>t.merchant}],[{merchant}])
    assert.match(csv.split('\r\n')[1],/^"?'/,merchant)
  }
})

test('leaves plain numbers alone', () => {
  assert.equal(toCsv([{label:'n',value:t=>t}],['-120.50']).split('\r\n')[1],'-120.50')
  assert.equal(toCsv([{label:'n',value:t=>t}],['+7']).split('\r\n')[1],'+7')
})

test('labels the optional columns', () => {
  const row=lines({...base,category_name:null,from_account_name:null,is_historical:1,exclude_from_insights:'1'})[1]
  assert.equal(row,'2026-10-03,expense,Oxxo,Uncategorized,-123.45,MXN,,,,No,Yes')
})

test('names the file after the filters that are set', () => {
  assert.equal(exportFilename([]),'transactions.csv')
  assert.equal(exportFilename(['expense','','Café & Té','2026-10']),'transactions-expense-cafe-te-2026-10.csv')
  assert.equal(exportFilename([undefined,'家賃']),'transactions.csv')
})
