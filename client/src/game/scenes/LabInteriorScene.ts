import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'
import { setStoryFlag } from '../../lib/overworldSocket'

const W = 800, H = 576, SPD = 110

const POKEBALLS = [
    { x: 260, y: 240, id: 'flameling', name: 'Flameling', type: 'Fire',  color: 0xff4422, texKey: 'obj_pokeball_fire'  },
    { x: 400, y: 240, id: 'aquafin',   name: 'Aquafin',   type: 'Water', color: 0x2266ff, texKey: 'obj_pokeball_water' },
    { x: 540, y: 240, id: 'verdling',  name: 'Verdling',  type: 'Grass', color: 0x33bb44, texKey: 'obj_pokeball_grass' },
]

export default class LabInteriorScene extends Phaser.Scene {
    // @ts-ignore
    private player!:       Phaser.Physics.Arcade.Sprite
    private playerSprite!: Phaser.GameObjects.Image
    private playerDir      = 'down'
    private playerFrame    = 0
    private walkTimer      = 0
    private cursors!:      Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:     Phaser.Input.Keyboard.Key
    private dialogue!:     DialogueSystem
    private oakZone!:      Phaser.GameObjects.Zone
    private doorZone!:     Phaser.GameObjects.Zone
    private ballZones:     { zone: Phaser.GameObjects.Zone; def: typeof POKEBALLS[0] }[] = []
    private triggered      = false
    private selecting      = false
    private garySprite!:   Phaser.GameObjects.Image
    private garyLabel!:    Phaser.GameObjects.Text

    constructor() { super({ key: 'LabInterior' }) }

    create() {
        fadeIn(this)
        this.triggered = false
        this.selecting = false
        this.ballZones = []
        this.dialogue  = new DialogueSystem(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        // ── Floor tiles (lab grid) ────────────────────────────────────────
        for (let y = 80; y < H; y += 32) {
            for (let x = 0; x < W; x += 32) {
                this.add.image(x, y, 'tile_floor_lab').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            }
        }
        // Walls
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, 0, 'tile_wall_lab').setOrigin(0).setDisplaySize(32, 80).setDepth(0)
        }
        // Ceiling strip
        const g = this.add.graphics()
        g.fillStyle(0xaaaacc).fillRect(0, 0, W, 8)

        // Lab table (sprite)
        this.add.image(W / 2, 183, 'furn_lab_table').setDisplaySize(440, 16).setDepth(1)

        // Pokéballs (sprites)
        POKEBALLS.forEach(b => {
            this.add.image(b.x, b.y, b.texKey).setDisplaySize(32, 32).setDepth(2)
            this.add.text(b.x, b.y + 28, `${b.name}\n[${b.type}]`, {
                fontSize: '9px', color: '#333', fontFamily: 'monospace', align: 'center',
            }).setOrigin(0.5).setDepth(2)
            const zone = this.add.zone(b.x, b.y, 36, 36).setOrigin(0.5)
            this.physics.add.existing(zone, true)
            this.ballZones.push({ zone, def: b })
        })

        // Lab shelves (left — beakers)
        this.add.image(80, 120, 'furn_lab_shelf').setDisplaySize(120, 80).setDepth(1)
        // Lab shelves (right — computer)
        this.add.image(W - 80, 110, 'furn_lab_computer').setDisplaySize(80, 50).setDepth(1)

