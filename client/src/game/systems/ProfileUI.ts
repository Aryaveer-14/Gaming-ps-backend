// ─────────────────────────────────────────────────────────────────────────────
// ProfileUI — Bottom-right TRAINER CARD toggle
//
// A "PROFILE" button in the bottom-right corner toggles a trainer card that
// shows: username, join date, battles, caught count, lead Pokémon with type
// badge, HP bar, and level.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser'
import playerState from './PlayerState'
import eventBus, { GameEvents } from './GameEventBus'
import { useAuthStore } from '../../store/authStore'

const W = 800
const H = 576

// Type badge colors (FRLG style)
const TYPE_COLORS: Record<string, number> = {
    Fire:     0xf08030, Water:    0x6890f0, Grass:    0x78c850,
    Electric: 0xf8d030, Normal:   0xa8a878, Poison:   0xa040a0,
    Ground:   0xe0c068, Rock:     0xb8a038, Bug:      0xa8b820,
    Ghost:    0x705898, Psychic:  0xf85888, Ice:      0x98d8d8,
    Dragon:   0x7038f8, Dark:     0x705848, Steel:    0xb8b8d0,
    Fighting: 0xc03028, Flying:   0xa890f0, Fairy:    0xee99ac,
}

export class ProfileUI {
    private scene: Phaser.Scene
    private btnContainer?: Phaser.GameObjects.Container
    private cardContainer?: Phaser.GameObjects.Container
    private _cardOpen = false
    private _onPartyUpdate = () => { if (this._cardOpen) this.rebuildCard() }
    private _onMoneyChange = () => { if (this._cardOpen) this.rebuildCard() }
    private _onXpGain = () => { if (this._cardOpen) this.rebuildCard() }

    constructor(scene: Phaser.Scene) {
        this.scene = scene
    }

