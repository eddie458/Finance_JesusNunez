import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAccounts } from '../api/accounts'
import { useTransactions } from '../api/transactions'
import { useNetWorth } from '../api/insights'
import { useMe } from '../api/auth'
import { adjustedAccount, isAdjustment } from '../lib/adjustment'
import { plainMoney } from '../lib/money'
import { dayShort, daysInMonth, localToday, monthLong, monthName, shiftMonth } from '../lib/dates'
import { monthSummary } from '../lib/monthSummary'
import { netWorthPoints } from '../lib/netWorth'
import { foldCategories } from '../lib/palette'
import { useCategoryColors } from '../components/insights/chartKit'
import { EmptyFlower, SpendingFlower } from '../components/Flower'
import { Sparkline } from '../components/Sparkline'
import { Wallet } from '../components/Wallet'
import { SignedAmount, TypeChip, transactionKind, transactionName } from '../components/TransactionRow'
import { Amount, PillSelect } from '../components/ui'

const MONTHS = 12
const greeting = () => { const hour=new Date().getHours(); return hour<12?'Good morning.':hour<19?'Good afternoon.':'Good evening.' }

// Keeps the last month on screen until the next one arrives, so the tiles never flash empty.
function useMonthRows(month) {
  const {data,isPlaceholderData}=useTransactions({from:`${shiftMonth(month,-1)}-01`,to:`${month}-${daysInMonth(month)}`,all:1}); const [shown,setShown]=useState(month)
  if (data&&!isPlaceholderData&&shown!==month) setShown(month)
  return { rows:data??[], shown, loading:!data }
}

function changeNote(change, currency) {
  if (!change) return null
  const against=change.sameDay?`this day in ${monthLong(change.month)}`:monthLong(change.month)
  return change.cents===0?`Same as ${against}`:`${plainMoney(Math.abs(change.cents),currency)} ${change.cents<0?'less':'more'} than ${against}`
}

function keptNote(income, spent, currency) {
  if (!income) return 'No income recorded yet'
  return income>=spent?`You kept ${plainMoney(income-spent,currency)}`:`You spent ${plainMoney(spent-income,currency)} more than you earned`
}

const activityMeta = t => `${dayShort(t.occurred_on)} · ${isAdjustment(t)?adjustedAccount(t):t.type==='transfer'?`From ${t.from_account_name||'outside'}`:transactionKind(t)}`

export function Dashboard({ goTo, onAdd }) {
  const today=localToday(); const thisMonth=today.slice(0,7); const [month,setMonth]=useState(thisMonth)
  const {data:user}=useMe(); const currency=user?.base_currency
  const {data:accounts=[],isLoading}=useAccounts(); const {data:recent}=useTransactions(); const {data:netWorth}=useNetWorth(); const {rows,shown,loading}=useMonthRows(month); const colors=useCategoryColors()
  const summary=monthSummary(rows,shown,today); const petals=colors.ready?foldCategories(summary.categories,colors):[]
  const total=accounts.reduce((sum,a)=>sum+Number(a.balance_cents),0); const active=accounts.filter(a=>!Number(a.is_archived)); const isThisMonth=shown===thisMonth; const shownName=monthLong(shown); const activity=(recent??[]).slice(0,5)
  const months=Array.from({length:MONTHS},(_,i)=>shiftMonth(thisMonth,-i)).map(m=>({value:m,label:monthName(m)}))
  return <>
    <div className="page-head"><h1>{greeting()}</h1><div className="head-actions"><PillSelect label="Month" value={month} onChange={setMonth} options={months}/><button type="button" className="button desktop-only" onClick={onAdd}><Plus size={17} strokeWidth={2.4}/> Add transaction</button></div></div>
    <div className="bento">
      <section className="tile tile-coral ov-balance fit">
        <div className="ov-balance-head"><p className="stat-label">Net balance</p><span className="soft-chip">Across {accounts.length} account{accounts.length===1?'':'s'}</span></div>
        <p className="hero-number"><Amount cents={total} currency={currency} loading={isLoading}/></p>
        <Sparkline points={netWorthPoints(netWorth,thisMonth)} currency={currency}/>
      </section>
      <section className="tile tile-butter ov-spent fit"><p className="stat-label">{isThisMonth?'Spent this month':`Spent in ${shownName}`}</p><p className="stat-value"><Amount cents={summary.spent} currency={currency} loading={loading}/></p><p className="stat-note">{loading?'\u00a0':changeNote(summary.change,currency)||`${summary.count} expense${summary.count===1?'':'s'}`}</p></section>
      <section className="tile tile-mint ov-income fit"><p className="stat-label">{isThisMonth?'Income this month':`Income in ${shownName}`}</p><p className="stat-value"><Amount cents={summary.income} currency={currency} loading={loading}/></p><p className="stat-note">{loading?'\u00a0':keptNote(summary.income,summary.spent,currency)}</p></section>
      <section className="tile tile-plum ov-flower">
        <div><h2>Where {shownName} went</h2><p className="section-description">{summary.count?`${plainMoney(summary.spent,currency)} across ${summary.count} expense${summary.count===1?'':'s'}`:loading?'\u00a0':'Nothing to show yet'}</p></div>
        {petals.length?<SpendingFlower key={shown} items={petals} currency={currency} surface="#24112f"/>:<EmptyFlower surface="#24112f">{loading||!colors.ready?'Adding up your month…':`Nothing spent in ${shownName}.`}</EmptyFlower>}
      </section>
      <section className="tile ov-recent">
        <div className="tile-head"><h2>Recent activity</h2>{activity.length>0&&<button type="button" className="text-link" onClick={()=>goTo('transactions',{month:''})}>See all</button>}</div>
        {activity.length?activity.map(t=><div className="activity-row" key={t.id}><TypeChip type={t.type}/><span><span className="row-title">{transactionName(t)}</span><span className="row-meta">{activityMeta(t)}</span></span><SignedAmount transaction={t} currency={currency}/></div>):<div className="empty">No activity yet. Add your first transaction.</div>}
      </section>
      <section className="tile tile-lilac ov-wallet">
        <div className="tile-head"><h2>Your accounts</h2><button type="button" className="text-link" onClick={()=>goTo('accounts')}>Manage</button></div>
        {active.length?<Wallet accounts={active} currency={currency}/>:<div className="empty">{isLoading?'Loading accounts…':'Add an account to get started.'}</div>}
      </section>
    </div>
  </>
}
