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
const PCENTER_X = 140, PCENTER_Y = 50
const MART_X = 500, MART_Y = 50
const CAVE_X = W - 70, CAVE_Y = H / 2 - 50

const SPAWNS: Record<string, { x: number; y: number }> = {
    route1:     { x: W / 2, y: H - 50 },
    cave:       { x: CAVE_X - 20, y: CAVE_Y + 70 },
    pokeCenter: { x: PCENTER_X + 72, y: PCENTER_Y + 130 },
    pokeMart:   { x: MART_X + 60, y: MART_Y + 124 },
    default:    { x: W / 2, y: H - 50 },
}

function calcHp(baseHp: number, level: number): number {
    return Math.floor(((2 * baseHp) * level) / 100 + level + 10)
}

// ── NPC definitions for Viridian City ─────────────────────────────
const VIRIDIAN_NPCS: NPCDef[] = [
    {
        id: 'viridian_guard',
        name: 'City Guard',
        x: W / 2 + 100,
        y: H / 2 + 30,
        hairColor: 0x202040,
        shirtColor: 0x3040a0,
        dialogue: [
            "Halt! This area is under watch.",
            "Strange noises from the cave lately...",
            "You look tough. Care to test yourself?",
        ],
        defeatedDialogue: [
            "You're the real deal, kid.",
            "Be careful in that cave — Team Rocket lurks inside.",
        ],
        continueDialogue: [
            "I've been guarding this city for years.",
            "We've had reports of Team Rocket activity.",
            "The PokéCenter is always open if you need healing.",
        ],
        canBattle: true,
        team: [
            {
                creatureId: 'flameling', name: 'Flameling', type: 'Fire',
                level: 7, hp: calcHp(39, 7), maxHp: calcHp(39, 7),
                trainerName: 'City Guard',
                moves: [
                    { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
                    { id: 'ember', name: 'Ember', type: 'Fire', power: 40 },
                    { id: 'scratch', name: 'Scratch', type: 'Normal', power: 40 },
                ],
            },
            {
                creatureId: 'voltpup', name: 'Voltpup', type: 'Electric',
                level: 7, hp: calcHp(40, 7), maxHp: calcHp(40, 7),
                trainerName: 'City Guard',
                moves: [
                    { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
                    { id: 'thunder_shock', name: 'Thunder Shock', type: 'Electric', power: 40 },
                ],
            },
        ],
        battleTeamName: 'City Guard',
        returnScene: 'ViridianCity',
    },
    {
        id: 'viridian_nurse',
        name: 'Nurse Joy',
        x: PCENTER_X + 170,
        y: PCENTER_Y + 100,
        hairColor: 0xff6090,
        shirtColor: 0xffa0c0,
        dialogue: [
            "Welcome to Viridian City!",
            "The Pokémon Center is right behind me.",
            "We heal your creatures for free!",
        ],
        defeatedDialogue: [
            "Oh my! You're quite the trainer.",
            "Please use the PokéCenter anytime!",
        ],
        continueDialogue: [
            "Trainers have been coming back injured from the cave.",
            "Make sure your team is fully healed before going in!",
            "I heard Team Rocket is up to no good again...",
        ],
        canBattle: false,
        returnScene: 'ViridianCity',
    },
    {
        id: 'viridian_rival',
        name: 'Ace Trainer',
        x: CAVE_X - 60,
        y: CAVE_Y + 50,
        hairColor: 0x4040a0,
        shirtColor: 0x6060d0,
        dialogue: [
            "So you're heading to the cave too?",
            "I've been training hard for this.",
            "Let's see who's stronger!",
        ],
        defeatedDialogue: [
            "Incredible... You might actually stand a chance in there.",
            "Team Rocket won't know what hit them.",
        ],
        continueDialogue: [
            "The Legendary Cave is no joke.",
            "Team Rocket has set up camp inside.",
            "You'll need your strongest team.",
            "Maybe later we'll battle again!",
        ],
        canBattle: true,
        team: [
            {
                creatureId: 'aquafin', name: 'Aquafin', type: 'Water',
                level: 8, hp: calcHp(44, 8), maxHp: calcHp(44, 8),
                trainerName: 'Ace Trainer',
                moves: [
                    { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
                    { id: 'water_gun', name: 'Water Gun', type: 'Water', power: 40 },
                    { id: 'bite', name: 'Bite', type: 'Normal', power: 60 },
                ],
            },
            {
                creatureId: 'flameling', name: 'Flameling', type: 'Fire',
                level: 8, hp: calcHp(39, 8), maxHp: calcHp(39, 8),
                trainerName: 'Ace Trainer',
                moves: [
                    { id: 'ember', name: 'Ember', type: 'Fire', power: 40 },
                    { id: 'scratch', name: 'Scratch', type: 'Normal', power: 40 },
                ],
            },
        ],
        battleTeamName: 'Ace Trainer',
        returnScene: 'ViridianCity',
    },
]

export default class ViridianCityScene extends Phaser.Scene {
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
    private caveZone!:     Phaser.GameObjects.Zone
    private pcDoor!:       Phaser.GameObjects.Zone
    private martDoor!:     Phaser.GameObjects.Zone
    private guideZone!:    Phaser.GameObjects.Zone
    private signZone!:     Phaser.GameObjects.Zone
    private npcController!: NPCController
    private notifyUI!:     NotificationUI
    private multiplayerUI!: MultiplayerUI

    constructor() { super({ key: 'ViridianCity' }) }

    create(data?: { from?: string; spawnX?: number; spawnY?: number; npcId?: string }) {
        fadeIn(this)
        this.triggered = false
        this.dialogue    = new DialogueSystem(this)
        this.inventoryUI = new InventoryUI(this)
        this.notifyUI    = new NotificationUI(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        this.drawCity()
        this.setupWalls()
        this.setupZones()
        this.spawnPlayer(data)

        // ── NPCController for interactive NPCs ─────────────────
        this.npcController = new NPCController(this, this.dialogue, VIRIDIAN_NPCS)
        this.npcController.create()

        // ── Handle return from NPC battle ───────────────────────
        if (data?.from === 'npcBattle' && data?.npcId) {
            this.npcController.markDefeated(data.npcId)
        }

        this.inventoryUI.createBagButton()
        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())

        // ── Trigger checkpoint on entry ─────────────────────────
        checkpointManager.reach('CITY', { x: this.player.x, y: this.player.y })
        this.notifyUI.showCheckpoint('Viridian City')
        saveManager.setPosition('ViridianCity', this.player.x, this.player.y)
        saveManager.save()

        // ── Multiplayer interactions ────────────────────────────
        this.multiplayerUI = new MultiplayerUI(this, 'viridianCity', this.player)
        this.multiplayerUI.create()

        // ── Profile + Leaderboard HUD ──────────────────────────
        playerState.load().then(() => {
            new ProfileUI(this).create()
            new LeaderboardUI(this).create()
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DRAW — Viridian City layout
    // ═══════════════════════════════════════════════════════════════════════

    private drawCity() {
        const gfx = this.add.graphics().setDepth(0)

        // ── Grass background ───────────────────────────────────────
        for (let y = 0; y < H; y += 32) {
            for (let x = 0; x < W; x += 32) {
                this.add.image(x, y, 'tile_grass').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            }
        }

        // ── Main horizontal path (wider) ───────────────────────────
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, H / 2, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            this.add.image(x, H / 2 + 32, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
        }
        // Path edge shadows
        gfx.fillStyle(0x489020, 0.35)
        gfx.fillRect(0, H / 2 - 2, W, 2)
        gfx.fillRect(0, H / 2 + 64, W, 2)

        // ── Vertical path from south entrance ─────────────────────
        for (let y = H / 2; y < H; y += 32) {
            this.add.image(W / 2 - 48, y, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            this.add.image(W / 2 - 16, y, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            this.add.image(W / 2 + 16, y, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
        }
        gfx.fillStyle(0x489020, 0.35)
        gfx.fillRect(W / 2 - 50, H / 2, 2, H / 2)
        gfx.fillRect(W / 2 + 48, H / 2, 2, H / 2)

        // ── Path to Pokémon Center ─────────────────────────────────
        for (let y = PCENTER_Y + 96; y <= H / 2; y += 32) {
            this.add.image(PCENTER_X + 56, y, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
        }

        // ── Path to Poké Mart ──────────────────────────────────────
        for (let y = MART_Y + 90; y <= H / 2; y += 32) {
            this.add.image(MART_X + 44, y, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
        }

        // ── Pokémon Center ─────────────────────────────────────────
        this.add.image(PCENTER_X, PCENTER_Y, 'building_pokecenter')
            .setOrigin(0).setDisplaySize(144, 96).setDepth(1)
        gfx.fillStyle(0x000000, 0.08)
        gfx.fillRect(PCENTER_X + 4, PCENTER_Y + 96, 144, 5)
        this.add.text(PCENTER_X + 72, PCENTER_Y + 10, 'POKéMON CENTER', {
            fontSize: '8px', color: '#fff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)

        // ── Poké Mart ──────────────────────────────────────────────
        this.add.image(MART_X, MART_Y, 'building_pokemart')
            .setOrigin(0).setDisplaySize(120, 90).setDepth(1)
        gfx.fillStyle(0x000000, 0.08)
        gfx.fillRect(MART_X + 4, MART_Y + 90, 120, 5)
        this.add.text(MART_X + 60, MART_Y + 10, 'POKé MART', {
            fontSize: '8px', color: '#fff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)

        // ── Trees (denser, more organic placement) ─────────────────
        const treeSpots = [
            { x: 30, y: 50 }, { x: 30, y: 160 }, { x: 30, y: 280 },
            { x: 30, y: 380 }, { x: 30, y: 480 },
            { x: 370, y: 60 }, { x: 370, y: 180 },
            { x: W - 30, y: 100 }, { x: W - 30, y: 360 }, { x: W - 30, y: 460 },
            { x: 440, y: 40 },
        ]
        treeSpots.forEach(t => {
            this.add.image(t.x, t.y, 'obj_tree').setOrigin(0.5, 0.3)
                .setDisplaySize(40, 56).setDepth(1)
        })

        // ── Flowers (more variety, along paths and buildings) ──────
        const flowerSpots = [
            { x: PCENTER_X - 10, y: PCENTER_Y + 80 },
            { x: PCENTER_X + 154, y: PCENTER_Y + 60 },
            { x: MART_X - 10, y: MART_Y + 70 },
            { x: MART_X + 130, y: MART_Y + 50 },
            { x: 100, y: H / 2 - 10 }, { x: 200, y: H / 2 + 74 },
            { x: 650, y: H / 2 - 10 }, { x: 560, y: H / 2 + 74 },
        ]
        flowerSpots.forEach((f, i) => {
            const key = i % 3 === 0 ? 'obj_flower_red' : 'obj_flower_yellow'
            this.add.image(f.x, f.y, key).setDisplaySize(12, 12).setDepth(1)
        })

        // ── Lamp posts (more prominent) ────────────────────────────
        this.add.image(PCENTER_X + 160, PCENTER_Y + 80, 'obj_lamp')
            .setDisplaySize(16, 40).setDepth(1)
        this.add.image(MART_X - 20, MART_Y + 74, 'obj_lamp')
            .setDisplaySize(16, 40).setDepth(1)
        this.add.image(W / 2 + 60, H / 2 + 72, 'obj_lamp')
            .setDisplaySize(14, 36).setDepth(1)

        // ── Cave entrance (right side, refined) ────────────────────
        this.add.image(CAVE_X, CAVE_Y, 'obj_cave')
            .setDisplaySize(56, 80).setDepth(1)
        // Eerie glow
        gfx.fillStyle(0x40c080, 0.08)
        gfx.fillRect(CAVE_X - 30, CAVE_Y - 10, 60, 80)
        // Warning sign
        this.add.image(CAVE_X - 50, CAVE_Y + 30, 'obj_sign')
            .setDisplaySize(24, 32).setDepth(1)
        this.add.text(CAVE_X - 50, CAVE_Y + 16, 'DANGER', {
            fontSize: '7px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)
        // Cave label (glowing banner)
        gfx.fillStyle(0x000000, 0.7).fillRect(CAVE_X - 55, CAVE_Y - 56, 110, 18)
        gfx.fillStyle(0x40c080, 0.6).fillRect(CAVE_X - 55, CAVE_Y - 56, 110, 1)
        gfx.fillStyle(0x40c080, 0.6).fillRect(CAVE_X - 55, CAVE_Y - 39, 110, 1)
        this.add.text(CAVE_X, CAVE_Y - 50, 'Legendary Cave', {
            fontSize: '10px', color: '#88ffaa', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)

        // ── Guide NPC ──────────────────────────────────────────────
        const guideX = W / 2 - 70, guideY = H / 2 - 20
        this.add.image(guideX, guideY, 'npc_elder').setDisplaySize(32, 48).setDepth(3)
        this.add.text(guideX, guideY - 26, 'Guide', {
            fontSize: '8px', color: '#555', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(3)
        this.guideZone = this.add.zone(guideX, guideY, 44, 44).setOrigin(0.5)
        this.physics.add.existing(this.guideZone, true)

        // ── City sign ──────────────────────────────────────────────
        const signX = W / 2 + 90, signY = H / 2 + 60
        this.add.image(signX, signY, 'obj_sign').setDisplaySize(24, 32).setDepth(1)
        this.signZone = this.add.zone(signX, signY, 34, 34).setOrigin(0.5)
        this.physics.add.existing(this.signZone, true)

        // ── City name banner (top overlay) ─────────────────────────
        gfx.fillStyle(0x000000, 0.6).fillRect(W / 2 - 90, 8, 180, 22)
        gfx.fillStyle(0xf8f8f8).fillRect(W / 2 - 90, 8, 180, 1)
        gfx.fillStyle(0xf8f8f8).fillRect(W / 2 - 90, 29, 180, 1)
        this.add.text(W / 2, 12, 'VIRIDIAN CITY', {
            fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(2)

        // ── Direction label ────────────────────────────────────────
        this.add.text(W / 2, H - 10, '↓ Route 1', {
            fontSize: '9px', color: '#fff', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(2)

        // ── Bushes flanking south entrance ─────────────────────────
        for (let bx = W / 2 - 120; bx < W / 2 - 48; bx += 24) {
            this.add.image(bx + 12, H - 18, 'obj_bush').setDisplaySize(24, 20).setDepth(1)
        }
        for (let bx = W / 2 + 48; bx < W / 2 + 120; bx += 24) {
            this.add.image(bx + 12, H - 18, 'obj_bush').setDisplaySize(24, 20).setDepth(1)
        }

        // ── Fences along bottom edges ──────────────────────────────
        for (let fx = 56; fx < W / 2 - 120; fx += 34) {
            this.add.image(fx, H - 10, 'obj_fence').setDisplaySize(32, 16).setDepth(1)
        }
        for (let fx = W / 2 + 130; fx < W - 56; fx += 34) {
            this.add.image(fx, H - 10, 'obj_fence').setDisplaySize(32, 16).setDepth(1)
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WALLS — Building colliders + boundaries
    // ═══════════════════════════════════════════════════════════════════════

    private setupWalls() {
        this.walls = this.physics.add.staticGroup()
        const wall = (x: number, y: number, w: number, h: number) => {
            const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0) as any
            this.physics.add.existing(r, true)
            this.walls.add(r)
        }
        // Top boundary
        wall(0, 0, W, 40)
        // Left tree line
        wall(0, 0, 56, H)
        // Right boundary (gaps for cave)
        wall(W - 20, 0, 20, CAVE_Y - 30)
        wall(W - 20, CAVE_Y + 60, 20, H - CAVE_Y - 60)
        // Buildings
        wall(PCENTER_X, PCENTER_Y, 144, 80)
        wall(MART_X, MART_Y, 120, 72)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ZONES — Exit and cave triggers
    // ═══════════════════════════════════════════════════════════════════════

    private setupZones() {
        this.southExit = this.add.zone(W / 2, H - 4, 120, 16).setOrigin(0.5)
        this.caveZone  = this.add.zone(CAVE_X, CAVE_Y + 16, 40, 50).setOrigin(0.5)
        this.pcDoor    = this.add.zone(PCENTER_X + 72, PCENTER_Y + 96, 28, 16).setOrigin(0.5)
        this.martDoor  = this.add.zone(MART_X + 60, MART_Y + 90, 28, 16).setOrigin(0.5)
        ;[this.southExit, this.caveZone, this.pcDoor, this.martDoor].forEach(z =>
            this.physics.add.existing(z, true))
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLAYER — Spawn + physics
    // ═══════════════════════════════════════════════════════════════════════

    private spawnPlayer(data?: { from?: string; spawnX?: number; spawnY?: number }) {
        let sp: { x: number; y: number }
        if (data?.from === 'checkpoint' && data.spawnX != null) {
            sp = { x: data.spawnX, y: data.spawnY! }
        } else {
            sp = SPAWNS[data?.from ?? 'default'] ?? SPAWNS.default
        }

        if (data?.from === 'cave') this.playerDir = 'left'
        else if (data?.from === 'route1') this.playerDir = 'up'
        else if (data?.from === 'pokeCenter' || data?.from === 'pokeMart') this.playerDir = 'down'
        this.playerSprite = this.add.image(sp.x, sp.y, `player_${this.playerDir}_0`)
            .setDisplaySize(28, 42).setDepth(5)

        const rect = this.add.rectangle(sp.x, sp.y, 14, 20, 0xff0000, 0) as any
        this.physics.add.existing(rect)
        this.player = rect as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body)
            .setCollideWorldBounds(true).setSize(14, 20)

        this.physics.add.collider(this.player as any, this.walls)
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

        // NPC interactions (SPACE) — legacy Guide + Sign
        if (!locked && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const px = this.player as any
            if (!this.npcController.isOverlapping(px)) {
                if (this.physics.overlap(px, this.guideZone)) {
                    this.dialogue.show([
                        'Welcome to Viridian City!',
                        'The Legendary Cave lies to the east.',
                        'Many trainers have ventured in...',
                        '...but few have returned unchanged.',
                    ], 'Guide')
                } else if (this.physics.overlap(px, this.signZone)) {
                    this.dialogue.show(['── VIRIDIAN CITY ──', 'The eternally green paradise.'])
                }
            }
        }

        // Update save position
        saveManager.setPosition('ViridianCity', this.player.x, this.player.y)

        // ── Zone transitions ───────────────────────────────────────
        if (!this.triggered && !locked) {
            const px = this.player as any
            if (this.physics.overlap(px, this.southExit)) {
                this.triggered = true
                transitionTo(this, 'Route1', { from: 'viridianCity' })
            } else if (this.physics.overlap(px, this.caveZone)) {
                this.triggered = true
                transitionTo(this, 'LegendaryCave', { from: 'viridianCity' })
            } else if (this.physics.overlap(px, this.pcDoor)) {
                this.triggered = true
                transitionTo(this, 'PokeCenter')
            } else if (this.physics.overlap(px, this.martDoor)) {
                this.triggered = true
                transitionTo(this, 'PokeMart')
            }
        }
    }

    shutdown() { this.multiplayerUI?.destroy() }
}
