// ─────────────────────────────────────────────────────────────────────────────
// MultiplayerUI — Real-time multiplayer player interaction system
//
// Manages remote player rendering, proximity detection, interaction menu
// (Chat / Battle / Ignore), real-time chat, and PvP battle bridging.
//
// Usage:
//   const mp = new MultiplayerUI(scene, 'hometown', player)
//   mp.create()
//   // in update():
//   mp.update(delta, locked)
//   if (mp.active()) return
//   // in shutdown():
//   mp.destroy()
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser'
import { overworldSocket } from '../../lib/overworldSocket'
import type { PlayerSnapshot, WorldSnapshot, ChatMessage } from '../../lib/overworldSocket'
import { getBattleSocket } from '../../lib/battleSocket'

// ── Constants ──────────────────────────────────────────────────────────────

const PROXIMITY_RANGE = 120  // pixels
const CHAT_HISTORY    = 10   // max visible messages
const CHAT_MAX_LEN    = 120  // max input chars

const MENU_OPTIONS = [
    { label: '💬 Chat',   key: 'chat'   },
    { label: '⚔️ Battle', key: 'battle' },
    { label: '❌ Ignore',  key: 'ignore' },
] as const

// ═══════════════════════════════════════════════════════════════════════════
// MultiplayerUI class
// ═══════════════════════════════════════════════════════════════════════════

export class MultiplayerUI {
    private scene: Phaser.Scene
    private mapId: string
    private player: Phaser.Physics.Arcade.Sprite
    private myUserId: string
    private moveThrottle = 0

    // ── Remote players ──────────────────────────────────────────────────
    private remotePlayers = new Map<string, Phaser.GameObjects.Container>()
    private allPlayers: PlayerSnapshot[] = []

    // ── Nearby players (within PROXIMITY_RANGE) ─────────────────────────
    private nearbyList: { player: PlayerSnapshot; distance: number }[] = []

    // ── Proximity prompt ────────────────────────────────────────────────
    private promptContainer: Phaser.GameObjects.Container | null = null

    // ── Interaction menu ────────────────────────────────────────────────
    private menuContainer: Phaser.GameObjects.Container | null = null
    private menuIndex = 0
    private menuTexts: Phaser.GameObjects.Text[] = []
    private menuArrow: Phaser.GameObjects.Text | null = null
    private menuTarget: PlayerSnapshot | null = null

    // ── Chat ────────────────────────────────────────────────────────────
    private chatContainer: Phaser.GameObjects.Container | null = null
    private chatPartner: { userId: string; username: string } | null = null
    private chatMessages: { text: string; mine: boolean }[] = []
    private chatInput = ''
    private chatBlinkTimer = 0
    private chatBodyText: Phaser.GameObjects.Text | null = null
    private chatInputText: Phaser.GameObjects.Text | null = null
    private chatClosePending = false

    // ── State ───────────────────────────────────────────────────────────
    private _menuOpen = false
    private _chatOpen = false
    private eKey!: Phaser.Input.Keyboard.Key

    // ── HUD ─────────────────────────────────────────────────────────────
    private nearbyCountText: Phaser.GameObjects.Text | null = null

    constructor(scene: Phaser.Scene, mapId: string, player: Phaser.Physics.Arcade.Sprite) {
        this.scene = scene
        this.mapId = mapId
        this.player = player
        this.myUserId = scene.registry.get('userId') ?? ''
    }

    // ═════════════════════════════════════════════════════════════════════
    // CREATE
    // ═════════════════════════════════════════════════════════════════════

    create() {
        // Join overworld room
        overworldSocket.join(this.mapId, this.player.x, this.player.y)
        overworldSocket.onSnapshot = (snap) => this.handleSnapshot(snap)
        overworldSocket.onChatMessage = (msg) => this.handleChatMessage(msg)

        // Ensure battle socket is connected so PvP requests arrive
        const token = this.scene.registry.get('token') as string
        if (token) getBattleSocket(token)

        // E key for player interaction
        this.eKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)

