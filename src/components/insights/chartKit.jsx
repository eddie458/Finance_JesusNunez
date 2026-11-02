import { useState } from 'react'
import { Table2, BarChart3 } from 'lucide-react'
import { formatCents } from '../../lib/money'

// Categorical slots, in this fixed order, pass the dataviz palette checks against the card surface:
// worst adjacent CVD ΔE 20.6, normal-vision ΔE 21.3, every slot at least 3:1 contrast.
export const SERIES = ['#dd6431', '#2a78d6', '#3f9464', '#6250d6', '#e34948']
export const OTHER = '#cdbba3'
export const CHART = { surface:'#fdf6ea', grid:'#efe3cf', axis:'#d9c6aa', tick:'#a4886f', cursor:'#f6ead8' }
export const COLORS = { expenses:SERIES[0], income:SERIES[1], saved:SERIES[2], netWorth:SERIES[3], context:'#c7b49b' }
export const axisTick = { fontSize:12, fill:CHART.tick }

const symbols = { MXN:'$', USD:'$', EUR:'€' }
export const compactMoney = (value, currency) => { const n=Number(value)||0; return `${n<0?'-':''}${symbols[String(currency||'MXN').toUpperCase()]||''}${new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(Math.abs(n))}` }
export const plainMoney = (cents, currency) => formatCents(cents, currency).replace(/\s[A-Z]{3}$/, '')

export function ChartCard({ title, description, actions, table, children, className='' }) {
  const [showTable,setShowTable]=useState(false)
  return <section className={`card chart-card ${className}`}><div className="chart-head"><div><div className="section-title">{title}</div>{description&&<p className="section-description">{description}</p>}</div><div className="chart-actions">{actions}{table&&<button type="button" className="icon-button" title={showTable?'Show chart':'Show as table'} aria-label={showTable?'Show chart':'Show as table'} aria-pressed={showTable} onClick={()=>setShowTable(v=>!v)}>{showTable?<BarChart3 size={16}/>:<Table2 size={16}/>}</button>}</div></div>{showTable&&table?<DataTable {...table}/>:children}</section>
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
