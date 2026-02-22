import Phaser from 'phaser'
import { useAuthStore } from '../../store/authStore'
import playerState, { PartyMon } from '../systems/PlayerState'
import { PartyUI } from '../systems/PartyUI'
import { NotificationUI } from '../systems/NotificationUI'
import eventBus, { GameEvents } from '../systems/GameEventBus'

// ─────────────────────────────────────────────────────────────────────────────
// WildEncounterScene — FRLG-style wild Pokémon battle
//
// Features: party switching, XP/money rewards, loss → PokeCenter teleport,
// lead Pokémon usage, auto-switch on faint, legendary battle rules.
// ─────────────────────────────────────────────────────────────────────────────

const W = 800, H = 576
const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'

interface WildData {
    creatureId: string
    creatureName: string
    creatureType: string
    level: number
    hp: number
    maxHp: number
    returnScene: string
    returnData?: Record<string, unknown>
    isLegendary?: boolean
}

export default class WildEncounterScene extends Phaser.Scene {
    private wildData!: WildData
    private activeMon!: PartyMon

    // UI state
    private menuIndex    = 0
    private fightIndex   = 0
    private state: 'menu' | 'fight' | 'text' | 'party' | 'done' = 'menu'
    private textQueue: (string | { text: string; action?: () => void })[] = []

    // Display objects
    private wildHpBar!:   Phaser.GameObjects.Rectangle
    private playerHpBar!: Phaser.GameObjects.Rectangle
    private wildHpText!:  Phaser.GameObjects.Text
    private playerHpText!: Phaser.GameObjects.Text
    private playerNameText!: Phaser.GameObjects.Text
    private playerLvlText!:  Phaser.GameObjects.Text
    private msgText!:     Phaser.GameObjects.Text
    private menuTexts:    Phaser.GameObjects.Text[] = []
    private cursor!:      Phaser.GameObjects.Text
    private playerSpriteImg?: Phaser.GameObjects.Image

    // Keys
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private spaceKey!: Phaser.Input.Keyboard.Key
    private escKey!:   Phaser.Input.Keyboard.Key

    // creature stats
    private wildHp    = 0
    private wildMaxHp = 0
    private playerHp  = 0
    private playerMaxHp = 0
    private wildLevel   = 5
    private playerLevel = 5

    private playerMoves: { id: string; name: string; type: string; power: number }[] = []

    private pendingOutcome: null | 'won' | 'caught' | 'lost' | 'escaped' = null

    // Faint-switch flow (replaces timer-based polling)
    private _faintSwitchPending: 'party' | 'auto' | null = null
    private _faintAutoMon: PartyMon | null = null

    // Poké Ball inventory
    private pokeBallCount  = 0
    private greatBallCount = 0

    private uiReady = false
    private _exiting = false

    // Party UI + Notifications
    private partyUI!: PartyUI
    private notifyUI!: NotificationUI

    constructor() { super({ key: 'WildEncounter' }) }

    create(data: WildData) {
        this.wildData = data
        this.state = 'menu'
        this.menuIndex = 0
        this.fightIndex = 0
        this.pendingOutcome = null
        this._faintSwitchPending = null
        this._faintAutoMon = null
        this.pokeBallCount = 0
        this.greatBallCount = 0
        this.uiReady = false
        this._exiting = false
        this.menuTexts = []
        this.textQueue = []

        this.cursors  = this.input.keyboard!.createCursorKeys()
        this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.escKey   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

        this.wildHp = data.hp
        this.wildMaxHp = data.maxHp
        this.wildLevel = data.level

        this.partyUI = new PartyUI(this)
        this.notifyUI = new NotificationUI(this)

        this.loadPlayerData()
    }

