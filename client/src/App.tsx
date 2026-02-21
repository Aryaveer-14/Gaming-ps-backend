import { useAuthStore } from './store/authStore'
import { useBattleStore } from './store/battleStore'
import LoginPage from './components/LoginPage'
import LobbyPage from './components/LobbyPage'
import BattleUI from './components/BattleUI'
import { useEffect } from 'react'

export default function App() {
    const { isLoggedIn, userId } = useAuthStore()
    const { phase, setMyUserId } = useBattleStore()

    useEffect(() => {
        if (userId) setMyUserId(userId)
    }, [userId, setMyUserId])

    if (!isLoggedIn) return <LoginPage />

    // Battle overlays (incoming challenge, waiting, active battle, ended) all live in BattleUI
    const showBattleUI = phase !== 'idle'

    return (
        <div className="relative h-screen w-screen overflow-hidden">
            {showBattleUI ? <BattleUI /> : <LobbyPage />}
        </div>
    )
}
