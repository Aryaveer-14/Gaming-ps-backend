import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
    token: string | null
    userId: string | null
    username: string | null
    isLoggedIn: boolean
    setAuth: (token: string, userId: string, username: string) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            userId: null,
            username: null,
            isLoggedIn: false,

            setAuth: (token, userId, username) =>
                set({ token, userId, username, isLoggedIn: true }),

            logout: () =>
                set({ token: null, userId: null, username: null, isLoggedIn: false }),
        }),
        {
            name: 'pokemon-auth',
            partialize: (s) => ({ token: s.token, userId: s.userId, username: s.username, isLoggedIn: s.isLoggedIn }),
        }
    )
)
