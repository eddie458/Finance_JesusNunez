export const RADIUS = 100 // in the pie's own units
export const PIE_BOX = '-102 -102 204 204'
const SMALLEST = 4 // degrees, so a tiny category stays visible
const LABEL_FROM = 30 // degrees, narrower slices are too thin to hold a percentage
const round = v => Math.round(v*10)/10
const rim = degrees => { const a=degrees*Math.PI/180; return `${round(RADIUS*Math.sin(a))} ${round(-RADIUS*Math.cos(a))}` }

// Plain rounding would print 100% beside a slice that is also on the chart, and 0% on a slice that cost something.
export const shareLabel = percent => percent<1?'<1%':percent>99&&percent<100?'>99%':`${Math.round(percent)}%`

// Each slice's angle shows its amount, apart from the few degrees that keep a tiny category visible. They run clockwise from 12 o'clock, in the order given.
export function slices(items) {
  const total=items.reduce((sum,i)=>sum+i.cents,0); const angles=items.map(i=>i.cents*360/total); const tiny=angles.filter(a=>a<SMALLEST)
  const scale=(360-tiny.length*SMALLEST)/(360-tiny.reduce((sum,a)=>sum+a,0)); let start=0
  return items.map((item,i)=>{
    const sweep=angles[i]<SMALLEST?SMALLEST:angles[i]*scale; const end=start+sweep; const middle=(start+sweep/2)*Math.PI/180
    // The label sits on the slice's center of mass, which reaches the middle of the pie as a slice fills the circle.
    const half=sweep*Math.PI/360; const reach=2*RADIUS*Math.sin(half)/(3*half)
    const d=sweep>=360?`M0 ${-RADIUS}A${RADIUS} ${RADIUS} 0 1 1 0 ${RADIUS}A${RADIUS} ${RADIUS} 0 1 1 0 ${-RADIUS}Z`:`M0 0L${rim(start)}A${RADIUS} ${RADIUS} 0 ${sweep>180?1:0} 1 ${rim(end)}Z`
    start=end
    return { ...item, d, sweep, label:shareLabel(item.cents*100/total), labelled:sweep>=LABEL_FROM, labelX:round(reach*Math.sin(middle)), labelY:round(-reach*Math.cos(middle)) }
  })
}
