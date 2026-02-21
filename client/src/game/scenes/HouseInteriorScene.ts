import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'
import { setStoryFlag } from '../../lib/overworldSocket'

const W = 800, H = 576, SPD = 110

export default class HouseInteriorScene extends Phaser.Scene {
    // @ts-ignore
    private player!:     Phaser.Physics.Arcade.Sprite
    private cursors!:    Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:   Phaser.Input.Keyboard.Key
    private dialogue!:   DialogueSystem
    private momZone!:    Phaser.GameObjects.Zone
    private stairsZone!: Phaser.GameObjects.Zone
    private doorZone!:   Phaser.GameObjects.Zone
    private triggered    = false
    private momTalked    = false

    constructor() { super({ key: 'HouseInterior' }) }

    create(data?: { spawnAt?: string }) {
        fadeIn(this)
        this.triggered = false
        this.momTalked = false
        this.dialogue  = new DialogueSystem(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        const g = this.add.graphics()
        g.fillStyle(0xd4b896).fillRect(0, 0, W, H)
        g.fillStyle(0xeeddcc).fillRect(0, 0, W, 80)
        g.fillStyle(0x997755).fillRect(0, 0, W, 8)

        // Staircase
        for (let i = 0; i < 6; i++) g.fillStyle(0xbb9966).fillRect(W - 100 + i * 8, 80 + i * 12, 60, 12)
        this.add.text(W - 72, 108, '▲ Upstairs', { fontSize: '10px', color: '#333', fontFamily: 'monospace' })

        // Table + chairs
        g.fillStyle(0x8b6914).fillRect(200, 200, 160, 80)
        g.fillStyle(0xffffff).fillRect(208, 208, 144, 64)
        g.fillStyle(0x6b4c11).fillRect(180, 216, 18, 48).fillRect(362, 216, 18, 48)

        // TV
        g.fillStyle(0x222233).fillRect(80, 100, 100, 70)
        g.fillStyle(0x3388ff).fillRect(85, 105, 90, 58)

        // Plant
        g.fillStyle(0x228822).fillRect(W - 80, H - 80, 30, 30)
        g.fillStyle(0x885511).fillRect(W - 70, H - 50, 12, 24)

        // Mom NPC
        const momX = 320, momY = 260
        this.add.rectangle(momX, momY, 14, 20, 0xff99cc).setDepth(2)
        this.add.text(momX, momY - 18, 'Mom', { fontSize: '9px', color: '#cc3399', fontFamily: 'monospace' }).setOrigin(0.5)

        // Door (bottom-center)
        g.fillStyle(0x8b4513).fillRect(W / 2 - 24, H - 24, 48, 24)
        g.fillStyle(0xffcc88).fillRect(W / 2 - 22, H - 22, 44, 20)

        // Zones
        this.momZone    = this.add.zone(momX, momY, 56, 56).setOrigin(0.5)
        this.stairsZone = this.add.zone(W - 64, 140, 80, 40).setOrigin(0.5)
        this.doorZone   = this.add.zone(W / 2, H - 10, 48, 20).setOrigin(0.5)
        ;[this.momZone, this.stairsZone, this.doorZone].forEach(z => this.physics.add.existing(z, true))

        // Player spawn
        const spawnX = data?.spawnAt === 'stairs' ? W - 64 : W / 2
        const spawnY = data?.spawnAt === 'stairs' ? 180    : H - 60
        const p = this.add.rectangle(spawnX, spawnY, 14, 20, 0xff4444) as any
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

        if (!locked && !this.momTalked
            && Phaser.Input.Keyboard.JustDown(this.spaceKey)
            && this.physics.overlap(this.player as any, this.momZone)) {
            this.momTalked = true
            const token  = this.registry.get('token') as string
            const visitedMom = this.registry.get('visitedMom') as boolean
            this.dialogue.show(
                visitedMom
                    ? ["Good to see you again! Stay safe out there."]
                    : ["Good morning! Professor Oak was looking for you.", "Maybe visit his lab today — it's at the north of town."],
                'Mom',
                () => {
                    if (!visitedMom) {
                        this.registry.set('visitedMom', true)
                        if (token) setStoryFlag(token, 'visitedMom')
                    }
                },
            )
        }

        if (this.triggered) return

        if (!locked && this.physics.overlap(this.player as any, this.stairsZone)) {
            this.triggered = true
            transitionTo(this, 'Bedroom', { skipIntro: true })
        }
        if (!locked && this.physics.overlap(this.player as any, this.doorZone)) {
            this.triggered = true
            transitionTo(this, 'Outdoor', { from: 'playerHouse' })
        }
    }
}
