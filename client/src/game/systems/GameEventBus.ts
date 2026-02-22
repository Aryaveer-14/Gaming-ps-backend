// ─────────────────────────────────────────────────────────────────────────────
// GameEventBus — Singleton event emitter for cross-scene communication
// ─────────────────────────────────────────────────────────────────────────────

type EventCallback = (...args: any[]) => void

class GameEventBus {
    private listeners: Map<string, EventCallback[]> = new Map()

    on(event: string, callback: EventCallback): void {
        if (!this.listeners.has(event)) this.listeners.set(event, [])
        this.listeners.get(event)!.push(callback)
    }

    off(event: string, callback: EventCallback): void {
        const cbs = this.listeners.get(event)
        if (cbs) {
            this.listeners.set(event, cbs.filter(cb => cb !== callback))
        }
    }

    emit(event: string, ...args: any[]): void {
        const cbs = this.listeners.get(event)
        if (cbs) cbs.forEach(cb => cb(...args))
    }

    clear(): void {
        this.listeners.clear()
    }
}

// ── Event name constants ────────────────────────────────────────────────────
export const GameEvents = {
    BATTLE_WIN:          'battle:win',
    BATTLE_LOSE:         'battle:lose',
    POKEMON_CAUGHT:      'pokemon:caught',
    POKEMON_FAINT:       'pokemon:faint',
    POKEMON_LEVEL_UP:    'pokemon:levelUp',
    POKEMON_SWITCH:      'pokemon:switch',
    MONEY_CHANGED:       'money:changed',
    XP_GAINED:           'xp:gained',
    PARTY_UPDATED:       'party:updated',
    PLAYER_HEALED:       'player:healed',
    // ── Checkpoint / Save / NPC events ──────────────────────────
    CHECKPOINT_REACHED:  'checkpoint:reached',
    SESSION_SAVE:        'session:save',
    NPC_INTERACT:        'npc:interact',
    DIALOGUE_END:        'npc:dialogueEnd',
    NPC_BATTLE_START:    'npc:battleStart',
    NPC_BATTLE_WIN:      'npc:battleWin',
} as const

export const eventBus = new GameEventBus()
export default eventBus
