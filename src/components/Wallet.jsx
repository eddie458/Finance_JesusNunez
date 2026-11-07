import { plainMoney } from '../lib/money'
import { Amount } from './ui'

const ORDER = { savings:0, investment:1, debit:2, cash:3, credit:4 }
const TONES = { savings:'plum', investment:'mint', debit:'coral', cash:'butter', credit:'paper' }
export const accountTone = type => `tile-${TONES[type]||'paper'}`
export const accountType = type => `${type[0].toUpperCase()}${type.slice(1)}`

function creditUse(account) { const limit=Number(account.credit_limit_cents)||0; const owed=Math.max(0,-Number(account.balance_cents)); return { limit, share:limit>0?owed*100/limit:0 } }

export function CreditBar({ account, currency }) {
  const {limit,share}=creditUse(account)
  return <><div className="credit-bar" role="meter" aria-label={`${account.name} credit used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share)}><span style={{width:`${Math.min(100,share)}%`}}/></div><p className="credit-caption">{Math.round(share)}% of your {plainMoney(limit,currency)} limit</p></>
}

// Spending money sits at the back and cards at the front, so what you owe is the first thing you read.
export function Wallet({ accounts, currency }) {
  const cards=[...accounts].sort((a,b)=>ORDER[a.type]-ORDER[b.type]||Number(b.balance_cents)-Number(a.balance_cents))
  return <div className="wallet">{cards.map((a,i)=>{
    const credit=a.type==='credit'
    if (i<cards.length-1) return <div key={a.id} className={`wallet-card ${accountTone(a.type)}`}><div className="wallet-row"><span>{a.name} <span className="wallet-type">{accountType(a.type)}</span></span><span>{plainMoney(a.balance_cents,currency)}</span></div></div>
    return <div key={a.id} className={`wallet-card front fit ${accountTone(a.type)}`}><div className="wallet-row"><span>{a.name} <span className="wallet-type">{accountType(a.type)}</span></span>{credit&&<span className="wallet-note">Due day {a.due_day}</span>}</div><p className="wallet-balance"><Amount cents={a.balance_cents} currency={currency}/></p>{credit&&<CreditBar account={a} currency={currency}/>}</div>
  })}</div>
}
