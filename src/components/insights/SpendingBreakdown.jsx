import { useState } from 'react'
import { BarChart, Bar, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useInsights, useInsightTransactions } from '../../api/insights'
import { formatCents } from '../../lib/money'
import { monthName, monthShort } from '../../lib/dates'
import { ChartCard, ChartTooltip, CHART, SERIES, axisTick, compactMoney } from './chartKit'
import { ReviewPanel } from './Review'

const SELECTED = '#b5461a', DIMMED = '#f3c7ae'

export function SpendingBreakdown({ currency, review }) {
  const [group,setGroup]=useState('month'); const [selected,setSelected]=useState(null)
  const {data:points=[],isLoading}=useInsights({group_by:group}); const {data:bucket=[],isLoading:bucketLoading}=useInsightTransactions({group_by:group,label:selected??''},selected!==null); const {data:hidden=[]}=useInsightTransactions({hidden:1})
  const hiddenExpenses=hidden.filter(t=>t.type==='expense').length; const total=points.reduce((s,p)=>s+Number(p.total_cents),0); const chartData=points.map(p=>({...p,total:Number(p.total_cents)/100})); const highlighted=chartData.some(p=>p.label===selected)?selected:null
  const labelText=label=>group==='month'?monthName(label):label
  const table={columns:[{key:'label',label:group==='month'?'Month':'Category'},{key:'total',label:'Spent',align:'right'}],rows:points.map(p=>({label:labelText(p.label),total:formatCents(p.total_cents,currency)}))}
  return <><div className="insight-summary"><div className="card stat-card"><div className="stat-label">Total spending</div><div className="stat-value">{formatCents(total,currency)}</div><div className="stat-note">{hiddenExpenses?`Across the selected view · ${hiddenExpenses} hidden expense${hiddenExpenses===1?'':'s'} not counted`:'Across the selected view'}</div></div><div className="card insight-group-control"><div className="stat-label">Group expenses</div><select value={group} onChange={e=>{setGroup(e.target.value);setSelected(null)}}><option value="month">By month</option><option value="category">By category</option></select><div className="stat-note">Choose how to organize your expense ledger.</div></div></div>
    <ChartCard title="Expense breakdown" description={`${group==='month'?'Your monthly spending trend.':'Spending grouped by category.'} Select a bar to review the expenses behind it.`} table={table}><div className="chart-box">{isLoading?<div className="empty">Building your chart…</div>:chartData.length?<ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:12,right:8,left:0,bottom:4}} style={{cursor:'pointer'}} onClick={state=>state?.activeLabel!==undefined&&setSelected(label=>label===state.activeLabel?null:state.activeLabel)}><CartesianGrid vertical={false} stroke={CHART.grid}/><XAxis dataKey="label" tickLine={false} axisLine={{stroke:CHART.axis}} tick={axisTick} tickFormatter={group==='month'?monthShort:undefined}/><YAxis tickLine={false} axisLine={false} tick={axisTick} width={52} tickFormatter={v=>compactMoney(v,currency)}/><Tooltip cursor={{fill:CHART.cursor}} content={<ChartTooltip formatLabel={labelText} formatValue={v=>formatCents(Math.round(v*100),currency)}/>}/><Bar dataKey="total" name="Spent" maxBarSize={24} radius={[4,4,0,0]}>{chartData.map(p=><Cell key={p.label} fill={highlighted===null?SERIES[0]:p.label===highlighted?SELECTED:DIMMED}/>)}</Bar></BarChart></ResponsiveContainer>:<div className="empty">{hiddenExpenses?'Every expense is hidden from insights. Switch one back on below.':'Add expenses to see your spending patterns.'}</div>}</div></ChartCard>
    {selected!==null&&<ReviewPanel title={labelText(selected)} description="Switch off any expense you don’t want counted in these charts." transactions={bucket} loading={bucketLoading} onClose={()=>setSelected(null)} review={review} currency={currency}/>}</>
}
