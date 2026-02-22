// ─────────────────────────────────────────────────────────────────────────────
// CheckpointManager — World checkpoint system for respawn & progress tracking
//
// Stores the player's last reached checkpoint. On reload or defeat,
// the player respawns at the active checkpoint position.
// ─────────────────────────────────────────────────────────────────────────────

import eventBus, { GameEvents } from './GameEventBus'

export interface Checkpoint {
    name: string
    playerPosition: { x: number; y: number }
    mapId: string
}

/** Predefined checkpoint trigger locations */
export const CHECKPOINT_DEFS: Record<string, Omit<Checkpoint, 'playerPosition'>> = {
    HOMETOWN:        { name: 'Pallet Town',     mapId: 'Outdoor' },
    ROUTE1:          { name: 'Route 1',          mapId: 'Route1' },
    CITY:            { name: 'Viridian City',    mapId: 'ViridianCity' },
    LEGENDARY_CAVE:  { name: 'Legendary Cave',  mapId: 'LegendaryCave' },
}

const STORAGE_KEY = 'pokemon-checkpoint'

class CheckpointManagerClass {
    private _active: Checkpoint | null = null

    constructor() {
        this.loadFromStorage()
    }

    /** Get the currently active checkpoint */
    getActive(): Checkpoint | null {
        return this._active
    }

    /**
     * Reach a checkpoint — update the active checkpoint and persist.
     * @param checkpointId Key from CHECKPOINT_DEFS (e.g. 'HOMETOWN')
     * @param playerPosition Current player position { x, y }
     */
    reach(checkpointId: string, playerPosition: { x: number; y: number }): void {
        const def = CHECKPOINT_DEFS[checkpointId]
        if (!def) {
            console.warn(`[CheckpointManager] Unknown checkpoint: ${checkpointId}`)
            return
        }

        this._active = {
            name: def.name,
            playerPosition: { ...playerPosition },
            mapId: def.mapId,
        }

        this.saveToStorage()
        eventBus.emit(GameEvents.CHECKPOINT_REACHED, this._active)
    }

    /**
     * Get respawn data for the active checkpoint.
     * Returns null if no checkpoint has been reached yet.
     */
    getRespawnData(): { mapId: string; x: number; y: number } | null {
        if (!this._active) return null
        return {
            mapId: this._active.mapId,
            x: this._active.playerPosition.x,
            y: this._active.playerPosition.y,
        }
    }

    /** Clear checkpoint (e.g. on new game) */
    clear(): void {
        this._active = null
        try { localStorage.removeItem(STORAGE_KEY) } catch { /* silent */ }
    }

    // ── Persistence ──────────────────────────────────────────────────────

    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._active))
        } catch { /* silent */ }
    }

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
                this._active = JSON.parse(raw)
            }
        } catch { /* silent */ }
    }
}

/** Singleton instance */
export const checkpointManager = new CheckpointManagerClass()
export default checkpointManager
