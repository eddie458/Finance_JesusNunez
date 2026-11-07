import { ComposedChart, Area, Line, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useInsights } from '../../api/insights'
import { plainMoney } from '../../lib/money'
import { localToday, shiftMonth, daysInMonth, monthLong, monthName } from '../../lib/dates'
import { Amount } from '../ui'
import { ChartCard, ChartTooltip, Legend, CHART, COLORS, axisTick, axisTicks, compactMoney } from './chartKit'

const wholeMoney = (cents, currency) => plainMoney(cents,currency).replace(/\.\d\d$/, '')
const EndLabel = ({ viewBox, text, fill, anchor='start', dx=0, dy=0 }) => <text x={viewBox.x+dx} y={viewBox.y+dy} textAnchor={anchor} fill={fill} fontSize="14" fontWeight="700">{text}</text>

export function SpendingPace({ currency, className='' }) {
  const today=localToday(); const thisMonth=today.slice(0,7); const lastMonth=shiftMonth(thisMonth,-1); const todayDay=Number(today.slice(8)); const lastDays=daysInMonth(lastMonth); const length=Math.max(daysInMonth(thisMonth),lastDays)
  const {data,isLoading}=useInsights({group_by:'day',from:`${lastMonth}-01`,to:`${thisMonth}-${daysInMonth(thisMonth)}`})
  const byDay=Object.fromEntries((data??[]).map(d=>[d.label,Number(d.total_cents)])); const rows=[]; let spent=0, last=0, lastSoFar=0
  for (let day=1; day<=length; day++) { const dd=String(day).padStart(2,'0'); if(day<=lastDays)last+=byDay[`${lastMonth}-${dd}`]||0; if(day<=todayDay)spent+=byDay[`${thisMonth}-${dd}`]||0; if(day===Math.min(todayDay,lastDays))lastSoFar=last; rows.push({day,this:day<=todayDay?spent/100:null,last:day<=lastDays?last/100:null}) }
  const diff=spent-lastSoFar; const money=v=>plainMoney(Math.round(v*100),currency); const against=`this day in ${monthLong(lastMonth)}`
  const trend=!spent&&!lastSoFar?null:diff>0?{tone:'bad',icon:ArrowUp,text:`${plainMoney(diff,currency)} more than ${against}`}:diff<0?{tone:'good',icon:ArrowDown,text:`${plainMoney(-diff,currency)} less than ${against}`}:{tone:'',icon:null,text:`Same as ${against}`}
  const table={columns:[{key:'day',label:'Day'},{key:'this',label:monthName(thisMonth),align:'right'},{key:'last',label:monthName(lastMonth),align:'right'}],rows:rows.map(d=>({day:d.day,this:d.this===null?'—':money(d.this),last:d.last===null?'—':money(d.last)}))}
  const nearEnd=todayDay>length-6; const ticks=axisTicks(Math.max(spent,last)/100)
  return <ChartCard className={className} title="This month’s pace" legend={<Legend items={[{label:monthLong(thisMonth),color:COLORS.expenses,kind:'line'},{label:monthLong(lastMonth),color:COLORS.context,kind:'line'}]}/>} table={table} summary={<div className="chart-summary"><Amount cents={spent} currency={currency}/>{trend&&<div className={`trend-note ${trend.tone}`}>{trend.icon&&<trend.icon size={14}/>}{trend.text}</div>}</div>}>
    <div className="chart-box">{isLoading?<div className="empty">Adding up your days…</div>:spent||last?<ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{top:26,right:14,left:0,bottom:4}}><CartesianGrid vertical={false} stroke={CHART.grid}/><XAxis dataKey="day" tickLine={false} axisLine={{stroke:CHART.axis}} tick={axisTick} ticks={[1,8,15,22,29]}/><YAxis tickLine={false} axisLine={false} tick={axisTick} width={52} ticks={ticks} domain={[0,ticks.at(-1)]} tickFormatter={v=>compactMoney(v,currency)}/><Tooltip cursor={{stroke:CHART.axis}} content={<ChartTooltip formatLabel={day=>`Day ${day}`} formatValue={money}/>}/><Line dataKey="last" name={monthLong(lastMonth)} stroke={COLORS.context} strokeWidth={2} strokeLinecap="round" dot={false} activeDot={{r:4,stroke:CHART.surface,strokeWidth:2}}/><Area dataKey="this" name={monthLong(thisMonth)} stroke={COLORS.expenses} strokeWidth={2.5} strokeLinecap="round" fill={COLORS.expenses} fillOpacity={0.14} dot={false} activeDot={{r:4,stroke:CHART.surface,strokeWidth:2}}/>{last>0&&<ReferenceDot x={lastDays} y={last/100} r={0} stroke="none" label={<EndLabel text={wholeMoney(last,currency)} fill={CHART.tick} anchor="end" dy={-8}/>}/>}<ReferenceDot x={todayDay} y={spent/100} r={6} fill={COLORS.expenses} stroke={CHART.surface} strokeWidth={2} label={<EndLabel text={wholeMoney(spent,currency)} fill="#24112f" anchor={nearEnd?'end':'start'} dx={nearEnd?-6:14} dy={diff>0?-10:30}/>}/></ComposedChart></ResponsiveContainer>:<div className="empty">No spending recorded this month or last month yet.</div>}</div>
  </ChartCard>
}
