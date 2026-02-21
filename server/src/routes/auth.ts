import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { signToken } from '../middleware/auth'
import { CREATURES } from '../data/creatures'
import { calcStat } from '../engine/battleEngine'

const router = Router()

// POST /auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body as {
            username?: string
            email?: string
            password?: string
        }

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'username, email, and password are required' })
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' })
        }

        const existing = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] },
        })
        if (existing) {
            return res.status(409).json({ error: 'Username or email already taken' })
        }

        const hashed = await bcrypt.hash(password, 12)
        const user = await prisma.user.create({
            data: { username, email, password: hashed },
        })

        // Give starter creature (Flameling – index 0)
        const starter = CREATURES[0]
        const starterLevel = 5
        const maxHp = calcStat(starter.baseHp, starterLevel, true)
        await prisma.playerCreature.create({
            data: {
                userId: user.id,
                creatureId: starter.id,
                level: starterLevel,
                currentHp: maxHp,
                maxHp,
                isLead: true,
            },
        })

        const token = signToken({ userId: user.id, username: user.username })
        return res.status(201).json({ token, user: { id: user.id, username, email } })
    } catch (err) {
        console.error('[register]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body as { username?: string; password?: string }

        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' })
        }

        const user = await prisma.user.findUnique({ where: { username } })
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        const token = signToken({ userId: user.id, username: user.username })
        return res.json({ token, user: { id: user.id, username: user.username, email: user.email } })
    } catch (err) {
        console.error('[login]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

export default router
