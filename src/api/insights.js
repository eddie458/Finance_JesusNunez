import { useQuery } from '@tanstack/react-query'; import { request } from './client'
export const useInsights=filters=>useQuery({queryKey:['insights',filters],queryFn:()=>request('/api/insights/summary?'+new URLSearchParams(filters))})
export const useInsightTransactions=(filters,enabled=true)=>useQuery({queryKey:['insights','transactions',filters],queryFn:()=>request('/api/insights/transactions?'+new URLSearchParams(filters)),enabled})
export const useCashflow=filters=>useQuery({queryKey:['insights','cashflow',filters],queryFn:()=>request('/api/insights/cashflow?'+new URLSearchParams(filters))})
export const useCategoryTrends=filters=>useQuery({queryKey:['insights','category-trends',filters],queryFn:()=>request('/api/insights/category-trends?'+new URLSearchParams(filters))})
// Net worth and card use follow account balances, so they live under the accounts key and refresh with it.
export const useNetWorth=()=>useQuery({queryKey:['accounts','net-worth'],queryFn:()=>request('/api/insights/net-worth')})
export const useCreditCards=asOf=>useQuery({queryKey:['accounts','cards',asOf],queryFn:()=>request('/api/insights/cards?'+new URLSearchParams({as_of:asOf}))})
export const useCategories=()=>useQuery({queryKey:['categories'],queryFn:()=>request('/api/categories')})
export const createCategory=data=>request('/api/categories',{method:'POST',body:JSON.stringify(data)})
