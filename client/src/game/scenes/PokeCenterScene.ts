import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { InventoryUI } from '../systems/InventoryUI'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'
import playerState from '../systems/PlayerState'
import { ProfileUI } from '../systems/ProfileUI'
import { LeaderboardUI } from '../systems/LeaderboardUI'

const W = 800, H = 576, SPD = 110

export default class PokeCenterScene extends Phaser.Scene {
    private player!:       Phaser.Physics.Arcade.Sprite
    private playerSprite!: Phaser.GameObjects.Image
    private playerDir      = 'up'
    private playerFrame    = 0
    private walkTimer      = 0
    private cursors!:      Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:     Phaser.Input.Keyboard.Key
    private dialogue!:     DialogueSystem
    private inventoryUI!:  InventoryUI
    private walls!:        Phaser.Physics.Arcade.StaticGroup
    private triggered      = false
    private doorZone!:     Phaser.GameObjects.Zone
    private nurseZone!:    Phaser.GameObjects.Zone
    private healZone!:     Phaser.GameObjects.Zone

    constructor() { super({ key: 'PokeCenter' }) }

    create(data?: { from?: string }) {
        fadeIn(this)
        this.triggered = false
        this.dialogue    = new DialogueSystem(this)
        this.inventoryUI = new InventoryUI(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        this.drawInterior()
        this.setupWalls()
        this.setupZones()
        this.spawnPlayer()

        this.inventoryUI.createBagButton()
        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())

        // Profile + Leaderboard HUD
        playerState.load().then(() => {
            new ProfileUI(this).create()
            new LeaderboardUI(this).create()
        })

        // Handle blackout — player was teleported here after losing
        if (data?.from === 'blackout') {
            this.time.delayedCall(500, () => {
                this.dialogue.show([
                    'Oh dear, your Pokémon are hurt!',
                    'Don\'t worry, we\'ll take good care of them.',
                    '♪ ding ding ding... ♪',
                    'Your Pokémon have been healed to full health!',
                    'Please be more careful out there!',
                ], 'Nurse Joy')
            })
        }
    }

