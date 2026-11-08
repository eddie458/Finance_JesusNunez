import { useState } from 'react'
import { ComposedChart, Bar, Line, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useCashflow, useInsightTransactions } from '../../api/insights'
import { plainMoney } from '../../lib/money'
import { localToday, daysInMonth, monthLabel, monthName, monthShort } from '../../lib/dates'
import { Amount } from '../ui'
import { ChartCard, ChartTooltip, Legend, CHART, COLORS, axisTick, compactMoney, useMonthWindow } from './chartKit'
import { ReviewPanel } from './Review'

const MONTHS = 12

// The tiles show the page's month, with the monthly average for scale. Choosing a month in the chart changes it for the whole page and lists its transactions.
export function CashFlow({ currency, review, month, onMonth }) {
  const thisMonth=localToday().slice(0,7); const months=useMonthWindow(month,MONTHS); const end=months.at(-1); const [reviewing,setReviewing]=useState(false); const [picks,setPicks]=useState(0)
  const {data:flow,isLoading}=useCashflow({from:`${months[0]}-01`,to:`${end}-${daysInMonth(end)}`}); const rows=flow??[]; const {data:bucket,isLoading:bucketLoading,error:bucketError}=useInsightTransactions({group_by:'month',label:month,flow:1},reviewing)
  const byMonth=Object.fromEntries(rows.map(r=>[r.month,r])); const first=rows[0]?.month; const from=first&&first<month?first:month
  const data=months.filter(m=>m>=from).map(m=>{const income=Number(byMonth[m]?.income_cents||0), spent=Number(byMonth[m]?.expense_cents||0); return {month:m,incomeCents:income,spentCents:spent,income:income/100,expenses:spent/100,saved:(income-spent)/100}})
  const chosen=data.find(d=>d.month===month)??{incomeCents:0,spentCents:0}; const saved=chosen.incomeCents-chosen.spentCents; const rate=chosen.incomeCents>0?Math.round(saved*100/chosen.incomeCents):null
  // Averages use complete months so a half-finished month doesn't drag them down.
  const full=data.filter(d=>d.month<thisMonth); const average=key=>full.length?Math.round(full.reduce((s,d)=>s+d[key],0)/full.length):null
  const when=month===thisMonth?'this month':`in ${monthLabel(month,thisMonth)}`; const averageNote=cents=>cents===null?(month===thisMonth?'This month so far':' '):`Monthly average ${plainMoney(cents,currency)}`
  const money=v=>plainMoney(Math.round(v*100),currency)
  function pick(next){onMonth(next);setReviewing(true);setPicks(n=>n+1)}
  const table={columns:[{key:'month',label:'Month'},{key:'income',label:'Income',align:'right'},{key:'expenses',label:'Expenses',align:'right'},{key:'saved',label:'Saved',align:'right'}],rows:data.map(d=>({month:monthName(d.month),income:plainMoney(d.incomeCents,currency),expenses:plainMoney(d.spentCents,currency),saved:plainMoney(d.incomeCents-d.spentCents,currency)}))}
  return <>
    {rows.length>0&&<>
      <section className="tile tile-mint flow-stat t-4 fit"><p className="stat-label">Income {when}</p><p className="stat-value"><Amount cents={chosen.incomeCents} currency={currency}/></p><p className="stat-note">{averageNote(average('incomeCents'))}</p></section>
      <section className="tile tile-butter flow-stat t-4 fit"><p className="stat-label">Spending {when}</p><p className="stat-value"><Amount cents={chosen.spentCents} currency={currency}/></p><p className="stat-note">{averageNote(average('spentCents'))}</p></section>
      <section className="tile tile-coral flow-stat t-4 fit"><p className="stat-label">Saved {when}</p><p className="stat-value"><Amount cents={saved} currency={currency}/></p><p className="stat-note">{rate===null?`No income recorded ${when}`:rate>=0?`You kept ${rate}% of what you earned`:'You spent more than you earned'}</p></section>
    </>}
    <ChartCard className="t-12" title="Income vs. expenses" description="What came in, what went out, and what you kept each month. Select a month to review its transactions." legend={rows.length?<Legend items={[{label:'Income',color:COLORS.income},{label:'Expenses',color:COLORS.expenses},{label:'Saved',color:COLORS.saved,kind:'line'}]}/>:null} table={rows.length?table:null}>
      {isLoading?<div className="empty">Following the money…</div>:!rows.length?<div className="empty">Record income and expenses to compare them month by month.</div>:<div className="chart-box"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} barGap={2} margin={{top:12,right:8,left:0,bottom:4}} style={{cursor:'pointer'}} onClick={state=>state?.activeLabel!==undefined&&pick(state.activeLabel)}><CartesianGrid vertical={false} stroke={CHART.grid}/>{data.some(d=>d.month===month)&&<ReferenceArea x1={month} x2={month} fill={CHART.chosen} fillOpacity={1}/>}<XAxis dataKey="month" tickLine={false} axisLine={{stroke:CHART.axis}} tick={axisTick} tickFormatter={monthShort}/><YAxis tickLine={false} axisLine={false} tick={axisTick} width={52} tickFormatter={v=>compactMoney(v,currency)}/>{data.some(d=>d.saved<0)&&<ReferenceLine y={0} stroke={CHART.axis}/>}<Tooltip cursor={{fill:CHART.cursor}} content={<ChartTooltip formatLabel={monthName} formatValue={money}/>}/><Bar dataKey="income" name="Income" fill={COLORS.income} maxBarSize={18} radius={[5,5,0,0]}/><Bar dataKey="expenses" name="Expenses" fill={COLORS.expenses} maxBarSize={18} radius={[5,5,0,0]}/><Line dataKey="saved" name="Saved" stroke={COLORS.saved} strokeWidth={2} strokeLinecap="round" dot={{r:4,fill:COLORS.saved,stroke:CHART.surface,strokeWidth:2}} activeDot={{r:5,stroke:CHART.surface,strokeWidth:2}}/></ComposedChart></ResponsiveContainer></div>}
    </ChartCard>
    {reviewing&&<ReviewPanel className="t-12" title={monthName(month)} noun="transaction" transactions={bucket??[]} loading={bucketLoading} error={bucketError} onClose={()=>setReviewing(false)} review={review} currency={currency} focusKey={picks}/>}
  </>
}
