import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

type Mode = 'login' | 'register'

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>('login')
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { setAuth } = useAuthStore()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
            const body = mode === 'login' ? { username, password } : { username, email, password }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Request failed')

            setAuth(data.token, data.user.id, data.user.username)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="h-screen w-screen bg-pokemon-darker flex items-center justify-center">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pokemon-blue/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-pokemon-red/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 pokemon-panel p-8 w-full max-w-sm mx-4 space-y-6 animate-fadeIn">
                {/* Logo */}
                <div className="text-center space-y-2">
                    <div className="text-4xl">🔴</div>
                    <h1 className="font-pixel text-pokemon-yellow text-sm leading-relaxed">
                        Pokémon FireRed<br />
                        <span className="text-pokemon-blue">Multiplayer</span>
                    </h1>
                </div>

                {/* Mode Toggle */}
                <div className="flex rounded-lg overflow-hidden border border-pokemon-border">
                    <button
                        id="tab-login"
                        onClick={() => setMode('login')}
                        className={`flex-1 font-pixel text-xs py-2 transition-colors ${mode === 'login' ? 'bg-pokemon-blue text-white' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Login
                    </button>
                    <button
                        id="tab-register"
                        onClick={() => setMode('register')}
                        className={`flex-1 font-pixel text-xs py-2 transition-colors ${mode === 'register' ? 'bg-pokemon-blue text-white' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Register
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-400 font-pixel block mb-1">Username</label>
                        <input
                            id="input-username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                            className="w-full bg-black/40 border border-pokemon-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pokemon-blue transition-colors"
                            placeholder="trainer123"
                        />
                    </div>

                    {mode === 'register' && (
                        <div>
                            <label className="text-xs text-gray-400 font-pixel block mb-1">Email</label>
                            <input
                                id="input-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                className="w-full bg-black/40 border border-pokemon-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pokemon-blue transition-colors"
                                placeholder="trainer@kanto.com"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs text-gray-400 font-pixel block mb-1">Password</label>
                        <input
                            id="input-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            className="w-full bg-black/40 border border-pokemon-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pokemon-blue transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-xs animate-fadeIn">{error}</p>
                    )}

                    <button
                        id="btn-submit-auth"
                        type="submit"
                        disabled={loading}
                        className="pokemon-btn w-full mt-2"
                    >
                        {loading ? '...' : mode === 'login' ? 'Login' : 'Register'}
                    </button>
                </form>

                {mode === 'register' && (
                    <p className="text-xs text-gray-500 text-center">
                        You'll receive a starter Flameling 🔥
                    </p>
                )}
            </div>
        </div>
    )
}
