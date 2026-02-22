import { useEffect, useRef, useState, useCallback } from 'react'

// ============================================================
// OverworldMap - Pokémon FireRed-Style Town & Routes
//
// World layout (1200 x 1000):
//   Player's House (top-left area)
//   Pokémon Center (center-right)
//   PokéMart (center-left)
//   Town Square with fountain (center)
//   Route exit NORTH  → future route
//   Route exit EAST   → Legendary Forest / Cave
//   Route exit SOUTH  → future route
//   NPCs walking around
//
// Canvas: 800x600, camera follows player
// ============================================================

interface Props {
    onExit: () => void
    onEnterCave: () => void
}

// -- FireRed Town Palette ------------------------------------
const P = {
    // Sky & grass
    skyBlue:     '#88ccff',
    grassGreen:  '#58a848',
    grassLight:  '#68b858',
    grassDark:   '#489038',
    grassFlower: '#78c868',
    // Paths
    pathTan:     '#d8c078',
    pathLight:   '#e8d098',
    pathEdge:    '#c0a858',
    pathDark:    '#b89848',
    // Buildings
    roofRed:     '#c83830',
    roofRedDark: '#a82820',
    roofBlue:    '#3868b8',
    roofBlueDark:'#284888',
    roofGreen:   '#38a838',
    roofGreenDk: '#288828',
    wallWhite:   '#f0e8d8',
    wallCream:   '#e8dcc8',
    wallGray:    '#c8c0b0',
    doorBrown:   '#885830',
    doorDark:    '#684020',
    windowBlue:  '#68a8d8',
    windowLight: '#88c8f0',
    windowFrame: '#484040',
    // Pokémon Center
    pcRoof:      '#e84040',
    pcRoofDark:  '#c03030',
    pcWall:      '#f8f0e0',
    pcDoor:      '#60a0d0',
    // PokéMart
    martRoof:    '#3878c8',
    martRoofDk:  '#2858a0',
    martWall:    '#f0ece0',
    // Fence & decorations
    fenceWood:   '#b08050',
    fenceDark:   '#906840',
    signWood:    '#a07040',
    signFace:    '#e8dcc0',
    // Water / fountain
    waterBlue:   '#4890d0',
    waterLight:  '#68b0e8',
    waterDark:   '#3070a8',
    // Trees
    treeTrunk:   '#886040',
    treeTrunkDk: '#684830',
    treeLeaf:    '#38a038',
    treeLeafLt:  '#48b848',
    treeLeafDk:  '#288828',
    // Flowers
    flowerRed:   '#e85050',
    flowerYellow:'#f8d840',
    flowerWhite: '#f0f0e8',
    flowerPink:  '#f098a8',
    // NPCs
    npcSkin:     '#f0c070',
    npcHair1:    '#483018',
    npcHair2:    '#d88030',
    npcShirt1:   '#e84848',
    npcShirt2:   '#4888d8',
    npcShirt3:   '#48a848',
    npcPants:    '#384888',
    npcPantsDk:  '#283058',
    // Player
    playerSkin:  '#e0b060',
    playerHat:   '#c82020',
    playerShirt: '#c82020',
    playerPants: '#1a2a5a',
    playerShoe:  '#0a0a1a',
    // Misc
    shadow:      'rgba(0,0,0,0.18)',
    black:       '#181818',
    white:       '#f8f8f8',
    textDark:    '#383838',
}

const WORLD_W = 1200
const WORLD_H = 1000
const TILE    = 16
const SPEED   = 2.5
const CAM_LERP = 0.1

interface Rect { x: number; y: number; w: number; h: number }
interface NpcDef {
    x: number; y: number
    dir: 'left'|'right'|'up'|'down'
    moveTimer: number; moveDir: number
    shirtColor: string; hairColor: string
    name: string; dialogue: string
    patrolMinX: number; patrolMaxX: number
    patrolMinY: number; patrolMaxY: number
}

const rectOverlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y

