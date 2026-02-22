import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { ShopUI } from '../systems/ShopUI'
import { InventoryUI } from '../systems/InventoryUI'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'
import playerState from '../systems/PlayerState'
import { ProfileUI } from '../systems/ProfileUI'
import { LeaderboardUI } from '../systems/LeaderboardUI'
import { useAuthStore } from '../../store/authStore'

const W = 800, H = 576, SPD = 110

export default class PokeMartScene extends Phaser.Scene {
    private player!:       Phaser.Physics.Arcade.Sprite
    private playerSprite!: Phaser.GameObjects.Image
    private playerDir      = 'up'
    private playerFrame    = 0
    private walkTimer      = 0
    private cursors!:      Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:     Phaser.Input.Keyboard.Key
    private dialogue!:     DialogueSystem
    private shopUI!:       ShopUI
    private inventoryUI!:  InventoryUI
    private walls!:        Phaser.Physics.Arcade.StaticGroup
    private triggered      = false
    private doorZone!:     Phaser.GameObjects.Zone
    private clerkZone!:    Phaser.GameObjects.Zone
    private shelfZones:    Phaser.GameObjects.Zone[] = []

    constructor() { super({ key: 'PokeMart' }) }

    create() {
        fadeIn(this)
        this.triggered = false
        this.shelfZones = []
        this.dialogue    = new DialogueSystem(this)
        this.shopUI      = new ShopUI(this)
        this.inventoryUI = new InventoryUI(this)
        this.cursors     = this.input.keyboard!.createCursorKeys()
        this.spaceKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        this.drawInterior()
        this.setupWalls()
        this.setupZones()
        this.spawnPlayer()

        this.inventoryUI.createBagButton()
        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())

