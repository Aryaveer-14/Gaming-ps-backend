import { Router } from 'express'
import { authenticateJWT } from '../middleware/auth'
import prisma from '../lib/prisma'
import { CREATURES, CreatureDef, CREATURES_MAP, MOVES_MAP } from '../data/creatures'
import { calcStat } from '../engine/battleEngine'

const router = Router()

// Starter IDs (subset of CREATURES)
const STARTER_IDS = ['flameling', 'aquafin', 'verdling'] as const
type StarterId = typeof STARTER_IDS[number]

// Gary always picks the type-advantaged counter
const COUNTER: Record<string, string> = {
    flameling: 'aquafin',   // water beats fire
    aquafin:   'verdling',  // grass beats water
    verdling:  'flameling', // fire beats grass
}

// POST /starter/select  — body: { creatureId }
router.post('/select', authenticateJWT, async (req, res) => {
    const { creatureId } = req.body as { creatureId?: string }
    const userId = req.user!.userId

    if (!creatureId || !STARTER_IDS.includes(creatureId as StarterId)) {
        return res.status(400).json({ error: 'Invalid starter choice' })
    }

    try {
        // Guard: already has a starter
        const flags = await prisma.storyFlags.findUnique({ where: { userId } })
        if (flags?.hasStarter) {
            return res.status(409).json({ error: 'Starter already chosen' })
        }

        const starterDef = CREATURES.find(c => c.id === creatureId) as CreatureDef
        const garyId     = COUNTER[creatureId]
        const garyDef    = CREATURES.find(c => c.id === garyId) as CreatureDef

        const level = 5
        const maxHp = calcStat(starterDef.baseHp, level, true)

        // Remove auto-assigned starter (flameling from register), add chosen one
        await prisma.playerCreature.deleteMany({ where: { userId } })
        await prisma.playerCreature.create({
            data: {
                userId,
                creatureId: starterDef.id,
                level,
                currentHp: maxHp,
                maxHp,
                isLead: true,
            },
        })

        // Update story flags
        await prisma.storyFlags.upsert({
            where:  { userId },
            update: { hasStarter: true, starterChosen: creatureId, metGary: true, metOak: true },
            create: { userId, hasStarter: true, starterChosen: creatureId, metGary: true, metOak: true },
        })

        // Give starter Poké Balls (5x)
        await prisma.inventoryItem.upsert({
            where: { userId_itemName: { userId, itemName: 'poke_ball' } },
            update: { quantity: { increment: 5 } },
            create: { userId, itemName: 'poke_ball', quantity: 5 },
        })

        return res.status(201).json({
            starter:     { id: starterDef.id, name: starterDef.name, type: starterDef.type1 },
            garyStarter: { id: garyDef.id,    name: garyDef.name,    type: garyDef.type1 },
        })
    } catch (err) {
        console.error('[POST /starter/select]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ── GET /starter/team — Return the player's creature team ───────────────────
router.get('/team', authenticateJWT, async (req, res) => {
    const userId = req.user!.userId
    try {
        const creatures = await prisma.playerCreature.findMany({
            where: { userId },
            orderBy: [{ isLead: 'desc' }, { createdAt: 'asc' }],
        })

        // Auto-gift 5 Poké Balls to existing players who have 0
        if (creatures.length > 0) {
            const pokeBalls = await prisma.inventoryItem.findUnique({
                where: { userId_itemName: { userId, itemName: 'poke_ball' } },
            })
            if (!pokeBalls || pokeBalls.quantity <= 0) {
                await prisma.inventoryItem.upsert({
                    where: { userId_itemName: { userId, itemName: 'poke_ball' } },
                    update: { quantity: 5 },
                    create: { userId, itemName: 'poke_ball', quantity: 5 },
                })
            }
        }

        const team = creatures.map(c => {
            const def = CREATURES_MAP[c.creatureId]
            const moves = def
                ? def.moves.map(mId => {
                    const mDef = MOVES_MAP[mId]
                    return mDef
                        ? { id: mDef.id, name: mDef.name, type: mDef.type, power: mDef.power ?? 0 }
                        : { id: mId, name: mId, type: 'Normal', power: 0 }
                })
                : []

            return {
                id: c.id,
                creatureId: c.creatureId,
                nickname: c.nickname,
                level: c.level,
                xp: c.xp ?? 0,
                currentHp: c.currentHp,
                maxHp: c.maxHp,
                isLead: c.isLead,
                type: def?.type1 ?? 'Normal',
                moves,
            }
        })

        return res.json({ team })
    } catch (err) {
        console.error('[GET /starter/team]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ── POST /starter/catch — Catch a wild creature ─────────────────────────────
router.post('/catch', authenticateJWT, async (req, res) => {
    const { creatureId, level = 5 } = req.body as { creatureId?: string; level?: number }
    const userId = req.user!.userId

    if (!creatureId || !CREATURES_MAP[creatureId]) {
        return res.status(400).json({ error: 'Invalid creature' })
    }

    try {
        const def = CREATURES_MAP[creatureId]
        const maxHp = calcStat(def.baseHp, level, true)

        // Enforce max party size of 6
        const partyCount = await prisma.playerCreature.count({ where: { userId } })
        if (partyCount >= 6) {
            return res.status(400).json({ error: 'Party is full! Max 6 Pokémon.', totalCreatures: partyCount })
        }

        await prisma.playerCreature.create({
            data: {
                userId,
                creatureId: def.id,
                level,
                currentHp: maxHp,
                maxHp,
                isLead: false,
            },
        })

        const count = await prisma.playerCreature.count({ where: { userId } })
        return res.status(201).json({
            message: `${def.name} was caught!`,
            totalCreatures: count,
        })
    } catch (err) {
        console.error('[POST /starter/catch]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

export default router
