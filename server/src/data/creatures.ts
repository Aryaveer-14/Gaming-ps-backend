// ─── Type Definitions ─────────────────────────────────────────────────────────

export interface CreatureDef {
    id: string
    name: string
    type1: string
    type2?: string
    baseHp: number
    baseAtk: number
    baseDef: number
    baseSpAtk: number
    baseSpDef: number
    baseSpd: number
    spriteKey: string
    moves: string[] // move names learnable at any level for now
}

export interface MoveDef {
    id: string
    name: string
    type: string
    category: 'physical' | 'special' | 'status'
    power?: number
    accuracy: number
    pp: number
    effect?: string
    description: string
}

// ─── Moves ────────────────────────────────────────────────────────────────────

export const MOVES: MoveDef[] = [
    // Fire
    { id: 'ember', name: 'Ember', type: 'Fire', category: 'special', power: 40, accuracy: 100, pp: 25, description: 'A small flame scorches the foe.' },
    { id: 'flamethrower', name: 'Flamethrower', type: 'Fire', category: 'special', power: 90, accuracy: 100, pp: 15, effect: 'BURN_10', description: 'May cause a burn.' },
    { id: 'fire_blast', name: 'Fire Blast', type: 'Fire', category: 'special', power: 110, accuracy: 85, pp: 5, effect: 'BURN_10', description: 'Powerful blast with burn chance.' },
    // Water
    { id: 'water_gun', name: 'Water Gun', type: 'Water', category: 'special', power: 40, accuracy: 100, pp: 25, description: 'Squirts water to attack.' },
    { id: 'surf', name: 'Surf', type: 'Water', category: 'special', power: 90, accuracy: 100, pp: 15, description: 'A strong tidal wave attack.' },
    { id: 'hydro_pump', name: 'Hydro Pump', type: 'Water', category: 'special', power: 110, accuracy: 80, pp: 5, description: 'Blasts water with great force.' },
    // Grass
    { id: 'vine_whip', name: 'Vine Whip', type: 'Grass', category: 'physical', power: 45, accuracy: 100, pp: 25, description: 'Strikes with slender vines.' },
    { id: 'razor_leaf', name: 'Razor Leaf', type: 'Grass', category: 'physical', power: 55, accuracy: 95, pp: 25, description: 'Slashes with sharp leaves. High crit.' },
    { id: 'solar_beam', name: 'Solar Beam', type: 'Grass', category: 'special', power: 120, accuracy: 100, pp: 10, description: 'Absorbs then fires a beam of light.' },
    // Electric
    { id: 'thunder_shock', name: 'Thunder Shock', type: 'Electric', category: 'special', power: 40, accuracy: 100, pp: 30, effect: 'PARA_10', description: 'May paralyze the foe.' },
    { id: 'thunderbolt', name: 'Thunderbolt', type: 'Electric', category: 'special', power: 90, accuracy: 100, pp: 15, effect: 'PARA_10', description: 'Strong bolt. May paralyze.' },
    { id: 'thunder', name: 'Thunder', type: 'Electric', category: 'special', power: 110, accuracy: 70, pp: 10, effect: 'PARA_30', description: 'Wild lightning. May paralyze.' },
    // Normal
    { id: 'tackle', name: 'Tackle', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 35, description: 'A full-body charge attack.' },
    { id: 'quick_attack', name: 'Quick Attack', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 30, description: 'Strike before the foe can move.' },
    { id: 'hyper_beam', name: 'Hyper Beam', type: 'Normal', category: 'special', power: 150, accuracy: 90, pp: 5, description: 'Powerful beam—must recharge next turn.' },
    // Status
    { id: 'growl', name: 'Growl', type: 'Normal', category: 'status', accuracy: 100, pp: 40, effect: 'DEF_DOWN', description: 'Lower foe\'s attack.' },
    { id: 'sand_attack', name: 'Sand Attack', type: 'Ground', category: 'status', accuracy: 100, pp: 15, effect: 'ACC_DOWN', description: 'Reduces foe\'s accuracy.' },
    // Poison
    { id: 'poison_sting', name: 'Poison Sting', type: 'Poison', category: 'physical', power: 15, accuracy: 100, pp: 35, description: 'May poison the foe.' },
    { id: 'acid', name: 'Acid', type: 'Poison', category: 'special', power: 40, accuracy: 100, pp: 30, description: 'May lower foe\'s Sp.Def.' },
    { id: 'sludge_bomb', name: 'Sludge Bomb', type: 'Poison', category: 'special', power: 90, accuracy: 100, pp: 10, description: 'May poison the foe.' },
    { id: 'wrap', name: 'Wrap', type: 'Normal', category: 'physical', power: 15, accuracy: 90, pp: 20, description: 'Wraps and squeezes for 4-5 turns.' },
    // Meowth moves
    { id: 'scratch', name: 'Scratch', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 35, description: 'Scratches with sharp claws.' },
    { id: 'bite', name: 'Bite', type: 'Normal', category: 'physical', power: 60, accuracy: 100, pp: 25, description: 'May cause flinching.' },
    { id: 'fury_swipes', name: 'Fury Swipes', type: 'Normal', category: 'physical', power: 18, accuracy: 80, pp: 15, description: 'Hits 2-5 times in a row.' },
    { id: 'pay_day', name: 'Pay Day', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 20, description: 'Coins scatter after hitting.' },
    // Koffing moves
    { id: 'smog', name: 'Smog', type: 'Poison', category: 'special', power: 30, accuracy: 70, pp: 20, description: 'May poison the foe.' },
    { id: 'self_destruct', name: 'Self-Destruct', type: 'Normal', category: 'physical', power: 200, accuracy: 100, pp: 5, description: 'Faints user. Huge damage.' },
    // KADS (Legendary — Psychic)
    { id: 'psywave', name: 'Psywave', type: 'Psychic', category: 'special', power: 70, accuracy: 100, pp: 15, description: 'A wave of telekinetic force.' },
    { id: 'psychic', name: 'Psychic', type: 'Psychic', category: 'special', power: 90, accuracy: 100, pp: 10, effect: 'SP_DEF_DOWN_10', description: 'Powerful telekinesis. May lower Sp.Def.' },
    { id: 'shadow_ball', name: 'Shadow Ball', type: 'Ghost', category: 'special', power: 80, accuracy: 100, pp: 15, description: 'A shadowy blob. May lower Sp.Def.' },
    { id: 'aura_sphere', name: 'Aura Sphere', type: 'Fighting', category: 'special', power: 80, accuracy: 100, pp: 20, description: 'A blast of aura energy. Never misses.' },
    { id: 'recover', name: 'Recover', type: 'Normal', category: 'status', accuracy: 100, pp: 10, effect: 'HEAL_50', description: 'Restores up to half of max HP.' },
    { id: 'future_sight', name: 'Future Sight', type: 'Psychic', category: 'special', power: 120, accuracy: 100, pp: 10, description: 'Foreseen psychic attack hits later.' },
]

