import Phaser from 'phaser'
import playerState from './PlayerState'
import { useAuthStore } from '../../store/authStore'

// ─────────────────────────────────────────────────────────────────────────────
// InventoryUI — FRLG-style inventory bag overlay  (open with "I" or bag icon)
// ─────────────────────────────────────────────────────────────────────────────

interface InvItem {
    itemName: string
    quantity: number
}

const W = 800, H = 576
const PANEL_W = 380, PANEL_H = 400
const PX = W - PANEL_W - 20, PY = 30
const ROW_H = 36
const VISIBLE_ROWS = 8
const PAD = 14

const ITEM_NAMES: Record<string, string> = {
    'potion':        'Potion',
    'super_potion':  'Super Potion',
    'antidote':      'Antidote',
    'paralyze_heal': 'Paralyze Heal',
    'poke_ball':     'Poké Ball',
    'great_ball':    'Great Ball',
    'repel':         'Repel',
    'escape_rope':   'Escape Rope',
    'revive':        'Revive',
    'full_heal':     'Full Heal',
}

const ITEM_DESCRIPTIONS: Record<string, string> = {
    'potion':        'Restores 20 HP to one Pokémon.',
    'super_potion':  'Restores 50 HP to one Pokémon.',
    'antidote':      'Cures a poisoned Pokémon.',
    'paralyze_heal': 'Cures a paralyzed Pokémon.',
    'poke_ball':     'A ball for catching wild Pokémon.',
    'great_ball':    'Better catch rate than a Poké Ball.',
    'repel':         'Repels weak wild Pokémon for 100 steps.',
    'escape_rope':   'Escape instantly from a cave.',
    'revive':        'Revives a fainted Pokémon to half HP.',
    'full_heal':     'Cures all status problems.',
}

const USABLE_ITEMS = new Set(['potion', 'super_potion', 'revive', 'antidote', 'paralyze_heal', 'full_heal'])

export class InventoryUI {
    private scene: Phaser.Scene
    private container!: Phaser.GameObjects.Container
    private _active = false
    private items: InvItem[] = []
    private money = 0
    private cursor = 0
    private scroll = 0
    private rows: Phaser.GameObjects.Container[] = []
    private descText!: Phaser.GameObjects.Text
    private moneyText!: Phaser.GameObjects.Text
    private arrowImg!: Phaser.GameObjects.Text
    private keys!: {
        up: Phaser.Input.Keyboard.Key
        down: Phaser.Input.Keyboard.Key
        esc: Phaser.Input.Keyboard.Key
        i: Phaser.Input.Keyboard.Key
        space: Phaser.Input.Keyboard.Key
    }
    private bagBtn!: Phaser.GameObjects.Container
    private _bagBtnActive = false

