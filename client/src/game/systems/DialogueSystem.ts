import Phaser from 'phaser'

// ─────────────────────────────────────────────────────────────────────────────
// DialogueSystem — FireRed-style typewriter dialogue box
// Scenes MUST call dialogue.update(delta) from their own update() loop.
// Use dialogue.active() to check if movement should be locked.
// ─────────────────────────────────────────────────────────────────────────────

const BOX_H   = 110
const PADDING = 16
const FONT    = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', wordWrap: { width: 690 } }
const SPKFNT  = { fontFamily: 'monospace', fontSize: '14px', color: '#ffd700', backgroundColor: '#111111' }

export class DialogueSystem {
    private scene:    Phaser.Scene
    private box!:     Phaser.GameObjects.Rectangle
    private border!:  Phaser.GameObjects.Rectangle
    private nameTag!: Phaser.GameObjects.Text
    private body!:    Phaser.GameObjects.Text
    private arrow!:   Phaser.GameObjects.Text
    private timer:    Phaser.Time.TimerEvent | null = null
    private lines:    string[] = []
    private cursor    = 0
    private _active   = false
    private onDone:   (() => void) | null = null
    private spaceKey: Phaser.Input.Keyboard.Key
    private cooldown  = 0   // ms — prevents double-fire on same click/keypress

    constructor(scene: Phaser.Scene) {
        this.scene = scene
        const W = scene.scale.width
        const H = scene.scale.height

        // White border → dark inner box
        this.border = scene.add
            .rectangle(W / 2, H - BOX_H / 2 - 2, W - 4, BOX_H + 4, 0xffffff)
            .setScrollFactor(0).setDepth(90).setVisible(false)

        this.box = scene.add
            .rectangle(W / 2, H - BOX_H / 2 - 2, W - 8, BOX_H, 0x111133)
            .setScrollFactor(0).setDepth(91).setVisible(false)

        this.nameTag = scene.add
            .text(14, H - BOX_H - 2, '', { ...SPKFNT, padding: { x: 6, y: 3 } })
            .setScrollFactor(0).setDepth(92).setVisible(false)

        this.body = scene.add
            .text(PADDING, H - BOX_H + PADDING, '', FONT)
            .setScrollFactor(0).setDepth(92).setVisible(false)

        // Blinking "▼ SPACE" prompt
        this.arrow = scene.add
            .text(W - 90, H - 20, '▼ SPACE', {
                fontFamily: 'monospace', fontSize: '11px', color: '#ffdd44',
            })
            .setScrollFactor(0).setDepth(92).setVisible(false)

        scene.time.addEvent({
            delay: 500, loop: true,
            callback: () => {
                if (this.arrow.visible)
                    this.arrow.setAlpha(this.arrow.alpha > 0.5 ? 0.25 : 1)
            },
        })

        this.spaceKey = scene.input.keyboard!.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE,
        )
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Call from scene's update(time, delta) every frame */
    update(delta: number) {
        if (!this._active) return
        if (this.cooldown > 0) { this.cooldown -= delta; return }
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.advance()
    }

    /** Call from scene's pointerdown handler when user clicks */
    pointerAdvance() {
        if (!this._active || this.cooldown > 0) return
        this.advance()
    }

    /** Returns true while dialogue is showing — use to block movement */
    active() { return this._active }

    show(lines: string[], speaker = '', onDone?: () => void) {
        this.lines    = lines
        this.cursor   = 0
        this.onDone   = onDone ?? null
        this._active  = true
        this.cooldown = 300  // 300ms grace on open to prevent first-click dismissal
        this.nameTag.setText(speaker ? ` ${speaker} ` : '').setVisible(!!speaker)
        this.box.setVisible(true)
        this.border.setVisible(true)
        this.arrow.setVisible(false)
        this.showLine()
    }

    destroy() {
        this.timer?.destroy()
        ;[this.box, this.border, this.nameTag, this.body, this.arrow].forEach(g => g.destroy())
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private advance() {
        if (!this._active) return
        this.cooldown = 150   // debounce between advances

        if (this.timer) {
            // Fast-forward: show full line immediately
            this.timer.destroy(); this.timer = null
            this.body.setText(this.lines[this.cursor])
            this.arrow.setVisible(true)
            return
        }

        this.cursor++
        if (this.cursor < this.lines.length) {
            this.showLine()
        } else {
            this.close()
        }
    }

    private showLine() {
        const text = this.lines[this.cursor]
        this.body.setText('').setVisible(true)
        this.arrow.setVisible(false)
        let i = 0
        this.timer?.destroy()
        this.timer = this.scene.time.addEvent({
            delay: 30,
            repeat: text.length - 1,
            callback: () => {
                this.body.setText(text.slice(0, ++i))
                if (i >= text.length) {
                    this.timer?.destroy(); this.timer = null
                    this.arrow.setVisible(true)
                }
            },
        })
    }

    private close() {
        this._active = false
        ;[this.box, this.border, this.nameTag, this.body, this.arrow].forEach(g => g.setVisible(false))
        this.timer?.destroy(); this.timer = null
        this.onDone?.()
    }
}
