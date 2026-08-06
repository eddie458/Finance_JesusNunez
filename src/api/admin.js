import { useQuery } from '@tanstack/react-query'
import { request } from './client'

export const useAdminUsers = () => useQuery({ queryKey: ['admin-users'], queryFn: () => request('/api/admin/users') })
export const createUser = data => request('/api/admin/users', { method: 'POST', body: JSON.stringify(data) })