// ─── Creatures ────────────────────────────────────────────────────────────────

export const CREATURES: CreatureDef[] = [
    {
        id: 'flameling',
        name: 'Flameling',
        type1: 'Fire',
        baseHp: 45, baseAtk: 52, baseDef: 43, baseSpAtk: 60, baseSpDef: 50, baseSpd: 65,
        spriteKey: 'flameling',
        moves: ['tackle', 'growl', 'ember', 'flamethrower'],
    },
    {
        id: 'aquafin',
        name: 'Aquafin',
        type1: 'Water',
        baseHp: 44, baseAtk: 48, baseDef: 65, baseSpAtk: 50, baseSpDef: 64, baseSpd: 43,
        spriteKey: 'aquafin',
        moves: ['tackle', 'growl', 'water_gun', 'surf'],
    },
    {
        id: 'verdling',
        name: 'Verdling',
        type1: 'Grass',
        baseHp: 45, baseAtk: 49, baseDef: 49, baseSpAtk: 65, baseSpDef: 65, baseSpd: 45,
        spriteKey: 'verdling',
        moves: ['tackle', 'growl', 'vine_whip', 'razor_leaf'],
    },
    {
        id: 'voltpup',
        name: 'Voltpup',
        type1: 'Electric',
        baseHp: 35, baseAtk: 55, baseDef: 40, baseSpAtk: 50, baseSpDef: 50, baseSpd: 90,
        spriteKey: 'voltpup',
        moves: ['tackle', 'quick_attack', 'thunder_shock', 'thunderbolt'],
    },
    {
        id: 'stonebear',
        name: 'Stonebear',
        type1: 'Normal',
        type2: 'Ground',
        baseHp: 70, baseAtk: 80, baseDef: 85, baseSpAtk: 45, baseSpDef: 55, baseSpd: 30,
        spriteKey: 'stonebear',
        moves: ['tackle', 'sand_attack', 'hyper_beam', 'growl'],
    },
    // ── Team Rocket Creatures ─────────────────────────────────────────────
    {
        id: 'snekob',
        name: 'Snekob',
        type1: 'Poison',
        baseHp: 35, baseAtk: 60, baseDef: 44, baseSpAtk: 40, baseSpDef: 54, baseSpd: 55,
        spriteKey: 'snekob',
        moves: ['wrap', 'poison_sting', 'acid', 'bite'],
    },
    {
        id: 'smogon',
        name: 'Smogon',
        type1: 'Poison',
        baseHp: 40, baseAtk: 65, baseDef: 95, baseSpAtk: 60, baseSpDef: 45, baseSpd: 35,
        spriteKey: 'smogon',
        moves: ['tackle', 'smog', 'sludge_bomb', 'self_destruct'],
    },
    {
        id: 'meowth',
        name: 'Meowth',
        type1: 'Normal',
        baseHp: 40, baseAtk: 45, baseDef: 35, baseSpAtk: 40, baseSpDef: 40, baseSpd: 90,
        spriteKey: 'meowth',
        moves: ['scratch', 'bite', 'fury_swipes', 'pay_day'],
    },
    // ── Legendary ─────────────────────────────────────────────────────
    {
        id: 'kads',
        name: 'KADS',
        type1: 'Dragon',
        type2: 'Steel',
        baseHp: 106, baseAtk: 110, baseDef: 90, baseSpAtk: 154, baseSpDef: 90, baseSpd: 130,
        spriteKey: 'kads',
        moves: ['psychic', 'aura_sphere', 'shadow_ball', 'recover'],
    },
]

export const MOVES_MAP: Record<string, MoveDef> = Object.fromEntries(
    MOVES.map((m) => [m.id, m])
)

export const CREATURES_MAP: Record<string, CreatureDef> = Object.fromEntries(
    CREATURES.map((c) => [c.id, c])
)
