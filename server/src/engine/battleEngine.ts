import { MOVES_MAP } from '../data/creatures'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusEffect = 'burn' | 'paralysis' | 'none'

export interface FighterState {
    userId: string
    socketId: string
    creatureId: string
    creatureName: string
    level: number
    currentHp: number
    maxHp: number
    attack: number
    defense: number
    spAttack: number
    spDefense: number
    speed: number
    moves: string[] // move ids
    ppLeft: Record<string, number> // moveId -> pp remaining
    status: StatusEffect
    attackMod: number  // multiplier, starts at 1.0
    accuracyMod: number // multiplier, starts at 1.0
}

export interface BattleRoom {
    id: string
    player1: FighterState
    player2: FighterState
    turn: 'player1' | 'player2' // whose turn it is to act first
    pendingActions: {
        player1?: string // move id
        player2?: string // move id
    }
    turnNumber: number
    startedAt: number
    actionDeadline?: number // unix ms for timeout
}

export interface TurnResult {
    log: string[]
    player1HpDelta: number
    player2HpDelta: number
    updatedRoom: BattleRoom
    isOver: boolean
    winnerId: string | null // userId
}

// ─── Type effectiveness chart ──────────────────────────────────────────────────

const TYPE_CHART: Record<string, Record<string, number>> = {
    Fire: { Grass: 2, Water: 0.5, Fire: 0.5, Electric: 1, Normal: 1, Ground: 1 },
    Water: { Fire: 2, Grass: 0.5, Water: 0.5, Electric: 1, Normal: 1, Ground: 2 },
    Grass: { Water: 2, Fire: 0.5, Grass: 0.5, Electric: 1, Normal: 1, Ground: 1 },
    Electric: { Water: 2, Grass: 0.5, Electric: 0.5, Fire: 1, Normal: 1, Ground: 0 },
    Normal: { Fire: 1, Water: 1, Grass: 1, Electric: 1, Normal: 1, Ground: 1 },
    Ground: { Electric: 2, Fire: 1, Water: 1, Normal: 1, Grass: 1 },
}

export function getTypeMultiplier(moveType: string, defenderType1: string, defenderType2?: string): number {
    const chart = TYPE_CHART[moveType] ?? {}
    const m1 = chart[defenderType1] ?? 1
    const m2 = defenderType2 ? (chart[defenderType2] ?? 1) : 1
    return m1 * m2
}

// ─── Stat helpers ─────────────────────────────────────────────────────────────

export function calcStat(base: number, level: number, isHp = false): number {
    // Simplified gen-3 stat formula
    if (isHp) return Math.floor(((2 * base * level) / 100) + level + 10)
    return Math.floor(((2 * base * level) / 100) + 5)
}

export function calcXpReward(level: number): number {
    return Math.floor(level * 15 * (1 + Math.random() * 0.2))
}

// ─── Damage calculation ───────────────────────────────────────────────────────

export function calcDamage(
    attacker: FighterState,
    defender: FighterState,
    moveId: string,
    defenderCreatureType1: string,
    defenderCreatureType2?: string
): { damage: number; effectiveness: number; isCrit: boolean; missed: boolean } {
    const move = MOVES_MAP[moveId]
    if (!move || !move.power) return { damage: 0, effectiveness: 1, isCrit: false, missed: false }

    // Accuracy check
    const accuracyRoll = Math.random() * 100
    const effectiveAccuracy = move.accuracy * attacker.accuracyMod * defender.accuracyMod
    if (accuracyRoll > effectiveAccuracy) {
        return { damage: 0, effectiveness: 1, isCrit: false, missed: true }
    }

    const isSpecial = move.category === 'special'
    const atk = isSpecial ? attacker.spAttack : attacker.attack * attacker.attackMod
    const def = isSpecial ? defender.spDefense : defender.defense

    const effectiveness = getTypeMultiplier(move.type, defenderCreatureType1, defenderCreatureType2)
    const isCrit = Math.random() < 0.0625 // 1/16 base crit rate
    const critMultiplier = isCrit ? 1.5 : 1.0
    const randomFactor = 0.85 + Math.random() * 0.15 // 0.85 - 1.0

    // Gen 3 damage formula (simplified)
    const baseDamage = (((2 * attacker.level / 5 + 2) * move.power * (atk / def)) / 50 + 2)
    const rawDamage = Math.floor(baseDamage * effectiveness * critMultiplier * randomFactor)
    const damage = effectiveness === 0 ? 0 : Math.max(1, rawDamage)

    // Burn halves physical attack damage
    const burnedDamage = (attacker.status === 'burn' && !isSpecial) ? Math.floor(damage * 0.5) : damage

    return { damage: burnedDamage, effectiveness, isCrit, missed: false }
}

