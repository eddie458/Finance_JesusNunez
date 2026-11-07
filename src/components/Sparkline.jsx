import { useState } from 'react'
import { plainMoney } from '../lib/money'
import { monthName } from '../lib/dates'

const WIDTH = 700, HEIGHT = 96, INSET = 10
const round = v => Math.round(v*10)/10

function smoothPath(pts) {
  let d=`M${round(pts[0].x)} ${round(pts[0].y)}`
  for (let i=0; i<pts.length-1; i++) {
    const p0=pts[Math.max(i-1,0)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(i+2,pts.length-1)]
    d+=` C${round(p1.x+(p2.x-p0.x)/6)} ${round(p1.y+(p2.y-p0.y)/6)} ${round(p2.x-(p3.x-p1.x)/6)} ${round(p2.y-(p3.y-p1.y)/6)} ${round(p2.x)} ${round(p2.y)}`
  }
  return d
}

export function Sparkline({ points, currency }) {
  const [hover,setHover]=useState(null)
  if (points.length<2) return null
  const values=points.map(p=>p.cents); const low=Math.min(...values), high=Math.max(...values), range=high-low||1
  const pts=points.map((p,i)=>({...p,x:INSET+i*(WIDTH-INSET*2)/(points.length-1),y:HEIGHT-12-(p.cents-low)/range*(HEIGHT-24)}))
  const dot=pts[hover??pts.length-1]; const left=`${dot.x/WIDTH*100}%`; const top=`calc(14px + ${dot.y/HEIGHT*96}px)`
  const move=e=>{const box=e.currentTarget.getBoundingClientRect();setHover(Math.max(0,Math.min(pts.length-1,Math.round((e.clientX-box.left)/box.width*(pts.length-1)))))}
  const first=points[0], last=points.at(-1)
  return <div className="spark" onPointerMove={move} onPointerLeave={()=>setHover(null)}>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`Net balance over the last ${points.length} months, from ${plainMoney(first.cents,currency)} to ${plainMoney(last.cents,currency)}.`}><path className="spark-line" d={smoothPath(pts)}/></svg>
    <span className={`spark-label${pts[0].y>HEIGHT/2?' above':''}`}>Last {points.length} months</span>
    <span className="spark-dot" style={{left,top}}/>
    {hover!==null&&<span className="spark-tip" style={{left:`clamp(70px, ${left}, calc(100% - 70px))`,top:`calc(${dot.y/HEIGHT*96}px - 28px)`,bottom:'auto'}}>{monthName(dot.month)} · {plainMoney(dot.cents,currency)}</span>}
  </div>
}
