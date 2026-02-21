import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useBattleStore } from '../store/battleStore'
import { getBattleSocket } from '../lib/battleSocket'
import BattleUI from './BattleUI'

export default function LobbyPage() {
    const { token, username, logout } = useAuthStore()
    const { phase } = useBattleStore()
    const [targetUserId, setTargetUserId] = useState('')
    const [challengeMsg, setChallengeMsg] = useState('')

    function handleChallenge() {
        if (!token || !targetUserId.trim()) return
        const socket = getBattleSocket(token)
        socket.emit('battle-request', { targetUserId: targetUserId.trim() })
        setChallengeMsg('Challenge sent! Waiting for response...')
        setTimeout(() => setChallengeMsg(''), 5000)
    }

    // Incoming challenge arrives while on lobby — show as overlay
    const showOverlay = phase === 'incoming' || phase === 'waiting-accept'

    return (
        <div className="h-screen w-screen bg-pokemon-darker flex flex-col overflow-hidden relative">
            {showOverlay && <BattleUI />}

            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-pokemon-yellow/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-pokemon-blue/5 rounded-full blur-3xl" />
            </div>

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 border-b border-pokemon-border bg-pokemon-dark/80 backdrop-blur z-10">
                <div className="flex items-center gap-3">
                    <span className="text-xl">🔴</span>
                    <div>
                        <h1 className="font-pixel text-xs text-pokemon-yellow">Pokémon FireRed</h1>
                        <p className="font-pixel text-xs text-gray-400">Multiplayer</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="font-pixel text-xs text-white">{username}</p>
                        <div className="flex items-center gap-1 justify-end">
                            <div className="w-2 h-2 rounded-full bg-pokemon-hp-high animate-pulse" />
                            <span className="text-xs text-gray-400">Online</span>
                        </div>
                    </div>
                    <button
                        id="btn-logout"
                        onClick={logout}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors font-pixel"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex items-center justify-center p-6 relative z-10">
                <div className="max-w-md w-full space-y-6">

                    {/* Battle Challenge Card */}
                    <div className="pokemon-panel p-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">⚔️</span>
                            <h2 className="font-pixel text-xs text-pokemon-yellow">Challenge a Trainer</h2>
                        </div>

                        <p className="text-xs text-gray-400">
                            Enter your opponent's user ID to send a battle challenge.
                            Both players must be online.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-400 font-pixel block mb-1">Opponent User ID</label>
                                <input
                                    id="input-target-user-id"
                                    type="text"
                                    value={targetUserId}
                                    onChange={(e) => setTargetUserId(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleChallenge()}
                                    className="w-full bg-black/40 border border-pokemon-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pokemon-blue transition-colors font-mono"
                                    placeholder="clxxxxxxxxxxxxxxxxxxx"
                                />
                            </div>

                            <button
                                id="btn-send-challenge"
                                onClick={handleChallenge}
                                disabled={!targetUserId.trim() || phase !== 'idle'}
                                className="pokemon-btn-yellow w-full"
                            >
                                ⚔️ Challenge
                            </button>

                            {challengeMsg && (
                                <p className="text-xs text-green-400 animate-fadeIn text-center">{challengeMsg}</p>
                            )}
                        </div>
                    </div>

                    {/* Info cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="pokemon-panel p-4 text-center space-y-2">
                            <div className="text-2xl">🔥</div>
                            <p className="font-pixel text-xs text-pokemon-yellow">Your Starter</p>
                            <p className="text-xs text-gray-400">Flameling (Lv.5)</p>
                        </div>
                        <div className="pokemon-panel p-4 text-center space-y-2">
                            <div className="text-2xl">📖</div>
                            <p className="font-pixel text-xs text-pokemon-yellow">Battle Rules</p>
                            <p className="text-xs text-gray-400">1v1 · 30s turns</p>
                        </div>
                    </div>

                    {/* Type chart quick reference */}
                    <div className="pokemon-panel p-4 space-y-2">
                        <p className="font-pixel text-xs text-gray-400 mb-2">Type Chart (Super Effective)</p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-gray-300">
                            <span>🔥 Fire → Grass ✓</span>
                            <span>💧 Water → Fire ✓</span>
                            <span>🌿 Grass → Water ✓</span>
                            <span>⚡ Electric → Water ✓</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
