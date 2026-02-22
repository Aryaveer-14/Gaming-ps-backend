import { Router } from 'express'
import { authenticateJWT } from '../middleware/auth'
import prisma from '../lib/prisma'
import { CREATURES_MAP } from '../data/creatures'
import { calcStat } from '../engine/battleEngine'

const router = Router()

const MAX_PARTY_SIZE = 6

// ── POST /party/setLead — set lead Pokémon by playerCreature id ─────────────
router.post('/setLead', authenticateJWT, async (req, res) => {
    const { creatureDbId } = req.body as { creatureDbId?: string }
    const userId = req.user!.userId

    if (!creatureDbId) {
        return res.status(400).json({ error: 'Missing creatureDbId' })
    }

    try {
        // Verify creature belongs to player
        const creature = await prisma.playerCreature.findFirst({
            where: { id: creatureDbId, userId },
        })
        if (!creature) {
            return res.status(404).json({ error: 'Creature not found' })
        }

        // Unset all leads
        await prisma.playerCreature.updateMany({
            where: { userId, isLead: true },
            data: { isLead: false },
        })

        // Set new lead
        await prisma.playerCreature.update({
            where: { id: creatureDbId },
            data: { isLead: true },
        })

        return res.json({ message: `${creature.nickname || creature.creatureId} is now your lead!` })
    } catch (err) {
        console.error('[POST /party/setLead]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ── POST /party/healAll — heal all Pokémon to full HP ───────────────────────
router.post('/healAll', authenticateJWT, async (req, res) => {
    const userId = req.user!.userId

    try {
        const creatures = await prisma.playerCreature.findMany({ where: { userId } })

        for (const c of creatures) {
            const def = CREATURES_MAP[c.creatureId]
            if (!def) continue
            const maxHp = calcStat(def.baseHp, c.level, true)
            await prisma.playerCreature.update({
                where: { id: c.id },
                data: { currentHp: maxHp, maxHp },
            })
        }

        return res.json({ message: 'All Pokémon have been healed!' })
    } catch (err) {
        console.error('[POST /party/healAll]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ── POST /party/battleReward — award XP + money after battle win ────────────
router.post('/battleReward', authenticateJWT, async (req, res) => {
    const { creatureDbId, enemyLevel, caught } = req.body as {
        creatureDbId?: string
        enemyLevel?: number
        caught?: boolean
    }
    const userId = req.user!.userId

    if (!creatureDbId || !enemyLevel) {
        return res.status(400).json({ error: 'Missing creatureDbId or enemyLevel' })
    }

    try {
        const creature = await prisma.playerCreature.findFirst({
            where: { id: creatureDbId, userId },
        })
        if (!creature) {
            return res.status(404).json({ error: 'Creature not found' })
        }

        const xpGain = enemyLevel * 20
        const moneyReward = enemyLevel * 10

        let newXp = creature.xp + xpGain
        let newLevel = creature.level
        let leveledUp = false

        // Level-up check: XP threshold = level * 100
        while (newXp >= newLevel * 100) {
            newXp -= newLevel * 100
            newLevel++
            leveledUp = true
        }

        // Recalculate maxHp on level up
        const def = CREATURES_MAP[creature.creatureId]
        const newMaxHp = def ? calcStat(def.baseHp, newLevel, true) : creature.maxHp
        const hpGain = newMaxHp - creature.maxHp
        const newCurrentHp = Math.min(creature.currentHp + hpGain, newMaxHp)

        await prisma.playerCreature.update({
            where: { id: creature.id },
            data: {
                xp: newXp,
                level: newLevel,
                maxHp: newMaxHp,
                currentHp: newCurrentHp,
            },
        })

        // Award money
        await prisma.storyFlags.upsert({
            where: { userId },
            update: { money: { increment: moneyReward } },
            create: { userId, money: 3000 + moneyReward },
        })

        const flags = await prisma.storyFlags.findUnique({ where: { userId } })

        return res.json({
            xpGain,
            moneyReward,
            newXp,
            newLevel,
            leveledUp,
            newMaxHp,
            totalMoney: flags?.money ?? 3000,
        })
    } catch (err) {
        console.error('[POST /party/battleReward]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ── POST /party/updateHp — persist creature HP after battle ─────────────────
router.post('/updateHp', authenticateJWT, async (req, res) => {
    const { creatureDbId, currentHp } = req.body as { creatureDbId?: string; currentHp?: number }
    const userId = req.user!.userId

    if (!creatureDbId || currentHp === undefined) {
        return res.status(400).json({ error: 'Missing creatureDbId or currentHp' })
    }

    try {
        const creature = await prisma.playerCreature.findFirst({
            where: { id: creatureDbId, userId },
        })
        if (!creature) {
            return res.status(404).json({ error: 'Creature not found' })
        }

        await prisma.playerCreature.update({
            where: { id: creature.id },
            data: { currentHp: Math.max(0, Math.min(currentHp, creature.maxHp)) },
        })

        return res.json({ message: 'HP updated' })
    } catch (err) {
        console.error('[POST /party/updateHp]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ── GET /party/leaderboard — top players by total creature levels ───────────
router.get('/leaderboard', authenticateJWT, async (_req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: {
                creatures: true,
                storyFlags: true,
            },
        })

        const leaderboard = users.map(u => {
            const totalLevels = u.creatures.reduce((sum, c) => sum + c.level, 0)
            const topLevel = u.creatures.reduce((max, c) => Math.max(max, c.level), 0)
            const caught = u.creatures.length
            return {
                username: u.username,
                topLevel,
                totalLevels,
                caught,
                money: u.storyFlags?.money ?? 0,
            }
        }).sort((a, b) => b.topLevel - a.topLevel || b.totalLevels - a.totalLevels)
            .slice(0, 10)

        return res.json({ leaderboard })
    } catch (err) {
        console.error('[GET /party/leaderboard]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ── GET /party/profile — player profile data ───────────────────────────────
router.get('/profile', authenticateJWT, async (req, res) => {
    const userId = req.user!.userId
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                creatures: true,
                storyFlags: true,
                battlesAsPlayer1: true,
                battlesAsPlayer2: true,
            },
        })
        if (!user) return res.status(404).json({ error: 'User not found' })

        const battles = (user.battlesAsPlayer1?.length ?? 0) + (user.battlesAsPlayer2?.length ?? 0)
        return res.json({
            username: user.username,
            createdAt: user.createdAt,
            battles,
            pokemonCount: user.creatures.length,
            money: user.storyFlags?.money ?? 0,
        })
    } catch (err) {
        console.error('[GET /party/profile]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

export default router