        // Oak NPC (sprite)
        const oakX = W / 2, oakY = 120
        this.add.image(oakX, oakY, 'npc_oak').setDisplaySize(28, 42).setDepth(3)
        this.add.text(oakX, oakY - 24, 'Prof. Oak', {
            fontSize: '9px', color: '#334', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(3)
        this.oakZone = this.add.zone(oakX, oakY, 48, 48).setOrigin(0.5)
        this.physics.add.existing(this.oakZone, true)

        // Gary (off-screen right, slides in during cutscene) — sprite
        this.garySprite = this.add.image(W + 50, 340, 'npc_gary').setDisplaySize(28, 42).setDepth(3)
        this.garyLabel  = this.add.text(W + 50, 316, 'Gary', {
            fontSize: '9px', color: '#2244bb', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(3)

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

        // Oak intro
        const hasStarter = this.registry.get('hasStarter') as boolean
        const metOak     = this.registry.get('metOak')     as boolean
        if (!hasStarter && !metOak) {
            this.time.delayedCall(300, () => {
                this.dialogue.show([
                    'Ah, welcome!',
                    "I've been waiting for you.",
                    'I have three rare creatures here.',
                    'Choose one to start your adventure!',
                    'Approach a Pokéball and press SPACE.',
                ], 'Prof. Oak', () => {
                    this.registry.set('metOak', true)
                    const token = this.registry.get('token') as string
                    if (token) setStoryFlag(token, 'metOak')
                })
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

        if (moving) {
            this.walkTimer += delta
            if (this.walkTimer > 200) { this.walkTimer = 0; this.playerFrame = this.playerFrame === 0 ? 1 : 0 }
        } else { this.playerFrame = 0; this.walkTimer = 0 }

        this.playerSprite.setPosition(this.player.x, this.player.y)
        this.playerSprite.setTexture(`player_${this.playerDir}_${this.playerFrame}`)

        if (this.triggered || this.selecting || locked) return

        const spaceDown = Phaser.Input.Keyboard.JustDown(this.spaceKey)
        const px        = this.player as any
        const hasStarter = this.registry.get('hasStarter') as boolean

        if (spaceDown && this.physics.overlap(px, this.oakZone)) {
            this.dialogue.show(
                hasStarter
                    ? ['You already have a creature. Good luck out there!']
                    : ['Choose your partner from the table.'],
                'Prof. Oak',
            )
            return
        }

        if (spaceDown && !hasStarter) {
            for (const { zone, def } of this.ballZones) {
                if (this.physics.overlap(px, zone)) {
                    this.dialogue.show([
                        `${def.name}! A ${def.type}-type creature!`,
                        `Do you choose ${def.name}?`,
                        '(Press SPACE or click to confirm)',
                    ], 'Prof. Oak', () => this.confirmSelection(def))
                    return
                }
            }
        }

        if (this.physics.overlap(px, this.doorZone)) {
            this.triggered = true
            transitionTo(this, 'Outdoor', { from: 'lab' })
        }
    }

    private async confirmSelection(def: typeof POKEBALLS[0]) {
        if (this.selecting) return
        this.selecting = true
        const token = this.registry.get('token') as string
        try {
            const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'
            const res  = await fetch(`${base}/starter/select`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body:    JSON.stringify({ creatureId: def.id }),
            })
            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                this.dialogue.show([e.error ?? 'Could not select starter. Try again.'], 'Error')
                this.selecting = false
                return
            }
            const { starter, garyStarter } = await res.json()
            this.registry.set('hasStarter',   true)
            this.registry.set('starterChosen', starter.id)

            this.dialogue.show([
                `${starter.name} was chosen!`,
                'Excellent! Take good care of it.',
                'Your adventure is about to begin!',
            ], 'Prof. Oak', () => this.garyScene(starter, garyStarter))
        } catch {
            this.dialogue.show(['Could not reach the server.'])
            this.selecting = false
        }
    }

    private garyScene(
        starter: { name: string },
        gary:    { name: string; type: string },
    ) {
        // Slide Gary in from the right
        this.tweens.add({
            targets: [this.garySprite, this.garyLabel],
            x: W - 80, duration: 600, ease: 'Linear',
            onComplete: () => {
                this.dialogue.show([
                    `Ha! You chose ${starter.name}?`,
                    `Then I'll take ${gary.name} — ${gary.type} type!`,
                    'Smell ya later!',
                ], 'Gary', () => {
                    this.registry.set('metGary', true)
                    const token = this.registry.get('token') as string
                    if (token) setStoryFlag(token, 'metGary')
                    this.tweens.add({ targets: [this.garySprite, this.garyLabel], x: W + 70, duration: 400, ease: 'Linear', onComplete: () => { this.selecting = false } })
                })
            },
        })
    }
}
