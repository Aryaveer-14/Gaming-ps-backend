// ─── In-memory Redis replacement ───────────────────────────────────────────────
// Drop-in replacement for ioredis — no external service needed.
// All data lives in process memory with optional TTL auto-expiry.

const stringStore = new Map<string, string>()
const hashStore   = new Map<string, Record<string, string>>()
const setStore    = new Map<string, Set<string>>()
const ttlTimers   = new Map<string, NodeJS.Timeout>()

function clearKey(key: string) {
    stringStore.delete(key)
    hashStore.delete(key)
    setStore.delete(key)
    const timer = ttlTimers.get(key)
    if (timer) { clearTimeout(timer); ttlTimers.delete(key) }
}

function setExpiry(key: string, seconds: number) {
    const existing = ttlTimers.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => clearKey(key), seconds * 1000)
    timer.unref?.()                       // don't keep Node alive just for TTL
    ttlTimers.set(key, timer)
}

// Duck-typed client matching every ioredis method used in the codebase
const redis = {
    /* ── String commands ─────────────────────────────────────────────────── */
    async set(key: string, value: string, ...args: any[]) {
        stringStore.set(key, value)
        if (args[0] === 'EX' && typeof args[1] === 'number') setExpiry(key, args[1])
        return 'OK'
    },
    async get(key: string) {
        return stringStore.get(key) ?? null
    },

    /* ── Hash commands ───────────────────────────────────────────────────── */
    async hset(key: string, obj: Record<string, string>) {
        const cur = hashStore.get(key) ?? {}
        Object.assign(cur, obj)
        hashStore.set(key, cur)
        return Object.keys(obj).length
    },
    async hgetall(key: string) {
        return hashStore.get(key) ?? {}
    },

    /* ── Set commands ────────────────────────────────────────────────────── */
    async sadd(key: string, ...members: string[]) {
        let s = setStore.get(key)
        if (!s) { s = new Set(); setStore.set(key, s) }
        let added = 0
        for (const m of members) { if (!s.has(m)) { s.add(m); added++ } }
        return added
    },
    async smembers(key: string): Promise<string[]> {
        const s = setStore.get(key)
        return s ? [...s] : []
    },
    async srem(key: string, ...members: string[]) {
        const s = setStore.get(key)
        if (!s) return 0
        let removed = 0
        for (const m of members) { if (s.delete(m)) removed++ }
        if (s.size === 0) setStore.delete(key)
        return removed
    },

    /* ── Key commands ────────────────────────────────────────────────────── */
    async del(key: string) {
        const existed = stringStore.has(key) || hashStore.has(key) || setStore.has(key)
        clearKey(key)
        return existed ? 1 : 0
    },
    async expire(key: string, seconds: number) {
        const exists = stringStore.has(key) || hashStore.has(key) || setStore.has(key)
        if (exists) setExpiry(key, seconds)
        return exists ? 1 : 0
    },
    async keys(pattern: string): Promise<string[]> {
        const re = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$')
        const all = new Set([...stringStore.keys(), ...hashStore.keys(), ...setStore.keys()])
        return [...all].filter(k => re.test(k))
    },

    /* ── Connection stubs (no-ops) ───────────────────────────────────────── */
    on(_event: string, _fn: Function) { return redis },
    async connect() { console.log('✅ Using in-memory store (no Redis needed)') },
}

console.log('✅ Using in-memory store (no Redis needed)')

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
