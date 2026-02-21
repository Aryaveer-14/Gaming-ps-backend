import { useAuthStore } from './store/authStore'
import { useBattleStore } from './store/battleStore'
import LoginPage from './components/LoginPage'
import PhaserGame from './components/PhaserGame'
import BattleUI from './components/BattleUI'
import { useEffect } from 'react'

export default function App() {
    const { isLoggedIn, userId } = useAuthStore()
    const { phase, setMyUserId } = useBattleStore()

    useEffect(() => {
        if (userId) setMyUserId(userId)
    }, [userId, setMyUserId])

    if (!isLoggedIn) return <LoginPage />

    const showBattleUI = phase !== 'idle'

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-black">
            {/* Phaser game always mounted when logged in */}
            <PhaserGame />
            {/* Battle UI overlays Phaser when active */}
            {showBattleUI && (
                <div className="absolute inset-0 z-50">
                    <BattleUI />
                </div>
            )}
        </div>
    )
}
