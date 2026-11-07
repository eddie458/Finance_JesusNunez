import { useState } from 'react'
import { Plus, Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccounts, updateAccount, deleteAccount } from '../api/accounts'
import { useMe } from '../api/auth'
import { plainMoney } from '../lib/money'
import { AccountModal } from '../components/AccountModal'
import { BalanceModal } from '../components/BalanceModal'
import { CreditBar, accountTone, accountType } from '../components/Wallet'
import { Amount } from '../components/ui'

export function Accounts() {
  const {data:accounts=[],isLoading}=useAccounts(); const {data:user}=useMe(); const currency=user?.base_currency; const [open,setOpen]=useState(false); const [editing,setEditing]=useState(null); const [updating,setUpdating]=useState(null); const qc=useQueryClient()
  async function setArchived(account,isArchived){await updateAccount(account.id,{is_archived:isArchived});qc.invalidateQueries({queryKey:['accounts']})}
  async function remove(account){if(!confirm(`Delete "${account.name}"? This is permanent and is available only for accounts without transactions.`))return;try{await deleteAccount(account.id);await qc.invalidateQueries({queryKey:['accounts']})}catch(error){alert(error.message)}}
  function closeModal(){setOpen(false);setEditing(null)}
  const total=accounts.reduce((sum,a)=>sum+Number(a.balance_cents),0)
  return <>
    <div className="page-head"><div><h1>Accounts</h1>{accounts.length>0&&<p className="subtle">{plainMoney(total,currency)} across {accounts.length} account{accounts.length===1?'':'s'}</p>}</div><div className="head-actions"><button type="button" className="button" onClick={()=>setOpen(true)}><Plus size={17} strokeWidth={2.4}/> Add account</button></div></div>
    {isLoading?<div className="tile empty">Loading accounts…</div>:accounts.length?<div className="bento">{accounts.map(a=>{
      const archived=Boolean(Number(a.is_archived)); const credit=a.type==='credit'
      return <article key={a.id} className={`bank-card fit t-4 ${archived?'archived':accountTone(a.type)}`}>
        <div className="bank-top"><div><div className="bank-name">{a.name}</div><div className="bank-type">{accountType(a.type)} account</div></div>{archived?<span className="badge">Archived</span>:<button type="button" className="bank-update" onClick={()=>setUpdating(a)}>Update balance</button>}</div>
        <p className="bank-balance"><Amount cents={a.balance_cents} currency={currency}/></p>
        {credit&&<><CreditBar account={a} currency={currency}/><p className="bank-meta">Closes on day {a.statement_day} · due day {a.due_day}</p></>}
        <div className="bank-actions"><button type="button" onClick={()=>setEditing(a)}><Pencil size={14}/> Edit</button>{archived?<button type="button" onClick={()=>setArchived(a,false)}><ArchiveRestore size={14}/> Unarchive</button>:<button type="button" onClick={()=>setArchived(a,true)}><Archive size={14}/> Archive</button>}<button type="button" onClick={()=>remove(a)}><Trash2 size={14}/> Delete</button></div>
      </article>})}</div>:<div className="tile empty">Create your cash, debit, savings, or credit accounts to start your ledger.</div>}
    {(open||editing)&&<AccountModal account={editing} onClose={closeModal}/>}
    {updating&&<BalanceModal account={updating} currency={currency} onClose={()=>setUpdating(null)}/>}
  </>
}
