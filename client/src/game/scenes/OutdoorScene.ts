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

const W = 800, H = 576, SPD = 120, SHORE_Y = H - 80
const LAB_X = W / 2 - 72, LAB_Y = 40, LAB_W = 144, LAB_H = 96
const PHOUSE_X = W - 160, PHOUSE_Y = H - 220
const RHOUSE_X = 16,       RHOUSE_Y = H - 220
const BUSH_X   = W / 2 - 80, BUSH_Y = SHORE_Y - 36, BUSH_W = 160

const SPAWNS: Record<string, { x: number; y: number }> = {
    default:     { x: W / 2, y: H / 2 - 20 },
    playerHouse: { x: PHOUSE_X + 60, y: PHOUSE_Y - 28 },
    rivalHouse:  { x: RHOUSE_X + 60, y: RHOUSE_Y - 28 },
    lab:         { x: W / 2, y: LAB_Y + LAB_H + 24 },
    route1:      { x: W / 2, y: SHORE_Y - 50 },
}

// ── NPC definitions for Pallet Town ─────────────────────────────────────
const PALLET_NPCS: NPCDef[] = [
    {
        id: 'pallet_trainer',
        name: 'Bug Catcher',
        x: W / 2 - 100,
        y: H / 2 + 40,
        hairColor: 0x40a040,
        shirtColor: 0x60c060,
        dialogue: [
            "Hey there! I'm training my team!",
            "There's tall grass on Route 1 full of creatures.",
            "Wanna have a quick battle?",
        ],
        defeatedDialogue: [
            "You beat me fair and square!",
            "You should head to Viridian City next.",
        ],
        continueDialogue: [
            "I caught my first creature in the tall grass.",
            "Professor Oak gave me some tips too!",
            "Good luck on your journey!",
        ],
        canBattle: true,
        team: [
            {
                creatureId: 'verdling', name: 'Verdling', type: 'Grass',
                level: 4, hp: calcHp(40, 4), maxHp: calcHp(40, 4),
                trainerName: 'Bug Catcher',
                moves: [
                    { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
                    { id: 'vine_whip', name: 'Vine Whip', type: 'Grass', power: 45 },
                ],
            },
        ],
        battleTeamName: 'Bug Catcher',
        returnScene: 'Outdoor',
    },
    {
        id: 'pallet_girl',
        name: 'Lass',
        x: PHOUSE_X - 40,
        y: PHOUSE_Y + 50,
        hairColor: 0xd06080,
        shirtColor: 0xf090b0,
        dialogue: [
            "Hi! Are you starting your journey too?",
            "I heard Route 1 can be dangerous at night.",
        ],
        defeatedDialogue: [
            "Wow, you're strong!",
            "I need to train more before Route 1.",
        ],
        continueDialogue: [
            "My mom says I should visit the PokéCenter often.",
            "They heal your creatures for free!",
            "Maybe I'll see you in Viridian City someday.",
        ],
        canBattle: true,
        team: [
            {
                creatureId: 'aquafin', name: 'Aquafin', type: 'Water',
                level: 3, hp: calcHp(44, 3), maxHp: calcHp(44, 3),
                trainerName: 'Lass',
                moves: [
                    { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
                    { id: 'bubble', name: 'Bubble', type: 'Water', power: 40 },
                ],
            },
        ],
        battleTeamName: 'Lass',
        returnScene: 'Outdoor',
    },
]

function calcHp(baseHp: number, level: number): number {
    return Math.floor(((2 * baseHp) * level) / 100 + level + 10)
}

export default class OutdoorScene extends Phaser.Scene {
    // @ts-ignore
    private player!:       Phaser.Physics.Arcade.Sprite
    private playerSprite!: Phaser.GameObjects.Image
    private playerDir      = 'down'
    private playerFrame    = 0
    private walkTimer      = 0
    private cursors!:      Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:     Phaser.Input.Keyboard.Key
    private dialogue!:     DialogueSystem
    private inventoryUI!:  InventoryUI
    private walls!:        Phaser.Physics.Arcade.StaticGroup
    private triggered      = false
    private meLabel!:      Phaser.GameObjects.Text
    private multiplayerUI!: MultiplayerUI

    private labDoor!:    Phaser.GameObjects.Zone
    private pHouseDoor!: Phaser.GameObjects.Zone
    private rHouseDoor!: Phaser.GameObjects.Zone
    private bushZone!:   Phaser.GameObjects.Zone
    private npcZone!:    Phaser.GameObjects.Zone
    private signZone!:   Phaser.GameObjects.Zone
    private npcController!: NPCController
    private notifyUI!:   NotificationUI

    constructor() { super({ key: 'Outdoor' }) }

    create(data?: { from?: string; spawnX?: number; spawnY?: number; npcId?: string }) {
        fadeIn(this)
        this.triggered = false
        this.dialogue    = new DialogueSystem(this)
        this.inventoryUI = new InventoryUI(this)
        this.notifyUI    = new NotificationUI(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        this.drawTown()
        this.setupWalls()
        this.setupZones()
        this.spawnPlayer(data)

        // ── NPCController for interactive NPCs ─────────────────
        this.npcController = new NPCController(this, this.dialogue, PALLET_NPCS)
        this.npcController.create()

        // ── Handle return from NPC battle ───────────────────────
        if (data?.from === 'npcBattle' && data?.npcId) {
            this.npcController.markDefeated(data.npcId)
        }

        this.inventoryUI.createBagButton()
        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())

        // ── Trigger checkpoint on entry ─────────────────────────
        checkpointManager.reach('HOMETOWN', { x: this.player.x, y: this.player.y })
        this.notifyUI.showCheckpoint('Pallet Town')
        saveManager.setPosition('Outdoor', this.player.x, this.player.y)
        saveManager.save()

        // ── Multiplayer interactions ────────────────────────────
        this.multiplayerUI = new MultiplayerUI(this, 'hometown', this.player)
        this.multiplayerUI.create()

        // ── Profile + Leaderboard HUD ──────────────────────────
        playerState.load().then(() => {
            new ProfileUI(this).create()
            new LeaderboardUI(this).create()
        })
    }

    private drawTown() {
        const gfx = this.add.graphics().setDepth(0)

        // ── Sky tiles ──────────────────────────────────────────────
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, 0, 'tile_sky').setOrigin(0).setDisplaySize(32, 36).setDepth(0)
        }

        // ── Grass tiles ────────────────────────────────────────────
        for (let y = 36; y < SHORE_Y; y += 32) {
            for (let x = 0; x < W; x += 32) {
                this.add.image(x, y, 'tile_grass').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
            }
        }

        // ── Path tiles (horizontal + vertical cross) ───────────────
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, H / 2 - 16, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
        }
        for (let y = 36; y < SHORE_Y; y += 32) {
            this.add.image(W / 2 - 16, y, 'tile_path').setOrigin(0).setDisplaySize(32, 32).setDepth(0)
        }

        // ── Path edge shadows (subtle ground lines) ────────────────
        gfx.fillStyle(0x489020, 0.4)
        gfx.fillRect(0, H / 2 - 18, W, 2)       // top of horizontal path
        gfx.fillRect(0, H / 2 + 16, W, 2)        // bottom of horizontal path
        gfx.fillRect(W / 2 - 18, 36, 2, SHORE_Y - 36) // left of vertical path
        gfx.fillRect(W / 2 + 16, 36, 2, SHORE_Y - 36) // right of vertical path

        // ── Sand strip (beach, refined with gradient) ──────────────
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, SHORE_Y - 16, 'tile_sand').setOrigin(0).setDisplaySize(32, 18).setDepth(0)
        }
        gfx.fillStyle(0xd8c078, 0.3)
        gfx.fillRect(0, SHORE_Y - 4, W, 4)  // darker sand at waterline

        // ── Water tiles with ripple highlight ──────────────────────
        for (let x = 0; x < W; x += 32) {
            this.add.image(x, SHORE_Y, 'tile_water').setOrigin(0).setDisplaySize(32, H - SHORE_Y).setDepth(0)
        }
        gfx.fillStyle(0x58a8f8, 0.3)
        gfx.fillRect(0, SHORE_Y, W, 3)  // foam line

        // ── Oak's Lab (sprite) ─────────────────────────────────────
        this.add.image(LAB_X, LAB_Y, 'building_lab').setOrigin(0).setDisplaySize(LAB_W, LAB_H).setDepth(1)
        // Building shadow
        gfx.fillStyle(0x000000, 0.08)
        gfx.fillRect(LAB_X + 4, LAB_Y + LAB_H, LAB_W, 6)
        this.add.text(LAB_X + LAB_W / 2, LAB_Y + 8, "OAK'S LAB", {
            fontSize: '9px', color: '#222', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)

        // ── Player house (red roof sprite) ─────────────────────────
        this.add.image(PHOUSE_X, PHOUSE_Y, 'building_house_red').setOrigin(0).setDisplaySize(120, 90).setDepth(1)
        gfx.fillStyle(0x000000, 0.08)
        gfx.fillRect(PHOUSE_X + 4, PHOUSE_Y + 90, 120, 5)
        this.add.text(PHOUSE_X + 60, PHOUSE_Y + 8, 'MY HOUSE', {
            fontSize: '8px', color: '#fff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)

        // ── Rival house (blue roof sprite) ─────────────────────────
        this.add.image(RHOUSE_X, RHOUSE_Y, 'building_house_blue').setOrigin(0).setDisplaySize(120, 90).setDepth(1)
        gfx.fillStyle(0x000000, 0.08)
        gfx.fillRect(RHOUSE_X + 4, RHOUSE_Y + 90, 120, 5)
        this.add.text(RHOUSE_X + 60, RHOUSE_Y + 8, "GARY'S HOUSE", {
            fontSize: '8px', color: '#fff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(2)

        // ── Trees along the top (denser, layered) ──────────────────
        for (let tx = 0; tx < W; tx += 28) {
            if (tx < LAB_X - 16 || tx > LAB_X + LAB_W) {
                this.add.image(tx + 14, 16, 'obj_tree').setOrigin(0.5, 0.3)
                    .setDisplaySize(40, 56).setDepth(1)
            }
        }

        // ── Decorative flowers along paths (more variety) ──────────
        const flowerSpots = [
            { x: 140, y: H / 2 - 30 }, { x: 220, y: H / 2 + 26 },
            { x: 320, y: H / 2 - 28 }, { x: 420, y: H / 2 + 24 },
            { x: 500, y: H / 2 - 30 }, { x: 580, y: H / 2 + 26 },
            { x: 620, y: H / 2 - 28 }, { x: 700, y: H / 2 + 24 },
            { x: W / 2 + 30, y: 100 }, { x: W / 2 - 30, y: 180 },
            { x: W / 2 + 30, y: 240 }, { x: W / 2 - 30, y: 340 },
        ]
        flowerSpots.forEach((f, i) => {
            const key = i % 3 === 0 ? 'obj_flower_red' : 'obj_flower_yellow'
            this.add.image(f.x, f.y, key).setDisplaySize(12, 12).setDepth(1)
        })

        // ── Bushes (Route 1 exit) — double row ─────────────────────
        for (let bx = BUSH_X; bx < BUSH_X + BUSH_W; bx += 24) {
            this.add.image(bx + 12, SHORE_Y - 18, 'obj_bush')
                .setDisplaySize(24, 20).setDepth(1)
        }
        this.add.text(W / 2, SHORE_Y - 50, '↓ Route 1', {
            fontSize: '10px', color: '#fff', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 6, y: 2 },
        }).setOrigin(0.5).setDepth(2)

        // ── Fence along shore edges ────────────────────────────────
        for (let fx = 0; fx < BUSH_X - 10; fx += 34) {
            this.add.image(fx + 17, SHORE_Y - 10, 'obj_fence')
                .setDisplaySize(32, 16).setDepth(1)
        }
        for (let fx = BUSH_X + BUSH_W + 10; fx < W; fx += 34) {
            this.add.image(fx + 17, SHORE_Y - 10, 'obj_fence')
                .setDisplaySize(32, 16).setDepth(1)
        }

        // ── Elder NPC (sprite) ─────────────────────────────────────
        const npcX = W / 2 + 80, npcY = H / 2 - 60
        this.add.image(npcX, npcY, 'npc_elder').setDisplaySize(32, 48).setDepth(3)
        this.add.text(npcX, npcY - 24, 'Elder', {
            fontSize: '9px', color: '#555', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(3)
        this.npcZone = this.add.zone(npcX, npcY, 44, 44).setOrigin(0.5)

        // ── Town sign (sprite) — enhanced ──────────────────────────
        const signX = W / 2 + 50, signY = H / 2 - 38
        this.add.image(signX, signY, 'obj_sign').setDisplaySize(24, 32).setDepth(1)
        this.signZone = this.add.zone(signX, signY, 34, 34).setOrigin(0.5)
        ;[this.npcZone, this.signZone].forEach(z => this.physics.add.existing(z, true))

        // ── Lamp posts for atmosphere ──────────────────────────────
        this.add.image(PHOUSE_X + 130, PHOUSE_Y + 60, 'obj_lamp')
            .setDisplaySize(14, 36).setDepth(1)
        this.add.image(RHOUSE_X - 10, RHOUSE_Y + 60, 'obj_lamp')
            .setDisplaySize(14, 36).setDepth(1)

        // ── Town name label (permanent overlay) ────────────────────
        gfx.fillStyle(0x000000, 0.6).fillRect(W / 2 - 80, 36, 160, 20)
        gfx.fillStyle(0xf8f8f8).fillRect(W / 2 - 80, 36, 160, 1)
        gfx.fillStyle(0xf8f8f8).fillRect(W / 2 - 80, 55, 160, 1)
        this.add.text(W / 2, 42, 'PALLET TOWN', {
            fontSize: '11px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(2)
    }

    private setupWalls() {
        this.walls = this.physics.add.staticGroup()
        const wall = (x: number, y: number, w: number, h: number) => {
            const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0) as any
            this.physics.add.existing(r, true)
            this.walls.add(r)
        }
        wall(0, 0, W, 36)
        wall(0, SHORE_Y, W, H - SHORE_Y)
        wall(LAB_X, LAB_Y, LAB_W, LAB_H - 24)
        wall(PHOUSE_X, PHOUSE_Y, 120, 66)
        wall(RHOUSE_X, RHOUSE_Y, 120, 66)
    }

    private setupZones() {
        this.labDoor    = this.add.zone(LAB_X + LAB_W / 2, LAB_Y + LAB_H, 28, 16).setOrigin(0.5)
        this.pHouseDoor = this.add.zone(PHOUSE_X + 60, PHOUSE_Y + 90, 28, 16).setOrigin(0.5)
        this.rHouseDoor = this.add.zone(RHOUSE_X + 60, RHOUSE_Y + 90, 28, 16).setOrigin(0.5)
        this.bushZone   = this.add.zone(W / 2, SHORE_Y - 18, BUSH_W, 30).setOrigin(0.5)
        ;[this.labDoor, this.pHouseDoor, this.rHouseDoor, this.bushZone].forEach(z =>
            this.physics.add.existing(z, true))
    }

    private spawnPlayer(data?: { from?: string; spawnX?: number; spawnY?: number }) {
        let sp: { x: number; y: number }
        if (data?.from === 'checkpoint' && data.spawnX != null) {
            sp = { x: data.spawnX, y: data.spawnY! }
        } else {
            sp = SPAWNS[data?.from ?? 'default'] ?? SPAWNS.default
        }

        // Player sprite image (from BootScene-generated textures)
        this.playerSprite = this.add.image(sp.x, sp.y, 'player_down_0')
            .setDisplaySize(28, 42).setDepth(5)

        // Invisible physics body
        const rect = this.add.rectangle(sp.x, sp.y, 14, 20, 0xff0000, 0) as any
        this.physics.add.existing(rect)
        this.player = rect as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true).setSize(14, 20)

        // 'me' label above the player
        this.meLabel = this.add.text(sp.x, sp.y - 24, 'me', {
            fontFamily: 'monospace', fontSize: '10px', color: '#ffff00',
            backgroundColor: '#00000099', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(6)

        this.physics.add.collider(this.player as any, this.walls)
    }

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

        // Walk animation toggle
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

        // Sync sprite to physics body
        this.playerSprite.setPosition(this.player.x, this.player.y)
        this.playerSprite.setTexture(`player_${this.playerDir}_${this.playerFrame}`)

        // Update 'me' label position
        this.meLabel.setPosition(this.player.x, this.player.y - 24)

        // NPC controller (interactive NPCs with choices/battles)
        this.npcController.update(this.player, delta)
        if (this.npcController.active()) return

        // NPC interactions (SPACE) — legacy Elder + Sign
        if (!locked && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const px = this.player as any
            if (!this.npcController.isOverlapping(px)) {
                if (this.physics.overlap(px, this.npcZone)) {
                    this.dialogue.show(['The lab has been busy lately...', "Professor Oak rarely leaves its doors."], 'Elder')
                } else if (this.physics.overlap(px, this.signZone)) {
                    this.dialogue.show(['── PALLET TOWN ──', 'A tranquil town under the open sky.'])
                }
            }
        }

        // Update save position
        saveManager.setPosition('Outdoor', this.player.x, this.player.y)

        // Zone transitions
        if (!this.triggered && !locked) {
            const px = this.player as any
            if (this.physics.overlap(px, this.labDoor)) {
                this.triggered = true; transitionTo(this, 'LabInterior')
            } else if (this.physics.overlap(px, this.pHouseDoor)) {
                this.triggered = true; transitionTo(this, 'HouseInterior', { spawnAt: 'door' })
            } else if (this.physics.overlap(px, this.rHouseDoor)) {
                this.triggered = true; transitionTo(this, 'RivalHouse')
            } else if (this.physics.overlap(px, this.bushZone)) {
                this.triggered = true
                transitionTo(this, 'Route1', { from: 'palletTown' })
            }
        }
    }

    shutdown() { this.multiplayerUI?.destroy() }
}
