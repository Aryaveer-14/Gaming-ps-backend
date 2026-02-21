import { io, Socket } from 'socket.io-client'
import { useBattleStore } from '../store/battleStore'

let battleSocket: Socket | null = null

export function getBattleSocket(token: string): Socket {
    if (battleSocket?.connected) return battleSocket

    battleSocket = io('/battle', {
        auth: { token },
        transports: ['websocket'],
        autoConnect: true,
    })

    battleSocket.on('connect', () => {
        console.log('[battle socket] connected')
    })

    battleSocket.on('disconnect', () => {
        console.log('[battle socket] disconnected')
    })

    // ── Incoming Events ─────────────────────────────────────────────────────────

    battleSocket.on('battle-incoming', (data: { fromUserId: string; fromUsername: string }) => {
        useBattleStore.getState().setIncomingChallenge(data)
    })

    battleSocket.on('battle-request-sent', () => {
        useBattleStore.setState({ phase: 'waiting-accept' })
    })

    battleSocket.on('battle-declined', (data: { byUsername: string }) => {
        useBattleStore.setState({ phase: 'idle' })
        useBattleStore.getState().addLog(`${data.byUsername} declined the battle request.`)
        // Reset after a moment
        setTimeout(() => useBattleStore.getState().reset(), 2000)
    })

    battleSocket.on('battle-start', (payload: { roomId: string; player1: import('../store/battleStore').CreatureInfo; player2: import('../store/battleStore').CreatureInfo }) => {
        const myUserId = useBattleStore.getState().myUserId
        if (!myUserId) return
        useBattleStore.getState().setBattleStart(payload, myUserId)
    })

    battleSocket.on('battle-action-ack', (_: { moveId: string }) => {
        useBattleStore.setState({ phase: 'resolving' })
    })

    battleSocket.on('opponent-action-ready', () => {
        useBattleStore.getState().addLog('⏳ Opponent has chosen their move...')
    })

    battleSocket.on('battle-update', (payload: { log: string[]; player1: Partial<import('../store/battleStore').CreatureInfo>; player2: Partial<import('../store/battleStore').CreatureInfo>; turnNumber: number }) => {
        useBattleStore.getState().applyUpdate(payload)
    })

    battleSocket.on('battle-end', (payload: { winnerId: string | null; xpAwarded: number; reason: string }) => {
        useBattleStore.getState().endBattle(payload)
    })

    battleSocket.on('opponent-disconnected', (data: { username: string; graceMs: number }) => {
        useBattleStore.getState().addLog(`⚠️ ${data.username} disconnected. Waiting ${data.graceMs / 1000}s...`)
    })

    battleSocket.on('battle-error', (data: { message: string }) => {
        useBattleStore.getState().addLog(`❌ Error: ${data.message}`)
        // Revert to selecting if we were resolving
        if (useBattleStore.getState().phase === 'resolving') {
            useBattleStore.setState({ phase: 'selecting', pendingMoveId: null })
        }
    })

    return battleSocket
}

export function disconnectBattleSocket() {
    battleSocket?.disconnect()
    battleSocket = null
}
