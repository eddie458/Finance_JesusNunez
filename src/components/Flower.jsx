import { useState } from 'react'
import { flowerBounds, petals } from '../lib/flower'
import { INK } from '../lib/palette'
import { SpendingLegend } from './SpendingLegend'

export function Flower({ items, surface='#24112f', active=null, onActive, title }) {
  const flower=petals(items)
  return <svg className={`flower${active?' has-active':''}`} viewBox={flowerBounds(flower)} role={title?'img':undefined} aria-label={title} aria-hidden={title?undefined:true}>
    {flower.map((p,i)=><g key={p.name} transform={`rotate(${p.rotate})`}><path className={`petal${active===p.name?' active':''}`} d={p.d} fill={p.color} stroke={surface} strokeWidth="3" strokeLinejoin="round" style={{'--i':i}} onPointerEnter={onActive&&(()=>onActive(p.name))} onPointerLeave={onActive&&(()=>onActive(null))}/></g>)}
    <circle r="11" fill={surface}/><circle r="8" fill="#ffd66e"/>
    {title&&flower.filter(p=>p.labelled||p.name===active).map(p=><text key={p.name} className={`flower-label${p.labelled?' opening':''}`} x={p.labelX} y={p.labelY} textAnchor="middle" dominantBaseline="central" fontSize={p.labelled?Math.min(20,Math.max(15,p.length/6.8)):14} fill={INK[p.color]||'#24112f'}>{p.share}%</text>)}
  </svg>
}

const describe = items => { const total=items.reduce((s,i)=>s+i.cents,0); return `Spending as a flower. Each petal is a category and its area shows how much it cost: ${items.map(i=>`${i.name} ${Math.round(i.cents*100/total)} percent`).join(', ')}.` }

export function SpendingFlower({ items, currency, surface, shares=false }) {
  const [active,setActive]=useState(null)
  return <div className="spend-layout"><Flower items={items} surface={surface} active={active} onActive={setActive} title={describe(items)}/><SpendingLegend items={items} currency={currency} active={active} onActive={setActive} shares={shares}/></div>
}
