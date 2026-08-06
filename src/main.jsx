import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LayoutDashboard, ArrowLeftRight, PieChart, WalletCards, LogOut, ShieldCheck } from 'lucide-react'
import { useMe, logout } from './api/auth'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Insights } from './pages/Insights'
import { Accounts } from './pages/Accounts'
import { Login } from './pages/Login'
import { Admin, AdminForbidden } from './pages/Admin'
import './styles.css'

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15_000 } } })
const nav = [{ id:'dashboard', label:'Overview', icon:LayoutDashboard },{ id:'transactions', label:'Transactions', icon:ArrowLeftRight },{ id:'insights', label:'Insights', icon:PieChart },{ id:'accounts', label:'Accounts', icon:WalletCards }]

function App() {
  const { data:user, isLoading } = useMe(); const [page,setPage]=useState('dashboard')
  if (isLoading) return <div className="app-loading">Loading your ledger…</div>
  if (!user) return <Login />
  if (window.location.pathname.startsWith('/admin')) return user.role === 'admin' ? <Admin user={user}/> : <AdminForbidden />
  const Page = { dashboard:Dashboard, transactions:Transactions, insights:Insights, accounts:Accounts }[page]
  async function signOut() {
    await logout()
    client.setQueryData(['me'], null)
    client.removeQueries({ queryKey: ['accounts'] })
    client.removeQueries({ queryKey: ['transactions'] })
    client.removeQueries({ queryKey: ['insights'] })
    client.removeQueries({ queryKey: ['categories'] })
  }
  return <div className="shell"><aside><div className="brand"><span className="brand-mark">F</span><span>fluent</span></div><nav>{nav.map(({id,label,icon:Icon})=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={19}/>{label}</button>)}{user.role==='admin'&&<button onClick={()=>window.location.assign('/admin/')}><ShieldCheck size={19}/> Admin</button>}</nav><div className="sidebar-bottom"><div className="user-email">{user.email}</div><button onClick={signOut}><LogOut size={18}/> Sign out</button></div></aside><main><Page goTo={setPage}/></main></div>
}
createRoot(document.getElementById('root')).render(<React.StrictMode><QueryClientProvider client={client}><App/></QueryClientProvider></React.StrictMode>)
