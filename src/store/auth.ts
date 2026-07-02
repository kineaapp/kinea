import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export interface AuthUser {
  id?: string
  email: string
  name: string
  role: 'coach' | 'student' | 'super_admin'
  initials: string
  anamneseCompleted?: boolean
  phone?: string
  photo?: string
}

interface AuthStore {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  updateUser: (patch: Partial<AuthUser>) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      updateUser: (patch) => set(s => ({ user: s.user ? { ...s.user, ...patch } : null })),
      logout: () => {
        supabase.auth.signOut()
        set({ user: null })
      },
    }),
    { name: 'kinea-auth' }
  )
)
