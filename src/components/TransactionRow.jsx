import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import { plainMoney } from '../lib/money'

const ICONS = { income:ArrowDownLeft, expense:ArrowUpRight, transfer:ArrowLeftRight }
const SIGNS = { income:'+', expense:'−', transfer:'' }

export const transactionName = t => t.merchant||t.note||(t.type==='transfer'?'Transfer':'No description')
export const transactionKind = t => t.type==='income'?'Income':t.type==='expense'?t.category_name||'Uncategorized':'Transfer'
export const transactionMovement = t => { if(t.type==='transfer')return `${t.from_account_name||'Outside'} → ${t.to_account_name||'Outside'}`; return `${transactionKind(t)} · ${Number(t.is_historical)?'No account':t.from_account_name||t.to_account_name||'Outside'}` }

export function TypeChip({ type }) { const Icon=ICONS[type]; return <span className={`chip ${type}`}><Icon size={19} strokeWidth={2.2} aria-hidden="true"/></span> }

export const SignedAmount = ({ transaction:t, currency }) => <span className={`money ${t.type}`}>{SIGNS[t.type]}{plainMoney(t.amount_cents,currency)}</span>
