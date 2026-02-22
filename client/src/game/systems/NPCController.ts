// ─────────────────────────────────────────────────────────────────────────────
// NPCController — Reusable NPC management system
//
// Manages NPC sprites, interaction detection, dialogue + choice flow,
// battle triggering, and per-NPC state persistence.
//
// Usage:
//   const npcs = new NPCController(scene, dialogue, npcDefs)
//   npcs.create()
//   // in update():
//   npcs.update(player, delta)
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser'
import { DialogueSystem } from './DialogueSystem'
import { ChoiceMenuUI } from './ChoiceMenuUI'
import { NotificationUI } from './NotificationUI'
import saveManager from './SaveManager'
import eventBus, { GameEvents } from './GameEventBus'

// ── Types ─────────────────────────────────────────────────────────────────

export interface NPCTrainerMon {
    creatureId: string
    name: string
    type: string
    level: number
    hp: number
    maxHp: number
    trainerName: string
    moves: { id: string; name: string; type: string; power: number }[]
}

export interface NPCDef {
    id: string
    name: string
    x: number
    y: number
    spriteKey?: string          // existing texture key; if omitted, one is generated
    hairColor?: number          // for auto-generated sprite
    shirtColor?: number         // for auto-generated sprite
    dialogue: string[]          // initial dialogue lines
    defeatedDialogue: string[]  // dialogue after being defeated
    continueDialogue: string[]  // extended conversation lines
    canBattle: boolean
    team?: NPCTrainerMon[]
    battleTeamName?: string     // display name in battle UI
    returnScene: string         // scene key to return to after battle
}

interface NPCInstance {
    def: NPCDef
    sprite: Phaser.GameObjects.Image
    label: Phaser.GameObjects.Text
    zone: Phaser.GameObjects.Zone
    defeated: boolean
    bobTween?: Phaser.Tweens.Tween
}

// ── HP calc helper (same formula used in LegendaryCaveScene) ──────────────
function calcHp(baseHp: number, level: number): number {
    return Math.floor(((2 * baseHp) * level) / 100 + level + 10)
}

// ═══════════════════════════════════════════════════════════════════════════
export class NPCController {
    private scene: Phaser.Scene
    private dialogue: DialogueSystem
    private choiceMenu: ChoiceMenuUI
    private notifyUI: NotificationUI
    private npcs: NPCInstance[] = []
    private _active = false          // true while NPC interaction is in progress
    private _activeNPC: NPCInstance | null = null
    private _choicePhase = false     // true while choice menu is showing
    private spaceKey: Phaser.Input.Keyboard.Key
    private interactionCooldown = 0

    constructor(scene: Phaser.Scene, dialogue: DialogueSystem, npcDefs: NPCDef[]) {
        this.scene = scene
        this.dialogue = dialogue
        this.choiceMenu = new ChoiceMenuUI(scene)
        this.notifyUI = new NotificationUI(scene)
        this.spaceKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

        // Build NPC instances
        for (const def of npcDefs) {
            this.npcs.push({
                def,
                sprite: null as any,
                label: null as any,
                zone: null as any,
                defeated: saveManager.getNPCState(def.id).defeated,
                bobTween: undefined,
            })
        }
    }

    /** Whether an NPC interaction is active (dialogue or choice menu) */
    active(): boolean {
        return this._active || this._choicePhase
    }

    // ── Create ────────────────────────────────────────────────────────────

