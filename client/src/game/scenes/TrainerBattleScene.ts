import Phaser from 'phaser'
import { useAuthStore } from '../../store/authStore'
import playerState, { PartyMon } from '../systems/PlayerState'
import { PartyUI } from '../systems/PartyUI'
import { NotificationUI } from '../systems/NotificationUI'
import eventBus, { GameEvents } from '../systems/GameEventBus'

// ─────────────────────────────────────────────────────────────────────────────
// TrainerBattleScene — Sequential trainer battle with party switching
//
// FIGHT + POKéMON (switch). No catching or running.
// XP/money awarded per opponent defeated.
// Loss → heal all + teleport to PokéCenter.
// ─────────────────────────────────────────────────────────────────────────────

const W = 800, H = 576
const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'

interface TrainerMon {
    creatureId: string
    name: string
    type: string
    level: number
    hp: number
    maxHp: number
    trainerName: string
    moves: { id: string; name: string; type: string; power: number }[]
}

export interface TrainerBattleData {
    opponents: TrainerMon[]
    trainerTeamName: string
    returnScene: string
    returnData?: Record<string, unknown>
    onWin?: string
    onLose?: string
}

export default class TrainerBattleScene extends Phaser.Scene {
    private battleData!: TrainerBattleData
    private activeMon!: PartyMon

    // Current opponent
    private oppIndex = 0
    private currentOpp!: TrainerMon

    // UI state
    private menuIndex  = 0
    private fightIndex = 0
    private state: 'intro' | 'menu' | 'fight' | 'text' | 'transition' | 'party' | 'done' = 'intro'
    private textQueue: (string | { text: string; action?: () => void })[] = []

    // Display objects
    private oppHpBar!:      Phaser.GameObjects.Rectangle
    private playerHpBar!:   Phaser.GameObjects.Rectangle
    private oppHpText!:     Phaser.GameObjects.Text
    private playerHpText!:  Phaser.GameObjects.Text
    private oppNameText!:   Phaser.GameObjects.Text
    private oppLvlText!:    Phaser.GameObjects.Text
    private playerNameText!: Phaser.GameObjects.Text
    private playerLvlText!:  Phaser.GameObjects.Text
    private msgText!:       Phaser.GameObjects.Text
    private menuTexts:      Phaser.GameObjects.Text[] = []
    private cursor!:        Phaser.GameObjects.Text
    private oppSprite?:     Phaser.GameObjects.Image
    private playerSpriteImg?: Phaser.GameObjects.Image

    // Keys
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!: Phaser.Input.Keyboard.Key
    private escKey!:   Phaser.Input.Keyboard.Key

    // Stats
    private oppHp     = 0
    private oppMaxHp  = 0
    private playerHp  = 0
    private playerMaxHp = 0
    private oppLevel    = 5
    private playerLevel = 5

    private playerMoves: { id: string; name: string; type: string; power: number }[] = []

    private pendingOutcome: null | 'won' | 'lost' = null
    private _faintSwitchPending = false
    private uiReady  = false
    private _exiting = false

    // Party UI + Notifications
    private partyUI!: PartyUI
    private notifyUI!: NotificationUI

    constructor() { super({ key: 'TrainerBattle' }) }

    create(data: TrainerBattleData) {
        this.battleData = data
        this.oppIndex = 0
        this.state = 'intro'
        this.menuIndex = 0
        this.fightIndex = 0
        this.pendingOutcome = null
        this._faintSwitchPending = false
        this.uiReady = false
        this._exiting = false
        this.menuTexts = []
        this.textQueue = []

        this.cursors  = this.input.keyboard!.createCursorKeys()
        this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.escKey   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

        this.currentOpp = data.opponents[0]
        this.oppHp = this.currentOpp.hp
        this.oppMaxHp = this.currentOpp.maxHp
        this.oppLevel = this.currentOpp.level

        this.partyUI = new PartyUI(this)
        this.notifyUI = new NotificationUI(this)

        this.loadPlayerData()
    }

