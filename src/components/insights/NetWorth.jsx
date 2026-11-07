import { AreaChart, Area, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useNetWorth } from '../../api/insights'
import { plainMoney } from '../../lib/money'
import { localToday, monthName, monthShort } from '../../lib/dates'
import { netWorthPoints } from '../../lib/netWorth'
import { Amount } from '../ui'
import { ChartCard, ChartTooltip, COLORS, ON_LILAC, axisTick, compactMoney } from './chartKit'

const tick = { ...axisTick, fill:ON_LILAC.tick }

export function NetWorth({ currency, className='' }) {
  const thisMonth=localToday().slice(0,7); const {data,isLoading}=useNetWorth(); const points=netWorthPoints(data,thisMonth); const current=points.at(-1); const start=points[0]; const change=current&&start?current.cents-start.cents:0
  const table={columns:[{key:'month',label:'Month'},{key:'value',label:'Net worth',align:'right'}],rows:points.map(p=>({month:monthName(p.month),value:plainMoney(p.cents,currency)}))}
  return <ChartCard className={`tile-lilac fit ${className}`} title="Net worth over time" description="Month-end total across all your accounts. It follows real balances, so transactions hidden from insights still count." table={points.length>1?table:null}>
    {isLoading?<div className="empty">Adding up your accounts…</div>:<><div className="net-worth-figure"><Amount cents={current?.cents??0} currency={currency}/>{points.length>1&&<div className="trend-note">{change>=0?<ArrowUp size={14}/>:<ArrowDown size={14}/>}{`${change>=0?'Up':'Down'} ${plainMoney(Math.abs(change),currency)}${start.cents?` (${Math.round(Math.abs(change)*100/Math.abs(start.cents))}%)`:''} since ${monthName(start.month)}`}</div>}</div>{points.length>1?<div className="chart-box short"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{top:12,right:12,left:0,bottom:4}}><CartesianGrid vertical={false} stroke={ON_LILAC.grid}/><XAxis dataKey="month" tickLine={false} axisLine={{stroke:ON_LILAC.axis}} tick={tick} tickFormatter={monthShort}/><YAxis tickLine={false} axisLine={false} tick={tick} width={56} domain={['auto','auto']} tickFormatter={v=>compactMoney(v,currency)}/><Tooltip cursor={{stroke:ON_LILAC.axis}} content={<ChartTooltip formatLabel={monthName} formatValue={v=>plainMoney(Math.round(v*100),currency)}/>}/><Area dataKey="value" name="Net worth" stroke={COLORS.netWorth} strokeWidth={2.5} strokeLinecap="round" fill={COLORS.netWorth} fillOpacity={0.12} dot={false} activeDot={{r:4,stroke:ON_LILAC.surface,strokeWidth:2}}/><ReferenceDot x={current.month} y={current.value} r={5} fill={COLORS.netWorth} stroke={ON_LILAC.surface} strokeWidth={2}/></AreaChart></ResponsiveContainer></div>:<div className="empty">Your net worth line starts once a second month of activity comes in.</div>}</>}
  </ChartCard>
}
