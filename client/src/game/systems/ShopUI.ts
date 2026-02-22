import Phaser from 'phaser'
import { useAuthStore } from '../../store/authStore'

// ─────────────────────────────────────────────────────────────────────────────
// ShopUI — FRLG-style shop overlay for buying items in the PokéMart
// ─────────────────────────────────────────────────────────────────────────────

export interface ShopItem {
    id: string
    name: string
    description: string
    price: number
    category: string
}

// Fallback catalogue (matches server SHOP_ITEMS) so the shop works even offline
const FALLBACK_ITEMS: ShopItem[] = [
    { id: 'potion',        name: 'Potion',        description: 'Restores 20 HP.',                      price: 200,  category: 'healing' },
    { id: 'super_potion',  name: 'Super Potion',  description: 'Restores 50 HP.',                      price: 700,  category: 'healing' },
    { id: 'antidote',      name: 'Antidote',      description: 'Cures poison.',                        price: 100,  category: 'status' },
    { id: 'paralyze_heal', name: 'Paralyze Heal', description: 'Cures paralysis.',                     price: 200,  category: 'status' },
    { id: 'poke_ball',     name: 'Poké Ball',     description: 'Catches wild Pokémon.',                price: 200,  category: 'pokeball' },
    { id: 'great_ball',    name: 'Great Ball',    description: 'Better catch rate.',                    price: 600,  category: 'pokeball' },
    { id: 'repel',         name: 'Repel',         description: 'Repels weak Pokémon for 100 steps.',   price: 350,  category: 'misc' },
    { id: 'escape_rope',   name: 'Escape Rope',   description: 'Escape from caves instantly.',         price: 550,  category: 'misc' },
    { id: 'revive',        name: 'Revive',        description: 'Revives a fainted Pokémon to half HP.', price: 1500, category: 'battle' },
    { id: 'full_heal',     name: 'Full Heal',     description: 'Cures all status conditions.',         price: 600,  category: 'status' },
]

const W = 800, H = 576
const PANEL_W = 460, PANEL_H = 420
const PX = (W - PANEL_W) / 2, PY = (H - PANEL_H) / 2
const ROW_H = 38
const VISIBLE_ROWS = 8
const PAD = 14

export class ShopUI {
    private scene: Phaser.Scene
    private container!: Phaser.GameObjects.Container
    private _active = false
    private items: ShopItem[] = []
    private cursor = 0
    private scroll = 0
    private money = 3000
    private rows: Phaser.GameObjects.Container[] = []
    private descText!: Phaser.GameObjects.Text
    private moneyText!: Phaser.GameObjects.Text
    private arrowImg!: Phaser.GameObjects.Text
    private onClose: (() => void) | null = null
    private keys!: {
        up: Phaser.Input.Keyboard.Key
        down: Phaser.Input.Keyboard.Key
        space: Phaser.Input.Keyboard.Key
        esc: Phaser.Input.Keyboard.Key
    }

    constructor(scene: Phaser.Scene) {
        this.scene = scene
        this.keys = {
            up:    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
            down:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            space: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            esc:   scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
        }
    }

    active() { return this._active }

    async open(token: string, onClose?: () => void) {
        this.onClose = onClose ?? null
        this._active = true
        this.cursor = 0
        this.scroll = 0

        // Resolve token — prefer passed-in, fallback to authStore
        const resolvedToken = token || useAuthStore.getState().token || ''

        // Fetch shop items + money
        const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'
        try {
            const [shopRes, invRes] = await Promise.all([
                fetch(`${base}/inventory/shop`, { headers: { Authorization: `Bearer ${resolvedToken}` } }),
                fetch(`${base}/inventory`, { headers: { Authorization: `Bearer ${resolvedToken}` } }),
            ])
            if (shopRes.ok) {
                const data = await shopRes.json()
                this.items = data.items && data.items.length > 0 ? data.items : FALLBACK_ITEMS
            } else {
                this.items = FALLBACK_ITEMS
            }
            if (invRes.ok) {
                const data = await invRes.json()
                this.money = data.money ?? 3000
            }
        } catch {
            this.items = FALLBACK_ITEMS
        }

        this.buildUI()
    }

