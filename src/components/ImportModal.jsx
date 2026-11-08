import { useEffect, useRef, useState } from 'react'
import { CircleCheck, FileUp, TriangleAlert, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { importTransactions } from '../api/transactions'
import { LARGEST_FILE, readTransactionFile } from '../lib/transactionFile'
import { shortDate } from '../lib/dates'
import { plainMoney } from '../lib/money'
import { SignedAmount, TypeChip, transactionMovement, transactionName } from './TransactionRow'
import { useEscape } from './ui'

const LABELS = { date:'Date', type:'Type', amount:'Amount', description:'Description', category:'Category', from_account:'From account', to_account:'To account', note:'Note', changes_balances:'Changes balances', hidden_from_insights:'Hidden from insights' }
const LISTED = 50 // rows a list shows before Show all
const count = (n, one, many=`${one}s`) => `${n.toLocaleString('en-US')} ${n===1?one:many}`

function shownValue(field, value, currency) {
  if (typeof value==='boolean') return value?'Yes':'No'
  if (value===null) return field==='category'?'Uncategorized':'None'
  if (field==='amount') return plainMoney(value,currency)
  if (field==='date') return shortDate(value)
  if (field==='type') return value[0].toUpperCase()+value.slice(1)
  return value
}

// A problem names the entry the way the file shows it, since the file is where it gets fixed.
function entryLabel(entry, number) {
  const e=entry&&typeof entry==='object'&&!Array.isArray(entry)?entry:{}; const text=value=>typeof value==='string'||typeof value==='number'?String(value).trim():''
  return [`Entry ${number}`,text(e.id)&&`id ${text(e.id)}`,text(e.date),text(e.description)].filter(Boolean).join(' · ')
}

function finished({ updated, added, categories_added }) {
  const done=[updated&&`updated ${count(updated,'transaction')}`,added&&`added ${updated?added:count(added,'transaction')}`].filter(Boolean).join(' and ')
  return `${done[0].toUpperCase()}${done.slice(1)}.${categories_added?` Created ${count(categories_added,'category','categories')}.`:''}`
}

function Section({ title, items, children }) {
  const [all,setAll]=useState(false)
  return <section className="import-section"><h3>{title}</h3><ul className="import-list">{(all?items:items.slice(0,LISTED)).map(children)}</ul>{!all&&items.length>LISTED&&<button type="button" className="text-link import-more" onClick={()=>setAll(true)}>Show all {items.length.toLocaleString('en-US')}</button>}</section>
}

const Update = ({ update:u, currency }) => <li className="import-item">
  <TypeChip type={u.transaction.type}/>
  <span className="import-item-text"><span className="row-title">{transactionName(u.transaction)}</span><span className="row-meta">{shortDate(u.transaction.occurred_on)} · id {u.id}</span></span>
  <dl className="import-changes">{u.changes.map(c=><div key={c.field}><dt>{LABELS[c.field]}</dt><dd><del>{shownValue(c.field,c.from,currency)}</del> <span aria-hidden="true">→</span><span className="sr-only">becomes</span> <ins>{shownValue(c.field,c.to,currency)}</ins></dd></div>)}</dl>
</li>

const Addition = ({ addition:a, currency }) => <li className="import-item">
  <TypeChip type={a.transaction.type}/>
  <span className="import-item-text"><span className="row-title">{transactionName(a.transaction)}</span><span className="row-meta">{shortDate(a.transaction.occurred_on)} · {transactionMovement(a.transaction)}</span></span>
  <SignedAmount transaction={a.transaction} currency={currency}/>
  {a.matches&&<p className="import-warning"><TriangleAlert size={14} strokeWidth={2.4} aria-hidden="true"/>Looks like transaction {a.matches}, already in your ledger</p>}
</li>

// Two steps on purpose: the file is checked and every change shown first, and nothing is saved until Import.
export function ImportModal({ currency, onClose }) {
  useEscape(onClose)
  const queryClient=useQueryClient(); const picker=useRef(null); const dialog=useRef(null); const action=useRef(null)
  const [step,setStep]=useState('pick'); const [file,setFile]=useState(null); const [plan,setPlan]=useState(null); const [result,setResult]=useState(null)
  const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [dragging,setDragging]=useState(false)
  const busy=step==='checking'||step==='saving'; const changes=plan?plan.updates.length+plan.additions.length:0
  // A result starts at its summary, with the main button ready for the keyboard. Plain autofocus would scroll down to that button.
  useEffect(()=>{if(step!=='review'&&step!=='done')return;dialog.current.scrollTop=0;action.current?.focus({preventScroll:true})},[step,plan])

  async function check(picked) {
    if (!picked||busy) return
    setError(''); setNotice(''); setPlan(null); setFile(null)
    if (/\.csv$/i.test(picked.name)) { setStep('pick'); setError('Import reads the JSON export, not the CSV. Export as JSON to get a file you can edit and bring back.'); return }
    if (picked.size>LARGEST_FILE) { setStep('pick'); setError('This file is too big to import at once. Export fewer months at a time.'); return }
    setStep('checking')
    try { const entries=readTransactionFile(await picked.text(),{currency}); const checked=await importTransactions(entries); setFile({name:picked.name,entries}); setPlan(checked); setStep('review') }
    catch (err) { setError(err.message); setStep('pick') }
  }
  async function save() {
    setStep('saving'); setError(''); setNotice('')
    try {
      const saved=await importTransactions(file.entries,plan.fingerprint)
      if (typeof saved?.updated!=='number') throw new Error('The import didn’t finish. Choose the file again to see what still needs importing.')
      setResult(saved); setStep('done')
      for (const key of ['transactions','accounts','insights','categories']) queryClient.invalidateQueries({queryKey:[key]})
    } catch (err) {
      // The ledger changed after the check, so check again and show what importing would do now.
      if (err.status===409) { try { setPlan(await importTransactions(file.entries)); setNotice('Your ledger changed while you were reviewing, so the file was checked again. Look it over, then import.') } catch (again) { setError(again.message) } }
      else setError(err.message)
      setStep('review')
    }
  }
  // The whole screen takes the drop, so a file let go anywhere is never opened by the browser in place of the app.
  const drag={onDragOver:e=>{e.preventDefault();setDragging(true)},onDragLeave:e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragging(false)},onDrop:e=>{e.preventDefault();setDragging(false);check(e.dataTransfer.files[0])}}
  const status=step==='checking'?'Checking the file…':step==='review'&&plan?`${plan.updates.length} to update, ${plan.additions.length} to add, ${plan.unchanged} unchanged${plan.error_count?`, ${count(plan.error_count,'problem')} to fix`:''}.`:step==='done'&&result?finished(result):''

  return <div className="modal-backdrop" onMouseDown={onClose} {...drag}><div ref={dialog} className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2 id="import-title">Import transactions</h2><p className="section-description">{file?`${file.name} · ${count(plan.entries,'transaction')}`:'Bring back a JSON file you exported and edited. You’ll see every change before anything is saved.'}</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div>
    <input ref={picker} type="file" accept=".json,application/json" hidden onChange={e=>{const picked=e.target.files[0];e.target.value='';check(picked)}}/>
    <p className="sr-only" role="status">{status}</p>
    {step==='pick'||step==='checking'?<>
      <button type="button" className={`drop-zone${dragging?' is-dragging':''}`} disabled={busy} autoFocus onClick={()=>picker.current.click()}>
        <FileUp size={30} strokeWidth={2} aria-hidden="true"/><strong>{busy?'Checking your file…':'Choose a JSON file'}</strong><small>{busy?'Nothing is saved yet.':'or drop it here'}</small>
      </button>
      <ul className="import-rules">
        <li>Transactions with an <code>id</code> get only the changes you made.</li>
        <li>Entries without an <code>id</code> are added as new transactions.</li>
        <li>Anything you leave out of the file stays as it is. Importing never deletes.</li>
      </ul>
    </>:step==='done'?<div className="import-done">
      <span className="done-mark"><CircleCheck size={32} strokeWidth={2.2} aria-hidden="true"/></span><h3>Import finished</h3><p>{finished(result)}</p>
      {result.added>0&&<p className="form-help">Export again before your next edit, so the transactions you just added have ids.</p>}
    </div>:<>
      <div className="import-stats"><p className="import-stat update"><strong>{plan.updates.length.toLocaleString('en-US')}</strong><span>to update</span></p><p className="import-stat add"><strong>{plan.additions.length.toLocaleString('en-US')}</strong><span>to add</span></p><p className="import-stat"><strong>{plan.unchanged.toLocaleString('en-US')}</strong><span>unchanged</span></p></div>
      {notice&&<p className="form-help">{notice}</p>}
      {plan.error_count>0&&<section className="import-problems">
        <h3><TriangleAlert size={18} strokeWidth={2.4} aria-hidden="true"/>{plan.error_count===1?'Fix this in the file first':`Fix these ${count(plan.error_count,'problem')} in the file first`}</h3>
        <ul>{plan.errors.map(p=><li key={p.entry}><strong>{entryLabel(file.entries[p.entry-1],p.entry)}</strong>{p.message}</li>)}</ul>
        {plan.error_count>plan.errors.length&&<p>And {count(plan.error_count-plan.errors.length,'more problem')}.</p>}
        <p>Nothing has been saved. Fix the file, then choose it again.</p>
      </section>}
      {plan.updates.length>0&&<Section title="Updates" items={plan.updates}>{u=><Update key={u.id} update={u} currency={currency}/>}</Section>}
      {plan.additions.length>0&&<Section title="New transactions" items={plan.additions}>{a=><Addition key={a.entry} addition={a} currency={currency}/>}</Section>}
      {plan.new_categories.length>0&&<p className="form-help">Importing also creates {count(plan.new_categories.length,'category','categories')}: {plan.new_categories.join(', ')}.</p>}
      {!changes&&!plan.error_count&&<p className="import-same"><CircleCheck size={20} strokeWidth={2.2} aria-hidden="true"/>Everything in this file already matches your ledger.</p>}
    </>}
    {error&&<p className="error">{error}</p>}
    {step!=='pick'&&step!=='checking'&&<div className="form-actions">
      {step==='done'?<button ref={action} type="button" className="button" onClick={onClose}>Done</button>:<>
        <button type="button" className="button secondary" disabled={busy} onClick={()=>picker.current.click()}>Choose another file</button>
        {changes>0&&!plan.error_count?<button ref={action} type="button" className="button" disabled={busy} onClick={save}>{step==='saving'?'Importing…':`Import ${count(changes,'change')}`}</button>:<button ref={action} type="button" className="button" onClick={onClose}>Close</button>}
      </>}
    </div>}
  </div></div>
}