    private async loadPlayerData() {
        await playerState.load()
        const token = useAuthStore.getState().token

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

        try {
            const invRes = await fetch(`${API}/inventory`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (invRes.ok) {
                const invJson = await invRes.json()
                const items: { itemName: string; quantity: number }[] = invJson.items || []
                this.pokeBallCount = items.find(i => i.itemName === 'poke_ball')?.quantity ?? 0
                this.greatBallCount = items.find(i => i.itemName === 'great_ball')?.quantity ?? 0
            }
        } catch { /* keep 0 */ }

        this.buildUI()
    }

    private buildUI() {
        this.cameras.main.setBackgroundColor('#000000')
        this.cameras.main.flash(400, 255, 255, 255)

        const bg = this.add.graphics()
        if (this.wildData.isLegendary) {
            bg.fillStyle(0x283848).fillRect(0, 0, W, H / 2)
            bg.fillStyle(0x1a2838).fillRect(0, 0, W, H / 4)
            bg.fillStyle(0x182028).fillRect(0, H / 2 - 40, W, H / 2 + 40)
            bg.fillStyle(0x283848).fillRect(0, H / 2 - 20, W, 20)
            bg.fillStyle(0x101820, 0.5)
            bg.fillEllipse(580, 220, 200, 40)
            bg.fillEllipse(220, 380, 200, 40)
        } else {
            bg.fillStyle(0x88c8e8).fillRect(0, 0, W, H / 2)
            bg.fillStyle(0x98d0f0).fillRect(0, 0, W, H / 4)
            bg.fillStyle(0x58a028).fillRect(0, H / 2 - 40, W, H / 2 + 40)
            bg.fillStyle(0x68b838).fillRect(0, H / 2 - 20, W, 20)
            bg.fillStyle(0x489020, 0.5)
            bg.fillEllipse(580, 220, 200, 40)
            bg.fillEllipse(220, 380, 200, 40)
        }

        // Wild creature (front, right side)
        const wildKey = `creature_${this.wildData.creatureId}_front`
        if (this.textures.exists(wildKey)) {
            this.add.image(580, 170, wildKey).setDisplaySize(96, 96).setDepth(2)
        } else {
            const g = this.add.graphics().setDepth(2)
            g.fillStyle(0xf08030).fillCircle(580, 170, 40)
        }

        // Player creature (back, left side)
        this.showPlayerSprite()

        // Wild HP panel (top left)
        const wpx = 40, wpy = 30
        const wpanel = this.add.graphics().setDepth(3)
        wpanel.fillStyle(0xf8f0d8).fillRoundedRect(wpx, wpy, 280, 68, 8)
        wpanel.lineStyle(2, 0x484040).strokeRoundedRect(wpx, wpy, 280, 68, 8)

        this.add.text(wpx + 14, wpy + 8, this.wildData.creatureName, {
            fontSize: '14px', color: '#282828', fontFamily: 'monospace', fontStyle: 'bold',
        }).setDepth(4)
        this.add.text(wpx + 210, wpy + 8, `Lv${this.wildLevel}`, {
            fontSize: '12px', color: '#585858', fontFamily: 'monospace',
        }).setDepth(4)

        this.add.rectangle(wpx + 80, wpy + 38, 180, 10, 0x484040).setOrigin(0, 0.5).setDepth(4)
        this.wildHpBar = this.add.rectangle(wpx + 82, wpy + 38, 176, 6, 0x40c040).setOrigin(0, 0.5).setDepth(5)
        this.add.text(wpx + 14, wpy + 33, 'HP', {
            fontSize: '11px', color: '#f8a030', fontFamily: 'monospace', fontStyle: 'bold',
        }).setDepth(5)
        this.wildHpText = this.add.text(wpx + 180, wpy + 52, `${this.wildHp}/${this.wildMaxHp}`, {
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

        this.msgText = this.add.text(30, by + 20, `A wild ${this.wildData.creatureName} appeared!`, {
            fontSize: '16px', color: '#282828', fontFamily: 'monospace',
            wordWrap: { width: 440 },
        }).setDepth(7)

        // Menu options
        const mx = 500, my = by + 14
        const menuBox = this.add.graphics().setDepth(7)
        menuBox.fillStyle(0xf8f8f0).fillRoundedRect(mx - 10, my - 6, 290, 118, 6)
        menuBox.lineStyle(2, 0x484040).strokeRoundedRect(mx - 10, my - 6, 290, 118, 6)

        const totalBalls = this.pokeBallCount + this.greatBallCount
        const labels = this.wildData.isLegendary
            ? ['FIGHT', `BALL×${totalBalls}`, 'POKéMON', '---']
            : ['FIGHT', `BALL×${totalBalls}`, 'POKéMON', 'RUN']
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

        if (this.wildData.isLegendary) {
            this.add.text(W - 16, 8, '★ LEGENDARY', {
                fontSize: '10px', color: '#f8d030', fontFamily: 'monospace',
                backgroundColor: '#00000088', padding: { x: 6, y: 2 },
            }).setOrigin(1, 0).setDepth(10)
        }

        this.updateCursor()
        this.uiReady = true
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

    private updateCursor() {
        if (this.state === 'fight') {
            const mx = 500, my = H - 130 + 14
            const col = this.fightIndex % 2
            const row = Math.floor(this.fightIndex / 2)
            this.cursor.setPosition(mx + 12 + col * 140, my + 8 + row * 44)
        } else {
            const mx = 500, my = H - 130 + 14
            const col = this.menuIndex % 2
            const row = Math.floor(this.menuIndex / 2)
            this.cursor.setPosition(mx + 12 + col * 140, my + 8 + row * 44)
        }
    }

    update() {
        if (!this.uiReady || this.state === 'done') return

        if (this.partyUI.active()) {
            this.partyUI.update()
            return
        }

        if (this.state === 'text') {
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                if (this.textQueue.length > 0) {
                    this.showNextText()
                } else if (this._faintSwitchPending === 'party') {
                    this._faintSwitchPending = null
                    this.openFaintPartyMenu()
                } else if (this._faintSwitchPending === 'auto' && this._faintAutoMon) {
                    this._faintSwitchPending = null
                    const mon = this._faintAutoMon!
                    this._faintAutoMon = null
                    this.activeMon = { ...mon }
                    this.playerHp = mon.currentHp
                    this.playerMaxHp = mon.maxHp
                    this.playerLevel = mon.level
                    this.playerMoves = mon.moves || []
                    this.showPlayerSprite()
                    this.updatePlayerPanel()
                    this.state = 'menu'
                    this.showMenu()
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

        // Main menu navigation
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left))  this.menuIndex = this.menuIndex % 2 === 0 ? this.menuIndex + 1 : this.menuIndex - 1
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.menuIndex = this.menuIndex % 2 === 0 ? this.menuIndex + 1 : this.menuIndex - 1
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up))    this.menuIndex = this.menuIndex >= 2 ? this.menuIndex - 2 : this.menuIndex
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down))  this.menuIndex = this.menuIndex < 2 ? this.menuIndex + 2 : this.menuIndex
        this.menuIndex = Phaser.Math.Clamp(this.menuIndex, 0, 3)
        this.updateCursor()

        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.selectMenuOption()
        }
    }

    private selectMenuOption() {
        switch (this.menuIndex) {
            case 0: this.openFightMenu(); break
            case 1: this.throwPokeball(); break
            case 2: this.openPartyMenu(); break
            case 3:
                if (this.wildData.isLegendary) {
                    this.showText(["You can't run from a legendary battle!"])
                } else {
                    this.runAway()
                }
                break
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PARTY MENU — Switch Pokémon
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
        const wildDmg = Math.max(1, Math.floor(10 + this.wildLevel * 1.5))
        const wildMoveName = this.getWildMoveName()
        this.textQueue.push({
            text: `Wild ${this.wildData.creatureName} used ${wildMoveName}!`,
            action: () => {
                this.playerHp = Math.max(0, this.playerHp - wildDmg)
                this.updateHpBars()
                if (this.playerHp <= 0) {
                    this.handlePlayerFaint()
                }
            },
        })
        this.textQueue.push(`${pName} took ${wildDmg} damage!`)

        this.showNextText()
    }

    // ═══════════════════════════════════════════════════════════════
    // FIGHT submenu
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
        const moves = this.playerMoves.length > 0 ? this.playerMoves : [{ id: 'tackle', name: 'Tackle', type: 'Normal', power: 40 }]
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

    private executeAttack(move: { id: string; name: string; type: string; power: number }) {
        this.state = 'text'
        const pName = this.activeMon.nickname || this.capitalise(this.activeMon.creatureId)
        const wildMoveName = this.getWildMoveName()

        // --- Player attack ---
        if (move.power === 0) {
            this.textQueue = [`${pName} used ${move.name}!`, `${this.wildData.creatureName}'s stats fell!`]
        } else {
            const baseDmg = Math.floor(((2 * this.playerLevel / 5 + 2) * move.power * 1.0) / 50 + 2)
            const dmg = Math.max(1, Math.floor(baseDmg * (0.85 + Math.random() * 0.15)))

            this.wildHp = Math.max(0, this.wildHp - dmg)
            this.updateHpBars()

            if (this.wildHp <= 0) {
                this.pendingOutcome = 'won'
                this.textQueue = [
                    `${pName} used ${move.name}!`,
                    `It dealt ${dmg} damage!`,
                    `Wild ${this.wildData.creatureName} fainted!`,
                ]
                this.showNextText()
                this.handleBattleWin()
                return
            }

            this.textQueue = [
                `${pName} used ${move.name}!`,
                `It dealt ${dmg} damage!`,
            ]
        }

        // --- Wild creature attacks back (damage deferred until text shown) ---
        const wildBaseDmg = Math.floor(((2 * this.wildLevel / 5 + 2) * 40 * 1.0) / 50 + 2)
        const wildDmg = Math.max(1, Math.floor(wildBaseDmg * (0.85 + Math.random() * 0.15)))

        this.textQueue.push({
            text: `Wild ${this.wildData.creatureName} used ${wildMoveName}!`,
            action: () => {
                this.playerHp = Math.max(0, this.playerHp - wildDmg)
                this.updateHpBars()
                if (this.playerHp <= 0) {
                    this.handlePlayerFaint()
                }
            },
        })
        this.textQueue.push(`${pName} took ${wildDmg} damage!`)

        this.showNextText()
    }

    // ═══════════════════════════════════════════════════════════════
    // PLAYER FAINT — auto-switch or whiteout
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
            if (this.wildData.isLegendary) {
                // Auto-switch in legendary battles
                this.textQueue.push(`Go, ${nextAlive.nickname || this.capitalise(nextAlive.creatureId)}!`)
                this._faintSwitchPending = 'auto'
                this._faintAutoMon = nextAlive
            } else {
                this.textQueue.push('Choose your next Pokémon!')
                this._faintSwitchPending = 'party'
            }
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
                this.showText([`Go, ${name}!`])
            },
            () => { this.openFaintPartyMenu() },
            this.activeMon.id,
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // BATTLE WIN — Award XP + money
    // ═══════════════════════════════════════════════════════════════

    private async handleBattleWin() {
        eventBus.emit(GameEvents.BATTLE_WIN, { enemyLevel: this.wildLevel })
        playerState.updateHp(this.activeMon.id, this.playerHp)

        const reward = await playerState.awardBattleReward(this.activeMon.id, this.wildLevel)
        if (reward) {
            this.textQueue.push(`+${reward.xpGain} XP!`)
            this.textQueue.push(`+${reward.moneyReward}₽ earned!`)
            if (reward.leveledUp) {
                const pName = this.activeMon.nickname || this.capitalise(this.activeMon.creatureId)
                this.textQueue.push(`${pName} grew to Lv${reward.newLevel}!`)
                this.notifyUI.showLevelUp(pName, reward.newLevel)
            }
            this.notifyUI.showMoney(reward.moneyReward)
            this.playerLevel = reward.newLevel
            this.playerMaxHp = reward.newMaxHp
            this.updatePlayerPanel()
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // POKéBALL — Catch attempt
    // ═══════════════════════════════════════════════════════════════

    private async throwPokeball() {
        const totalBalls = this.pokeBallCount + this.greatBallCount
        if (totalBalls <= 0) {
            this.showText(["You don't have any Poké Balls!", 'Buy some at the Poké Mart in Viridian City.'])
            return
        }

        if (playerState.team.length >= 6) {
            this.showText(["Your party is full! Max 6 Pokémon."])
            return
        }

        this.state = 'text'

        let ballName = 'Poké Ball'
        let ballType = 'poke_ball'
        let catchBonus = 0

        if (this.pokeBallCount > 0) {
            this.pokeBallCount--
        } else {
            this.greatBallCount--
            ballType = 'great_ball'
            ballName = 'Great Ball'
            catchBonus = 0.15
        }

        const token = useAuthStore.getState().token
        try {
            await fetch(`${API}/inventory/use`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ itemId: ballType }),
            })
        } catch { /* silent */ }

        let hpPercent = this.wildHp / this.wildMaxHp
        let catchChance = 0.3 + (1 - hpPercent) * 0.5 + catchBonus
        if (this.wildLevel > this.playerLevel + 5) catchChance *= 0.5
        if (this.wildData.isLegendary) catchChance *= 0.3

        const shakes = Math.floor(Math.random() * 4)
        const caught = Math.random() < catchChance

        const msgs: string[] = [`You threw a ${ballName}!`]
        for (let i = 0; i < Math.min(shakes, 3); i++) msgs.push('...')

        if (caught) {
            this.pendingOutcome = 'caught'
            msgs.push(`Gotcha! ${this.wildData.creatureName} was caught!`)

            eventBus.emit(GameEvents.POKEMON_CAUGHT, { creatureId: this.wildData.creatureId })

            try {
                await fetch(`${API}/starter/catch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ creatureId: this.wildData.creatureId, level: this.wildData.level }),
                })
            } catch { /* silent */ }

            const reward = await playerState.awardBattleReward(this.activeMon.id, this.wildLevel, true)
            if (reward) {
                msgs.push(`+${reward.xpGain} XP!`, `+${reward.moneyReward}₽ earned!`)
                if (reward.leveledUp) {
                    const pName = this.activeMon.nickname || this.capitalise(this.activeMon.creatureId)
                    msgs.push(`${pName} grew to Lv${reward.newLevel}!`)
                }
                this.notifyUI.showMoney(reward.moneyReward)
            }

            playerState.updateHp(this.activeMon.id, this.playerHp)
            this.textQueue = msgs
            this.showNextText()
        } else {
            msgs.push('Oh no! It broke free!')
            this.textQueue = msgs
            this.showNextText()

            const wildDmg = Math.max(1, Math.floor(10 + this.wildLevel * 1.5))
            const wildMoveName = this.getWildMoveName()
            this.textQueue.push({
                text: `Wild ${this.wildData.creatureName} used ${wildMoveName}!`,
                action: () => {
                    this.playerHp = Math.max(0, this.playerHp - wildDmg)
                    this.updateHpBars()
                    if (this.playerHp <= 0) {
                        this.handlePlayerFaint()
                    }
                },
            })
            this.textQueue.push(`Took ${wildDmg} damage!`)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RUN
    // ═══════════════════════════════════════════════════════════════

    private runAway() {
        this.state = 'text'
        const escaped = Math.random() < 0.75
        if (escaped) {
            this.pendingOutcome = 'escaped'
            playerState.updateHp(this.activeMon.id, this.playerHp)
            this.textQueue = ['Got away safely!']
            this.showNextText()
        } else {
            const wildDmg = Math.max(1, Math.floor(8 + this.wildLevel))
            const wildMoveName = this.getWildMoveName()
            this.textQueue = ["Can't escape!"]
            this.textQueue.push({
                text: `Wild ${this.wildData.creatureName} used ${wildMoveName}!`,
                action: () => {
                    this.playerHp = Math.max(0, this.playerHp - wildDmg)
                    this.updateHpBars()
                    if (this.playerHp <= 0) {
                        this.handlePlayerFaint()
                    }
                },
            })
            this.textQueue.push(`Took ${wildDmg} damage!`)
            this.showNextText()
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════

    private updateHpBars() {
        const wildFrac = Math.max(0, this.wildHp / this.wildMaxHp)
        const playerFrac = Math.max(0, this.playerHp / this.playerMaxHp)
        this.wildHpBar.setDisplaySize(176 * wildFrac, 6)
        this.playerHpBar.setDisplaySize(216 * playerFrac, 6)
        this.wildHpBar.setFillStyle(wildFrac > 0.5 ? 0x40c040 : wildFrac > 0.2 ? 0xf8c030 : 0xe04030)
        this.playerHpBar.setFillStyle(playerFrac > 0.5 ? 0x40c040 : playerFrac > 0.2 ? 0xf8c030 : 0xe04030)
        this.wildHpText.setText(`${this.wildHp}/${this.wildMaxHp}`)
        this.playerHpText.setText(`${this.playerHp}/${this.playerMaxHp}`)
    }

    private showMenu() {
        this.menuTexts.forEach(t => t.destroy())
        this.menuTexts = []
        const totalBalls = this.pokeBallCount + this.greatBallCount
        const labels = this.wildData.isLegendary
            ? ['FIGHT', `BALL×${totalBalls}`, 'POKéMON', '---']
            : ['FIGHT', `BALL×${totalBalls}`, 'POKéMON', 'RUN']
        const mx = 500, my = H - 130 + 14
        this.menuTexts = labels.map((lbl, i) => {
            const col = i % 2
            const row = Math.floor(i / 2)
            return this.add.text(mx + 30 + col * 140, my + 8 + row * 44, lbl, {
                fontSize: '15px', color: '#282828', fontFamily: 'monospace', fontStyle: 'bold',
            }).setDepth(8)
        })
        this.msgText.setText('What will you do?')
        this.updateCursor()
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
                const rd: Record<string, unknown> = { ...(this.wildData.returnData ?? {}) }
                if (this.pendingOutcome === 'caught')  rd.kadsCaught = true
                if (this.pendingOutcome === 'won')     rd.kadsDefeated = true
                rd.wildOutcome = this.pendingOutcome
                this.scene.start(this.wildData.returnScene, rd)
            }
        })
    }

    private async healAndTeleport() {
        try {
            await playerState.healAll()
        } catch (e) {
            console.error('[WildEncounter] healAll failed, healing locally', e)
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
            console.error('[WildEncounter] healAndTeleport scene transition failed', e)
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

    private getWildMoveName(): string {
        const typeMap: Record<string, string> = {
            Normal: 'Tackle', Fire: 'Ember', Water: 'Water Gun',
            Grass: 'Vine Whip', Electric: 'Thunder Shock',
            Ice: 'Ice Shard', Fighting: 'Low Kick',
            Poison: 'Poison Sting', Ground: 'Mud Slap',
            Flying: 'Gust', Psychic: 'Confusion',
            Bug: 'Bug Bite', Rock: 'Rock Throw',
            Ghost: 'Lick', Dragon: 'Dragon Rage',
            Dark: 'Bite', Steel: 'Metal Claw',
            Fairy: 'Fairy Wind',
        }
        return typeMap[this.wildData.creatureType] || 'Tackle'
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
