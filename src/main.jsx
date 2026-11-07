import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LayoutDashboard, ArrowLeftRight, PieChart, WalletCards, LogOut, Plus, ShieldCheck } from 'lucide-react'
import { useMe, logout } from './api/auth'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Insights } from './pages/Insights'
import { Accounts } from './pages/Accounts'
import { Login } from './pages/Login'
import { Admin, AdminForbidden } from './pages/Admin'
import { TransactionModal } from './components/TransactionModal'
import { BrandMark } from './components/ui'
import './styles.css'

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15_000 } } })
const nav = [{ id:'dashboard', label:'Overview', icon:LayoutDashboard },{ id:'transactions', label:'Transactions', icon:ArrowLeftRight },{ id:'insights', label:'Insights', icon:PieChart },{ id:'accounts', label:'Accounts', icon:WalletCards }]

function App() {
  const { data:user, isLoading } = useMe(); const [{page,month},setView]=useState({page:'dashboard'}); const [adding,setAdding]=useState(false); const goTo=(next,options)=>setView({page:next,...options})
  useEffect(()=>{window.scrollTo(0,0)},[page])
  if (isLoading) return <div className="app-loading"><span className="brand-tile"><BrandMark/></span>Loading your ledger…</div>
  if (!user) return <Login />
  if (window.location.pathname.startsWith('/admin')) return user.role === 'admin' ? <Admin user={user}/> : <AdminForbidden />
  const Page = { dashboard:Dashboard, transactions:Transactions, insights:Insights, accounts:Accounts }[page]
  const openAdmin = () => window.location.assign('/admin/')
  async function signOut() {
    await logout()
    goTo('dashboard')
    client.setQueryData(['me'], null)
    client.removeQueries({ queryKey: ['accounts'] })
    client.removeQueries({ queryKey: ['transactions'] })
    client.removeQueries({ queryKey: ['insights'] })
    client.removeQueries({ queryKey: ['categories'] })
  }
  return <div className="shell">
    <aside className="rail">
      <button type="button" className="brand-tile rail-brand" aria-label="Fluent home" onClick={()=>goTo('dashboard')}><BrandMark/></button>
      <nav aria-label="Main">{nav.map(({id,label,icon:Icon})=><button key={id} type="button" className="rail-item" aria-label={label} data-label={label} aria-current={page===id?'page':undefined} onClick={()=>goTo(id)}><Icon size={23} aria-hidden="true"/></button>)}</nav>
      <button type="button" className="rail-add" aria-label="Add transaction" onClick={()=>setAdding(true)}><Plus size={23} strokeWidth={2.4} aria-hidden="true"/></button>
      <div className="rail-foot">{user.role==='admin'&&<button type="button" className="rail-item" aria-label="Admin" data-label="Admin" onClick={openAdmin}><ShieldCheck size={22} aria-hidden="true"/></button>}<button type="button" className="rail-item" aria-label={`Sign out of ${user.email}`} data-label={`Sign out · ${user.email}`} onClick={signOut}><LogOut size={22} aria-hidden="true"/></button></div>
    </aside>
    <main>
      {page==='dashboard'&&<div className="mobile-account"><span className="brand-tile"><BrandMark size={26}/></span><span className="row-meta">{user.email}</span>{user.role==='admin'&&<button type="button" className="icon-button" aria-label="Admin" onClick={openAdmin}><ShieldCheck size={19} aria-hidden="true"/></button>}<button type="button" className="icon-button" aria-label="Sign out" onClick={signOut}><LogOut size={19} aria-hidden="true"/></button></div>}
      <Page goTo={goTo} month={month} onAdd={()=>setAdding(true)}/>
    </main>
    {adding&&<TransactionModal onClose={()=>setAdding(false)}/>}
  </div>
}
createRoot(document.getElementById('root')).render(<React.StrictMode><QueryClientProvider client={client}><App/></QueryClientProvider></React.StrictMode>)
