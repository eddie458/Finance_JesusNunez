import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { updateBalance } from '../api/accounts'
import { adjustedAccount, adjustmentCents, balanceFromEntry } from '../lib/adjustment'
import { shortDate, today } from '../lib/dates'
import { parseToCents, plainMoney, signedMoney } from '../lib/money'
import { useEscape } from './ui'

export function BalanceModal({ account, currency, onClose }) {
  useEscape(onClose)
  const queryClient=useQueryClient(); const [value,setValue]=useState(''); const [error,setError]=useState(''); const [saving,setSaving]=useState(false)
  const credit=account.type==='credit'; const current=Number(account.balance_cents); const entered=parseToCents(value); const target=entered===null?null:balanceFromEntry(account,entered); const change=target===null?0:target-current
  const outcome=target!==null&&!change?'That’s already this account’s balance.':`${change?`This records a ${signedMoney(change,currency)} balance adjustment`:'The difference is recorded as a balance adjustment'} dated today. Earlier balances and your spending stay as they are.`
  async function submit(e){e.preventDefault();if(target===null)return setError('Use a valid amount with up to two decimal places.');if(!change)return onClose();setSaving(true);setError('');try{await updateBalance(account.id,{balance_cents:target,occurred_on:today()});await queryClient.invalidateQueries({queryKey:['accounts']});await queryClient.invalidateQueries({queryKey:['transactions']});onClose()}catch(err){setError(err.message)}finally{setSaving(false)}}
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" role="dialog" aria-modal="true" aria-label="Update balance" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Update balance</h2><p className="section-description">{account.name} is at {plainMoney(current,currency)}.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div>
    <div className="form-grid"><div className="field wide"><label htmlFor="new-balance">{credit?'Amount you owe now':'New balance'}</label><input id="new-balance" value={value} onChange={e=>{setValue(e.target.value);setError('')}} placeholder={((credit?-current:current)/100).toFixed(2)} inputMode="decimal" required autoFocus/></div></div>
    <p className="form-help" aria-live="polite">{outcome}</p>
    {error&&<p className="error">{error}</p>}
    <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button" disabled={saving}>{saving?'Saving…':'Update balance'}</button></div>
  </form></div>
}

// An adjustment only means something next to the balance it set, so it can be removed but not rewritten.
export function AdjustmentModal({ transaction:t, currency, onClose, onDelete }) {
  useEscape(onClose)
  const [error,setError]=useState('')
  async function remove(){setError('');try{if(await onDelete(t.id))onClose()}catch(err){setError(err.message)}}
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label="Balance adjustment" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Balance adjustment</h2><p className="section-description">{signedMoney(adjustmentCents(t),currency)} on {adjustedAccount(t)}, {shortDate(t.occurred_on)}.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div>
    <p className="form-help">Delete it to undo this change. To set a different balance, use Update balance on the Accounts page.</p>
    {error&&<p className="error">{error}</p>}
    <div className="form-actions"><button type="button" className="button danger delete-action" onClick={remove}><Trash2 size={16}/> Delete</button><button type="button" className="button secondary" onClick={onClose}>Close</button></div>
  </div></div>
}
