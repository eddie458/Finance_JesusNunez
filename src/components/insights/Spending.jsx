import { useState } from 'react'
import { useInsights, useInsightTransactions } from '../../api/insights'
import { plainMoney } from '../../lib/money'
import { daysInMonth, localToday, monthAbbr, monthName, monthRange, shiftMonth } from '../../lib/dates'
import { ChartCard, compactMoney, useCategoryColors } from './chartKit'
import { CategorySpending } from './CategorySpending'
import { HiddenList, ReviewPanel } from './Review'
import { SpendingPace } from './SpendingPace'

const MONTHS = 12

// The top of the scale: a round number that leaves a round halfway line.
function scaleTop(value) { if(value<=0)return 1; const step=10**Math.floor(Math.log10(value)); return [1,2,4,6,8,10].map(m=>m*step).find(top=>value<=top) }

function MonthColumns({ months, selected, onPick, currency }) {
  const top=scaleTop(Math.max(...months.map(m=>m.cents/100)))
  return <div className="columns">
    <div className="columns-axis" aria-hidden="true"><span style={{top:0}}>{compactMoney(top,currency)}</span><span style={{top:'calc((100% - 26px) / 2)'}}>{compactMoney(top/2,currency)}</span><span style={{top:'calc(100% - 26px)'}}>{compactMoney(0,currency)}</span></div>
    <div className="columns-grid" aria-hidden="true"><span style={{top:0}}/><span style={{top:'50%'}}/><span style={{bottom:0}}/></div>
    <div className="columns-plot">{months.map(m=><button key={m.month} type="button" className="column" aria-pressed={m.month===selected} aria-label={`${monthName(m.month)}, ${plainMoney(m.cents,currency)}`} onClick={()=>onPick(m.month)}><span className="column-tip">{plainMoney(m.cents,currency)}</span><span className="column-track"><span className="column-bar" style={{height:`${m.cents/100/top*100}%`}}/></span><span className="column-label">{monthAbbr(m.month)[0]}<span className="column-label-rest">{monthAbbr(m.month).slice(1)}</span></span></button>)}</div>
  </div>
}

function ExpenseBreakdown({ categories, loading, month, category, onPickCategory, onPickScope, currency, table }) {
  const colors=useCategoryColors(); const thisMonth=localToday().slice(0,7); const scoped=month??thisMonth; const biggest=Math.max(1,...categories.map(c=>Number(c.total_cents)))
  return <ChartCard className="tile-plum t-4" title="Expense breakdown" table={table}>
    <div className="scope" role="group" aria-label="Period"><button type="button" aria-pressed={month!==null} onClick={()=>onPickScope(scoped)}>{monthName(scoped)}</button><button type="button" aria-pressed={month===null} onClick={()=>onPickScope(null)}>All time</button></div>
    {categories.length?<ul className="breakdown-list">{categories.map(c=><li key={c.label}><button type="button" className="breakdown-row" aria-pressed={category===c.label} onClick={()=>onPickCategory(c.label)}><span className="breakdown-text"><span>{c.label}</span><span>{plainMoney(c.total_cents,currency)}</span></span><span className="breakdown-track"><span style={{width:`${Number(c.total_cents)*100/biggest}%`,'--bar':colors.colorOf(c.label)}}/></span></button></li>)}</ul>:<div className="empty compact">{loading?'Sorting your categories…':'Nothing spent here yet.'}</div>}
  </ChartCard>
}

export function Spending({ currency, review }) {
  const thisMonth=localToday().slice(0,7)
  const [month,setMonth]=useState(thisMonth); const [category,setCategory]=useState(null); const [reviewing,setReviewing]=useState(true); const [picks,setPicks]=useState(0) // month null means all time
  const {data:monthData,isLoading}=useInsights({group_by:'month'}); const {data:categoryData,isLoading:categoriesLoading}=useInsights({group_by:'category',...(month?{from:`${month}-01`,to:`${month}-${daysInMonth(month)}`}:{})}); const {data:hidden}=useInsightTransactions({hidden:1})
  const points=monthData??[]; const categories=[...(categoryData??[])].sort((a,b)=>Number(b.total_cents)-Number(a.total_cents)); const hiddenExpenses=(hidden??[]).filter(t=>t.type==='expense').length
  const showReview=reviewing&&points.length>0&&(month!==null||category!==null)
  const {data:bucketData,isLoading:bucketLoading,error:bucketError}=useInsightTransactions(month?{group_by:'month',label:month}:{group_by:'category',label:category??''},showReview)
  const bucket=bucketData??[]; const shown=month&&category?bucket.filter(t=>(t.category_name||'Uncategorized')===category):bucket
  const byMonth=Object.fromEntries(points.map(p=>[p.label,Number(p.total_cents)])); const first=points[0]?.label; const start=first&&first>shiftMonth(thisMonth,-(MONTHS-1))?first:shiftMonth(thisMonth,-(MONTHS-1)); const months=monthRange(start,thisMonth).map(m=>({month:m,cents:byMonth[m]||0}))
  const total=points.reduce((sum,p)=>sum+Number(p.total_cents),0)
  const touched=()=>{setReviewing(true);setPicks(n=>n+1)}
  function pickMonth(next){setMonth(next);setCategory(null);touched()}
  function pickCategory(name){setCategory(current=>current===name?null:name);touched()}
  function pickScope(next){setMonth(next);setCategory(null);setReviewing(next!==null)}
  function closeReview(){setReviewing(false);setCategory(null)}
  const monthTable={columns:[{key:'label',label:'Month'},{key:'total',label:'Spent',align:'right'}],rows:points.map(p=>({label:monthName(p.label),total:plainMoney(p.total_cents,currency)}))}
  const categoryTable={columns:[{key:'label',label:'Category'},{key:'total',label:'Spent',align:'right'}],rows:categories.map(c=>({label:c.label,total:plainMoney(c.total_cents,currency)}))}
  return <>
    <SpendingPace currency={currency} className="t-8"/>
    <ExpenseBreakdown categories={categories} loading={categoriesLoading} month={month} category={category} onPickCategory={pickCategory} onPickScope={pickScope} currency={currency} table={categories.length?categoryTable:null}/>
    <ChartCard className={`tile-lilac ${showReview?'t-5':'t-12'}`} title="Month by month" description={`${plainMoney(total,currency)} in total.${hiddenExpenses?` ${hiddenExpenses} hidden expense${hiddenExpenses===1?'':'s'} not counted.`:''} Select a month to review its expenses.`} table={points.length?monthTable:null}>
      {points.length?<MonthColumns months={months} selected={month} onPick={pickMonth} currency={currency}/>:<div className="empty">{isLoading?'Building your chart…':hiddenExpenses?'Every expense is hidden from insights. Switch one back on below.':'Add expenses to see your spending patterns.'}</div>}
    </ChartCard>
    {showReview&&<ReviewPanel className="t-7" title={[category,month?monthName(month):'All time'].filter(Boolean).join(' · ')} transactions={shown} loading={bucketLoading} error={bucketError} onClose={closeReview} review={review} currency={currency} focusKey={picks}/>}
    <CategorySpending currency={currency} className="t-12"/>
    <HiddenList review={review} currency={currency}/>
  </>
}