    /** Create all NPC sprites, labels, and interaction zones */
    create(): void {
        for (const npc of this.npcs) {
            const def = npc.def

            // Generate sprite texture if needed
            const spriteKey = def.spriteKey ?? `npc_gen_${def.id}`
            if (!this.scene.textures.exists(spriteKey) && !def.spriteKey) {
                this.generateNPCTexture(
                    spriteKey,
                    def.hairColor ?? 0x604020,
                    def.shirtColor ?? 0x4060c0,
                )
            }

            // Sprite
            const useKey = this.scene.textures.exists(spriteKey) ? spriteKey : 'npc_elder'
            npc.sprite = this.scene.add.image(def.x, def.y, useKey)
                .setDisplaySize(32, 48).setDepth(3)

            // Idle bob animation
            npc.bobTween = this.scene.tweens.add({
                targets: npc.sprite,
                y: def.y - 2,
                duration: 1200 + Math.random() * 400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            })

            // Name label
            const labelColor = npc.defeated ? '#888888' : '#555555'
            npc.label = this.scene.add.text(def.x, def.y - 28, def.name, {
                fontSize: '9px', color: labelColor, fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(3)

            // Defeated indicator
            if (npc.defeated) {
                npc.label.setText(`${def.name} ✓`)
            }

            // Interaction zone (physics static body)
            npc.zone = this.scene.add.zone(def.x, def.y, 48, 48).setOrigin(0.5)
            this.scene.physics.add.existing(npc.zone, true)
        }
    }

    // ── Update ────────────────────────────────────────────────────────────

    /** Call from scene update(). Handles interaction detection and menu input. */
    update(player: any, delta: number): void {
        // Update choice menu
        if (this._choicePhase) {
            this.choiceMenu.update(delta)
            return
        }

        // Cooldown between interactions
        if (this.interactionCooldown > 0) {
            this.interactionCooldown -= delta
            return
        }

        // If dialogue ended and we had an active NPC, show choice menu
        if (this._active && !this.dialogue.active() && this._activeNPC && !this._choicePhase) {
            this.showChoiceMenu(this._activeNPC)
            return
        }

        // Check for new interaction (Space key near NPC)
        if (!this._active && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            for (const npc of this.npcs) {
                if (this.scene.physics.overlap(player, npc.zone)) {
                    this.startInteraction(npc)
                    break
                }
            }
        }
    }

    /** Check if player is overlapping any NPC zone (for scene to skip its own checks) */
    isOverlapping(player: any): boolean {
        for (const npc of this.npcs) {
            if (this.scene.physics.overlap(player, npc.zone)) return true
        }
        return false
    }

    // ── Interaction Flow ──────────────────────────────────────────────────

    private startInteraction(npc: NPCInstance): void {
        this._active = true
        this._activeNPC = npc

        eventBus.emit(GameEvents.NPC_INTERACT, { npcId: npc.def.id, name: npc.def.name })

        const lines = npc.defeated ? npc.def.defeatedDialogue : npc.def.dialogue

        if (npc.defeated) {
            // Defeated NPCs just show dialogue, no choice menu
            this.dialogue.show(lines, npc.def.name, () => {
                this._active = false
                this._activeNPC = null
                this.interactionCooldown = 300
                eventBus.emit(GameEvents.DIALOGUE_END, { npcId: npc.def.id })
            })
        } else {
            // Show initial dialogue, then choice menu on completion
            this.dialogue.show(lines, npc.def.name)
        }
    }

    private showChoiceMenu(npc: NPCInstance): void {
        this._choicePhase = true

        const options = npc.def.canBattle
            ? ['Talk', 'Fight', 'Run']
            : ['Talk', 'Run']

        this.choiceMenu.show(options, (index: number) => {
            this._choicePhase = false

            if (npc.def.canBattle) {
                switch (index) {
                    case 0: // Talk — continue conversation
                        this.continueConversation(npc)
                        break
                    case 1: // Fight
                        this.startBattle(npc)
                        break
                    case 2: // Run
                        this.endInteraction(npc)
                        break
                }
            } else {
                switch (index) {
                    case 0: // Talk
                        this.continueConversation(npc)
                        break
                    case 1: // Run
                        this.endInteraction(npc)
                        break
                }
            }
        })
    }

    private continueConversation(npc: NPCInstance): void {
        const lines = npc.def.continueDialogue.length > 0
            ? npc.def.continueDialogue
            : ['...']

        this.dialogue.show(lines, npc.def.name, () => {
            this._active = false
            this._activeNPC = null
            this.interactionCooldown = 300
            eventBus.emit(GameEvents.DIALOGUE_END, { npcId: npc.def.id })
        })
    }

    private startBattle(npc: NPCInstance): void {
        if (!npc.def.team || npc.def.team.length === 0) {
            this.endInteraction(npc)
            return
        }

        this._active = false
        this._activeNPC = null

        eventBus.emit(GameEvents.NPC_BATTLE_START, { npcId: npc.def.id, name: npc.def.name })

        // Transition to TrainerBattleScene
        this.scene.cameras.main.fadeOut(300, 0, 0, 0)
        this.scene.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.scene.start('TrainerBattle', {
                opponents: npc.def.team,
                trainerTeamName: npc.def.battleTeamName ?? npc.def.name,
                returnScene: npc.def.returnScene,
                returnData: {
                    from: 'npcBattle',
                    npcId: npc.def.id,
                },
            })
        })
    }

