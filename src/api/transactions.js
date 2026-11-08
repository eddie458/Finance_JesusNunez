import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'; import { request } from './client'
// Null means the session ended, which the ledger and exports report instead of rendering.
const fetchTransactions=async params=>{const payload=await request('/api/transactions?'+new URLSearchParams(params));if(!payload)throw new Error('Your session has ended. Sign in again.');return payload}
export const useTransactions=(filters={})=>useQuery({queryKey:['transactions',filters],queryFn:()=>request('/api/transactions?'+new URLSearchParams(filters)),placeholderData:keepPreviousData})
// Pages cache a different shape from useTransactions, so they need their own key. It stays under 'transactions' so every save refreshes them.
export const useTransactionPages=filters=>useInfiniteQuery({queryKey:['transactions','pages',filters],initialPageParam:1,queryFn:({pageParam})=>fetchTransactions({...filters,page:pageParam,with_total:1}),getNextPageParam:(last,pages)=>pages.reduce((count,page)=>count+page.rows.length,0)<last.total?pages.length+1:undefined,placeholderData:keepPreviousData})
// The ledger loads a page at a time, so exports ask for every match.
export const fetchAllTransactions=filters=>fetchTransactions({...filters,all:1})
export const createTransaction=data=>request('/api/transactions',{method:'POST',body:JSON.stringify(data)})
export const updateTransaction=(id,data)=>request(`/api/transactions/${id}`,{method:'PATCH',body:JSON.stringify(data)})
export const deleteTransaction=id=>request(`/api/transactions/${id}`,{method:'DELETE'})
// Without a fingerprint this only checks the file. With the fingerprint from that check, it saves the file, unless checking again would now give a different answer.
export async function importTransactions(transactions, fingerprint) {
  const payload=await request('/api/transactions/import',{method:'POST',body:JSON.stringify(fingerprint?{transactions,apply:true,fingerprint}:{transactions})})
  if(!payload)throw new Error('Your session has ended. Sign in again.')
  return payload
}
