import { monthRange, shiftMonth } from './dates.js'

// Month-end totals for the last 12 months: opening balances plus every month's net change.
export function netWorthPoints(data, thisMonth) {
  const flows=Object.fromEntries((data?.months||[]).map(r=>[r.month,Number(r.net_cents)])); const firstMonth=data?.months?.[0]?.month; let running=Number(data?.opening_cents||0)
  return monthRange(firstMonth&&firstMonth<thisMonth?firstMonth:thisMonth,thisMonth).map(month=>{running+=flows[month]||0;return {month,cents:running,value:running/100}}).filter(p=>p.month>=shiftMonth(thisMonth,-11))
}
