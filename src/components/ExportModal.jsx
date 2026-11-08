import { useState } from 'react'
import { FileJson, FileSpreadsheet, X } from 'lucide-react'
import { fetchAllTransactions } from '../api/transactions'
import { useAccounts } from '../api/accounts'
import { useCategories } from '../api/insights'
import { exportTransactions } from '../lib/exportTransactions'
import { exportTransactionFile } from '../lib/transactionFile'
import { useEscape } from './ui'

const FORMATS = [
  { id:'csv', label:'CSV', Icon:FileSpreadsheet, detail:'Open it in Excel, Numbers or Google Sheets.' },
  { id:'json', label:'JSON', Icon:FileJson, detail:'Edit transactions outside Fluent, then use Import to save your changes.' },
]

// Either file holds every transaction that matches the page's filters, not just the rows on screen.
export function ExportModal({ filters, count, scope, name, currency, partial, onClose }) {
  useEscape(onClose)
  const {data:accounts=[]}=useAccounts(); const {data:categories=[]}=useCategories(); const [saving,setSaving]=useState(''); const [error,setError]=useState('')
  async function save(format){setSaving(format);setError('');try{const rows=await fetchAllTransactions(filters);if(format==='csv')exportTransactions(rows,{name,currency});else exportTransactionFile(rows,{name,currency,accounts,categories});onClose()}catch(err){setError(err.message)}finally{setSaving('')}}
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2 id="export-title">Export transactions</h2><p className="section-description">{count} transaction{count===1?'':'s'} · {scope}</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div>
    <div className="file-choices">{FORMATS.map(({id,label,Icon,detail},i)=><button key={id} type="button" className="file-choice" disabled={Boolean(saving)} autoFocus={i===0} onClick={()=>save(id)}><span className={`file-icon ${id}`}><Icon size={24} strokeWidth={2}/></span><span><strong>{saving===id?'Preparing…':label}</strong><small>{detail}</small></span></button>)}</div>
    {error&&<p className="error">{error}</p>}
    {partial&&<p className="form-help">To export your whole ledger, set the month filter to All months first.</p>}
  </div></div>
}