// ─── Status effect application ─────────────────────────────────────────────────

export function applyStatusEffect(effect: string | undefined, target: FighterState, log: string[]): FighterState {
    if (!effect) return target
    const updated = { ...target }

    if (effect === 'BURN_10' && target.status === 'none' && Math.random() < 0.1) {
        updated.status = 'burn'
        log.push(`${target.creatureName} was burned! 🔥`)
    } else if ((effect === 'PARA_10' || effect === 'PARA_30') && target.status === 'none') {
        const chance = effect === 'PARA_30' ? 0.3 : 0.1
        if (Math.random() < chance) {
            updated.status = 'paralysis'
            log.push(`${target.creatureName} is paralyzed! ⚡`)
        }
    } else if (effect === 'DEF_DOWN') {
        updated.attackMod = Math.max(0.25, updated.attackMod - 0.25)
        log.push(`${target.creatureName}'s attack fell!`)
    } else if (effect === 'ACC_DOWN') {
        updated.accuracyMod = Math.max(0.25, updated.accuracyMod - 0.25)
        log.push(`${target.creatureName}'s accuracy fell!`)
    }

    return updated
}

// ─── End-of-turn status damage ─────────────────────────────────────────────────

export function applyEndOfTurnEffects(fighter: FighterState, log: string[]): FighterState {
    const updated = { ...fighter }
    if (updated.status === 'burn') {
        const burnDmg = Math.max(1, Math.floor(fighter.maxHp / 16))
        updated.currentHp = Math.max(0, updated.currentHp - burnDmg)
        log.push(`${fighter.creatureName} is hurt by its burn! (-${burnDmg} HP)`)
    }
    return updated
}

// ─── Paralysis skip ────────────────────────────────────────────────────────────

export function isParalyzedAndSkips(fighter: FighterState, log: string[]): boolean {
    if (fighter.status === 'paralysis' && Math.random() < 0.25) {
        log.push(`${fighter.creatureName} is fully paralyzed and can't move!`)
        return true
    }
    return false
}

// ─── Turn resolution ──────────────────────────────────────────────────────────

