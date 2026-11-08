const LONGEST = 136 // in the flower's own units
const SHORTEST = 22 // so a tiny category stays visible
const round = v => Math.round(v*10)/10

const bezier = (a, b, c, d, t) => { const u=1-t; return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d }

// Each petal's area shows its amount, so its length follows the square root. They run clockwise from 12 o'clock, drawn along +x and rotated into place.
export function petals(items) {
  const biggest=Math.max(...items.map(i=>i.cents)); const spread=Math.min(1.6,Math.sqrt(6/items.length))
  return items.map((item,i)=>{
    const length=Math.max(SHORTEST,LONGEST*Math.sqrt(item.cents/biggest)); const near=.55*spread*length, far=.6*spread*length; const turn=i*360/items.length
    const d=`M0 0C${round(.2*length)} ${round(-near)} ${round(length)} ${round(-far)} ${round(length)} 0C${round(length)} ${round(far)} ${round(.2*length)} ${round(near)} 0 0Z`
    return { ...item, d, length, rotate:round(turn-90), curve:[.2*length,near,length,far] }
  })
}

// The tightest box around the petals, so the flower fills its frame whatever shape it takes.
export function flowerBounds(flower, margin=6) {
  let left=0, right=0, top=0, bottom=0
  for (const {curve:[inner,near,length,far],rotate} of flower) {
    const a=rotate*Math.PI/180
    for (const side of [-1,1]) for (let t=0; t<=1; t+=.05) {
      const x=bezier(0,inner,length,length,t), y=side*bezier(0,near,far,0,t); const rx=x*Math.cos(a)-y*Math.sin(a), ry=x*Math.sin(a)+y*Math.cos(a)
      left=Math.min(left,rx); right=Math.max(right,rx); top=Math.min(top,ry); bottom=Math.max(bottom,ry)
    }
  }
  const size=Math.max(right-left,bottom-top)+margin*2
  return `${round((left+right-size)/2)} ${round((top+bottom-size)/2)} ${round(size)} ${round(size)}`
}