const rgba = (hex: string, a: number) => {
    const n = parseInt(hex.replace('#',''), 16)
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`
}

// ============================================================
// COMPONENT
// ============================================================
export default function OverworldMap({ onExit, onEnterCave }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef  = useRef({
        px: 340, py: 360,
        camX: 0, camY: 0,
        keys: {} as Record<string, boolean>,
        tick: 0,
        facing: 'down' as 'down'|'up'|'left'|'right',
        interacting: false,
        dialogueText: '',
        dialogueTimer: 0,
    })
    const [notice, setNotice] = useState('')
    const [showExitPrompt, setShowExitPrompt] = useState<'cave'|'north'|'south'|null>(null)
    const rafRef = useRef<number>(0)

    // -- Build collision walls --------------------------------
    const buildWalls = useCallback(() => {
        const walls: Rect[] = []
        const add = (x: number, y: number, w: number, h: number) => walls.push({x,y,w,h})

        // World boundaries
        add(0, 0, WORLD_W, 16)                // top
        add(0, WORLD_H-16, WORLD_W, 16)       // bottom
        add(0, 0, 16, WORLD_H)                // left
        add(WORLD_W-16, 0, 16, WORLD_H)       // right

        // === PLAYER'S HOUSE (top-left) ===
        add(80, 100, 180, 120)

        // === POKÉMON CENTER (right side) ===
        add(740, 180, 240, 140)

        // === POKÉMART (left side) ===
        add(80, 440, 200, 120)

        // === PROFESSOR'S LAB (bottom-right) ===
        add(780, 600, 220, 130)

        // === FOUNTAIN (center) ===
        add(480, 380, 80, 80)

        // === FENCE along top route exit ===
        // Leave gap at center for north exit
        add(16, 50, 440, 16)
        add(640, 50, WORLD_W-656, 16)

        // === FENCE along south ===
        add(16, WORLD_H-50, 380, 16)
        add(520, WORLD_H-50, WORLD_W-536, 16)

        // === Trees along edges (decorative collision) ===
        // Top trees
        for (let x = 30; x < 430; x += 60) add(x, 16, 32, 32)
        for (let x = 660; x < WORLD_W-30; x += 60) add(x, 16, 32, 32)
        // Left trees
        for (let y = 300; y < 430; y += 60) add(16, y, 32, 32)
        // Bottom-left trees
        for (let x = 30; x < 370; x += 60) add(x, WORLD_H-48, 32, 32)
        for (let x = 540; x < WORLD_W-30; x += 60) add(x, WORLD_H-48, 32, 32)

        // === Garden fences ===
        add(300, 100, 12, 80)    // fence to right of house
        add(300, 100, 100, 12)   // fence top

        // === Right-side route exit hedge walls ===
        // Opening at y=400-480 for cave exit
        add(WORLD_W-50, 16, 34, 370)
        add(WORLD_W-50, 510, 34, WORLD_H-530)

        return walls
    }, [])

    // -- Build NPCs ------------------------------------------
    const buildNpcs = useCallback((): NpcDef[] => {
        return [
            {
                x: 520, y: 280, dir: 'down', moveTimer: 0, moveDir: 0,
                shirtColor: P.npcShirt1, hairColor: P.npcHair1,
                name: 'Youngster Joey', dialogue: 'My Rattata is in the top percentage of all Rattata!',
                patrolMinX: 460, patrolMaxX: 620, patrolMinY: 250, patrolMaxY: 340,
            },
            {
                x: 860, y: 350, dir: 'left', moveTimer: 0, moveDir: 0,
                shirtColor: P.npcShirt2, hairColor: P.npcHair2,
                name: 'Nurse', dialogue: 'Welcome to the Pokemon Center! We heal your Pokemon to full health.',
                patrolMinX: 820, patrolMaxX: 920, patrolMinY: 335, patrolMaxY: 370,
            },
            {
                x: 180, y: 600, dir: 'right', moveTimer: 0, moveDir: 0,
                shirtColor: P.npcShirt3, hairColor: P.npcHair1,
                name: 'Shopkeeper', dialogue: 'Welcome to the PokeMart! We have Poke Balls and Potions.',
                patrolMinX: 160, patrolMaxX: 240, patrolMinY: 580, patrolMaxY: 640,
            },
            {
                x: 650, y: 700, dir: 'up', moveTimer: 0, moveDir: 0,
                shirtColor: P.npcShirt1, hairColor: P.npcHair2,
                name: 'Prof. Oak', dialogue: 'The cave to the east holds a legendary Pokemon. Be careful!',
                patrolMinX: 600, patrolMaxX: 720, patrolMinY: 660, patrolMaxY: 750,
            },
            {
                x: 1080, y: 440, dir: 'left', moveTimer: 0, moveDir: 0,
                shirtColor: '#886644', hairColor: '#222222',
                name: 'Cave Guard', dialogue: 'The Legendary Forest lies ahead. Only brave trainers enter...',
                patrolMinX: 1060, patrolMaxX: 1120, patrolMinY: 420, patrolMaxY: 460,
            },
        ]
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        const s = stateRef.current
        const WALLS = buildWalls()
        const NPCS = buildNpcs()

        const onKeyDown = (e: KeyboardEvent) => {
            s.keys[e.key] = true
            if (e.key === 'Escape') onExit()
            if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && showExitPrompt === 'cave') {
                onEnterCave()
            }
        }
        const onKeyUp = (e: KeyboardEvent) => { s.keys[e.key] = false }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)

        // ====================================================
        // DRAW HELPERS
        // ====================================================

        function drawGrass(ctx: CanvasRenderingContext2D) {
            // Base grass
            for (let gx = 0; gx < WORLD_W; gx += TILE) {
                for (let gy = 0; gy < WORLD_H; gy += TILE) {
                    const checker = ((gx/TILE + gy/TILE) % 2 === 0)
                    ctx.fillStyle = checker ? P.grassGreen : P.grassLight
                    ctx.fillRect(gx, gy, TILE, TILE)
                }
            }
            // Random grass tufts
            const seed = 42
            for (let i = 0; i < 200; i++) {
                const gx = ((seed + i*137) % (WORLD_W-40)) + 20
                const gy = ((seed + i*97 + 31) % (WORLD_H-40)) + 20
                ctx.fillStyle = rgba(P.grassFlower, 0.35)
                ctx.fillRect(gx, gy, 2, 4)
                ctx.fillRect(gx+1, gy-1, 1, 2)
            }
        }

        function drawPaths(ctx: CanvasRenderingContext2D) {
            ctx.fillStyle = P.pathTan
            // Main horizontal road through center
            ctx.fillRect(16, 360, WORLD_W-32, 80)
            // Vertical road from house down
            ctx.fillRect(320, 100, 60, 340)
            // Vertical road center down to south
            ctx.fillRect(440, 360, 60, WORLD_H-410)
            // Path to Pokémon Center
            ctx.fillRect(700, 360, 280, 60)
            // Path to house
            ctx.fillRect(200, 220, 180, 50)
            // Path to PokéMart
            ctx.fillRect(200, 440, 60, 120)
            // Path to Lab
            ctx.fillRect(700, 420, 80, 280)
            // Path to east exit (cave)
            ctx.fillRect(WORLD_W - 200, 400, 200, 80)

            // Path edges
            ctx.strokeStyle = rgba(P.pathEdge, 0.4)
            ctx.lineWidth = 1
            // horizontal main road edges
            ctx.beginPath(); ctx.moveTo(16,360); ctx.lineTo(WORLD_W-16,360); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(16,440); ctx.lineTo(WORLD_W-16,440); ctx.stroke()

            // Pebbles on paths
            ctx.fillStyle = rgba(P.pathDark, 0.3)
            for (let i = 0; i < 80; i++) {
                const px2 = 30 + ((i*173+7) % (WORLD_W-60))
                const py2 = 365 + ((i*97+13) % 70)
                ctx.beginPath(); ctx.ellipse(px2, py2, 2, 1.3, 0, 0, Math.PI*2); ctx.fill()
            }
        }

        function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size = 1) {
            // Shadow
            ctx.fillStyle = P.shadow
            ctx.beginPath(); ctx.ellipse(x, y+12*size, 14*size, 5*size, 0, 0, Math.PI*2); ctx.fill()
            // Trunk
            ctx.fillStyle = P.treeTrunk
            ctx.fillRect(x-4*size, y-8*size, 8*size, 20*size)
            ctx.fillStyle = P.treeTrunkDk
            ctx.fillRect(x-4*size, y-8*size, 3*size, 20*size)
            // Crown layers
            const cols = [P.treeLeafDk, P.treeLeaf, P.treeLeafLt]
            const offsets = [
                {ox:0, oy:-20, r:16}, {ox:-6, oy:-16, r:12}, {ox:6, oy:-16, r:12},
                {ox:0, oy:-26, r:12}, {ox:-4, oy:-30, r:9}, {ox:4, oy:-30, r:9},
            ]
            offsets.forEach((o, i) => {
                ctx.fillStyle = cols[i % cols.length]
                ctx.beginPath()
                ctx.arc(x+o.ox*size, y+o.oy*size, o.r*size, 0, Math.PI*2)
                ctx.fill()
            })
        }

        function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
            ctx.fillStyle = '#48a048'
            ctx.fillRect(x, y+2, 1, 4)
            ctx.fillStyle = color
            for (let i = 0; i < 4; i++) {
                const a = (i/4)*Math.PI*2
                ctx.beginPath()
                ctx.arc(x + Math.cos(a)*2.5, y + Math.sin(a)*2.5, 2, 0, Math.PI*2)
                ctx.fill()
            }
            ctx.fillStyle = P.flowerYellow
            ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI*2); ctx.fill()
        }

        function drawFence(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, horizontal = true) {
            if (horizontal) {
                for (let fx = x; fx < x+w; fx += 16) {
                    // Post
                    ctx.fillStyle = P.fenceWood
                    ctx.fillRect(fx+6, y, 4, 14)
                    ctx.fillStyle = P.fenceDark
                    ctx.fillRect(fx+6, y, 1, 14)
                    // Rails
                    ctx.fillStyle = P.fenceWood
                    ctx.fillRect(fx, y+3, 16, 3)
                    ctx.fillRect(fx, y+9, 16, 3)
                }
            } else {
                for (let fy = y; fy < y+w; fy += 16) {
                    ctx.fillStyle = P.fenceWood
                    ctx.fillRect(x, fy+6, 14, 4)
                    ctx.fillStyle = P.fenceDark
                    ctx.fillRect(x, fy+6, 14, 1)
                    ctx.fillStyle = P.fenceWood
                    ctx.fillRect(x+3, fy, 3, 16)
                    ctx.fillRect(x+9, fy, 3, 16)
                }
            }
        }

        function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
            // Post
            ctx.fillStyle = P.signWood
            ctx.fillRect(x+10, y+14, 4, 12)
            // Sign face
            ctx.fillStyle = P.signFace
            ctx.fillRect(x, y, 24, 16)
            ctx.strokeStyle = P.signWood; ctx.lineWidth = 1.5
            ctx.strokeRect(x, y, 24, 16)
            // Text
            ctx.fillStyle = P.textDark; ctx.font = 'bold 5px monospace'; ctx.textAlign = 'center'
            ctx.fillText(text, x+12, y+10); ctx.textAlign = 'left'
        }

        // ====================================================
        // BUILDINGS
        // ====================================================

        function drawPlayerHouse(ctx: CanvasRenderingContext2D) {
            const bx = 80, by = 100, bw = 180, bh = 120
            // Shadow
            ctx.fillStyle = P.shadow
            ctx.fillRect(bx+6, by+bh-4, bw, 10)
            // Wall
            const wG = ctx.createLinearGradient(bx, by, bx, by+bh)
            wG.addColorStop(0, P.wallWhite); wG.addColorStop(1, P.wallCream)
            ctx.fillStyle = wG; ctx.fillRect(bx, by+30, bw, bh-30)
            // Roof
            ctx.fillStyle = P.roofRed
            ctx.beginPath()
            ctx.moveTo(bx-12, by+32); ctx.lineTo(bx+bw/2, by); ctx.lineTo(bx+bw+12, by+32)
            ctx.closePath(); ctx.fill()
            ctx.fillStyle = P.roofRedDark
            ctx.beginPath()
            ctx.moveTo(bx-12, by+32); ctx.lineTo(bx+bw/2, by+8); ctx.lineTo(bx+bw+12, by+32)
            ctx.closePath(); ctx.fill()
            // Roof edge
            ctx.fillStyle = P.roofRedDark; ctx.fillRect(bx-12, by+28, bw+24, 6)
            // Door
            ctx.fillStyle = P.doorBrown; ctx.fillRect(bx+bw/2-14, by+bh-42, 28, 42)
            ctx.fillStyle = P.doorDark; ctx.fillRect(bx+bw/2-14, by+bh-42, 28, 4)
            // Door knob
            ctx.fillStyle = '#d4a838'; ctx.beginPath()
            ctx.arc(bx+bw/2+8, by+bh-20, 2.5, 0, Math.PI*2); ctx.fill()
            // Windows
            const drawWin = (wx: number, wy: number) => {
                ctx.fillStyle = P.windowFrame; ctx.fillRect(wx-1, wy-1, 26, 22)
                ctx.fillStyle = P.windowBlue; ctx.fillRect(wx, wy, 24, 20)
                ctx.fillStyle = P.windowLight; ctx.fillRect(wx+2, wy+2, 8, 8)
                ctx.strokeStyle = P.windowFrame; ctx.lineWidth = 1
                ctx.beginPath(); ctx.moveTo(wx+12, wy); ctx.lineTo(wx+12, wy+20); ctx.stroke()
                ctx.beginPath(); ctx.moveTo(wx, wy+10); ctx.lineTo(wx+24, wy+10); ctx.stroke()
            }
            drawWin(bx+16, by+50); drawWin(bx+bw-40, by+50)
            // Chimney
            ctx.fillStyle = P.roofRedDark; ctx.fillRect(bx+bw-40, by-8, 16, 22)
            ctx.fillStyle = '#666'; ctx.fillRect(bx+bw-42, by-12, 20, 6)
            // Mat
            ctx.fillStyle = '#b08850'; ctx.fillRect(bx+bw/2-18, by+bh-4, 36, 6)
            // Label
            ctx.fillStyle = P.textDark; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'
            ctx.fillText('HOME', bx+bw/2, by+bh+16); ctx.textAlign = 'left'
        }

        function drawPokemonCenter(ctx: CanvasRenderingContext2D) {
            const bx = 740, by = 180, bw = 240, bh = 140
            // Shadow
            ctx.fillStyle = P.shadow; ctx.fillRect(bx+6, by+bh-4, bw, 10)
            // Wall
            ctx.fillStyle = P.pcWall; ctx.fillRect(bx, by+35, bw, bh-35)
            // Roof
            ctx.fillStyle = P.pcRoof
            ctx.fillRect(bx-8, by+25, bw+16, 14)
            ctx.fillStyle = P.pcRoofDark
            ctx.beginPath()
            ctx.moveTo(bx-8, by+27); ctx.lineTo(bx+bw/2, by+4)
            ctx.lineTo(bx+bw+8, by+27); ctx.closePath(); ctx.fill()
            ctx.fillStyle = P.pcRoof
            ctx.beginPath()
            ctx.moveTo(bx-8, by+27); ctx.lineTo(bx+bw/2, by+10)
            ctx.lineTo(bx+bw+8, by+27); ctx.closePath(); ctx.fill()
            // Door (wider, blue sliding)
            ctx.fillStyle = P.pcDoor; ctx.fillRect(bx+bw/2-20, by+bh-50, 40, 50)
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(bx+bw/2, by+bh-48); ctx.lineTo(bx+bw/2, by+bh); ctx.stroke()
            // P logo circle
            ctx.fillStyle = '#ffffff'
            ctx.beginPath(); ctx.arc(bx+bw/2, by+18, 12, 0, Math.PI*2); ctx.fill()
            ctx.fillStyle = P.pcRoof; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'
            ctx.fillText('P', bx+bw/2, by+23); ctx.textAlign = 'left'
            // Windows
            ctx.fillStyle = P.windowFrame
            ctx.fillRect(bx+20, by+50, 28, 24); ctx.fillRect(bx+bw-48, by+50, 28, 24)
            ctx.fillStyle = P.windowBlue
            ctx.fillRect(bx+21, by+51, 26, 22); ctx.fillRect(bx+bw-47, by+51, 26, 22)
            ctx.fillStyle = P.windowLight
            ctx.fillRect(bx+23, by+53, 10, 8); ctx.fillRect(bx+bw-45, by+53, 10, 8)
            // Cross on windows (Pokémon Center style)
            ctx.strokeStyle = P.windowFrame; ctx.lineWidth = 1
            ;[bx+34, bx+bw-34].forEach(wx => {
                ctx.beginPath(); ctx.moveTo(wx, by+51); ctx.lineTo(wx, by+73); ctx.stroke()
                ctx.beginPath(); ctx.moveTo(wx-13, by+62); ctx.lineTo(wx+13, by+62); ctx.stroke()
            })
            // Label
            ctx.fillStyle = P.pcRoof; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'
            ctx.fillText('POKEMON CENTER', bx+bw/2, by+bh+14); ctx.textAlign = 'left'
        }

        function drawPokeMart(ctx: CanvasRenderingContext2D) {
            const bx = 80, by = 440, bw = 200, bh = 120
            // Shadow
            ctx.fillStyle = P.shadow; ctx.fillRect(bx+6, by+bh-4, bw, 10)
            // Wall
            ctx.fillStyle = P.martWall; ctx.fillRect(bx, by+30, bw, bh-30)
            // Roof
            ctx.fillStyle = P.martRoof
            ctx.fillRect(bx-8, by+22, bw+16, 12)
            ctx.fillStyle = P.martRoofDk
            ctx.beginPath()
            ctx.moveTo(bx-8, by+24); ctx.lineTo(bx+bw/2, by+2)
            ctx.lineTo(bx+bw+8, by+24); ctx.closePath(); ctx.fill()
            ctx.fillStyle = P.martRoof
            ctx.beginPath()
            ctx.moveTo(bx-8, by+24); ctx.lineTo(bx+bw/2, by+8)
            ctx.lineTo(bx+bw+8, by+24); ctx.closePath(); ctx.fill()
            // Door
            ctx.fillStyle = P.doorBrown; ctx.fillRect(bx+bw/2-14, by+bh-44, 28, 44)
            ctx.fillStyle = P.doorDark; ctx.fillRect(bx+bw/2-14, by+bh-44, 28, 4)
            // Logo
            ctx.fillStyle = '#ffffff'
            ctx.beginPath(); ctx.arc(bx+bw/2, by+16, 10, 0, Math.PI*2); ctx.fill()
            ctx.fillStyle = P.martRoof; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'
            ctx.fillText('M', bx+bw/2, by+20); ctx.textAlign = 'left'
            // Windows
            ctx.fillStyle = P.windowFrame
            ctx.fillRect(bx+16, by+48, 24, 20); ctx.fillRect(bx+bw-40, by+48, 24, 20)
            ctx.fillStyle = P.windowBlue
            ctx.fillRect(bx+17, by+49, 22, 18); ctx.fillRect(bx+bw-39, by+49, 22, 18)
            // Awning stripes
            ctx.fillStyle = P.martRoof; ctx.fillRect(bx, by+30, bw, 6)
            for (let sx = bx; sx < bx+bw; sx += 12) {
                ctx.fillStyle = (sx/12)%2===0 ? P.martRoof : '#ffffff'
                ctx.fillRect(sx, by+30, 12, 6)
            }
            // Label
            ctx.fillStyle = P.martRoof; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'
            ctx.fillText('POKEMART', bx+bw/2, by+bh+14); ctx.textAlign = 'left'
        }

        function drawProfLab(ctx: CanvasRenderingContext2D) {
            const bx = 780, by = 600, bw = 220, bh = 130
            // Shadow
            ctx.fillStyle = P.shadow; ctx.fillRect(bx+6, by+bh-4, bw, 10)
            // Wall
            ctx.fillStyle = P.wallGray; ctx.fillRect(bx, by+35, bw, bh-35)
            ctx.fillStyle = P.wallWhite; ctx.fillRect(bx+4, by+38, bw-8, bh-42)
            // Roof
            ctx.fillStyle = P.roofGreen
            ctx.fillRect(bx-10, by+26, bw+20, 12)
            ctx.fillStyle = P.roofGreenDk
            ctx.beginPath()
            ctx.moveTo(bx-10, by+28); ctx.lineTo(bx+bw/2, by+2)
            ctx.lineTo(bx+bw+10, by+28); ctx.closePath(); ctx.fill()
            ctx.fillStyle = P.roofGreen
            ctx.beginPath()
            ctx.moveTo(bx-10, by+28); ctx.lineTo(bx+bw/2, by+8)
            ctx.lineTo(bx+bw+10, by+28); ctx.closePath(); ctx.fill()
            // Door
            ctx.fillStyle = P.doorBrown; ctx.fillRect(bx+bw/2-16, by+bh-46, 32, 46)
            ctx.fillStyle = P.doorDark; ctx.fillRect(bx+bw/2-16, by+bh-46, 32, 4)
            // Lab windows (tall)
            ;[bx+20, bx+bw-44].forEach(wx => {
                ctx.fillStyle = P.windowFrame; ctx.fillRect(wx-1, by+44, 26, 36)
                ctx.fillStyle = P.windowBlue; ctx.fillRect(wx, by+45, 24, 34)
                ctx.fillStyle = P.windowLight; ctx.fillRect(wx+2, by+47, 8, 12)
                ctx.strokeStyle = P.windowFrame; ctx.lineWidth = 1
                ctx.beginPath(); ctx.moveTo(wx+12, by+45); ctx.lineTo(wx+12, by+79); ctx.stroke()
            })
            // Label
            ctx.fillStyle = P.roofGreenDk; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'
            ctx.fillText("PROF. OAK'S LAB", bx+bw/2, by+bh+14); ctx.textAlign = 'left'
        }

        function drawFountain(ctx: CanvasRenderingContext2D, tick: number) {
            const fx = 480, fy = 380, fw = 80, fh = 80
            // Base pool
            ctx.fillStyle = P.wallGray
            ctx.beginPath(); ctx.ellipse(fx+fw/2, fy+fh/2+8, fw/2+8, fh/2-4, 0, 0, Math.PI*2); ctx.fill()
            ctx.fillStyle = P.waterDark
            ctx.beginPath(); ctx.ellipse(fx+fw/2, fy+fh/2+8, fw/2+4, fh/2-8, 0, 0, Math.PI*2); ctx.fill()
            // Water surface with wave
            const wave = Math.sin(tick * 0.04) * 2
            ctx.fillStyle = P.waterBlue
            ctx.beginPath(); ctx.ellipse(fx+fw/2, fy+fh/2+6+wave, fw/2, fh/2-10, 0, 0, Math.PI*2); ctx.fill()
            ctx.fillStyle = P.waterLight
            ctx.beginPath(); ctx.ellipse(fx+fw/2-8, fy+fh/2+2+wave, 12, 6, -0.3, 0, Math.PI*2); ctx.fill()
            // Center column
            ctx.fillStyle = P.wallGray; ctx.fillRect(fx+fw/2-6, fy+fh/2-20, 12, 28)
            ctx.fillStyle = '#aaa'; ctx.fillRect(fx+fw/2-8, fy+fh/2-22, 16, 6)
            // Water spout
            const spoutH = 8 + Math.sin(tick*0.08)*3
            ctx.strokeStyle = rgba(P.waterLight, 0.7); ctx.lineWidth = 2
            ctx.beginPath(); ctx.moveTo(fx+fw/2, fy+fh/2-22)
            ctx.quadraticCurveTo(fx+fw/2, fy+fh/2-22-spoutH, fx+fw/2+8, fy+fh/2-8)
            ctx.stroke()
            ctx.beginPath(); ctx.moveTo(fx+fw/2, fy+fh/2-22)
            ctx.quadraticCurveTo(fx+fw/2, fy+fh/2-22-spoutH, fx+fw/2-8, fy+fh/2-8)
            ctx.stroke()
            // Sparkle
            if (tick % 30 < 15) {
                ctx.fillStyle = rgba('#ffffff', 0.6)
                ctx.beginPath(); ctx.arc(fx+fw/2+10, fy+fh/2, 1.5, 0, Math.PI*2); ctx.fill()
            }
        }

        // ====================================================
        // NPC DRAWING
        // ====================================================
        function drawNpc(ctx: CanvasRenderingContext2D, npc: NpcDef, tick: number) {
            const nx = npc.x, ny = npc.y
            const bob = Math.sin(tick*0.06 + nx*0.1) * 0.5
            // Shadow
            ctx.fillStyle = P.shadow
            ctx.beginPath(); ctx.ellipse(nx, ny+8, 7, 3, 0, 0, Math.PI*2); ctx.fill()
            // Shoes
            ctx.fillStyle = P.black
            ctx.fillRect(nx-6, ny+3, 5, 4); ctx.fillRect(nx+1, ny+3, 5, 4)
            // Pants
            ctx.fillStyle = P.npcPants; ctx.fillRect(nx-5, ny-5, 11, 10)
            // Shirt
            ctx.fillStyle = npc.shirtColor; ctx.fillRect(nx-6, ny-14+bob, 12, 11)
            // Arms
            ctx.fillStyle = npc.shirtColor
            ctx.fillRect(nx-8, ny-12+bob, 3, 7); ctx.fillRect(nx+5, ny-12+bob, 3, 7)
            // Hands
            ctx.fillStyle = P.npcSkin
            ctx.beginPath(); ctx.arc(nx-6.5, ny-6+bob, 2, 0, Math.PI*2); ctx.fill()
            ctx.beginPath(); ctx.arc(nx+6.5, ny-6+bob, 2, 0, Math.PI*2); ctx.fill()
            // Head
            ctx.fillStyle = P.npcSkin
            ctx.beginPath(); ctx.arc(nx, ny-19+bob, 6.5, 0, Math.PI*2); ctx.fill()
            // Hair
            ctx.fillStyle = npc.hairColor
            ctx.beginPath(); ctx.arc(nx, ny-22+bob, 6.5, Math.PI, Math.PI*2); ctx.fill()
            ctx.fillRect(nx-6.5, ny-22+bob, 13, 4)
            // Eyes
            ctx.fillStyle = P.black
            ctx.beginPath(); ctx.arc(nx-2.5, ny-19+bob, 1, 0, Math.PI*2); ctx.fill()
            ctx.beginPath(); ctx.arc(nx+2.5, ny-19+bob, 1, 0, Math.PI*2); ctx.fill()
        }

        // ====================================================
        // PLAYER
        // ====================================================
        function drawPlayer(ctx: CanvasRenderingContext2D, tick: number) {
            const px = s.px, py = s.py
            const moving = !!(s.keys['ArrowLeft']||s.keys['ArrowRight']||s.keys['ArrowUp']||s.keys['ArrowDown']
                ||s.keys['a']||s.keys['d']||s.keys['w']||s.keys['s']
                ||s.keys['A']||s.keys['D']||s.keys['W']||s.keys['S'])
            const legSwing = moving ? Math.sin(tick*0.3)*4 : 0
            // Shadow
            ctx.fillStyle = P.shadow
            ctx.beginPath(); ctx.ellipse(px, py+8, 8, 3, 0, 0, Math.PI*2); ctx.fill()
            // Shoes
            ctx.fillStyle = P.playerShoe
            ctx.fillRect(px-7, py+3+legSwing, 6, 5)
            ctx.fillRect(px+1, py+3-legSwing, 6, 5)
            // Pants
            ctx.fillStyle = P.playerPants; ctx.fillRect(px-6, py-5, 13, 11)
            // Belt
            ctx.fillStyle = '#221100'; ctx.fillRect(px-6, py-6, 13, 3)
            // Shirt
            ctx.fillStyle = P.playerShirt; ctx.fillRect(px-6, py-16, 13, 13)
            // Collar
            ctx.fillStyle = rgba('#ffffff', 0.4); ctx.fillRect(px-2, py-16, 4, 5)
            // Arms
            ctx.fillStyle = P.playerShirt
            ctx.fillRect(px-9, py-15, 3, 9); ctx.fillRect(px+6, py-15, 3, 9)
            // Hands
            ctx.fillStyle = P.playerSkin
            ctx.beginPath(); ctx.arc(px-7.5, py-7, 2.5, 0, Math.PI*2); ctx.fill()
            ctx.beginPath(); ctx.arc(px+7.5, py-7, 2.5, 0, Math.PI*2); ctx.fill()
            // Head
            ctx.fillStyle = P.playerSkin
            ctx.beginPath(); ctx.arc(px, py-22, 7, 0, Math.PI*2); ctx.fill()
            // Hair
            ctx.fillStyle = '#332200'; ctx.fillRect(px-7, py-29, 14, 6)
            ctx.beginPath(); ctx.arc(px, py-29, 7, Math.PI, Math.PI*2); ctx.fill()
            // Hat
            ctx.fillStyle = P.playerHat
            ctx.fillRect(px-8, py-30, 16, 6); ctx.fillRect(px-6, py-36, 12, 7)
            ctx.fillStyle = rgba('#ffffff', 0.3); ctx.fillRect(px-5, py-35, 10, 2)
            // Eyes
            ctx.fillStyle = P.black
            ctx.beginPath(); ctx.arc(px-3, py-22, 1.2, 0, Math.PI*2); ctx.fill()
            ctx.beginPath(); ctx.arc(px+3, py-22, 1.2, 0, Math.PI*2); ctx.fill()
            // Pokeball
            ctx.fillStyle = '#cc3333'
            ctx.beginPath(); ctx.arc(px+3, py-5, 3, Math.PI, Math.PI*2); ctx.fill()
            ctx.fillStyle = '#dddddd'
            ctx.beginPath(); ctx.arc(px+3, py-5, 3, 0, Math.PI); ctx.fill()
            ctx.strokeStyle = '#111'; ctx.lineWidth = 0.5
            ctx.beginPath(); ctx.arc(px+3, py-5, 3, 0, Math.PI*2); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(px, py-5); ctx.lineTo(px+6, py-5); ctx.stroke()
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px+3, py-5, 1, 0, Math.PI*2); ctx.fill()
        }

        // ====================================================
        // DECORATIONS
        // ====================================================
        function drawDecorations(ctx: CanvasRenderingContext2D, tick: number) {
            // === Trees along world edges ===
            // Top row
            for (let x = 46; x < 430; x += 60) drawTree(ctx, x, 32, 1.1)
            for (let x = 676; x < WORLD_W-20; x += 60) drawTree(ctx, x, 32, 1.1)
            // Left edge
            for (let y = 316; y < 430; y += 60) drawTree(ctx, 32, y, 1.0)
            // Bottom row
            for (let x = 46; x < 370; x += 60) drawTree(ctx, x, WORLD_H-32, 1.0)
            for (let x = 556; x < WORLD_W-20; x += 60) drawTree(ctx, x, WORLD_H-32, 1.0)

            // === Garden trees near house ===
            drawTree(ctx, 76, 240, 0.9)
            drawTree(ctx, 268, 160, 0.8)
            drawTree(ctx, 76, 160, 0.85)

            // === Trees near Pokémon Center ===
            drawTree(ctx, 730, 340, 0.9)
            drawTree(ctx, 988, 340, 0.9)

            // === Trees near lab ===
            drawTree(ctx, 770, 740, 0.85)
            drawTree(ctx, 1008, 740, 0.85)

            // === Decorative trees in open areas ===
            drawTree(ctx, 550, 560, 1.0)
            drawTree(ctx, 420, 700, 0.9)
            drawTree(ctx, 650, 200, 0.95)

            // === Route to cave - eastern trees ===
            for (let y = 100; y < 370; y += 55) drawTree(ctx, WORLD_W-36, y, 1.1)
            for (let y = 530; y < WORLD_H-50; y += 55) drawTree(ctx, WORLD_W-36, y, 1.1)

            // === Fences ===
            // Top boundary fences
            drawFence(ctx, 16, 52, 440)
            drawFence(ctx, 640, 52, WORLD_W-656)
            // Bottom fences
            drawFence(ctx, 16, WORLD_H-48, 380)
            drawFence(ctx, 520, WORLD_H-48, WORLD_W-536)
            // House garden fence
            drawFence(ctx, 302, 102, 80, false)
            drawFence(ctx, 302, 100, 98)

            // === Flowers ===
            const flowerColors = [P.flowerRed, P.flowerYellow, P.flowerWhite, P.flowerPink]
            // Garden flowers
            for (let i = 0; i < 12; i++) {
                const fx = 84 + (i%4)*20, fy = 232 + Math.floor(i/4)*14
                drawFlower(ctx, fx, fy, flowerColors[i%4])
            }
            // Town square flowers
            for (let i = 0; i < 8; i++) {
                const fx = 430 + ((i*31)%140), fy = 340 + ((i*23)%30)
                drawFlower(ctx, fx, fy, flowerColors[i%4])
            }
            for (let i = 0; i < 8; i++) {
                const fx = 430 + ((i*37)%140), fy = 470 + ((i*19)%25)
                drawFlower(ctx, fx, fy, flowerColors[(i+2)%4])
            }
            // Path to cave flowers (wilder)
            for (let i = 0; i < 6; i++) {
                drawFlower(ctx, WORLD_W-180+i*20, 395+((i*13)%15), flowerColors[i%4])
                drawFlower(ctx, WORLD_W-170+i*18, 485+((i*11)%12), flowerColors[(i+1)%4])
            }

            // === Signs ===
            drawSign(ctx, 460, 340, 'TOWN')
            drawSign(ctx, WORLD_W-120, 410, 'CAVE ->')
            drawSign(ctx, 450, 54, 'ROUTE 1')
            drawSign(ctx, 400, WORLD_H-46, 'ROUTE 2')

            // === Lamp posts ===
            const drawLamp = (lx: number, ly: number) => {
                ctx.fillStyle = '#555'; ctx.fillRect(lx-2, ly-24, 4, 24)
                ctx.fillStyle = '#888'; ctx.fillRect(lx-4, ly-28, 8, 6)
                const flicker = 0.7 + 0.3*Math.sin(tick*0.05+lx*0.1)
                const lg = ctx.createRadialGradient(lx, ly-28, 0, lx, ly-28, 30)
                lg.addColorStop(0, rgba('#ffee88', 0.3*flicker))
                lg.addColorStop(1, 'transparent')
                ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly-28, 30, 0, Math.PI*2); ctx.fill()
            }
            drawLamp(430, 390); drawLamp(580, 390)
            drawLamp(430, 450); drawLamp(580, 450)
            drawLamp(350, 250); drawLamp(700, 450)

            // === CAVE ENTRANCE AREA (east exit) ===
            // Dark cave archway
            const caveX = WORLD_W - 60, caveY = 400, caveH = 80
            // Rocky sides
            ctx.fillStyle = '#484040'
            ctx.beginPath()
            ctx.moveTo(caveX-10, caveY+caveH+10)
            ctx.lineTo(caveX-15, caveY-10)
            ctx.quadraticCurveTo(caveX+10, caveY-30, caveX+35, caveY-10)
            ctx.lineTo(caveX+30, caveY+caveH+10)
            ctx.closePath(); ctx.fill()
            // Dark interior
            ctx.fillStyle = '#0a0a12'
            ctx.beginPath()
            ctx.moveTo(caveX-4, caveY+caveH+5)
            ctx.lineTo(caveX-6, caveY+4)
            ctx.quadraticCurveTo(caveX+10, caveY-16, caveX+26, caveY+4)
            ctx.lineTo(caveX+24, caveY+caveH+5)
            ctx.closePath(); ctx.fill()
            // Glow from inside
            const glowP = 0.15 + 0.1*Math.sin(tick*0.03)
            const caveGlow = ctx.createRadialGradient(caveX+10, caveY+caveH*0.5, 0, caveX+10, caveY+caveH*0.5, 40)
            caveGlow.addColorStop(0, rgba('#22cc88', glowP))
            caveGlow.addColorStop(1, 'transparent')
            ctx.fillStyle = caveGlow; ctx.beginPath()
            ctx.arc(caveX+10, caveY+caveH*0.5, 40, 0, Math.PI*2); ctx.fill()
            // Moss
            ctx.fillStyle = rgba('#38a038', 0.4)
            ctx.beginPath(); ctx.ellipse(caveX+10, caveY-8, 18, 5, 0, 0, Math.PI*2); ctx.fill()
            // Warning sign near cave
            ctx.fillStyle = '#a07040'; ctx.fillRect(WORLD_W-130, 426, 4, 18)
            ctx.fillStyle = '#e8dcc0'; ctx.fillRect(WORLD_W-146, 418, 36, 14)
            ctx.strokeStyle = '#a07040'; ctx.lineWidth = 1; ctx.strokeRect(WORLD_W-146, 418, 36, 14)
            ctx.fillStyle = '#c83030'; ctx.font = 'bold 5px monospace'; ctx.textAlign = 'center'
            ctx.fillText('DANGER', WORLD_W-128, 428); ctx.textAlign = 'left'
        }

        // ====================================================
        // HUD
        // ====================================================
        function drawHUD(ctx: CanvasRenderingContext2D, cW: number, cH: number) {
            // Top bar
            ctx.fillStyle = rgba('#1a1a2e', 0.85); ctx.fillRect(0, 0, cW, 32)
            ctx.strokeStyle = rgba('#3060a0', 0.3); ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(cW, 32); ctx.stroke()
            ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#aabbcc'
            ctx.fillText('Pallet Town', 10, 20)
            ctx.fillStyle = '#667788'; ctx.font = '8px monospace'
            ctx.fillText('ESC - Menu', cW-80, 20)
            // Interaction hint
            ctx.fillStyle = '#88aa88'; ctx.font = '7px monospace'
            ctx.fillText('E - Interact', cW-80, 12)

            // Bottom bar
            ctx.fillStyle = rgba('#1a1a2e', 0.85); ctx.fillRect(0, cH-28, cW, 28)
            ctx.strokeStyle = rgba('#3060a0', 0.3); ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(0, cH-28); ctx.lineTo(cW, cH-28); ctx.stroke()
            // Mini-coordinates
            ctx.fillStyle = '#556677'; ctx.font = '7px monospace'
            ctx.fillText(`X:${Math.floor(s.px)} Y:${Math.floor(s.py)}`, 10, cH-10)

            // Dialogue box
            if (s.dialogueTimer > 0) {
                const boxW = 400, boxH = 60
                const bx = (cW-boxW)/2, by = cH - 100
                ctx.fillStyle = rgba('#0f0f1a', 0.95)
                ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 8); ctx.fill()
                ctx.strokeStyle = '#3060a0'; ctx.lineWidth = 2
                ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 8); ctx.stroke()
                ctx.fillStyle = '#ffffff'; ctx.font = '9px monospace'
                // Word-wrap dialogue text
                const words = s.dialogueText.split(' ')
                let line = '', lineY = by + 20
                words.forEach(w => {
                    const test = line + w + ' '
                    if (ctx.measureText(test).width > boxW-30) {
                        ctx.fillText(line, bx+15, lineY)
                        line = w + ' '; lineY += 14
                    } else { line = test }
                })
                ctx.fillText(line, bx+15, lineY)
                // Continue hint
                ctx.fillStyle = '#556677'; ctx.font = '7px monospace'; ctx.textAlign = 'right'
                ctx.fillText('Press E to close', bx+boxW-15, by+boxH-8)
                ctx.textAlign = 'left'
            }
        }

        // ====================================================
        // GAME LOOP
        // ====================================================
        function loop() {
            if (!canvasRef.current) return
            const cW = canvas.width, cH = canvas.height
            s.tick++; const t = s.tick

            // Dialogue timer
            if (s.dialogueTimer > 0) s.dialogueTimer--

            // Movement
            if (s.dialogueTimer <= 0) {
                let dx = 0, dy = 0
                if(s.keys['ArrowLeft']||s.keys['a']||s.keys['A']){dx=-1;s.facing='left'}
                if(s.keys['ArrowRight']||s.keys['d']||s.keys['D']){dx=1;s.facing='right'}
                if(s.keys['ArrowUp']||s.keys['w']||s.keys['W']){dy=-1;s.facing='up'}
                if(s.keys['ArrowDown']||s.keys['s']||s.keys['S']){dy=1;s.facing='down'}
                if(dx!==0&&dy!==0){dx*=0.707;dy*=0.707}
                const nx = s.px+dx*SPEED, ny = s.py+dy*SPEED
                const hitX = WALLS.some(w => rectOverlap({x:nx-7,y:s.py-7,w:14,h:14},w))
                const hitY = WALLS.some(w => rectOverlap({x:s.px-7,y:ny-7,w:14,h:14},w))
                // NPC collision
                const npcHitX = NPCS.some(n => Math.hypot(nx-n.x, s.py-n.y) < 14)
                const npcHitY = NPCS.some(n => Math.hypot(s.px-n.x, ny-n.y) < 14)
                if(!hitX && !npcHitX) s.px = Math.max(7, Math.min(WORLD_W-7, nx))
                if(!hitY && !npcHitY) s.py = Math.max(7, Math.min(WORLD_H-7, ny))
            }

            // NPC interaction (E key)
            if ((s.keys['e']||s.keys['E']) && s.dialogueTimer <= 0) {
                s.keys['e'] = false; s.keys['E'] = false
                const nearby = NPCS.find(n => Math.hypot(s.px-n.x, s.py-n.y) < 35)
                if (nearby) {
                    s.dialogueText = nearby.name + ': "' + nearby.dialogue + '"'
                    s.dialogueTimer = 300  // ~5 seconds
                } else if (s.dialogueTimer > 0) {
                    s.dialogueTimer = 0 // close dialogue
                }
            }

            // NPC patrolling
            NPCS.forEach(npc => {
                npc.moveTimer++
                if (npc.moveTimer > 120 + Math.random()*100) {
                    npc.moveTimer = 0
                    npc.moveDir = Math.floor(Math.random()*5) // 0-3 = move, 4 = stay
                }
                if (npc.moveDir < 4 && npc.moveTimer < 40) {
                    const ndx = [0,0,-1,1][npc.moveDir] * 0.5
                    const ndy = [-1,1,0,0][npc.moveDir] * 0.5
                    const nnx = npc.x + ndx, nny = npc.y + ndy
                    if (nnx >= npc.patrolMinX && nnx <= npc.patrolMaxX &&
                        nny >= npc.patrolMinY && nny <= npc.patrolMaxY &&
                        !WALLS.some(w => rectOverlap({x:nnx-6,y:nny-6,w:12,h:12},w)) &&
                        Math.hypot(nnx-s.px, nny-s.py) > 20) {
                        npc.x = nnx; npc.y = nny
                        npc.dir = (['up','down','left','right'] as const)[npc.moveDir]
                    }
                }
            })

            // -- Zone exit checks --
            // Cave exit (east)
            const caveZone: Rect = {x: WORLD_W-60, y: 400, w: 50, h: 80}
            const playerRect: Rect = {x:s.px-7,y:s.py-7,w:14,h:14}
            const nearCave = rectOverlap(playerRect, caveZone)
            // North exit
            const northZone: Rect = {x: 440, y: 16, w: 200, h: 40}
            const nearNorth = rectOverlap(playerRect, northZone)
            // South exit
            const southZone: Rect = {x: 380, y: WORLD_H-50, w: 140, h: 40}
            const nearSouth = rectOverlap(playerRect, southZone)

            if (nearCave) setShowExitPrompt('cave')
            else if (nearNorth) setShowExitPrompt('north')
            else if (nearSouth) setShowExitPrompt('south')
            else setShowExitPrompt(null)

            // Camera follow player
            const targetCamX = s.px - cW/2
            const targetCamY = s.py - cH/2
            s.camX += (targetCamX - s.camX) * CAM_LERP
            s.camY += (targetCamY - s.camY) * CAM_LERP
            s.camX = Math.max(0, Math.min(WORLD_W-cW, s.camX))
            s.camY = Math.max(0, Math.min(WORLD_H-cH, s.camY))

            // -- RENDER --
            ctx.clearRect(0, 0, cW, cH)
            ctx.save()
            ctx.translate(-s.camX, -s.camY)

            drawGrass(ctx)
            drawPaths(ctx)
            drawFountain(ctx, t)
            drawPlayerHouse(ctx)
            drawPokemonCenter(ctx)
            drawPokeMart(ctx)
            drawProfLab(ctx)
            drawDecorations(ctx, t)
            NPCS.forEach(n => drawNpc(ctx, n, t))
            drawPlayer(ctx, t)

            ctx.restore()
            drawHUD(ctx, cW, cH)

            rafRef.current = requestAnimationFrame(loop)
        }

        rafRef.current = requestAnimationFrame(loop)
        return () => {
            cancelAnimationFrame(rafRef.current)
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onExit, onEnterCave, buildWalls, buildNpcs, showExitPrompt])

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-black">
            <canvas ref={canvasRef} width={800} height={600}
                className="absolute inset-0 m-auto"
                style={{ imageRendering: 'pixelated' }} />

            {/* Notice toast */}
            {notice && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20
                    bg-black/90 border border-blue-900/50 rounded-lg px-4 py-2
                    font-mono text-xs text-blue-300/80 animate-pulse pointer-events-none
                    shadow-lg shadow-blue-950/40">
                    {notice}
                </div>
            )}

            {/* Exit prompt */}
            {showExitPrompt && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20
                    bg-[#0f0f1a]/95 border-2 border-blue-700/60 rounded-xl px-6 py-3
                    font-mono text-sm text-white shadow-2xl shadow-blue-950/60
                    animate-fadeIn flex flex-col items-center gap-2">
                    {showExitPrompt === 'cave' && (
                        <>
                            <span className="text-yellow-400 text-xs tracking-wider uppercase">Legendary Forest</span>
                            <p className="text-gray-300 text-xs text-center">A dark and dangerous path lies ahead...</p>
                            <button onClick={onEnterCave}
                                className="mt-1 bg-green-950 hover:bg-green-800 border border-green-600/60
                                    text-green-300 text-xs font-mono px-5 py-2 rounded-lg transition-all
                                    hover:shadow-lg hover:shadow-green-900/40">
                                Press E or Click to Enter
                            </button>
                        </>
                    )}
                    {showExitPrompt === 'north' && (
                        <>
                            <span className="text-blue-400 text-xs tracking-wider uppercase">Route 1</span>
                            <p className="text-gray-400 text-xs">This route is not yet open...</p>
                        </>
                    )}
                    {showExitPrompt === 'south' && (
                        <>
                            <span className="text-blue-400 text-xs tracking-wider uppercase">Route 2</span>
                            <p className="text-gray-400 text-xs">This route is not yet open...</p>
                        </>
                    )}
                </div>
            )}

            {/* Back button */}
            <button onClick={onExit}
                className="absolute top-3 left-3 z-10 text-xs font-mono text-blue-400/60
                    hover:text-blue-300 bg-black/70 border border-blue-950/50 rounded px-2 py-1
                    transition-colors">
                Back to Lobby
            </button>
        </div>
    )
}
