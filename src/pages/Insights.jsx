import { useState } from 'react'
import { useMe } from '../api/auth'
import { useReview, HiddenList } from '../components/insights/Review'
import { SpendingBreakdown } from '../components/insights/SpendingBreakdown'
import { SpendingPace } from '../components/insights/SpendingPace'
import { CategorySpending } from '../components/insights/CategorySpending'
import { CashFlow } from '../components/insights/CashFlow'
import { NetWorth } from '../components/insights/NetWorth'
import { CreditCardUse } from '../components/insights/CreditCardUse'

const TABS = [{ id:'spending', label:'Spending' },{ id:'cashflow', label:'Cash flow' },{ id:'cards', label:'Cards' }]

export function Insights() {
  const {data:user}=useMe(); const currency=user?.base_currency; const review=useReview(); const [tab,setTab]=useState('spending')
  return <><div className="page-head"><div><p className="eyebrow">Patterns & progress</p><h1>Insights</h1><p className="subtle">Spending, cash flow, and credit cards. Transfers between your accounts never inflate the numbers.</p></div></div><div className="segmented" role="tablist" aria-label="Insight sections">{TABS.map(t=><button key={t.id} type="button" role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div><div className="insight-stack" role="tabpanel">{tab==='spending'&&<><SpendingBreakdown currency={currency} review={review}/><SpendingPace currency={currency}/><CategorySpending currency={currency}/></>}{tab==='cashflow'&&<><CashFlow currency={currency} review={review}/><NetWorth currency={currency}/></>}{tab==='cards'&&<CreditCardUse currency={currency}/>}{tab!=='cards'&&<HiddenList review={review} currency={currency}/>}</div></>
}
