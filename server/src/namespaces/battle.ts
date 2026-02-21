import { Server, Socket } from 'socket.io'
// Inline type matching socket.io's ExtendedError so we don't depend on internal paths
type ExtendedError = Error & { data?: unknown }
import { v4 as uuidv4 } from 'uuid'
import { verifySocketToken, JwtPayload } from '../middleware/auth'
import {
    createBattleRoom,
    getBattleRoom,
    updateBattleRoom,
    deleteBattleRoom,
    setPendingChallenge,
    getPendingChallenge,
    deletePendingChallenge,
} from '../lib/redis'
import {
    BattleRoom,
    FighterState,
    resolveTurn,
    calcStat,
    calcXpReward,
} from '../engine/battleEngine'
import { CREATURES_MAP, MOVES_MAP } from '../data/creatures'
import prisma from '../lib/prisma'

// ─── Constants ─────────────────────────────────────────────────────────────────
const ACTION_TIMEOUT_MS = 30_000  // 30s to submit a move
const DISCONNECT_GRACE_MS = 15_000 // 15s to reconnect before forfeit

// ─── In-memory socket→user mapping ────────────────────────────────────────────
const socketToUser = new Map<string, JwtPayload>()
const userToSocket = new Map<string, string>()       // userId → socketId
const socketToBattle = new Map<string, string>()     // socketId → roomId
const disconnectTimers = new Map<string, NodeJS.Timeout>() // roomId → timer

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFighterState(
    userId: string,
    socketId: string,
    pc: {
        creatureId: string
        level: number
        currentHp: number
        maxHp: number
        creature: {
            id: string
            name: string
            type1: string
            baseAtk: number
            baseDef: number
            baseSpAtk: number
            baseSpDef: number
            baseSpd: number
            moves: { move: { id: string; pp: number } }[]
        }
    }
): FighterState {
    const def = CREATURES_MAP[pc.creatureId]
    const moveIds = pc.creature.moves.map((m) => m.move.id).slice(0, 4)

    return {
        userId,
        socketId,
        creatureId: pc.creatureId,
        creatureName: pc.creature.name,
        level: pc.level,
        currentHp: pc.currentHp,
        maxHp: pc.maxHp,
        attack: calcStat(pc.creature.baseAtk, pc.level),
        defense: calcStat(pc.creature.baseDef, pc.level),
        spAttack: calcStat(pc.creature.baseSpAtk, pc.level),
        spDefense: calcStat(pc.creature.baseSpDef, pc.level),
        speed: calcStat(pc.creature.baseSpd, pc.level),
        moves: moveIds,
        ppLeft: Object.fromEntries(
            pc.creature.moves.map((m) => [m.move.id, m.move.pp])
        ),
        status: 'none',
        attackMod: 1.0,
        accuracyMod: 1.0,
    }
}

async function getLeadCreature(userId: string) {
    return prisma.playerCreature.findFirst({
        where: { userId, isLead: true },
        include: {
            creature: {
                include: {
                    moves: {
                        include: { move: true },
                        orderBy: { learnLevel: 'asc' },
                        take: 4,
                    },
                },
            },
        },
    })
}

