import { Server, Socket } from 'socket.io'
import { verifySocketToken, JwtPayload } from '../middleware/auth'
import prisma from '../lib/prisma'
import redis from '../lib/redis'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerSession {
    userId: string
    username: string
    mapId: string
    x: number
    y: number
    socketId: string
}

// ─── Redis Helpers ────────────────────────────────────────────────────────────

function sessionKey(userId: string) { return `overworld:player:${userId}` }
function roomKey(mapId: string)     { return `overworld:room:${mapId}` }

async function setSession(p: PlayerSession) {
    await redis.hset(sessionKey(p.userId), {
        userId:   p.userId,
        username: p.username,
        mapId:    p.mapId,
        x:        String(p.x),
        y:        String(p.y),
        socketId: p.socketId,
    })
    await redis.expire(sessionKey(p.userId), 7200)
    await redis.sadd(roomKey(p.mapId), p.userId)
}

async function removeSession(userId: string, mapId: string) {
    await redis.del(sessionKey(userId))
    await redis.srem(roomKey(mapId), userId)
}

async function getRoomPlayers(mapId: string): Promise<PlayerSession[]> {
    const userIds = await redis.smembers(roomKey(mapId))
    if (!userIds.length) return []
    const sessions = await Promise.all(
        userIds.map(uid => redis.hgetall(sessionKey(uid)))
    )
    return sessions
        .filter(s => s && s.userId)
        .map(s => ({
            userId:   s.userId,
            username: s.username,
            mapId:    s.mapId,
            x:        Number(s.x),
            y:        Number(s.y),
            socketId: s.socketId,
        }))
}

// ─── Namespace Setup ──────────────────────────────────────────────────────────

export function registerOverworldNamespace(io: Server) {
    const nsp = io.of('/overworld')

    // JWT auth on connect
    nsp.use((socket: Socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined
        if (!token) return next(new Error('Missing token'))
        try {
            const payload = verifySocketToken(token) as JwtPayload
            ;(socket as any).user = payload
            next()
        } catch {
            next(new Error('Invalid token'))
        }
    })

    // 20fps snapshot loop — broadcast per room
    const SNAPSHOT_MS = 50
    setInterval(async () => {
        try {
            // Get all active map rooms from Redis
            const roomKeys = await redis.keys('overworld:room:*')
            for (const rk of roomKeys) {
                const mapId = rk.replace('overworld:room:', '')
                const players = await getRoomPlayers(mapId)
                if (!players.length) continue
                nsp.to(`map:${mapId}`).emit('world:snapshot', { mapId, players })
            }
        } catch { /* swallow */ }
    }, SNAPSHOT_MS)

    nsp.on('connection', async (socket: Socket) => {
        const user = (socket as any).user as JwtPayload
        const { userId, username } = user
        let currentMapId = 'hometown'

        // ── player:join ──────────────────────────────────────────────────────
        socket.on('player:join', async ({ mapId, x, y }: { mapId: string; x: number; y: number }) => {
            currentMapId = mapId
            socket.join(`map:${mapId}`)
            await setSession({ userId, username, mapId, x, y, socketId: socket.id })

            // Notify others in the room
            socket.to(`map:${mapId}`).emit('player:joined', { userId, username, x, y })

            // Send current snapshot immediately
            const players = await getRoomPlayers(mapId)
            socket.emit('world:snapshot', { mapId, players })
        })

        // ── player:move ──────────────────────────────────────────────────────
        socket.on('player:move', async ({ x, y }: { x: number; y: number }) => {
            await redis.hset(sessionKey(userId), { x: String(x), y: String(y) })
        })

        // ── enterRoute ───────────────────────────────────────────────────────
        socket.on('enterRoute', ({ fromMap }: { fromMap: string }) => {
            console.log(`[overworld] ${username} exits ${fromMap} → route`)
            socket.emit('route:ack', { nextMap: 'route1' })
        })

        // ── chat:send — relay message to target player ────────────────────────
        socket.on('chat:send', async ({ targetUserId, message }: { targetUserId: string; message: string }) => {
            if (!message || typeof message !== 'string' || message.length > 200) return
            const targetSession = await redis.hgetall(sessionKey(targetUserId))
            if (!targetSession?.socketId) return
            // Only relay if both players are in the same map
            const mySession = await redis.hgetall(sessionKey(userId))
            if (!mySession?.mapId || mySession.mapId !== targetSession.mapId) return
            const targetSocket = nsp.sockets.get(targetSession.socketId as string)
            targetSocket?.emit('chat:message', {
                fromUserId: userId,
                fromUsername: username,
                message: message.trim().slice(0, 200),
                timestamp: Date.now(),
            })
        })

        // ── disconnect ───────────────────────────────────────────────────────
        socket.on('disconnect', async () => {
            await removeSession(userId, currentMapId)
            socket.to(`map:${currentMapId}`).emit('player:left', { userId })
        })
    })
}
