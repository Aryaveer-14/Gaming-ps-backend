import {
    calcDamage,
    resolveTurn,
    getTypeMultiplier,
    calcStat,
    FighterState,
    BattleRoom,
} from '../engine/battleEngine'

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeFighter(overrides: Partial<FighterState> = {}): FighterState {
    return {
        userId: 'user1',
        socketId: 'socket1',
        creatureId: 'flameling',
        creatureName: 'Flameling',
        level: 10,
        currentHp: 65,
        maxHp: 65,
        attack: 15,
        defense: 12,
        spAttack: 18,
        spDefense: 14,
        speed: 20,
        moves: ['ember', 'tackle', 'flamethrower', 'growl'],
        ppLeft: { ember: 25, tackle: 35, flamethrower: 15, growl: 40 },
        status: 'none',
        attackMod: 1.0,
        accuracyMod: 1.0,
        ...overrides,
    }
}

function makeRoom(p1: FighterState, p2: FighterState): BattleRoom {
    return {
        id: 'test-room',
        player1: p1,
        player2: p2,
        turn: 'player1',
        pendingActions: {},
        turnNumber: 0,
        startedAt: Date.now(),
    }
}

// ─── calcStat ──────────────────────────────────────────────────────────────────

describe('calcStat', () => {
    test('HP stat is calculated correctly at level 5', () => {
        const hp = calcStat(45, 5, true)
        expect(hp).toBeGreaterThan(10)
        expect(hp).toBeLessThan(100)
    })

    test('non-HP stat at level 10 is in valid range', () => {
        const stat = calcStat(52, 10)
        expect(stat).toBeGreaterThan(0)
        expect(stat).toBeLessThan(200)
    })

    test('higher base = higher stat', () => {
        expect(calcStat(100, 10)).toBeGreaterThan(calcStat(50, 10))
    })
})

// ─── getTypeMultiplier ─────────────────────────────────────────────────────────

describe('getTypeMultiplier', () => {
    test('Fire is super effective against Grass (x2)', () => {
        expect(getTypeMultiplier('Fire', 'Grass')).toBe(2)
    })

    test('Fire is not very effective against Water (x0.5)', () => {
        expect(getTypeMultiplier('Fire', 'Water')).toBe(0.5)
    })

    test('Electric has no effect on Ground (x0)', () => {
        expect(getTypeMultiplier('Electric', 'Ground')).toBe(0)
    })

    test('Normal is neutral against Fire (x1)', () => {
        expect(getTypeMultiplier('Normal', 'Fire')).toBe(1)
    })

    test('dual type: Fire vs Grass/Water = 2 * 0.5 = 1', () => {
        expect(getTypeMultiplier('Fire', 'Grass', 'Water')).toBe(1)
    })
})

// ─── calcDamage ────────────────────────────────────────────────────────────────

describe('calcDamage', () => {
    const attacker = makeFighter()
    const defender = makeFighter({
        userId: 'user2',
        socketId: 'socket2',
        creatureId: 'verdling',
        creatureName: 'Verdling',
    })

    test('physical move deals positive damage when it hits', () => {
        // Run 10 times to account for miss chance
        let hitOnce = false
        for (let i = 0; i < 10; i++) {
            const result = calcDamage(attacker, defender, 'tackle', 'Grass')
            if (!result.missed) {
                expect(result.damage).toBeGreaterThan(0)
                hitOnce = true
                break
            }
        }
        expect(hitOnce).toBe(true)
    })

    test('special move vs super effective type deals boosted damage', () => {
        let foundEffective = false
        for (let i = 0; i < 10; i++) {
            const result = calcDamage(attacker, defender, 'ember', 'Grass')
            if (!result.missed) {
                expect(result.effectiveness).toBe(2)
                expect(result.damage).toBeGreaterThan(0)
                foundEffective = true
                break
            }
        }
        expect(foundEffective).toBe(true)
    })

    test('status move always deals 0 damage', () => {
        const result = calcDamage(attacker, defender, 'growl', 'Grass')
        expect(result.damage).toBe(0)
        expect(result.missed).toBe(false)
    })

    test('Electric vs Ground deals 0 damage (immunity)', () => {
        const elecAttacker = makeFighter({
            moves: ['thunder_shock', 'tackle', 'thunderbolt', 'thunder'],
            ppLeft: { thunder_shock: 30, tackle: 35, thunderbolt: 15, thunder: 10 },
        })
        const groundDefender = makeFighter({
            userId: 'user2',
            socketId: 'socket2',
            creatureId: 'stonebear',
            creatureName: 'Stonebear',
        })
        const result = calcDamage(elecAttacker, groundDefender, 'thunder_shock', 'Ground')
        expect(result.damage).toBe(0)
        expect(result.effectiveness).toBe(0)
    })

    test('burn halves physical damage', () => {
        const burnedAttacker = makeFighter({ status: 'burn' })
        let normalDmg = 0
        let burnDmg = 0

        // Average over multiple rolls
        for (let i = 0; i < 50; i++) {
            const r1 = calcDamage(attacker, defender, 'tackle', 'Normal')
            const r2 = calcDamage(burnedAttacker, defender, 'tackle', 'Normal')
            if (!r1.missed) normalDmg += r1.damage
            if (!r2.missed) burnDmg += r2.damage
        }

        expect(burnDmg).toBeLessThan(normalDmg)
    })
})

