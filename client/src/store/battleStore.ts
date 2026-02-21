import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoveInfo {
    id: string
    name: string
    type: string
    category: string
    power?: number
    accuracy: number
    pp: number
    description: string
}

export interface CreatureInfo {
    userId: string
    creatureName: string
    creatureId: string
    currentHp: number
    maxHp: number
    moves: MoveInfo[]
    level: number
    status: 'none' | 'burn' | 'paralysis'
    ppLeft?: Record<string, number>
}

export type BattlePhase =
    | 'idle'           // no battle
    | 'incoming'       // received a battle-request
    | 'waiting-accept' // sent request, waiting for opponent to accept
    | 'selecting'      // battle started, choosing a move
    | 'resolving'      // submitted move, waiting for opponent
    | 'ended'          // battle-end received

export interface IncomingChallenge {
    fromUserId: string
    fromUsername: string
}

interface BattleState {
    phase: BattlePhase
    roomId: string | null
    myCreature: CreatureInfo | null
    opponentCreature: CreatureInfo | null
    myUserId: string | null
    battleLog: string[]
    turnNumber: number
    pendingMoveId: string | null
    incomingChallenge: IncomingChallenge | null
    winnerUserId: string | null
    xpAwarded: number
    endReason: string | null

    // Actions
    setMyUserId: (id: string) => void
    setBattleStart: (payload: {
        roomId: string
        player1: CreatureInfo
        player2: CreatureInfo
    }, myUserId: string) => void
    applyUpdate: (payload: {
        log: string[]
        player1: Partial<CreatureInfo>
        player2: Partial<CreatureInfo>
        turnNumber: number
    }) => void
    setPendingMove: (moveId: string) => void
    endBattle: (payload: { winnerId: string | null; xpAwarded: number; reason: string }) => void
    setIncomingChallenge: (challenge: IncomingChallenge | null) => void
    setPhase: (phase: BattlePhase) => void
    reset: () => void
    addLog: (msg: string) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBattleStore = create<BattleState>((set, get) => ({
    phase: 'idle',
    roomId: null,
    myCreature: null,
    opponentCreature: null,
    myUserId: null,
    battleLog: [],
    turnNumber: 0,
    pendingMoveId: null,
    incomingChallenge: null,
    winnerUserId: null,
    xpAwarded: 0,
    endReason: null,

    setMyUserId: (id) => set({ myUserId: id }),

    setBattleStart: (payload, myUserId) => {
        const isP1 = payload.player1.userId === myUserId
        set({
            roomId: payload.roomId,
            myCreature: isP1 ? payload.player1 : payload.player2,
            opponentCreature: isP1 ? payload.player2 : payload.player1,
            phase: 'selecting',
            battleLog: ['⚔️ Battle started! Choose your move!'],
            turnNumber: 0,
            pendingMoveId: null,
            incomingChallenge: null,
        })
    },

    applyUpdate: (payload) => {
        const { myCreature, opponentCreature } = get()
        const isP1 = myCreature?.userId === payload.player1.userId
        const myUpdate = isP1 ? payload.player1 : payload.player2
        const oppUpdate = isP1 ? payload.player2 : payload.player1

        set({
            myCreature: myCreature ? { ...myCreature, ...myUpdate } : null,
            opponentCreature: opponentCreature ? { ...opponentCreature, ...oppUpdate } : null,
            battleLog: [...get().battleLog, ...payload.log],
            turnNumber: payload.turnNumber,
            phase: 'selecting',
            pendingMoveId: null,
        })
    },

    setPendingMove: (moveId) => set({ pendingMoveId: moveId, phase: 'resolving' }),

    endBattle: (payload) =>
        set({
            phase: 'ended',
            winnerUserId: payload.winnerId,
            xpAwarded: payload.xpAwarded,
            endReason: payload.reason,
        }),

    setIncomingChallenge: (challenge) =>
        set({ incomingChallenge: challenge, phase: challenge ? 'incoming' : get().phase }),

    setPhase: (phase) => set({ phase }),

    addLog: (msg) => set({ battleLog: [...get().battleLog, msg] }),

    reset: () =>
        set({
            phase: 'idle',
            roomId: null,
            myCreature: null,
            opponentCreature: null,
            battleLog: [],
            turnNumber: 0,
            pendingMoveId: null,
            incomingChallenge: null,
            winnerUserId: null,
            xpAwarded: 0,
            endReason: null,
        }),
}))
