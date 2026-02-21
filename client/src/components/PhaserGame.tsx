import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { gameConfig } from '../game/gameConfig'
import { useAuthStore } from '../store/authStore'
import { overworldSocket, loadStoryFlags } from '../lib/overworldSocket'

export default function PhaserGame() {
    const gameRef  = useRef<Phaser.Game | null>(null)
    const wrapRef  = useRef<HTMLDivElement>(null)
    const { token, userId } = useAuthStore()

    useEffect(() => {
        if (gameRef.current) return

        const game = new Phaser.Game({
            ...gameConfig,
            parent: 'phaser-container',
        })

        game.registry.set('token',  token)
        game.registry.set('userId', userId)

        if (token) {
            overworldSocket.connect(token)
            loadStoryFlags(token)
        }

        // ── Auto-focus canvas so keyboard works immediately ───────────────
        game.events.once(Phaser.Core.Events.READY, () => {
            const canvas = game.canvas
            if (canvas) {
                canvas.setAttribute('tabindex', '0')
                canvas.focus()
            }
        })

        // ── Prevent arrow keys / SPACE scrolling the page ─────────────────
        const preventScroll = (e: KeyboardEvent) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault()
            }
        }
        window.addEventListener('keydown', preventScroll)

        gameRef.current = game

        return () => {
            window.removeEventListener('keydown', preventScroll)
            overworldSocket.disconnect()
            game.destroy(true)
            gameRef.current = null
        }
    }, [token, userId])

    // Click-to-focus fallback
    const handleClick = () => {
        gameRef.current?.canvas?.focus()
    }

    return (
        <div
            ref={wrapRef}
            id="phaser-container"
            onClick={handleClick}
            className="w-full h-full flex items-center justify-center bg-black"
            style={{ imageRendering: 'pixelated', cursor: 'default' }}
        />
    )
}
