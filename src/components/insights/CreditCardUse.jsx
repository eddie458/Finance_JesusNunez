import { AlertOctagon, AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react'
import { useCreditCards } from '../../api/insights'
import { formatCents } from '../../lib/money'
import { localToday, shortDate } from '../../lib/dates'
import { SERIES } from './chartKit'

// The meter fill carries severity; each level pairs its color with an icon and a word.
const LEVELS = { good:{label:'Healthy',icon:CheckCircle2,fill:SERIES[0],track:'#f8dccd'}, warning:{label:'Getting high',icon:AlertTriangle,fill:'#fab219',track:'#fdecc6'}, critical:{label:'Near the limit',icon:AlertOctagon,fill:'#d03b3b',track:'#f6d4d4'} }
const daysAway = (date, today) => { const days=Math.round((new Date(`${date}T12:00:00`)-new Date(`${today}T12:00:00`))/86400000); return days===0?'today':days===1?'tomorrow':days>0?`in ${days} days`:`${-days} day${days===-1?'':'s'} ago` }

function payment(card, today, money) {
  const last=card.last_statement, next=card.current_cycle
  if (last.due_on>=today&&last.remaining_cents>0) return {tone:'due',icon:CalendarClock,title:`Pay ${money(last.remaining_cents)} by ${shortDate(last.due_on)}`,note:`Due ${daysAway(last.due_on,today)} · statement closed ${shortDate(last.end)}`}
  if (last.due_on<today&&last.remaining_cents>0) return {tone:'overdue',icon:AlertTriangle,title:`${money(last.remaining_cents)} was due ${shortDate(last.due_on)}`,note:'Record a payment to this card once you’ve paid it.'}
  const paid=last.owed_cents>0&&last.due_on>=today
  return {tone:paid?'paid':'clear',icon:paid?CheckCircle2:CalendarClock,title:paid?'Latest statement paid':`Next payment due ${shortDate(next.due_on)}`,note:paid?`Next payment due ${shortDate(next.due_on)} · statement closes ${shortDate(next.end)}`:`Statement closes ${shortDate(next.end)} · due ${daysAway(next.due_on,today)}`}
}

function UseMeter({ name, owed, limit, money }) {
  const use=limit>0?owed/limit:0; const level=use>=0.7?'critical':use>=0.3?'warning':'good'; const {label,icon:Icon,fill,track}=LEVELS[level]; const pct=Math.round(use*100)
  return <><div className="credit-use-figure"><div><span className="use-value">{pct}%</span><span className="use-label">of your limit used</span></div><span className={`status-chip ${level}`}><Icon size={13}/>{use>1?'Over the limit':label}</span></div><div className="meter" role="meter" aria-label={`${name} credit used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{'--fill':fill,'--track':track}}><span style={{width:`${Math.min(100,pct)}%`}}/></div><div className="meter-labels"><span>Owed {money(owed)}</span><span>{money(Math.max(0,limit-owed))} available</span></div></>
}

export function CreditCardUse({ currency }) {
  const today=localToday(); const {data:cards=[],isLoading}=useCreditCards(today); const money=cents=>formatCents(cents,currency)
  if (isLoading) return <div className="card empty">Checking your cards…</div>
  if (!cards.length) return <div className="card empty">Add a credit card on the Accounts page to track its limit and payment dates here.</div>
  const owedOf=c=>Math.max(0,-c.balance_cents); const totalOwed=cards.reduce((s,c)=>s+owedOf(c),0); const totalLimit=cards.reduce((s,c)=>s+c.credit_limit_cents,0)
  return <>{cards.length>1&&<section className="card credit-use"><div className="section-title">All cards</div><p className="section-description">Everything you owe across your {cards.length} credit cards.</p><UseMeter name="All cards" owed={totalOwed} limit={totalLimit} money={money}/></section>}<div className="card-grid">{cards.map(card=>{const p=payment(card,today,money);return <article className="card credit-use" key={card.id}><div className="section-title">{card.name}</div><p className="section-description">Limit {money(card.credit_limit_cents)}</p><UseMeter name={card.name} owed={owedOf(card)} limit={card.credit_limit_cents} money={money}/><div className={`payment-box ${p.tone}`}><p.icon size={18}/><div><strong>{p.title}</strong><div className="row-meta">{p.note}</div></div></div></article>})}</div></>
}
