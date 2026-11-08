import { useState } from 'react'
import { useMe } from '../api/auth'
import { useNetWorth } from '../api/insights'
import { localToday, monthName, monthRange } from '../lib/dates'
import { PillSelect } from '../components/ui'
import { useReview, HiddenList } from '../components/insights/Review'
import { Spending } from '../components/insights/Spending'
import { CashFlow } from '../components/insights/CashFlow'
import { NetWorth } from '../components/insights/NetWorth'
import { CreditCardUse } from '../components/insights/CreditCardUse'

const TABS = [{ id:'spending', label:'Spending' },{ id:'cashflow', label:'Cash flow' },{ id:'cards', label:'Cards' }]

// One month drives every chart on Spending and Cash flow. Cards always show the current statement, so they don't take it.
export function Insights() {
  const {data:user}=useMe(); const currency=user?.base_currency; const review=useReview(); const [tab,setTab]=useState('spending')
  const thisMonth=localToday().slice(0,7); const [month,setMonth]=useState(thisMonth); const {data:netWorth}=useNetWorth()
  // Every month with activity, newest first, as the Transactions filter lists them. A chart can also pick an empty month next to them.
  const first=[netWorth?.months?.[0]?.month,thisMonth,month].filter(Boolean).sort()[0], last=[netWorth?.months?.at(-1)?.month,thisMonth,month].filter(Boolean).sort().at(-1)
  const months=monthRange(first,last).reverse().map(m=>({value:m,label:monthName(m)}))
  return <>
    <div className="page-head"><h1>Insights</h1><div className="pill-tabs" role="tablist" aria-label="Insight sections">{TABS.map(t=><button key={t.id} type="button" role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div></div>
    {tab!=='cards'&&<div className="filter-pills month-filter">
      <PillSelect label="Month" value={month} onChange={setMonth} active={month!==thisMonth} options={months}/>
      {month!==thisMonth&&<button type="button" className="text-link clear-filters" onClick={()=>setMonth(thisMonth)}>Back to this month</button>}
    </div>}
    <div className="bento" role="tabpanel" key={tab}>
      {tab==='spending'&&<Spending currency={currency} review={review} month={month} onMonth={setMonth}/>}
      {tab==='cashflow'&&<><CashFlow currency={currency} review={review} month={month} onMonth={setMonth}/><NetWorth currency={currency} month={month} className="t-12"/><HiddenList review={review} currency={currency}/></>}
      {tab==='cards'&&<CreditCardUse currency={currency}/>}
    </div>
  </>
}
