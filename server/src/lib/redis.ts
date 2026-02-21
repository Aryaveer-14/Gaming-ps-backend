import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
})

redis.on('connect', () => console.log('✅ Redis connected'))
redis.on('error', (err) => console.error('❌ Redis error:', err))

export default redis

// ─── Key helpers ──────────────────────────────────────────────────────────────
const keys = {
    battle: (roomId: string) => `battle:room:${roomId}`,
    pendingChallenge: (fromUserId: string, toUserId: string) =>
        `challenge:${fromUserId}:${toUserId}`,
}

// ─── Battle Room helpers ───────────────────────────────────────────────────────

export async function createBattleRoom(roomId: string, data: object, ttlSeconds = 1800) {
    const json = JSON.stringify(data)
    await redis.set(keys.battle(roomId), json, 'EX', ttlSeconds)
}

export async function getBattleRoom<T = unknown>(roomId: string): Promise<T | null> {
    const raw = await redis.get(keys.battle(roomId))
    if (!raw) return null
    return JSON.parse(raw) as T
}

export async function updateBattleRoom(roomId: string, data: object, ttlSeconds = 1800) {
    const json = JSON.stringify(data)
    await redis.set(keys.battle(roomId), json, 'EX', ttlSeconds)
}

export async function deleteBattleRoom(roomId: string) {
    await redis.del(keys.battle(roomId))
}

// ─── Pending challenge helpers ─────────────────────────────────────────────────

export async function setPendingChallenge(fromUserId: string, toUserId: string) {
    await redis.set(keys.pendingChallenge(fromUserId, toUserId), '1', 'EX', 60)
}

export async function getPendingChallenge(fromUserId: string, toUserId: string) {
    return redis.get(keys.pendingChallenge(fromUserId, toUserId))
}

export async function deletePendingChallenge(fromUserId: string, toUserId: string) {
    return redis.del(keys.pendingChallenge(fromUserId, toUserId))
}