async function endBattle(
    battleNamespace: ReturnType<Server['of']>,
    room: BattleRoom,
    winnerId: string | null,
    reason: 'fainted' | 'forfeit' | 'disconnect' | 'timeout'
) {
    const xp = calcXpReward(
        winnerId === room.player1.userId ? room.player2.level : room.player1.level
    )

    // Persist to DB
    try {
        await prisma.battleResult.create({
            data: {
                player1Id: room.player1.userId,
                player2Id: room.player2.userId,
                winnerId,
                xpAwarded: xp,
                turnsCount: room.turnNumber,
            },
        })

        // Award XP to winner's lead creature
        if (winnerId) {
            const pc = await prisma.playerCreature.findFirst({
                where: { userId: winnerId, isLead: true },
            })
            if (pc) {
                const newXp = pc.xp + xp
                const xpPerLevel = 100
                const levelsGained = Math.floor(newXp / xpPerLevel)
                const remainingXp = newXp % xpPerLevel
                if (levelsGained > 0) {
                    const newLevel = Math.min(100, pc.level + levelsGained)
                    const creatDef = CREATURES_MAP[pc.creatureId]
                    const newMaxHp = creatDef
                        ? calcStat(creatDef.baseHp, newLevel, true)
                        : pc.maxHp
                    await prisma.playerCreature.update({
                        where: { id: pc.id },
                        data: { xp: remainingXp, level: newLevel, maxHp: newMaxHp },
                    })
                } else {
                    await prisma.playerCreature.update({
                        where: { id: pc.id },
                        data: { xp: newXp },
                    })
                }
            }
        }

        // Persist loser's HP
        const loserId = winnerId === room.player1.userId ? room.player2.userId : room.player1.userId
        const loserFighter = winnerId === room.player1.userId ? room.player2 : room.player1
        if (loserId) {
            const loserPc = await prisma.playerCreature.findFirst({
                where: { userId: loserId, isLead: true },
            })
            if (loserPc) {
                await prisma.playerCreature.update({
                    where: { id: loserPc.id },
                    data: { currentHp: loserFighter.currentHp },
                })
            }
        }
    } catch (err) {
        console.error('[endBattle] DB error:', err)
    }

    // Emit to both players
    const payload = { winnerId, xpAwarded: xp, reason, turnCount: room.turnNumber }
    const p1Socket = battleNamespace.sockets.get(room.player1.socketId)
    const p2Socket = battleNamespace.sockets.get(room.player2.socketId)
    p1Socket?.emit('battle-end', payload)
    p2Socket?.emit('battle-end', payload)

    // Cleanup
    await deleteBattleRoom(room.id)
    socketToBattle.delete(room.player1.socketId)
    socketToBattle.delete(room.player2.socketId)
    clearTimeout(disconnectTimers.get(room.id))
    disconnectTimers.delete(room.id)
}

// ─── Action timeout helper ─────────────────────────────────────────────────────

function scheduleActionTimeout(
    battleNamespace: ReturnType<Server['of']>,
    room: BattleRoom
) {
    // Clear any existing timer for this room
    clearTimeout(disconnectTimers.get(`action:${room.id}`))

    const t = setTimeout(async () => {
        const latest = await getBattleRoom<BattleRoom>(room.id)
        if (!latest) return

        // Determine who hasn't acted
        const p1Acted = !!latest.pendingActions.player1
        const p2Acted = !!latest.pendingActions.player2

        if (p1Acted && !p2Acted) {
            await endBattle(battleNamespace, latest, latest.player1.userId, 'timeout')
        } else if (!p1Acted && p2Acted) {
            await endBattle(battleNamespace, latest, latest.player2.userId, 'timeout')
        } else if (!p1Acted && !p2Acted) {
            // Both idle – no winner
            await endBattle(battleNamespace, latest, null, 'timeout')
        }
    }, ACTION_TIMEOUT_MS)

    disconnectTimers.set(`action:${room.id}`, t)
}

// ─── Namespace registration ────────────────────────────────────────────────────

