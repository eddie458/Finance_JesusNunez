import { useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, EyeOff, Download, Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTransactionPages, deleteTransaction } from '../api/transactions'
import { useAccounts } from '../api/accounts'
import { useCategories, useNetWorth } from '../api/insights'
import { useMe } from '../api/auth'
import { plainMoney } from '../lib/money'
import { isAdjustment } from '../lib/adjustment'
import { dayHeading, daysInMonth, localToday, monthLong, monthName, monthRange } from '../lib/dates'
import { AdjustmentModal } from '../components/BalanceModal'
import { ExportModal } from '../components/ExportModal'
import { ImportModal } from '../components/ImportModal'
import { TransactionModal } from '../components/TransactionModal'
import { SignedAmount, TypeChip, transactionMovement, transactionName } from '../components/TransactionRow'
import { Amount, PillSelect } from '../components/ui'

const TYPES = [{value:'',label:'All types'},{value:'expense',label:'Expenses'},{value:'income',label:'Income'},{value:'transfer',label:'Transfers'}]
const SORTS = [{value:'desc',label:'Newest first'},{value:'asc',label:'Oldest first'}]
const HERO = { income:{verb:'Earned',key:'earned_cents'}, transfer:{verb:'Moved',key:'moved_cents'} }
const SPENT = { verb:'Spent', key:'spent_cents' }

function byDay(transactions) {
  const days=[]; for (const t of transactions) { const last=days.at(-1); if(last?.day===t.occurred_on)last.rows.push(t); else days.push({day:t.occurred_on,rows:[t]}) }
  return days
}

function TransactionItem({ transaction:t, currency, onEdit, onDelete }) {
  const hidden=Number(t.exclude_from_insights); const adjustment=isAdjustment(t)
  return <div className="tx-row">
    <button type="button" className="tx-main" title={adjustment?'View adjustment':'Edit transaction'} onClick={()=>onEdit(t)}>
      <TypeChip type={t.type}/>
      <span className="tx-text"><span className="row-title">{transactionName(t)}</span><span className="row-meta">{transactionMovement(t)}{hidden?<span className="hidden-flag"><EyeOff size={12} aria-hidden="true"/>Hidden from insights</span>:null}</span></span>
      <SignedAmount transaction={t} currency={currency}/>
    </button>
    <div className="table-actions">{!adjustment&&<button type="button" className="icon-button" title="Edit transaction" aria-label={`Edit ${transactionName(t)}`} onClick={()=>onEdit(t)}><Pencil size={16}/></button>}<button type="button" className="icon-button" title="Delete transaction" aria-label={`Delete ${transactionName(t)}`} onClick={()=>onDelete(t.id)}><Trash2 size={16}/></button></div>
  </div>
}

