import { useMemo, useState } from 'react'
import { Table2, BarChart3 } from 'lucide-react'
import { useCategoryTrends } from '../../api/insights'
import { daysInMonth, localToday, monthRange, monthWindow, shiftMonth } from '../../lib/dates'
import { OTHER, SERIES, categoryColors } from '../../lib/palette'

export { OTHER, SERIES }
// chosen marks the month the page filter is on, a step darker than the hover cursor.
export const CHART = { surface:'#ffffff', grid:'#ece7f6', axis:'#c9c0d6', tick:'#6b5c78', cursor:'#f1eef8', chosen:'#e7e0f7' }
export const ON_LILAC = { surface:'#cdbdfb', grid:'rgba(36,17,47,.12)', axis:'rgba(36,17,47,.32)', tick:'#46356b', cursor:'rgba(36,17,47,.08)' }
export const COLORS = { expenses:SERIES[0], income:SERIES[1], saved:'#24112f', netWorth:'#24112f', context:'#9c90a8' }
export const axisTick = { fontSize:12.5, fontWeight:500, fill:CHART.tick }

const symbols = { MXN:'$', USD:'$', EUR:'€' }
export const compactMoney = (value, currency) => { const n=Number(value)||0; return `${n<0?'−':''}${symbols[String(currency||'MXN').toUpperCase()]||''}${new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(Math.abs(n))}` }

// Round numbers for a value axis, from zero to just past the highest value.
export function axisTicks(highest) {
  if (highest<=0) return [0,1]
  const rough=highest/4; const power=10**Math.floor(Math.log10(rough)); const step=[1,2,2.5,5,10].map(m=>m*power).find(s=>s>=rough)
  return Array.from({length:Math.ceil(highest/step)+1},(_,i)=>i*step)
}

// A year of category totals decides which category owns which color, on every screen.
export const trendFilters = thisMonth => ({ from:`${shiftMonth(thisMonth,-11)}-01`, to:`${thisMonth}-${daysInMonth(thisMonth)}` })
// The months a chart shows. They stay put while the chosen month is among them, so picking a month in the chart never moves it, and move to take in a month chosen outside them.
export function useMonthWindow(month, count) {
  const thisMonth=localToday().slice(0,7); const [end,setEnd]=useState(()=>monthWindow(month,thisMonth,count).at(-1)); const months=monthRange(shiftMonth(end,-(count-1)),end)
  if (months.includes(month)) return months
  const next=monthWindow(month,thisMonth,count); setEnd(next.at(-1)); return next
}
export function useCategoryColors() { const {data}=useCategoryTrends(trendFilters(localToday().slice(0,7))); return useMemo(()=>({...categoryColors(data??[]),ready:Boolean(data)}),[data]) }

export function ChartCard({ title, description, legend, summary, table, children, className='' }) {
  const [showTable,setShowTable]=useState(false)
  return <section className={`tile chart-card ${className}`}><div className="chart-head"><div className="chart-title"><h2>{title}</h2>{description&&<p className="section-description">{description}</p>}{legend}</div><div className={`chart-side${summary?' with-summary':''}`}>{summary}{table&&<div className="chart-actions"><button type="button" className="icon-button" title={showTable?'Show chart':'Show as table'} aria-label={showTable?'Show chart':'Show as table'} aria-pressed={showTable} onClick={()=>setShowTable(v=>!v)}>{showTable?<BarChart3 size={17}/>:<Table2 size={17}/>}</button></div>}</div></div>{showTable&&table?<DataTable {...table}/>:children}</section>
}

export function DataTable({ columns, rows }) {
  const align = c => c.align?{textAlign:c.align}:undefined
  return <div className="table-wrap chart-table"><table className="table"><thead><tr>{columns.map(c=><th key={c.key} style={align(c)}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{columns.map(c=><td key={c.key} style={align(c)}>{row[c.key]}</td>)}</tr>)}</tbody></table></div>
}

export function Legend({ items }) {
  return <ul className="chart-legend">{items.map(item=><li key={item.label}><span className={`legend-key ${item.kind||'bar'}`} style={{'--key':item.color}}/>{item.label}</li>)}</ul>
}

// Values lead and series names follow; rows are keyed with a short line in the series color.
export function ChartTooltip({ active, payload, label, formatLabel, formatValue }) {
  const rows=(payload||[]).filter(p=>p.value!==null&&p.value!==undefined)
  if (!active||!rows.length) return null
  return <div className="chart-tooltip"><div className="chart-tooltip-label">{formatLabel?formatLabel(label,rows):label}</div>{rows.map(p=><div className="chart-tooltip-row" key={p.dataKey??p.name}><span className="legend-key line" style={{'--key':p.color||p.payload?.fill||p.payload?.color}}/><strong>{formatValue(p.value,p)}</strong><span>{p.name}</span></div>)}</div>
}
