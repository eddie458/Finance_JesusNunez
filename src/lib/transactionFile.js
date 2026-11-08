import { saveFile } from './download.js'
import { exportFilename } from './exportTransactions.js'

export const FILE_FORMAT = 'fluent-transactions'
export const FILE_VERSION = 1
export const IMPORT_LIMIT = 10000 // the server allows the same
export const LARGEST_FILE = 10*1024*1024 // bytes; ten thousand transactions take about 3 MB

// Names instead of ids and the amount in whole units, so the file can be edited by hand. The id is how an import finds the transaction again.
// cents/100 always prints with at most two decimals, and reads back as the same number.
export const fileEntry = t => ({
  id:Number(t.id),
  date:t.occurred_on,
  type:t.type,
  amount:Number(t.amount_cents)/100,
  description:t.merchant??null,
  category:t.category_name??null,
  from_account:t.from_account_name??null,
  to_account:t.to_account_name??null,
  note:t.note??null,
  changes_balances:!Number(t.is_historical),
  hidden_from_insights:Boolean(Number(t.exclude_from_insights)),
})

// The account and category names are there to copy from while editing. An import reads only the transactions.
export const transactionFile = (transactions, { currency, accounts=[], categories=[], exportedAt=new Date() }) => ({
  format:FILE_FORMAT, version:FILE_VERSION, exported_at:exportedAt.toISOString(), currency,
  accounts:accounts.map(a=>a.name), categories:categories.map(c=>c.name),
  transactions:transactions.map(fileEntry),
})

export const exportTransactionFile = (transactions, { name=[], ...details }) => saveFile(exportFilename(name,'json'),[JSON.stringify(transactionFile(transactions,details),null,2)],'application/json')

// Checks only that this is a transactions file. The server checks each entry against the ledger.
export function readTransactionFile(text, { currency }={}) {
  let data
  try { data=JSON.parse(text.replace(/^﻿/,'')) } catch (err) { throw new Error(`This file isn’t valid JSON. ${err.message}`) }
  if (!Array.isArray(data)) {
    if (data?.format!==undefined&&data.format!==FILE_FORMAT) throw new Error('This isn’t a Fluent transactions file.')
    if (Number(data?.version)>FILE_VERSION) throw new Error('This file comes from a newer version of Fluent. Reload the page, then try again.')
    if (currency&&data?.currency&&data.currency!==currency) throw new Error(`This file’s amounts are in ${data.currency}, but your ledger is in ${currency}.`)
  }
  const entries=Array.isArray(data)?data:data?.transactions
  if (!Array.isArray(entries)) throw new Error('This file doesn’t have a list of transactions.')
  if (!entries.length) throw new Error('This file has no transactions in it.')
  if (entries.length>IMPORT_LIMIT) throw new Error(`This file has ${entries.length.toLocaleString('en-US')} transactions. Import at most ${IMPORT_LIMIT.toLocaleString('en-US')} at a time.`)
  return entries
}
