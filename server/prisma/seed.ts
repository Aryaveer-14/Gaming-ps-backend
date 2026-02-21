import { PrismaClient } from '@prisma/client'
import { CREATURES, MOVES } from '../src/data/creatures'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding creatures and moves...')

    // Upsert all moves
    for (const move of MOVES) {
        await prisma.move.upsert({
            where: { id: move.id },
            update: {
                name: move.name,
                type: move.type,
                category: move.category,
                power: move.power ?? null,
                accuracy: move.accuracy,
                pp: move.pp,
                effect: move.effect ?? null,
                description: move.description,
            },
            create: {
                id: move.id,
                name: move.name,
                type: move.type,
                category: move.category,
                power: move.power ?? null,
                accuracy: move.accuracy,
                pp: move.pp,
                effect: move.effect ?? null,
                description: move.description,
            },
        })
    }

    console.log(`✅ Seeded ${MOVES.length} moves`)

    // Upsert all creatures + their moves
    for (const creature of CREATURES) {
        await prisma.creature.upsert({
            where: { id: creature.id },
            update: {
                name: creature.name,
                type1: creature.type1,
                type2: creature.type2 ?? null,
                baseHp: creature.baseHp,
                baseAtk: creature.baseAtk,
                baseDef: creature.baseDef,
                baseSpAtk: creature.baseSpAtk,
                baseSpDef: creature.baseSpDef,
                baseSpd: creature.baseSpd,
                spriteKey: creature.spriteKey,
            },
            create: {
                id: creature.id,
                name: creature.name,
                type1: creature.type1,
                type2: creature.type2 ?? null,
                baseHp: creature.baseHp,
                baseAtk: creature.baseAtk,
                baseDef: creature.baseDef,
                baseSpAtk: creature.baseSpAtk,
                baseSpDef: creature.baseSpDef,
                baseSpd: creature.baseSpd,
                spriteKey: creature.spriteKey,
            },
        })

        // Link moves to creature
        for (let i = 0; i < creature.moves.length; i++) {
            const moveId = creature.moves[i]
            if (!MOVES.find((m) => m.id === moveId)) {
                console.warn(`⚠️  Move '${moveId}' not found for creature '${creature.name}', skipping`)
                continue
            }
            await prisma.creatureMove.upsert({
                where: { creatureId_moveId: { creatureId: creature.id, moveId } },
                update: { learnLevel: (i + 1) * 5 },
                create: { creatureId: creature.id, moveId, learnLevel: (i + 1) * 5 },
            })
        }
    }

    console.log(`✅ Seeded ${CREATURES.length} creatures with moves`)
    console.log('🎉 Database seeded successfully!')
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
