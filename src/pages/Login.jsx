import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { login } from '../api/auth'
import { Flower } from '../components/Flower'
import { BrandMark } from '../components/ui'
import { OTHER, SERIES } from '../lib/palette'

// Decoration only: these proportions are not anyone's data.
const SAMPLE = [45,21,12,8,7,7].map((cents,i)=>({name:String(i),cents,color:SERIES[i]??OTHER}))

export function Login() {
  const client=useQueryClient(); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  async function submit(e){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');try{await login({email:f.get('email'),password:f.get('password')});await client.invalidateQueries({queryKey:['me']})}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <div className="auth">
    <section className="auth-art tile-plum">
      <div className="brand"><span className="brand-tile"><BrandMark/></span><span>fluent</span></div>
      <div className="auth-bloom"><Flower items={SAMPLE} surface="#24112f"/></div>
      <div><h1>See where every peso goes.</h1><p>A private, calm home for your money. Track spending, move money between accounts, and stay ahead of every card payment.</p></div>
    </section>
    <section className="auth-form"><form className="tile" onSubmit={submit}>
      <h2>Welcome back</h2><p className="section-description">Sign in with the account provided by your administrator.</p>
      <div className="field"><label htmlFor="login-email">Email</label><input id="login-email" type="email" name="email" autoComplete="username" required autoFocus/></div>
      <div className="field"><label htmlFor="login-password">Password</label><input id="login-password" type="password" name="password" autoComplete="current-password" minLength="8" required/></div>
      {error&&<p className="error">{error}</p>}
      <button className="button" disabled={busy}>{busy?'Working…':'Sign in'}</button>
    </form></section>
  </div>
}
