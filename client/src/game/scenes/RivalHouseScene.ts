import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'

const W = 800, H = 576, SPD = 110

export default class RivalHouseScene extends Phaser.Scene {
    // @ts-ignore
    private player!:     Phaser.Physics.Arcade.Sprite
    private cursors!:    Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:   Phaser.Input.Keyboard.Key
    private dialogue!:   DialogueSystem
    private sisterZone!: Phaser.GameObjects.Zone
    private doorZone!:   Phaser.GameObjects.Zone
    private triggered    = false

    constructor() { super({ key: 'RivalHouse' }) }

    create() {
        fadeIn(this)
        this.triggered = false
        this.dialogue  = new DialogueSystem(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        const g = this.add.graphics()
        g.fillStyle(0xe8d4b0).fillRect(0, 0, W, H)
        g.fillStyle(0xddeeff).fillRect(0, 0, W, 80)
        g.fillStyle(0x3355aa).fillRect(0, 0, W, 8)

        // Couch
        g.fillStyle(0x5577bb).fillRect(60, 160, 160, 70)
        g.fillStyle(0x4466aa).fillRect(60, 156, 160, 20).fillRect(60, 156, 20, 74).fillRect(200, 156, 20, 74)

        // TV
        g.fillStyle(0x111122).fillRect(W - 200, 90, 160, 100)
        g.fillStyle(0x3366ff).fillRect(W - 196, 94, 152, 88)
        g.fillStyle(0x333344).fillRect(W - 100, 192, 40, 30)
        this.add.text(W - 120, 138, '– TV –', { fontSize: '10px', color: '#88aaff', fontFamily: 'monospace' }).setOrigin(0.5)

        // Bookshelf
        g.fillStyle(0x8b6914).fillRect(20, 80, 70, 120)
        ;[0xcc2222, 0x2266cc, 0x228822, 0xddaa00].forEach((c, i) =>
            g.fillStyle(c).fillRect(24 + i * 16, 84, 13, 110))

        // Trophy shelf
        g.fillStyle(0xaaa088).fillRect(W - 80, 80, 60, 100)
        g.fillStyle(0xffcc00).fillCircle(W - 50, 104, 14)
        g.fillStyle(0xcc9900).fillRect(W - 57, 118, 14, 20)
        this.add.text(W - 50, 148, '1st', { fontSize: '8px', color: '#aa8800', fontFamily: 'monospace' }).setOrigin(0.5)

        // Daisy (Gary's sister)
        const sisX = 280, sisY = 240
        this.add.rectangle(sisX, sisY, 14, 20, 0xff88cc).setDepth(2)
        this.add.text(sisX, sisY - 16, 'Daisy', { fontSize: '9px', color: '#cc44aa', fontFamily: 'monospace' }).setOrigin(0.5)
        this.sisterZone = this.add.zone(sisX, sisY, 52, 52).setOrigin(0.5)
        this.physics.add.existing(this.sisterZone, true)

        // Door
        g.fillStyle(0x8b4513).fillRect(W / 2 - 20, H - 24, 40, 24)
        this.doorZone = this.add.zone(W / 2, H - 10, 40, 20).setOrigin(0.5)
        this.physics.add.existing(this.doorZone, true)

        // Player
        const p = this.add.rectangle(W / 2, H - 80, 14, 20, 0xff4444) as any
        this.physics.add.existing(p)
        this.player = p as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true).setSize(14, 20)
        this.player.setDepth(5)

        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())
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

        if (!locked && Phaser.Input.Keyboard.JustDown(this.spaceKey)
            && this.physics.overlap(this.player as any, this.sisterZone)) {
            const hasStarter = this.registry.get('hasStarter') as boolean
            this.dialogue.show(
                hasStarter
                    ? ["Oh, you have a creature now! Gary left already — typical.", 'Good luck on your journey!']
                    : ["Hi! Gary rushed to Professor Oak's lab.", "You should head over there too — it's north of town."],
                'Daisy',
            )
        }

        if (!this.triggered && !locked
            && this.physics.overlap(this.player as any, this.doorZone)) {
            this.triggered = true
            transitionTo(this, 'Outdoor', { from: 'rivalHouse' })
        }
    }
}
