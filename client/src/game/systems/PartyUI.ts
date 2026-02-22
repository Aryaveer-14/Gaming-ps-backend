// ─────────────────────────────────────────────────────────────────────────────
// PartyUI — FRLG-style Party overlay for battles and overworld
//
// Shows all party members with HP bars, level, and lead indicator (★).
// In battle mode, allows selecting a Pokémon to switch in.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser'
import type { PartyMon } from './PlayerState'

const W = 800, H = 576
const PANEL_W = 340, PANEL_H = 420
const PANEL_X = (W - PANEL_W) / 2
const PANEL_Y = (H - PANEL_H) / 2
const SLOT_H = 58

export class PartyUI {
    private scene: Phaser.Scene
    private container!: Phaser.GameObjects.Container
    private _active = false
    private _battleMode = false
    private party: PartyMon[] = []
    private selectedIndex = 0
    private onSelect?: (mon: PartyMon) => void
    private onCancel?: () => void
    private slotBgs: Phaser.GameObjects.Rectangle[] = []
    private cursorArrow!: Phaser.GameObjects.Text

    // Keys
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!: Phaser.Input.Keyboard.Key
    private escKey!: Phaser.Input.Keyboard.Key

    constructor(scene: Phaser.Scene) {
        this.scene = scene
        this.cursors = scene.input.keyboard!.createCursorKeys()
        this.spaceKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.escKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    }

    active(): boolean { return this._active }

    /**
     * Open the party overlay.
     * @param party Current party list
     * @param battleMode If true, allows selecting a non-fainted mon to switch
     * @param onSelect Callback when a Pokémon is selected (battle switch)
     * @param onCancel Callback when cancelled (ESC)
     * @param currentCreatureId The currently active creature's DB id (can't switch to self)
     */
    open(
        party: PartyMon[],
        battleMode: boolean,
        onSelect?: (mon: PartyMon) => void,
        onCancel?: () => void,
        currentCreatureId?: string,
    ): void {
        if (this._active) return
        this._active = true
        this._battleMode = battleMode
        this.party = party
        this.selectedIndex = 0
        this.onSelect = onSelect
        this.onCancel = onCancel
        this.slotBgs = []

        this.container = this.scene.add.container(0, 0).setDepth(100)

        // Semi-transparent backdrop
        const backdrop = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6)
        this.container.add(backdrop)

