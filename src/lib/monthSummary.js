import { daysInMonth, shiftMonth } from './dates.js'

const total = rows => rows.reduce((sum,t)=>sum+Number(t.amount_cents),0)

// What the Overview shows for one month, from that month's and the previous month's transactions.
// Transactions hidden from insights count here, because the Overview follows the ledger.
export function monthSummary(rows, month, today) {
  const previous=shiftMonth(month,-1); const inMonth=key=>rows.filter(t=>t.occurred_on.startsWith(key)); const current=inMonth(month)
  const spent=current.filter(t=>t.type==='expense'); const earlier=inMonth(previous).filter(t=>t.type==='expense')
  const byCategory={}; for (const t of spent) { const name=t.category_name||'Uncategorized'; byCategory[name]=(byCategory[name]||0)+Number(t.amount_cents) }
  // A month in progress is compared day for day with the one before. A finished month is compared whole.
  const inProgress=today.startsWith(month); const cutoff=Math.min(Number(today.slice(8)),daysInMonth(previous))
  const soFar=total(inProgress?spent.filter(t=>t.occurred_on<=today):spent); const before=total(inProgress?earlier.filter(t=>Number(t.occurred_on.slice(8))<=cutoff):earlier)
  return { spent:total(spent), income:total(current.filter(t=>t.type==='income')), count:spent.length, categories:Object.entries(byCategory).map(([name,cents])=>({name,cents})).sort((a,b)=>b.cents-a.cents), change:earlier.length?{cents:soFar-before,month:previous,sameDay:inProgress}:null }
}
