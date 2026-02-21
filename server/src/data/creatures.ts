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
]

export const MOVES_MAP: Record<string, MoveDef> = Object.fromEntries(
    MOVES.map((m) => [m.id, m])
)

export const CREATURES_MAP: Record<string, CreatureDef> = Object.fromEntries(
    CREATURES.map((c) => [c.id, c])
)