        // Panel background
        const panel = this.scene.add.graphics()
        panel.fillStyle(0x283848).fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12)
        panel.lineStyle(2, 0x506880).strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12)
        this.container.add(panel)

        // Title
        const titleText = battleMode ? 'Choose a Pokémon' : 'Your Party'
        const title = this.scene.add.text(W / 2, PANEL_Y + 14, titleText, {
            fontSize: '14px', color: '#f8f8f0', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5, 0)
        this.container.add(title)

        // Party slots
        const startY = PANEL_Y + 42
        this.party.forEach((mon, i) => {
            const slotY = startY + i * SLOT_H
            const isFainted = mon.currentHp <= 0
            const isCurrent = mon.id === currentCreatureId

            // Slot background
            const bg = this.scene.add.rectangle(W / 2, slotY + SLOT_H / 2 - 4, PANEL_W - 20, SLOT_H - 6,
                isFainted ? 0x583838 : (mon.isLead ? 0x385848 : 0x384858), 0.8)
            bg.setStrokeStyle(1, isCurrent ? 0x80c0f0 : 0x506070)
            this.slotBgs.push(bg)
            this.container.add(bg)

            // Lead star
            if (mon.isLead) {
                const star = this.scene.add.text(PANEL_X + 16, slotY + 6, '★', {
                    fontSize: '14px', color: '#f8d030', fontFamily: 'monospace',
                })
                this.container.add(star)
            }

            // Creature sprite (small)
            const spriteKey = `creature_${mon.creatureId}_front`
            if (this.scene.textures.exists(spriteKey)) {
                const sprite = this.scene.add.image(PANEL_X + 44, slotY + SLOT_H / 2 - 4, spriteKey)
                    .setDisplaySize(40, 40)
                if (isFainted) sprite.setTint(0x888888)
                this.container.add(sprite)
            }

            // Name + level
            const name = mon.nickname || this.capitalise(mon.creatureId)
            const nameText = this.scene.add.text(PANEL_X + 70, slotY + 4, `${name}`, {
                fontSize: '12px', color: isFainted ? '#888' : '#f8f8f0', fontFamily: 'monospace', fontStyle: 'bold',
            })
            this.container.add(nameText)

            const lvlText = this.scene.add.text(PANEL_X + PANEL_W - 30, slotY + 4, `Lv${mon.level}`, {
                fontSize: '10px', color: '#a0b0c0', fontFamily: 'monospace',
            }).setOrigin(1, 0)
            this.container.add(lvlText)

            // HP bar
            const barW = 160, barH = 8
            const barX = PANEL_X + 70, barY = slotY + 24
            const barBg = this.scene.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH, 0x383838)
            this.container.add(barBg)

            const hpFrac = Math.max(0, mon.currentHp / mon.maxHp)
            const hpColor = hpFrac > 0.5 ? 0x40c040 : hpFrac > 0.2 ? 0xf8c030 : 0xe04030
            const hpBar = this.scene.add.rectangle(barX, barY + barH / 2, barW * hpFrac, barH, hpColor).setOrigin(0, 0.5)
            this.container.add(hpBar)

            const hpLabel = this.scene.add.text(PANEL_X + 70, slotY + 36, `${mon.currentHp}/${mon.maxHp}`, {
                fontSize: '9px', color: '#a0b0c0', fontFamily: 'monospace',
            })
            this.container.add(hpLabel)

            // XP bar (small, below HP)
            const xpBarW = 100
            const xpThreshold = mon.level * 100
            const xpFrac = Math.min(1, mon.xp / xpThreshold)
            const xpBarBg = this.scene.add.rectangle(PANEL_X + 180, barY + barH / 2, xpBarW, 4, 0x282838)
            this.container.add(xpBarBg)
            const xpBar = this.scene.add.rectangle(PANEL_X + 180 - xpBarW / 2 + (xpBarW * xpFrac) / 2, barY + barH / 2, xpBarW * xpFrac, 4, 0x40a0f0).setOrigin(0.5, 0.5)
            this.container.add(xpBar)

            // Fainted label
            if (isFainted) {
                const faintLabel = this.scene.add.text(PANEL_X + PANEL_W - 30, slotY + 36, 'FNT', {
                    fontSize: '9px', color: '#e04030', fontFamily: 'monospace', fontStyle: 'bold',
                }).setOrigin(1, 0)
                this.container.add(faintLabel)
            }
        })

        // Selection cursor arrow
        this.cursorArrow = this.scene.add.text(PANEL_X + 6, startY + 14, '▶', {
            fontSize: '13px', color: '#f8f8f0', fontFamily: 'monospace',
        })
        this.container.add(this.cursorArrow)

        // Hint text
        const hint = battleMode ? 'SPACE: Select  |  ESC: Cancel' : 'ESC: Close'
        const hintText = this.scene.add.text(W / 2, PANEL_Y + PANEL_H - 16, hint, {
            fontSize: '9px', color: '#8090a0', fontFamily: 'monospace',
        }).setOrigin(0.5)
        this.container.add(hintText)

        this.updateSelection()
    }

    private updateSelection(): void {
        if (!this._active) return
        const startY = PANEL_Y + 42
        this.cursorArrow.setY(startY + this.selectedIndex * SLOT_H + 14)

        // Highlight selected slot
        this.slotBgs.forEach((bg, i) => {
            bg.setAlpha(i === this.selectedIndex ? 1 : 0.7)
        })
    }

    update(): void {
        if (!this._active) return

        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1)
            this.updateSelection()
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
            this.selectedIndex = Math.min(this.party.length - 1, this.selectedIndex + 1)
            this.updateSelection()
        }

        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.close()
            this.onCancel?.()
        }

        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this._battleMode) {
            const selected = this.party[this.selectedIndex]
            if (selected && selected.currentHp > 0) {
                this.close()
                this.onSelect?.(selected)
            }
        }
    }

    close(): void {
        if (!this._active) return
        this._active = false
        this.container?.destroy()
    }

    private capitalise(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1)
    }
}
