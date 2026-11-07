// Six category colors in a fixed order, and any two can end up side by side, because a color follows its category while petals sort by amount.
// Across all pairs they pass the dataviz palette checks: worst CVD ΔE 11.1, normal-vision ΔE 21.3. Each is at least 3:1 on plum and on white,
// except gold on white (2.1:1), which always appears with a legend and a table view. Gold is also brighter than the checks ask for on plum,
// because any darker and it matches the orange for people with red-green color blindness.
export const SERIES = ['#de5200', '#009af9', '#e055bd', '#d4ac00', '#7941db']
export const OTHER = '#3b9168'

// The biggest five categories keep slots 1–5 everywhere they appear, and the rest share Other, including a category that is itself called Other.
export function categoryColors(trendRows) {
  const totals={}; for (const r of trendRows) totals[r.category]=(totals[r.category]||0)+Number(r.total_cents)
  const top=Object.keys(totals).filter(name=>name!=='Other').sort((a,b)=>totals[b]-totals[a]).slice(0,SERIES.length)
  const slots=Object.fromEntries(top.map((name,i)=>[name,SERIES[i]]))
  return { top, colorOf:name=>slots[name]??OTHER }
}

// One entry per named category, biggest first, with everything else folded into a single Other.
export function foldCategories(categories, { top, colorOf }) {
  const named=categories.filter(c=>top.includes(c.name)).map(c=>({...c,color:colorOf(c.name)}))
  const rest=categories.filter(c=>!top.includes(c.name)).reduce((sum,c)=>sum+c.cents,0)
  return [...named,...(rest>0?[{name:'Other',cents:rest,color:OTHER}]:[])].sort((a,b)=>b.cents-a.cents)
}
