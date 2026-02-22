// ─────────────────────────────────────────────────────────────────────────────
// SaveManager — Automatic progress saving & session persistence
//
// Saves player state on:
//   • periodic auto-save (every 60s)
//   • browser tab close / navigation (beforeunload)
//   • tab visibility change (alt-tab away)
//   • inactivity timeout (5 min idle)
//   • manual call from scenes
//
// Data is stored in localStorage. Critical data (team HP, money) is already
// persisted to the server via PlayerState methods.
// ─────────────────────────────────────────────────────────────────────────────

import eventBus, { GameEvents } from './GameEventBus'
import playerState from './PlayerState'
import checkpointManager from './CheckpointManager'

export interface SaveData {
    checkpoint:     { name: string; x: number; y: number; mapId: string } | null
    currentMap:     string
    playerPosition: { x: number; y: number }
    npcStates:      Record<string, { defeated: boolean; dialogueState: string }>
    money:          number
    timestamp:      number
}

const STORAGE_KEY    = 'pokemon-save-data'
const NPC_STATE_KEY  = 'pokemon-npc-states'
const AUTO_SAVE_MS   = 60_000   // 60 seconds
const IDLE_TIMEOUT   = 300_000  // 5 minutes

class SaveManagerClass {
    private _autoSaveTimer: ReturnType<typeof setInterval> | null = null
    private _idleTimer: ReturnType<typeof setTimeout> | null = null
    private _currentMap   = ''
    private _playerX      = 0
    private _playerY      = 0
    private _browserHandlersSet = false

    // ── Public API ────────────────────────────────────────────────────────

    /** Update the tracked position (call from scene update or periodically) */
    setPosition(map: string, x: number, y: number): void {
        this._currentMap = map
        this._playerX = x
        this._playerY = y
    }

    /** Save current state to localStorage */
    save(): void {
        const cp = checkpointManager.getActive()
        const data: SaveData = {
            checkpoint: cp ? {
                name: cp.name,
                x: cp.playerPosition.x,
                y: cp.playerPosition.y,
                mapId: cp.mapId,
            } : null,
            currentMap:     this._currentMap,
            playerPosition: { x: this._playerX, y: this._playerY },
            npcStates:      this.loadNPCStates(),
            money:          playerState.money,
            timestamp:      Date.now(),
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch { /* silent */ }

        eventBus.emit(GameEvents.SESSION_SAVE, data)
    }

    /** Load saved state from localStorage */
    load(): SaveData | null {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) return JSON.parse(raw) as SaveData
        } catch { /* silent */ }
        return null
    }

    /** Check if a save exists */
    hasSave(): boolean {
        try {
            return !!localStorage.getItem(STORAGE_KEY)
        } catch { return false }
    }

    /** Clear saved state */
    clear(): void {
        try {
            localStorage.removeItem(STORAGE_KEY)
            localStorage.removeItem(NPC_STATE_KEY)
        } catch { /* silent */ }
    }

    // ── NPC State Persistence ─────────────────────────────────────────────

    /** Save NPC states to localStorage */
    saveNPCStates(states: Record<string, { defeated: boolean; dialogueState: string }>): void {
        try {
            localStorage.setItem(NPC_STATE_KEY, JSON.stringify(states))
        } catch { /* silent */ }
    }

    /** Load NPC states from localStorage */
    loadNPCStates(): Record<string, { defeated: boolean; dialogueState: string }> {
        try {
            const raw = localStorage.getItem(NPC_STATE_KEY)
            if (raw) return JSON.parse(raw)
        } catch { /* silent */ }
        return {}
    }

    /** Get a single NPC's state */
    getNPCState(npcId: string): { defeated: boolean; dialogueState: string } {
        const all = this.loadNPCStates()
        return all[npcId] ?? { defeated: false, dialogueState: 'default' }
    }

    /** Update a single NPC's state */
    setNPCState(npcId: string, state: { defeated: boolean; dialogueState: string }): void {
        const all = this.loadNPCStates()
        all[npcId] = state
        this.saveNPCStates(all)
    }

    // ── Auto-Save Timer ───────────────────────────────────────────────────

    /** Start periodic auto-save */
    startAutoSave(): void {
        this.stopAutoSave()
        this._autoSaveTimer = setInterval(() => {
            if (this._currentMap) this.save()
        }, AUTO_SAVE_MS)
    }

    /** Stop periodic auto-save */
    stopAutoSave(): void {
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer)
            this._autoSaveTimer = null
        }
    }

    // ── Browser Event Handlers ────────────────────────────────────────────

    /** Set up browser event handlers for save-on-close, save-on-tab-switch */
    setupBrowserHandlers(): void {
        if (this._browserHandlersSet) return
        this._browserHandlersSet = true

        // Save on tab close / reload
        window.addEventListener('beforeunload', () => {
            if (this._currentMap) this.save()
        })

        // Save on tab visibility change (alt-tab, minimize)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this._currentMap) {
                this.save()
            }
        })

        // Idle detection — save after inactivity
        this.resetIdleTimer()
        const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart']
        activityEvents.forEach(evt => {
            window.addEventListener(evt, () => this.resetIdleTimer(), { passive: true })
        })
    }

    /** Reset the inactivity timer */
    private resetIdleTimer(): void {
        if (this._idleTimer) clearTimeout(this._idleTimer)
        this._idleTimer = setTimeout(() => {
            if (this._currentMap) this.save()
        }, IDLE_TIMEOUT)
    }
}

/** Singleton instance */
export const saveManager = new SaveManagerClass()
export default saveManager