    private endInteraction(npc: NPCInstance): void {
        this._active = false
        this._activeNPC = null
        this.interactionCooldown = 300
        eventBus.emit(GameEvents.DIALOGUE_END, { npcId: npc.def.id })
    }

    // ── NPC State ─────────────────────────────────────────────────────────

    /**
     * Mark an NPC as defeated. Called from the scene after returning from battle.
     * Updates visual indicators and persists state.
     */
    markDefeated(npcId: string): void {
        const npc = this.npcs.find(n => n.def.id === npcId)
        if (!npc || npc.defeated) return

        npc.defeated = true
        npc.label.setText(`${npc.def.name} ✓`)
        npc.label.setColor('#888888')

        saveManager.setNPCState(npcId, { defeated: true, dialogueState: 'defeated' })
        eventBus.emit(GameEvents.NPC_BATTLE_WIN, { npcId, name: npc.def.name })
    }

    /** Check if an NPC is defeated */
    isDefeated(npcId: string): boolean {
        const npc = this.npcs.find(n => n.def.id === npcId)
        return npc?.defeated ?? false
    }

    // ── Cleanup ───────────────────────────────────────────────────────────

    destroy(): void {
        this.choiceMenu.hide()
        for (const npc of this.npcs) {
            npc.bobTween?.destroy()
            npc.sprite?.destroy()
            npc.label?.destroy()
            npc.zone?.destroy()
        }
        this.npcs = []
    }

    // ── Sprite Generation ─────────────────────────────────────────────────

    /**
     * Generate a simple 16×24 pixel NPC sprite (GBA-style).
     * Produces a colored character with head, hair, shirt, and pants.
     */
    private generateNPCTexture(key: string, hairColor: number, shirtColor: number): void {
        if (this.scene.textures.exists(key)) return

        const PX = 2
        const w = 16 * PX, h = 24 * PX
        const tex = this.scene.textures.createCanvas(key, w, h)!
        const ctx = tex.getContext()

        const fill = (x: number, y: number, w: number, h: number, color: number) => {
            ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
            ctx.fillRect(x * PX, y * PX, w * PX, h * PX)
        }

        // Hair
        fill(4, 0, 8, 4, hairColor)
        fill(3, 1, 1, 3, hairColor)
        fill(12, 1, 1, 3, hairColor)

        // Skin (head)
        fill(4, 3, 8, 6, 0xf0c0a0)
        // Eyes
        fill(6, 5, 1, 1, 0x202020)
        fill(9, 5, 1, 1, 0x202020)
        // Mouth
        fill(7, 7, 2, 1, 0xd09080)

        // Shirt
        fill(3, 9, 10, 7, shirtColor)
        // Arms
        fill(2, 10, 1, 5, shirtColor)
        fill(13, 10, 1, 5, shirtColor)
        // Hands
        fill(2, 15, 1, 1, 0xf0c0a0)
        fill(13, 15, 1, 1, 0xf0c0a0)

        // Pants
        fill(4, 16, 3, 5, 0x404080)
        fill(9, 16, 3, 5, 0x404080)

        // Shoes
        fill(3, 21, 4, 2, 0x604020)
        fill(9, 21, 4, 2, 0x604020)

        tex.refresh()
    }
}
