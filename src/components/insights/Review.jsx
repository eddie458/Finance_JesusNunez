import { useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useInsightTransactions } from '../../api/insights'
import { updateTransaction } from '../../api/transactions'
import { plainMoney } from '../../lib/money'
import { dayShort } from '../../lib/dates'
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
  return <div className={`insight-row${hidden?' is-hidden':''}`}><span style={{minWidth:0}}><span className="row-title">{name}</span><span className="row-meta">{dayShort(t.occurred_on)} · {income?'Income':t.category_name||'Uncategorized'}</span></span><span className={`money${income?' income':''}`}>{income?'+':''}{plainMoney(t.amount_cents,currency)}</span><button type="button" role="switch" className="switch" aria-checked={!hidden} aria-label={`Count ${name} in insights`} title={hidden?'Hidden from insights. Switch on to count it.':'Counted in insights. Switch off to hide it.'} disabled={review.busy(t)} onClick={()=>review.toggle(t,!hidden)}><span/></button>{error&&<p className="error insight-row-error">{error}</p>}</div>
}

function reviewSummary(transactions, review, noun, currency) {
  const counted=transactions.filter(t=>!review.isHidden(t)); const sum=type=>counted.filter(t=>t.type===type).reduce((total,t)=>total+Number(t.amount_cents),0); const spent=sum('expense'), earned=sum('income')
  return [`${counted.length} ${noun}${counted.length===1?'':'s'}`,earned>0&&`+${plainMoney(earned,currency)}`,spent>0&&`${earned>0?'−':''}${plainMoney(spent,currency)}`].filter(Boolean).join(' · ')
}

// focusKey changes when someone picks what to review, which is the only time the panel should scroll into view. A month changed by the page filter keeps the key, so the page stays put.
export function ReviewPanel({ title, noun='expense', transactions, loading, error, onClose, review, currency, focusKey, className='' }) {
  const ref=useRef(null); const shownFor=useRef(null)
  useEffect(()=>{if(!focusKey||loading||shownFor.current===focusKey)return;shownFor.current=focusKey;ref.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[focusKey,loading])
  return <section className={`tile review-tile ${className}`} ref={ref}><div className="insight-detail-head"><div style={{minWidth:0}}><h2>{title}</h2><p className="section-description">{loading?'Loading…':reviewSummary(transactions,review,noun,currency)}</p></div><div className="chart-actions">{transactions.length>0&&<button type="button" className="icon-button" title="Export these transactions as CSV" aria-label="Export these transactions as CSV" onClick={()=>exportTransactions(transactions,{name:[title],currency})}><Download size={18} strokeWidth={2.2}/></button>}<button type="button" className="icon-button" title="Close" aria-label="Close" onClick={onClose}><X size={18} strokeWidth={2.2}/></button></div></div>{loading?<div className="empty">Loading transactions…</div>:transactions.length?<div className="insight-list">{transactions.map(t=><ReviewRow key={t.id} transaction={t} review={review} currency={currency}/>)}</div>:error?<p className="error">{error.message}</p>:<div className="empty">Nothing recorded here.</div>}</section>
}

export function HiddenList({ review, currency }) {
  const {data}=useInsightTransactions({hidden:1}); const hidden=data??[]
  if (!hidden.length) return null
  return <section className="tile review-tile open-ended t-12"><h2>Hidden from insights</h2><p className="section-description">{hidden.length} transaction{hidden.length===1?' is':'s are'} left out of the spending and cash-flow charts. Switch one on to count it again.</p><div className="insight-list">{hidden.map(t=><ReviewRow key={t.id} transaction={t} review={review} currency={currency}/>)}</div></section>
}