export function Transactions({ onAdd, month:openingMonth }) {
  const today=localToday(); const thisMonth=today.slice(0,7)
  const [type,setType]=useState(''); const [categoryId,setCategoryId]=useState(''); const [accountId,setAccountId]=useState(''); const [month,setMonth]=useState(openingMonth??thisMonth); const [sort,setSort]=useState('desc'); const [fileDialog,setFileDialog]=useState(null); const [editing,setEditing]=useState(null)
  const filters=useMemo(()=>{const next={sort};if(type)next.type=type;if(categoryId)next.category_id=categoryId;if(accountId)next.account_id=accountId;if(month){next.from=`${month}-01`;next.to=`${month}-${daysInMonth(month)}`}return next},[type,categoryId,accountId,month,sort])
  const {data,isLoading,isPlaceholderData,error,hasNextPage,fetchNextPage,isFetchingNextPage}=useTransactionPages(filters); const transactions=data?.pages.flatMap(page=>page.rows)??[]; const totals=data?.pages.at(-1); const total=totals?.total??0
  const {data:user}=useMe(); const currency=user?.base_currency; const {data:categories=[]}=useCategories(); const {data:accounts=[]}=useAccounts(); const {data:netWorth}=useNetWorth(); const qc=useQueryClient()
  const category=categories.find(c=>String(c.id)===categoryId)?.name; const account=accounts.find(a=>String(a.id)===accountId)?.name
  const firstMonth=netWorth?.months?.[0]?.month, lastMonth=netWorth?.months?.at(-1)?.month
  const months=monthRange(firstMonth&&firstMonth<thisMonth?firstMonth:thisMonth,lastMonth&&lastMonth>thisMonth?lastMonth:thisMonth).reverse().map(m=>({value:m,label:monthName(m)}))
  const hero=HERO[type]??SPENT; const when=!month?'across all months':month.slice(0,4)===thisMonth.slice(0,4)?`in ${monthLong(month)}`:`in ${monthName(month)}`; const heroLabel=[hero.verb,category&&`on ${category}`,account&&`with ${account}`,when].filter(Boolean).join(' ')
  const filtered=type||categoryId||accountId||month!==thisMonth||sort!=='desc'; const scope=[month?monthName(month):'All months',TYPES.find(t=>type&&t.value===type)?.label,category,account].filter(Boolean).join(' · ')
  function clearFilters(){setType('');setCategoryId('');setAccountId('');setMonth(thisMonth);setSort('desc')}
  async function remove(id){if(!confirm('Delete this transaction? This cannot be undone.'))return false;await deleteTransaction(id);qc.invalidateQueries({queryKey:['transactions']});qc.invalidateQueries({queryKey:['accounts']});qc.invalidateQueries({queryKey:['insights']});return true}
  return <>
    <div className="bento">
      <section className="tile tile-coral tx-hero t-8 fit">
        <div className="tx-hero-head"><h1>Transactions</h1><div className="head-actions"><button type="button" className="tx-file" title="Download every transaction that matches these filters" disabled={isLoading||!transactions.length} onClick={()=>setFileDialog('export')}><Download size={18} strokeWidth={2.2}/><span>Export</span></button><button type="button" className="tx-file" title="Update or add transactions from a JSON file" onClick={()=>setFileDialog('import')}><Upload size={18} strokeWidth={2.2}/><span>Import</span></button><button type="button" className="button desktop-only" onClick={onAdd}><Plus size={17} strokeWidth={2.4}/> Add transaction</button></div></div>
        <p className="stat-label">{heroLabel}</p>
        <p className="hero-number"><Amount cents={totals?.[hero.key]??0} currency={currency} loading={!totals}/></p>
      </section>
      <section className="tile tile-mint tx-summary t-4 desktop-only fit"><p className="stat-label">In this view</p><p className="count-value">{totals?`${total} transaction${total===1?'':'s'}`:'—'}</p><p className="stat-note">{plainMoney(totals?.earned_cents??0,currency)} earned · {plainMoney(totals?.moved_cents??0,currency)} moved</p></section>
    </div>
    <div className="filter-pills">
      <PillSelect label="Month" value={month} onChange={setMonth} active={Boolean(month)} options={[{value:'',label:'All months'},...months]}/>
      <PillSelect label="Type" value={type} onChange={setType} active={Boolean(type)} options={TYPES}/>
      <PillSelect label="Category" value={categoryId} onChange={setCategoryId} active={Boolean(categoryId)} options={[{value:'',label:'All categories'},...categories.map(c=>({value:String(c.id),label:c.name}))]}/>
      <PillSelect label="Account" value={accountId} onChange={setAccountId} active={Boolean(accountId)} options={[{value:'',label:'All accounts'},...accounts.map(a=>({value:String(a.id),label:`${a.name}${Number(a.is_archived)?' (archived)':''}`}))]}/>
      <PillSelect label="Date order" value={sort} onChange={setSort} active={sort!=='desc'} options={SORTS}/>
      {filtered&&<button type="button" className="text-link clear-filters" onClick={clearFilters}>Clear filters</button>}
    </div>
    {error&&!transactions.length?<div className="tile"><p className="error">{error.message}</p></div>:isLoading?<div className="tile empty">Loading ledger…</div>:transactions.length?<>
      <div className={`tx-days${isPlaceholderData?' is-stale':''}`}>{byDay(transactions).map(({day,rows})=><section key={day}><h2 className="day-heading">{dayHeading(day,today)}</h2><div className="tile tx-day">{rows.map(t=><TransactionItem key={t.id} transaction={t} currency={currency} onEdit={setEditing} onDelete={remove}/>)}</div></section>)}</div>
      {hasNextPage&&<div className="load-more"><span className="row-meta">Showing {transactions.length} of {total} transactions</span><button type="button" className="button secondary" disabled={isFetchingNextPage} onClick={()=>fetchNextPage()}>{isFetchingNextPage?'Loading…':'Load more'}</button></div>}
      {error&&<p className="error load-more-error">{error.message}</p>}
    </>:<div className="tile empty empty-action"><span>No transactions match this view.</span>{month&&<button type="button" className="button secondary" onClick={()=>setMonth('')}>Show all months</button>}</div>}
    {fileDialog==='export'&&<ExportModal filters={filters} count={total} scope={scope} name={[type,category,account,month]} currency={currency} partial={Boolean(month)} onClose={()=>setFileDialog(null)}/>}
    {fileDialog==='import'&&<ImportModal currency={currency} onClose={()=>setFileDialog(null)}/>}
    {editing&&(isAdjustment(editing)?<AdjustmentModal transaction={editing} currency={currency} onClose={()=>setEditing(null)} onDelete={remove}/>:<TransactionModal transaction={editing} onClose={()=>setEditing(null)} onDelete={remove}/>)}
  </>
}