export function registerBattleNamespace(io: Server) {
    const battleNS = io.of('/battle')

    // Auth middleware
    battleNS.use((socket: Socket, next: (err?: ExtendedError) => void) => {
        const token = socket.handshake.auth?.token as string | undefined
        if (!token) return next(new Error('Authentication required'))
        try {
            const user = verifySocketToken(token)
            socketToUser.set(socket.id, user)
            userToSocket.set(user.userId, socket.id)
            next()
        } catch {
            next(new Error('Invalid token'))
        }
    })

    battleNS.on('connection', (socket: Socket) => {
        const user = socketToUser.get(socket.id)!
        console.log(`[battle] ${user.username} connected (${socket.id})`)

        // ── battle-request ──────────────────────────────────────────────────────
        socket.on('battle-request', async ({ targetUserId }: { targetUserId: string }) => {
            const targetSocketId = userToSocket.get(targetUserId)
            if (!targetSocketId) {
                return socket.emit('battle-error', { message: 'Player is not online' })
            }
            if (socketToBattle.has(socket.id)) {
                return socket.emit('battle-error', { message: 'You are already in a battle' })
            }
            if (socketToBattle.has(targetSocketId)) {
                return socket.emit('battle-error', { message: 'That player is already in a battle' })
            }

            await setPendingChallenge(user.userId, targetUserId)

            const targetSocket = battleNS.sockets.get(targetSocketId)
            targetSocket?.emit('battle-incoming', {
                fromUserId: user.userId,
                fromUsername: user.username,
            })

            socket.emit('battle-request-sent', { targetUserId })
        })

        // ── battle-accept ───────────────────────────────────────────────────────
        socket.on('battle-accept', async ({ fromUserId }: { fromUserId: string }) => {
            const challenge = await getPendingChallenge(fromUserId, user.userId)
            if (!challenge) {
                return socket.emit('battle-error', { message: 'Challenge expired or not found' })
            }

            await deletePendingChallenge(fromUserId, user.userId)

            const fromSocketId = userToSocket.get(fromUserId)
            if (!fromSocketId) {
                return socket.emit('battle-error', { message: 'Challenger disconnected' })
            }

            // Load both lead creatures
            const [pc1, pc2] = await Promise.all([
                getLeadCreature(fromUserId),
                getLeadCreature(user.userId),
            ])
            if (!pc1 || !pc2) {
                return socket.emit('battle-error', { message: 'Could not load creature data' })
            }

            // Map Prisma result to the shape buildFighterState expects
            function toFighterInput(pc: NonNullable<typeof pc1>) {
                return {
                    creatureId: pc.creatureId,
                    level: pc.level,
                    currentHp: pc.currentHp,
                    maxHp: pc.maxHp,
                    creature: {
                        id: pc.creature.id,
                        name: pc.creature.name,
                        type1: pc.creature.type1,
                        baseAtk: pc.creature.baseAtk,
                        baseDef: pc.creature.baseDef,
                        baseSpAtk: pc.creature.baseSpAtk,
                        baseSpDef: pc.creature.baseSpDef,
                        baseSpd: pc.creature.baseSpd,
                        moves: pc.creature.moves.map((m: { move: { id: string; pp: number } }) => ({ move: { id: m.move.id, pp: m.move.pp } })),
                    },
                }
            }

            const roomId = uuidv4()
            const p1State = buildFighterState(fromUserId, fromSocketId, toFighterInput(pc1))
            const p2State = buildFighterState(user.userId, socket.id, toFighterInput(pc2))

            const room: BattleRoom = {
                id: roomId,
                player1: p1State,
                player2: p2State,
                turn: p1State.speed >= p2State.speed ? 'player1' : 'player2',
                pendingActions: {},
                turnNumber: 0,
                startedAt: Date.now(),
            }

            await createBattleRoom(roomId, room)

            socketToBattle.set(fromSocketId, roomId)
            socketToBattle.set(socket.id, roomId)

            const battleStartPayload = {
                roomId,
                player1: {
                    userId: p1State.userId,
                    creatureName: p1State.creatureName,
                    creatureId: p1State.creatureId,
                    currentHp: p1State.currentHp,
                    maxHp: p1State.maxHp,
                    moves: p1State.moves.map((moveId) => {
                        const { id: _id, ...moveData } = MOVES_MAP[moveId] ?? { id: moveId }
                        return { id: moveId, ...moveData }
                    }),
                    level: p1State.level,
                    status: p1State.status,
                },
                player2: {
                    userId: p2State.userId,
                    creatureName: p2State.creatureName,
                    creatureId: p2State.creatureId,
                    currentHp: p2State.currentHp,
                    maxHp: p2State.maxHp,
                    moves: p2State.moves.map((moveId) => {
                        const { id: _id, ...moveData } = MOVES_MAP[moveId] ?? { id: moveId }
                        return { id: moveId, ...moveData }
                    }),
                    level: p2State.level,
                    status: p2State.status,
                },
            }

            const fromSocket = battleNS.sockets.get(fromSocketId)
            fromSocket?.emit('battle-start', battleStartPayload)
            socket.emit('battle-start', battleStartPayload)

            scheduleActionTimeout(battleNS, room)
        })

        // ── battle-decline ─────────────────────────────────────────────────────
        socket.on('battle-decline', async ({ fromUserId }: { fromUserId: string }) => {
            await deletePendingChallenge(fromUserId, user.userId)
            const fromSocketId = userToSocket.get(fromUserId)
            const fromSocket = fromSocketId ? battleNS.sockets.get(fromSocketId) : undefined
            fromSocket?.emit('battle-declined', { byUsername: user.username })
        })

        // ── battle-action ──────────────────────────────────────────────────────
        socket.on('battle-action', async ({ moveId }: { moveId: string }) => {
            const roomId = socketToBattle.get(socket.id)
            if (!roomId) {
                return socket.emit('battle-error', { message: 'Not in a battle' })
            }

            const room = await getBattleRoom<BattleRoom>(roomId)
            if (!room) {
                return socket.emit('battle-error', { message: 'Battle room not found' })
            }

            const isP1 = room.player1.userId === user.userId
            const fighter = isP1 ? room.player1 : room.player2

            // Validate move
            if (!fighter.moves.includes(moveId)) {
                return socket.emit('battle-error', { message: 'Invalid move' })
            }
            if ((fighter.ppLeft[moveId] ?? 0) <= 0) {
                return socket.emit('battle-error', { message: 'No PP left for that move' })
            }
            if (isP1 && room.pendingActions.player1) {
                return socket.emit('battle-error', { message: 'Already submitted action this turn' })
            }
            if (!isP1 && room.pendingActions.player2) {
                return socket.emit('battle-error', { message: 'Already submitted action this turn' })
            }

            // Record action
            const updatedRoom: BattleRoom = {
                ...room,
                pendingActions: {
                    ...room.pendingActions,
                    ...(isP1 ? { player1: moveId } : { player2: moveId }),
                },
            }

            // Notify the acting player that their action was received
            socket.emit('battle-action-ack', { moveId })

            // If both players have submitted, resolve the turn
            if (updatedRoom.pendingActions.player1 && updatedRoom.pendingActions.player2) {
                clearTimeout(disconnectTimers.get(`action:${roomId}`))

                const p1Def = CREATURES_MAP[updatedRoom.player1.creatureId]
                const p2Def = CREATURES_MAP[updatedRoom.player2.creatureId]

                const result = resolveTurn(
                    updatedRoom,
                    updatedRoom.pendingActions.player1,
                    updatedRoom.pendingActions.player2,
                    p1Def?.type1 ?? 'Normal',
                    p1Def?.type2,
                    p2Def?.type1 ?? 'Normal',
                    p2Def?.type2
                )

                const updatePayload = {
                    log: result.log,
                    player1: {
                        currentHp: result.updatedRoom.player1.currentHp,
                        maxHp: result.updatedRoom.player1.maxHp,
                        status: result.updatedRoom.player1.status,
                        ppLeft: result.updatedRoom.player1.ppLeft,
                    },
                    player2: {
                        currentHp: result.updatedRoom.player2.currentHp,
                        maxHp: result.updatedRoom.player2.maxHp,
                        status: result.updatedRoom.player2.status,
                        ppLeft: result.updatedRoom.player2.ppLeft,
                    },
                    turnNumber: result.updatedRoom.turnNumber,
                }

                const p1Sock = battleNS.sockets.get(updatedRoom.player1.socketId)
                const p2Sock = battleNS.sockets.get(updatedRoom.player2.socketId)
                p1Sock?.emit('battle-update', updatePayload)
                p2Sock?.emit('battle-update', updatePayload)

                if (result.isOver) {
                    await endBattle(battleNS, result.updatedRoom, result.winnerId, 'fainted')
                } else {
                    await updateBattleRoom(roomId, result.updatedRoom)
                    scheduleActionTimeout(battleNS, result.updatedRoom)
                }
            } else {
                await updateBattleRoom(roomId, updatedRoom)
                // Notify opponent that the other player has chosen
                const opponentSocketId = isP1 ? updatedRoom.player2.socketId : updatedRoom.player1.socketId
                const opponentSocket = battleNS.sockets.get(opponentSocketId)
                opponentSocket?.emit('opponent-action-ready')
            }
        })

        // ── forfeit ────────────────────────────────────────────────────────────
        socket.on('forfeit', async () => {
            const roomId = socketToBattle.get(socket.id)
            if (!roomId) return

            const room = await getBattleRoom<BattleRoom>(roomId)
            if (!room) return

            const winnerId =
                room.player1.userId === user.userId ? room.player2.userId : room.player1.userId
            await endBattle(battleNS, room, winnerId, 'forfeit')
        })

        // ── disconnect ─────────────────────────────────────────────────────────
        socket.on('disconnect', async () => {
            console.log(`[battle] ${user.username} disconnected`)

            userToSocket.delete(user.userId)
            socketToUser.delete(socket.id)

            const roomId = socketToBattle.get(socket.id)
            if (!roomId) return

            const room = await getBattleRoom<BattleRoom>(roomId)
            if (!room) return

            // Grace period before forfeiting
            const t = setTimeout(async () => {
                const latest = await getBattleRoom<BattleRoom>(roomId)
                if (!latest) return
                const winnerId =
                    latest.player1.userId === user.userId ? latest.player2.userId : latest.player1.userId
                await endBattle(battleNS, latest, winnerId, 'disconnect')
            }, DISCONNECT_GRACE_MS)

            disconnectTimers.set(roomId, t)

            // Notify opponent
            const opponentSocketId =
                room.player1.userId === user.userId ? room.player2.socketId : room.player1.socketId
            const opponentSocket = battleNS.sockets.get(opponentSocketId)
            opponentSocket?.emit('opponent-disconnected', {
                username: user.username,
                graceMs: DISCONNECT_GRACE_MS,
            })
        })
    })

    return battleNS
}
