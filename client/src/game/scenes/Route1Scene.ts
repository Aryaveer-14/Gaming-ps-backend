import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { InventoryUI } from '../systems/InventoryUI'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'
import playerState from '../systems/PlayerState'
import { ProfileUI } from '../systems/ProfileUI'
import { LeaderboardUI } from '../systems/LeaderboardUI'
import { NPCController, type NPCDef, type NPCTrainerMon } from '../systems/NPCController'
import { NotificationUI } from '../systems/NotificationUI'
import checkpointManager from '../systems/CheckpointManager'
import saveManager from '../systems/SaveManager'
import { MultiplayerUI } from '../systems/MultiplayerUI'

const W = 800, H = 576, SPD = 120
const PATH_X = W / 2 - 48, PATH_W = 96

// ── Wild encounter config ──────────────────────────────────────────────
const ENCOUNTER_STEP_INTERVAL = 32    // check every 32px of movement
const ENCOUNTER_CHANCE         = 0.18 // 18% per check in tall grass
const ENCOUNTER_COOLDOWN       = 1200 // ms after leaving battle before next encounter

interface WildEntry {
    creatureId: string
    name: string
    type: string
    minLevel: number
    maxLevel: number
    weight: number            // relative spawn weight
}

const WILD_TABLE: WildEntry[] = [
    { creatureId: 'verdling',  name: 'Verdling',  type: 'Grass',    minLevel: 2, maxLevel: 5, weight: 35 },
    { creatureId: 'voltpup',   name: 'Voltpup',   type: 'Electric', minLevel: 2, maxLevel: 5, weight: 30 },
    { creatureId: 'flameling', name: 'Flameling', type: 'Fire',     minLevel: 3, maxLevel: 5, weight: 20 },
    { creatureId: 'stonebear', name: 'Stonebear', type: 'Normal',   minLevel: 3, maxLevel: 6, weight: 10 },
    { creatureId: 'aquafin',   name: 'Aquafin',   type: 'Water',    minLevel: 3, maxLevel: 5, weight: 5  },
]
const TOTAL_WEIGHT = WILD_TABLE.reduce((s, w) => s + w.weight, 0)

const TALL_GRASS_RECTS = [
    { x: 80, y: 80, w: 144, h: 96 },
    { x: 64, y: 300, w: 144, h: 112 },
    { x: 512, y: 140, w: 160, h: 112 },
    { x: 528, y: 380, w: 144, h: 96 },
]

const SPAWNS: Record<string, { x: number; y: number }> = {
    palletTown:   { x: W / 2, y: H - 50 },
    viridianCity: { x: W / 2, y: 50 },
    default:      { x: W / 2, y: H - 50 },
}

function calcHp(baseHp: number, level: number): number {
    return Math.floor(((2 * baseHp) * level) / 100 + level + 10)
}

