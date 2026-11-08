import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportFilename } from './exportTransactions.js'
import { fileEntry, readTransactionFile, transactionFile } from './transactionFile.js'

const row = { id:'412', occurred_on:'2026-11-05', type:'expense', amount_cents:4550, merchant:'Oxxo', category_name:'Food', from_account_name:'Débito BBVA', to_account_name:null, note:'Weekly shop', is_historical:0, exclude_from_insights:'1', from_account_id:1, to_account_id:null, category_id:3 }
const file = transactions => transactionFile(transactions,{currency:'MXN',accounts:[{id:1,name:'Débito BBVA'},{id:2,name:'Ahorros'}],categories:[{id:3,name:'Food'}],exportedAt:new Date('2026-11-07T18:30:00Z')})

test('writes each transaction with names and a decimal amount', () => {
  assert.deepEqual(fileEntry(row),{id:412,date:'2026-11-05',type:'expense',amount:45.5,description:'Oxxo',category:'Food',from_account:'Débito BBVA',to_account:null,note:'Weekly shop',changes_balances:true,hidden_from_insights:true})
})

test('leaves empty fields as null and reads switches like the form', () => {
  const entry=fileEntry({...row,merchant:null,category_name:undefined,note:null,is_historical:'1',exclude_from_insights:0,from_account_name:null})
  assert.deepEqual([entry.description,entry.category,entry.note,entry.from_account,entry.changes_balances,entry.hidden_from_insights],[null,null,null,null,false,false])
})

// The server takes a JSON number only when it prints back as itself with two decimals, so every amount has to survive the trip.
test('writes amounts that read back to the exact cent', () => {
  const exact = cents => { const text=JSON.stringify(fileEntry({...row,amount_cents:cents}).amount); const [whole,part='']=text.split('.'); return /^\d+(\.\d{1,2})?$/.test(text)&&BigInt(whole)*100n+BigInt(part.padEnd(2,'0'))===BigInt(cents) }
  for (let cents=1; cents<=200000; cents++) assert.ok(exact(cents),String(cents))
  for (const cents of [999999999999999,123456789012345,100000000000001,'110']) assert.ok(exact(cents),String(cents))
})

test('says what the file is and which names it can use', () => {
  const {transactions,...head}=file([row])
  assert.deepEqual(head,{format:'fluent-transactions',version:1,exported_at:'2026-11-07T18:30:00.000Z',currency:'MXN',accounts:['Débito BBVA','Ahorros'],categories:['Food']})
  assert.equal(transactions.length,1)
})

test('reads back what it writes', () => {
  const written=file([row,{...row,id:7,type:'income',from_account_name:null,to_account_name:'Ahorros'}])
  assert.deepEqual(readTransactionFile(JSON.stringify(written,null,2),{currency:'MXN'}),written.transactions)
})

test('also reads a plain list, and a file saved with a byte order mark', () => {
  assert.deepEqual(readTransactionFile('[{"date":"2026-11-06"}]'),[{date:'2026-11-06'}])
  assert.equal(readTransactionFile('﻿'+JSON.stringify(file([row]))).length,1)
})

test('explains a file it can’t import', () => {
  const fails = (text, message) => assert.throws(()=>readTransactionFile(text,{currency:'MXN'}),{message})
  fails('{"transactions": [}',/^This file isn’t valid JSON\. /)
  fails('',/^This file isn’t valid JSON\. /)
  fails('{"format":"bank-statement","transactions":[{}]}','This isn’t a Fluent transactions file.')
  fails('{"format":"fluent-transactions","version":2,"transactions":[{}]}','This file comes from a newer version of Fluent. Reload the page, then try again.')
  fails('{"currency":"USD","transactions":[{}]}','This file’s amounts are in USD, but your ledger is in MXN.')
  fails('{"accounts":[]}','This file doesn’t have a list of transactions.')
  fails('null','This file doesn’t have a list of transactions.')
  fails('"transactions"','This file doesn’t have a list of transactions.')
  fails('[]','This file has no transactions in it.')
  fails(JSON.stringify(Array(10001).fill({})),'This file has 10,001 transactions. Import at most 10,000 at a time.')
})

test('names the JSON file after the filters, like the CSV', () => {
  assert.equal(exportFilename(['','','','2026-11'],'json'),'transactions-2026-11.json')
  assert.equal(exportFilename(['expense','Café','',''],'json'),'transactions-expense-cafe.json')
})
