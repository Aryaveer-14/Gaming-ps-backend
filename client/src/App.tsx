import { useAuthStore } from './store/authStore'
import { useBattleStore } from './store/battleStore'
import LoginPage from './components/LoginPage'
import PhaserGame from './components/PhaserGame'
import BattleUI from './components/BattleUI'
import FriendsPanel from './components/FriendsPanel'
import { getBattleSocket } from './lib/battleSocket'
import { useEffect, useState } from 'react'

export default function App() {
    const { isLoggedIn, token, userId } = useAuthStore()
    const { phase, setMyUserId } = useBattleStore()
    const [friendsOpen, setFriendsOpen] = useState(false)

    useEffect(() => {
        if (userId) setMyUserId(userId)
    }, [userId, setMyUserId])

    // Auto-connect to battle socket so we can receive incoming challenges
    useEffect(() => {
        if (token) {
            getBattleSocket(token)
        }
    }, [token])

    if (!isLoggedIn) return <LoginPage />

    const showBattleUI = phase !== 'idle'

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-black">
            <PhaserGame />

            {/* Multiplayer Friends Button — bottom-right corner */}
            {!showBattleUI && (
                <button
                    onClick={() => setFriendsOpen(o => !o)}
                    className="absolute bottom-4 right-4 z-40 flex items-center gap-1.5
                        px-3 py-2 rounded-xl text-xs font-mono
                        bg-gradient-to-r from-blue-600/90 to-indigo-600/90
                        hover:from-blue-500 hover:to-indigo-500
                        text-white shadow-lg shadow-blue-900/40
                        border border-blue-400/30 hover:border-blue-300/50
                        transition-all duration-200 hover:scale-105 active:scale-95
                        backdrop-blur-sm"
                >
                    <span className="text-sm">🎮</span>
                    <span>{friendsOpen ? 'Close' : 'Play with Friends'}</span>
                </button>
            )}

            {/* Friends Panel Overlay */}
            {friendsOpen && !showBattleUI && (
                <div className="absolute bottom-16 right-4 z-40">
                    <FriendsPanel onClose={() => setFriendsOpen(false)} />
                </div>
            )}

            {showBattleUI && (
                <div className="absolute inset-0 z-50">
                    <BattleUI />
                </div>
            )}
        </div>
    )
}

