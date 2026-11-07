import { useState } from 'react'
import { ComposedChart, Bar, Cell, Line, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useCashflow, useInsightTransactions } from '../../api/insights'
import { plainMoney } from '../../lib/money'
import { localToday, shiftMonth, monthRange, daysInMonth, monthName, monthShort } from '../../lib/dates'
import { Amount } from '../ui'
import { ChartCard, ChartTooltip, Legend, CHART, COLORS, axisTick, compactMoney } from './chartKit'
import { ReviewPanel } from './Review'

const MONTHS = 12

export function CashFlow({ currency, review }) {
  const thisMonth=localToday().slice(0,7); const first=shiftMonth(thisMonth,-(MONTHS-1)); const [selected,setSelected]=useState(null)
  const {data:flow,isLoading}=useCashflow({from:`${first}-01`,to:`${thisMonth}-${daysInMonth(thisMonth)}`}); const rows=flow??[]; const {data:bucket,isLoading:bucketLoading,error:bucketError}=useInsightTransactions({group_by:'month',label:selected??'',flow:1},selected!==null)
  const byMonth=Object.fromEntries(rows.map(r=>[r.month,r]))
  const data=monthRange(rows[0]?.month??thisMonth,thisMonth).map(month=>{const income=Number(byMonth[month]?.income_cents||0), spent=Number(byMonth[month]?.expense_cents||0); return {month,incomeCents:income,spentCents:spent,income:income/100,expenses:spent/100,saved:(income-spent)/100}})
  // Averages use complete months so a half-finished month doesn't drag them down.
  const full=data.filter(d=>d.month<thisMonth); const basis=full.length?full:data; const sum=key=>basis.reduce((s,d)=>s+d[key],0)
  const avgIncome=Math.round(sum('incomeCents')/basis.length), avgSpent=Math.round(sum('spentCents')/basis.length), rate=sum('incomeCents')>0?Math.round((sum('incomeCents')-sum('spentCents'))*100/sum('incomeCents')):null
  const basisNote=full.length?`Monthly average, last ${full.length} full month${full.length===1?'':'s'}`:'This month so far'
  const money=v=>plainMoney(Math.round(v*100),currency); const dim=d=>selected!==null&&d.month!==selected?0.35:1
  const table={columns:[{key:'month',label:'Month'},{key:'income',label:'Income',align:'right'},{key:'expenses',label:'Expenses',align:'right'},{key:'saved',label:'Saved',align:'right'}],rows:data.map(d=>({month:monthName(d.month),income:plainMoney(d.incomeCents,currency),expenses:plainMoney(d.spentCents,currency),saved:plainMoney(d.incomeCents-d.spentCents,currency)}))}
  return <>
    {rows.length>0&&<>
      <section className="tile tile-mint flow-stat t-4 fit"><p className="stat-label">Income</p><p className="stat-value"><Amount cents={avgIncome} currency={currency}/></p><p className="stat-note">{basisNote}</p></section>
      <section className="tile tile-butter flow-stat t-4 fit"><p className="stat-label">Spending</p><p className="stat-value"><Amount cents={avgSpent} currency={currency}/></p><p className="stat-note">{basisNote}</p></section>
      <section className="tile tile-coral flow-stat t-4 fit"><p className="stat-label">Saved</p><p className="stat-value"><Amount cents={avgIncome-avgSpent} currency={currency}/></p><p className="stat-note">{rate===null?'No income recorded yet':rate>=0?`You keep ${rate}% of what you earn`:'You’re spending more than you earn'}</p></section>
    </>}
    <ChartCard className="t-12" title="Income vs. expenses" description="What came in, what went out, and what you kept each month. Select a month to review its transactions." legend={rows.length?<Legend items={[{label:'Income',color:COLORS.income},{label:'Expenses',color:COLORS.expenses},{label:'Saved',color:COLORS.saved,kind:'line'}]}/>:null} table={rows.length?table:null}>
      {isLoading?<div className="empty">Following the money…</div>:!rows.length?<div className="empty">Record income and expenses to compare them month by month.</div>:<div className="chart-box"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} barGap={2} margin={{top:12,right:8,left:0,bottom:4}} style={{cursor:'pointer'}} onClick={state=>state?.activeLabel!==undefined&&setSelected(m=>m===state.activeLabel?null:state.activeLabel)}><CartesianGrid vertical={false} stroke={CHART.grid}/><XAxis dataKey="month" tickLine={false} axisLine={{stroke:CHART.axis}} tick={axisTick} tickFormatter={monthShort}/><YAxis tickLine={false} axisLine={false} tick={axisTick} width={52} tickFormatter={v=>compactMoney(v,currency)}/>{data.some(d=>d.saved<0)&&<ReferenceLine y={0} stroke={CHART.axis}/>}<Tooltip cursor={{fill:CHART.cursor}} content={<ChartTooltip formatLabel={monthName} formatValue={money}/>}/><Bar dataKey="income" name="Income" fill={COLORS.income} maxBarSize={18} radius={[5,5,0,0]}>{data.map(d=><Cell key={d.month} fillOpacity={dim(d)}/>)}</Bar><Bar dataKey="expenses" name="Expenses" fill={COLORS.expenses} maxBarSize={18} radius={[5,5,0,0]}>{data.map(d=><Cell key={d.month} fillOpacity={dim(d)}/>)}</Bar><Line dataKey="saved" name="Saved" stroke={COLORS.saved} strokeWidth={2} strokeLinecap="round" dot={{r:4,fill:COLORS.saved,stroke:CHART.surface,strokeWidth:2}} activeDot={{r:5,stroke:CHART.surface,strokeWidth:2}}/></ComposedChart></ResponsiveContainer></div>}
    </ChartCard>
    {selected!==null&&<ReviewPanel className="t-12" title={monthName(selected)} noun="transaction" transactions={bucket??[]} loading={bucketLoading} error={bucketError} onClose={()=>setSelected(null)} review={review} currency={currency} focusKey={selected}/>}
  </>
}