// ── NPC definitions for Route 1 (Bush/Wild Area) ──────────────────────
const ROUTE1_NPCS: NPCDef[] = [
    {
        id: 'route1_youngster',
        name: 'Youngster Joey',
        x: PATH_X + PATH_W + 44,
        y: 260,
        spriteKey: 'npc_remote',
        dialogue: [
            "Hey! I'm training on this route!",
            "Viridian City is just up ahead.",
            "Wanna test your skills against me?",
        ],
        defeatedDialogue: [
            "You're too strong for me!",
            "There's a mysterious cave north of the city...",
            "They say a legendary creature sleeps inside!",
        ],
        continueDialogue: [
            "My Voltpup is my best buddy!",
            "We've been training together every day.",
            "One day we'll be champions!",
        ],
        canBattle: true,
        team: [
            {
                creatureId: 'voltpup', name: 'Voltpup', type: 'Electric',
                level: 5, hp: calcHp(40, 5), maxHp: calcHp(40, 5),
                trainerName: 'Youngster Joey',
                moves: [
                    { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
                    { id: 'thunder_shock', name: 'Thunder Shock', type: 'Electric', power: 40 },
                ],
            },
            {
                creatureId: 'verdling', name: 'Verdling', type: 'Grass',
                level: 4, hp: calcHp(40, 4), maxHp: calcHp(40, 4),
                trainerName: 'Youngster Joey',
                moves: [
                    { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
                    { id: 'vine_whip', name: 'Vine Whip', type: 'Grass', power: 45 },
                ],
            },
        ],
        battleTeamName: 'Youngster Joey',
        returnScene: 'Route1',
    },
    {
        id: 'route1_hiker',
        name: 'Hiker',
        x: 180,
        y: 200,
        hairColor: 0x805030,
        shirtColor: 0x8B6914,
        dialogue: [
            "Whoa there, traveler!",
            "The tall grass is crawling with wild creatures.",
            "Think you can handle a real battle?",
        ],
        defeatedDialogue: [
            "Ha! You've got guts, kid!",
            "Head north if you're brave enough.",
        ],
        continueDialogue: [
            "I've been hiking this route for years.",
            "The creatures here get stronger at night.",
            "Always keep some Pokéballs handy!",
        ],
        canBattle: true,
        team: [
            {
                creatureId: 'stonebear', name: 'Stonebear', type: 'Normal',
                level: 6, hp: calcHp(50, 6), maxHp: calcHp(50, 6),
                trainerName: 'Hiker',
                moves: [
                    { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
                    { id: 'rock_throw', name: 'Rock Throw', type: 'Normal', power: 50 },
                ],
            },
        ],
        battleTeamName: 'Hiker',
        returnScene: 'Route1',
    },
]

export default class Route1Scene extends Phaser.Scene {
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
    private southExit!:    Phaser.GameObjects.Zone
    private northExit!:    Phaser.GameObjects.Zone
    private trainerZone!:  Phaser.GameObjects.Zone
    private signZone!:     Phaser.GameObjects.Zone
    private npcController!: NPCController
    private notifyUI!:     NotificationUI
    private multiplayerUI!: MultiplayerUI

    // ── Wild encounter tracking ────────────────────────────────
    private stepAccum      = 0
    private lastPlayerX    = 0
    private lastPlayerY    = 0
    private encounterCooldown = 0
    private overworldCreatures: Phaser.GameObjects.Image[] = []

    constructor() { super({ key: 'Route1' }) }

    create(data?: { from?: string; spawnX?: number; spawnY?: number; npcId?: string; encounterCooldown?: number }) {
        fadeIn(this)
        this.triggered = false
        this.dialogue    = new DialogueSystem(this)
        this.inventoryUI = new InventoryUI(this)
        this.notifyUI    = new NotificationUI(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        this.drawRoute()
        this.setupWalls()
        this.setupZones()
        this.spawnPlayer(data)

        // ── NPCController for interactive NPCs ─────────────────
        this.npcController = new NPCController(this, this.dialogue, ROUTE1_NPCS)
        this.npcController.create()

        // ── Handle return from NPC battle ───────────────────────
        if (data?.from === 'npcBattle' && data?.npcId) {
            this.npcController.markDefeated(data.npcId)
        }

        this.inventoryUI.createBagButton()
        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())

        // ── Trigger checkpoint on entry ─────────────────────────
        checkpointManager.reach('ROUTE1', { x: this.player.x, y: this.player.y })
        this.notifyUI.showCheckpoint('Route 1')
        saveManager.setPosition('Route1', this.player.x, this.player.y)
        saveManager.save()

        // ── Multiplayer interactions ────────────────────────────
        this.multiplayerUI = new MultiplayerUI(this, 'route1', this.player)
        this.multiplayerUI.create()

        // ── Wild encounter setup ────────────────────────────────
        this.stepAccum = 0
        this.encounterCooldown = data?.encounterCooldown ?? 0
        this.spawnOverworldCreatures()

        // ── Profile + Leaderboard HUD ──────────────────────────
        playerState.load().then(() => {
            new ProfileUI(this).create()
            new LeaderboardUI(this).create()
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DRAW — Route 1 landscape with path, tall grass, trees
    // ═══════════════════════════════════════════════════════════════════════

    private drawRoute() {
        const gfx = this.add.graphics().setDepth(0)

        // ── Grass background ───────────────────────────────────────
        for (let y = 0; y < H; y += 32) {
            for (let x = 0; x < W; x += 32) {
                this.add.image(x, y, 'tile_grass').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            }
        }

        // ── Main path (center vertical, wider) ────────────────────
        for (let y = 0; y < H; y += 32) {
            for (let x = PATH_X; x < PATH_X + PATH_W; x += 32) {
                this.add.image(x, y, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            }
        }
        // Path edge lines
        gfx.fillStyle(0x489020, 0.35)
        gfx.fillRect(PATH_X - 2, 0, 2, H)
        gfx.fillRect(PATH_X + PATH_W, 0, 2, H)
        // Path center worn strip
        gfx.fillStyle(0xc8a060, 0.15)
        gfx.fillRect(PATH_X + PATH_W / 2 - 6, 0, 12, H)

        // ── Tall grass patches (left side, more defined) ───────────
        const tallGrassLeft = [
            { x: 80, y: 80, w: 144, h: 96 },
            { x: 64, y: 300, w: 144, h: 112 },
        ]
        for (const tg of tallGrassLeft) {
            for (let y = tg.y; y < tg.y + tg.h; y += 32) {
                for (let x = tg.x; x < tg.x + tg.w; x += 32) {
                    this.add.image(x, y, 'tile_tall_grass').setOrigin(0)
                        .setDisplaySize(32, 32).setDepth(0)
                }
            }
            // Border shadow around grass patches
            gfx.fillStyle(0x307820, 0.3)
            gfx.fillRect(tg.x - 2, tg.y - 2, tg.w + 4, 2)
            gfx.fillRect(tg.x - 2, tg.y, 2, tg.h)
            gfx.fillRect(tg.x + tg.w, tg.y, 2, tg.h)
            gfx.fillRect(tg.x - 2, tg.y + tg.h, tg.w + 4, 2)
        }

        // ── Tall grass patches (right side) ────────────────────────
        const tallGrassRight = [
            { x: 512, y: 140, w: 160, h: 112 },
            { x: 528, y: 380, w: 144, h: 96 },
        ]
        for (const tg of tallGrassRight) {
            for (let y = tg.y; y < tg.y + tg.h; y += 32) {
                for (let x = tg.x; x < tg.x + tg.w; x += 32) {
                    this.add.image(x, y, 'tile_tall_grass').setOrigin(0)
                        .setDisplaySize(32, 32).setDepth(0)
                }
            }
            gfx.fillStyle(0x307820, 0.3)
            gfx.fillRect(tg.x - 2, tg.y - 2, tg.w + 4, 2)
            gfx.fillRect(tg.x - 2, tg.y, 2, tg.h)
            gfx.fillRect(tg.x + tg.w, tg.y, 2, tg.h)
            gfx.fillRect(tg.x - 2, tg.y + tg.h, tg.w + 4, 2)
        }

        // ── Trees along left edge (denser) ─────────────────────────
        for (let y = 20; y < H - 40; y += 60) {
            this.add.image(24, y, 'obj_tree').setOrigin(0.5, 0.3)
                .setDisplaySize(40, 56).setDepth(1)
        }

        // ── Trees along right edge ─────────────────────────────────
        for (let y = 40; y < H - 40; y += 60) {
            this.add.image(W - 24, y, 'obj_tree').setOrigin(0.5, 0.3)
                .setDisplaySize(40, 56).setDepth(1)
        }

        // ── Scattered trees near path ──────────────────────────────
        const treePoss = [
            { x: 260, y: 60 }, { x: 490, y: 100 },
            { x: 270, y: 240 }, { x: 630, y: 280 },
            { x: 200, y: 460 }, { x: 710, y: 490 },
            { x: 250, y: 520 }, { x: 680, y: 130 },
        ]
        treePoss.forEach(t => {
            this.add.image(t.x, t.y, 'obj_tree').setOrigin(0.5, 0.3)
                .setDisplaySize(40, 56).setDepth(1)
        })

        // ── Flowers along path edges (more abundant) ───────────────
        const flowers = [
            { x: PATH_X - 14, y: 120 }, { x: PATH_X + PATH_W + 14, y: 170 },
            { x: PATH_X - 14, y: 250 }, { x: PATH_X + PATH_W + 14, y: 310 },
            { x: PATH_X - 14, y: 380 }, { x: PATH_X + PATH_W + 14, y: 450 },
            { x: PATH_X - 14, y: 500 }, { x: PATH_X + PATH_W + 14, y: 80 },
        ]
        flowers.forEach((f, i) => {
            const key = i % 3 === 0 ? 'obj_flower_red' : 'obj_flower_yellow'
            this.add.image(f.x, f.y, key).setDisplaySize(12, 12).setDepth(1)
        })

        // ── Fences at south entrance (cleaner) ─────────────────────
        for (let x = 60; x <= PATH_X - 20; x += 34) {
            this.add.image(x, H - 16, 'obj_fence').setDisplaySize(32, 20).setDepth(1)
        }
        for (let x = PATH_X + PATH_W + 20; x <= W - 60; x += 34) {
            this.add.image(x, H - 16, 'obj_fence').setDisplaySize(32, 20).setDepth(1)
        }

        // ── Bushes flanking south entrance ─────────────────────────
        for (let bx = PATH_X - 48; bx > PATH_X - 60; bx -= 26) {
            this.add.image(bx + 13, H - 18, 'obj_bush').setDisplaySize(24, 20).setDepth(1)
        }
        for (let bx = PATH_X + PATH_W + 14; bx < PATH_X + PATH_W + 50; bx += 26) {
            this.add.image(bx + 13, H - 18, 'obj_bush').setDisplaySize(24, 20).setDepth(1)
        }

        // ── Bushes flanking north exit ─────────────────────────────
        for (let bx = PATH_X - 48; bx > PATH_X - 60; bx -= 26) {
            this.add.image(bx + 13, 16, 'obj_bush').setDisplaySize(24, 20).setDepth(1)
        }
        for (let bx = PATH_X + PATH_W + 14; bx < PATH_X + PATH_W + 50; bx += 26) {
            this.add.image(bx + 13, 16, 'obj_bush').setDisplaySize(24, 20).setDepth(1)
        }

        // ── Route label (cleaner banner style) ─────────────────────
        gfx.fillStyle(0x000000, 0.6).fillRect(W / 2 - 70, 24, 140, 20)
        gfx.fillStyle(0xf8f8f8).fillRect(W / 2 - 70, 24, 140, 1)
        gfx.fillStyle(0xf8f8f8).fillRect(W / 2 - 70, 43, 140, 1)
        this.add.text(W / 2, 28, '── ROUTE 1 ──', {
            fontSize: '12px', color: '#fff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(5)

        // ── Direction labels ───────────────────────────────────────
        this.add.text(W / 2, H - 8, '↓ Pallet Town', {
            fontSize: '9px', color: '#fff', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(2)

        this.add.text(W / 2, 52, '↑ Viridian City', {
            fontSize: '9px', color: '#fff', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(2)

        // \u2500\u2500 Route sign near south entrance \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        const signX = PATH_X - 40, signY = H - 60
        this.add.image(signX, signY, 'obj_sign').setDisplaySize(24, 32).setDepth(1)
        this.signZone = this.add.zone(signX, signY, 34, 34).setOrigin(0.5)
        this.physics.add.existing(this.signZone, true)

        // ── Lamp posts along the route ─────────────────────────────
        this.add.image(PATH_X - 20, 200, 'obj_lamp').setDisplaySize(14, 36).setDepth(1)
        this.add.image(PATH_X + PATH_W + 20, 420, 'obj_lamp').setDisplaySize(14, 36).setDepth(1)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WALLS — Boundaries and tree colliders
    // ═══════════════════════════════════════════════════════════════════════

    private setupWalls() {
        this.walls = this.physics.add.staticGroup()
        const wall = (x: number, y: number, w: number, h: number) => {
            const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0) as any
            this.physics.add.existing(r, true)
            this.walls.add(r)
        }
        // Left tree line
        wall(0, 0, 56, H)
        // Right tree line
        wall(W - 56, 0, 56, H)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ZONES — Entry / exit triggers
    // ═══════════════════════════════════════════════════════════════════════

    private setupZones() {
        this.southExit = this.add.zone(W / 2, H - 4, PATH_W, 16).setOrigin(0.5)
        this.northExit = this.add.zone(W / 2, 4, PATH_W, 16).setOrigin(0.5)
        ;[this.southExit, this.northExit].forEach(z =>
            this.physics.add.existing(z, true))
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLAYER — Spawn + physics
    // ═══════════════════════════════════════════════════════════════════════

    private spawnPlayer(data?: any) {
        const from = data?.from as string | undefined
        let sp: { x: number; y: number }

        if (from === 'checkpoint' && data?.spawnX != null) {
            sp = { x: data.spawnX, y: data.spawnY }
        } else if (from === 'wildEncounter' && data?.playerX != null) {
            sp = { x: data.playerX, y: data.playerY }
        } else {
            sp = SPAWNS[from ?? 'default'] ?? SPAWNS.default
        }

        this.playerDir = from === 'viridianCity' ? 'down' : 'up'
        this.playerSprite = this.add.image(sp.x, sp.y, `player_${this.playerDir}_0`)
            .setDisplaySize(28, 42).setDepth(5)

        const rect = this.add.rectangle(sp.x, sp.y, 14, 20, 0xff0000, 0) as any
        this.physics.add.existing(rect)
        this.player = rect as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body)
            .setCollideWorldBounds(true).setSize(14, 20)

        this.physics.add.collider(this.player as any, this.walls)

        this.lastPlayerX = sp.x
        this.lastPlayerY = sp.y
    }

    // ═══════════════════════════════════════════════════════════════════════
    // UPDATE — Movement, animation, zone transitions
    // ═══════════════════════════════════════════════════════════════════════

    update(_t: number, delta: number) {
        this.inventoryUI.update()
        if (this.inventoryUI.active()) return

        this.dialogue.update(delta)
        this.multiplayerUI.update(delta, this.dialogue.active())

        const locked = this.dialogue.active() || this.multiplayerUI.active()
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

        // NPC controller (interactive NPCs with choices/battles)
        this.npcController.update(this.player, delta)
        if (this.npcController.active()) return

        // NPC interactions (SPACE) — legacy Sign only
        if (!locked && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const px = this.player as any
            if (!this.npcController.isOverlapping(px)) {
                if (this.physics.overlap(px, this.signZone)) {
                    this.dialogue.show(['── ROUTE 1 ──', 'Pallet Town ↓  ·  Viridian City ↑'])
                }
            }
        }

        // Update save position
        saveManager.setPosition('Route1', this.player.x, this.player.y)

        // ── Zone transitions ───────────────────────────────────────
        if (!this.triggered && !locked) {
            const px = this.player as any
            if (this.physics.overlap(px, this.southExit)) {
                this.triggered = true
                transitionTo(this, 'Outdoor', { from: 'route1' })
            } else if (this.physics.overlap(px, this.northExit)) {
                this.triggered = true
                transitionTo(this, 'ViridianCity', { from: 'route1' })
            }
        }

        // ── Wild encounter check in tall grass ─────────────────────
        if (!this.triggered && !locked && moving) {
            this.checkWildEncounter(delta)
        }
        if (this.encounterCooldown > 0) {
            this.encounterCooldown -= delta
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WILD ENCOUNTERS — overworld sprites + random trigger
    // ═══════════════════════════════════════════════════════════════════════

    /** Scatter small overworld creature sprites in the tall grass patches */
    private spawnOverworldCreatures() {
        this.overworldCreatures.forEach(c => c.destroy())
        this.overworldCreatures = []

        for (const rect of TALL_GRASS_RECTS) {
            // 2-3 creatures per grass patch
            const count = 2 + Math.floor(Math.random() * 2)
            for (let i = 0; i < count; i++) {
                const entry = this.pickRandomWild()
                const cx = rect.x + 16 + Math.random() * (rect.w - 32)
                const cy = rect.y + 16 + Math.random() * (rect.h - 32)
                const key = `creature_${entry.creatureId}_ow`
                if (this.textures.exists(key)) {
                    const img = this.add.image(cx, cy, key)
                        .setDisplaySize(24, 24).setDepth(2).setAlpha(0.85)
                    this.overworldCreatures.push(img)

                    // Gentle bob animation
                    this.tweens.add({
                        targets: img,
                        y: cy - 3,
                        duration: 1200 + Math.random() * 600,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut',
                        delay: Math.random() * 800,
                    })
                }
            }
        }
    }

    /** Check if player is walking in tall grass and roll for encounter */
    private checkWildEncounter(delta: number) {
        if (this.encounterCooldown > 0) return

        // Accumulate pixel distance walked
        const dx = Math.abs(this.player.x - this.lastPlayerX)
        const dy = Math.abs(this.player.y - this.lastPlayerY)
        this.lastPlayerX = this.player.x
        this.lastPlayerY = this.player.y
        this.stepAccum += Math.sqrt(dx * dx + dy * dy)

        if (this.stepAccum < ENCOUNTER_STEP_INTERVAL) return
        this.stepAccum = 0

        // Is the player inside any tall grass rect?
        const px = this.player.x, py = this.player.y
        const inGrass = TALL_GRASS_RECTS.some(
            r => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
        )
        if (!inGrass) return

        // Roll for encounter
        if (Math.random() > ENCOUNTER_CHANCE) return

        // Trigger!
        this.triggered = true
        const entry = this.pickRandomWild()
        const level = entry.minLevel + Math.floor(Math.random() * (entry.maxLevel - entry.minLevel + 1))
        const hp = Math.floor(20 + level * 5 + Math.random() * 8) // rough wild HP

        // Quick flash then scene transition (no callback — use delayedCall instead)
        this.cameras.main.flash(250, 255, 255, 255)
        const encounterData = {
            creatureId:   entry.creatureId,
            creatureName: entry.name,
            creatureType: entry.type,
            level,
            hp,
            maxHp: hp,
            returnScene: 'Route1',
            returnData: { from: 'wildEncounter', encounterCooldown: ENCOUNTER_COOLDOWN, playerX: this.player.x, playerY: this.player.y },
        }
        this.time.delayedCall(300, () => {
            this.scene.start('WildEncounter', encounterData)
        })
    }

    /** Pick a random creature from the wild table using weights */
    private pickRandomWild(): WildEntry {
        let roll = Math.random() * TOTAL_WEIGHT
        for (const entry of WILD_TABLE) {
            roll -= entry.weight
            if (roll <= 0) return entry
        }
        return WILD_TABLE[0]
    }

    shutdown() { this.multiplayerUI?.destroy() }
}
