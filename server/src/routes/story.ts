import { Router } from 'express'
import { authenticateJWT } from '../middleware/auth'
import prisma from '../lib/prisma'

const router = Router()

// GET /story/flags
router.get('/flags', authenticateJWT, async (req, res) => {
    try {
        const flags = await prisma.storyFlags.upsert({
            where:  { userId: req.user!.userId },
            update: {},
            create: { userId: req.user!.userId },
        })
        return res.json(flags)
    } catch (err) {
        console.error('[GET /story/flags]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// POST /story/flags  — body: { field, value }
const ALLOWED = ['visitedMom', 'metOak', 'hasStarter', 'metGary'] as const
type FlagKey = typeof ALLOWED[number]

router.post('/flags', authenticateJWT, async (req, res) => {
    const { field, value } = req.body as { field?: string; value?: unknown }
    if (!field || !ALLOWED.includes(field as FlagKey)) {
        return res.status(400).json({ error: `Invalid flag field: ${field}` })
    }
    if (value !== true) {
        return res.status(400).json({ error: 'Boolean flags can only be set to true' })
    }
    try {
        const flags = await prisma.storyFlags.upsert({
            where:  { userId: req.user!.userId },
            update: { [field]: true },
            create: { userId: req.user!.userId, [field]: true },
        })
        return res.json(flags)
    } catch (err) {
        console.error('[POST /story/flags]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

export default router
