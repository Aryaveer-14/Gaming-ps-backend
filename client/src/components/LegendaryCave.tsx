import { useEffect, useRef, useState, useCallback } from 'react'

// ============================================================
// LegendaryCave - Dangerous Legendary Forest  (Dark Atmosphere v3)
//
// World layout (800 x 3200):
//   [0 - 400]     Forest Edge      - fading daylight, clean path
//   [400 - 800]   Root Gate        - twisted roots, dimming canopy
//   [800 - 1600]  Zone A - Wilds   - dense dark woods, cracked path
//   [1600 - 2400] Zone B - Trial   - 3 rune stones, ancient danger
//   [2400 - 3200] Zone C - Cave    - legendary cave entrance
//
// Progression: peaceful -> uneasy -> dangerous -> legendary cave
// ============================================================

interface Props { onExit: () => void }

// -- Dark Forest Palette --------------------------------------
const C = {
    // Sky & base tones - darker, bluer
    skyTop:      '#060b10',
    skyMid:      '#0a1218',
    skyForest:   '#0c1610',
    // Grass - deep green / blue-green, desaturated
    grassDark:   '#0e1e12',
    grassMid:    '#162a18',
    grassLight:  '#1e3622',
    grassBlue:   '#10201c',
    grassDead:   '#1a1a14',
    // Path - dark soil
    pathDirt:    '#3a2a16',
    pathLight:   '#4a3620',
    pathEdge:    '#2a1a0c',
    pathCrack:   '#1a1008',
    pathDark:    '#221408',
    pathGlow:    '#2a4a3a',
    // Trees - very dark bark, muted canopy
    treeTrunk:   '#2a1c0e',
    treeBark:    '#1a0e06',
    treeBarkMoss:'#1a2a14',
    treeLeaf1:   '#142a14',
    treeLeaf2:   '#1a3618',
    treeLeaf3:   '#0e1e0e',
    treeLeaf4:   '#1e3a1e',
    treeLeafDead:'#2a2a14',
    // Bushes & undergrowth
    bushGreen:   '#142414',
    bushDark:    '#0a140a',
    bushThorn:   '#2a1a10',
    // Flowers - muted, wilting
    flowerDead:  '#4a4a38',
    flowerPale:  '#6a6a52',
    flowerDark:  '#3a2a4a',
    flowerBlood: '#5a2222',
    // Mushroom - toxic glow
    mushroomR:   '#6a2a18',
    mushroomC:   '#aa8866',
    mushroomGlow:'#44ff88',
    // Rune / shrine
    runeBase:    '#2a2a1e',
    runeGlow:    '#44cc66',
    runeInact:   '#2a3a2a',
    runeActive:  '#66ff88',
    shrineGold:  '#aa8822',
    shrineGlow:  '#44aa44',
    // Aura & legendary
    aura:        '#22aa66',
    auraDark:    '#116633',
    legendary:   '#66cc88',
    legendBody:  '#44aa66',
    // Environment
    waterDark:   '#0a1a2a',
    waterShine:  '#1a3a5a',
    firefly:     '#88cc44',
    fireflyDim:  '#447744',
    // Fog & darkness
    fogColor:    '#0c1a14',
    fogLight:    '#142a1e',
    darkEdge:    '#040808',
    mist:        '#1a2a22',
    // Danger elements
    eyeGlow:     '#ff4422',
    eyeGlowAlt:  '#ffaa00',
    crystalGlow: '#22ccaa',
    crystalDim:  '#115544',
    // Stone
    stone:       '#2a2a22',
    stoneDark:   '#1a1a14',
    stoneMoss:   '#1e2e1e',
    stoneWet:    '#1a2a24',
    // Lantern - dim, flickering
    lanternO:    '#884422',
    lanternY:    '#aa6633',
    lanternDim:  '#553318',
    // Leaves - dark autumn
    leafFall1:   '#2a4a1a',
    leafFall2:   '#3a3a14',
    leafFall3:   '#4a3a18',
    leafDead:    '#2a2218',
    // Player
    trainerSkin: '#e0b060',
    trainerHat:  '#881818',
    trainerShirt:'#881818',
    trainerPants:'#1a2a5a',
    trainerShoe: '#0a0a1a',
}

const WORLD_W = 800
const WORLD_H = 3200
const TILE    = 16
const SPEED   = 3
const CAM_LERP = 0.09

interface Rect { x: number; y: number; w: number; h: number }
interface Particle {
    x: number; y: number; vx: number; vy: number
    life: number; maxLife: number; r: number
    color: string; alpha: number; blink?: number
    rot?: number; rotV?: number
    type?: 'leaf'|'spore'|'firefly'|'aura'|'sparkle'|'fog'|'mist'|'ember'
}

interface LanternDef { x: number; y: number }
interface FootprintDef { x: number; y: number; a: number }
interface GlowingEyeDef { x: number; y: number; blinkT: number; nextBlink: number; visible: boolean; color: string }

const rectOverlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y

