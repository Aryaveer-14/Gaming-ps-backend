import { io, Socket } from 'socket.io-client'
import { useStoryStore } from '../store/storyStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerSnapshot {
    userId:   string
    username: string
    mapId:    string
    x:        number
    y:        number
}

export interface WorldSnapshot {
    mapId:   string
    players: PlayerSnapshot[]
}

export interface ChatMessage {
    fromUserId:   string
    fromUsername:  string
    message:       string
    timestamp:     number
}

type SnapshotCallback = (snap: WorldSnapshot) => void
type ChatCallback     = (msg: ChatMessage) => void

// ─── Singleton ────────────────────────────────────────────────────────────────

class OverworldSocket {
    private socket: Socket | null = null
    private _onSnapshot: SnapshotCallback | null = null
    private _onChatMessage: ChatCallback | null = null

    connect(token: string) {
        if (this.socket?.connected) return

        const base = (import.meta as any).env?.VITE_SOCKET_URL ?? 'http://localhost:3001'
        this.socket = io(`${base}/overworld`, {
            auth: { token },
            transports: ['websocket'],
        })

        this.socket.on('world:snapshot', (snap: WorldSnapshot) => {
            this._onSnapshot?.(snap)
        })

        this.socket.on('chat:message', (msg: ChatMessage) => {
            this._onChatMessage?.(msg)
        })

        this.socket.on('connect_error', (err) => {
            console.warn('[overworld socket] connect error:', err.message)
        })
    }

    join(mapId: string, x: number, y: number) {
        this.socket?.emit('player:join', { mapId, x, y })
    }

    move(x: number, y: number) {
        this.socket?.emit('player:move', { x, y })
    }

    sendChat(targetUserId: string, message: string) {
        this.socket?.emit('chat:send', { targetUserId, message })
    }

    enterRoute(fromMap: string) {
        this.socket?.emit('enterRoute', { fromMap })
    }

    set onSnapshot(cb: SnapshotCallback | null) {
        this._onSnapshot = cb
    }

    set onChatMessage(cb: ChatCallback | null) {
        this._onChatMessage = cb
    }

    disconnect() {
        this.socket?.disconnect()
        this.socket = null
    }

    get connected() { return this.socket?.connected ?? false }
}

export const overworldSocket = new OverworldSocket()

// ─── Helper: load flags from server ──────────────────────────────────────────

export async function loadStoryFlags(token: string) {
    try {
        const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'
        const res = await fetch(`${base}/story/flags`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
            const data = await res.json()
            useStoryStore.getState().setFlags(data)
        }
    } catch { /* best-effort */ }
}

export async function setStoryFlag(
    token: string,
    field: string,
    value: boolean = true,
) {
    try {
        const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'
        await fetch(`${base}/story/flags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization:  `Bearer ${token}`,
            },
            body: JSON.stringify({ field, value }),
        })
        useStoryStore.getState().setFlag(field as any, value)
    } catch { /* best-effort */ }
}
