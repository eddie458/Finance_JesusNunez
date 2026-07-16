import { useQuery } from '@tanstack/react-query'; import { request } from './client'
export const useAccounts=()=>useQuery({queryKey:['accounts'],queryFn:()=>request('/api/accounts')})
export const createAccount=data=>request('/api/accounts',{method:'POST',body:JSON.stringify(data)})
export const updateAccount=(id,data)=>request(`/api/accounts/${id}`,{method:'PATCH',body:JSON.stringify(data)})