        // ── Profile + Leaderboard HUD ──────────────────────────
        playerState.load().then(() => {
            new ProfileUI(this).create()
            new LeaderboardUI(this).create()
        })
    }

    private drawInterior() {
        const g = this.add.graphics().setDepth(0)

        // ── Floor — FRLG checkerboard blue/white tile ──────────────
        for (let y = 80; y < H; y += 32) {
            for (let x = 0; x < W; x += 32) {
                this.add.image(x, y, 'tile_floor_pokemart').setOrigin(0)
                    .setDisplaySize(32, 32).setDepth(0)
            }
        }

        // ── Wall — layered with wainscoting ────────────────────────
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, 0, 'tile_wall_lab').setOrigin(0)
                .setDisplaySize(32, 80).setDepth(0)
        }
        // Blue accent strip at top (matching mart roof)
        g.fillStyle(0x2868b8).fillRect(0, 0, W, 10)
        g.fillStyle(0x3878d0).fillRect(0, 0, W, 4)
        g.fillStyle(0x1848a0).fillRect(0, 8, W, 2)
        // Wainscoting trim line
        g.fillStyle(0x445588).fillRect(0, 78, W, 2)
        // Shadow strip under wall
        g.fillStyle(0x000000, 0.06)
        g.fillRect(0, 80, W, 8)

        // ── Main counter with register ─────────────────────────────
        const counterX = W / 2 - 80, counterY = 140
        this.add.image(counterX + 80, counterY, 'furn_shop_counter')
            .setDisplaySize(180, 36).setDepth(1)

        // Glass display on counter
        g.fillStyle(0x404848).fillRect(counterX + 4, counterY - 16, 60, 28)
        g.fillStyle(0x80c8e8, 0.5).fillRect(counterX + 6, counterY - 14, 56, 24)
        this.add.image(counterX + 20, counterY - 4, 'obj_pokeball_fire')
            .setDisplaySize(14, 14).setDepth(2)
        this.add.image(counterX + 38, counterY - 4, 'obj_pokeball_water')
            .setDisplaySize(14, 14).setDepth(2)
        this.add.image(counterX + 54, counterY - 4, 'obj_pokeball_grass')
            .setDisplaySize(14, 14).setDepth(2)

        // ── Shopkeeper NPC ─────────────────────────────────────────
        const clerkX = W / 2 + 10, clerkY = counterY - 36
        this.add.image(clerkX, clerkY, 'npc_shopkeeper')
            .setDisplaySize(28, 42).setDepth(3)
        this.add.text(clerkX, clerkY - 26, 'Clerk', {
            fontSize: '9px', color: '#38a028', fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(3)
        this.clerkZone = this.add.zone(clerkX, counterY + 26, 60, 30).setOrigin(0.5)
        this.physics.add.existing(this.clerkZone, true)

        // ── Product shelves (left aisle) ───────────────────────────
        const leftShelves = [
            { x: 100, y: 240, label: 'Potions' },
            { x: 100, y: 340, label: 'Status Heals' },
            { x: 100, y: 440, label: 'Revives' },
        ]
        for (const shelf of leftShelves) {
            this.add.image(shelf.x, shelf.y, 'furn_shop_shelf')
                .setDisplaySize(44, 52).setDepth(1)
            this.add.text(shelf.x, shelf.y - 32, shelf.label, {
                fontSize: '7px', color: '#556677', fontFamily: 'monospace',
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(2)
            g.fillStyle(0x000000, 0.04)
            g.fillRect(shelf.x - 22, shelf.y + 26, 50, 6)
            const zone = this.add.zone(shelf.x, shelf.y, 56, 60).setOrigin(0.5)
            this.physics.add.existing(zone, true)
            this.shelfZones.push(zone)
        }

        // ── Product shelves (right aisle) ──────────────────────────
        const rightShelves = [
            { x: 680, y: 240, label: 'Poké Balls' },
            { x: 680, y: 340, label: 'Repels' },
            { x: 680, y: 440, label: 'Escape Rope' },
        ]
        for (const shelf of rightShelves) {
            this.add.image(shelf.x, shelf.y, 'furn_shop_shelf')
                .setDisplaySize(44, 52).setDepth(1)
            this.add.text(shelf.x, shelf.y - 32, shelf.label, {
                fontSize: '7px', color: '#556677', fontFamily: 'monospace',
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(2)
            g.fillStyle(0x000000, 0.04)
            g.fillRect(shelf.x - 22, shelf.y + 26, 50, 6)
            const zone = this.add.zone(shelf.x, shelf.y, 56, 60).setOrigin(0.5)
            this.physics.add.existing(zone, true)
            this.shelfZones.push(zone)
        }

        // ── Center displays (gondola-style) ────────────────────────
        const centerDisplays = [
            { x: 340, y: 290, label: 'TMs' },
            { x: 460, y: 290, label: 'Berries' },
            { x: 340, y: 410, label: 'Mail' },
            { x: 460, y: 410, label: 'Accessories' },
        ]
        for (const shelf of centerDisplays) {
            this.add.image(shelf.x, shelf.y, 'furn_shop_shelf')
                .setDisplaySize(40, 48).setDepth(1)
            this.add.text(shelf.x, shelf.y - 30, shelf.label, {
                fontSize: '7px', color: '#556677', fontFamily: 'monospace',
            }).setOrigin(0.5).setDepth(2)
            g.fillStyle(0x000000, 0.04)
            g.fillRect(shelf.x - 20, shelf.y + 24, 46, 6)
            const zone = this.add.zone(shelf.x, shelf.y, 50, 56).setOrigin(0.5)
            this.physics.add.existing(zone, true)
            this.shelfZones.push(zone)
        }

        // ── Decorative plants ──────────────────────────────────────
        this.add.image(50, 100, 'furn_plant').setDisplaySize(30, 48).setDepth(1)
        this.add.image(W - 50, 100, 'furn_plant').setDisplaySize(30, 48).setDepth(1)
        this.add.image(50, H - 70, 'furn_plant').setDisplaySize(26, 42).setDepth(1)
        this.add.image(W - 50, H - 70, 'furn_plant').setDisplaySize(26, 42).setDepth(1)

        // ── Floor mat at entrance ──────────────────────────────────
        this.add.image(W / 2, H - 28, 'obj_doormat').setDisplaySize(52, 18).setDepth(0)

        // ── Door (bottom center) ───────────────────────────────────
        this.add.image(W / 2, H - 12, 'obj_door').setDisplaySize(52, 26).setDepth(1)
        g.fillStyle(0xc09060).fillRect(W / 2 - 26, H - 4, 52, 4)

        // ── Title banner ───────────────────────────────────────────
        g.fillStyle(0x1c3060, 0.8).fillRect(W / 2 - 100, 18, 200, 28)
        g.fillStyle(0xf8f8f8).fillRect(W / 2 - 100, 18, 200, 2)
        g.fillStyle(0xf8f8f8).fillRect(W / 2 - 100, 44, 200, 2)
        this.add.text(W / 2, 28, 'POKé MART', {
            fontSize: '16px', color: '#ffd700', fontFamily: 'monospace',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(2)
        this.add.text(W / 2, 50, '"We\'ve got everything a Trainer needs!"', {
            fontSize: '8px', color: '#aabbcc', fontFamily: 'monospace',
            fontStyle: 'italic',
        }).setOrigin(0.5).setDepth(2)

        // ── Floor guide hint ───────────────────────────────────────
        this.add.text(W / 2, counterY + 44, '▲ Talk to Clerk to shop', {
            fontSize: '8px', color: '#667788', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(1)
    }

    private setupWalls() {
        this.walls = this.physics.add.staticGroup()
        const wall = (x: number, y: number, w: number, h: number) => {
            const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0) as any
            this.physics.add.existing(r, true)
            this.walls.add(r)
        }
        wall(0, 0, W, 80)              // top wall
        wall(0, 0, 24, H)              // left
        wall(W - 24, 0, 24, H)         // right
        // Counter
        wall(W / 2 - 90, 120, 180, 36)
        // Left shelves
        wall(78, 214, 44, 52)
        wall(78, 314, 44, 52)
        wall(78, 414, 44, 52)
        // Right shelves
        wall(658, 214, 44, 52)
        wall(658, 314, 44, 52)
        wall(658, 414, 44, 52)
        // Center shelves
        wall(320, 266, 40, 48)
        wall(440, 266, 40, 48)
        wall(320, 386, 40, 48)
        wall(440, 386, 40, 48)
    }

    private setupZones() {
        this.doorZone = this.add.zone(W / 2, H - 4, 52, 16).setOrigin(0.5)
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
        // ── Overlay UIs take priority ──────────────────────────────
        if (this.shopUI.active()) {
            this.shopUI.update()
            return
        }
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
            if (this.physics.overlap(px, this.clerkZone)) {
                const token = (this.registry.get('token') as string) || useAuthStore.getState().token || ''
                this.shopUI.open(token, () => {
                    this.dialogue.show(['Thank you for shopping with us!'], 'Clerk')
                })
            } else {
                for (const sz of this.shelfZones) {
                    if (this.physics.overlap(px, sz)) {
                        this.dialogue.show([
                            'The shelves are stocked with items.',
                            'Talk to the Clerk at the counter to buy!',
                        ])
                        break
                    }
                }
            }
        }

        // ── Exit ───────────────────────────────────────────────────
        if (!this.triggered && !locked) {
            if (this.physics.overlap(this.player as any, this.doorZone)) {
                this.triggered = true
                transitionTo(this, 'ViridianCity', { from: 'pokeMart' })
            }
        }
    }
}
