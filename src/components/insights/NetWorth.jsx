import { AreaChart, Area, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useNetWorth } from '../../api/insights'
import { formatCents } from '../../lib/money'
import { localToday, shiftMonth, monthRange, monthName, monthShort } from '../../lib/dates'
import { ChartCard, ChartTooltip, CHART, COLORS, axisTick, compactMoney } from './chartKit'

export function NetWorth({ currency }) {
  const thisMonth=localToday().slice(0,7); const {data,isLoading}=useNetWorth()
  const flows=Object.fromEntries((data?.months||[]).map(r=>[r.month,Number(r.net_cents)])); const firstMonth=data?.months?.[0]?.month
  let running=Number(data?.opening_cents||0)
  const months=monthRange(firstMonth&&firstMonth<thisMonth?firstMonth:thisMonth,thisMonth).map(month=>{running+=flows[month]||0;return {month,cents:running,value:running/100}})
  const points=months.filter(p=>p.month>=shiftMonth(thisMonth,-11)); const current=points.at(-1); const start=points[0]; const change=current&&start?current.cents-start.cents:0
  const table={columns:[{key:'month',label:'Month'},{key:'value',label:'Net worth',align:'right'}],rows:points.map(p=>({month:monthName(p.month),value:formatCents(p.cents,currency)}))}
  return <ChartCard title="Net worth over time" description="Month-end total across all your accounts. It follows real balances, so transactions hidden from insights still count." table={points.length>1?table:null}>{isLoading?<div className="empty">Adding up your accounts…</div>:<><div className="net-worth-figure"><div className="stat-value">{formatCents(current?.cents??0,currency)}</div>{points.length>1&&<div className={`trend-note ${change>=0?'good':'bad'}`}>{change>=0?<ArrowUp size={13}/>:<ArrowDown size={13}/>}{`${change>=0?'Up':'Down'} ${formatCents(Math.abs(change),currency)}${start.cents?` (${Math.round(Math.abs(change)*100/Math.abs(start.cents))}%)`:''} since ${monthName(start.month)}`}</div>}</div>{points.length>1?<div className="chart-box short"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{top:12,right:12,left:0,bottom:4}}><CartesianGrid vertical={false} stroke={CHART.grid}/><XAxis dataKey="month" tickLine={false} axisLine={{stroke:CHART.axis}} tick={axisTick} tickFormatter={monthShort}/><YAxis tickLine={false} axisLine={false} tick={axisTick} width={56} domain={['auto','auto']} tickFormatter={v=>compactMoney(v,currency)}/><Tooltip cursor={{stroke:CHART.axis}} content={<ChartTooltip formatLabel={monthName} formatValue={v=>formatCents(Math.round(v*100),currency)}/>}/><Area dataKey="value" name="Net worth" stroke={COLORS.netWorth} strokeWidth={2} strokeLinecap="round" fill={COLORS.netWorth} fillOpacity={0.1} dot={false} activeDot={{r:4,stroke:CHART.surface,strokeWidth:2}}/><ReferenceDot x={current.month} y={current.value} r={4} fill={COLORS.netWorth} stroke={CHART.surface} strokeWidth={2}/></AreaChart></ResponsiveContainer></div>:<div className="empty">Your net worth line starts once a second month of activity comes in.</div>}</>}</ChartCard>
}