        // Keyboard handler for menu / chat input
        this.scene.input.keyboard!.on('keydown', this.onKeyDown, this)

        // Nearby player count HUD (top-right)
        this.nearbyCountText = this.scene.add.text(
            this.scene.scale.width - 10, 46, '', {
                fontSize: '9px', color: '#88eeff', fontFamily: 'monospace',
                backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
            },
        ).setOrigin(1, 0).setDepth(50).setScrollFactor(0)
    }

    // ═════════════════════════════════════════════════════════════════════
    // SNAPSHOT — render remote players + detect proximity
    // ═════════════════════════════════════════════════════════════════════

    private handleSnapshot(snap: WorldSnapshot) {
        if (snap.mapId !== this.mapId) return
        this.allPlayers = snap.players.filter(p => p.userId !== this.myUserId)

        // Update remote player sprites
        const alive = new Set<string>()
        for (const p of this.allPlayers) {
            alive.add(p.userId)
            this.upsertRemote(p)
        }
        for (const [uid, c] of this.remotePlayers) {
            if (!alive.has(uid)) { c.destroy(); this.remotePlayers.delete(uid) }
        }

        // Compute nearby players
        this.nearbyList = this.allPlayers
            .map(p => ({
                player: p,
                distance: Phaser.Math.Distance.Between(
                    this.player.x, this.player.y, p.x, p.y,
                ),
            }))
            .filter(n => n.distance <= PROXIMITY_RANGE)
            .sort((a, b) => a.distance - b.distance)
    }

    private upsertRemote(p: PlayerSnapshot) {
        let c = this.remotePlayers.get(p.userId)
        if (!c) {
            const body = this.scene.add.image(0, 0, 'npc_remote').setDisplaySize(28, 42)
            const label = this.scene.add.text(0, -26, p.username, {
                fontSize: '9px', color: '#88eeff', fontFamily: 'monospace',
                backgroundColor: '#00000088', padding: { x: 2, y: 1 },
            }).setOrigin(0.5)
            c = this.scene.add.container(p.x, p.y, [body, label]).setDepth(4)
            this.remotePlayers.set(p.userId, c)
        } else {
            c.setPosition(p.x, p.y)
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    // CHAT MESSAGE — incoming message from another player
    // ═════════════════════════════════════════════════════════════════════

    private handleChatMessage(msg: ChatMessage) {
        // Auto-open chat window if not already chatting
        if (!this._chatOpen) {
            this.chatPartner = { userId: msg.fromUserId, username: msg.fromUsername }
            this.chatMessages = []
            this.openChat()
        }

        // Only accept messages from current chat partner
        if (this.chatPartner?.userId === msg.fromUserId) {
            this.chatMessages.push({
                text: `${msg.fromUsername}: ${msg.message}`,
                mine: false,
            })
            if (this.chatMessages.length > CHAT_HISTORY + 4) this.chatMessages.shift()
            this.renderChatBody()
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    // KEYBOARD — menu navigation + chat text input
    // ═════════════════════════════════════════════════════════════════════

    private onKeyDown = (event: KeyboardEvent) => {
        // ── Menu navigation ─────────────────────────────────────────
        if (this._menuOpen) {
            if (event.key === 'ArrowUp') {
                this.menuIndex = Math.max(0, this.menuIndex - 1)
                this.renderMenuArrow()
            } else if (event.key === 'ArrowDown') {
                this.menuIndex = Math.min(MENU_OPTIONS.length - 1, this.menuIndex + 1)
                this.renderMenuArrow()
            } else if (event.key === 'Enter' || event.key === ' ') {
                this.selectMenuOption()
            } else if (event.key === 'Escape') {
                this.closeMenu()
            }
            return
        }

        // ── Chat text input ─────────────────────────────────────────
        if (this._chatOpen) {
            if (event.key === 'Escape') {
                this.closeChat()
            } else if (event.key === 'Enter') {
                this.sendChatMessage()
            } else if (event.key === 'Backspace') {
                this.chatInput = this.chatInput.slice(0, -1)
                this.renderChatInput()
            } else if (event.key.length === 1 && this.chatInput.length < CHAT_MAX_LEN) {
                this.chatInput += event.key
                this.renderChatInput()
            }
            return
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    // UPDATE — called every frame from scene
    // ═════════════════════════════════════════════════════════════════════

    update(delta: number, inputLocked = false) {
        // ── Always sync position to overworld socket ────────────────
        this.moveThrottle += delta
        if (this.moveThrottle > 50) {
            this.moveThrottle = 0
            overworldSocket.move(this.player.x, this.player.y)
        }

        // ── Proximity prompt ────────────────────────────────────────
        this.updateProximityPrompt(inputLocked)

        // ── Nearby count HUD ────────────────────────────────────────
        if (this.nearbyCountText) {
            if (this.nearbyList.length > 0) {
                this.nearbyCountText.setText(`👥 ${this.nearbyList.length} nearby`)
                this.nearbyCountText.setVisible(true)
            } else if (this.allPlayers.length > 0) {
                this.nearbyCountText.setText(`🌐 ${this.allPlayers.length} online`)
                this.nearbyCountText.setVisible(true)
            } else {
                this.nearbyCountText.setVisible(false)
            }
        }

        // ── Chat cursor blink ───────────────────────────────────────
        if (this._chatOpen) {
            this.chatBlinkTimer += delta
            if (this.chatBlinkTimer > 400) {
                this.chatBlinkTimer = 0
                this.renderChatInput()
            }
        }

        // ── E key to open interaction menu ──────────────────────────
        if (!inputLocked && !this._menuOpen && !this._chatOpen) {
            if (Phaser.Input.Keyboard.JustDown(this.eKey) && this.nearbyList.length > 0) {
                this.menuTarget = this.nearbyList[0].player
                this.openMenu()
            }
        }

        // ── Auto-close chat if partner left range ───────────────────
        if (this._chatOpen && this.chatPartner && !this.chatClosePending) {
            const stillNearby = this.nearbyList.some(
                n => n.player.userId === this.chatPartner!.userId,
            )
            if (!stillNearby) {
                this.chatClosePending = true
                this.chatMessages.push({ text: '── Partner moved away ──', mine: false })
                this.renderChatBody()
                this.scene.time.delayedCall(2000, () => {
                    if (this._chatOpen) this.closeChat()
                })
            }
        }
    }

    /** Returns true when menu or chat is active (locks player movement) */
    active(): boolean {
        return this._menuOpen || this._chatOpen
    }

    // ═════════════════════════════════════════════════════════════════════
    // PROXIMITY PROMPT — "Press E" above closest player
    // ═════════════════════════════════════════════════════════════════════

    private updateProximityPrompt(inputLocked: boolean) {
        const show =
            this.nearbyList.length > 0 &&
            !this._menuOpen &&
            !this._chatOpen &&
            !inputLocked

        if (show) {
            const closest = this.nearbyList[0]
            if (!this.promptContainer) {
                const bg = this.scene.add.rectangle(0, 0, 110, 22, 0x000000, 0.75)
                    .setStrokeStyle(1, 0x4488cc)
                const txt = this.scene.add.text(0, 0, '', {
                    fontSize: '9px', color: '#88eeff', fontFamily: 'monospace',
                }).setOrigin(0.5)
                this.promptContainer = this.scene.add.container(0, 0, [bg, txt]).setDepth(48)
            }
            const txt = this.promptContainer.getAt(1) as Phaser.GameObjects.Text
            txt.setText(`[ E ] ${closest.player.username}`)
            const bg = this.promptContainer.getAt(0) as Phaser.GameObjects.Rectangle
            bg.setSize(txt.width + 20, 22)
            this.promptContainer.setPosition(closest.player.x, closest.player.y - 42)
            this.promptContainer.setVisible(true)
        } else {
            this.promptContainer?.setVisible(false)
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    // INTERACTION MENU — Chat / Battle / Ignore
    // ═════════════════════════════════════════════════════════════════════

    private openMenu() {
        if (!this.menuTarget) return
        this._menuOpen = true
        this.menuIndex = 0
        this.promptContainer?.setVisible(false)

        const W = this.scene.scale.width
        const H = this.scene.scale.height
        const cx = W / 2
        const cy = H / 2 - 30

        this.menuContainer = this.scene.add.container(0, 0).setDepth(90)

        // Background
        const bg = this.scene.add.rectangle(cx, cy, 220, 170, 0x0a0a1e, 0.95)
            .setStrokeStyle(2, 0x4488cc)
        this.menuContainer.add(bg)

        // Header
        const header = this.scene.add.text(cx, cy - 64, `👤 ${this.menuTarget.username}`, {
            fontSize: '13px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5)
        this.menuContainer.add(header)

        // Divider
        const divider = this.scene.add.rectangle(cx, cy - 44, 186, 1, 0x4488cc, 0.5)
        this.menuContainer.add(divider)

        // Options
        this.menuTexts = []
        MENU_OPTIONS.forEach((opt, i) => {
            const txt = this.scene.add.text(cx - 30, cy - 20 + i * 32, opt.label, {
                fontSize: '14px',
                color: i === 0 ? '#ffffff' : '#888888',
                fontFamily: 'monospace',
            }).setOrigin(0, 0.5)
            this.menuContainer!.add(txt)
            this.menuTexts.push(txt)
        })

        // Arrow
        this.menuArrow = this.scene.add.text(cx - 70, cy - 20, '▶', {
            fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
        }).setOrigin(0, 0.5)
        this.menuContainer.add(this.menuArrow)

        // Hint
        const hint = this.scene.add.text(cx, cy + 68, '↑↓ Navigate · ENTER Select · ESC Close', {
            fontSize: '8px', color: '#555555', fontFamily: 'monospace',
        }).setOrigin(0.5)
        this.menuContainer.add(hint)
    }

    private renderMenuArrow() {
        if (!this.menuArrow) return
        const cy = this.scene.scale.height / 2 - 30
        this.menuArrow.setY(cy - 20 + this.menuIndex * 32)
        this.menuTexts.forEach((txt, i) => {
            txt.setColor(i === this.menuIndex ? '#ffffff' : '#888888')
        })
    }

    private selectMenuOption() {
        const option = MENU_OPTIONS[this.menuIndex]
        const target = this.menuTarget
        this.closeMenu()

        switch (option.key) {
            case 'chat':
                if (target) {
                    this.chatPartner = { userId: target.userId, username: target.username }
                    this.chatMessages = []
                    this.openChat()
                }
                break
            case 'battle':
                if (target) this.requestBattle(target)
                break
            case 'ignore':
                break
        }
    }

    private closeMenu() {
        this._menuOpen = false
        this.menuContainer?.destroy()
        this.menuContainer = null
        this.menuArrow = null
        this.menuTexts = []
        this.menuTarget = null
    }

    // ═════════════════════════════════════════════════════════════════════
    // BATTLE REQUEST — bridge to /battle namespace
    // ═════════════════════════════════════════════════════════════════════

    private requestBattle(target: PlayerSnapshot) {
        const token = this.scene.registry.get('token') as string
        if (!token) return
        const socket = getBattleSocket(token)
        socket.emit('battle-request', { targetUserId: target.userId })
    }

    // ═════════════════════════════════════════════════════════════════════
    // CHAT — real-time player-to-player messaging
    // ═════════════════════════════════════════════════════════════════════

    private openChat() {
        if (!this.chatPartner) return
        this._chatOpen = true
        this.chatClosePending = false
        this.chatInput = ''
        this.chatBlinkTimer = 0
        this.promptContainer?.setVisible(false)

        const W = this.scene.scale.width
        const H = this.scene.scale.height
        const chatH = 170
        const chatY = H - chatH / 2 - 4

        this.chatContainer = this.scene.add.container(0, 0).setDepth(88)

        // Background
        const bg = this.scene.add.rectangle(W / 2, chatY, W - 16, chatH, 0x0a0a1e, 0.94)
            .setStrokeStyle(2, 0x3366aa)
        this.chatContainer.add(bg)

        // Header
        const header = this.scene.add.text(
            16, chatY - chatH / 2 + 8,
            `💬 Chat with ${this.chatPartner.username}`, {
                fontSize: '11px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
            },
        )
        this.chatContainer.add(header)

        // ESC hint
        const esc = this.scene.add.text(W - 24, chatY - chatH / 2 + 8, '[ESC]', {
            fontSize: '9px', color: '#555555', fontFamily: 'monospace',
        }).setOrigin(1, 0)
        this.chatContainer.add(esc)

        // Divider top
        const divTop = this.scene.add.rectangle(
            W / 2, chatY - chatH / 2 + 24, W - 32, 1, 0x3366aa, 0.4,
        )
        this.chatContainer.add(divTop)

        // Message body
        this.chatBodyText = this.scene.add.text(
            16, chatY - chatH / 2 + 30, '', {
                fontSize: '10px', color: '#cccccc', fontFamily: 'monospace',
                wordWrap: { width: W - 48 }, lineSpacing: 3,
            },
        )
        this.chatContainer.add(this.chatBodyText)

        // Divider bottom
        const divBot = this.scene.add.rectangle(
            W / 2, chatY + chatH / 2 - 28, W - 32, 1, 0x3366aa, 0.4,
        )
        this.chatContainer.add(divBot)

        // Input line
        this.chatInputText = this.scene.add.text(
            16, chatY + chatH / 2 - 18, '> █', {
                fontSize: '11px', color: '#88ff88', fontFamily: 'monospace',
            },
        )
        this.chatContainer.add(this.chatInputText)

        this.renderChatBody()
    }

    private renderChatBody() {
        if (!this.chatBodyText) return
        const lines = this.chatMessages.slice(-CHAT_HISTORY)
        this.chatBodyText.setText(lines.map(m => m.text).join('\n'))
    }

    private renderChatInput() {
        if (!this.chatInputText) return
        const cursor = Math.floor(Date.now() / 400) % 2 === 0 ? '█' : ' '
        this.chatInputText.setText(`> ${this.chatInput}${cursor}`)
    }

    private sendChatMessage() {
        if (!this.chatPartner || !this.chatInput.trim()) return
        const msg = this.chatInput.trim()
        this.chatInput = ''

        // Add to local display
        this.chatMessages.push({ text: `You: ${msg}`, mine: true })
        if (this.chatMessages.length > CHAT_HISTORY + 4) this.chatMessages.shift()
        this.renderChatBody()
        this.renderChatInput()

        // Send via overworld socket
        overworldSocket.sendChat(this.chatPartner.userId, msg)
    }

    private closeChat() {
        this._chatOpen = false
        this.chatClosePending = false
        this.chatContainer?.destroy()
        this.chatContainer = null
        this.chatBodyText = null
        this.chatInputText = null
        this.chatPartner = null
        this.chatMessages = []
        this.chatInput = ''
    }

    // ═════════════════════════════════════════════════════════════════════
    // DESTROY — cleanup on scene shutdown
    // ═════════════════════════════════════════════════════════════════════

    destroy() {
        overworldSocket.onSnapshot = null
        overworldSocket.onChatMessage = null
        this.remotePlayers.forEach(c => c.destroy())
        this.remotePlayers.clear()
        this.promptContainer?.destroy()
        this.promptContainer = null
        this.nearbyCountText?.destroy()
        this.nearbyCountText = null
        this.closeMenu()
        this.closeChat()
        this.scene.input.keyboard?.off('keydown', this.onKeyDown, this)
    }
}
