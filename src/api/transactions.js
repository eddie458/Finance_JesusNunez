import { useQuery } from '@tanstack/react-query'; import { request } from './client'
export const useTransactions=(filters={})=>useQuery({queryKey:['transactions',filters],queryFn:()=>request('/api/transactions?'+new URLSearchParams(filters))})
export const createTransaction=data=>request('/api/transactions',{method:'POST',body:JSON.stringify(data)})
export const updateTransaction=(id,data)=>request(`/api/transactions/${id}`,{method:'PATCH',body:JSON.stringify(data)})
export const deleteTransaction=id=>request(`/api/transactions/${id}`,{method:'DELETE'})
