// ─────────────────────────────────────────────────────────────────────────────
// PlayerState — Persistent client-side state manager for the player
//
// Fetches and caches: team, money, inventory.
// Provides methods for battle rewards, healing, party management.
// Emits events via GameEventBus for UI reactivity.
// ─────────────────────────────────────────────────────────────────────────────

import { useAuthStore } from '../../store/authStore'
import eventBus, { GameEvents } from './GameEventBus'

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'

export interface PartyMon {
    id: string          // PlayerCreature DB id
    creatureId: string  // creature key (e.g. 'flameling')
    nickname: string | null
    level: number
    xp: number
    currentHp: number
    maxHp: number
    isLead: boolean
    type: string        // creature type (Fire, Water, etc.)
    moves: { id: string; name: string; type: string; power: number }[]
}

export interface PlayerData {
    team: PartyMon[]
    money: number
    caughtCount: number
}

class PlayerStateManager {
    private _team: PartyMon[] = []
    private _money = 3000
    private _loaded = false

    get team(): PartyMon[] { return this._team }
    get money(): number { return this._money }
    get loaded(): boolean { return this._loaded }

    get lead(): PartyMon | undefined {
        return this._team.find(m => m.isLead) ?? this._team[0]
    }

    get caughtCount(): number { return this._team.length }

    /** Get first alive creature (for auto-select after faint) */
    getFirstAlive(): PartyMon | undefined {
        // Prefer lead first
        const lead = this.lead
        if (lead && lead.currentHp > 0) return lead
        return this._team.find(m => m.currentHp > 0)
    }

    /** Check if all party members are fainted */
    isWhiteout(): boolean {
        return this._team.length > 0 && this._team.every(m => m.currentHp <= 0)
    }

    /** Fetch team + money from server */
    async load(): Promise<void> {
        const token = useAuthStore.getState().token
        if (!token) return

        try {
            const [teamRes, invRes] = await Promise.all([
                fetch(`${API}/starter/team`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API}/inventory`, { headers: { Authorization: `Bearer ${token}` } }),
            ])

            if (teamRes.ok) {
                const json = await teamRes.json()
                this._team = (json.team || []).map((c: any) => ({
                    ...c,
                    xp: c.xp ?? 0,
                    type: c.type ?? 'Normal',
                }))
            }

            if (invRes.ok) {
                const json = await invRes.json()
                this._money = json.money ?? 3000
            }

            this._loaded = true
            eventBus.emit(GameEvents.PARTY_UPDATED, this._team)
        } catch (e) {
            console.error('[PlayerState] load failed', e)
        }
    }

    /** Award XP + money after winning a battle */
    async awardBattleReward(creatureDbId: string, enemyLevel: number, caught = false): Promise<{
        xpGain: number; moneyReward: number; leveledUp: boolean; newLevel: number; newMaxHp: number
    } | null> {
        const token = useAuthStore.getState().token
        if (!token) return null

        try {
            const res = await fetch(`${API}/party/battleReward`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ creatureDbId, enemyLevel, caught }),
            })

            if (res.ok) {
                const data = await res.json()
                this._money = data.totalMoney

                // Update local team state
                const mon = this._team.find(m => m.id === creatureDbId)
                if (mon) {
                    mon.xp = data.newXp
                    mon.level = data.newLevel
                    mon.maxHp = data.newMaxHp
                    mon.currentHp = Math.min(mon.currentHp + (data.newMaxHp - mon.maxHp), data.newMaxHp)
                }

                eventBus.emit(GameEvents.XP_GAINED, { xpGain: data.xpGain, creatureDbId })
                eventBus.emit(GameEvents.MONEY_CHANGED, this._money)

                if (data.leveledUp) {
                    eventBus.emit(GameEvents.POKEMON_LEVEL_UP, { creatureDbId, newLevel: data.newLevel })
                }

                return data
            }
        } catch (e) {
            console.error('[PlayerState] awardBattleReward failed', e)
        }
        return null
    }

    /** Persist creature HP to server */
    async updateHp(creatureDbId: string, currentHp: number): Promise<void> {
        const token = useAuthStore.getState().token
        if (!token) return

        // Update local state
        const mon = this._team.find(m => m.id === creatureDbId)
        if (mon) mon.currentHp = Math.max(0, currentHp)

        try {
            await fetch(`${API}/party/updateHp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ creatureDbId, currentHp: Math.max(0, currentHp) }),
            })
        } catch { /* silent */ }
    }

    /** Heal all Pokémon */
    async healAll(): Promise<void> {
        // Heal locally FIRST so team is always alive regardless of server
        this._team.forEach(m => { m.currentHp = m.maxHp })
        eventBus.emit(GameEvents.PARTY_UPDATED, this._team)

        const token = useAuthStore.getState().token
        if (!token) {
            eventBus.emit(GameEvents.PLAYER_HEALED)
            return
        }

        let serverOk = false
        try {
            const res = await fetch(`${API}/party/healAll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            })
            serverOk = res.ok
        } catch { /* silent */ }

        // Only reload from server if the heal POST succeeded,
        // otherwise keep the local heal so team stays alive
        if (serverOk) {
            try { await this.load() } catch { /* keep local heal */ }
        }
        eventBus.emit(GameEvents.PLAYER_HEALED)
    }

    /** Set lead Pokémon */
    async setLead(creatureDbId: string): Promise<void> {
        const token = useAuthStore.getState().token
        if (!token) return

        try {
            await fetch(`${API}/party/setLead`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ creatureDbId }),
            })
        } catch { /* silent */ }

        // Update local state
        this._team.forEach(m => { m.isLead = m.id === creatureDbId })
        eventBus.emit(GameEvents.POKEMON_SWITCH, creatureDbId)
        eventBus.emit(GameEvents.PARTY_UPDATED, this._team)
    }

    /** Fetch leaderboard */
    async getLeaderboard(): Promise<any[]> {
        const token = useAuthStore.getState().token
        if (!token) return []

        try {
            const res = await fetch(`${API}/party/leaderboard`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
                const json = await res.json()
                return json.leaderboard || []
            }
        } catch { /* silent */ }
        return []
    }

    /** Fetch player profile */
    async getProfile(): Promise<{
        username: string; createdAt: string; battles: number; pokemonCount: number; money: number
    } | null> {
        const token = useAuthStore.getState().token
        if (!token) return null

        try {
            const res = await fetch(`${API}/party/profile`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) return await res.json()
        } catch { /* silent */ }
        return null
    }
}

// Singleton
export const playerState = new PlayerStateManager()
export default playerState
