import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { createUser, useAdminUsers } from '../api/admin'

export function Admin({ user }) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useAdminUsers()
  const users = Array.isArray(data) ? data : []
  const [formOpen, setFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true); setFormError(''); setMessage('')
    try {
      const created = await createUser({ email: form.get('email'), password: form.get('password'), base_currency: form.get('currency') })
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setMessage(`${created.email} can now sign in.`); setFormOpen(false)
    } catch (err) { setFormError(err.message) } finally { setSaving(false) }
  }

  const sessionExpired = !isLoading && !error && data === null
  return <div className="admin-page"><div className="admin-head"><div><p className="eyebrow">Administrator</p><h1>User management</h1><p className="subtle">Create secure sign-in accounts for your finance tracker.</p></div><button className="button secondary" onClick={()=>window.location.assign('/')}><ArrowLeft size={18}/> Back to tracker</button></div>{sessionExpired?<section className="card"><div className="section-title">Your session has expired</div><p className="section-description">Please sign in again before opening the admin page.</p><button className="button" onClick={()=>window.location.assign('/')}>Go to sign in</button></section>:<><div className="admin-summary"><div className="icon-box"><ShieldCheck size={21}/></div><div><div className="row-title">Signed in as administrator</div><div className="row-meta">{user.email}</div></div><button className="button" onClick={()=>setFormOpen(true)}><UserPlus size={18}/> Create user</button></div>{message&&<div className="success">{message}</div>}{formOpen&&<section className="card create-user"><div className="section-title">Create user account</div><p className="section-description">The user will use these credentials to sign in. Share the password securely with them.</p><form onSubmit={submit} className="form-grid"><div className="field"><label>Email</label><input name="email" type="email" required autoFocus/></div><div className="field"><label>Temporary password</label><input name="password" type="password" minLength="8" required/></div><div className="field"><label>Base currency</label><select name="currency" defaultValue="MXN"><option>MXN</option><option>USD</option><option>EUR</option></select></div><div className="form-actions"><button className="button secondary" type="button" onClick={()=>setFormOpen(false)}>Cancel</button><button className="button" disabled={saving}>{saving?'Creating…':'Create user'}</button></div></form>{formError&&<p className="error">{formError}</p>}</section>}<section className="card"><div className="section-title"><Users size={17} style={{verticalAlign:'-3px',marginRight:7}}/>Users</div><p className="section-description">All accounts that can sign in to this tracker.</p>{isLoading?<div className="empty">Loading users…</div>:error?<p className="error">{error.message}</p>:<div className="table-wrap"><table className="table"><thead><tr><th>Email</th><th>Currency</th><th>Role</th><th>Created</th></tr></thead><tbody>{users.map(account=><tr key={account.id}><td className="row-title">{account.email}</td><td>{account.base_currency}</td><td><span className={`badge ${account.role==='admin'?'admin-badge':''}`}>{account.role}</span></td><td>{new Intl.DateTimeFormat('en',{dateStyle:'medium'}).format(new Date(account.created_at))}</td></tr>)}</tbody></table></div>}</section></>}</div>
}

export function AdminForbidden() {
  return <div className="auth-form"><section className="card"><h2>Administrator access required</h2><p className="section-description">Your account cannot access user management.</p><button className="button" onClick={()=>window.location.assign('/')}>Back to tracker</button></section></div>
}