    private buildUI() {
        const children: Phaser.GameObjects.GameObject[] = []

        // Dimmed background
        const dim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(0)
        children.push(dim)

        // Main panel
        const border = this.scene.add.rectangle(PX + PANEL_W / 2, PY + PANEL_H / 2, PANEL_W + 4, PANEL_H + 4, 0xf8f8f8).setDepth(1)
        const bg = this.scene.add.rectangle(PX + PANEL_W / 2, PY + PANEL_H / 2, PANEL_W, PANEL_H, 0x182848).setDepth(1)
        children.push(border, bg)

        // Title
        const title = this.scene.add.text(PX + PANEL_W / 2, PY + 14, '── POKé MART ──', {
            fontFamily: 'monospace', fontSize: '16px', color: '#ffd700', fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(2)
        children.push(title)

        // Money display
        this.moneyText = this.scene.add.text(PX + PANEL_W - PAD, PY + 16, `₽${this.money}`, {
            fontFamily: 'monospace', fontSize: '14px', color: '#88ff88',
        }).setOrigin(1, 0).setDepth(2)
        children.push(this.moneyText)

        // Column headers
        const hdrY = PY + 42
        const hdrItem = this.scene.add.text(PX + 40, hdrY, 'ITEM', {
            fontFamily: 'monospace', fontSize: '10px', color: '#8899bb',
        }).setDepth(2)
        const hdrPrice = this.scene.add.text(PX + PANEL_W - 60, hdrY, 'PRICE', {
            fontFamily: 'monospace', fontSize: '10px', color: '#8899bb',
        }).setOrigin(1, 0).setDepth(2)
        children.push(hdrItem, hdrPrice)

        // Separator
        const sep = this.scene.add.rectangle(PX + PANEL_W / 2, hdrY + 16, PANEL_W - 20, 1, 0x4466aa).setDepth(2)
        children.push(sep)

        // Item rows area
        const listY = hdrY + 24
        this.arrowImg = this.scene.add.text(PX + PAD, listY, '▶', {
            fontFamily: 'monospace', fontSize: '14px', color: '#ffd700',
        }).setDepth(3)
        children.push(this.arrowImg)

        this.rows = []
        for (let i = 0; i < VISIBLE_ROWS; i++) {
            const ry = listY + i * ROW_H
            const rowBg = this.scene.add.rectangle(PX + PANEL_W / 2, ry + ROW_H / 2, PANEL_W - 16, ROW_H - 4, 0x1c3060, 0.6).setDepth(2)
            const nameT = this.scene.add.text(PX + 40, ry + 4, '', {
                fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
            }).setDepth(3)
            const priceT = this.scene.add.text(PX + PANEL_W - 24, ry + 4, '', {
                fontFamily: 'monospace', fontSize: '13px', color: '#aaddaa',
            }).setOrigin(1, 0).setDepth(3)
            const catT = this.scene.add.text(PX + 40, ry + 20, '', {
                fontFamily: 'monospace', fontSize: '9px', color: '#7799cc',
            }).setDepth(3)
            const rowC = this.scene.add.container(0, 0, [rowBg, nameT, priceT, catT])
            ;(rowC as any)._nameT = nameT
            ;(rowC as any)._priceT = priceT
            ;(rowC as any)._catT = catT
            ;(rowC as any)._bg = rowBg
            ;(rowC as any)._ry = ry
            this.rows.push(rowC)
            children.push(rowC)
        }

        // "Cancel" row
        const cancelY = listY + VISIBLE_ROWS * ROW_H
        const cancelBg = this.scene.add.rectangle(PX + PANEL_W / 2, cancelY + ROW_H / 2, PANEL_W - 16, ROW_H - 4, 0x1c3060, 0.6).setDepth(2)
        const cancelT = this.scene.add.text(PX + 40, cancelY + 8, 'CANCEL', {
            fontFamily: 'monospace', fontSize: '13px', color: '#ff8888',
        }).setDepth(3)
        children.push(cancelBg, cancelT)

        // Description box at bottom
        const descBg = this.scene.add.rectangle(PX + PANEL_W / 2, PY + PANEL_H - 28, PANEL_W - 16, 40, 0x0d1a30).setDepth(2)
        this.descText = this.scene.add.text(PX + PAD + 8, PY + PANEL_H - 44, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#cccccc',
            wordWrap: { width: PANEL_W - 40 },
        }).setDepth(3)
        children.push(descBg, this.descText)

        // Help text
        const help = this.scene.add.text(PX + PANEL_W / 2, PY + PANEL_H - 4, '↑↓ Navigate  ·  SPACE Buy  ·  ESC Close', {
            fontFamily: 'monospace', fontSize: '9px', color: '#667799',
        }).setOrigin(0.5, 0).setDepth(2)
        children.push(help)

        this.container = this.scene.add.container(0, 0, children).setDepth(100)
        this.refreshRows()
    }

    private refreshRows() {
        const listY = PY + 42 + 24
        for (let i = 0; i < VISIBLE_ROWS; i++) {
            const idx = this.scroll + i
            const row = this.rows[i]
            if (idx < this.items.length) {
                const item = this.items[idx]
                ;(row as any)._nameT.setText(item.name)
                ;(row as any)._priceT.setText(`₽${item.price}`)
                ;(row as any)._catT.setText(item.category.toUpperCase())
                const affordable = this.money >= item.price
                ;(row as any)._nameT.setColor(affordable ? '#ffffff' : '#666666')
                ;(row as any)._priceT.setColor(affordable ? '#aaddaa' : '#664444')
            } else {
                ;(row as any)._nameT.setText('')
                ;(row as any)._priceT.setText('')
                ;(row as any)._catT.setText('')
            }
        }

        // Arrow position
        const cursorVisual = this.cursor - this.scroll
        if (this.cursor >= this.items.length) {
            // On Cancel
            this.arrowImg.setPosition(PX + PAD, listY + VISIBLE_ROWS * ROW_H + 8)
            this.descText.setText('Exit the shop.')
        } else {
            this.arrowImg.setPosition(PX + PAD, listY + cursorVisual * ROW_H + 4)
            this.descText.setText(this.items[this.cursor].description)
        }

        // Highlight current row
        for (let i = 0; i < VISIBLE_ROWS; i++) {
            const isSelected = (this.scroll + i) === this.cursor
            ;(this.rows[i] as any)._bg.setFillStyle(isSelected ? 0x2a4880 : 0x1c3060, isSelected ? 0.9 : 0.6)
        }
    }

    update() {
        if (!this._active) return

        if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
            this.cursor = Math.max(0, this.cursor - 1)
            if (this.cursor < this.scroll) this.scroll = this.cursor
            this.refreshRows()
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
            this.cursor = Math.min(this.items.length, this.cursor + 1) // items.length = Cancel
            if (this.cursor - this.scroll >= VISIBLE_ROWS && this.cursor < this.items.length) {
                this.scroll = this.cursor - VISIBLE_ROWS + 1
            }
            this.refreshRows()
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) {
            this.close()
            return
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
            if (this.cursor >= this.items.length) {
                this.close()
            } else {
                this.buyItem(this.items[this.cursor])
            }
        }
    }

    private async buyItem(item: ShopItem) {
        if (this.money < item.price) {
            this.descText.setText("You don't have enough money!")
            return
        }
        const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'
        const token = (this.scene.registry.get('token') as string) || useAuthStore.getState().token || ''
        try {
            const res = await fetch(`${base}/inventory/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ itemId: item.id, quantity: 1 }),
            })
            if (res.ok) {
                const data = await res.json()
                this.money = data.money
                this.moneyText.setText(`₽${this.money}`)
                this.descText.setText(`Bought ${item.name}! ✓`)
                this.refreshRows()
            } else {
                const err = await res.json().catch(() => ({}))
                this.descText.setText(err.error ?? 'Purchase failed.')
            }
        } catch {
            this.descText.setText('Could not reach the server.')
        }
    }

    private close() {
        this._active = false
        this.container?.destroy()
        this.onClose?.()
    }
}
