import { downloadCsv, slug, toCsv } from './csv.js'

// Whole cents only, so no amount passes through floating point. Expenses are negative, matching the ledger.
const amount = t => { const cents=Number(t.amount_cents); return `${t.type==='expense'?'-':''}${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}` }
const yesNo = value => value?'Yes':'No'

export const transactionColumns = currency => [
  {label:'Date',value:t=>t.occurred_on},
  {label:'Type',value:t=>t.type},
  {label:'Merchant',value:t=>t.merchant},
  {label:'Category',value:t=>t.category_name||'Uncategorized'},
  {label:'Amount',value:amount},
  {label:'Currency',value:()=>currency},
  {label:'From account',value:t=>t.from_account_name},
  {label:'To account',value:t=>t.to_account_name},
  {label:'Note',value:t=>t.note},
  {label:'Changes balances',value:t=>yesNo(!Number(t.is_historical))},
  {label:'Hidden from insights',value:t=>yesNo(Number(t.exclude_from_insights))},
]

export const exportFilename = parts => `${['transactions',...parts].map(slug).filter(Boolean).join('-')}.csv`

export const exportTransactions = (transactions, { name=[], currency }) => downloadCsv(exportFilename(name),toCsv(transactionColumns(currency),transactions))