    create(): void {
        // ── PROFILE toggle button (bottom-right) ────────────────
        this.btnContainer = this.scene.add.container(0, 0).setDepth(90).setScrollFactor(0)

        const btnX = W - 8, btnY = H - 8
        const btnBg = this.scene.add.graphics()
        btnBg.fillStyle(0x2060c0, 0.92)
        btnBg.fillRoundedRect(btnX - 72, btnY - 22, 72, 22, 4)
        btnBg.lineStyle(1, 0x80b0f0)
        btnBg.strokeRoundedRect(btnX - 72, btnY - 22, 72, 22, 4)
        this.btnContainer.add(btnBg)

        const btnText = this.scene.add.text(btnX - 36, btnY - 11, '✕  PROFILE', {
            fontSize: '10px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5)
        this.btnContainer.add(btnText)

        // Invisible hit area for click
        const hitArea = this.scene.add.rectangle(btnX - 36, btnY - 11, 72, 22, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
        hitArea.on('pointerdown', () => this.toggleCard())
        this.btnContainer.add(hitArea)

        // Listen for state changes
        eventBus.on(GameEvents.PARTY_UPDATED, this._onPartyUpdate)
        eventBus.on(GameEvents.MONEY_CHANGED, this._onMoneyChange)
        eventBus.on(GameEvents.XP_GAINED, this._onXpGain)
    }

    private toggleCard(): void {
        if (this._cardOpen) {
            this.closeCard()
        } else {
            this.openCard()
        }
    }

    private async openCard(): Promise<void> {
        this._cardOpen = true
        await this.rebuildCard()
    }

    private closeCard(): void {
        this._cardOpen = false
        this.cardContainer?.destroy()
        this.cardContainer = undefined
    }

    private async rebuildCard(): Promise<void> {
        this.cardContainer?.destroy()
        this.cardContainer = this.scene.add.container(0, 0).setDepth(89).setScrollFactor(0)

        const profile = await playerState.getProfile()
        const lead = playerState.lead

        // Card dimensions
        const CARD_W = 260
        const CARD_H = 166
        const CX = W - CARD_W - 8
        const CY = H - CARD_H - 34

        // ── Card background ─────────────────────────────────────
        const cardBg = this.scene.add.graphics()
        cardBg.fillStyle(0x101828, 0.92)
        cardBg.fillRoundedRect(CX, CY, CARD_W, CARD_H, 6)
        cardBg.lineStyle(1.5, 0xf8d030)
        cardBg.strokeRoundedRect(CX, CY, CARD_W, CARD_H, 6)
        this.cardContainer.add(cardBg)

        // ── TRAINER CARD title ──────────────────────────────────
        const title = this.scene.add.text(CX + CARD_W / 2, CY + 10, 'TRAINER CARD', {
            fontSize: '12px', color: '#f8d030', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5, 0)
        this.cardContainer.add(title)

        // ── Separator ───────────────────────────────────────────
        const sep = this.scene.add.graphics()
        sep.fillStyle(0xf8d030, 0.3)
        sep.fillRect(CX + 10, CY + 26, CARD_W - 20, 1)
        this.cardContainer.add(sep)

        // ── Player info (left column) ───────────────────────────
        const infoX = CX + 14
        const infoY = CY + 34

        // Username
        const username = profile?.username ?? useAuthStore.getState().username ?? '???'
        const nameText = this.scene.add.text(infoX, infoY, username.toUpperCase(), {
            fontSize: '12px', color: '#e04040', fontFamily: 'monospace', fontStyle: 'bold',
        })
        this.cardContainer.add(nameText)

        // Since date
        let sinceStr = '---'
        if (profile?.createdAt) {
            const d = new Date(profile.createdAt)
            sinceStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
        }
        const sinceText = this.scene.add.text(infoX, infoY + 16, `Since: ${sinceStr}`, {
            fontSize: '9px', color: '#a0b0c0', fontFamily: 'monospace',
        })
        this.cardContainer.add(sinceText)

        // Battles
        const battlesText = this.scene.add.text(infoX, infoY + 28, `Battles: ${profile?.battles ?? 0}`, {
            fontSize: '9px', color: '#a0b0c0', fontFamily: 'monospace',
        })
        this.cardContainer.add(battlesText)

        // ── Separator 2 ────────────────────────────────────────
        const sep2 = this.scene.add.graphics()
        sep2.fillStyle(0x405060, 0.5)
        sep2.fillRect(CX + 10, infoY + 44, CARD_W - 20, 1)
        this.cardContainer.add(sep2)

        // ── POKéMON section ────────────────────────────────────
        const pokeY = infoY + 52
        const pokemonCount = playerState.caughtCount

        const pokeLabel = this.scene.add.text(infoX, pokeY, `POKéMON (${pokemonCount})`, {
            fontSize: '10px', color: '#f8d030', fontFamily: 'monospace', fontStyle: 'bold',
        })
        this.cardContainer.add(pokeLabel)

        if (lead) {
            const leadName = lead.nickname || this.capitalise(lead.creatureId)
            const leadY = pokeY + 16

            // Lead creature name with star
            const leadLabel = this.scene.add.text(infoX, leadY, `${leadName} ★`, {
                fontSize: '11px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
            })
            this.cardContainer.add(leadLabel)

            // Type badge
            const type = lead.type || 'Normal'
            const typeColor = TYPE_COLORS[type] ?? 0xa8a878
            const typeBadge = this.scene.add.graphics()
            typeBadge.fillStyle(typeColor, 1)
            typeBadge.fillRoundedRect(infoX, leadY + 16, 40, 14, 3)
            this.cardContainer.add(typeBadge)

            const typeText = this.scene.add.text(infoX + 20, leadY + 17, type.toUpperCase(), {
                fontSize: '8px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
            }).setOrigin(0.5, 0)
            this.cardContainer.add(typeText)

            // Lead creature sprite (right side)
            const sprKey = `creature_${lead.creatureId}_front`
            if (this.scene.textures.exists(sprKey)) {
                const spr = this.scene.add.image(CX + CARD_W - 50, CY + 56, sprKey)
                    .setDisplaySize(64, 64)
                this.cardContainer.add(spr)
            }

            // Lv label
            const lvLabel = this.scene.add.text(CX + CARD_W - 80, CY + 40, `Lv${lead.level}`, {
                fontSize: '12px', color: '#f8d030', fontFamily: 'monospace', fontStyle: 'bold',
            })
            this.cardContainer.add(lvLabel)

            // HP bar
            const hpBarX = infoX + 46
            const hpBarY = leadY + 22

            const hpLabel = this.scene.add.text(hpBarX, hpBarY, 'HP', {
                fontSize: '8px', color: '#f8a030', fontFamily: 'monospace', fontStyle: 'bold',
            })
            this.cardContainer.add(hpLabel)

            // HP bar bg
            const hpBarBgGfx = this.scene.add.graphics()
            hpBarBgGfx.fillStyle(0x404048)
            hpBarBgGfx.fillRoundedRect(hpBarX + 18, hpBarY + 1, 80, 10, 2)
            this.cardContainer.add(hpBarBgGfx)

            // HP bar fill
            const hpFrac = lead.maxHp > 0 ? Math.max(0, lead.currentHp / lead.maxHp) : 0
            const hpColor = hpFrac > 0.5 ? 0x40c040 : hpFrac > 0.2 ? 0xf8c030 : 0xe04030
            const hpFill = this.scene.add.graphics()
            hpFill.fillStyle(hpColor)
            hpFill.fillRoundedRect(hpBarX + 19, hpBarY + 2, 78 * hpFrac, 8, 2)
            this.cardContainer.add(hpFill)

            // HP numbers
            const hpNumText = this.scene.add.text(CX + CARD_W - 14, hpBarY + 1, `${lead.currentHp}/${lead.maxHp}`, {
                fontSize: '9px', color: '#a0b0c0', fontFamily: 'monospace',
            }).setOrigin(1, 0)
            this.cardContainer.add(hpNumText)
        }
    }

    private capitalise(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1)
    }

    destroy(): void {
        eventBus.off(GameEvents.PARTY_UPDATED, this._onPartyUpdate)
        eventBus.off(GameEvents.MONEY_CHANGED, this._onMoneyChange)
        eventBus.off(GameEvents.XP_GAINED, this._onXpGain)
        this.btnContainer?.destroy()
        this.cardContainer?.destroy()
        this.btnContainer = undefined
        this.cardContainer = undefined
    }
}