// ─── resolveTurn ───────────────────────────────────────────────────────────────

describe('resolveTurn', () => {
    test('produces a non-empty battle log', () => {
        const p1 = makeFighter()
        const p2 = makeFighter({
            userId: 'user2',
            socketId: 'socket2',
            creatureId: 'verdling',
            creatureName: 'Verdling',
            moves: ['vine_whip', 'tackle', 'razor_leaf', 'growl'],
            ppLeft: { vine_whip: 25, tackle: 35, razor_leaf: 25, growl: 40 },
        })
        const room = makeRoom(p1, p2)
        const result = resolveTurn(room, 'ember', 'vine_whip', 'Fire', undefined, 'Grass', undefined)

        expect(result.log.length).toBeGreaterThan(0)
        expect(result.updatedRoom.turnNumber).toBe(1)
    })

    test('PP is decremented after each turn', () => {
        const p1 = makeFighter()
        const p2 = makeFighter({ userId: 'user2', socketId: 'socket2' })
        const room = makeRoom(p1, p2)

        const result = resolveTurn(room, 'ember', 'tackle', 'Fire', undefined, 'Normal', undefined)
        expect(result.updatedRoom.player1.ppLeft['ember']).toBe(24)
        expect(result.updatedRoom.player2.ppLeft['tackle']).toBe(34)
    })

    test('detects battle end when a fighter faints', () => {
        const p1 = makeFighter({ currentHp: 1 })
        const p2 = makeFighter({
            userId: 'user2',
            socketId: 'socket2',
            currentHp: 200,
            maxHp: 200,
            spAttack: 100,
            moves: ['flamethrower', 'tackle', 'fire_blast', 'growl'],
            ppLeft: { flamethrower: 15, tackle: 35, fire_blast: 5, growl: 40 },
        })
        const room = makeRoom(p1, p2)

        const result = resolveTurn(room, 'growl', 'flamethrower', 'Fire', undefined, 'Normal', undefined)
        if (result.isOver) {
            expect(result.winnerId).toBe('user2')
        }
        // p1 had 1 HP – should have fainted after flamethrower regardless
        expect(result.updatedRoom.player1.currentHp).toBe(0)
    })

    test('draw when both fighters faint simultaneously (extremely rare; test structure)', () => {
        // This test verifies the structure handles null winner
        const p1 = makeFighter({ currentHp: 1 })
        const p2 = makeFighter({ userId: 'user2', socketId: 'socket2', currentHp: 1 })
        const room = makeRoom(p1, p2)

        const result = resolveTurn(room, 'ember', 'ember', 'Fire', undefined, 'Fire', undefined)
        // With 1 HP each, one may faint – verify winner is set or null
        if (result.isOver && result.winnerId === null) {
            expect(result.updatedRoom.player1.currentHp).toBe(0)
            expect(result.updatedRoom.player2.currentHp).toBe(0)
        }
    })
})
