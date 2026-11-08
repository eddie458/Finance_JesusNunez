import { flowerBounds, petals } from '../lib/flower'

// The sign-in page's decoration. Spending itself is drawn as a pie.
export function Flower({ items, surface='#24112f' }) {
  const flower=petals(items)
  return <svg className="flower" viewBox={flowerBounds(flower)} aria-hidden="true">
    {flower.map((p,i)=><g key={p.name} transform={`rotate(${p.rotate})`}><path className="petal" d={p.d} fill={p.color} stroke={surface} strokeWidth="3" strokeLinejoin="round" style={{'--i':i}}/></g>)}
    <circle r="11" fill={surface}/><circle r="8" fill="#ffd66e"/>
  </svg>
}
