import { useState } from 'react'
import { INK } from '../lib/palette'
import { PIE_BOX, RADIUS, slices } from '../lib/pie'
import { SpendingLegend } from './SpendingLegend'

function Pie({ items, surface, active, onActive }) {
  const pie=slices(items)
  return <svg className={`pie${active?' has-active':''}`} viewBox={PIE_BOX} role="img" aria-label={`Spending as a pie chart: ${pie.map(s=>`${s.name} ${s.label}`).join(', ')}.`}>
    {pie.map((s,i)=><path key={s.name} className={`slice${active===s.name?' active':''}`} d={s.d} fill={s.color} stroke={surface} strokeWidth="2" strokeLinejoin="round" style={{'--i':i}} onPointerEnter={()=>onActive(s.name)} onPointerLeave={()=>onActive(null)}/>)}
    {/* A label too big for its slice lands on its neighbors, so it gets an outline to stay readable on any color. */}
    {pie.filter(s=>s.labelled||s.name===active).map(s=><text key={s.name} className={`pie-label${s.labelled?' opening':''}`} x={s.labelX} y={s.labelY} textAnchor="middle" dominantBaseline="central" fontSize="16" fill={s.labelled?INK[s.color]:'#fff'} stroke={s.labelled?'none':surface}>{s.label}</text>)}
  </svg>
}

export function SpendingPie({ items, currency, surface }) {
  const [active,setActive]=useState(null)
  return <div className="spend-layout"><Pie items={items} surface={surface} active={active} onActive={setActive}/><SpendingLegend items={items} currency={currency} active={active} onActive={setActive}/></div>
}

export function EmptyPie({ children }) {
  return <div className="pie-empty"><svg className="pie" viewBox={PIE_BOX} aria-hidden="true"><circle r={RADIUS}/></svg><p>{children}</p></div>
}