    constructor(scene: Phaser.Scene) {
        this.scene = scene
        this.keys = {
            up:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
            down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            esc: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
            i:   scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I),
            space: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        }
    }

    active() { return this._active }

    /* ── Create the persistent bag button (call once in create()) ── */
    createBagButton() {
        const bx = W - 52, by = 18
        const bg = this.scene.add.rectangle(0, 0, 40, 40, 0x182848, 0.85)
            .setStrokeStyle(2, 0xf8f8f8)
        const icon = this.scene.add.text(0, 0, '🎒', { fontSize: '20px' }).setOrigin(0.5)
        this.bagBtn = this.scene.add.container(bx, by, [bg, icon]).setDepth(90).setScrollFactor(0)
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            if (!this._active) this.open()
            else this.close()
        })
        this._bagBtnActive = true
    }

    async open() {
        if (this._active) return
        this._active = true
        this.cursor = 0
        this.scroll = 0

        const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'
        const token = (this.scene.registry.get('token') as string) || useAuthStore.getState().token || ''
        try {
            const res = await fetch(`${base}/inventory`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
                const data = await res.json()
                this.items = data.items ?? []
                this.money = data.money ?? 0
            }
        } catch { /* offline fallback */ }

        this.buildUI()
    }

    private buildUI() {
        const children: Phaser.GameObjects.GameObject[] = []

        // Semi-transparent background
        const dim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.4).setDepth(0)
        dim.setInteractive() // Blocks clicks beneath
        children.push(dim)

        // Panel border + background
        const border = this.scene.add.rectangle(PX + PANEL_W / 2, PY + PANEL_H / 2, PANEL_W + 4, PANEL_H + 4, 0xf8f8f8).setDepth(1)
        const bg = this.scene.add.rectangle(PX + PANEL_W / 2, PY + PANEL_H / 2, PANEL_W, PANEL_H, 0x182040).setDepth(1)
        children.push(border, bg)

        // Title
        const title = this.scene.add.text(PX + PANEL_W / 2, PY + 12, '── BAG ──', {
            fontFamily: 'monospace', fontSize: '15px', color: '#ffd700', fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(2)
        children.push(title)

        // Money — prominent display with coin icon
        const moneyVal = this.money || playerState.money || 0
        const moneyBg = this.scene.add.graphics().setDepth(2)
        moneyBg.fillStyle(0x0d1a30, 0.9)
        moneyBg.fillRoundedRect(PX + PAD, PY + 12, 100, 18, 4)
        moneyBg.lineStyle(1, 0xf0d860, 0.5)
        moneyBg.strokeRoundedRect(PX + PAD, PY + 12, 100, 18, 4)
        children.push(moneyBg)

        const moneyIcon = this.scene.add.text(PX + PAD + 6, PY + 13, '💰', {
            fontSize: '12px',
        }).setDepth(3)
        children.push(moneyIcon)

        this.moneyText = this.scene.add.text(PX + PAD + 24, PY + 14, `₽${moneyVal}`, {
            fontFamily: 'monospace', fontSize: '12px', color: '#88ff88', fontStyle: 'bold',
        }).setDepth(3)
        children.push(this.moneyText)

        const hdrY = PY + 38
        const sep = this.scene.add.rectangle(PX + PANEL_W / 2, hdrY, PANEL_W - 20, 1, 0x445588).setDepth(2)
        children.push(sep)

        const listY = hdrY + 8
        this.arrowImg = this.scene.add.text(PX + PAD, listY, '▶', {
            fontFamily: 'monospace', fontSize: '13px', color: '#ffd700',
        }).setDepth(3)
        children.push(this.arrowImg)

        this.rows = []
        for (let i = 0; i < VISIBLE_ROWS; i++) {
            const ry = listY + i * ROW_H
            const rowBg = this.scene.add.rectangle(PX + PANEL_W / 2, ry + ROW_H / 2, PANEL_W - 16, ROW_H - 4, 0x1c3060, 0.6).setDepth(2)
            const nameT = this.scene.add.text(PX + 36, ry + 6, '', {
                fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
            }).setDepth(3)
            const qtyT = this.scene.add.text(PX + PANEL_W - PAD - 4, ry + 6, '', {
                fontFamily: 'monospace', fontSize: '13px', color: '#aaddff',
            }).setOrigin(1, 0).setDepth(3)
            const rowC = this.scene.add.container(0, 0, [rowBg, nameT, qtyT])
            ;(rowC as any)._nameT = nameT
            ;(rowC as any)._qtyT = qtyT
            ;(rowC as any)._bg = rowBg
            this.rows.push(rowC)
            children.push(rowC)
        }

        // "CLOSE" row
        const closeY = listY + VISIBLE_ROWS * ROW_H
        const closeBg = this.scene.add.rectangle(PX + PANEL_W / 2, closeY + ROW_H / 2, PANEL_W - 16, ROW_H - 4, 0x1c3060, 0.6).setDepth(2)
        const closeT = this.scene.add.text(PX + 36, closeY + 8, 'CLOSE', {
            fontFamily: 'monospace', fontSize: '13px', color: '#ff8888',
        }).setDepth(3)
        children.push(closeBg, closeT)

        // Desc box
        const descBg = this.scene.add.rectangle(PX + PANEL_W / 2, PY + PANEL_H - 26, PANEL_W - 16, 36, 0x0d1a30).setDepth(2)
        this.descText = this.scene.add.text(PX + PAD + 4, PY + PANEL_H - 40, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#cccccc',
            wordWrap: { width: PANEL_W - 40 },
        }).setDepth(3)
        children.push(descBg, this.descText)

        // Empty bag message
        if (this.items.length === 0) {
            const empty = this.scene.add.text(PX + PANEL_W / 2, PY + PANEL_H / 2, 'Your bag is empty.', {
                fontFamily: 'monospace', fontSize: '13px', color: '#667799',
            }).setOrigin(0.5).setDepth(3)
            children.push(empty)
        }

        // Help text
        const help = this.scene.add.text(PX + PANEL_W / 2, PY + PANEL_H + 2, '↑↓ Navigate  ·  SPACE Use  ·  ESC / I  Close', {
            fontFamily: 'monospace', fontSize: '9px', color: '#667799',
        }).setOrigin(0.5, 0).setDepth(2)
        children.push(help)

        this.container = this.scene.add.container(0, 0, children).setDepth(100).setScrollFactor(0)
        this.refreshRows()
    }

    private refreshRows() {
        const listY = PY + 38 + 8
        for (let i = 0; i < VISIBLE_ROWS; i++) {
            const idx = this.scroll + i
            const row = this.rows[i]
            if (idx < this.items.length) {
                const item = this.items[idx]
                const displayName = ITEM_NAMES[item.itemName] || item.itemName
                ;(row as any)._nameT.setText(displayName)
                ;(row as any)._qtyT.setText(`×${item.quantity}`)
            } else {
                ;(row as any)._nameT.setText('')
                ;(row as any)._qtyT.setText('')
            }
            const isSelected = (this.scroll + i) === this.cursor
            ;(row as any)._bg.setFillStyle(isSelected ? 0x2a4880 : 0x1c3060, isSelected ? 0.9 : 0.6)
        }

        if (this.cursor >= this.items.length) {
            this.arrowImg.setPosition(PX + PAD, listY + VISIBLE_ROWS * ROW_H + 8)
            this.descText.setText('Close the bag.')
        } else {
            const cursorVisual = this.cursor - this.scroll
            this.arrowImg.setPosition(PX + PAD, listY + cursorVisual * ROW_H + 6)
            const itemId = this.items[this.cursor].itemName
            const desc = ITEM_DESCRIPTIONS[itemId] ?? ''
            const usable = USABLE_ITEMS.has(itemId)
            this.descText.setText(desc + (usable ? '  [SPACE to Use]' : ''))
        }
    }

    update() {
        // Toggle with 'I'
        if (Phaser.Input.Keyboard.JustDown(this.keys.i)) {
            if (this._active) this.close()
            else this.open()
            return
        }

        if (!this._active) return

        if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
            this.cursor = Math.max(0, this.cursor - 1)
            if (this.cursor < this.scroll) this.scroll = this.cursor
            this.refreshRows()
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
            this.cursor = Math.min(this.items.length, this.cursor + 1)
            if (this.cursor - this.scroll >= VISIBLE_ROWS && this.cursor < this.items.length) {
                this.scroll = this.cursor - VISIBLE_ROWS + 1
            }
            this.refreshRows()
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) {
            this.close()
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
            if (this.cursor < this.items.length) {
                this.useItem(this.items[this.cursor])
            }
        }
    }

    private async useItem(item: InvItem) {
        if (!USABLE_ITEMS.has(item.itemName)) {
            this.descText.setText("This item can't be used here.")
            return
        }

        const team = playerState.team
        if (!team.length) {
            this.descText.setText('You have no Pokémon!')
            return
        }

        const displayName = ITEM_NAMES[item.itemName] || item.itemName

        if (item.itemName === 'revive') {
            const fainted = team.find(m => m.currentHp <= 0)
            if (!fainted) {
                this.descText.setText('No fainted Pokémon to revive!')
                return
            }
            const newHp = Math.floor(fainted.maxHp / 2)
            fainted.currentHp = newHp
            playerState.updateHp(fainted.id, newHp)
            this.descText.setText(`${fainted.nickname || fainted.creatureId} was revived!`)
        } else if (item.itemName === 'potion' || item.itemName === 'super_potion') {
            const heal = item.itemName === 'potion' ? 20 : 50
            const hurt = team.find(m => m.currentHp > 0 && m.currentHp < m.maxHp)
            if (!hurt) {
                this.descText.setText('No Pokémon needs healing!')
                return
            }
            const oldHp = hurt.currentHp
            hurt.currentHp = Math.min(hurt.maxHp, hurt.currentHp + heal)
            playerState.updateHp(hurt.id, hurt.currentHp)
            this.descText.setText(`${hurt.nickname || hurt.creatureId} recovered ${hurt.currentHp - oldHp} HP!`)
        } else {
            // antidote, paralyze_heal, full_heal — status heals (placeholder)
            this.descText.setText(`Used ${displayName}!`)
        }

        // Deduct item on server
        const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'
        const token = (this.scene.registry.get('token') as string) || useAuthStore.getState().token || ''
        try {
            await fetch(`${base}/inventory/use`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ itemId: item.itemName }),
            })
        } catch { /* silent */ }

        // Update local count
        item.quantity -= 1
        if (item.quantity <= 0) {
            this.items = this.items.filter(i => i !== item)
            if (this.cursor >= this.items.length && this.cursor > 0) this.cursor--
        }
        this.refreshRows()
    }

    private close() {
        this._active = false
        this.container?.destroy()
    }

    destroy() {
        this.container?.destroy()
        this.bagBtn?.destroy()
    }
}
