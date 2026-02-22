import { Router } from 'express'
import { authenticateJWT } from '../middleware/auth'
import prisma from '../lib/prisma'

const router = Router()

// ── Item catalogue ─────────────────────────────────────────────────────────────
export interface ShopItem {
    id: string
    name: string
    description: string
    price: number
    category: 'healing' | 'pokeball' | 'status' | 'battle' | 'misc'
}

export const SHOP_ITEMS: ShopItem[] = [
    { id: 'potion',        name: 'Potion',        description: 'Restores 20 HP.',               price: 200,  category: 'healing' },
    { id: 'super_potion',  name: 'Super Potion',  description: 'Restores 50 HP.',               price: 700,  category: 'healing' },
    { id: 'antidote',      name: 'Antidote',      description: 'Cures poison.',                 price: 100,  category: 'status' },
    { id: 'paralyze_heal', name: 'Paralyze Heal', description: 'Cures paralysis.',              price: 200,  category: 'status' },
    { id: 'poke_ball',     name: 'Poké Ball',     description: 'Catches wild Pokémon.',         price: 200,  category: 'pokeball' },
    { id: 'great_ball',    name: 'Great Ball',    description: 'Better catch rate.',             price: 600,  category: 'pokeball' },
    { id: 'repel',         name: 'Repel',         description: 'Repels weak Pokémon for 100 steps.', price: 350, category: 'misc' },
    { id: 'escape_rope',   name: 'Escape Rope',   description: 'Escape from caves instantly.',  price: 550,  category: 'misc' },
    { id: 'revive',        name: 'Revive',        description: 'Revives a fainted Pokémon to half HP.', price: 1500, category: 'battle' },
    { id: 'full_heal',     name: 'Full Heal',     description: 'Cures all status conditions.',  price: 600,  category: 'status' },
]

const ITEM_MAP = new Map(SHOP_ITEMS.map(i => [i.id, i]))

// GET /inventory — list player inventory
router.get('/', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user!.userId
        const items = await prisma.inventoryItem.findMany({
            where: { userId },
        })
        const flags = await prisma.storyFlags.findUnique({ where: { userId } })
        const money = (flags as any)?.money ?? 3000
        return res.json({ items, money })
    } catch (err) {
        console.error('[GET /inventory]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// GET /inventory/shop — list shop items
router.get('/shop', authenticateJWT, (_req, res) => {
    return res.json({ items: SHOP_ITEMS })
})

// POST /inventory/buy — { itemId, quantity? }
router.post('/buy', authenticateJWT, async (req, res) => {
    const { itemId, quantity = 1 } = req.body as { itemId?: string; quantity?: number }
    const userId = req.user!.userId

    if (!itemId || !ITEM_MAP.has(itemId)) {
        return res.status(400).json({ error: 'Invalid item' })
    }
    if (quantity < 1 || quantity > 99) {
        return res.status(400).json({ error: 'Invalid quantity' })
    }

    const item = ITEM_MAP.get(itemId)!
    const totalCost = item.price * quantity

    try {
        // Get current money from user's story flags (or default 3000)
        const flags = await prisma.storyFlags.findUnique({ where: { userId } })
        const currentMoney = (flags as any)?.money ?? 3000

        if (currentMoney < totalCost) {
            return res.status(400).json({ error: 'Not enough money', currentMoney })
        }

        // Upsert inventory item
        await prisma.inventoryItem.upsert({
            where: { userId_itemName: { userId, itemName: itemId } },
            update: { quantity: { increment: quantity } },
            create: { userId, itemName: itemId, quantity },
        })

        // Deduct money
        await prisma.storyFlags.upsert({
            where: { userId },
            update: { money: currentMoney - totalCost },
            create: { userId, money: 3000 - totalCost },
        })

        const items = await prisma.inventoryItem.findMany({ where: { userId } })
        return res.json({
            message: `Bought ${quantity}x ${item.name}!`,
            items,
            money: currentMoney - totalCost,
        })
    } catch (err) {
        console.error('[POST /inventory/buy]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// POST /inventory/use — { itemId } — deduct 1 item from inventory
router.post('/use', authenticateJWT, async (req, res) => {
    const { itemId } = req.body as { itemId?: string }
    const userId = req.user!.userId

    if (!itemId) {
        return res.status(400).json({ error: 'Missing itemId' })
    }

    try {
        const item = await prisma.inventoryItem.findUnique({
            where: { userId_itemName: { userId, itemName: itemId } },
        })

        if (!item || item.quantity <= 0) {
            return res.status(400).json({ error: 'Item not in inventory' })
        }

        if (item.quantity <= 1) {
            await prisma.inventoryItem.delete({ where: { id: item.id } })
        } else {
            await prisma.inventoryItem.update({
                where: { id: item.id },
                data: { quantity: { decrement: 1 } },
            })
        }

        return res.json({ message: `Used ${itemId}`, remaining: Math.max(0, item.quantity - 1) })
    } catch (err) {
        console.error('[POST /inventory/use]', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

export default router
