import Phaser from 'phaser'
import { DialogueSystem } from '../systems/DialogueSystem'
import { transitionTo, fadeIn } from '../systems/SceneTransitionHelper'
import { overworldSocket } from '../../lib/overworldSocket'
import type { WorldSnapshot, PlayerSnapshot } from '../../lib/overworldSocket'

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
}

export default class OutdoorScene extends Phaser.Scene {
    // @ts-ignore
    private player!:       Phaser.Physics.Arcade.Sprite
    private cursors!:      Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!:     Phaser.Input.Keyboard.Key
    private dialogue!:     DialogueSystem
    private walls!:        Phaser.Physics.Arcade.StaticGroup
    private remotePlayers: Map<string, Phaser.GameObjects.Container> = new Map()
    private myUserId       = ''
    private triggered      = false
    private moveThrottle   = 0
    private meLabel!:      Phaser.GameObjects.Text

    private labDoor!:    Phaser.GameObjects.Zone
    private pHouseDoor!: Phaser.GameObjects.Zone
    private rHouseDoor!: Phaser.GameObjects.Zone
    private bushZone!:   Phaser.GameObjects.Zone
    private npcZone!:    Phaser.GameObjects.Zone
    private signZone!:   Phaser.GameObjects.Zone

    constructor() { super({ key: 'Outdoor' }) }

    create(data?: { from?: string }) {
        fadeIn(this)
        this.triggered = false
        this.remotePlayers.clear()
        this.myUserId  = this.registry.get('userId') ?? ''
        this.dialogue  = new DialogueSystem(this)
        this.cursors   = this.input.keyboard!.createCursorKeys()
        this.spaceKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.physics.world.setBounds(0, 0, W, H)

        this.drawTown()
        this.setupWalls()
        this.setupZones()
        this.spawnPlayer(data?.from)

        this.input.on('pointerdown', () => this.dialogue.pointerAdvance())
    }

