// ─────────────────────────────────────────────────────────────────────────────
// ChoiceMenuUI — Player choice menu overlay
//
// Shows a vertical list of options (e.g. "Continue", "Fight", "Run")
// with arrow-key navigation and Space to confirm.
// Designed to appear alongside DialogueSystem during NPC interactions.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser'

const W = 800, H = 576
const MENU_W = 180, ITEM_H = 32, PAD = 10

export class ChoiceMenuUI {
    private scene: Phaser.Scene
    private container!: Phaser.GameObjects.Container
    private _active = false
    private selectedIndex = 0
    private options: string[] = []
    private optionTexts: Phaser.GameObjects.Text[] = []
    private cursor!: Phaser.GameObjects.Text
    private onSelect!: (index: number) => void

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!: Phaser.Input.Keyboard.Key
    private escKey!: Phaser.Input.Keyboard.Key
    private cooldown = 0

    constructor(scene: Phaser.Scene) {
        this.scene = scene
        this.cursors  = scene.input.keyboard!.createCursorKeys()
        this.spaceKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.escKey   = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    }

    /** Whether the choice menu is currently visible */
    active(): boolean { return this._active }

    /**
     * Show the choice menu.
     * @param options Array of option labels (e.g. ['Talk', 'Fight', 'Run'])
     * @param onSelect Callback with the selected index
     */
    show(options: string[], onSelect: (index: number) => void): void {
        if (this._active) this.hide()

        this._active = true
        this.options = options
        this.onSelect = onSelect
        this.selectedIndex = 0
        this.cooldown = 200
        this.optionTexts = []

        const menuH = options.length * ITEM_H + PAD * 2
        const menuX = W - MENU_W - 16
        const menuY = H - 130 - menuH - 8

        this.container = this.scene.add.container(0, 0).setDepth(95)

        // Panel background
        const panel = this.scene.add.graphics()
        panel.fillStyle(0xf8f0d8).fillRoundedRect(menuX, menuY, MENU_W, menuH, 8)
        panel.lineStyle(2, 0x484040).strokeRoundedRect(menuX, menuY, MENU_W, menuH, 8)
        this.container.add(panel)

        // Options
        options.forEach((label, i) => {
            const txt = this.scene.add.text(
                menuX + 32, menuY + PAD + i * ITEM_H + 6,
                label,
                { fontSize: '14px', color: '#282828', fontFamily: 'monospace', fontStyle: 'bold' },
            ).setDepth(96)
            this.optionTexts.push(txt)
            this.container.add(txt)
        })

        // Selection cursor
        this.cursor = this.scene.add.text(
            menuX + 12, menuY + PAD + 6,
            '▶',
            { fontSize: '14px', color: '#282828', fontFamily: 'monospace' },
        ).setDepth(96)
        this.container.add(this.cursor)
    }

    /** Hide / destroy the choice menu */
    hide(): void {
        if (!this._active) return
        this._active = false
        this.container?.destroy()
    }

    /** Call from scene update() */
    update(delta: number = 16): void {
        if (!this._active) return

        if (this.cooldown > 0) {
            this.cooldown -= delta
            return
        }

        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1)
            this.updateCursor()
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
            this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1)
            this.updateCursor()
        }

        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const idx = this.selectedIndex
            this.hide()
            this.onSelect(idx)
        }

        // ESC = select last option (Run / Cancel)
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            const idx = this.options.length - 1
            this.hide()
            this.onSelect(idx)
        }
    }

    private updateCursor(): void {
        const menuX = W - MENU_W - 16
        const menuY = H - 130 - (this.options.length * ITEM_H + PAD * 2) - 8
        this.cursor.setPosition(menuX + 12, menuY + PAD + this.selectedIndex * ITEM_H + 6)
    }
}
