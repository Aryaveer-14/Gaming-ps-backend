import { Router } from 'express'
import { authenticateJWT } from '../middleware/auth'
import prisma from '../lib/prisma'
import { CREATURES, CreatureDef } from '../data/creatures'
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

        return res.status(201).json({
            starter:     { id: starterDef.id, name: starterDef.name, type: starterDef.type1 },
            garyStarter: { id: garyDef.id,    name: garyDef.name,    type: garyDef.type1 },
        })
    } catch (err) {
        console.error('[POST /starter/select]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

export default router
