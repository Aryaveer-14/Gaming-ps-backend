import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'
import { setStoryFlag } from '../../lib/overworldSocket'

const W = 800, H = 576, SPD = 110

const POKEBALLS = [
    { x: 260, y: 240, id: 'flameling', name: 'Flameling', type: 'Fire',  color: 0xff4422 },
    { x: 400, y: 240, id: 'aquafin',   name: 'Aquafin',   type: 'Water', color: 0x2266ff },
    { x: 540, y: 240, id: 'verdling',  name: 'Verdling',  type: 'Grass', color: 0x33bb44 },
]

export default class LabInteriorScene extends Phaser.Scene {
    // @ts-ignore
    private player!:     Phaser.Physics.Arcade.Sprite
    private cursors!:    Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:   Phaser.Input.Keyboard.Key
    private dialogue!:   DialogueSystem
    private oakZone!:    Phaser.GameObjects.Zone
    private doorZone!:   Phaser.GameObjects.Zone
    private ballZones:   { zone: Phaser.GameObjects.Zone; def: typeof POKEBALLS[0] }[] = []
    private triggered    = false
    private selecting    = false
    private garySprite!: Phaser.GameObjects.Rectangle
    private garyLabel!:  Phaser.GameObjects.Text

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

        const g = this.add.graphics()

        // Floor tiles
        g.fillStyle(0xccccbb).fillRect(0, 0, W, H)
        g.lineStyle(1, 0xbbbbaa, 0.4)
        for (let gx = 0; gx < W; gx += 32) g.lineBetween(gx, 0, gx, H)
        for (let gy = 0; gy < H; gy += 32) g.lineBetween(0, gy, W, gy)

        // Walls
        g.fillStyle(0xeeeecc).fillRect(0, 0, W, 80)
        g.fillStyle(0xaaaacc).fillRect(0, 0, W, 8)

        // Lab table
        g.fillStyle(0x888877).fillRect(180, 190, 440, 16)
        g.fillStyle(0xccccaa).fillRect(182, 166, 436, 26)

        // Pokéballs
        POKEBALLS.forEach(b => {
            g.fillStyle(0xffffff).fillCircle(b.x, b.y, 16)
            g.fillStyle(b.color).fillCircle(b.x, b.y - 8, 16)
            g.fillStyle(0x000000).fillRect(b.x - 16, b.y - 2, 32, 4)
            g.fillStyle(0xffffff).fillCircle(b.x, b.y, 5)
            this.add.text(b.x, b.y + 28, `${b.name}\n[${b.type}]`, {
                fontSize: '9px', color: '#333', fontFamily: 'monospace', align: 'center',
            }).setOrigin(0.5)
            const zone = this.add.zone(b.x, b.y, 36, 36).setOrigin(0.5)
            this.physics.add.existing(zone, true)
            this.ballZones.push({ zone, def: b })
        })

        // Lab shelves
        g.fillStyle(0x886644).fillRect(20, 80, 120, 80)
        g.fillStyle(0xaaffbb).fillRect(28, 88, 20, 30)
        g.fillStyle(0xffffaa).fillRect(54, 88, 20, 30)
        g.fillStyle(0x886644).fillRect(W - 140, 80, 120, 80)
        g.fillStyle(0x333344).fillRect(W - 130, 84, 80, 50)
        g.fillStyle(0x5588ff).fillRect(W - 128, 86, 76, 46)

        // Oak NPC
        const oakX = W / 2, oakY = 120
        this.add.rectangle(oakX, oakY, 14, 20, 0x5566aa).setDepth(2)
        this.add.text(oakX, oakY - 18, 'Prof. Oak', { fontSize: '9px', color: '#334', fontFamily: 'monospace' }).setOrigin(0.5)
        this.oakZone = this.add.zone(oakX, oakY, 48, 48).setOrigin(0.5)
        this.physics.add.existing(this.oakZone, true)

        // Gary (off-screen right, slides in during cutscene)
        this.garySprite = this.add.rectangle(W + 50, 340, 14, 20, 0x2244bb).setDepth(3)
        this.garyLabel  = this.add.text(W + 50, 322, 'Gary', { fontSize: '9px', color: '#2244bb', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(3)

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

        if (!locked) {
            const { left, right, up, down } = this.cursors
            if (left.isDown)  body.setVelocityX(-SPD)
            if (right.isDown) body.setVelocityX(SPD)
            if (up.isDown)    body.setVelocityY(-SPD)
            if (down.isDown)  body.setVelocityY(SPD)
        }

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
                    this.tweens.add({ targets: [this.garySprite, this.garyLabel], x: W + 70, duration: 400, ease: 'Linear' })
                })
            },
        })
    }
}
