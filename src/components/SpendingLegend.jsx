import { plainMoney } from '../lib/money'

// The legend names every category, so a chart never relies on color or size alone.
export function SpendingLegend({ items, currency, active, onActive, shares=false }) {
  const total=items.reduce((s,i)=>s+i.cents,0)
  return <ul className="spend-legend">{items.map(i=><li key={i.name} className={active===i.name?'active':''} onPointerEnter={()=>onActive(i.name)} onPointerLeave={()=>onActive(null)}><span className="dot" style={{'--key':i.color}}/><span className="name" title={i.name}>{i.name}</span><span className="value">{plainMoney(i.cents,currency)}</span>{shares&&<span className="share">{Math.round(i.cents*100/total)}%</span>}</li>)}</ul>
}
