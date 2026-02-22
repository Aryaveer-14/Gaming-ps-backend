import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'
import { setStoryFlag } from '../../lib/overworldSocket'

const W = 800, H = 576, SPD = 110

export default class HouseInteriorScene extends Phaser.Scene {
    // @ts-ignore
    private player!:       Phaser.Physics.Arcade.Sprite
    private playerSprite!: Phaser.GameObjects.Image
    private playerDir      = 'down'
    private playerFrame    = 0
    private walkTimer      = 0
    private cursors!:      Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:     Phaser.Input.Keyboard.Key
    private dialogue!:     DialogueSystem
    private momZone!:      Phaser.GameObjects.Zone
    private stairsZone!:   Phaser.GameObjects.Zone
    private doorZone!:     Phaser.GameObjects.Zone
    private triggered      = false
    private momTalked      = false

    constructor() { super({ key: 'HouseInterior' }) }

    create(data?: { spawnAt?: string }) {
        fadeIn(this)
        this.triggered = false
        this.momTalked = false
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
        // Wall
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, 0, 'tile_wall').setOrigin(0).setDisplaySize(32, 80).setDepth(0)
        }
        // Ceiling strip
        const g = this.add.graphics()
        g.fillStyle(0x997755).fillRect(0, 0, W, 8)

        // Staircase (sprite)
        this.add.image(W - 70, 120, 'furn_stairs').setDisplaySize(60, 72).setDepth(1)
        this.add.text(W - 72, 108, '▲ Upstairs', {
            fontSize: '10px', color: '#333', fontFamily: 'monospace',
        }).setDepth(2)

        // Table + chairs
        this.add.image(280, 230, 'furn_table').setDisplaySize(160, 80).setDepth(1)
        this.add.image(180, 240, 'furn_chair').setDisplaySize(36, 48).setDepth(1)
        this.add.image(362, 240, 'furn_chair').setDisplaySize(36, 48).setDepth(1)

        // TV (sprite)
        this.add.image(130, 130, 'furn_tv').setDisplaySize(100, 70).setDepth(1)

        // Plant
        this.add.image(W - 65, H - 55, 'furn_plant').setDisplaySize(30, 48).setDepth(1)

        // Mom NPC (sprite)
        const momX = 320, momY = 260
        this.add.image(momX, momY, 'npc_mom').setDisplaySize(28, 42).setDepth(3)
        this.add.text(momX, momY - 24, 'Mom', {
            fontSize: '9px', color: '#cc3399', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(3)

        // Door (bottom-center)
        this.add.image(W / 2, H - 12, 'obj_door').setDisplaySize(48, 24).setDepth(1)

        // Zones
        this.momZone    = this.add.zone(momX, momY, 56, 56).setOrigin(0.5)
        this.stairsZone = this.add.zone(W - 64, 140, 80, 40).setOrigin(0.5)
        this.doorZone   = this.add.zone(W / 2, H - 10, 48, 20).setOrigin(0.5)
        ;[this.momZone, this.stairsZone, this.doorZone].forEach(z => this.physics.add.existing(z, true))

        // Player spawn (sprite)
        const spawnX = data?.spawnAt === 'stairs' ? W - 64 : W / 2
        const spawnY = data?.spawnAt === 'stairs' ? 180    : H - 60
        this.playerSprite = this.add.image(spawnX, spawnY, 'player_down_0')
            .setDisplaySize(28, 42).setDepth(5)
        const p = this.add.rectangle(spawnX, spawnY, 14, 20, 0xff0000, 0) as any
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
