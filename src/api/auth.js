import { useQuery } from '@tanstack/react-query'; import { request } from './client'
export const useMe=()=>useQuery({queryKey:['me'],queryFn:()=>request('/api/auth/me')})
export const login=data=>request('/api/auth/login',{method:'POST',body:JSON.stringify(data),allowUnauthorized:true})
export const logout=()=>request('/api/auth/logout',{method:'POST'})
