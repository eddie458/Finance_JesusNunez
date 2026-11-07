import { useState } from 'react'
import { useMe } from '../api/auth'
import { useReview, HiddenList } from '../components/insights/Review'
import { Spending } from '../components/insights/Spending'
import { CashFlow } from '../components/insights/CashFlow'
import { NetWorth } from '../components/insights/NetWorth'
import { CreditCardUse } from '../components/insights/CreditCardUse'

const TABS = [{ id:'spending', label:'Spending' },{ id:'cashflow', label:'Cash flow' },{ id:'cards', label:'Cards' }]

export function Insights() {
  const {data:user}=useMe(); const currency=user?.base_currency; const review=useReview(); const [tab,setTab]=useState('spending')
  return <>
    <div className="page-head"><h1>Insights</h1><div className="pill-tabs" role="tablist" aria-label="Insight sections">{TABS.map(t=><button key={t.id} type="button" role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div></div>
    <div className="bento" role="tabpanel" key={tab}>
      {tab==='spending'&&<Spending currency={currency} review={review}/>}
      {tab==='cashflow'&&<><CashFlow currency={currency} review={review}/><NetWorth currency={currency} className="t-12"/><HiddenList review={review} currency={currency}/></>}
      {tab==='cards'&&<CreditCardUse currency={currency}/>}
    </div>
  </>
}