    private async loadPlayerData() {
        await playerState.load()

        const alive = playerState.getFirstAlive()
        if (alive) {
            this.activeMon = { ...alive }
            this.playerHp = alive.currentHp
            this.playerMaxHp = alive.maxHp
            this.playerLevel = alive.level
            this.playerMoves = alive.moves || []
        } else {
            this.activeMon = {
                id: '', creatureId: 'flameling', nickname: null,
                level: 5, xp: 0, currentHp: 50, maxHp: 50, isLead: true,
                moves: [
                    { id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 },
                    { id: 'growl', name: 'Growl', type: 'Normal', power: 0 },
                ],
            }
            this.playerHp = 50
            this.playerMaxHp = 50
            this.playerLevel = 5
            this.playerMoves = this.activeMon.moves
        }

        this.buildUI()
    }

    private buildUI() {
        this.cameras.main.setBackgroundColor('#000000')
        this.cameras.main.flash(400, 255, 255, 255)

        // Cave battle background
        const bg = this.add.graphics()
        bg.fillStyle(0x383848).fillRect(0, 0, W, H / 2)
        bg.fillStyle(0x484858).fillRect(0, 0, W, H / 4)
        bg.fillStyle(0x282838).fillRect(0, H / 2 - 40, W, H / 2 + 40)
        bg.fillStyle(0x383848).fillRect(0, H / 2 - 20, W, 20)
        bg.fillStyle(0x202030, 0.5)
        bg.fillEllipse(580, 220, 200, 40)
        bg.fillEllipse(220, 380, 200, 40)

        this.showOppSprite()
        this.showPlayerSprite()

        // Opp HP panel (top left)
        const wpx = 40, wpy = 30
        const wpanel = this.add.graphics().setDepth(3)
        wpanel.fillStyle(0xf8f0d8).fillRoundedRect(wpx, wpy, 280, 68, 8)
        wpanel.lineStyle(2, 0x484040).strokeRoundedRect(wpx, wpy, 280, 68, 8)

        this.oppNameText = this.add.text(wpx + 14, wpy + 8, this.currentOpp.name, {
            fontSize: '14px', color: '#282828', fontFamily: 'monospace', fontStyle: 'bold',
        }).setDepth(4)
        this.oppLvlText = this.add.text(wpx + 210, wpy + 8, `Lv${this.oppLevel}`, {
            fontSize: '12px', color: '#585858', fontFamily: 'monospace',
        }).setDepth(4)

        this.add.rectangle(wpx + 80, wpy + 38, 180, 10, 0x484040).setOrigin(0, 0.5).setDepth(4)
        this.oppHpBar = this.add.rectangle(wpx + 82, wpy + 38, 176, 6, 0x40c040).setOrigin(0, 0.5).setDepth(5)
        this.add.text(wpx + 14, wpy + 33, 'HP', {
            fontSize: '11px', color: '#f8a030', fontFamily: 'monospace', fontStyle: 'bold',
        }).setDepth(5)
        this.oppHpText = this.add.text(wpx + 180, wpy + 52, `${this.oppHp}/${this.oppMaxHp}`, {
            fontSize: '10px', color: '#484040', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(4)

        // Player HP panel (bottom right)
        const ppx = 440, ppy = 340
        const ppanel = this.add.graphics().setDepth(3)
        ppanel.fillStyle(0xf8f0d8).fillRoundedRect(ppx, ppy, 320, 78, 8)
        ppanel.lineStyle(2, 0x484040).strokeRoundedRect(ppx, ppy, 320, 78, 8)

        const pName = this.activeMon.nickname || this.capitalise(this.activeMon.creatureId)
        this.playerNameText = this.add.text(ppx + 14, ppy + 8, pName, {
            fontSize: '14px', color: '#282828', fontFamily: 'monospace', fontStyle: 'bold',
        }).setDepth(4)
        this.playerLvlText = this.add.text(ppx + 250, ppy + 8, `Lv${this.playerLevel}`, {
            fontSize: '12px', color: '#585858', fontFamily: 'monospace',
        }).setDepth(4)

        this.add.rectangle(ppx + 80, ppy + 38, 220, 10, 0x484040).setOrigin(0, 0.5).setDepth(4)
        this.playerHpBar = this.add.rectangle(ppx + 82, ppy + 38, 216, 6, 0x40c040).setOrigin(0, 0.5).setDepth(5)
        this.add.text(ppx + 14, ppy + 33, 'HP', {
            fontSize: '11px', color: '#f8a030', fontFamily: 'monospace', fontStyle: 'bold',
        }).setDepth(5)
        this.playerHpText = this.add.text(ppx + 220, ppy + 56, `${this.playerHp}/${this.playerMaxHp}`, {
            fontSize: '11px', color: '#484040', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(4)

        // Party indicator balls
        const partyBalls = playerState.team
        const ballY = ppy + 72
        partyBalls.forEach((mon, i) => {
            const bx = ppx + 14 + i * 18
            const color = mon.currentHp > 0 ? 0x40c040 : 0xe04030
            this.add.circle(bx, ballY, 5, color).setDepth(4)
        })

        // Message / Menu box
        const bx = 0, by = H - 130
        const box = this.add.graphics().setDepth(6)
        box.fillStyle(0xf8f0d8).fillRect(bx, by, W, 130)
        box.lineStyle(3, 0x484040).strokeRect(bx + 2, by + 2, W - 4, 126)

        this.msgText = this.add.text(30, by + 20, '', {
            fontSize: '16px', color: '#282828', fontFamily: 'monospace',
            wordWrap: { width: 440 },
        }).setDepth(7)

        // Menu options: FIGHT + POKéMON
        const mx = 500, my = by + 14
        const menuBox = this.add.graphics().setDepth(7)
        menuBox.fillStyle(0xf8f8f0).fillRoundedRect(mx - 10, my - 6, 290, 118, 6)
        menuBox.lineStyle(2, 0x484040).strokeRoundedRect(mx - 10, my - 6, 290, 118, 6)

        const labels = ['FIGHT', 'POKéMON', '', '']
        this.menuTexts = labels.map((lbl, i) => {
            const col = i % 2
            const row = Math.floor(i / 2)
            return this.add.text(mx + 30 + col * 140, my + 8 + row * 44, lbl, {
                fontSize: '15px', color: '#282828', fontFamily: 'monospace', fontStyle: 'bold',
            }).setDepth(8)
        })

        this.cursor = this.add.text(mx + 12, my + 8, '▶', {
            fontSize: '15px', color: '#282828', fontFamily: 'monospace',
        }).setDepth(8)

        // Trainer name badge
        this.add.text(W - 16, 8, this.battleData.trainerTeamName, {
            fontSize: '10px', color: '#ff8888', fontFamily: 'monospace',
            backgroundColor: '#00000088', padding: { x: 6, y: 2 },
        }).setOrigin(1, 0).setDepth(10)

        // Intro text
        const introOpp = this.currentOpp
        this.textQueue = [`${introOpp.trainerName} sent out ${introOpp.name}!`]
        this.msgText.setText(`${this.battleData.trainerTeamName} wants to battle!`)
        this.state = 'text'
        this.uiReady = true
    }

    private showOppSprite() {
        if (this.oppSprite) this.oppSprite.destroy()
        const oppKey = `creature_${this.currentOpp.creatureId}_front`
        if (this.textures.exists(oppKey)) {
            this.oppSprite = this.add.image(580, 170, oppKey).setDisplaySize(96, 96).setDepth(2)
        } else {
            const g = this.add.graphics().setDepth(2)
            g.fillStyle(0x9050c0).fillCircle(580, 170, 40)
        }
    }

    private showPlayerSprite() {
        if (this.playerSpriteImg) this.playerSpriteImg.destroy()
        const playerKey = `creature_${this.activeMon.creatureId}_back`
        if (this.textures.exists(playerKey)) {
            this.playerSpriteImg = this.add.image(220, 330, playerKey).setDisplaySize(112, 112).setDepth(2)
        } else {
            const g = this.add.graphics().setDepth(2)
            g.fillStyle(0x3078d0).fillCircle(220, 330, 44)
        }
    }

    private updatePlayerPanel() {
        const pName = this.activeMon.nickname || this.capitalise(this.activeMon.creatureId)
        this.playerNameText?.setText(pName)
        this.playerLvlText?.setText(`Lv${this.playerLevel}`)
        this.updateHpBars()
    }

    // ═══════════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════════

    update() {
        if (!this.uiReady || this.state === 'done') return

        if (this.partyUI.active()) {
            this.partyUI.update()
            return
        }

        if (this.state === 'text' || this.state === 'intro' || this.state === 'transition') {
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                if (this.textQueue.length > 0) {
                    this.showNextText()
                } else if (this._faintSwitchPending) {
                    this._faintSwitchPending = false
                    this.openFaintPartyMenu()
                } else if (this.state === 'transition') {
                    this.bringNextOpponent()
                } else if (this.pendingOutcome) {
                    this.state = 'done'
                    this.time.delayedCall(400, () => this.exitBattle())
                } else {
                    this.state = 'menu'
                    this.showMenu()
                }
            }
            return
        }

        if (this.state === 'fight') {
            this.handleFightInput()
            return
        }

        // Main menu — FIGHT or POKéMON
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left))  this.menuIndex = this.menuIndex % 2 === 0 ? this.menuIndex + 1 : this.menuIndex - 1
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.menuIndex = this.menuIndex % 2 === 0 ? this.menuIndex + 1 : this.menuIndex - 1
        this.menuIndex = Phaser.Math.Clamp(this.menuIndex, 0, 1)
        this.updateCursor()

        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            if (this.menuIndex === 0) {
                this.openFightMenu()
            } else {
                this.openPartyMenu()
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PARTY MENU
    // ═══════════════════════════════════════════════════════════════

    private openPartyMenu() {
        this.state = 'party'
        this.partyUI.open(
            playerState.team,
            true,
            (selected) => this.switchPokemon(selected),
            () => { this.state = 'menu'; this.showMenu() },
            this.activeMon.id,
        )
    }

    private switchPokemon(newMon: PartyMon) {
        if (newMon.id === this.activeMon.id) {
            this.state = 'menu'
            this.showMenu()
            return
        }

        playerState.updateHp(this.activeMon.id, this.playerHp)

        this.activeMon = { ...newMon }
        this.playerHp = newMon.currentHp
        this.playerMaxHp = newMon.maxHp
        this.playerLevel = newMon.level
        this.playerMoves = newMon.moves || []

        this.showPlayerSprite()
        this.updatePlayerPanel()

        const pName = newMon.nickname || this.capitalise(newMon.creatureId)
        eventBus.emit(GameEvents.POKEMON_SWITCH, newMon.id)

        this.state = 'text'
        this.textQueue = [`Go, ${pName}!`]

        // Enemy free attack after switch (damage deferred)
        const oppMove = this.currentOpp.moves[Math.floor(Math.random() * this.currentOpp.moves.length)]
        const oppBaseDmg = Math.floor(((2 * this.oppLevel / 5 + 2) * (oppMove.power || 30) * 1.0) / 50 + 2)
        const oppDmg = Math.max(1, Math.floor(oppBaseDmg * (0.85 + Math.random() * 0.15)))
        this.textQueue.push({
            text: `${this.currentOpp.trainerName}'s ${this.currentOpp.name} used ${oppMove.name}!`,
            action: () => {
                this.playerHp = Math.max(0, this.playerHp - oppDmg)
                this.updateHpBars()
                if (this.playerHp <= 0) {
                    this.handlePlayerFaint()
                }
            },
        })
        this.textQueue.push(`${pName} took ${oppDmg} damage!`)

        this.showNextText()
    }

    // ═══════════════════════════════════════════════════════════════
    // MENU
    // ═══════════════════════════════════════════════════════════════

    private showMenu() {
        this.menuTexts.forEach(t => t.destroy())
        this.menuTexts = []
        const labels = ['FIGHT', 'POKéMON', '', '']
        const mx = 500, my = H - 130 + 14
        this.menuTexts = labels.map((lbl, i) => {
            const col = i % 2
            const row = Math.floor(i / 2)
            return this.add.text(mx + 30 + col * 140, my + 8 + row * 44, lbl, {
                fontSize: '15px', color: '#282828', fontFamily: 'monospace', fontStyle: 'bold',
            }).setDepth(8)
        })
        this.msgText.setText('What will you do?')
        this.menuIndex = 0
        this.updateCursor()
    }

    // ═══════════════════════════════════════════════════════════════
    // FIGHT
    // ═══════════════════════════════════════════════════════════════

    private openFightMenu() {
        this.state = 'fight'
        this.fightIndex = 0
        this.menuTexts.forEach(t => t.setVisible(false))

        const movesToShow = this.playerMoves.length > 0
            ? this.playerMoves
            : [{ id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 }]

        // Show type/power info for selected move in message area
        const sel = movesToShow[0]
        this.msgText.setText(`TYPE/${sel.type}    POW/${sel.power > 0 ? sel.power : '---'}`)

        // Show moves in the right-side menu box
        const mx = 500, my = H - 130 + 14
        movesToShow.forEach((m, i) => {
            const col = i % 2, row = Math.floor(i / 2)
            const typeColor = this.getTypeColor(m.type)
            const txt = this.add.text(mx + 30 + col * 140, my + 8 + row * 44, m.name, {
                fontSize: '14px', color: typeColor, fontFamily: 'monospace', fontStyle: 'bold',
            }).setDepth(8)
            this.menuTexts.push(txt)
        })
        this.updateCursor()
    }

    private handleFightInput() {
        const moves = this.playerMoves.length > 0
            ? this.playerMoves
            : [{ id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 }]
        const maxIdx = moves.length - 1
        const prevIdx = this.fightIndex

        if (Phaser.Input.Keyboard.JustDown(this.cursors.left))  this.fightIndex = Math.max(0, this.fightIndex - 1)
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.fightIndex = Math.min(maxIdx, this.fightIndex + 1)
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up))    this.fightIndex = Math.max(0, this.fightIndex - 2)
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down))  this.fightIndex = Math.min(maxIdx, this.fightIndex + 2)
        this.updateCursor()

