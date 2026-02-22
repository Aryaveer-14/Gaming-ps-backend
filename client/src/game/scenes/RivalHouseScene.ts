import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'

const W = 800, H = 576, SPD = 110

export default class RivalHouseScene extends Phaser.Scene {
    // @ts-ignore
    private player!:       Phaser.Physics.Arcade.Sprite
    private playerSprite!: Phaser.GameObjects.Image
    private playerDir      = 'down'
    private playerFrame    = 0
    private walkTimer      = 0
    private cursors!:      Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:     Phaser.Input.Keyboard.Key
    private dialogue!:     DialogueSystem
    private sisterZone!:   Phaser.GameObjects.Zone
    private doorZone!:     Phaser.GameObjects.Zone
    private triggered      = false

    constructor() { super({ key: 'RivalHouse' }) }

    create() {
        fadeIn(this)
        this.triggered = false
        this.dialogue  = new DialogueSystem(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        // ── Floor tiles ───────────────────────────────────────────────────
        for (let y = 80; y < H; y += 32) {
            for (let x = 0; x < W; x += 32) {
                this.add.image(x, y, 'tile_floor_wood').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            }
        }
        // Wall (blue-tinted)
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, 0, 'tile_wall').setOrigin(0).setDisplaySize(32, 80).setDepth(0)
        }
        // Ceiling strip (blue)
        const g = this.add.graphics()
        g.fillStyle(0x3355aa).fillRect(0, 0, W, 8)

        // Couch (sprite)
        this.add.image(140, 195, 'furn_couch').setDisplaySize(160, 70).setDepth(1)

        // TV (sprite)
        this.add.image(W - 120, 140, 'furn_tv').setDisplaySize(160, 100).setDepth(1)
        this.add.text(W - 120, 148, '– TV –', {
            fontSize: '10px', color: '#88aaff', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(2)

        // Bookshelf (sprite)
        this.add.image(55, 140, 'furn_bookshelf').setDisplaySize(70, 120).setDepth(1)

        // Trophy shelf (sprite)
        this.add.image(W - 50, 130, 'furn_trophy').setDisplaySize(60, 100).setDepth(1)
        this.add.text(W - 50, 168, '1st', {
            fontSize: '8px', color: '#aa8800', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(2)

        // Daisy (Gary's sister) — NPC sprite
        const sisX = 280, sisY = 240
        this.add.image(sisX, sisY, 'npc_daisy').setDisplaySize(28, 42).setDepth(3)
        this.add.text(sisX, sisY - 24, 'Daisy', {
            fontSize: '9px', color: '#cc44aa', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(3)
        this.sisterZone = this.add.zone(sisX, sisY, 52, 52).setOrigin(0.5)
        this.physics.add.existing(this.sisterZone, true)

        // Door (sprite)
        this.add.image(W / 2, H - 12, 'obj_door').setDisplaySize(40, 24).setDepth(1)
        this.doorZone = this.add.zone(W / 2, H - 10, 40, 20).setOrigin(0.5)
        this.physics.add.existing(this.doorZone, true)

        // Player (sprite)
        this.playerSprite = this.add.image(W / 2, H - 80, 'player_down_0')
            .setDisplaySize(28, 42).setDepth(5)
        const p = this.add.rectangle(W / 2, H - 80, 14, 20, 0xff0000, 0) as any
        this.physics.add.existing(p)
        this.player = p as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true).setSize(14, 20)

        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())
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

        if (moving) {
            this.walkTimer += delta
            if (this.walkTimer > 200) { this.walkTimer = 0; this.playerFrame = this.playerFrame === 0 ? 1 : 0 }
        } else { this.playerFrame = 0; this.walkTimer = 0 }

        this.playerSprite.setPosition(this.player.x, this.player.y)
        this.playerSprite.setTexture(`player_${this.playerDir}_${this.playerFrame}`)

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
