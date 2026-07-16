import { useQuery } from '@tanstack/react-query'; import { request } from './client'
export const useInsights=filters=>useQuery({queryKey:['insights',filters],queryFn:()=>request('/api/insights/summary?'+new URLSearchParams(filters))})
export const useCategories=()=>useQuery({queryKey:['categories'],queryFn:()=>request('/api/categories')})
export const createCategory=data=>request('/api/categories',{method:'POST',body:JSON.stringify(data)})
