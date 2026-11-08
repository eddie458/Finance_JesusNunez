import { useState } from 'react'
import { BarChart, Bar, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useCategoryTrends } from '../../api/insights'
import { plainMoney } from '../../lib/money'
import { foldCategories } from '../../lib/palette'
import { localToday, shiftMonth, monthRange, monthName, monthShort } from '../../lib/dates'
import { SpendingPie } from '../Pie'
import { ChartCard, ChartTooltip, Legend, CHART, OTHER, axisTick, axisTicks, compactMoney, trendFilters, useCategoryColors } from './chartKit'

const MONTHS = 6

export function CategorySpending({ currency, className='' }) {
  const thisMonth=localToday().slice(0,7); const months=monthRange(shiftMonth(thisMonth,-(MONTHS-1)),thisMonth); const [picked,setPicked]=useState(null)
  const {data:trends,isLoading}=useCategoryTrends(trendFilters(thisMonth)); const colors=useCategoryColors(); const rows=(trends??[]).filter(r=>r.month>=months[0])
  const series=[...colors.top.filter(name=>rows.some(r=>r.category===name)).map(name=>({key:`c${colors.top.indexOf(name)}`,name,color:colors.colorOf(name)})),...(rows.some(r=>!colors.top.includes(r.category))?[{key:'other',name:'Other',color:OTHER}]:[])]
  const byMonth=Object.fromEntries(months.map(m=>[m,{month:m,total:0}]))
  for (const r of rows) { const row=byMonth[r.month]; if(!row) continue; const key=series.find(s=>s.name===r.category)?.key??'other'; row[key]=(row[key]||0)+Number(r.total_cents)/100; row.total+=Number(r.total_cents) }
  const data=months.map(m=>byMonth[m]); const selected=picked??[...data].reverse().find(d=>d.total>0)?.month??thisMonth
  const spending=foldCategories(rows.filter(r=>r.month===selected).map(r=>({name:r.category,cents:Number(r.total_cents)})),colors)
  const money=v=>plainMoney(Math.round(v*100),currency); const ticks=axisTicks(Math.max(...data.map(d=>d.total))/100)
  const table={columns:[{key:'month',label:'Month'},...series.map(s=>({key:s.key,label:s.name,align:'right'})),{key:'total',label:'Total',align:'right'}],rows:data.map(d=>({...Object.fromEntries(series.map(s=>[s.key,money(d[s.key]||0)])),month:monthName(d.month),total:plainMoney(d.total,currency)}))}
  return <ChartCard className={className} title="Spending by category" description="The last six months, split by category. Select a month to see where its money went." legend={rows.length?<Legend items={series.map(s=>({label:s.name,color:s.color}))}/>:null} table={rows.length?table:null}>
    {isLoading?<div className="empty">Sorting your categories…</div>:!rows.length?<div className="empty">Add expenses to see how your spending splits across categories.</div>:<div className="category-layout">
      <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:12,right:8,left:0,bottom:4}} style={{cursor:'pointer'}} onClick={state=>state?.activeLabel!==undefined&&setPicked(state.activeLabel)}><CartesianGrid vertical={false} stroke={CHART.grid}/><XAxis dataKey="month" tickLine={false} axisLine={{stroke:CHART.axis}} tick={axisTick} tickFormatter={monthShort}/><YAxis tickLine={false} axisLine={false} tick={axisTick} width={52} ticks={ticks} domain={[0,ticks.at(-1)]} tickFormatter={v=>compactMoney(v,currency)}/><Tooltip cursor={{fill:CHART.cursor}} content={<ChartTooltip formatLabel={monthName} formatValue={money}/>}/>{series.map((s,i)=><Bar key={s.key} dataKey={s.key} name={s.name} stackId="spend" fill={s.color} stroke={CHART.surface} strokeWidth={2} maxBarSize={32} radius={i===series.length-1?[6,6,0,0]:0}>{data.map(d=><Cell key={d.month} fillOpacity={picked===null||d.month===selected?1:0.35}/>)}</Bar>)}</BarChart></ResponsiveContainer></div>
      <div className="category-share"><p className="category-month">{monthName(selected)}</p>{spending.length?<SpendingPie key={selected} items={spending} currency={currency} surface={CHART.surface} ink="#24112f" shares/>:<p className="empty compact">Nothing spent in {monthName(selected)}.</p>}</div>
    </div>}
  </ChartCard>
}
