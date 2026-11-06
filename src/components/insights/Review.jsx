import { useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useInsightTransactions } from '../../api/insights'
import { updateTransaction } from '../../api/transactions'
import { formatCents } from '../../lib/money'
import { shortDate } from '../../lib/dates'
import { exportTransactions } from '../../lib/exportTransactions'

// Shared by every review list so a switch shows the same state wherever its transaction appears.
export function useReview() {
  const queryClient=useQueryClient(); const [pending,setPending]=useState({}); const [error,setError]=useState(null)
  const isHidden=t=>t.id in pending?pending[t.id]:Boolean(Number(t.exclude_from_insights))
  async function toggle(t,hidden){setPending(p=>({...p,[t.id]:hidden}));setError(null);try{await updateTransaction(t.id,{exclude_from_insights:hidden});await queryClient.invalidateQueries({queryKey:['insights']});queryClient.invalidateQueries({queryKey:['transactions']})}catch(err){setError({id:t.id,message:err.message})}finally{setPending(({[t.id]:_,...rest})=>rest)}}
  return { isHidden, toggle, busy:t=>t.id in pending, errorFor:t=>error?.id===t.id?error.message:'' }
}

function ReviewRow({ transaction:t, review, currency }) {
  const hidden=review.isHidden(t); const name=t.merchant||t.note||'No description'; const income=t.type==='income'; const error=review.errorFor(t)
  return <div className={`insight-row${hidden?' is-hidden':''}`}><div className="insight-row-text"><div className="row-title">{name}</div><div className="row-meta">{shortDate(t.occurred_on)} · {income?'Income':t.category_name||'Uncategorized'}</div></div><div className={`money ${income?'positive':'negative'}`}>{income?'+':'−'}{formatCents(t.amount_cents,currency)}</div><button type="button" role="switch" className="switch" aria-checked={!hidden} aria-label={`Count ${name} in insights`} title={hidden?'Hidden from insights. Switch on to count it.':'Counted in insights. Switch off to hide it.'} disabled={review.busy(t)} onClick={()=>review.toggle(t,!hidden)}><span/></button>{error&&<p className="error insight-row-error">{error}</p>}</div>
}

export function ReviewPanel({ title, description, transactions, loading, error, onClose, review, currency }) {
  const ref=useRef(null)
  useEffect(()=>{if(!loading)ref.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[title,loading])
  return <section className="card insight-detail" ref={ref}><div className="insight-detail-head"><div><div className="section-title">{title}</div><p className="section-description">{description}</p></div><div className="chart-actions">{transactions.length>0&&<button type="button" className="icon-button" title="Export these transactions as CSV" aria-label="Export these transactions as CSV" onClick={()=>exportTransactions(transactions,{name:[title],currency})}><Download size={16}/></button>}<button type="button" className="icon-button" title="Close" aria-label="Close" onClick={onClose}><X size={18}/></button></div></div>{loading?<div className="empty">Loading transactions…</div>:transactions.length?<div className="insight-list">{transactions.map(t=><ReviewRow key={t.id} transaction={t} review={review} currency={currency}/>)}</div>:error?<p className="error">{error.message}</p>:<div className="empty">Nothing recorded here.</div>}</section>
}

export function HiddenList({ review, currency }) {
  const {data:hidden=[]}=useInsightTransactions({hidden:1})
  if (!hidden.length) return null
  return <section className="card insight-detail"><div className="section-title">Hidden from insights</div><p className="section-description">{hidden.length} transaction{hidden.length===1?' is':'s are'} left out of the spending and cash-flow charts. Switch one on to count it again.</p><div className="insight-list">{hidden.map(t=><ReviewRow key={t.id} transaction={t} review={review} currency={currency}/>)}</div></section>
}