    private drawTown() {
        const g = this.add.graphics()

        // Sky strip
        g.fillStyle(0x9bc8e8).fillRect(0, 0, W, 36)
        // Ground
        g.fillStyle(0x7ec850).fillRect(0, 36, W, SHORE_Y - 36)
        // Paths
        g.fillStyle(0xd4b896)
        g.fillRect(0, H / 2 - 16, W, 32)       // horizontal
        g.fillRect(W / 2 - 16, 36, 32, SHORE_Y) // vertical
        // Water + sand
        g.fillStyle(0x6699ff).fillRect(0, SHORE_Y, W, H - SHORE_Y)
        g.fillStyle(0xf0d080).fillRect(0, SHORE_Y - 12, W, 14)

        // Oak's Lab
        g.fillStyle(0xddddcc).fillRect(LAB_X, LAB_Y, LAB_W, LAB_H)
        g.fillStyle(0x888877).fillRect(LAB_X, LAB_Y, LAB_W, 16)
        g.fillStyle(0x5577aa)
            .fillRect(LAB_X + 20, LAB_Y + 20, 50, 35)
            .fillRect(LAB_X + 76, LAB_Y + 20, 50, 35)
        g.fillStyle(0x6b4a2a).fillRect(LAB_X + LAB_W / 2 - 12, LAB_Y + LAB_H - 24, 24, 24)
        this.add.text(LAB_X + LAB_W / 2, LAB_Y + 8, "OAK'S LAB",
            { fontSize: '9px', color: '#222', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(1)

        // Player house (SE)
        g.fillStyle(0xffeedd).fillRect(PHOUSE_X, PHOUSE_Y, 120, 90)
        g.fillStyle(0xcc4444).fillRect(PHOUSE_X, PHOUSE_Y, 120, 18)
        g.fillStyle(0x5577aa).fillRect(PHOUSE_X + 12, PHOUSE_Y + 24, 35, 28).fillRect(PHOUSE_X + 72, PHOUSE_Y + 24, 35, 28)
        g.fillStyle(0x8b4513).fillRect(PHOUSE_X + 48, PHOUSE_Y + 66, 24, 24)
        this.add.text(PHOUSE_X + 60, PHOUSE_Y + 8, 'MY HOUSE',
            { fontSize: '8px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(1)

        // Rival house (SW)
        g.fillStyle(0xeeeedd).fillRect(RHOUSE_X, RHOUSE_Y, 120, 90)
        g.fillStyle(0x3355aa).fillRect(RHOUSE_X, RHOUSE_Y, 120, 18)
        g.fillStyle(0x5577aa).fillRect(RHOUSE_X + 12, RHOUSE_Y + 24, 35, 28).fillRect(RHOUSE_X + 72, RHOUSE_Y + 24, 35, 28)
        g.fillStyle(0x8b4513).fillRect(RHOUSE_X + 48, RHOUSE_Y + 66, 24, 24)
        this.add.text(RHOUSE_X + 60, RHOUSE_Y + 8, "GARY'S HOUSE",
            { fontSize: '8px', color: '#fff', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(1)

        // Trees at top
        g.fillStyle(0x226622)
        for (let tx = 0; tx < W; tx += 32) {
            if (tx < LAB_X - 16 || tx > LAB_X + LAB_W) {
                g.fillCircle(tx + 16, 20, 18)
                g.fillStyle(0x8b5e3c).fillRect(tx + 12, 28, 8, 10)
                g.fillStyle(0x226622)
            }
        }

        // Bushes (exit)
        g.fillStyle(0x22aa22)
        for (let bx = BUSH_X; bx < BUSH_X + BUSH_W; bx += 20) g.fillCircle(bx + 10, SHORE_Y - 18, 12)
        this.add.text(W / 2, SHORE_Y - 50, '↓ Route 1', {
            fontSize: '10px', color: '#fff', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 6, y: 2 },
        }).setOrigin(0.5).setDepth(2)

        // Elder NPC
        const npcX = W / 2 + 80, npcY = H / 2 - 60
        this.add.rectangle(npcX, npcY, 14, 20, 0x8888ff).setDepth(2)
        this.add.text(npcX, npcY - 14, 'Elder', { fontSize: '9px', color: '#666', fontFamily: 'monospace' }).setOrigin(0.5)
        this.npcZone  = this.add.zone(npcX, npcY, 44, 44).setOrigin(0.5)
        // Sign
        g.fillStyle(0xcc9944).fillRect(W / 2 + 40, H / 2 - 30, 20, 30)
        g.fillStyle(0x885511).fillRect(W / 2 + 38, H / 2 - 48, 24, 20)
        this.signZone = this.add.zone(W / 2 + 50, H / 2 - 38, 34, 34).setOrigin(0.5)
        ;[this.npcZone, this.signZone].forEach(z => this.physics.add.existing(z, true))
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

    private spawnPlayer(from?: string) {
        const sp = SPAWNS[from ?? 'default'] ?? SPAWNS.default
        const p  = this.add.rectangle(sp.x, sp.y, 14, 20, 0xff4444) as any
        this.physics.add.existing(p)
        this.player = p as Phaser.Physics.Arcade.Sprite
        ;(this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true).setSize(14, 20)
        this.player.setDepth(5)

        // 'me' label above the player
        this.meLabel = this.add.text(sp.x, sp.y - 16, 'me', {
            fontFamily: 'monospace', fontSize: '10px', color: '#ffff00',
            backgroundColor: '#00000099', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(6)

        this.physics.add.collider(this.player as any, this.walls)

        const token = this.registry.get('token') as string
        if (token) {
            overworldSocket.join('hometown', sp.x, sp.y)
            overworldSocket.onSnapshot = (snap) => this.handleSnapshot(snap)
        }
    }

    private handleSnapshot(snap: WorldSnapshot) {
        if (snap.mapId !== 'hometown') return
        const alive = new Set<string>()
        for (const p of snap.players) {
            if (p.userId === this.myUserId) continue
            alive.add(p.userId)
            this.upsertRemote(p)
        }
        for (const [uid, c] of this.remotePlayers) {
            if (!alive.has(uid)) { c.destroy(); this.remotePlayers.delete(uid) }
        }
    }

    private upsertRemote(p: PlayerSnapshot) {
        let c = this.remotePlayers.get(p.userId)
        if (!c) {
            const body  = this.add.rectangle(0, 0, 12, 18, 0x44aaff) as any
            const label = this.add.text(0, -16, p.username, { fontSize: '8px', color: '#88eeff', fontFamily: 'monospace' }).setOrigin(0.5)
            c = this.add.container(p.x, p.y, [body, label]).setDepth(4)
            this.remotePlayers.set(p.userId, c)
        } else {
            c.setPosition(p.x, p.y)
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

        // Update 'me' label position
        this.meLabel.setPosition(this.player.x, this.player.y - 16)

        // Throttled move emit
        this.moveThrottle += delta
        if (this.moveThrottle > 50) {
            this.moveThrottle = 0
            overworldSocket.move(this.player.x, this.player.y)
        }

        // NPC interactions (SPACE)
        if (!locked && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const px = this.player as any
            if (this.physics.overlap(px, this.npcZone)) {
                this.dialogue.show(['The lab has been busy lately...', "Professor Oak rarely leaves its doors."], 'Elder')
            } else if (this.physics.overlap(px, this.signZone)) {
                this.dialogue.show(['── PALLET TOWN ──', 'A tranquil town under the open sky.'])
            }
        }

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
                overworldSocket.enterRoute('hometown')
                this.cameras.main.fadeOut(600, 0, 0, 0)
            }
        }
    }

    shutdown() { overworldSocket.onSnapshot = null }
}