const rgba = (hex: string, a: number) => {
    const n = parseInt(hex.replace('#',''), 16)
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`
}

/** Depth-based darkness factor: 0 at top, 1 at bottom */
const depthDark = (worldY: number) => Math.min(1, Math.max(0, worldY / WORLD_H))

// -- Walls (same geometry, preserved layout) ------------------
const WALLS: Rect[] = []
function addWall(x: number, y: number, w: number, h: number) {
    WALLS.push({ x, y, w, h })
}
function buildWalls() {
    WALLS.length = 0
    const pL = WORLD_W/2 - 48, pR = WORLD_W/2 + 48
    addWall(0, 0, pL, 400)
    addWall(pR, 0, WORLD_W - pR, 400)
    addWall(0, 400, 80, 400)
    addWall(WORLD_W - 80, 400, 80, 400)
    addWall(0, 800, 80, 800)
    addWall(WORLD_W - 80, 800, 80, 800)
    const boulders = [
        {x:80,y:880,w:120,h:40},{x:80,y:1000,w:40,h:160},
        {x:200,y:920,w:160,h:40},{x:360,y:880,w:40,h:120},
        {x:440,y:1000,w:200,h:40},{x:640,y:880,w:80,h:160},
        {x:80,y:1160,w:200,h:40},{x:80,y:1300,w:40,h:200},
        {x:600,y:1100,w:120,h:40},{x:600,y:1240,w:40,h:200},
        {x:200,y:1380,w:240,h:40},{x:500,y:1260,w:40,h:160},
        {x:560,y:1440,w:160,h:40},{x:80,y:1520,w:280,h:40},
        {x:500,y:1480,w:220,h:40},
    ]
    boulders.forEach(r => addWall(r.x, r.y, r.w, r.h))
    addWall(0, 1600, 80, 800)
    addWall(WORLD_W-80, 1600, 80, 800)
    const monuments = [
        {x:120,y:1660,w:32,h:80},{x:120,y:1820,w:32,h:60},
        {x:648,y:1660,w:32,h:90},{x:648,y:1840,w:32,h:50},
        {x:120,y:2040,w:32,h:100},{x:648,y:2080,w:32,h:70},
        {x:120,y:2240,w:32,h:60},{x:648,y:2260,w:32,h:80},
    ]
    monuments.forEach(p => addWall(p.x, p.y, p.w, p.h))
    addWall(0, 2400, 90, 800)
    addWall(WORLD_W-90, 2400, 90, 800)
    addWall(90, 2400, WORLD_W-180, 90)
    addWall(90, 3110, WORLD_W-180, 90)
}

// -- Rune stones ----------------------------------------------
interface RuneStone extends Rect { active: boolean; pulseT: number }
const RUNE_STONES: RuneStone[] = []
let BARRIER_Y = 2390
let BARRIER_OPEN = false

function buildRuneStones() {
    RUNE_STONES.length = 0
    BARRIER_OPEN = false
    const defs = [
        { x: 220, y: 1720 },
        { x: 560, y: 1960 },
        { x: 350, y: 2180 },
    ]
    defs.forEach(d => RUNE_STONES.push({
        x: d.x - 18, y: d.y - 18, w: 36, h: 36,
        active: false, pulseT: 0
    }))
}

// -- Lanterns & footprints ------------------------------------
const LANTERNS: LanternDef[] = []
function buildLanterns() {
    LANTERNS.length = 0
    const defs: LanternDef[] = [
        { x: 96, y: 960 }, { x: WORLD_W - 96, y: 960 },
        { x: 96, y: 1200 }, { x: WORLD_W - 96, y: 1200 },
        { x: 96, y: 1440 }, { x: WORLD_W - 96, y: 1440 },
        { x: 96, y: 1720 }, { x: WORLD_W - 96, y: 1720 },
        { x: 96, y: 2000 }, { x: WORLD_W - 96, y: 2000 },
        { x: 96, y: 2280 }, { x: WORLD_W - 96, y: 2280 },
    ]
    defs.forEach(d => LANTERNS.push(d))
}

const FOOTPRINTS: FootprintDef[] = []
function buildFootprints() {
    FOOTPRINTS.length = 0
    const cx = WORLD_W / 2
    for (let y = 40; y < 380; y += 50) {
        FOOTPRINTS.push({ x: cx - 6 + (y % 2) * 12, y, a: Math.PI })
    }
    for (let y = 860; y < 1560; y += 65) {
        FOOTPRINTS.push({ x: cx - 8 + ((y / 65) % 2) * 16, y, a: Math.PI })
    }
    for (let y = 1660; y < 2380; y += 70) {
        FOOTPRINTS.push({ x: cx - 6 + ((y / 70) % 2) * 12, y, a: Math.PI })
    }
}

// -- Glowing eyes (ambient danger) ----------------------------
const GLOWING_EYES: GlowingEyeDef[] = []
function buildGlowingEyes() {
    GLOWING_EYES.length = 0
    const positions = [
        // Zone A - sparse
        { x: 120, y: 920 }, { x: 680, y: 1080 }, { x: 140, y: 1340 },
        { x: 660, y: 1420 },
        // Zone B - more frequent
        { x: 110, y: 1700 }, { x: 690, y: 1780 }, { x: 100, y: 1920 },
        { x: 700, y: 2060 }, { x: 120, y: 2200 }, { x: 680, y: 2340 },
        // Zone C edges
        { x: 110, y: 2520 }, { x: 690, y: 2600 }, { x: 100, y: 2900 },
        { x: 700, y: 2800 },
    ]
    positions.forEach(p => {
        GLOWING_EYES.push({
            x: p.x, y: p.y,
            blinkT: 0,
            nextBlink: 120 + Math.random() * 300,
            visible: false,
            color: Math.random() < 0.7 ? C.eyeGlow : C.eyeGlowAlt,
        })
    })
}

// -- Glow tiles Zone B ----------------------------------------
const GLOW_TILES: Array<Rect & { glow: number }> = []
function buildGlowTiles() {
    GLOW_TILES.length = 0
    const pts = [
        [200,1700],[320,1800],[460,1780],[200,2000],[380,2100],[500,2200]
    ]
    pts.forEach(([x,y]) => GLOW_TILES.push({x:x-TILE,y:y-TILE,w:TILE*2,h:TILE*2,glow:0}))
}

// ============================================================
// DRAWING HELPERS
// ============================================================

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number, isDead = false) {
    const rng = (n: number) => ((seed * 1664525 + n * 1013904223) & 0x7fffffff) / 0x7fffffff
    const trunkH  = size * (isDead ? 0.65 : 0.55)
    const trunkW  = size * (isDead ? 0.18 : 0.20)
    const crownR  = size * (isDead ? 0.38 : 0.48)
    const dd = depthDark(y) * 0.4

    // Exposed roots
    ctx.fillStyle = rgba(C.treeBark, 0.5 - dd*0.2)
    for (let i = 0; i < 3; i++) {
        const rx = x + (rng(i+20) - 0.5) * trunkW * 4
        const rl = 6 + rng(i+21) * 12
        ctx.beginPath()
        ctx.moveTo(x - trunkW*0.3, y)
        ctx.quadraticCurveTo(rx, y + 4, rx + (rx > x ? rl : -rl), y + 2 + rng(i+22)*4)
        ctx.lineWidth = 2 + rng(i+23); ctx.strokeStyle = rgba(C.treeBark, 0.4); ctx.stroke()
    }
    // Root spread
    ctx.fillStyle = rgba(C.treeBark, 0.35)
    ctx.beginPath(); ctx.ellipse(x, y+2, trunkW*2.2, 6, 0, 0, Math.PI*2); ctx.fill()
    // Ground shadow
    ctx.fillStyle = rgba('#000000', 0.3 + dd*0.15)
    ctx.beginPath(); ctx.ellipse(x, y+5, crownR*0.85, crownR*0.25, 0, 0, Math.PI*2); ctx.fill()
    // Trunk with dark gradient
    const trunkG = ctx.createLinearGradient(x - trunkW/2, 0, x + trunkW/2, 0)
    trunkG.addColorStop(0, C.treeBark)
    trunkG.addColorStop(0.35, C.treeTrunk)
    trunkG.addColorStop(0.65, C.treeBarkMoss)
    trunkG.addColorStop(1, C.treeBark)
    ctx.fillStyle = trunkG
    ctx.fillRect(x - trunkW/2, y - trunkH, trunkW, trunkH)
    // Bark cracks
    ctx.strokeStyle = rgba('#000000', 0.4); ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) {
        const bx = x - trunkW*0.4 + rng(i+30)*trunkW*0.8
        const by1 = y - trunkH + rng(i+31)*trunkH*0.3
        ctx.beginPath(); ctx.moveTo(bx, by1)
        ctx.lineTo(bx + (rng(i+32)-0.5)*4, by1 + trunkH*0.5)
        ctx.stroke()
    }
    // Moss patches on trunk
    ctx.fillStyle = rgba(C.treeBarkMoss, 0.45)
    for (let i = 0; i < 2; i++) {
        const my = y - trunkH*0.3 - i*trunkH*0.3
        ctx.beginPath(); ctx.ellipse(x - trunkW*0.3, my, trunkW*0.4, 4, 0, 0, Math.PI*2); ctx.fill()
    }

    if (isDead) {
        // Dead tree - bare twisted branches
        ctx.strokeStyle = C.treeBark; ctx.lineWidth = 2
        for (let i = 0; i < 5; i++) {
            const ba = -Math.PI/2 + (rng(i+40)-0.5)*1.8
            const bl = 12 + rng(i+41)*18
            ctx.beginPath(); ctx.moveTo(x, y - trunkH)
            ctx.lineTo(x + Math.cos(ba)*bl, y - trunkH + Math.sin(ba)*bl)
            ctx.stroke()
        }
    } else {
        // Crown - darker layered circles
        const leafColors = [C.treeLeaf3, C.treeLeaf1, C.treeLeaf2, C.treeLeaf4]
        const offsets = [
            { ox: rng(1)*10-5, oy: crownR*0.08,  r: crownR*0.92 },
            { ox: rng(2)*8-4,  oy: -crownR*0.12, r: crownR*0.95 },
            { ox: rng(3)*6-3,  oy: -crownR*0.32, r: crownR*0.80 },
            { ox: rng(4)*4-2,  oy: -crownR*0.52, r: crownR*0.58 },
        ]
        offsets.forEach(({ ox, oy, r }, i) => {
            ctx.fillStyle = leafColors[i]
            ctx.beginPath()
            ctx.arc(x + ox, y - trunkH*0.55 + oy, r, 0, Math.PI*2)
            ctx.fill()
        })
        // Dark inner shadow on crown
        ctx.fillStyle = rgba('#000000', 0.18 + dd*0.1)
        ctx.beginPath(); ctx.arc(x, y - trunkH*0.55, crownR*0.6, 0, Math.PI*2); ctx.fill()
        // Leaf edge dots - sparse, dark
        ctx.fillStyle = rgba(C.treeLeaf4, 0.6)
        for (let i = 0; i < 6; i++) {
            const a = (i/6)*Math.PI*2 + rng(i+50)*0.3
            const dr = crownR*(0.82 + rng(i+51)*0.12)
            ctx.beginPath()
            ctx.arc(x + Math.cos(a)*dr, y - trunkH*0.55 + Math.sin(a)*dr, 2.5, 0, Math.PI*2)
            ctx.fill()
        }
    }
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, variant = 0) {
    const dd = depthDark(y) * 0.3
    // Dark undergrowth shadow
    ctx.fillStyle = rgba('#000000', 0.3 + dd)
    ctx.beginPath(); ctx.ellipse(x, y+size*0.4, size*1.1, size*0.55, 0, 0, Math.PI*2); ctx.fill()
    // Main body - dark
    ctx.fillStyle = C.bushDark
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = C.bushGreen
    ctx.beginPath(); ctx.arc(x - size*0.4, y - size*0.15, size*0.65, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(x + size*0.4, y - size*0.15, size*0.65, 0, Math.PI*2); ctx.fill()
    // Inner darkness
    ctx.fillStyle = rgba('#000000', 0.2)
    ctx.beginPath(); ctx.arc(x, y + size*0.1, size*0.5, 0, Math.PI*2); ctx.fill()
    if (variant === 1) {
        // Thorny variant
        ctx.strokeStyle = rgba(C.bushThorn, 0.7); ctx.lineWidth = 1.5
        for (let i = 0; i < 5; i++) {
            const a = (i/5)*Math.PI*2 + 0.3
            const sx = x + Math.cos(a)*size*0.7, sy = y + Math.sin(a)*size*0.7
            ctx.beginPath(); ctx.moveTo(sx, sy)
            ctx.lineTo(sx + Math.cos(a)*8, sy + Math.sin(a)*8)
            ctx.stroke()
        }
    } else if (variant === 2) {
        // Broken branches sticking out
        ctx.strokeStyle = rgba(C.treeBark, 0.6); ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(x - size, y - size*0.3)
        ctx.lineTo(x - size - 10, y - size*0.6); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x + size*0.8, y - size*0.5)
        ctx.lineTo(x + size + 8, y - size*0.8); ctx.stroke()
    }
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size = 1, wilted = false) {
    if (wilted) {
        // Wilted: drooping stem, dark petals
        ctx.strokeStyle = rgba(C.treeLeaf3, 0.5); ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x+3*size, y+4*size, x+5*size, y+8*size); ctx.stroke()
        ctx.fillStyle = rgba(color, 0.4)
        for (let i = 0; i < 4; i++) {
            const a = (i/4)*Math.PI*2 + 0.5
            ctx.beginPath()
            ctx.arc(x + Math.cos(a)*3*size, y + Math.sin(a)*3*size + 2*size, 2*size, 0, Math.PI*2)
            ctx.fill()
        }
    } else {
        ctx.fillStyle = color
        for (let i = 0; i < 5; i++) {
            const a = (i/5)*Math.PI*2
            ctx.beginPath()
            ctx.arc(x + Math.cos(a)*4*size, y + Math.sin(a)*4*size, 2.5*size, 0, Math.PI*2)
            ctx.fill()
        }
        ctx.strokeStyle = C.treeLeaf3; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x, y+2*size); ctx.lineTo(x, y+7*size); ctx.stroke()
        ctx.fillStyle = rgba('#887744', 0.7)
        ctx.beginPath(); ctx.arc(x, y, 1.5*size, 0, Math.PI*2); ctx.fill()
    }
}

function drawMushroom(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, glowing = false) {
    ctx.fillStyle = C.mushroomC
    ctx.fillRect(x - size*0.2, y, size*0.4, size*0.6)
    ctx.fillStyle = C.mushroomR
    ctx.beginPath(); ctx.ellipse(x, y, size*0.65, size*0.45, 0, Math.PI, Math.PI*2); ctx.fill()
    ctx.fillStyle = rgba('#ffffff', 0.3)
    ctx.beginPath(); ctx.arc(x - size*0.2, y - size*0.2, size*0.1, 0, Math.PI*2); ctx.fill()
    if (glowing) {
        const mg = ctx.createRadialGradient(x, y, 0, x, y, size*1.8)
        mg.addColorStop(0, rgba(C.mushroomGlow, 0.15))
        mg.addColorStop(1, 'transparent')
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(x, y, size*1.8, 0, Math.PI*2); ctx.fill()
    }
}

function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number, postH = 30) {
    const dd = depthDark(y)
    const flicker = 0.5 + 0.3*Math.sin(tick*0.2 + x*0.07) + 0.2*Math.sin(tick*0.31 + x*0.03)
    const dimFactor = Math.max(0.3, 1 - dd*0.5)
    ctx.fillStyle = C.stoneDark
    ctx.fillRect(x-2, y-postH, 4, postH)
    // Cracked post
    ctx.strokeStyle = rgba('#000000', 0.3); ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(x-1, y-postH+4); ctx.lineTo(x, y-4); ctx.stroke()
    ctx.fillStyle = C.stoneDark
    ctx.beginPath(); ctx.moveTo(x-6,y-postH); ctx.lineTo(x+6,y-postH)
    ctx.lineTo(x+4,y-postH-4); ctx.lineTo(x-4,y-postH-4); ctx.closePath(); ctx.fill()
    const lx = x-5, ly = y-postH-16
    ctx.fillStyle = rgba(C.lanternDim, 0.3*dimFactor)
    ctx.fillRect(lx, ly, 10, 12)
    ctx.strokeStyle = C.stoneDark; ctx.lineWidth = 1
    ctx.strokeRect(lx, ly, 10, 12)
    // Dim flame
    ctx.fillStyle = rgba(C.lanternO, flicker*0.6*dimFactor)
    ctx.beginPath(); ctx.ellipse(x, ly+6, 2.5, 3.5, 0, 0, Math.PI*2); ctx.fill()
    // Weak glow halo
    const lg = ctx.createRadialGradient(x, ly+6, 0, x, ly+6, 22)
    lg.addColorStop(0, rgba(C.lanternO, 0.15*flicker*dimFactor))
    lg.addColorStop(1, 'transparent')
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x, ly+6, 22, 0, Math.PI*2); ctx.fill()
}

function drawArrowMarker(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
    ctx.globalAlpha = alpha * 0.6
    ctx.fillStyle = rgba(C.shrineGold, 0.6)
    ctx.beginPath(); ctx.moveTo(x, y+9); ctx.lineTo(x-6, y-2); ctx.lineTo(x+6, y-2); ctx.closePath(); ctx.fill()
    ctx.globalAlpha = 1
}

function drawFootprint(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, alpha: number) {
    ctx.save(); ctx.globalAlpha = alpha * 0.15
    ctx.fillStyle = C.pathEdge
    ctx.translate(x, y); ctx.rotate(a)
    ctx.beginPath(); ctx.ellipse(-3, 0, 3, 5, 0, 0, Math.PI*2); ctx.fill()
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-4+i*2, -5, 1.5, 0, Math.PI*2); ctx.fill() }
    ctx.restore()
}

function drawStoneArchway(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number) {
    const hw = w/2
    // Weathered, cracked pillars
    ctx.fillStyle = C.stoneDark
    ctx.fillRect(cx-hw-16, y, 16, 55); ctx.fillRect(cx+hw, y, 16, 55)
    // Moss on pillars
    ctx.fillStyle = rgba(C.stoneMoss, 0.4)
    ctx.fillRect(cx-hw-16, y, 16, 10); ctx.fillRect(cx+hw, y, 16, 10)
    // Cracks
    ctx.strokeStyle = rgba('#000000', 0.4); ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx-hw-10, y+8); ctx.lineTo(cx-hw-12, y+35); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx+hw+6, y+12); ctx.lineTo(cx+hw+8, y+40); ctx.stroke()
    // Arch
    ctx.fillStyle = C.stone
    ctx.beginPath()
    ctx.moveTo(cx-hw-16, y); ctx.quadraticCurveTo(cx, y-24, cx+hw+16, y)
    ctx.lineTo(cx+hw+16, y+14); ctx.quadraticCurveTo(cx, y-8, cx-hw-16, y+14)
    ctx.closePath(); ctx.fill()
    // Faint rune glow
    ctx.fillStyle = rgba(C.runeGlow, 0.12)
    ctx.beginPath(); ctx.arc(cx, y-18, 5, 0, Math.PI*2); ctx.fill()
}

function drawVineOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, side: 'left'|'right') {
    const dir = side === 'left' ? 1 : -1
    ctx.strokeStyle = rgba(C.treeLeaf3, 0.7); ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(x, y)
    for (let i = 0; i < len; i += 18) {
        const ox = dir * (Math.sin(i*0.25)*12 + 10)
        ctx.quadraticCurveTo(x+ox, y+i+9, x+dir*(Math.sin((i+9)*0.25)*10+6), y+i+18)
    }
    ctx.stroke()
    // Dark leaves
    ctx.fillStyle = rgba(C.treeLeaf3, 0.6)
    for (let i = 8; i < len; i += 28) {
        const lx = x + dir*(Math.sin(i*0.25)*12+12), ly = y+i
        ctx.beginPath(); ctx.ellipse(lx, ly, 5, 3.5, dir*0.6, 0, Math.PI*2); ctx.fill()
    }
}

function drawTwistedRoot(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, angle: number) {
    ctx.save()
    ctx.translate(x, y); ctx.rotate(angle)
    ctx.strokeStyle = C.treeBark; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, 0)
    ctx.bezierCurveTo(length*0.3, -8, length*0.6, 6, length, -2)
    ctx.stroke()
    ctx.strokeStyle = rgba(C.treeBarkMoss, 0.4); ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(length*0.2, 0)
    ctx.bezierCurveTo(length*0.4, -5, length*0.5, 3, length*0.7, -1)
    ctx.stroke()
    ctx.restore()
}

function drawPathCracks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, density: number) {
    ctx.strokeStyle = rgba(C.pathCrack, 0.5 + density*0.3)
    ctx.lineWidth = 1
    const seed = x * 31 + y * 17
    for (let i = 0; i < Math.floor(3 + density * 5); i++) {
        const cx2 = x + ((seed + i*137) % w)
        const cy2 = y + ((seed + i*97) % 40)
        ctx.beginPath(); ctx.moveTo(cx2, cy2)
        ctx.lineTo(cx2 + ((seed+i*53)%12 - 6), cy2 + ((seed+i*71)%10 - 2))
        ctx.stroke()
    }
}

function drawScatteredRocks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, count: number) {
    const seed = x * 23 + y * 41
    for (let i = 0; i < count; i++) {
        const rx = x + ((seed + i*157) % w)
        const ry = y + ((seed + i*89) % 30) - 5
        const rs = 2 + ((seed + i*53) % 4)
        ctx.fillStyle = rgba(C.stone, 0.6 + ((seed+i*31)%30)/100)
        ctx.beginPath(); ctx.ellipse(rx, ry, rs*1.3, rs*0.8, ((seed+i*17)%30)/10, 0, Math.PI*2); ctx.fill()
    }
}

function drawGlowingMarkings(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number) {
    const pulse = 0.3 + 0.2 * Math.sin(tick * 0.04)
    // Small rune circles on path
    ctx.strokeStyle = rgba(C.pathGlow, pulse); ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.stroke()
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.stroke()
    // Tiny connecting lines
    for (let i = 0; i < 4; i++) {
        const a = (i/4)*Math.PI*2
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a)*6, y + Math.sin(a)*6)
        ctx.lineTo(x + Math.cos(a)*10, y + Math.sin(a)*10)
        ctx.stroke()
    }
    // Center dot
    ctx.fillStyle = rgba(C.runeGlow, pulse * 0.5)
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill()
}

function drawBrokenBranch(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, len: number) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
    ctx.strokeStyle = C.treeBark; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke()
    // Splintered end
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len+5, -3); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len+4, 2); ctx.stroke()
    // Small twig
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(len*0.5, 0); ctx.lineTo(len*0.5+6, -5); ctx.stroke()
    ctx.restore()
}

function drawGlowingEyes(ctx: CanvasRenderingContext2D, eyes: GlowingEyeDef[], tick: number) {
    eyes.forEach(eye => {
        // Update blink timer
        eye.blinkT++
        if (!eye.visible && eye.blinkT > eye.nextBlink) {
            eye.visible = true
            eye.blinkT = 0
        }
        if (eye.visible && eye.blinkT > 40 + Math.random()*30) {
            eye.visible = false
            eye.blinkT = 0
            eye.nextBlink = 180 + Math.random() * 400
        }
        if (!eye.visible) return
        const fadeIn = Math.min(1, eye.blinkT / 15)
        const alpha = fadeIn * (0.5 + 0.3*Math.sin(tick*0.1))
        // Two eyes, small gap
        const spacing = 5
        ;[-spacing/2, spacing/2].forEach(ox => {
            ctx.fillStyle = rgba(eye.color, alpha * 0.8)
            ctx.shadowColor = eye.color; ctx.shadowBlur = 8
            ctx.beginPath(); ctx.ellipse(eye.x + ox, eye.y, 2, 1.5, 0, 0, Math.PI*2); ctx.fill()
        })
        ctx.shadowBlur = 0
        // Faint glow halo
        const eg = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, 18)
        eg.addColorStop(0, rgba(eye.color, alpha * 0.08))
        eg.addColorStop(1, 'transparent')
        ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(eye.x, eye.y, 18, 0, Math.PI*2); ctx.fill()
    })
}

function drawRuneStone(ctx: CanvasRenderingContext2D, rs: RuneStone, tick: number) {
    const idx = RUNE_STONES.indexOf(rs)
    const pulse = rs.active ? (0.6 + 0.4 * Math.sin(tick * 0.08 + idx)) : 0
    const cx = rs.x + rs.w/2, cy = rs.y + rs.h/2
    // Platform glow
    if (rs.active) {
        const platG = ctx.createRadialGradient(cx, rs.y+rs.h, 0, cx, rs.y+rs.h, rs.w*1.6)
        platG.addColorStop(0, rgba(C.runeGlow, 0.2 * pulse))
        platG.addColorStop(1, 'transparent')
        ctx.fillStyle = platG
        ctx.beginPath(); ctx.ellipse(cx, rs.y+rs.h+4, rs.w, 10, 0, 0, Math.PI*2); ctx.fill()
    }
    // Stone body - darker
    const stoneG = ctx.createLinearGradient(rs.x, rs.y, rs.x+rs.w, rs.y+rs.h)
    stoneG.addColorStop(0, rs.active ? '#2a4a2a' : C.stoneDark)
    stoneG.addColorStop(0.5, rs.active ? C.runeBase : '#141414')
    stoneG.addColorStop(1, rs.active ? '#1a3a1a' : '#0e0e0e')
    ctx.fillStyle = stoneG
    ctx.beginPath(); ctx.roundRect(rs.x, rs.y, rs.w, rs.h, 7); ctx.fill()
    // Border
    ctx.strokeStyle = rs.active ? rgba(C.runeGlow, 0.8) : rgba(C.stoneMoss, 0.3)
    ctx.lineWidth = rs.active ? 2 : 1.5
    ctx.stroke()
    // Moss
    ctx.fillStyle = rgba(C.stoneMoss, 0.4); ctx.fillRect(rs.x+3, rs.y, rs.w-6, 5)
    // Rune symbol
    const syms = ['I', 'II', 'III']
    ctx.font = 'bold 14px serif'; ctx.textAlign = 'center'
    ctx.fillStyle = rs.active ? rgba(C.runeGlow, 0.9 + pulse*0.1) : rgba(C.runeInact, 0.3)
    if (rs.active) { ctx.shadowColor = C.runeGlow; ctx.shadowBlur = 12 + pulse*8 }
    ctx.fillText(syms[idx] ?? 'I', cx, rs.y + rs.h * 0.67)
    ctx.shadowBlur = 0
    // Aura
    if (rs.active) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 52)
        g.addColorStop(0, rgba(C.runeGlow, 0.18 * pulse))
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI*2); ctx.fill()
    }
    ctx.textAlign = 'left'
}

// ============================================================
// COMPONENT
// ============================================================
export default function LegendaryCave({ onExit }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef  = useRef({
        px: WORLD_W/2, py: 60,
        camY: 0, zoom: 1.0, targetZoom: 1.0,
        keys: {} as Record<string, boolean>,
        tick: 0,
        facing: 'down' as 'down'|'up'|'left'|'right',
        inputLocked: false,
        allRunesActive: false,
        barrierAlpha: 1.0,
        forestNoticed: false,
        chamberZoomed: false,
        legendaryMet: false,
        particles: [] as Particle[],
        // Audio / atmosphere trigger zone placeholders
        // These flags can be connected to an audio system later
        audioZone: 'calm' as 'calm'|'uneasy'|'danger'|'cave',
        lastAudioTrigger: 0,
    })
    const [encounter, setEncounter] = useState(false)
    const [noticeText, setNoticeText] = useState('')
    const rafRef = useRef<number>(0)

    // -- Particle spawners ------------------------------------

    const spawnFirefly = useCallback(() => {
        const s = stateRef.current
        if (s.py < 600 || s.py > 2500) return
        stateRef.current.particles.push({
            x: 82 + Math.random()*(WORLD_W-164),
            y: 800 + Math.random()*1600,
            vx: (Math.random()-0.5)*0.4,
            vy: -0.15 - Math.random()*0.2,
            life: 220 + Math.random()*150,
            maxLife: 370,
            r: 1.5 + Math.random()*1.2,
            color: Math.random() < 0.7 ? C.firefly : C.fireflyDim,
            alpha: 0.7,
            blink: Math.random()*Math.PI*2,
            type: 'firefly' as const,
        })
    }, [])

    const spawnLeaf = useCallback(() => {
        const colors = [C.leafFall1, C.leafFall2, C.leafFall3, C.leafDead, C.treeLeafDead]
        stateRef.current.particles.push({
            x: 82 + Math.random()*(WORLD_W-164),
            y: 200 + Math.random()*2400,
            vx: (Math.random()-0.5)*0.9,
            vy: 0.3 + Math.random()*0.5,
            life: 280 + Math.random()*200,
            maxLife: 480,
            r: 3 + Math.random()*2.5,
            color: colors[Math.floor(Math.random()*colors.length)],
            alpha: 0.65,
            rot: Math.random()*Math.PI*2,
            rotV: (Math.random()-0.5)*0.07,
            type: 'leaf' as const,
        })
    }, [])

    const spawnFog = useCallback(() => {
        const s = stateRef.current
        stateRef.current.particles.push({
            x: Math.random()*WORLD_W,
            y: s.py - 200 + Math.random()*400,
            vx: (Math.random()-0.5)*0.3,
            vy: -0.05 - Math.random()*0.1,
            life: 400 + Math.random()*300,
            maxLife: 700,
            r: 30 + Math.random()*40,
            color: C.fogColor,
            alpha: 0.08 + depthDark(s.py)*0.06,
            type: 'fog' as const,
        })
    }, [])

    const spawnMist = useCallback(() => {
        // Cave mist - only near Zone C
        const s = stateRef.current
        if (s.py < 2200) return
        stateRef.current.particles.push({
            x: WORLD_W/2 + (Math.random()-0.5)*200,
            y: 2500 + Math.random()*400,
            vx: (Math.random()-0.5)*0.5,
            vy: -0.3 - Math.random()*0.4,
            life: 200 + Math.random()*200,
            maxLife: 400,
            r: 20 + Math.random()*30,
            color: C.mist,
            alpha: 0.12,
            type: 'mist' as const,
        })
    }, [])

    const spawnSpore = useCallback(() => {
        stateRef.current.particles.push({
            x: 82 + Math.random()*(WORLD_W-164),
            y: 800 + Math.random()*1600,
            vx: (Math.random()-0.5)*0.25,
            vy: -0.1 - Math.random()*0.15,
            life: 300 + Math.random()*200,
            maxLife: 500,
            r: 1.2 + Math.random()*0.8,
            color: rgba('#446644', 0.5),
            alpha: 0.35,
            type: 'spore' as const,
        })
    }, [])

    const spawnSacredAura = useCallback(() => {
        const cx = WORLD_W/2, cy = 2800
        const angle = Math.random()*Math.PI*2
        const r = Math.random()*90
        stateRef.current.particles.push({
            x: cx + Math.cos(angle)*r, y: cy + Math.sin(angle)*r,
            vx: (Math.random()-0.5)*0.4, vy: -0.8 - Math.random()*0.6,
            life: 120 + Math.random()*80, maxLife: 200,
            r: 2 + Math.random()*2.5,
            color: Math.random() < 0.4 ? C.aura : Math.random() < 0.6 ? C.crystalGlow : C.auraDark,
            alpha: 0.7,
            type: 'aura' as const,
        })
    }, [])

    const spawnEmber = useCallback(() => {
        // Faint embers near cave entrance
        const s = stateRef.current
        if (s.py < 2300) return
        stateRef.current.particles.push({
            x: WORLD_W/2 + (Math.random()-0.5)*120,
            y: 2750 + Math.random()*100,
            vx: (Math.random()-0.5)*0.3,
            vy: -0.5 - Math.random()*0.4,
            life: 80 + Math.random()*60,
            maxLife: 140,
            r: 1 + Math.random()*1.5,
            color: C.crystalGlow,
            alpha: 0.6,
            type: 'ember' as const,
        })
    }, [])

    const spawnRuneSparkle = useCallback((rs: RuneStone) => {
        for (let i = 0; i < 12; i++) {
            const a = (i/12)*Math.PI*2
            stateRef.current.particles.push({
                x: rs.x+rs.w/2 + Math.cos(a)*20, y: rs.y+rs.h/2 + Math.sin(a)*20,
                vx: Math.cos(a)*1.5, vy: Math.sin(a)*1.5 - 1,
                life: 60, maxLife: 60, r: 2.5,
                color: C.runeGlow, alpha: 1, type: 'sparkle' as const,
            })
        }
    }, [])

    // ========================================================
    // MAIN EFFECT
    // ========================================================
    useEffect(() => {
        buildWalls()
        buildRuneStones()
        buildGlowTiles()
        buildLanterns()
        buildFootprints()
        buildGlowingEyes()
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        const s = stateRef.current

        const onKeyDown = (e: KeyboardEvent) => {
            s.keys[e.key] = true
            if (e.key === 'Escape' && !s.inputLocked) onExit()
        }
        const onKeyUp = (e: KeyboardEvent) => { s.keys[e.key] = false }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)

        // -- Tree/bush layout ---------------------------------
        type TreeDef = { x: number; y: number; size: number; seed: number; dead?: boolean }
        const TREES_ENTRANCE: TreeDef[] = []
        const TREES_ZONE_A: TreeDef[] = []
        const TREES_ZONE_BC: TreeDef[] = []
        const TREES_EXTRA: TreeDef[] = [] // Additional tall border trees

        // Entrance trees - slightly larger, denser
        for (let y = 20; y < 380; y += 50) {
            const pathL = WORLD_W/2 - 48, pathR = WORLD_W/2 + 48
            TREES_ENTRANCE.push({ x: pathL - 28, y, size: 44, seed: y*3+1 })
            TREES_ENTRANCE.push({ x: pathR + 28, y, size: 44, seed: y*3+7 })
            if (y % 100 === 0) {
                TREES_ENTRANCE.push({ x: pathL - 72, y: y+25, size: 36, seed: y })
                TREES_ENTRANCE.push({ x: pathR + 72, y: y+25, size: 36, seed: y+5 })
            }
        }
        // Zone A - thick border, some dead trees
        for (let y = 840; y < 1580; y += 55) {
            TREES_ZONE_A.push({ x: 28, y, size: 42, seed: y+2 })
            TREES_ZONE_A.push({ x: WORLD_W-28, y, size: 42, seed: y+9 })
            if (y % 110 === 0) {
                TREES_ZONE_A.push({ x: 56, y: y+28, size: 32, seed: y+4 })
                TREES_ZONE_A.push({ x: WORLD_W-56, y: y+28, size: 32, seed: y+6 })
            }
            if (y % 220 === 0) {
                TREES_ZONE_A.push({ x: 40, y: y+14, size: 24, seed: y+20, dead: true })
            }
        }
        // Zone BC - darker, tighter
        for (let y = 1660; y < 2380; y += 65) {
            TREES_ZONE_BC.push({ x: 30, y, size: 40, seed: y*5+3 })
            TREES_ZONE_BC.push({ x: WORLD_W-30, y, size: 40, seed: y*5+11 })
            if (y % 130 === 0) {
                TREES_ZONE_BC.push({ x: 58, y: y+32, size: 30, seed: y*5+7, dead: true })
                TREES_ZONE_BC.push({ x: WORLD_W-58, y: y+32, size: 30, seed: y*5+13 })
            }
        }
        // Extra tall trees overlapping screen edges
        for (let y = 100; y < 3100; y += 200) {
            TREES_EXTRA.push({ x: -10, y, size: 56, seed: y*7+1 })
            TREES_EXTRA.push({ x: WORLD_W+10, y, size: 56, seed: y*7+3 })
        }

        type BushDef = { x: number; y: number; r: number; v: number }
        const BUSHES: BushDef[] = [
            // Zone A - uneven, thorny
            {x:155,y:920,r:12,v:1},{x:175,y:1100,r:11,v:2},{x:685,y:960,r:13,v:1},
            {x:695,y:1200,r:11,v:0},{x:115,y:1350,r:12,v:2},{x:625,y:1400,r:13,v:1},
            {x:245,y:1050,r:11,v:1},{x:455,y:1300,r:12,v:2},{x:345,y:870,r:11,v:0},
            {x:525,y:1460,r:12,v:1},{x:175,y:1500,r:11,v:2},{x:605,y:1500,r:13,v:1},
            // Zone B - denser
            {x:235,y:1660,r:10,v:1},{x:565,y:1700,r:10,v:2},{x:195,y:1880,r:11,v:1},
            {x:585,y:2000,r:11,v:0},{x:225,y:2200,r:10,v:2},{x:565,y:2300,r:10,v:1},
            // Extra danger bushes
            {x:110,y:1080,r:14,v:1},{x:690,y:1300,r:14,v:2},
            {x:105,y:1900,r:13,v:1},{x:695,y:2100,r:13,v:2},
        ]

        // ====================================================
        // DRAW ZONE SECTIONS
        // ====================================================

        function drawForestEntrance(ctx: CanvasRenderingContext2D, tick: number) {
            const y0 = 0
            // Sky gradient - lighter at top (last bit of daylight)
            const skyG = ctx.createLinearGradient(0, y0, 0, y0+400)
            skyG.addColorStop(0, '#0e1a14')
            skyG.addColorStop(0.5, '#0a1610')
            skyG.addColorStop(1, C.grassDark)
            ctx.fillStyle = skyG; ctx.fillRect(0, y0, WORLD_W, 400)
            const pathL = WORLD_W/2 - 48, pathR = WORLD_W/2 + 48
            // Grass - slightly dark but still discernible
            ctx.fillStyle = C.grassMid
            ctx.fillRect(0, y0, pathL, 400); ctx.fillRect(pathR, y0, WORLD_W-pathR, 400)
            // Grass blades - subtle movement
            const wave = Math.sin(tick*0.025)*1.8
            ctx.strokeStyle = rgba(C.grassLight, 0.2); ctx.lineWidth=1
            for(let i=0;i<60;i++){
                const gx=((i*173)%(pathL-8)), gy=y0+((i*97)%390)
                ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+wave,gy-6);ctx.stroke()
                const gx2=pathR+((i*131)%(WORLD_W-pathR-8))
                ctx.beginPath();ctx.moveTo(gx2,gy);ctx.lineTo(gx2+wave,gy-6);ctx.stroke()
            }
            // Clean dirt path (top area)
            const pathG = ctx.createLinearGradient(pathL,0,pathR,0)
            pathG.addColorStop(0,rgba(C.pathEdge,0.85))
            pathG.addColorStop(0.2,C.pathDirt)
            pathG.addColorStop(0.5,C.pathLight)
            pathG.addColorStop(0.8,C.pathDirt)
            pathG.addColorStop(1,rgba(C.pathEdge,0.85))
            ctx.fillStyle=pathG; ctx.fillRect(pathL,y0,96,400)
            ctx.strokeStyle=rgba(C.pathEdge,0.5); ctx.lineWidth=1.5
            ctx.beginPath();ctx.moveTo(pathL,y0);ctx.lineTo(pathL,y0+400);ctx.stroke()
            ctx.beginPath();ctx.moveTo(pathR,y0);ctx.lineTo(pathR,y0+400);ctx.stroke()
            // A few pebbles
            ctx.fillStyle=rgba('#554433',0.35)
            for(let i=0;i<18;i++){
                const px2=pathL+8+((i*137)%78), py2=y0+20+((i*97)%360)
                ctx.beginPath();ctx.ellipse(px2,py2,2.5,1.5,0,0,Math.PI*2);ctx.fill()
            }
            // Footprints
            FOOTPRINTS.filter(f=>f.y<400).forEach(f=>drawFootprint(ctx,f.x,f.y,f.a,0.35))
            // Dim direction markers
            ;[100,200,300].forEach(dy2=>{
                const pulse=0.25+0.15*Math.sin(tick*0.03+dy2*0.01)
                drawArrowMarker(ctx,WORLD_W/2,y0+dy2,pulse)
            })
            // Trees + vines - denser
            TREES_ENTRANCE.forEach(t=>drawTree(ctx,t.x,t.y,t.size,t.seed))
            drawVineOverlay(ctx,pathL-55,y0,200,'right')
            drawVineOverlay(ctx,pathR+55,y0,200,'left')
            // Wilted flowers - muted colors
            const flColors=[C.flowerDead,C.flowerPale,C.flowerDark,C.flowerBlood]
            for(let i=0;i<20;i++){
                const fx=5+((i*157)%(pathL-10)), fy=y0+10+((i*83)%380)
                drawFlower(ctx,fx,fy,flColors[i%4],0.8,i%3===0)
            }
            for(let i=0;i<20;i++){
                const fx=pathR+5+((i*163)%(WORLD_W-pathR-10)), fy=y0+10+((i*79)%380)
                drawFlower(ctx,fx,fy,flColors[(i+2)%4],0.8,i%4===0)
            }
            // Mushrooms - some glowing
            ;[{x:pathL-18,y:85,g:false},{x:pathR+22,y:190,g:true},{x:pathL-38,y:310,g:false}].forEach(m=>drawMushroom(ctx,m.x,m.y,9,m.g))
            // Warning signpost - weathered
            ctx.fillStyle='#3a2a14'; ctx.fillRect(WORLD_W/2-2,y0+6,4,30)
            ctx.fillStyle='#5a4020'; ctx.fillRect(WORLD_W/2-32,y0+6,64,22)
            ctx.fillStyle=rgba('#221408',0.6); ctx.fillRect(WORLD_W/2-32,y0+24,64,4)
            // Cracks on sign
            ctx.strokeStyle=rgba('#000000',0.3);ctx.lineWidth=0.5
            ctx.beginPath();ctx.moveTo(WORLD_W/2-20,y0+10);ctx.lineTo(WORLD_W/2-15,y0+22);ctx.stroke()
            ctx.font='bold 6px monospace'; ctx.fillStyle=rgba('#aa8844',0.7); ctx.textAlign='center'
            ctx.fillText('DANGER AHEAD', WORLD_W/2, y0+19); ctx.textAlign='left'
            // Controls hint
            if (s.py < 80) {
                ctx.font='7px monospace'; ctx.fillStyle=rgba('#446644',0.5); ctx.textAlign='center'
                ctx.fillText('WASD / Arrow Keys to move', WORLD_W/2, y0+360); ctx.textAlign='left'
            }
            // Light canopy fog at top
            const fogG=ctx.createLinearGradient(0,y0,0,y0+80)
            fogG.addColorStop(0,rgba(C.fogColor,0.45)); fogG.addColorStop(1,'transparent')
            ctx.fillStyle=fogG; ctx.fillRect(0,y0,WORLD_W,80)
            // Broken branches on ground
            drawBrokenBranch(ctx, pathL-30, y0+150, -0.3, 18)
            drawBrokenBranch(ctx, pathR+25, y0+280, 0.4, 15)
        }

        function drawRootArchway(ctx: CanvasRenderingContext2D, tick: number) {
            const y0 = 400
            // Darker base
            const bgG = ctx.createLinearGradient(0, y0, 0, y0+400)
            bgG.addColorStop(0, C.grassDark); bgG.addColorStop(1, '#080e08')
            ctx.fillStyle = bgG; ctx.fillRect(0,y0,WORLD_W,400)
            const pathL=WORLD_W/2-48, pathR=WORLD_W/2+48
            // Grass texture
            ctx.strokeStyle=rgba(C.grassLight,0.12); ctx.lineWidth=1
            for(let i=0;i<40;i++){
                const gx=((i*177)%(pathL-8)), gy=y0+((i*89)%395)
                ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+1.5,gy-5);ctx.stroke()
                const gx2=pathR+((i*133)%(WORLD_W-pathR-8))
                ctx.beginPath();ctx.moveTo(gx2,gy);ctx.lineTo(gx2+1.5,gy-5);ctx.stroke()
            }
            // Path - beginning to crack
            ctx.fillStyle=C.pathDirt; ctx.fillRect(pathL,y0,96,400)
            drawPathCracks(ctx, pathL, y0+200, 96, 0.3)
            ctx.strokeStyle=rgba(C.pathEdge,0.5); ctx.lineWidth=1.5
            ctx.beginPath();ctx.moveTo(pathL,y0);ctx.lineTo(pathL,y0+400);ctx.stroke()
            ctx.beginPath();ctx.moveTo(pathR,y0);ctx.lineTo(pathR,y0+400);ctx.stroke()
            // Twisted root formations
            const drawRoots=(baseX: number, side: number)=>{
                const rG=ctx.createLinearGradient(baseX-40*side,y0,baseX+10*side,y0+200)
                rG.addColorStop(0,'#1a0e06'); rG.addColorStop(1,'#2a1a0c')
                ctx.fillStyle=rG
                ctx.fillRect(baseX-22*side-14,y0,48,195)
                const branches=[
                    {x:baseX+side*10,y:y0+35,w:72*side,h:20},
                    {x:baseX+side*20,y:y0+95,w:95*side,h:18},
                    {x:baseX+side*6,y:y0+155,w:60*side,h:16},
                ]
                ctx.fillStyle='#1e1208'
                branches.forEach(b=>{
                    ctx.beginPath(); ctx.roundRect(Math.min(b.x,b.x+b.w),b.y,Math.abs(b.w),b.h,5); ctx.fill()
                })
                // Twisted roots crossing near path
                drawTwistedRoot(ctx, baseX+side*30, y0+70, 45*side, side*0.15)
                drawTwistedRoot(ctx, baseX+side*20, y0+140, 38*side, side*0.2)
                drawTwistedRoot(ctx, baseX+side*25, y0+220, 50*side, -side*0.1)
                ctx.fillStyle=rgba(C.grassDark,0.4)
                ctx.fillRect(Math.min(baseX-22*side-14,baseX+22*side-14+48),y0,48,10)
                drawTree(ctx,baseX-side*20,y0+8,58,baseX)
                drawTree(ctx,baseX-side*55,y0-10,50,baseX+2)
                drawVineOverlay(ctx,baseX+side*12,y0+35,310,side>0?'right':'left')
            }
            drawRoots(80,-1); drawRoots(WORLD_W-80,1)
            // Stone archway at transition
            drawStoneArchway(ctx,WORLD_W/2,y0+375,120)
            // Heavy dimming overlay
            const dimG=ctx.createLinearGradient(0,y0,0,y0+400)
            dimG.addColorStop(0,'transparent'); dimG.addColorStop(0.5,rgba('#000000',0.25))
            dimG.addColorStop(1,rgba('#000000',0.6))
            ctx.fillStyle=dimG; ctx.fillRect(0,y0,WORLD_W,400)
            // Zone text - ominous
            ctx.font='bold 8px monospace'; ctx.fillStyle=rgba(C.runeGlow,0.45); ctx.textAlign='center'
            ctx.shadowColor=C.runeGlow; ctx.shadowBlur=6
            ctx.fillText('- THE FORBIDDEN FOREST -',WORLD_W/2,y0+28)
            ctx.shadowBlur=0; ctx.textAlign='left'
            // Dark flowers
            const fcs=[C.flowerDead,C.flowerDark,C.flowerBlood]
            for(let i=0;i<10;i++){
                drawFlower(ctx,10+((i*167)%(pathL-14)),y0+10+((i*89)%385),fcs[i%3],0.7,true)
                drawFlower(ctx,pathR+5+((i*173)%(WORLD_W-pathR-14)),y0+10+((i*83)%385),fcs[(i+1)%3],0.7,i%2===0)
            }
            // Broken branches
            drawBrokenBranch(ctx, 150, y0+120, 0.8, 22)
            drawBrokenBranch(ctx, WORLD_W-160, y0+250, -0.6, 20)
            // Fog thickening
            const fogW = ctx.createLinearGradient(0,y0+300,0,y0+400)
            fogW.addColorStop(0,'transparent'); fogW.addColorStop(1,rgba(C.fogColor,0.3))
            ctx.fillStyle=fogW; ctx.fillRect(0,y0+300,WORLD_W,100)
        }

        function drawZoneA(ctx: CanvasRenderingContext2D, tick: number) {
            const y0 = 800
            // Dark forest floor
            const floorG = ctx.createLinearGradient(0,y0,0,y0+800)
            floorG.addColorStop(0, C.skyForest); floorG.addColorStop(1, '#060e08')
            ctx.fillStyle=floorG; ctx.fillRect(0,y0,WORLD_W,800)
            // Dark checkerboard
            for(let tx=0;tx<WORLD_W;tx+=TILE){
                for(let ty=y0;ty<y0+800;ty+=TILE){
                    const dd2 = depthDark(ty)*0.2
                    ctx.fillStyle=((tx/TILE+ty/TILE)%2===0)
                        ? rgba(C.grassDark, 0.7-dd2) : rgba(C.skyForest, 0.8-dd2)
                    ctx.fillRect(tx,ty,TILE,TILE)
                }
            }
            // Very subtle grass blades
            ctx.strokeStyle=rgba(C.grassLight,0.1); ctx.lineWidth=1
            const wave=Math.sin(tick*0.02)*2
            for(let i=0;i<40;i++){
                const gx=90+((i*173)%(WORLD_W-184)), gy=y0+((i*97)%795)
                ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+wave,gy-6);ctx.stroke()
            }
            // Winding path - cracking, narrowing slightly
            const pathSegs=[
                {x:WORLD_W/2-34,y:y0,w:68,h:165},{x:WORLD_W/2-84,y:y0+145,w:168,h:42},
                {x:WORLD_W/2-84,y:y0+172,w:68,h:165},{x:WORLD_W/2-44,y:y0+316,w:84,h:202},
                {x:WORLD_W/2-124,y:y0+496,w:168,h:42},{x:WORLD_W/2-124,y:y0+524,w:68,h:280},
            ]
            const pSG=ctx.createLinearGradient(WORLD_W/2-50,0,WORLD_W/2+50,0)
            pSG.addColorStop(0,rgba(C.pathEdge,0.7));pSG.addColorStop(0.3,rgba(C.pathDirt,0.85))
            pSG.addColorStop(0.5,C.pathLight);pSG.addColorStop(0.7,rgba(C.pathDirt,0.85))
            pSG.addColorStop(1,rgba(C.pathEdge,0.7))
            ctx.fillStyle=pSG
            pathSegs.forEach(seg=>ctx.fillRect(seg.x,seg.y,seg.w,seg.h))
            // Path cracks - increasing density
            pathSegs.forEach((seg,i) => drawPathCracks(ctx, seg.x, seg.y, seg.w, 0.3 + i*0.12))
            // Scattered rocks on path
            pathSegs.forEach((seg,i) => {
                if(i>1) drawScatteredRocks(ctx, seg.x, seg.y, seg.w, 2+i)
            })
            ctx.strokeStyle=rgba(C.pathEdge,0.25); ctx.lineWidth=1
            pathSegs.forEach(seg=>ctx.strokeRect(seg.x+1,seg.y+1,seg.w-2,seg.h-2))
            // Footprints
            FOOTPRINTS.filter(f=>f.y>=y0&&f.y<y0+800).forEach(f=>drawFootprint(ctx,f.x,f.y,f.a,0.25))
            // Dim arrow markers
            ;[860,1020,1200,1420,1530].forEach(ay=>{
                drawArrowMarker(ctx,WORLD_W/2,ay,0.15+0.1*Math.sin(tick*0.03+ay*0.005))
            })
            // Dark water crossing
            const streamY=y0+62
            const sG=ctx.createLinearGradient(0,streamY,0,streamY+18)
            sG.addColorStop(0,C.waterDark);sG.addColorStop(0.5,rgba(C.waterShine,0.5));sG.addColorStop(1,C.waterDark)
            ctx.fillStyle=sG
            ctx.fillRect(82,streamY,85,18); ctx.fillRect(WORLD_W-167,streamY,85,18)
            // Boulders - darker, moss-covered
            WALLS.filter(w=>w.y>=y0&&w.y<1600&&w.w<300).forEach(b=>{
                const bG=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h)
                bG.addColorStop(0,'#1a2a1a');bG.addColorStop(0.5,'#121e12');bG.addColorStop(1,'#0e1a0e')
                ctx.fillStyle=bG; ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,5);ctx.fill()
                ctx.strokeStyle=rgba('#223322',0.3);ctx.lineWidth=1;ctx.stroke()
                // Heavy moss
                ctx.fillStyle=rgba(C.stoneMoss,0.5);ctx.fillRect(b.x+2,b.y,b.w-4,8)
                // Cracks
                ctx.strokeStyle=rgba('#000000',0.3);ctx.lineWidth=0.5
                ctx.beginPath();ctx.moveTo(b.x+b.w*0.3,b.y+2);ctx.lineTo(b.x+b.w*0.4,b.y+b.h-2);ctx.stroke()
            })
            // Dense dark tree borders
            ctx.fillStyle='#040a04'
            ctx.fillRect(0,y0,80,800); ctx.fillRect(WORLD_W-80,y0,80,800)
            TREES_ZONE_A.forEach(t=>drawTree(ctx,t.x,t.y,t.size,t.seed,!!t.dead))
            // Thorny bushes
            BUSHES.filter((_,i)=>i<14).forEach(b=>drawBush(ctx,b.x,b.y,b.r,b.v))
            // Dim lanterns
            LANTERNS.filter(l=>l.y>=y0&&l.y<1600).forEach(l=>drawLantern(ctx,l.x,l.y,tick))
            // Archways
            drawStoneArchway(ctx,WORLD_W/2,y0+5,108)
            drawStoneArchway(ctx,WORLD_W/2,y0+782,100)
            // Twisted roots crossing near edges
            ;[900,1050,1250,1400].forEach(ry=>{
                drawTwistedRoot(ctx,82,ry,30,0.2)
                drawTwistedRoot(ctx,WORLD_W-82,ry,-30,-0.2)
            })
            // Dark flowers + glowing mushrooms
            const fcs=[C.flowerDead,C.flowerPale,C.flowerDark,C.flowerBlood]
            ;[{x:204,y:860},{x:384,y:900},{x:554,y:1002},{x:162,y:1152},
              {x:644,y:1202},{x:304,y:1302},{x:484,y:1402},{x:354,y:1552},
            ].forEach((f,i)=>drawFlower(ctx,f.x,f.y,fcs[i%4],0.7,i%3===0))
            ;[{x:130,y:900,g:true},{x:670,y:1050,g:false},{x:150,y:1260,g:true},{x:640,y:1380,g:true}].forEach(m=>drawMushroom(ctx,m.x,m.y,9,m.g))
            // Broken branches scattered
            ;[{x:200,y:950,a:0.5,l:16},{x:600,y:1150,a:-0.7,l:18},{x:250,y:1350,a:0.3,l:14},{x:550,y:1500,a:-0.4,l:16}]
                .forEach(b2=>drawBrokenBranch(ctx,b2.x,b2.y,b2.a,b2.l))
            // Zone label
            ctx.font='bold 7px monospace'; ctx.fillStyle=rgba(C.runeGlow,0.35); ctx.textAlign='center'
            ctx.fillText('- DEEP WILDS -',WORLD_W/2,y0+50); ctx.textAlign='left'
            // Progressive darkness overlay
            const darkOverlay = ctx.createLinearGradient(0,y0,0,y0+800)
            darkOverlay.addColorStop(0,'transparent')
            darkOverlay.addColorStop(0.5,rgba('#000000',0.1))
            darkOverlay.addColorStop(1,rgba('#000000',0.25))
            ctx.fillStyle=darkOverlay; ctx.fillRect(0,y0,WORLD_W,800)
        }

        function drawZoneB(ctx: CanvasRenderingContext2D, tick: number) {
            const y0=1600
            // Very dark base
            ctx.fillStyle='#060e08'; ctx.fillRect(0,y0,WORLD_W,800)
            // Floor tiles - barely visible
            for(let tx=80;tx<WORLD_W-80;tx+=TILE){
                for(let ty=y0;ty<y0+800;ty+=TILE){
                    const dd2=depthDark(ty)*0.15
                    ctx.fillStyle=((tx/TILE+ty/TILE)%2===0)?rgba(C.grassDark,0.5-dd2):rgba('#0c180c',0.6-dd2)
                    ctx.fillRect(tx,ty,TILE,TILE)
                }
            }
            // Barely moving grass
            ctx.strokeStyle=rgba(C.grassLight,0.08); ctx.lineWidth=1
            const wave=Math.sin(tick*0.02)*1.5
            for(let i=0;i<20;i++){
                const gx=90+((i*179)%(WORLD_W-184)), gy=y0+((i*101)%795)
                ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+wave,gy-5);ctx.stroke()
            }
            // Center path - darker soil, cracked, rocks
            ctx.fillStyle=rgba(C.pathDark,0.8)
            ctx.fillRect(WORLD_W/2-36,y0,72,800)
            drawPathCracks(ctx, WORLD_W/2-36, y0, 72, 0.7)
            drawPathCracks(ctx, WORLD_W/2-36, y0+300, 72, 0.8)
            drawPathCracks(ctx, WORLD_W/2-36, y0+600, 72, 0.9)
            drawScatteredRocks(ctx, WORLD_W/2-36, y0+100, 72, 6)
            drawScatteredRocks(ctx, WORLD_W/2-36, y0+400, 72, 8)
            // Faint glowing path markings near bottom
            ;[{x:WORLD_W/2-10,y:y0+650},{x:WORLD_W/2+10,y:y0+700},{x:WORLD_W/2,y:y0+750}].forEach(m=>{
                drawGlowingMarkings(ctx,m.x,m.y,tick)
            })
            ctx.strokeStyle=rgba(C.pathEdge,0.3); ctx.lineWidth=1
            ctx.beginPath();ctx.moveTo(WORLD_W/2-36,y0);ctx.lineTo(WORLD_W/2-36,y0+800);ctx.stroke()
            ctx.beginPath();ctx.moveTo(WORLD_W/2+36,y0);ctx.lineTo(WORLD_W/2+36,y0+800);ctx.stroke()
            // Footprints
            FOOTPRINTS.filter(f=>f.y>=y0&&f.y<y0+800).forEach(f=>drawFootprint(ctx,f.x,f.y,f.a,0.2))
            // Dim arrows
            ;[1700,1900,2100,2300].forEach(ay=>{
                drawArrowMarker(ctx,WORLD_W/2,ay,0.12+0.08*Math.sin(tick*0.03+ay*0.004))
            })
            // Very dark walls
            ctx.fillStyle='#020602'
            ctx.fillRect(0,y0,80,800); ctx.fillRect(WORLD_W-80,y0,80,800)
            TREES_ZONE_BC.forEach(t=>drawTree(ctx,t.x,t.y,t.size,t.seed,!!t.dead))
            // Stone monuments - ancient, weathered
            WALLS.filter(w=>w.y>=y0&&w.y<2400&&w.w===32).forEach(p=>{
                const mG=ctx.createLinearGradient(p.x,p.y,p.x+p.w,p.y+p.h)
                mG.addColorStop(0,'#2a2a1e');mG.addColorStop(0.5,'#1a1a12');mG.addColorStop(1,'#0e0e0a')
                ctx.fillStyle=mG; ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,4);ctx.fill()
                ctx.strokeStyle=rgba('#444433',0.25);ctx.lineWidth=1;ctx.stroke()
                // Heavy moss + cracks
                ctx.fillStyle=rgba(C.stoneMoss,0.45);ctx.fillRect(p.x+2,p.y,p.w-4,8)
                ctx.strokeStyle=rgba('#000000',0.35);ctx.lineWidth=0.5
                ctx.beginPath();ctx.moveTo(p.x+p.w*0.4,p.y+5);ctx.lineTo(p.x+p.w*0.5,p.y+p.h-3);ctx.stroke()
                // Faint rune
                ctx.fillStyle=rgba(C.runeInact,0.2);ctx.font='7px serif';ctx.textAlign='center'
                ctx.fillText('R',p.x+p.w/2,p.y+p.h*0.55);ctx.textAlign='left'
            })
            // Bushes - thorny
            BUSHES.filter((_,i)=>i>=14).forEach(b=>drawBush(ctx,b.x,b.y,b.r,b.v))
            // Dim lanterns
            LANTERNS.filter(l=>l.y>=y0&&l.y<2400).forEach(l=>drawLantern(ctx,l.x,l.y,tick,25))
            // Roots crossing
            ;[1650,1800,1950,2100,2250].forEach(ry=>{
                drawTwistedRoot(ctx,82,ry,35,0.15)
                drawTwistedRoot(ctx,WORLD_W-82,ry,-35,-0.15)
            })
            // Zone header
            ctx.font='bold 8px monospace'; ctx.fillStyle=rgba(C.shrineGold,0.4); ctx.textAlign='center'
            ctx.shadowColor=C.shrineGold; ctx.shadowBlur=4
            ctx.fillText('- TRIAL OF THE ANCIENTS -',WORLD_W/2,y0+28)
            ctx.shadowBlur=0; ctx.textAlign='left'
            // Rune progress
            const lit=RUNE_STONES.filter(r=>r.active).length
            if(lit<3){
                ctx.font='6px monospace'; ctx.fillStyle=rgba(C.runeGlow,0.35); ctx.textAlign='center'
                ctx.fillText('Activate all 3 rune stones to proceed',WORLD_W/2,y0+68)
                ctx.textAlign='left'
                RUNE_STONES.forEach((rs,i)=>{
                    const dotX=316+i*84, dotY=y0+52
                    ctx.fillStyle=rs.active?rgba(C.runeGlow,0.7):rgba('#222218',0.7)
                    ctx.beginPath();ctx.arc(dotX,dotY,5,0,Math.PI*2);ctx.fill()
                    ctx.strokeStyle=rgba(C.runeGlow,0.25);ctx.lineWidth=1
                    ctx.beginPath();ctx.arc(dotX,dotY,5,0,Math.PI*2);ctx.stroke()
                    ctx.fillStyle=rgba(C.runeGlow,0.4);ctx.font='6px monospace';ctx.textAlign='center'
                    ctx.fillText(`${i+1}`,dotX,dotY+2);ctx.textAlign='left'
                })
            }
            // Rune stones
            RUNE_STONES.forEach(rs=>drawRuneStone(ctx,rs,tick))
            // Glow tiles
            GLOW_TILES.forEach(t2=>{
                if(t2.glow>0){
                    ctx.fillStyle=rgba(C.shrineGlow,t2.glow*0.3)
                    ctx.strokeStyle=rgba(C.shrineGlow,t2.glow*0.5)
                    ctx.lineWidth=1;ctx.fillRect(t2.x,t2.y,t2.w,t2.h);ctx.strokeRect(t2.x,t2.y,t2.w,t2.h)
                    t2.glow=Math.max(0,t2.glow-0.022)
                }
            })
            // Vine barrier
            const alpha=stateRef.current.barrierAlpha
            if(alpha>0){
                ctx.fillStyle=rgba('#0a1a0a',alpha*0.92)
                ctx.fillRect(90,BARRIER_Y,WORLD_W-180,22)
                for(let bx=92;bx<WORLD_W-92;bx+=22){
                    const pA=alpha*(0.4+0.4*Math.sin(tick*0.08+bx*0.04))
                    ctx.fillStyle=rgba(C.runeInact,pA*0.4)
                    ctx.fillRect(bx,BARRIER_Y+4,18,14)
                }
                ctx.strokeStyle=rgba('#1a3a1a',alpha*0.6);ctx.lineWidth=3
                ctx.beginPath();ctx.moveTo(90,BARRIER_Y+11)
                ctx.bezierCurveTo(300,BARRIER_Y+2,500,BARRIER_Y+20,WORLD_W-90,BARRIER_Y+11)
                ctx.stroke()
                ctx.font='bold 7px monospace';ctx.fillStyle=rgba('#446633',alpha*0.6);ctx.textAlign='center'
                ctx.fillText('>> PATH SEALED - Light the rune stones <<',WORLD_W/2,BARRIER_Y+14)
                ctx.textAlign='left'
            }
            // Darkness overlay
            const darkOv = ctx.createLinearGradient(0,y0,0,y0+800)
            darkOv.addColorStop(0,rgba('#000000',0.1)); darkOv.addColorStop(1,rgba('#000000',0.3))
            ctx.fillStyle=darkOv; ctx.fillRect(0,y0,WORLD_W,800)
        }

        function drawZoneC(ctx: CanvasRenderingContext2D, tick: number) {
            const y0=2400, cx=WORLD_W/2, cy=y0+400
            // Very dark base
            ctx.fillStyle='#030806'; ctx.fillRect(0,y0,WORLD_W,800)
            // Dark forest walls
            ctx.fillStyle='#020503'
            ctx.fillRect(0,y0,90,800);ctx.fillRect(WORLD_W-90,y0,90,800)
            ctx.fillRect(90,y0,WORLD_W-180,90);ctx.fillRect(90,y0+710,WORLD_W-180,90)
            // Radial ground - very dark
            const gndG=ctx.createRadialGradient(cx,cy,0,cx,cy,345)
            gndG.addColorStop(0,'#0e1a10');gndG.addColorStop(0.4,C.grassDark);gndG.addColorStop(1,'#030806')
            ctx.fillStyle=gndG; ctx.fillRect(90,y0+90,WORLD_W-180,620)
            // Dark circular tiles
            const clearR=282
            for(let tx=cx-clearR;tx<cx+clearR;tx+=TILE){
                for(let ty=cy-clearR;ty<cy+clearR;ty+=TILE){
                    if(Math.hypot(tx+TILE/2-cx,ty+TILE/2-cy)<clearR-15){
                        ctx.fillStyle=((Math.floor(tx/TILE)+Math.floor(ty/TILE))%2===0)?rgba(C.grassDark,0.5):'#081008'
                        ctx.fillRect(tx,ty,TILE,TILE)
                    }
                }
            }
            // Ring of dense, dark trees
            for(let a=0;a<Math.PI*2;a+=Math.PI/6){
                const tx=cx+Math.cos(a)*332, ty=cy+Math.sin(a)*322
                if(tx>90&&tx<WORLD_W-90&&ty>y0+90&&ty<y0+710) {
                    drawTree(ctx,tx,ty,48,Math.floor(a*100))
                    // Extra undergrowth
                    drawBush(ctx,tx+15*Math.cos(a+0.5),ty+15*Math.sin(a+0.5),8,1)
                }
            }

            // === CAVE ENTRANCE ===
            const caveY = cy + 20
            const caveW = 120, caveH = 85
            // Rocky opening - large, dark
            // Outer rock formation
            ctx.fillStyle = C.stoneDark
            ctx.beginPath()
            ctx.moveTo(cx-caveW/2-30, caveY+caveH)
            ctx.lineTo(cx-caveW/2-20, caveY-10)
            ctx.quadraticCurveTo(cx-caveW/2, caveY-35, cx-caveW/4, caveY-42)
            ctx.quadraticCurveTo(cx, caveY-52, cx+caveW/4, caveY-42)
            ctx.quadraticCurveTo(cx+caveW/2, caveY-35, cx+caveW/2+20, caveY-10)
            ctx.lineTo(cx+caveW/2+30, caveY+caveH)
            ctx.closePath(); ctx.fill()
            // Inner rock detail
            ctx.fillStyle = C.stone
            ctx.beginPath()
            ctx.moveTo(cx-caveW/2-20, caveY+caveH-5)
            ctx.lineTo(cx-caveW/2-10, caveY)
            ctx.quadraticCurveTo(cx, caveY-40, cx+caveW/2+10, caveY)
            ctx.lineTo(cx+caveW/2+20, caveY+caveH-5)
            ctx.closePath(); ctx.fill()
            // Cave interior - deep dark gradient
            const caveIG = ctx.createRadialGradient(cx, caveY+caveH*0.4, 0, cx, caveY+caveH*0.4, caveW*0.6)
            caveIG.addColorStop(0, '#000000')
            caveIG.addColorStop(0.5, '#020304')
            caveIG.addColorStop(1, '#080a0c')
            ctx.fillStyle = caveIG
            ctx.beginPath()
            ctx.moveTo(cx-caveW/2+5, caveY+caveH-8)
            ctx.lineTo(cx-caveW/2+10, caveY+8)
            ctx.quadraticCurveTo(cx, caveY-28, cx+caveW/2-10, caveY+8)
            ctx.lineTo(cx+caveW/2-5, caveY+caveH-8)
            ctx.closePath(); ctx.fill()
            // Moss on cave rocks
            ctx.fillStyle = rgba(C.stoneMoss, 0.4)
            ctx.beginPath()
            ctx.moveTo(cx-caveW/2-15, caveY-5)
            ctx.quadraticCurveTo(cx, caveY-38, cx+caveW/2+15, caveY-5)
            ctx.quadraticCurveTo(cx, caveY-30, cx-caveW/2-15, caveY-5)
            ctx.closePath(); ctx.fill()
            // Rock cracks
            ctx.strokeStyle = rgba('#000000', 0.5); ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(cx-caveW/2-5, caveY+10); ctx.lineTo(cx-caveW/2-8, caveY+50); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(cx+caveW/2+5, caveY+15); ctx.lineTo(cx+caveW/2+8, caveY+55); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(cx-15, caveY-40); ctx.lineTo(cx-12, caveY-20); ctx.stroke()
            // Glowing crystals - embedded in rock
            const crystalPulse = 0.5 + 0.4*Math.sin(tick*0.04)
            const allRunesLit = stateRef.current.allRunesActive
            const crystalIntensity = allRunesLit ? 1.0 : 0.4
            ;[
                {x:cx-caveW/2+2, y:caveY+12, s:6}, {x:cx-caveW/2+8, y:caveY+35, s:5},
                {x:cx+caveW/2-4, y:caveY+18, s:5}, {x:cx+caveW/2-10, y:caveY+40, s:6},
                {x:cx-20, y:caveY-25, s:4}, {x:cx+15, y:caveY-20, s:4},
            ].forEach(cr => {
                const ca = crystalPulse * crystalIntensity
                // Crystal shape
                ctx.fillStyle = rgba(C.crystalDim, ca * 0.7)
                ctx.beginPath()
                ctx.moveTo(cr.x, cr.y-cr.s); ctx.lineTo(cr.x+cr.s*0.6, cr.y)
                ctx.lineTo(cr.x, cr.y+cr.s*0.6); ctx.lineTo(cr.x-cr.s*0.6, cr.y)
                ctx.closePath(); ctx.fill()
                // Crystal glow
                const cg = ctx.createRadialGradient(cr.x, cr.y, 0, cr.x, cr.y, cr.s*3)
                cg.addColorStop(0, rgba(C.crystalGlow, ca * 0.2 * crystalIntensity))
                cg.addColorStop(1, 'transparent')
                ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cr.x, cr.y, cr.s*3, 0, Math.PI*2); ctx.fill()
            })
            // Cave aura glow - intensifies when runes are lit
            const auraP = allRunesLit ? (0.25+0.15*Math.sin(tick*0.035)) : (0.08+0.05*Math.sin(tick*0.025))
            const caveAura = ctx.createRadialGradient(cx, caveY+caveH*0.3, 0, cx, caveY+caveH*0.3, caveW)
            caveAura.addColorStop(0, rgba(C.crystalGlow, auraP))
            caveAura.addColorStop(0.5, rgba(C.auraDark, auraP*0.4))
            caveAura.addColorStop(1, 'transparent')
            ctx.fillStyle = caveAura
            ctx.beginPath(); ctx.arc(cx, caveY+caveH*0.3, caveW, 0, Math.PI*2); ctx.fill()

            // Sacred glyph circles - dimmer
            const gP=0.12+0.08*Math.sin(tick*0.018)
            ctx.strokeStyle=rgba(C.shrineGold,gP);ctx.lineWidth=2
            ctx.beginPath();ctx.arc(cx,cy,212,0,Math.PI*2);ctx.stroke()
            ctx.strokeStyle=rgba(C.shrineGold,gP*0.5);ctx.lineWidth=1
            ctx.beginPath();ctx.arc(cx,cy,132,0,Math.PI*2);ctx.stroke()
            ctx.beginPath();ctx.arc(cx,cy,60,0,Math.PI*2);ctx.stroke()
            // 8-point star - faint
            for(let i=0;i<8;i++){
                const a=(i/8)*Math.PI*2, a2=((i+4)/8)*Math.PI*2
                ctx.strokeStyle=rgba(C.shrineGold,0.06);ctx.lineWidth=1
                ctx.beginPath()
                ctx.moveTo(cx+Math.cos(a)*212,cy+Math.sin(a)*212)
                ctx.lineTo(cx+Math.cos(a2)*212,cy+Math.sin(a2)*212)
                ctx.stroke()
            }
            // Path leading to cave
            ctx.fillStyle=rgba(C.pathDark,0.6)
            ctx.fillRect(cx-30,cy-220,60,250)
            drawPathCracks(ctx,cx-30,cy-200,60,1.0)
            drawScatteredRocks(ctx,cx-30,cy-180,60,10)
            // Glowing markings on path near cave
            ;[{x:cx-8,y:cy-180},{x:cx+12,y:cy-140},{x:cx,y:cy-100},{x:cx-10,y:cy-60},{x:cx+8,y:cy-20}].forEach(m=>{
                drawGlowingMarkings(ctx,m.x,m.y,tick)
            })
            // Stone archway at entrance
            drawStoneArchway(ctx,cx,cy-205,60)

            // -- Legendary Pokemon sprite (inside cave area) --
            const floatY=caveY+caveH*0.35+4*Math.sin(tick*0.032)
            // Dark aura rings
            ;[60,42].forEach((r,i)=>{
                const ag=ctx.createRadialGradient(cx,floatY,0,cx,floatY,r)
                ag.addColorStop(0,rgba(C.aura,(0.15-i*0.05)+0.08*Math.sin(tick*0.035+i)))
                ag.addColorStop(1,'transparent')
                ctx.fillStyle=ag;ctx.beginPath();ctx.arc(cx,floatY,r,0,Math.PI*2);ctx.fill()
            })
            // Ground shadow
            ctx.fillStyle=rgba('#000000',0.35+0.05*Math.sin(tick*0.032))
            ctx.beginPath();ctx.ellipse(cx,caveY+caveH-10,16,5,0,0,Math.PI*2);ctx.fill()
            // Body - darker, more menacing
            const legG=ctx.createLinearGradient(cx-24,floatY-6,cx+24,floatY+16)
            legG.addColorStop(0,C.auraDark);legG.addColorStop(0.5,C.legendBody);legG.addColorStop(1,C.legendary)
            ctx.fillStyle=legG
            ctx.beginPath();ctx.ellipse(cx,floatY+4,23,14,0,0,Math.PI*2);ctx.fill()
            // Legs
            ctx.fillStyle=C.legendBody
            ;[{x:-12,y:14},{x:-5,y:16},{x:5,y:16},{x:12,y:14}].forEach(l=>{
                ctx.beginPath();ctx.ellipse(cx+l.x,floatY+l.y,3.5,5,0,0,Math.PI*2);ctx.fill()
            })
            // Head
            const hdG=ctx.createRadialGradient(cx,floatY-12,0,cx,floatY-12,14)
            hdG.addColorStop(0,rgba(C.legendary,0.9));hdG.addColorStop(1,C.auraDark)
            ctx.fillStyle=hdG;ctx.beginPath();ctx.ellipse(cx,floatY-11,12,10,0,0,Math.PI*2);ctx.fill()
            // Dark mane
            const maneC=[C.auraDark,'#0e2e1e','#1a4a2a',C.treeLeaf3,'#224422']
            for(let i=0;i<7;i++){
                const ma=-Math.PI/2+(i-3)*0.38+0.05*Math.sin(tick*0.05+i*0.7)
                const mx=cx+Math.cos(ma)*18, my=floatY-11+Math.sin(ma)*14
                ctx.fillStyle=maneC[i%maneC.length]
                ctx.beginPath();ctx.ellipse(mx,my,4.5,9,ma+Math.PI/2,0,0.01+Math.PI*2);ctx.fill()
            }
            // Tail
            ctx.strokeStyle=C.auraDark;ctx.lineWidth=4;ctx.lineCap='round'
            ctx.beginPath()
            ctx.moveTo(cx+23,floatY+4)
            ctx.bezierCurveTo(cx+48,floatY-6+4*Math.sin(tick*0.06),cx+52,floatY-24+3*Math.sin(tick*0.04),cx+38,floatY-32)
            ctx.stroke();ctx.lineCap='butt'
            // Eyes - piercing, glowing
            ;[{ex:-4},{ex:4}].forEach(({ex})=>{
                ctx.fillStyle=rgba(C.eyeGlowAlt,0.9)
                ctx.shadowColor=C.eyeGlowAlt;ctx.shadowBlur=12
                ctx.beginPath();ctx.ellipse(cx+ex,floatY-12,2.5,1.8,0,0,Math.PI*2);ctx.fill()
                ctx.fillStyle='#ffffff';ctx.shadowBlur=0
                ctx.beginPath();ctx.arc(cx+ex-0.6,floatY-12.5,1,0,Math.PI*2);ctx.fill()
            })
            ctx.shadowBlur=0
            // Diamond mark
            ctx.fillStyle=rgba(C.shrineGold,0.6)
            ctx.beginPath();ctx.moveTo(cx,floatY-20);ctx.lineTo(cx+2.5,floatY-16)
            ctx.lineTo(cx,floatY-12);ctx.lineTo(cx-2.5,floatY-16);ctx.closePath();ctx.fill()
            // Name label
            ctx.font='bold 7px monospace';ctx.textAlign='center'
            ctx.fillStyle=rgba(C.legendary,0.7)
            ctx.shadowColor=C.auraDark;ctx.shadowBlur=8
            ctx.fillText('LEGENDARY',cx,floatY-34)
            ctx.shadowBlur=0;ctx.textAlign='left'
            // Zone label
            ctx.font='bold 8px monospace';ctx.fillStyle=rgba(C.shrineGold,0.35);ctx.textAlign='center'
            ctx.shadowColor=C.shrineGold;ctx.shadowBlur=4
            ctx.fillText('- THE CAVE OF LEGENDS -',cx,y0+38)
            ctx.shadowBlur=0;ctx.textAlign='left'
            // Approach prompt
            if(!stateRef.current.legendaryMet){
                const dist=Math.hypot(stateRef.current.px-cx,stateRef.current.py-cy)
                if(dist<135){
                    const pA=Math.max(0,1-(dist/135))
                    ctx.font='bold 7px monospace';ctx.fillStyle=rgba(C.crystalGlow,pA*0.7);ctx.textAlign='center'
                    ctx.fillText('Something stirs within...',cx,cy-85)
                    ctx.textAlign='left'
                }
            }
            // Heavy darkness overlay for entire zone
            const zoneOv = ctx.createRadialGradient(cx,cy,80,cx,cy,400)
            zoneOv.addColorStop(0,'transparent'); zoneOv.addColorStop(1,rgba('#000000',0.4))
            ctx.fillStyle=zoneOv; ctx.fillRect(0,y0,WORLD_W,800)
        }

        // ====================================================
        // PARTICLE RENDERER
        // ====================================================
        function drawParticles(ctx: CanvasRenderingContext2D, tick: number) {
            s.particles.forEach(p=>{
                const t2=p.life/p.maxLife
                let alpha=p.alpha*t2
                if(p.blink!==undefined) alpha*=0.3+0.7*Math.abs(Math.sin(tick*0.12+p.blink))
                ctx.globalAlpha=Math.max(0,Math.min(1,alpha))
                if(p.type==='leaf'){
                    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot??0)
                    ctx.fillStyle=p.color
                    ctx.beginPath();ctx.ellipse(0,0,p.r*1.8,p.r*0.8,0,0,Math.PI*2);ctx.fill()
                    ctx.restore()
                } else if(p.type==='firefly'){
                    const fg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3)
                    fg.addColorStop(0,p.color);fg.addColorStop(1,'transparent')
                    ctx.fillStyle=fg;ctx.beginPath();ctx.arc(p.x,p.y,p.r*3,0,Math.PI*2);ctx.fill()
                    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*0.8,0,Math.PI*2);ctx.fill()
                } else if(p.type==='sparkle'||p.type==='ember'){
                    ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=6
                    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()
                    ctx.shadowBlur=0
                } else if(p.type==='fog'||p.type==='mist'){
                    const fg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r)
                    fg.addColorStop(0,rgba(p.color,alpha*0.6))
                    fg.addColorStop(0.6,rgba(p.color,alpha*0.3))
                    fg.addColorStop(1,'transparent')
                    ctx.fillStyle=fg;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()
                } else {
                    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()
                }
            })
            ctx.globalAlpha=1
        }

        // ====================================================
        // PLAYER
        // ====================================================
        function drawPlayer(ctx: CanvasRenderingContext2D, tick: number) {
            const px=s.px, py=s.py
            const moving=!!(s.keys['ArrowLeft']||s.keys['ArrowRight']||s.keys['ArrowUp']||s.keys['ArrowDown']
                ||s.keys['a']||s.keys['d']||s.keys['w']||s.keys['s']
                ||s.keys['A']||s.keys['D']||s.keys['W']||s.keys['S'])
            const legSwing=moving?Math.sin(tick*0.3)*5:0
            // Player light halo - small circle of visibility
            const dd = depthDark(py)
            const haloR = 45 - dd*15
            const halo = ctx.createRadialGradient(px,py,0,px,py,haloR)
            halo.addColorStop(0,rgba('#aaffaa',0.04+dd*0.02))
            halo.addColorStop(1,'transparent')
            ctx.fillStyle=halo;ctx.beginPath();ctx.arc(px,py,haloR,0,Math.PI*2);ctx.fill()
            // Shadow
            ctx.fillStyle=rgba('#000000',0.35)
            ctx.beginPath();ctx.ellipse(px,py+8,8,3,0,0,Math.PI*2);ctx.fill()
            // Shoes
            ctx.fillStyle=C.trainerShoe
            ctx.fillRect(px-7,py+3+legSwing,6,5)
            ctx.fillRect(px+1,py+3-legSwing,6,5)
            // Pants
            ctx.fillStyle=C.trainerPants; ctx.fillRect(px-6,py-5,13,11)
            // Belt
            ctx.fillStyle='#221100'; ctx.fillRect(px-6,py-6,13,3)
            // Shirt
            ctx.fillStyle=C.trainerShirt; ctx.fillRect(px-6,py-16,13,13)
            // Collar
            ctx.fillStyle=rgba('#ffffff',0.4); ctx.fillRect(px-2,py-16,4,5)
            // Arms
            ctx.fillStyle=C.trainerShirt
            ctx.fillRect(px-9,py-15,3,9); ctx.fillRect(px+6,py-15,3,9)
            // Hands
            ctx.fillStyle=C.trainerSkin
            ctx.beginPath();ctx.arc(px-7.5,py-7,2.5,0,Math.PI*2);ctx.fill()
            ctx.beginPath();ctx.arc(px+7.5,py-7,2.5,0,Math.PI*2);ctx.fill()
            // Head
            ctx.fillStyle=C.trainerSkin
            ctx.beginPath();ctx.arc(px,py-22,7,0,Math.PI*2);ctx.fill()
            // Hair
            ctx.fillStyle='#332200'; ctx.fillRect(px-7,py-29,14,6)
            ctx.beginPath();ctx.arc(px,py-29,7,Math.PI,Math.PI*2);ctx.fill()
            // Hat
            ctx.fillStyle=C.trainerHat
            ctx.fillRect(px-8,py-30,16,6); ctx.fillRect(px-6,py-36,12,7)
            ctx.fillStyle=rgba('#ffffff',0.3); ctx.fillRect(px-5,py-35,10,2)
            // Eyes
            ctx.fillStyle='#000000'
            ctx.beginPath();ctx.arc(px-3,py-22,1.2,0,Math.PI*2);ctx.fill()
            ctx.beginPath();ctx.arc(px+3,py-22,1.2,0,Math.PI*2);ctx.fill()
            // Pokeball
            ctx.fillStyle='#cc3333'
            ctx.beginPath();ctx.arc(px+3,py-5,3,Math.PI,Math.PI*2);ctx.fill()
            ctx.fillStyle='#dddddd'
            ctx.beginPath();ctx.arc(px+3,py-5,3,0,Math.PI);ctx.fill()
            ctx.strokeStyle='#111111';ctx.lineWidth=0.5
            ctx.beginPath();ctx.arc(px+3,py-5,3,0,Math.PI*2);ctx.stroke()
            ctx.beginPath();ctx.moveTo(px,py-5);ctx.lineTo(px+6,py-5);ctx.stroke()
            ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(px+3,py-5,1,0,Math.PI*2);ctx.fill()
        }

        // ====================================================
        // HUD
        // ====================================================
        function drawHUD(ctx: CanvasRenderingContext2D, cW: number, cH: number) {
            ctx.fillStyle=rgba('#040808',0.85); ctx.fillRect(0,cH-38,cW,38)
            ctx.strokeStyle=rgba(C.runeGlow,0.12);ctx.lineWidth=1
            ctx.beginPath();ctx.moveTo(0,cH-38);ctx.lineTo(cW,cH-38);ctx.stroke()
            const zoneName=s.py<400?'Forest Edge'
                :s.py<800?'Root Gate'
                :s.py<1600?'Zone A - Deep Wilds'
                :s.py<2400?'Zone B - Trial Path'
                :'Zone C - Cave of Legends'
            ctx.font='bold 10px monospace';ctx.fillStyle=rgba('#668866',0.8)
            ctx.fillText(zoneName,12,cH-14)
            // Danger indicator - increases with depth
            const dangerLevel = Math.min(5, Math.floor(depthDark(s.py)*6))
            let dangerText = ''
            for(let i=0;i<dangerLevel;i++) dangerText += '!'
            if(dangerLevel>0){
                ctx.fillStyle=rgba(dangerLevel>3?'#aa3322':'#886633',0.6+dangerLevel*0.08)
                ctx.fillText('Danger '+dangerText,cW-120,cH-14)
            }
            // Zone B rune counter
            if(s.py>1600&&s.py<2460){
                const lit=RUNE_STONES.filter(r=>r.active).length
                ctx.fillStyle=rgba(C.runeGlow,0.6)
                ctx.fillText('Runes: '+lit+'/3',12,cH-28)
                ctx.fillStyle=rgba('#0a0a0a',0.8);ctx.fillRect(100,cH-33,64,9)
                ctx.fillStyle=rgba(C.runeGlow,0.6);ctx.fillRect(100,cH-33,64*(lit/3),9)
                ctx.strokeStyle=rgba(C.runeGlow,0.2);ctx.lineWidth=0.5;ctx.strokeRect(100,cH-33,64,9)
            }
            ctx.fillStyle=rgba('#334433',0.6);ctx.font='9px monospace'
            ctx.fillText('ESC - Leave',cW-94,cH-28)
        }

        // ====================================================
        // VIGNETTE & FOG OVERLAY
        // ====================================================
        function drawVignette(ctx: CanvasRenderingContext2D, cW: number, cH: number) {
            const dd = depthDark(s.py)
            // Stronger vignette as player goes deeper
            const vigStr = 0.55 + dd * 0.3
            const vg=ctx.createRadialGradient(cW/2,cH/2,cH*0.28,cW/2,cH/2,cH*0.75)
            vg.addColorStop(0,'transparent'); vg.addColorStop(1,rgba('#000000',vigStr))
            ctx.fillStyle=vg; ctx.fillRect(0,0,cW,cH)
            // Top fog strip - thicker
            const topF=ctx.createLinearGradient(0,0,0,65)
            topF.addColorStop(0,rgba(C.fogColor,0.65+dd*0.2)); topF.addColorStop(1,'transparent')
            ctx.fillStyle=topF; ctx.fillRect(0,0,cW,65)
            // Bottom fog strip
            const botF=ctx.createLinearGradient(0,cH-50,0,cH)
            botF.addColorStop(0,'transparent'); botF.addColorStop(1,rgba(C.fogColor,0.3+dd*0.2))
            ctx.fillStyle=botF; ctx.fillRect(0,cH-50,cW,50)
            // Side darkness - corridor effect
            const sideStr = 0.15 + dd * 0.2
            const leftF=ctx.createLinearGradient(0,0,80,0)
            leftF.addColorStop(0,rgba('#000000',sideStr)); leftF.addColorStop(1,'transparent')
            ctx.fillStyle=leftF; ctx.fillRect(0,0,80,cH)
            const rightF=ctx.createLinearGradient(cW,0,cW-80,0)
            rightF.addColorStop(0,rgba('#000000',sideStr)); rightF.addColorStop(1,'transparent')
            ctx.fillStyle=rightF; ctx.fillRect(cW-80,0,80,cH)
            // Global darkening based on depth
            if(dd > 0.3){
                ctx.fillStyle=rgba('#000000',(dd-0.3)*0.2)
                ctx.fillRect(0,0,cW,cH)
            }
        }

        // ====================================================
        // GAME LOOP
        // ====================================================
        function loop() {
            if(!canvasRef.current) return
            const cW=canvas.width, cH=canvas.height
            s.tick++; const t=s.tick

            // Spawn particles - more fog, more leaves
            if(t%12===0) spawnFirefly()
            if(t%8===0) spawnLeaf()
            if(t%10===0) spawnFog()
            if(t%15===0) spawnMist()
            if(t%22===0) spawnSpore()
            if(t%8===0) spawnSacredAura()
            if(t%6===0) spawnEmber()

            // Update particles
            s.particles.forEach(p=>{
                p.x+=p.vx; p.y+=p.vy; p.life--
                if(p.rot!==undefined&&p.rotV!==undefined) p.rot+=p.rotV
                // Fog drifts
                if(p.type==='fog') p.vx += (Math.random()-0.5)*0.02
            })
            s.particles=s.particles.filter(p=>p.life>0).slice(-600)

            // Movement
            if(!s.inputLocked){
                let dx=0, dy=0
                if(s.keys['ArrowLeft']||s.keys['a']||s.keys['A']){dx=-1;s.facing='left'}
                if(s.keys['ArrowRight']||s.keys['d']||s.keys['D']){dx=1;s.facing='right'}
                if(s.keys['ArrowUp']||s.keys['w']||s.keys['W']){dy=-1;s.facing='up'}
                if(s.keys['ArrowDown']||s.keys['s']||s.keys['S']){dy=1;s.facing='down'}
                if(dx!==0&&dy!==0){dx*=0.707;dy*=0.707}
                const nx=s.px+dx*SPEED, ny=s.py+dy*SPEED
                const hitX=WALLS.some(w=>rectOverlap({x:nx-7,y:s.py-7,w:14,h:14},w))
                const hitY=WALLS.some(w=>rectOverlap({x:s.px-7,y:ny-7,w:14,h:14},w))
                const prY:Rect={x:s.px-7,y:ny-7,w:14,h:14}
                const barrierRect:Rect={x:90,y:BARRIER_Y,w:WORLD_W-180,h:22}
                const hitBarrier=!s.allRunesActive&&rectOverlap(prY,barrierRect)
                if(!hitX) s.px=Math.max(7,Math.min(WORLD_W-7,nx))
                if(!hitY&&!hitBarrier) s.py=Math.max(7,Math.min(WORLD_H-7,ny))
            }

            // Glow tiles
            GLOW_TILES.forEach(t2=>{
                if(rectOverlap({x:s.px-7,y:s.py-7,w:14,h:14},t2)&&t2.glow<0.5) t2.glow=1.0
            })

            // Rune stone activation
            RUNE_STONES.forEach(rs=>{
                if(!rs.active&&rectOverlap({x:s.px-12,y:s.py-12,w:24,h:24},rs)){
                    rs.active=true
                    spawnRuneSparkle(rs)
                    const total=RUNE_STONES.filter(r=>r.active).length
                    setNoticeText(total<3?'Rune '+total+'/3 activated...':'All runes lit - the cave stirs...')
                    setTimeout(()=>setNoticeText(''),3500)
                    if(total===3){
                        s.allRunesActive=true; BARRIER_OPEN=true
                        const fade=setInterval(()=>{s.barrierAlpha=Math.max(0,s.barrierAlpha-0.04);if(s.barrierAlpha<=0)clearInterval(fade)},50)
                    }
                }
            })

            // Audio / atmosphere zone trigger placeholders
            // These update the audioZone state for future audio system integration
            const prevZone = s.audioZone
            if(s.py < 400) s.audioZone = 'calm'
            else if(s.py < 800) s.audioZone = 'uneasy'
            else if(s.py < 2400) s.audioZone = 'danger'
            else s.audioZone = 'cave'
            if(prevZone !== s.audioZone){
                s.lastAudioTrigger = t
                // TODO: Connect to audio system
                // e.g., AudioManager.crossfade(s.audioZone)
                // Placeholder: console log for debugging
                console.log('[Audio Zone]', s.audioZone, 'at tick', t)
            }

            // Zone triggers
            if(!s.forestNoticed&&s.py>368&&s.py<442){
                s.forestNoticed=true
                setNoticeText('The air grows heavy... something watches from the shadows.')
                setTimeout(()=>setNoticeText(''),4000)
            }
            if(!s.chamberZoomed&&s.py>2442){
                s.chamberZoomed=true; s.targetZoom=1.28
                setNoticeText('A deep rumble echoes from the cave ahead...')
                setTimeout(()=>setNoticeText(''),4000)
            }

            // Zoom lerp
            s.zoom+=(s.targetZoom-s.zoom)*0.018
            // Camera lerp
            const targetCamY=s.py-cH/(2*s.zoom)
            s.camY+=(targetCamY-s.camY)*CAM_LERP
            s.camY=Math.max(0,Math.min(WORLD_H-cH/s.zoom,s.camY))

            // Legendary proximity trigger
            const lx=WORLD_W/2, ly=2800
            if(!s.legendaryMet&&Math.hypot(s.px-lx,s.py-ly)<55){
                s.legendaryMet=true; s.inputLocked=true; setEncounter(true)
            }

            // -- RENDER --
            ctx.clearRect(0,0,cW,cH)
            ctx.save()
            ctx.scale(s.zoom,s.zoom)
            ctx.translate(0,-s.camY)

            drawForestEntrance(ctx,t)
            drawRootArchway(ctx,t)
            drawZoneA(ctx,t)
            drawZoneB(ctx,t)
            drawZoneC(ctx,t)
            // Glowing eyes (drawn after zones, before particles)
            drawGlowingEyes(ctx,GLOWING_EYES,t)
            // Extra tall border trees (overlap screen edges)
            TREES_EXTRA.forEach(te=>drawTree(ctx,te.x,te.y,te.size,te.seed))
            drawParticles(ctx,t)
            drawPlayer(ctx,t)

            ctx.restore()
            drawHUD(ctx,cW,cH)
            drawVignette(ctx,cW,cH)

            rafRef.current=requestAnimationFrame(loop)
        }

        rafRef.current=requestAnimationFrame(loop)
        return ()=>{
            cancelAnimationFrame(rafRef.current)
            window.removeEventListener('keydown',onKeyDown)
            window.removeEventListener('keyup',onKeyUp)
        }
    }, [onExit, spawnFirefly, spawnLeaf, spawnFog, spawnMist, spawnSpore, spawnSacredAura, spawnEmber, spawnRuneSparkle])


    function handleFlee() {
        setEncounter(false)
        stateRef.current.inputLocked  = false
        stateRef.current.legendaryMet = false
        setNoticeText('You retreat from the darkness...')
        setTimeout(()=>setNoticeText(''), 3000)
    }

    function handleBattle() {
        console.log('[LegendaryCave] Battle event triggered')
        setEncounter(false)
        stateRef.current.inputLocked = false
        setNoticeText('The legendary awakens!')
        setTimeout(()=>setNoticeText(''), 3000)
    }

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-black">
            <canvas ref={canvasRef} width={800} height={600}
                className="absolute inset-0 m-auto"
                style={{ imageRendering: 'pixelated' }} />

            {/* Ambient notice */}
            {noticeText && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20
                    bg-black/90 border border-green-900/50 rounded-lg px-4 py-2
                    font-mono text-xs text-green-400/80 animate-pulse pointer-events-none
                    shadow-lg shadow-green-950/40">
                    {noticeText}
                </div>
            )}

            {/* Encounter modal */}
            {encounter && (
                <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#040808]/95 border-2 border-green-900/80 rounded-2xl
                        w-96 flex flex-col overflow-hidden
                        shadow-2xl shadow-green-950/80">
                        <div className="bg-green-950/60 border-b border-green-900/40 px-4 py-2 flex items-center justify-between">
                            <span className="font-mono text-xs text-green-500/70 tracking-widest uppercase">The Cave of Legends</span>
                        </div>
                        <div className="bg-gradient-to-b from-green-950/40 to-black/80 h-28 flex items-center justify-center">
                            <div className="text-5xl opacity-60" style={{filter:'drop-shadow(0 0 12px #116633)'}}>&#x1F332;</div>
                        </div>
                        <div className="bg-[#040808]/90 border-y border-green-950/40 px-5 py-3">
                            <p className="text-xs text-gray-400 text-center font-mono leading-5">
                                A powerful <span className="text-green-400 font-bold">LEGENDARY</span> stirs in the darkness.<br/>
                                The ancient guardian regards you with piercing eyes.<br/>
                                <span className="text-yellow-600/70">Its power is overwhelming.</span>
                            </p>
                        </div>
                        <div className="flex gap-3 p-4">
                            <button onClick={handleBattle}
                                className="flex-1 bg-green-950 hover:bg-green-900
                                    border border-green-700/60 text-green-300 text-xs font-mono
                                    py-2.5 rounded-xl transition-colors">
                                Challenge
                            </button>
                            <button onClick={handleFlee}
                                className="flex-1 bg-stone-900 hover:bg-stone-800
                                    border border-stone-600/50 text-stone-300 text-xs font-mono
                                    py-2.5 rounded-xl transition-colors">
                                Retreat
                            </button>
                        </div>
                        <div className="bg-black/50 border-t border-green-950/30 px-4 py-1.5 text-center">
                            <p className="text-xs text-gray-600 font-mono">ESC to flee</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Back button */}
            <button onClick={onExit}
                className="absolute top-3 left-3 z-10 text-xs font-mono text-green-700/60
                    hover:text-green-400 bg-black/70 border border-green-950/50 rounded px-2 py-1
                    transition-colors">
                Leave Forest
            </button>
        </div>
    )
}