    private drawInterior() {
        const gfx = this.add.graphics().setDepth(0)

        // ── Floor tiles ────────────────────────────────────────────
        for (let y = 80; y < H; y += 32) {
            for (let x = 0; x < W; x += 32) {
                this.add.image(x, y, 'tile_floor_pokecenter').setOrigin(0)
                    .setDisplaySize(32, 32).setDepth(0)
            }
        }
        // Subtle checker overlay on floor
        gfx.fillStyle(0x000000, 0.025)
        for (let y = 80; y < H; y += 64) {
            for (let x = 0; x < W; x += 64) {
                gfx.fillRect(x, y, 32, 32)
                gfx.fillRect(x + 32, y + 32, 32, 32)
            }
        }

        // ── Wall ───────────────────────────────────────────────────
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, 0, 'tile_wall_lab').setOrigin(0)
                .setDisplaySize(32, 80).setDepth(0)
        }
        // Wall accent strip (red, matching roof)
        const g = this.add.graphics().setDepth(1)
        g.fillStyle(0xd83830).fillRect(0, 0, W, 8)
        g.fillStyle(0xf04840).fillRect(0, 0, W, 3)
        // Wainscoting / shadow under wall
        g.fillStyle(0x000000, 0.12).fillRect(0, 76, W, 4)
        g.fillStyle(0xc09060, 0.5).fillRect(0, 72, W, 4)

        // ── Main counter (more polished) ───────────────────────────
        const counterX = W / 2 - 80, counterY = 140
        // Counter body
        this.add.rectangle(counterX + 80, counterY + 10, 164, 22, 0x906030).setDepth(1)
        this.add.rectangle(counterX + 80, counterY + 10, 160, 20, 0xa07040).setDepth(1)
        this.add.rectangle(counterX + 80, counterY + 10, 156, 16, 0xb08050).setDepth(1)
        // Counter top edge / lip
        this.add.rectangle(counterX + 80, counterY, 162, 4, 0xc09060).setDepth(1)
        // Counter shadow on floor
        gfx.fillStyle(0x000000, 0.08).fillRect(counterX + 2, counterY + 22, 160, 5)

        // ── Healing machine ────────────────────────────────────────
        this.add.image(W / 2 + 40, counterY - 30, 'furn_heal_machine')
            .setDisplaySize(48, 40).setDepth(2)
        // Glow under machine
        gfx.fillStyle(0x40ff80, 0.06).fillRect(W / 2 + 16, counterY - 48, 48, 36)
        this.add.text(W / 2 + 40, counterY - 56, 'Heal Machine', {
            fontSize: '7px', color: '#555', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)

        // ── Nurse Joy ──────────────────────────────────────────────
        const nurseX = W / 2 - 20, nurseY = counterY - 30
        this.add.image(nurseX, nurseY, 'npc_nurse')
            .setDisplaySize(28, 42).setDepth(3)
        this.add.text(nurseX, nurseY - 24, 'Nurse Joy', {
            fontSize: '8px', color: '#f06090', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(3)
        this.nurseZone = this.add.zone(nurseX, nurseY, 50, 50).setOrigin(0.5)
        this.physics.add.existing(this.nurseZone, true)

        // ── Heal zone (at counter front) ───────────────────────────
        this.healZone = this.add.zone(W / 2 + 40, counterY + 36, 50, 24).setOrigin(0.5)
        this.physics.add.existing(this.healZone, true)

        // ── Waiting area — couches with shadows ────────────────────
        const couchPositions = [
            { x: 120, y: 260 }, { x: 120, y: 380 },
            { x: 680, y: 260 }, { x: 680, y: 380 },
        ]
        couchPositions.forEach(c => {
            this.add.image(c.x, c.y, 'furn_couch').setDisplaySize(100, 50).setDepth(1)
            gfx.fillStyle(0x000000, 0.06).fillRect(c.x - 50, c.y + 22, 100, 4)
        })

        // ── Tables between couches ─────────────────────────────────
        this.add.image(120, 320, 'furn_table').setDisplaySize(40, 32).setDepth(1)
        this.add.image(680, 320, 'furn_table').setDisplaySize(40, 32).setDepth(1)

        // ── Plants (in all corners) ────────────────────────────────
        this.add.image(50, 110, 'furn_plant').setDisplaySize(30, 48).setDepth(1)
        this.add.image(W - 50, 110, 'furn_plant').setDisplaySize(30, 48).setDepth(1)
        this.add.image(50, H - 60, 'furn_plant').setDisplaySize(30, 48).setDepth(1)
        this.add.image(W - 50, H - 60, 'furn_plant').setDisplaySize(30, 48).setDepth(1)

        // ── Bookshelves along left wall ────────────────────────────
        this.add.image(30, 200, 'furn_bookshelf').setDisplaySize(40, 56).setDepth(1)
        this.add.image(30, 320, 'furn_bookshelf').setDisplaySize(40, 56).setDepth(1)

        // ── Computer on right wall ─────────────────────────────────
        this.add.image(W - 50, 200, 'furn_computer').setDisplaySize(32, 40).setDepth(1)
        // PC label
        this.add.text(W - 50, 178, 'PC', {
            fontSize: '7px', color: '#555', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)

        // ── Bulletin board on left wall ────────────────────────────
        this.add.rectangle(30, 440, 36, 44, 0xc0a070).setDepth(1)
        this.add.rectangle(30, 440, 32, 40, 0xf0e8d0).setDepth(1)
        this.add.text(30, 440, '📋', { fontSize: '16px' }).setOrigin(0.5).setDepth(2)

        // ── Door (bottom center, with doormat) ─────────────────────
        this.add.image(W / 2, H - 12, 'obj_door').setDisplaySize(48, 24).setDepth(1)
        this.add.image(W / 2, H - 2, 'obj_doormat').setDisplaySize(48, 10).setDepth(1)

        // ── Floor arrows to counter hint ───────────────────────────
        this.add.text(W / 2, 192, '▲ Talk to Nurse Joy', {
            fontSize: '7px', color: '#c0a0a0', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(1)

        // ── Title banner (dark bg with white lines) ────────────────
        gfx.fillStyle(0x000000, 0.6).fillRect(W / 2 - 110, 14, 220, 24)
        gfx.fillStyle(0xf8f8f8).fillRect(W / 2 - 110, 14, 220, 1)
        gfx.fillStyle(0xf8f8f8).fillRect(W / 2 - 110, 37, 220, 1)
        this.add.text(W / 2, 18, 'POKéMON CENTER', {
            fontSize: '14px', color: '#ff6060', fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(2)

        this.add.text(W / 2, 50, 'We heal your Pokémon to perfect health!', {
            fontSize: '9px', color: '#999', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)
    }

    private setupWalls() {
        this.walls = this.physics.add.staticGroup()
        const wall = (x: number, y: number, w: number, h: number) => {
            const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0) as any
            this.physics.add.existing(r, true)
            this.walls.add(r)
        }
        wall(0, 0, W, 80)           // top wall
        wall(0, 0, 20, H)           // left
        wall(W - 20, 0, 20, H)      // right
        // Counter
        wall(W / 2 - 80, 120, 160, 40)
        // Couches
        wall(70, 240, 100, 40)
        wall(70, 360, 100, 40)
        wall(630, 240, 100, 40)
        wall(630, 360, 100, 40)
    }

    private setupZones() {
        this.doorZone = this.add.zone(W / 2, H - 4, 48, 16).setOrigin(0.5)
        this.physics.add.existing(this.doorZone, true)
    }

    private spawnPlayer() {
        const spawnX = W / 2, spawnY = H - 60
        this.playerSprite = this.add.image(spawnX, spawnY, 'player_up_0')
            .setDisplaySize(28, 42).setDepth(5)

        const rect = this.add.rectangle(spawnX, spawnY, 14, 20, 0xff0000, 0) as any
        this.physics.add.existing(rect)
        this.player = rect as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body)
            .setCollideWorldBounds(true).setSize(14, 20)

        this.physics.add.collider(this.player as any, this.walls)
    }

    update(_t: number, delta: number) {
        this.inventoryUI.update()
        if (this.inventoryUI.active()) return

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
            if (this.walkTimer > 200) {
                this.walkTimer = 0
                this.playerFrame = this.playerFrame === 0 ? 1 : 0
            }
        } else {
            this.playerFrame = 0
            this.walkTimer = 0
        }

        this.playerSprite.setPosition(this.player.x, this.player.y)
        this.playerSprite.setTexture(`player_${this.playerDir}_${this.playerFrame}`)

        // ── Interactions ───────────────────────────────────────────
        if (!locked && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const px = this.player as any
            if (this.physics.overlap(px, this.nurseZone)) {
                playerState.healAll().then(() => {
                    this.dialogue.show([
                        'Welcome to our Pokémon Center!',
                        'We restore your tired Pokémon to full health.',
                        '♪ ding ding ding... ♪',
                        'Your Pokémon have been healed! ♪',
                        'We hope to see you again!',
                    ], 'Nurse Joy')
                })
            } else if (this.physics.overlap(px, this.healZone)) {
                playerState.healAll().then(() => {
                    this.dialogue.show([
                        '♪ ding ding ding... ♪',
                        'Your Pokémon have been fully restored!',
                    ], 'Heal Machine')
                })
            }
        }

        // ── Exit ───────────────────────────────────────────────────
        if (!this.triggered && !locked) {
            if (this.physics.overlap(this.player as any, this.doorZone)) {
                this.triggered = true
                transitionTo(this, 'ViridianCity', { from: 'pokeCenter' })
            }
        }
    }
}
