import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'

const W = 800, H = 576, SPD = 110

export default class BedroomScene extends Phaser.Scene {
    // @ts-ignore
    private player!:       Phaser.Physics.Arcade.Sprite
    private playerSprite!: Phaser.GameObjects.Image
    private playerDir      = 'down'
    private playerFrame    = 0
    private walkTimer      = 0
    private cursors!:      Phaser.Types.Input.Keyboard.CursorKeys
    private dialogue!:     DialogueSystem
    private doorZone!:     Phaser.GameObjects.Zone
    private triggered      = false

    constructor() { super({ key: 'Bedroom' }) }

    create(data?: { skipIntro?: boolean }) {
        fadeIn(this)
        this.triggered = false
        this.dialogue  = new DialogueSystem(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.physics.world.setBounds(0, 0, W, H)

        // ── Draw bedroom with sprites ─────────────────────────────────────

        // Floor tiles
        for (let y = 80; y < H; y += 32) {
            for (let x = 0; x < W; x += 32) {
                this.add.image(x, y, 'tile_floor_wood').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            }
        }
        // Wall
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, 0, 'tile_wall').setOrigin(0).setDisplaySize(32, 80).setDepth(0)
        }
        // Ceiling strip
        const g = this.add.graphics()
        g.fillStyle(0x8899aa).fillRect(0, 0, W, 8)

        // Bed (left side)
        this.add.image(60, H - 80, 'furn_bed').setDisplaySize(80, 120).setDepth(1)

        // Desk + computer (right side)
        this.add.image(W - 80, 130, 'furn_desk').setDisplaySize(120, 60).setDepth(1)
        this.add.image(W - 90, 90, 'furn_computer').setDisplaySize(80, 56).setDepth(2)

        // Bookshelf (left wall)
        this.add.image(65, 120, 'furn_bookshelf').setDisplaySize(90, 80).setDepth(1)

        // Door (bottom-center)
        this.add.image(W / 2, H - 12, 'obj_door').setDisplaySize(48, 24).setDepth(1)
        this.add.text(W / 2, H - 12, '▼', {
            fontSize: '12px', color: '#000', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(2)

        // ── Player (sprite) ───────────────────────────────────────────────
        this.playerSprite = this.add.image(W / 2, H / 2, 'player_down_0')
            .setDisplaySize(28, 42).setDepth(5)
        const p = this.add.rectangle(W / 2, H / 2, 14, 20, 0xff0000, 0) as any
        this.physics.add.existing(p)
        this.player = p as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true).setSize(14, 20)

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

        let moving = false
        if (!locked) {
            const { left, right, up, down } = this.cursors
            if (left.isDown)  { body.setVelocityX(-SPD); this.playerDir = 'left'; moving = true }
            if (right.isDown) { body.setVelocityX(SPD); this.playerDir = 'right'; moving = true }
            if (up.isDown)    { body.setVelocityY(-SPD); this.playerDir = 'up'; moving = true }
            if (down.isDown)  { body.setVelocityY(SPD); this.playerDir = 'down'; moving = true }
        }

        // Walk animation
        if (moving) {
            this.walkTimer += delta
            if (this.walkTimer > 200) { this.walkTimer = 0; this.playerFrame = this.playerFrame === 0 ? 1 : 0 }
        } else { this.playerFrame = 0; this.walkTimer = 0 }

        this.playerSprite.setPosition(this.player.x, this.player.y)
        this.playerSprite.setTexture(`player_${this.playerDir}_${this.playerFrame}`)

        if (!this.triggered && !locked
            && this.physics.overlap(this.player as any, this.doorZone)) {
            this.triggered = true
            transitionTo(this, 'HouseInterior', { spawnAt: 'door' })
        }
    }
}
