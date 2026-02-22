import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'
import playerState from '../systems/PlayerState'
import { ProfileUI } from '../systems/ProfileUI'
import { LeaderboardUI } from '../systems/LeaderboardUI'
import { NotificationUI } from '../systems/NotificationUI'
import checkpointManager from '../systems/CheckpointManager'
import saveManager from '../systems/SaveManager'
import { MultiplayerUI } from '../systems/MultiplayerUI'
import type { TrainerBattleData } from './TrainerBattleScene'

const W = 800, H = 576, SPD = 100

// ── Spawn points depending on where the player came from ────────────────────
const SPAWNS: Record<string, { x: number; y: number }> = {
    viridianCity: { x: W / 2, y: H - 50 },
    default:      { x: W / 2, y: H - 50 },
}

// ── NPC state machine ───────────────────────────────────────────────────────
type NPCState = 'idle' | 'talking' | 'battle' | 'defeated'

// ── Team Rocket opponent data (used to build TrainerBattleData) ─────────────
const TR_LEVEL = 10

function calcHp(baseHp: number, level: number): number {
    return Math.floor(((2 * baseHp) * level) / 100 + level + 10)
}

const TR_OPPONENTS = [
    {
        creatureId: 'snekob',  name: 'Snekob',  type: 'Poison',
        level: TR_LEVEL, trainerName: 'Jessie',
        hp: calcHp(35, TR_LEVEL), maxHp: calcHp(35, TR_LEVEL),
        moves: [
            { id: 'wrap', name: 'Wrap', type: 'Normal', power: 15 },
            { id: 'poison_sting', name: 'Poison Sting', type: 'Poison', power: 15 },
            { id: 'acid', name: 'Acid', type: 'Poison', power: 40 },
            { id: 'bite', name: 'Bite', type: 'Normal', power: 60 },
        ],
    },
    {
        creatureId: 'smogon',  name: 'Smogon',  type: 'Poison',
        level: TR_LEVEL, trainerName: 'James',
        hp: calcHp(40, TR_LEVEL), maxHp: calcHp(40, TR_LEVEL),
        moves: [
            { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
            { id: 'smog', name: 'Smog', type: 'Poison', power: 30 },
            { id: 'sludge_bomb', name: 'Sludge Bomb', type: 'Poison', power: 90 },
        ],
    },
    {
        creatureId: 'meowth', name: 'Meowth', type: 'Normal',
        level: TR_LEVEL + 2, trainerName: 'Meowth',
        hp: calcHp(40, TR_LEVEL + 2), maxHp: calcHp(40, TR_LEVEL + 2),
        moves: [
            { id: 'scratch', name: 'Scratch', type: 'Normal', power: 40 },
            { id: 'bite', name: 'Bite', type: 'Normal', power: 60 },
            { id: 'fury_swipes', name: 'Fury Swipes', type: 'Normal', power: 18 },
            { id: 'pay_day', name: 'Pay Day', type: 'Normal', power: 40 },
        ],
    },
]

// ═════════════════════════════════════════════════════════════════════════════
export default class LegendaryCaveScene extends Phaser.Scene {
    private player!:       Phaser.Physics.Arcade.Sprite
    private playerSprite!: Phaser.GameObjects.Image
    private playerDir      = 'up'
    private playerFrame    = 0
    private walkTimer      = 0
    private cursors!:      Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:     Phaser.Input.Keyboard.Key
    private dialogue!:     DialogueSystem
    private walls!:        Phaser.Physics.Arcade.StaticGroup
    private triggered      = false
    private exitZone!:     Phaser.GameObjects.Zone
    private altarZone!:    Phaser.GameObjects.Zone

    // ── Team Rocket NPCs ────────────────────────────────────────────────
    private npcState: NPCState = 'idle'
    private jessieSprite!:  Phaser.GameObjects.Image
    private jamesSprite!:   Phaser.GameObjects.Image
    private meowthSprite!:  Phaser.GameObjects.Image
    private npcBarrier!:    Phaser.Physics.Arcade.StaticGroup
    private encounterZone!: Phaser.GameObjects.Zone
    private trDefeated      = false
    private encounterTriggered = false

    // ── Legendary reveal ────────────────────────────────────────────────
    private legendaryRevealed = false
    private legendaryZone!:   Phaser.GameObjects.Zone
    private kadsCaught        = false
    private kadsBattleStarted = false

    // ── Ambient overlay ref for lighting change ─────────────────────────
    private ambientOverlay!: Phaser.GameObjects.Rectangle
    private notifyUI!: NotificationUI
    private multiplayerUI!: MultiplayerUI
    constructor() { super({ key: 'LegendaryCave' }) }

    create(data?: { from?: string; spawnX?: number; spawnY?: number; battleResult?: string; kadsCaught?: boolean; kadsDefeated?: boolean }) {
        fadeIn(this)
        this.triggered = false
        this.encounterTriggered = false
        this.legendaryRevealed = false
        this.kadsCaught = false
        this.kadsBattleStarted = false
        this.dialogue  = new DialogueSystem(this)
        this.notifyUI  = new NotificationUI(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        // ── Check if returning from TR battle ───────────────────
        if (data?.battleResult === 'won') {
            this.trDefeated = true
            this.npcState = 'defeated'
        } else if (data?.battleResult === 'lost') {
            // Player lost TR battle — reset encounter, spawn at entrance
            this.trDefeated = false
            this.npcState = 'idle'
        }

        // ── Check if returning from KADS battle ─────────────────
        if (data?.kadsCaught) {
            this.trDefeated = true
            this.npcState = 'defeated'
            this.legendaryRevealed = true
            this.kadsCaught = true
        } else if (data?.kadsDefeated) {
            // KADS was defeated but not caught — TR still beaten, legendary revealed
            this.trDefeated = true
            this.npcState = 'defeated'
            this.legendaryRevealed = true
        }

        this.drawCave()
        this.setupWalls()
        this.setupZones()
        this.setupTeamRocket()
        this.spawnPlayer(data)

        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())

        // ── Trigger checkpoint on entry ─────────────────────────────
        checkpointManager.reach('LEGENDARY_CAVE', { x: this.player.x, y: this.player.y })
        this.notifyUI.showCheckpoint('Legendary Cave')
        saveManager.setPosition('LegendaryCave', this.player.x, this.player.y)
        saveManager.save()

        // ── Multiplayer interactions ────────────────────────────
        this.multiplayerUI = new MultiplayerUI(this, 'legendaryCave', this.player)
        this.multiplayerUI.create()

        // ── Profile + Leaderboard HUD ──────────────────────────────
        playerState.load().then(() => {
            new ProfileUI(this).create()
            new LeaderboardUI(this).create()
        })

        // ── Post-battle sequences ───────────────────────────────
        if (data?.battleResult === 'won') {
            this.time.delayedCall(500, () => this.playVictorySequence())
        }

        // ── Post-KADS catch celebration ──────────────────────────
        if (data?.kadsCaught) {
            this.time.delayedCall(500, () => this.playKadsCaughtSequence())
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DRAW — Dark cave interior with crystals and altar
    // ═══════════════════════════════════════════════════════════════════════

    private drawCave() {
        // ── Cave floor ─────────────────────────────────────────────
        for (let y = 0; y < H; y += 32) {
            for (let x = 0; x < W; x += 32) {
                this.add.image(x, y, 'tile_cave_floor').setOrigin(0)
                    .setDisplaySize(32, 32).setDepth(0)
            }
        }

        // ── Cave walls — top ───────────────────────────────────────
        for (let x = 0; x < W; x += 32) {
            for (let y = 0; y < 64; y += 32) {
                this.add.image(x, y, 'tile_cave_wall').setOrigin(0)
                    .setDisplaySize(32, 32).setDepth(1)
            }
        }

        // ── Cave walls — left ──────────────────────────────────────
        for (let y = 0; y < H; y += 32) {
            for (let x = 0; x < 64; x += 32) {
                this.add.image(x, y, 'tile_cave_wall').setOrigin(0)
                    .setDisplaySize(32, 32).setDepth(1)
            }
        }

        // ── Cave walls — right ─────────────────────────────────────
        for (let y = 0; y < H; y += 32) {
            for (let x = W - 64; x < W; x += 32) {
                this.add.image(x, y, 'tile_cave_wall').setOrigin(0)
                    .setDisplaySize(32, 32).setDepth(1)
            }
        }

        // ── Internal rock formations ───────────────────────────────
        const rockFormations = [
            { x: 120, y: 100, w: 80, h: 80 },
            { x: 560, y: 100, w: 100, h: 100 },
            { x: 500, y: 340, w: 100, h: 80 },
            { x: 120, y: 380, w: 80, h: 60 },
            { x: 320, y: 300, w: 60, h: 60 },
        ]
        for (const rock of rockFormations) {
            for (let y = rock.y; y < rock.y + rock.h; y += 32) {
                for (let x = rock.x; x < rock.x + rock.w; x += 32) {
                    this.add.image(x, y, 'tile_cave_wall').setOrigin(0)
                        .setDisplaySize(32, 32).setDepth(1)
                }
            }
        }

        // ── Glowing crystals ───────────────────────────────────────
        const crystalSpots = [
            { x: 90, y: 190 },  { x: 680, y: 140 },
            { x: 180, y: 310 }, { x: 620, y: 260 },
            { x: 350, y: 100 }, { x: 450, y: 110 },
            { x: 280, y: 420 }, { x: 650, y: 420 },
            { x: 110, y: 460 }, { x: 540, y: 460 },
        ]
        crystalSpots.forEach(c => {
            this.add.image(c.x, c.y, 'obj_crystal')
                .setDisplaySize(16, 24).setDepth(2)
                .setAlpha(0.8 + Math.random() * 0.2)
        })

        // ── Mysterious altar — KADS location (deep end) ────────────
        const ALTAR_X = W / 2, ALTAR_Y = 150
        // Platform
        this.add.rectangle(ALTAR_X, ALTAR_Y + 20, 120, 40, 0x384868)
            .setDepth(1).setAlpha(0.9)
        this.add.rectangle(ALTAR_X, ALTAR_Y + 20, 114, 34, 0x4a5a78)
            .setDepth(1)
        // Cyan glow lines on platform
        this.add.rectangle(ALTAR_X, ALTAR_Y + 20, 100, 2, 0x60c8e8)
            .setDepth(1).setAlpha(0.5)
        this.add.rectangle(ALTAR_X, ALTAR_Y + 12, 80, 1, 0x60c8e8)
            .setDepth(1).setAlpha(0.3)

        // ── KADS sprite on the altar (only if not caught) ──────────
        if (!this.kadsCaught) {
            const kadsSprite = this.add.image(ALTAR_X, ALTAR_Y - 12, 'npc_kads')
                .setDisplaySize(40, 60).setDepth(3)
            // Subtle floating animation
            this.tweens.add({
                targets: kadsSprite,
                y: ALTAR_Y - 16,
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            })
            // Pulsing cyan aura beneath
            const aura = this.add.circle(ALTAR_X, ALTAR_Y + 8, 24, 0x50d0f0, 0.2)
                .setDepth(2)
            this.tweens.add({
                targets: aura,
                alpha: 0.4,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            })
        }

        // Label
        this.add.text(ALTAR_X, ALTAR_Y - 52, '✦ KADS Chamber ✦', {
            fontSize: '10px', color: '#60c8e8', fontFamily: 'monospace',
            backgroundColor: '#00000099', padding: { x: 6, y: 2 },
        }).setOrigin(0.5).setDepth(3)

        // ── Crystals flanking altar ────────────────────────────────
        this.add.image(ALTAR_X - 70, ALTAR_Y, 'obj_crystal')
            .setDisplaySize(20, 30).setDepth(2).setAlpha(0.9)
        this.add.image(ALTAR_X + 70, ALTAR_Y, 'obj_crystal')
            .setDisplaySize(20, 30).setDepth(2).setAlpha(0.9)

        // ── Entrance (bottom center) ───────────────────────────────
        this.add.text(W / 2, H - 16, '↓ Exit Cave', {
            fontSize: '9px', color: '#aaa', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(5)

        // ── Cave name ──────────────────────────────────────────────
        this.add.text(W / 2, 36, '── LEGENDARY CAVE ──', {
            fontSize: '11px', color: '#88ffaa', fontFamily: 'monospace',
            backgroundColor: '#00000099', padding: { x: 8, y: 3 },
        }).setOrigin(0.5).setDepth(5)

        // ── Ambient darkness overlay ───────────────────────────────
        this.ambientOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.3)
        this.ambientOverlay.setDepth(4)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WALLS — Cave boundaries + rock formations
    // ═══════════════════════════════════════════════════════════════════════

    private setupWalls() {
        this.walls = this.physics.add.staticGroup()
        const wall = (x: number, y: number, w: number, h: number) => {
            const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0) as any
            this.physics.add.existing(r, true)
            this.walls.add(r)
        }
        // Outer walls
        wall(0, 0, W, 64)
        wall(0, 0, 64, H)
        wall(W - 64, 0, 64, H)
        // Bottom wall with gap for exit
        wall(0, H - 24, W / 2 - 60, 24)
        wall(W / 2 + 60, H - 24, W / 2 - 60, 24)
        // Internal rock formations
        wall(120, 100, 80, 80)
        wall(560, 100, 100, 100)
        wall(500, 340, 100, 80)
        wall(120, 380, 80, 60)
        wall(320, 300, 60, 60)
        // Altar platform (solid)
        wall(W / 2 - 50, 140, 100, 40)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ZONES — Exit, altar, encounter trigger, legendary reveal
    // ═══════════════════════════════════════════════════════════════════════

    private setupZones() {
        this.exitZone  = this.add.zone(W / 2, H - 4, 120, 16).setOrigin(0.5)
        this.altarZone = this.add.zone(W / 2, 190, 80, 40).setOrigin(0.5)

        // Encounter trigger — wide zone before the NPC trio position
        this.encounterZone = this.add.zone(W / 2, 340, 300, 40).setOrigin(0.5)

        // Legendary reveal trigger — near the altar
        this.legendaryZone = this.add.zone(W / 2, 210, 120, 30).setOrigin(0.5)

        ;[this.exitZone, this.altarZone, this.encounterZone, this.legendaryZone].forEach(z =>
            this.physics.add.existing(z, true))
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEAM ROCKET NPCs — placement, collision barrier, state
    // ═══════════════════════════════════════════════════════════════════════

    private setupTeamRocket() {
        // NPC positions — blocking the path to the altar
        const TRIO_Y = 280
        const CENTER_X = W / 2

        if (this.trDefeated) {
            // Don't place NPCs if already beaten
            return
        }

        // ── Jessie (left) ──────────────────────────────────────────
        this.jessieSprite = this.add.image(CENTER_X - 60, TRIO_Y, 'npc_jessie')
            .setDisplaySize(32, 48).setDepth(5)

        // ── James (right) ──────────────────────────────────────────
        this.jamesSprite = this.add.image(CENTER_X + 60, TRIO_Y, 'npc_james')
            .setDisplaySize(32, 48).setDepth(5)

        // ── Meowth (center, slightly forward) ──────────────────────
        this.meowthSprite = this.add.image(CENTER_X, TRIO_Y + 30, 'npc_meowth')
            .setDisplaySize(28, 42).setDepth(5)

        // ── Collision barrier — blocks the path ────────────────────
        this.npcBarrier = this.physics.add.staticGroup()
        const barrierRect = this.add.rectangle(CENTER_X, TRIO_Y + 5, 200, 60, 0x000000, 0) as any
        this.physics.add.existing(barrierRect, true)
        this.npcBarrier.add(barrierRect)

        // Add NPC name labels
        this.add.text(CENTER_X - 60, TRIO_Y - 32, 'Jessie', {
            fontSize: '8px', color: '#ff8888', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(6)

        this.add.text(CENTER_X + 60, TRIO_Y - 32, 'James', {
            fontSize: '8px', color: '#8888ff', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(6)

        this.add.text(CENTER_X, TRIO_Y + 62, 'Meowth', {
            fontSize: '8px', color: '#ffe088', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(6)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLAYER — Spawn + physics
    // ═══════════════════════════════════════════════════════════════════════

    private spawnPlayer(data?: { from?: string; spawnX?: number; spawnY?: number; battleResult?: string; kadsCaught?: boolean; kadsDefeated?: boolean }) {
        let sp: { x: number; y: number }

        if (data?.from === 'checkpoint' && data.spawnX != null) {
            sp = { x: data.spawnX, y: data.spawnY! }
        } else if (data?.battleResult === 'lost') {
            // Respawn at cave entrance after losing TR battle
            sp = SPAWNS.default
        } else if (data?.battleResult === 'won') {
            // Spawn just below where NPCs were (after TR win)
            sp = { x: W / 2, y: 340 }
        } else if (data?.kadsCaught || data?.kadsDefeated) {
            // Returning from KADS battle — spawn near altar
            sp = { x: W / 2, y: 230 }
        } else {
            sp = SPAWNS[data?.from ?? 'default'] ?? SPAWNS.default
        }

        this.playerSprite = this.add.image(sp.x, sp.y, `player_${this.playerDir}_0`)
            .setDisplaySize(28, 42).setDepth(5)

        const rect = this.add.rectangle(sp.x, sp.y, 14, 20, 0xff0000, 0) as any
        this.physics.add.existing(rect)
        this.player = rect as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body)
            .setCollideWorldBounds(true).setSize(14, 20)

        this.physics.add.collider(this.player as any, this.walls)

        // Collide with NPC barrier if not defeated
        if (!this.trDefeated && this.npcBarrier) {
            this.physics.add.collider(this.player as any, this.npcBarrier)
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VICTORY SEQUENCE — After beating Team Rocket
    // ═══════════════════════════════════════════════════════════════════════

    private playVictorySequence() {
        // Camera pan to where NPCs would be
        this.cameras.main.pan(W / 2, 280, 800, 'Power2')

        this.time.delayedCall(900, () => {
            // Create temporary TR sprites for the defeat animation
            const CENTER_X = W / 2
            const TRIO_Y = 280

            const jess = this.add.image(CENTER_X - 60, TRIO_Y, 'npc_jessie')
                .setDisplaySize(32, 48).setDepth(5)
            const james = this.add.image(CENTER_X + 60, TRIO_Y, 'npc_james')
                .setDisplaySize(32, 48).setDepth(5)
            const meow = this.add.image(CENTER_X, TRIO_Y + 30, 'npc_meowth')
                .setDisplaySize(28, 42).setDepth(5)

            // Shocked shake effect
            this.tweens.add({
                targets: [jess, james],
                x: '+=4', duration: 60, yoyo: true, repeat: 5,
            })

            this.time.delayedCall(600, () => {
                this.dialogue.showSequence([
                    { speaker: 'Jessie', text: "I can't believe we lost!" },
                    { speaker: 'James', text: "This wasn't supposed to happen!" },
                    { speaker: 'Meowth', text: "That's it! We're blasting off again!" },
                ], () => {
                    // Blast-off animation — NPCs fly upward and fade
                    this.tweens.add({
                        targets: [jess, james, meow],
                        y: '-=400',
                        alpha: 0,
                        duration: 1200,
                        ease: 'Quad.easeIn',
                        onComplete: () => {
                            jess.destroy()
                            james.destroy()
                            meow.destroy()

                            // Create smoke puffs
                            for (let i = 0; i < 6; i++) {
                                const smoke = this.add.circle(
                                    CENTER_X + Phaser.Math.Between(-80, 80),
                                    TRIO_Y + Phaser.Math.Between(-20, 20),
                                    Phaser.Math.Between(8, 20),
                                    0xcccccc, 0.7,
                                ).setDepth(6)
                                this.tweens.add({
                                    targets: smoke,
                                    alpha: 0, scaleX: 2, scaleY: 2,
                                    duration: 800,
                                    delay: i * 100,
                                    onComplete: () => smoke.destroy(),
                                })
                            }

                            // Change lighting — cave brightens subtly
                            this.tweens.add({
                                targets: this.ambientOverlay,
                                alpha: 0.15,
                                duration: 2000,
                            })

                            // Pan camera back to player
                            this.time.delayedCall(1200, () => {
                                this.cameras.main.pan(
                                    this.player.x, this.player.y, 600, 'Power2',
                                )

                                this.time.delayedCall(800, () => {
                                    this.dialogue.show([
                                        'The path ahead is now clear...',
                                        'A deep rumble echoes from the inner chamber.',
                                        'Something ancient stirs within...',
                                    ], '')
                                })
                            })
                        },
                    })
                })
            })
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEAM ROCKET ENCOUNTER — Dialogue then battle
    // ═══════════════════════════════════════════════════════════════════════

    private triggerTeamRocketEncounter() {
        if (this.encounterTriggered || this.trDefeated) return
        this.encounterTriggered = true
        this.npcState = 'talking'

        // Lock player movement
        const body = this.player.body as Phaser.Physics.Arcade.Body
        body.setVelocity(0)

        // Camera pans to the trio
        const CENTER_X = W / 2, TRIO_Y = 280
        this.cameras.main.pan(CENTER_X, TRIO_Y, 800, 'Power2')

        this.time.delayedCall(1000, () => {
            this.dialogue.showSequence([
                { speaker: 'Meowth',  text: "Hold it right there, twerp! Nobody gets past Team Rocket!" },
                { speaker: 'Jessie', text: "We finally found the legendary power hidden here!" },
                { speaker: 'James',  text: "And we're not letting YOU take it!" },
                { speaker: 'Meowth',  text: "Prepare for trouble!" },
                { speaker: 'Jessie', text: "Make it double!" },
                { speaker: 'James',  text: "To protect the world from devastation!" },
                { speaker: 'Jessie', text: "To unite all peoples within our nation!" },
                { speaker: 'Jessie', text: "Jessie!" },
                { speaker: 'James',  text: "James!" },
                { speaker: 'Meowth',  text: "Meowth, that's right!" },
                { speaker: 'Meowth',  text: "If you want KADS, you gotta get through us first!" },
            ], () => {
                // After dialogue → start trainer battle
                this.npcState = 'battle'
                this.startTeamRocketBattle()
            })
        })
    }

    private startTeamRocketBattle() {
        const battleData: TrainerBattleData = {
            opponents: TR_OPPONENTS,
            trainerTeamName: 'Team Rocket',
            returnScene: 'LegendaryCave',
            returnData: { from: 'battle' },
        }

        // Flash then transition to battle
        this.cameras.main.flash(300, 255, 255, 255)
        this.time.delayedCall(350, () => {
            this.scene.start('TrainerBattle', battleData)
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LEGENDARY REVEAL — When player approaches the altar after TR defeated
    // ═══════════════════════════════════════════════════════════════════════

    private triggerLegendaryReveal() {
        if (this.legendaryRevealed || !this.trDefeated) return
        this.legendaryRevealed = true

        // Lock player
        const body = this.player.body as Phaser.Physics.Arcade.Body
        body.setVelocity(0)

        // Slow camera zoom + pan
        this.cameras.main.pan(W / 2, 150, 1500, 'Power2')
        this.cameras.main.zoomTo(1.3, 1500)

        this.time.delayedCall(1600, () => {
            // Screen shakes
            this.cameras.main.shake(500, 0.005)

            this.time.delayedCall(600, () => {
                // Orb intensifies
                const glow = this.add.circle(W / 2, 142, 30, 0x50d0f0, 0)
                    .setDepth(6)
                this.tweens.add({
                    targets: glow,
                    alpha: 0.6, scaleX: 1.5, scaleY: 1.5,
                    duration: 1000, yoyo: true, repeat: 1,
                })

                this.time.delayedCall(2200, () => {
                    this.dialogue.showSequence([
                        { speaker: '???', text: "..." },
                        { speaker: 'KADS', text: "You have proven yourself against those fools." },
                        { speaker: 'KADS', text: "But defeating Team Rocket does not make you worthy." },
                        { speaker: 'KADS', text: "Show me your strength, human!" },
                    ], () => {
                        // Zoom back to normal
                        this.cameras.main.zoomTo(1, 800)
                        this.cameras.main.pan(
                            this.player.x, this.player.y, 800, 'Power2',
                        )
                        // Start the KADS battle after camera resets
                        this.time.delayedCall(1000, () => this.startKadsBattle())
                    })
                })
            })
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // KADS BATTLE — Wild encounter with legendary (catchable)
    // ═══════════════════════════════════════════════════════════════════════

    private startKadsBattle() {
        if (this.kadsBattleStarted) return
        this.kadsBattleStarted = true

        const KADS_LEVEL = 50
        const kadsHp = Math.floor(((2 * 106) * KADS_LEVEL) / 100 + KADS_LEVEL + 10)

        this.cameras.main.flash(500, 40, 180, 230)
        this.time.delayedCall(550, () => {
            this.scene.start('WildEncounter', {
                creatureId: 'kads',
                creatureName: 'KADS',
                creatureType: 'Dragon',
                level: KADS_LEVEL,
                hp: kadsHp,
                maxHp: kadsHp,
                returnScene: 'LegendaryCave',
                returnData: { from: 'kadsBattle' },
                isLegendary: true,
            })
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // KADS CAUGHT CELEBRATION — After successfully catching KADS
    // ═══════════════════════════════════════════════════════════════════════

    private playKadsCaughtSequence() {
        // Camera pan to altar
        this.cameras.main.pan(W / 2, 150, 1000, 'Power2')
        this.cameras.main.zoomTo(1.2, 1000)

        this.time.delayedCall(1200, () => {
            // Orb fades away
            const fadingOrb = this.add.circle(W / 2, 142, 20, 0x50d0f0, 0.8)
                .setDepth(6)
            this.tweens.add({
                targets: fadingOrb,
                alpha: 0, scaleX: 3, scaleY: 3,
                duration: 1500,
                onComplete: () => fadingOrb.destroy(),
            })

            this.time.delayedCall(1800, () => {
                this.dialogue.show([
                    'The ancient energy has subsided.',
                    'KADS has joined your team!',
                    'The cave feels peaceful now...',
                ], '', () => {
                    this.cameras.main.zoomTo(1, 800)
                    this.cameras.main.pan(
                        this.player.x, this.player.y, 600, 'Power2',
                    )
                })
            })
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // UPDATE — Movement, animation, zone transitions
    // ═══════════════════════════════════════════════════════════════════════

    update(_t: number, delta: number) {
        this.dialogue.update(delta)
        this.multiplayerUI.update(delta, this.dialogue.active())

        const locked = this.dialogue.active() || this.multiplayerUI.active()
        const body   = this.player.body as Phaser.Physics.Arcade.Body
        body.setVelocity(0)

        let moving = false
        if (!locked && this.npcState !== 'talking' && this.npcState !== 'battle') {
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

        // Update save position
        saveManager.setPosition('LegendaryCave', this.player.x, this.player.y)

        // ── Team Rocket encounter trigger ──────────────────────────
        if (!this.encounterTriggered && !this.trDefeated && this.npcState === 'idle' && !locked) {
            const px = this.player as any
            if (this.physics.overlap(px, this.encounterZone)) {
                this.triggerTeamRocketEncounter()
            }
        }

        // ── Legendary reveal trigger ───────────────────────────────
        if (this.trDefeated && !this.legendaryRevealed && !locked) {
            const px = this.player as any
            if (this.physics.overlap(px, this.legendaryZone)) {
                this.triggerLegendaryReveal()
            }
        }

        // ── Altar interaction (SPACE) — only if TR beaten + legendary revealed + not caught ─
        if (!locked && this.trDefeated && this.legendaryRevealed && !this.kadsCaught && !this.kadsBattleStarted
            && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const px = this.player as any
            if (this.physics.overlap(px, this.altarZone)) {
                this.dialogue.showSequence([
                    { speaker: 'KADS', text: "The ancient power resonates..." },
                    { speaker: 'KADS', text: "Are you prepared to face me?" },
                ], () => this.startKadsBattle())
            }
        }

        // ── Altar interaction after catching KADS ──────────────────
        if (!locked && this.kadsCaught && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const px = this.player as any
            if (this.physics.overlap(px, this.altarZone)) {
                this.dialogue.show([
                    'The altar is silent now...',
                    'KADS has joined your team.',
                ], '')
            }
        }

        // ── Exit zone ──────────────────────────────────────────────
        if (!this.triggered && !locked) {
            const px = this.player as any
            if (this.physics.overlap(px, this.exitZone)) {
                this.triggered = true
                transitionTo(this, 'ViridianCity', { from: 'cave' })
            }
        }
    }

    shutdown() { this.multiplayerUI?.destroy() }
}
