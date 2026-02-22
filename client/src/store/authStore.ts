import { create } from 'zustand'

interface AuthState {
    token: string | null
    userId: string | null
    username: string | null
    isLoggedIn: boolean
    setAuth: (token: string, userId: string, username: string) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>()(
    (set) => ({
        token: null,
        userId: null,
        username: null,
        isLoggedIn: false,

        setAuth: (token, userId, username) =>
            set({ token, userId, username, isLoggedIn: true }),

        logout: () =>
            set({ token: null, userId: null, username: null, isLoggedIn: false }),
    })
)