        if (this.fightIndex !== prevIdx) {
            const sel = moves[this.fightIndex]
            this.msgText.setText(`TYPE/${sel.type}    POW/${sel.power > 0 ? sel.power : '---'}`)
        }

        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.state = 'menu'
            this.showMenu()
            return
        }

        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.executeAttack(moves[this.fightIndex])
        }
    }

    private updateCursor() {
        if (this.state === 'fight') {
            const mx = 500, my = H - 130 + 14
            const col = this.fightIndex % 2
            const row = Math.floor(this.fightIndex / 2)
            this.cursor.setPosition(mx + 12 + col * 140, my + 8 + row * 44)
        } else {
            const mx = 500, my = H - 130 + 14
            const col = this.menuIndex % 2
            this.cursor.setPosition(mx + 12 + col * 140, my + 8)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ATTACK
    // ═══════════════════════════════════════════════════════════════

    private executeAttack(move: { id: string; name: string; type: string; power: number }) {
        this.state = 'text'
        const pName = this.activeMon.nickname || this.capitalise(this.activeMon.creatureId)

        // --- Player attack ---
        if (move.power === 0) {
            this.textQueue = [`${pName} used ${move.name}!`, `${this.currentOpp.name}'s stats fell!`]
        } else {
            const baseDmg = Math.floor(((2 * this.playerLevel / 5 + 2) * move.power * 1.0) / 50 + 2)
            const dmg = Math.max(1, Math.floor(baseDmg * (0.85 + Math.random() * 0.15)))

            this.oppHp = Math.max(0, this.oppHp - dmg)
            this.updateHpBars()

            if (this.oppHp <= 0) {
                // Current opponent fainted — award XP
                this.handleOppFainted(pName, dmg, move.name)
                return
            }

            this.textQueue = [
                `${pName} used ${move.name}!`,
                `It dealt ${dmg} damage!`,
            ]
        }

        // --- Opponent attacks back (damage deferred until text shown) ---
        const oppMove = this.currentOpp.moves[Math.floor(Math.random() * this.currentOpp.moves.length)]
        const oppBaseDmg = Math.floor(((2 * this.oppLevel / 5 + 2) * (oppMove.power || 30) * 1.0) / 50 + 2)
        const oppDmg = Math.max(1, Math.floor(oppBaseDmg * (0.85 + Math.random() * 0.15)))

        this.textQueue.push({
            text: `${this.currentOpp.trainerName}'s ${this.currentOpp.name} used ${oppMove.name}!`,
            action: () => {
                this.playerHp = Math.max(0, this.playerHp - oppDmg)
                this.updateHpBars()
                if (this.playerHp <= 0) {
                    this.handlePlayerFaint()
                }
            },
        })
        this.textQueue.push(`${pName} took ${oppDmg} damage!`)

        this.showNextText()
    }

    private async handleOppFainted(pName: string, dmg: number, moveName: string) {
        const nextIdx = this.oppIndex + 1

        // Award XP + money for this opponent
        playerState.updateHp(this.activeMon.id, this.playerHp)
        const reward = await playerState.awardBattleReward(this.activeMon.id, this.oppLevel)

        const rewardMsgs: string[] = []
        if (reward) {
            rewardMsgs.push(`+${reward.xpGain} XP!`, `+${reward.moneyReward}₽ earned!`)
            if (reward.leveledUp) {
                rewardMsgs.push(`${pName} grew to Lv${reward.newLevel}!`)
                this.notifyUI.showLevelUp(pName, reward.newLevel)
                this.playerLevel = reward.newLevel
                this.playerMaxHp = reward.newMaxHp
                this.updatePlayerPanel()
            }
            this.notifyUI.showMoney(reward.moneyReward)
        }

        if (nextIdx >= this.battleData.opponents.length) {
            // All opponents defeated!
            this.pendingOutcome = 'won'
            eventBus.emit(GameEvents.BATTLE_WIN, { trainerTeam: this.battleData.trainerTeamName })
            this.textQueue = [
                `${pName} used ${moveName}!`,
                `It dealt ${dmg} damage!`,
                `${this.currentOpp.trainerName}'s ${this.currentOpp.name} fainted!`,
                ...rewardMsgs,
                `You defeated ${this.battleData.trainerTeamName}!`,
            ]
            this.showNextText()
        } else {
            // More opponents coming
            const next = this.battleData.opponents[nextIdx]
            this.textQueue = [
                `${pName} used ${moveName}!`,
                `It dealt ${dmg} damage!`,
                `${this.currentOpp.trainerName}'s ${this.currentOpp.name} fainted!`,
                ...rewardMsgs,
                `${next.trainerName} sends out ${next.name}!`,
            ]
            this.showNextText()
            this.oppIndex = nextIdx

            this.time.delayedCall(0, () => {
                const checkInterval = this.time.addEvent({
                    delay: 100, loop: true,
                    callback: () => {
                        if (this.textQueue.length === 0 && this.state === 'text') {
                            checkInterval.destroy()
                            this.state = 'transition'
                            this.textQueue = [`Go, ${next.name}!`]
                            this.showNextText()
                        }
                    }
                })
            })
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PLAYER FAINT — switch or whiteout
    // ═══════════════════════════════════════════════════════════════

    private handlePlayerFaint() {
        const pName = this.activeMon.nickname || this.capitalise(this.activeMon.creatureId)
        this.textQueue.push(`${pName} fainted!`)

        playerState.updateHp(this.activeMon.id, 0)
        const localMon = playerState.team.find(m => m.id === this.activeMon.id)
        if (localMon) localMon.currentHp = 0

        eventBus.emit(GameEvents.POKEMON_FAINT, this.activeMon.id)

        const nextAlive = playerState.team.find(m => m.currentHp > 0 && m.id !== this.activeMon.id)

        if (nextAlive) {
            this.textQueue.push('Choose your next Pokémon!')
            this._faintSwitchPending = true
        } else {
            this.pendingOutcome = 'lost'
            this.textQueue.push('You have no more Pokémon that can fight!', 'You blacked out...')
            eventBus.emit(GameEvents.BATTLE_LOSE)
        }
    }

    private openFaintPartyMenu() {
        this.state = 'party'
        this.partyUI.open(
            playerState.team,
            true,
            (selected) => {
                this.activeMon = { ...selected }
                this.playerHp = selected.currentHp
                this.playerMaxHp = selected.maxHp
                this.playerLevel = selected.level
                this.playerMoves = selected.moves || []
                this.showPlayerSprite()
                this.updatePlayerPanel()
                const name = selected.nickname || this.capitalise(selected.creatureId)
                this.state = 'text'
                this.textQueue = [`Go, ${name}!`]
                this.showNextText()
            },
            () => { this.openFaintPartyMenu() },
            this.activeMon.id,
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // TRANSITION — bring out next opponent
    // ═══════════════════════════════════════════════════════════════

    private bringNextOpponent() {
        this.currentOpp = this.battleData.opponents[this.oppIndex]
        this.oppHp = this.currentOpp.hp
        this.oppMaxHp = this.currentOpp.maxHp
        this.oppLevel = this.currentOpp.level

        this.oppNameText.setText(this.currentOpp.name)
        this.oppLvlText.setText(`Lv${this.oppLevel}`)
        this.updateHpBars()
        this.showOppSprite()

        this.state = 'menu'
        this.showMenu()
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    private updateHpBars() {
        const oppFrac = Math.max(0, this.oppHp / this.oppMaxHp)
        const playerFrac = Math.max(0, this.playerHp / this.playerMaxHp)
        this.oppHpBar.setDisplaySize(176 * oppFrac, 6)
        this.playerHpBar.setDisplaySize(216 * playerFrac, 6)
        this.oppHpBar.setFillStyle(oppFrac > 0.5 ? 0x40c040 : oppFrac > 0.2 ? 0xf8c030 : 0xe04030)
        this.playerHpBar.setFillStyle(playerFrac > 0.5 ? 0x40c040 : playerFrac > 0.2 ? 0xf8c030 : 0xe04030)
        this.oppHpText.setText(`${this.oppHp}/${this.oppMaxHp}`)
        this.playerHpText.setText(`${this.playerHp}/${this.playerMaxHp}`)
    }

    private showText(lines: string[]) {
        this.state = 'text'
        this.textQueue = lines.slice(1)
        this.msgText.setText(lines[0])
    }

    private exitBattle() {
        if (this.state === 'done' && this._exiting) return
        this._exiting = true
        this.state = 'done'

        playerState.updateHp(this.activeMon.id, this.playerHp)

        this.cameras.main.fade(350, 0, 0, 0)
        this.time.delayedCall(400, () => {
            if (this.pendingOutcome === 'lost') {
                this.healAndTeleport()
            } else {
                const resultData = {
                    ...this.battleData.returnData,
                    battleResult: this.pendingOutcome,
                }
                this.scene.start(this.battleData.returnScene, resultData)
            }
        })
    }

    private async healAndTeleport() {
        try {
            await playerState.healAll()
        } catch (e) {
            console.error('[TrainerBattle] healAll failed, healing locally', e)
            playerState.team.forEach(m => { m.currentHp = m.maxHp })
        }
        try {
            const { checkpointManager } = await import('../systems/CheckpointManager')
            const respawn = checkpointManager.getRespawnData()
            if (respawn) {
                this.scene.start(respawn.mapId, {
                    from: 'checkpoint',
                    spawnX: respawn.x,
                    spawnY: respawn.y,
                    encounterCooldown: 3000,
                })
            } else {
                this.scene.start('PokeCenter', { from: 'blackout' })
            }
        } catch (e) {
            console.error('[TrainerBattle] healAndTeleport scene transition failed', e)
            this.scene.start('PokeCenter', { from: 'blackout' })
        }
    }

    private showNextText() {
        if (this.textQueue.length === 0) return
        const next = this.textQueue.shift()!
        if (typeof next === 'string') {
            this.msgText.setText(next)
        } else {
            this.msgText.setText(next.text)
            next.action?.()
        }
    }

    private getTypeColor(type: string): string {
        const colors: Record<string, string> = {
            Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0',
            Grass: '#78c850', Electric: '#f8d030', Ice: '#98d8d8',
            Fighting: '#c03028', Poison: '#a040a0', Ground: '#e0c068',
            Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820',
            Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8',
            Dark: '#705848', Steel: '#b8b8d0', Fairy: '#ee99ac',
        }
        return colors[type] || '#282828'
    }

    private capitalise(s: string) {
        return s.charAt(0).toUpperCase() + s.slice(1)
    }
}
