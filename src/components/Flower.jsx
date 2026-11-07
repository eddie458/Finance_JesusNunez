import { useState } from 'react'
import { flowerBounds, petals } from '../lib/flower'
import { plainMoney } from '../lib/money'

// Plum reads better on the bright petals and white on the deep ones.
const INK = { '#7941db':'#ffffff', '#3b9168':'#24112f', '#e055bd':'#24112f', '#de5200':'#24112f', '#009af9':'#24112f', '#d4ac00':'#24112f' }

export function Flower({ items, surface='#24112f', active=null, onActive, title }) {
  const flower=petals(items)
  return <svg className={`flower${active?' has-active':''}`} viewBox={flowerBounds(flower)} role={title?'img':undefined} aria-label={title} aria-hidden={title?undefined:true}>
    {flower.map((p,i)=><g key={p.name} transform={`rotate(${p.rotate})`}><path className={`petal${active===p.name?' active':''}`} d={p.d} fill={p.color} stroke={surface} strokeWidth="3" strokeLinejoin="round" style={{'--i':i}} onPointerEnter={onActive&&(()=>onActive(p.name))} onPointerLeave={onActive&&(()=>onActive(null))}/></g>)}
    <circle r="11" fill={surface}/><circle r="8" fill="#ffd66e"/>
    {title&&flower.filter(p=>p.labelled||p.name===active).map(p=><text key={p.name} className={`flower-label${p.labelled?' opening':''}`} x={p.labelX} y={p.labelY} textAnchor="middle" dominantBaseline="central" fontSize={p.labelled?Math.min(20,Math.max(15,p.length/6.8)):14} fill={INK[p.color]||'#24112f'}>{p.share}%</text>)}
  </svg>
}

const describe = items => { const total=items.reduce((s,i)=>s+i.cents,0); return `Spending as a flower. Each petal is a category and its area shows how much it cost: ${items.map(i=>`${i.name} ${Math.round(i.cents*100/total)} percent`).join(', ')}.` }

// The legend names every petal, so the flower never relies on color or size alone.
export function SpendingFlower({ items, currency, surface, shares=false }) {
  const [active,setActive]=useState(null); const total=items.reduce((s,i)=>s+i.cents,0)
  return <div className="flower-layout"><Flower items={items} surface={surface} active={active} onActive={setActive} title={describe(items)}/><ul className="flower-legend">{items.map(i=><li key={i.name} className={active===i.name?'active':''} onPointerEnter={()=>setActive(i.name)} onPointerLeave={()=>setActive(null)}><span className="dot" style={{'--key':i.color}}/><span className="name" title={i.name}>{i.name}</span><span className="value">{plainMoney(i.cents,currency)}</span>{shares&&<span className="share">{Math.round(i.cents*100/total)}%</span>}</li>)}</ul></div>
}

const BUD = [1,1,1,1,1,1].map((cents,i)=>({name:String(i),cents,color:'transparent'}))

export function EmptyFlower({ surface, children }) {
  return <div className="flower-empty"><Flower items={BUD} surface={surface}/><p>{children}</p></div>
}