export function resolveTurn(
    room: BattleRoom,
    p1MoveId: string,
    p2MoveId: string,
    p1CreatureType1: string,
    p1CreatureType2: string | undefined,
    p2CreatureType1: string,
    p2CreatureType2: string | undefined
): TurnResult {
    const log: string[] = []
    let p1 = { ...room.player1 }
    let p2 = { ...room.player2 }

    // Deduct PP
    if (p1.ppLeft[p1MoveId] !== undefined) p1.ppLeft[p1MoveId] = Math.max(0, p1.ppLeft[p1MoveId] - 1)
    if (p2.ppLeft[p2MoveId] !== undefined) p2.ppLeft[p2MoveId] = Math.max(0, p2.ppLeft[p2MoveId] - 1)

    const m1 = MOVES_MAP[p1MoveId]
    const m2 = MOVES_MAP[p2MoveId]

    // Priority: Quick Attack or higher speed goes first
    const p1Priority = m1?.name === 'Quick Attack' ? 1 : 0
    const p2Priority = m2?.name === 'Quick Attack' ? 1 : 0
    const p1GoesFirst =
        p1Priority !== p2Priority ? p1Priority > p2Priority : p1.speed >= p2.speed

    const attackOrder: Array<[FighterState, FighterState, string, string, string | undefined]> = p1GoesFirst
        ? [
            [p1, p2, p1MoveId, p2CreatureType1, p2CreatureType2],
            [p2, p1, p2MoveId, p1CreatureType1, p1CreatureType2],
        ]
        : [
            [p2, p1, p2MoveId, p1CreatureType1, p1CreatureType2],
            [p1, p2, p1MoveId, p2CreatureType1, p2CreatureType2],
        ]

    for (const [attacker, defender, moveId, defType1, defType2] of attackOrder) {
        if (attacker.currentHp <= 0) continue // already fainted

        if (isParalyzedAndSkips(attacker, log)) continue

        const move = MOVES_MAP[moveId]
        if (!move) continue

        if (move.category === 'status') {
            log.push(`${attacker.creatureName} used ${move.name}!`)
            // Status moves affect the defender
            const isDefender = attacker.userId === p1.userId
            if (isDefender) {
                p2 = applyStatusEffect(move.effect, p2, log)
            } else {
                p1 = applyStatusEffect(move.effect, p1, log)
            }
        } else {
            const { damage, effectiveness, isCrit, missed } = calcDamage(
                attacker, defender, moveId, defType1, defType2
            )

            log.push(`${attacker.creatureName} used ${move.name}!`)
            if (missed) {
                log.push(`${attacker.creatureName}'s attack missed!`)
            } else {
                if (effectiveness > 1) log.push(`It's super effective! ✨`)
                if (effectiveness < 1 && effectiveness > 0) log.push(`It's not very effective...`)
                if (effectiveness === 0) log.push(`It had no effect!`)
                if (isCrit) log.push(`A critical hit! 💥`)
                log.push(`${defender.creatureName} took ${damage} damage!`)

                // Apply damage to the correct fighter
                if (defender.userId === p2.userId) {
                    p2 = { ...p2, currentHp: Math.max(0, p2.currentHp - damage) }
                    p2 = applyStatusEffect(move.effect, p2, log)
                } else {
                    p1 = { ...p1, currentHp: Math.max(0, p1.currentHp - damage) }
                    p1 = applyStatusEffect(move.effect, p1, log)
                }
            }
        }

        // Check faint after each attack
        if (p1.currentHp <= 0 || p2.currentHp <= 0) break
    }

    // End-of-turn status effects
    if (p1.currentHp > 0) p1 = applyEndOfTurnEffects(p1, log)
    if (p2.currentHp > 0) p2 = applyEndOfTurnEffects(p2, log)

    // Faint messages
    if (p1.currentHp <= 0) log.push(`${p1.creatureName} fainted! 💀`)
    if (p2.currentHp <= 0) log.push(`${p2.creatureName} fainted! 💀`)

    const isOver = p1.currentHp <= 0 || p2.currentHp <= 0
    let winnerId: string | null = null
    if (isOver) {
        if (p1.currentHp <= 0 && p2.currentHp <= 0) winnerId = null
        else if (p1.currentHp <= 0) winnerId = p2.userId
        else winnerId = p1.userId
    }

    const updatedRoom: BattleRoom = {
        ...room,
        player1: p1,
        player2: p2,
        pendingActions: {},
        turnNumber: room.turnNumber + 1,
    }

    return {
        log,
        player1HpDelta: p1.currentHp - room.player1.currentHp,
        player2HpDelta: p2.currentHp - room.player2.currentHp,
        updatedRoom,
        isOver,
        winnerId,
    }
}

export function checkFainted(fighter: FighterState): boolean {
    return fighter.currentHp <= 0
}
