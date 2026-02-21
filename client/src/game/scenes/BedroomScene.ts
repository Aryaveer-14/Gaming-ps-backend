import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'

const W = 800, H = 576, SPD = 110

export default class BedroomScene extends Phaser.Scene {
    // @ts-ignore
    private player!:   Phaser.Physics.Arcade.Sprite
    private cursors!:  Phaser.Types.Input.Keyboard.CursorKeys
    private dialogue!: DialogueSystem
    private doorZone!: Phaser.GameObjects.Zone
    private triggered  = false

    constructor() { super({ key: 'Bedroom' }) }

    create(data?: { skipIntro?: boolean }) {
        fadeIn(this)
        this.triggered = false
        this.dialogue  = new DialogueSystem(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.physics.world.setBounds(0, 0, W, H)

        // ── Draw bedroom ──────────────────────────────────────────────────
        const g = this.add.graphics()
        g.fillStyle(0xc8a96e).fillRect(0, 0, W, H)              // floor
        g.fillStyle(0xc8d8e8).fillRect(0, 0, W, 80)             // wall
        g.fillStyle(0x8899aa).fillRect(0, 0, W, 8)              // ceiling strip

        // Bed
        g.fillStyle(0x4466bb).fillRect(40, H - 140, 80, 120)
        g.fillStyle(0xffffff).fillRect(44, H - 136, 72, 40)
        g.fillStyle(0x2233aa).fillRect(0, H - 136, 40, 120)

        // Desk + computer
        g.fillStyle(0x8b6914).fillRect(W - 140, 100, 120, 60)
        g.fillStyle(0x444455).fillRect(W - 130, 80,  80, 24)
        g.fillStyle(0x88ccff).fillRect(W - 128, 82,  76, 20)

        // Bookshelf
        g.fillStyle(0x6b4c11).fillRect(20, 80, 90, 80)
        const bookColors = [0xcc3333, 0x3355cc, 0x44aa44, 0xddaa00, 0x9922aa]
        bookColors.forEach((c, i) => g.fillStyle(c).fillRect(22 + i * 17, 84, 14, 70))

        // Door (bottom-center)
        g.fillStyle(0x8b4513).fillRect(W / 2 - 24, H - 24, 48, 24)
        g.fillStyle(0xffcc88).fillRect(W / 2 - 22, H - 22, 44, 20)
        this.add.text(W / 2, H - 12, '▼', { fontSize: '12px', color: '#000', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(2)

        // ── Player ────────────────────────────────────────────────────────
        const p = this.add.rectangle(W / 2, H / 2, 14, 20, 0xff4444) as any
        this.physics.add.existing(p)
        this.player = p as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true).setSize(14, 20)
        this.player.setDepth(5)

        // ── Door zone ─────────────────────────────────────────────────────
        this.doorZone = this.add.zone(W / 2, H - 10, 48, 20).setOrigin(0.5)
        this.physics.add.existing(this.doorZone, true)

        // ── Click to advance dialogue ─────────────────────────────────────
        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())

        // ── Intro dialogue ────────────────────────────────────────────────
        if (!data?.skipIntro) {
            this.time.delayedCall(300, () => {
                this.dialogue.show([
                    '...',
                    'You wake up in your room.',
                    'Today feels different.',
                    "Mom is calling from downstairs...",
                ])
            })
        }
    }

    update(_t: number, delta: number) {
        this.dialogue.update(delta)

        const locked = this.dialogue.active()
        const body   = this.player.body as Phaser.Physics.Arcade.Body
        body.setVelocity(0)

        if (!locked) {
            const { left, right, up, down } = this.cursors
            if (left.isDown)  body.setVelocityX(-SPD)
            if (right.isDown) body.setVelocityX(SPD)
            if (up.isDown)    body.setVelocityY(-SPD)
            if (down.isDown)  body.setVelocityY(SPD)
        }

        if (!this.triggered && !locked
            && this.physics.overlap(this.player as any, this.doorZone)) {
            this.triggered = true
            transitionTo(this, 'HouseInterior', { spawnAt: 'door' })
        }
    }
}
