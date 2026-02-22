import Phaser from 'phaser'
import saveManager from '../systems/SaveManager'
import checkpointManager from '../systems/CheckpointManager'

// ─────────────────────────────────────────────────────────────────────────────
// BootScene — Generates ALL pixel-art sprite textures at startup.
//
// Authentic Pokémon FireRed / LeafGreen GBA-style pixel art.
// Characters use a 16×24 grid at 2× scale (32×48 real px).
// Colors, proportions and shading match the GBA aesthetic.
// ─────────────────────────────────────────────────────────────────────────────

const PX = 2  // Each "pixel" is 2×2 real pixels for GBA chunky feel

export default class BootScene extends Phaser.Scene {
    constructor() { super({ key: 'Boot' }) }

    create() {
        this.generatePlayerSprites()
        this.generateNPCSprites()
        this.generateTileSprites()
        this.generateBuildingSprites()
        this.generateFurnitureSprites()
        this.generateObjectSprites()
        this.generateCaveEntrance()
        this.generatePokeballs()
        this.generateMiscSprites()
        this.generateRouteSprites()
        this.generateCreatureSprites()

        // ── Set up auto-save & browser handlers ────────────────────
        saveManager.setupBrowserHandlers()
        saveManager.startAutoSave()

        // ── Check for saved checkpoint → resume or start fresh ────
        const respawn = checkpointManager.getRespawnData()
        if (respawn) {
            this.scene.start(respawn.mapId, {
                from: 'checkpoint',
                spawnX: respawn.x,
                spawnY: respawn.y,
            })
        } else {
            this.scene.start('Bedroom')
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private makeCanvas(key: string, w: number, h: number): [CanvasRenderingContext2D, Phaser.Textures.CanvasTexture] {
        const tex = this.textures.createCanvas(key, w, h)!
        const ctx = tex.getContext()
        ctx.imageSmoothingEnabled = false
        return [ctx, tex]
    }

    private px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
        ctx.fillStyle = color
        ctx.fillRect(x * PX, y * PX, PX, PX)
    }

    private pxRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
        ctx.fillStyle = color
        ctx.fillRect(x * PX, y * PX, w * PX, h * PX)
    }

    // Draw pixels from a 2D grid map (compact representation)
    // Each row is a string where each char maps to a color in the palette
    private drawGrid(ctx: CanvasRenderingContext2D, grid: string[], palette: Record<string, string>) {
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const ch = grid[y][x]
                if (ch === '.' || ch === ' ') continue  // transparent
                const col = palette[ch]
                if (col) this.px(ctx, x, y, col)
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLAYER SPRITES — Pokémon FireRed "Red" protagonist (16×24)
    // Red cap with white Poké-logo, black hair, red vest, black undershirt,
    // blue jeans, red+white shoes.  Backpack visible from side/back.
    // ═══════════════════════════════════════════════════════════════════════

    private generatePlayerSprites() {
        const dirs = ['down', 'up', 'left', 'right'] as const
        for (const dir of dirs) {
            for (let frame = 0; frame < 2; frame++) {
                this.drawPlayerSprite(`player_${dir}_${frame}`, dir, frame)
            }
        }
    }

    private drawPlayerSprite(key: string, dir: 'down' | 'up' | 'left' | 'right', frame: number) {
        const W = 16, H = 24
        const [ctx, tex] = this.makeCanvas(key, W * PX, H * PX)

        // FRLG palette for Red
        const P: Record<string, string> = {
            'R': '#d82800', // cap/vest red
            'r': '#a81000', // dark red (shadow)
            'W': '#fcfcfc', // white (cap logo, shirt stripe)
            'w': '#d8d8d8', // off-white
            'K': '#181818', // black (outline, hair)
            'H': '#402808', // hair dark brown
            'h': '#583818', // hair lighter brown
            'S': '#f8b878', // skin
            's': '#e89858', // skin shadow
            'E': '#282828', // eyes
            'M': '#d05048', // mouth
            'V': '#d82800', // vest same as cap
            'v': '#a81000', // vest shadow
            'B': '#181818', // black undershirt
            'b': '#303030', // undershirt highlight
            'J': '#3058a8', // jeans blue
            'j': '#204080', // jeans dark
            'F': '#d82800', // shoe red
            'f': '#a81000', // shoe dark
            'P': '#885020', // backpack brown
            'p': '#704018', // backpack shadow
        }

        const walk = frame === 1

        if (dir === 'down') {
            const grid = walk ? [
                '....RRRRR.......',
                '...RRWWRRR......',
                '...RRWWRRR......',
                '..KRRRRRRrK.....',
                '..KHHSSSSHK.....',
                '..KHESSSEHK.....',
                '..KHSSsSShK.....',
                '...KSSMSSKK.....',
                '...KSSSSSK......',
                '..KVVBBVVVK.....',
                '..KVVBBVVVK.....',
                '.KSVVBBVVVSK....',
                '.KSVVBBVVVSK....',
                '..KVVVVVVVK.....',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '...KJJ.JJK......',
                '...KJJ..JJK.....',
                '..KjjK.KjjK.....',
                '..KFFK.KWWK.....',
                '..KFFK.KWWK.....',
                '...KK...KK......',
                '................',
            ] : [
                '....RRRRR.......',
                '...RRWWRRR......',
                '...RRWWRRR......',
                '..KRRRRRRrK.....',
                '..KHHSSSSHK.....',
                '..KHESSSEHK.....',
                '..KHSSsSShK.....',
                '...KSSMSSKK.....',
                '...KSSSSSK......',
                '..KVVBBVVVK.....',
                '..KVVBBVVVK.....',
                '.KSVVBBVVVSK....',
                '.KSVVBBVVVSK....',
                '..KVVVVVVVK.....',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '..KjJK.KJjK.....',
                '..KFFK.KWWK.....',
                '..KFFK.KWWK.....',
                '...KK...KK......',
                '................',
                '................',
            ]
            this.drawGrid(ctx, grid, P)

        } else if (dir === 'up') {
            const grid = walk ? [
                '....RRRRR.......',
                '...RRRRRRRK.....',
                '...RRRRRRRK.....',
                '..KRRRRRRRKK....',
                '..KHHHHHHHHK....',
                '..KHHHHHHHHK....',
                '..KHHHHHHHHK....',
                '...KHHHHHHK.....',
                '...KHHHHHHK.....',
                '..KVVBBVVVK.....',
                '..KVVBBVVVK.....',
                '.KPVVBBVVVPK....',
                '.KPVVBBVVVPK....',
                '..KVVVVVVVK.....',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '...KJJ.JJK......',
                '...KJJ..JJK.....',
                '..KjjK.KjjK.....',
                '..KWWK.KFFK.....',
                '..KWWK.KFFK.....',
                '...KK...KK......',
                '................',
            ] : [
                '....RRRRR.......',
                '...RRRRRRRK.....',
                '...RRRRRRRK.....',
                '..KRRRRRRRKK....',
                '..KHHHHHHHHK....',
                '..KHHHHHHHHK....',
                '..KHHHHHHHHK....',
                '...KHHHHHHK.....',
                '...KHHHHHHK.....',
                '..KVVBBVVVK.....',
                '..KVVBBVVVK.....',
                '.KPVVBBVVVPK....',
                '.KPVVBBVVVPK....',
                '..KVVVVVVVK.....',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '...KJJJJJK......',
                '..KjJK.KJjK.....',
                '..KWWK.KFFK.....',
                '..KWWK.KFFK.....',
                '...KK...KK......',
                '................',
                '................',
            ]
            this.drawGrid(ctx, grid, P)

        } else if (dir === 'left') {
            const grid = walk ? [
                '...RRRRRK.......',
                '..RRRRRRK.......',
                '..RRRRRRK.......',
                '.KRRRRRRK.......',
                '.KHHSSSSSK......',
                '.KHESSSK........',
                '.KHSSsSK........',
                '..KSSMSK........',
                '..KSSSK.........',
                '.KVVBBVK........',
                '.KVVBBVK........',
                'KSVVBBVPK.......',
                'KSVVBBVPK.......',
                '.KVVVVVK........',
                '..KJJJJK........',
                '..KJJJJK........',
                '..KJJJJK........',
                '..KJJ.JK........',
                '.KjjK.JjK.......',
                '.KFFK.KWWK......',
                '.KFFK..KK.......',
                '..KK............',
                '................',
                '................',
            ] : [
                '...RRRRRK.......',
                '..RRRRRRK.......',
                '..RRRRRRK.......',
                '.KRRRRRRK.......',
                '.KHHSSSSSK......',
                '.KHESSSK........',
                '.KHSSsSK........',
                '..KSSMSK........',
                '..KSSSK.........',
                '.KVVBBVK........',
                '.KVVBBVK........',
                'KSVVBBVPK.......',
                'KSVVBBVPK.......',
                '.KVVVVVK........',
                '..KJJJJK........',
                '..KJJJJK........',
                '..KJJJJK........',
                '..KJJJJK........',
                '.KjJK.KJjK.....',
                '.KFFK.KWWK.....',
                '.KFFK.KWWK.....',
                '..KK...KK......',
                '................',
                '................',
            ]
            this.drawGrid(ctx, grid, P)

        } else { // right — mirror of left
            const grid = walk ? [
                '.......KRRRRR...',
                '.......KRRRRRRK.',
                '.......KRRRRRRK.',
                '.......KRRRRRRK.',
                '......KSSSSSHHK.',
                '........KSSSESK.',
                '........KSsSSSK.',
                '........KMSSK...',
                '.........KSSK...',
                '........KVBBVVK.',
                '........KVBBVVK.',
                '.......KPVBBVVSK',
                '.......KPVBBVVSK',
                '........KVVVVVK.',
                '........KJJJJK..',
                '........KJJJJK..',
                '........KJJJJK..',
                '........KJ.JJK..',
                '.......KjJ.KjjK.',
                '......KWWK.KFFK.',
                '.......KK..KFFK.',
                '............KK..',
                '................',
                '................',
            ] : [
                '.......KRRRRR...',
                '.......KRRRRRRK.',
                '.......KRRRRRRK.',
                '.......KRRRRRRK.',
                '......KSSSSSHHK.',
                '........KSSSESK.',
                '........KSsSSSK.',
                '........KMSSK...',
                '.........KSSK...',
                '........KVBBVVK.',
                '........KVBBVVK.',
                '.......KPVBBVVSK',
                '.......KPVBBVVSK',
                '........KVVVVVK.',
                '........KJJJJK..',
                '........KJJJJK..',
                '........KJJJJK..',
                '........KJJJJK..',
                '......KjJK.KJjK.',
                '......KWWK.KFFK.',
                '......KWWK.KFFK.',
                '.......KK...KK..',
                '................',
                '................',
            ]
            this.drawGrid(ctx, grid, P)
        }

        tex.refresh()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NPC SPRITES — Each is a unique 16×24 grid with FRLG-accurate design
    // ═══════════════════════════════════════════════════════════════════════

    private generateNPCSprites() {
        this.drawMom()
        this.drawOak()
        this.drawGary()
        this.drawDaisy()
        this.drawElder()
        this.drawRemotePlayer()
        this.drawJessie()
        this.drawJames()
        this.drawMeowthNPC()
        this.generateKadsNPC()
    }

    /** Mom — FRLG style: auburn hair in bun, yellow top, blue skirt, apron */
    private drawMom() {
        const [ctx, tex] = this.makeCanvas('npc_mom', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#181818', 'H': '#a04020', 'h': '#803018',
            'S': '#f8b878', 's': '#e89858',
            'T': '#f8d830', 't': '#c8a828',
            'A': '#f8f8f8', 'a': '#d8d8d8',
            'D': '#3860a8', 'd': '#284888',
            'F': '#a04020', 'f': '#802818',
            'E': '#282828', 'M': '#d05048',
        }
        this.drawGrid(ctx, [
            '................',
            '....KhHHhK......',
            '...KHHhHHHK.....',
            '...KHHHHHHK.....',
            '..KHHSSSSHK.....',
            '..KHESSSEHK.....',
            '..KHSSSSSHK.....',
            '...KSSMSSKK.....',
            '...KSSSSSK......',
            '..KTTAATTK......',
            '..KTTAATTK......',
            '.KSTAAATTTSK....',
            '.KSTAAATTTSK....',
            '..KAAAAATTK.....',
            '...KDDDDDK.....',
            '...KDDDDDK.....',
            '...KDDDDDK.....',
            '...KDDDDDK.....',
            '..KdDK.KDdK....',
            '..KFFK.KFFK....',
            '..KFFK.KFFK....',
            '...KK...KK.....',
            '................',
            '................',
        ], P)
        tex.refresh()
    }

    /** Prof Oak — FRLG: gray hair, lab coat over red shirt, khaki pants */
    private drawOak() {
        const [ctx, tex] = this.makeCanvas('npc_oak', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#181818', 'G': '#989898', 'g': '#787878',
            'S': '#f8b878', 's': '#e89858',
            'L': '#f0f0e8', 'l': '#c8c8c0',
            'R': '#c83030', 'r': '#a02028',
            'T': '#c8b078', 't': '#a89060',
            'F': '#604830', 'f': '#483820',
            'E': '#282828', 'M': '#d05048',
        }
        this.drawGrid(ctx, [
            '................',
            '....GGGGG.......',
            '...KGGGGGK......',
            '...KGGGGGK......',
            '..KGGSSSSGK.....',
            '..KGESSSEGK.....',
            '..KGSSsSSSK.....',
            '...KSSMSSKK.....',
            '...KSSSSSK......',
            '..KLLRRLLK......',
            '..KLLRRLLK......',
            '.KLLRRRRLLLK....',
            '.KLLRRRRLLLK....',
            '..KLLLLLLK......',
            '..KLLLLLLK......',
            '...KTTTTK.......',
            '...KTTTTK.......',
            '...KTTTTK.......',
            '..KtTK.KTtK....',
            '..KFFK.KFFK....',
            '..KFFK.KFFK....',
            '...KK...KK.....',
            '................',
            '................',
        ], P)
        tex.refresh()
    }

    /** Gary/Blue — FRLG rival: spiky brown hair, purple shirt, dark pants */
    private drawGary() {
        const [ctx, tex] = this.makeCanvas('npc_gary', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#181818', 'H': '#885830', 'h': '#684020',
            'S': '#f8b878', 's': '#e89858',
            'U': '#604898', 'u': '#483878',
            'N': '#383848', 'n': '#282838',
            'F': '#484848', 'f': '#303030',
            'E': '#282828', 'M': '#c04040',
            'C': '#906830',
        }
        this.drawGrid(ctx, [
            '...KhK.KhK......',
            '..KHHHhHHHK.....',
            '..KHHHHHHHHK....',
            '..KHHHHHHHHK....',
            '..KHHSSSSHK.....',
            '..KHESSSEHK.....',
            '..KHSSsSShK.....',
            '...KSSMSSKK.....',
            '...KSSCSSK......',
            '..KUUUUUUUK.....',
            '..KUUUUUUUK.....',
            '.KSUUUUUUUSK....',
            '.KSUUUUUUUSK....',
            '..KUUUUUUUK.....',
            '...KNNNNNNK.....',
            '...KNNNNNNK.....',
            '...KNNNNNNK.....',
            '...KNNNNNNK.....',
            '..KnNK.KNnK....',
            '..KFFK.KFFK....',
            '..KFFK.KFFK....',
            '...KK...KK.....',
            '................',
            '................',
        ], P)
        tex.refresh()
    }

    /** Daisy — long brown hair, pink/red top, orange skirt */
    private drawDaisy() {
        const [ctx, tex] = this.makeCanvas('npc_daisy', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#181818', 'H': '#b87830', 'h': '#986020',
            'S': '#f8b878', 's': '#e89858',
            'T': '#e85888', 't': '#c84070',
            'D': '#f0a030', 'd': '#d08828',
            'F': '#c84070', 'f': '#a83060',
            'E': '#282828', 'M': '#d05048',
        }
        this.drawGrid(ctx, [
            '................',
            '....HHHHH.......',
            '...KHHHHHK......',
            '..KHHHHHHHHK....',
            '..KHHSSSSHK.....',
            '..KHESSSEHK.....',
            '..KHSSSSSHK.....',
            '..HKSSMSSKH.....',
            '..HKSSSSSK.H....',
            '..HKTTTTTKH.....',
            '..HKTTTTTKH.....',
            '.HKSTTTTTSKH....',
            '.HKSTTTTTSKH....',
            '..HKTTTTTK.H....',
            '..HKDDDDDKH....',
            '...KDDDDDK.....',
            '...KDDDDDK.....',
            '...KDDDDDK.....',
            '..KdDK.KDdK....',
            '..KFFK.KFFK....',
            '..KFFK.KFFK....',
            '...KK...KK.....',
            '................',
            '................',
        ], P)
        tex.refresh()
    }

    /** Elder — FRLG old man NPC: bald top, white side hair, brown robe */
    private drawElder() {
        const [ctx, tex] = this.makeCanvas('npc_elder', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#181818', 'G': '#d8d0c8', 'g': '#b0a898',
            'S': '#e8a868', 's': '#d09050',
            'C': '#886838', 'c': '#705828',
            'T': '#a88050', 't': '#886838',
            'F': '#604830', 'f': '#483820',
            'E': '#282828', 'M': '#b06050',
        }
        this.drawGrid(ctx, [
            '................',
            '....SSSSS.......',
            '...KSSSSSK......',
            '..KGSSSSGK......',
            '..KGSSSSGK......',
            '..KGESSSEGK.....',
            '..KGSSsSSSK.....',
            '...KSSMSSKK.....',
            '...KSSSSSK......',
            '..KCCTTTCCK.....',
            '..KCCTTTCCK.....',
            '.KSCCTTTCCSK....',
            '.KSCCTTTCCSK....',
            '..KCCCCCCCK.....',
            '..KCCCCCCCK.....',
            '...KCCCCCCK.....',
            '...KCCCCCCK.....',
            '...KCCCCCCK.....',
            '..KcCK.KCcK....',
            '..KFFK.KFFK....',
            '..KFFK.KFFK....',
            '...KK...KK.....',
            '................',
            '................',
        ], P)
        tex.refresh()
    }

    /** Remote multiplayer player — blue-themed trainer */
    private drawRemotePlayer() {
        const [ctx, tex] = this.makeCanvas('npc_remote', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#181818', 'H': '#303060', 'h': '#202048',
            'S': '#e8b070', 's': '#d09858',
            'C': '#2060c0', 'c': '#1848a0',
            'W': '#f0f0f0',
            'T': '#2060c0', 't': '#1848a0',
            'J': '#384048', 'j': '#282830',
            'F': '#2060c0', 'f': '#1848a0',
            'E': '#282828', 'M': '#c05050',
        }
        this.drawGrid(ctx, [
            '....CCCCC.......',
            '...CCWWCCC......',
            '...CCWWCCC......',
            '..KCCCCCCcK.....',
            '..KHHSSSSHK.....',
            '..KHESSSEHK.....',
            '..KHSSsSShK.....',
            '...KSSMSSKK.....',
            '...KSSSSSK......',
            '..KTTTTTTK......',
            '..KTTTTTTK......',
            '.KSTTTTTTSK.....',
            '.KSTTTTTTSK.....',
            '..KTTTTTTK......',
            '...KJJJJJK......',
            '...KJJJJJK......',
            '...KJJJJJK......',
            '...KJJJJJK......',
            '..KjJK.KJjK....',
            '..KFFK.KFFK....',
            '..KFFK.KFFK....',
            '...KK...KK.....',
            '................',
            '................',
        ], P)
        tex.refresh()
    }

    /** Jessie — Team Rocket: long magenta hair, white TR uniform, black boots */
    private drawJessie() {
        const [ctx, tex] = this.makeCanvas('npc_jessie', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#181818', 'H': '#c83088', 'h': '#a02068',
            'S': '#f8b878', 's': '#e89858',
            'W': '#f0f0f0', 'w': '#d0d0d0',
            'R': '#e03030', 'r': '#b82020',
            'B': '#282828', 'b': '#181818',
            'E': '#282828', 'M': '#d05048',
            'G': '#505050',
        }
        this.drawGrid(ctx, [
            '...KHHHK........',
            '..KHHHHHHK......',
            '..KHHHHHHHK.....',
            '..KHHSSSHHK.....',
            '..KHESSSEHHK....',
            '..KHHSSSHHK.....',
            '..HKSSMSSKH.....',
            '..HKSSSSSK.H....',
            '..HKWWRWWKH.....',
            '..HKWWRWWKH.....',
            '.HKSWWRWWSKH....',
            '.HKSWWRWWSKH....',
            '..HKWWWWWK.H....',
            '..HKWWWWWKH.....',
            '...KWWWWWK......',
            '...KWWWWWK......',
            '...KWWWWWK......',
            '...KWWWWWK......',
            '..KwWK.KWwK....',
            '..KBBK.KBBK....',
            '..KBBK.KBBK....',
            '...KK...KK.....',
            '................',
            '................',
        ], P)
        tex.refresh()
    }

    /** James — Team Rocket: blue/purple hair, white TR uniform, black boots */
    private drawJames() {
        const [ctx, tex] = this.makeCanvas('npc_james', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#181818', 'H': '#5050b0', 'h': '#383890',
            'S': '#f8b878', 's': '#e89858',
            'W': '#f0f0f0', 'w': '#d0d0d0',
            'R': '#e03030', 'r': '#b82020',
            'B': '#282828', 'b': '#181818',
            'E': '#282828', 'M': '#d05048',
        }
        this.drawGrid(ctx, [
            '...KhHHhK.......',
            '..KHHHHHHHK.....',
            '..KHHHHHHHHK....',
            '..KHHHHHHHHK....',
            '..KHHSSSSHK.....',
            '..KHESSSEHK.....',
            '..KHSSsSShK.....',
            '...KSSMSSKK.....',
            '...KSSSSSK......',
            '..KWWRWWWK......',
            '..KWWRWWWK......',
            '.KSWWRWWWSK.....',
            '.KSWWRWWWSK.....',
            '..KWWWWWWK......',
            '...KWWWWWK......',
            '...KWWWWWK......',
            '...KWWWWWK......',
            '...KWWWWWK......',
            '..KwWK.KWwK....',
            '..KBBK.KBBK....',
            '..KBBK.KBBK....',
            '...KK...KK.....',
            '................',
            '................',
        ], P)
        tex.refresh()
    }

    /** Meowth NPC — cream-colored cat with coin on head, standing upright */
    private drawMeowthNPC() {
        const [ctx, tex] = this.makeCanvas('npc_meowth', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#181818', 'C': '#f8e8b8', 'c': '#d8c898',
            'Y': '#f8d830', 'y': '#d0a820',
            'W': '#f8f8f8', 'E': '#282828',
            'P': '#e89080', 'M': '#d05048',
            'B': '#c8a878', 'T': '#f0d8a0',
        }
        this.drawGrid(ctx, [
            '................',
            '..KK......KK....',
            '.KCCK....KCCK...',
            '.KCCCK..KCCCK...',
            '..KCCCKKCCCCK...',
            '..KCCCYYCCCK....',
            '..KCCYYYCCCK....',
            '..KCCECCESSK....',
            '..KCCCCWCCCK....',
            '...KCPMMPCK.....',
            '...KKCCCKK......',
            '....KCCCK.......',
            '...KCCCCCCK.....',
            '..KCCCCCCCCCK...',
            '..KCCCCCCCCK....',
            '..KBCCCCCCBK....',
            '...KCCCCCCCK....',
            '...KCCCCCCCK....',
            '....KCCCCCK.....',
            '...KCCK.KCCK....',
            '...KCCK.KCCK....',
            '....KK...KK.....',
            '................',
            '................',
        ], P)
        tex.refresh()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TILE SPRITES — FRLG-accurate terrain (16×16 grid)
    // ═══════════════════════════════════════════════════════════════════════

    private generateTileSprites() {
        this.generateGrassTile()
        this.generatePathTile()
        this.generateWaterTile()
        this.generateSandTile()
        this.generateWoodFloor()
        this.generateLabFloor()
        this.generateWallTile()
        this.generateLabWall()
        this.generateRoofStrip()
        this.generateSkyTile()
    }

    private generateGrassTile() {
        const S = 16
        const [ctx, tex] = this.makeCanvas('tile_grass', S * PX, S * PX)
        // FRLG Pallet Town grass green
        this.pxRect(ctx, 0, 0, S, S, '#58a028')
        // Lighter grass patches
        const light: number[][] = [
            [1,1],[3,0],[5,2],[8,1],[11,0],[14,2],
            [0,5],[4,4],[7,6],[10,5],[13,4],
            [2,8],[6,7],[9,9],[12,8],[15,7],
            [1,11],[5,10],[8,12],[11,11],[14,10],
            [0,14],[3,13],[7,15],[10,14],[13,13],
        ]
        for (const [x, y] of light) this.px(ctx, x, y, '#68b838')
        const dark: number[][] = [[2,3],[6,6],[10,2],[13,9],[4,12],[9,15],[15,5]]
        for (const [x, y] of dark) this.px(ctx, x, y, '#489020')
        tex.refresh()
    }

    private generatePathTile() {
        const S = 16
        const [ctx, tex] = this.makeCanvas('tile_path', S * PX, S * PX)
        this.pxRect(ctx, 0, 0, S, S, '#d8b878')
        const d1: number[][] = [[2,1],[7,3],[12,2],[4,6],[9,5],[14,7],[1,10],[6,9],[11,12],[3,14],[8,13],[15,11]]
        for (const [x, y] of d1) this.px(ctx, x, y, '#c8a868')
        const d2: number[][] = [[5,0],[10,4],[1,7],[13,10],[7,14]]
        for (const [x, y] of d2) this.px(ctx, x, y, '#e0c888')
        this.px(ctx, 0, 3, '#b89858')
        this.px(ctx, 15, 8, '#b89858')
        tex.refresh()
    }

    private generateWaterTile() {
        const S = 16
        const [ctx, tex] = this.makeCanvas('tile_water', S * PX, S * PX)
        this.pxRect(ctx, 0, 0, S, S, '#3890f8')
        for (let x = 0; x < S; x += 2) {
            this.px(ctx, x, 3, '#58a8f8')
            this.px(ctx, x + 1, 3, '#58a8f8')
            this.px(ctx, (x + 1) % S, 9, '#58a8f8')
            this.px(ctx, x, 9, '#58a8f8')
        }
        const dk: number[][] = [[3,6],[8,7],[13,5],[1,12],[6,13],[11,14]]
        for (const [x, y] of dk) this.px(ctx, x, y, '#2878d8')
        this.px(ctx, 5, 1, '#88c8f8')
        this.px(ctx, 12, 7, '#88c8f8')
        tex.refresh()
    }

    private generateSandTile() {
        const S = 16
        const [ctx, tex] = this.makeCanvas('tile_sand', S * PX, S * PX)
        this.pxRect(ctx, 0, 0, S, S, '#e8d088')
        const grains: number[][] = [[3,2],[8,1],[13,3],[1,6],[6,5],[11,7],[4,10],[9,9],[14,11],[2,14],[7,13],[12,15]]
        for (const [x, y] of grains) this.px(ctx, x, y, '#d8c078')
        this.px(ctx, 5, 8, '#f0d898')
        this.px(ctx, 10, 3, '#f0d898')
        tex.refresh()
    }

    private generateWoodFloor() {
        const S = 16
        const [ctx, tex] = this.makeCanvas('tile_floor_wood', S * PX, S * PX)
        this.pxRect(ctx, 0, 0, S, S, '#d8a858')
        this.pxRect(ctx, 0, 3, S, 1, '#c89848')
        this.pxRect(ctx, 0, 7, S, 1, '#c89848')
        this.pxRect(ctx, 0, 11, S, 1, '#c89848')
        this.pxRect(ctx, 0, 15, S, 1, '#c89848')
        this.px(ctx, 4, 1, '#c89848')
        this.px(ctx, 11, 5, '#c89848')
        this.px(ctx, 7, 9, '#c89848')
        this.px(ctx, 13, 13, '#c89848')
        this.px(ctx, 2, 0, '#e0b868')
        this.px(ctx, 9, 4, '#e0b868')
        this.px(ctx, 5, 8, '#e0b868')
        this.px(ctx, 14, 12, '#e0b868')
        tex.refresh()
    }

    private generateLabFloor() {
        const S = 16
        const [ctx, tex] = this.makeCanvas('tile_floor_lab', S * PX, S * PX)
        this.pxRect(ctx, 0, 0, S, S, '#e0d8c8')
        this.pxRect(ctx, 0, 0, S, 1, '#c8c0b0')
        this.pxRect(ctx, 0, 0, 1, S, '#c8c0b0')
        this.pxRect(ctx, 15, 0, 1, S, '#d8d0c0')
        this.pxRect(ctx, 0, 15, S, 1, '#d8d0c0')
        tex.refresh()
    }

    private generateWallTile() {
        const S = 16
        const [ctx, tex] = this.makeCanvas('tile_wall', S * PX, S * PX)
        this.pxRect(ctx, 0, 0, S, 8, '#f0e8d0')
        this.pxRect(ctx, 0, 8, S, 1, '#c0b090')
        this.pxRect(ctx, 0, 9, S, 7, '#e0d8b8')
        this.pxRect(ctx, 0, 15, S, 1, '#b0a880')
        tex.refresh()
    }

    private generateLabWall() {
        const S = 16
        const [ctx, tex] = this.makeCanvas('tile_wall_lab', S * PX, S * PX)
        this.pxRect(ctx, 0, 0, S, S, '#e8e8d0')
        this.pxRect(ctx, 0, 0, S, 1, '#b0b0c0')
        this.pxRect(ctx, 0, S - 1, S, 1, '#c0c0a8')
        tex.refresh()
    }

    private generateRoofStrip() {
        const [ctx, tex] = this.makeCanvas('tile_roof_strip', 16 * PX, 4 * PX)
        this.pxRect(ctx, 0, 0, 16, 4, '#8899aa')
        this.pxRect(ctx, 0, 3, 16, 1, '#708090')
        tex.refresh()
    }

    private generateSkyTile() {
        const S = 16
        const [ctx, tex] = this.makeCanvas('tile_sky', S * PX, S * PX)
        this.pxRect(ctx, 0, 0, S, S, '#88c0e8')
        this.pxRect(ctx, 2, 5, 5, 2, '#b0d8f0')
        this.pxRect(ctx, 4, 4, 3, 1, '#b0d8f0')
        this.pxRect(ctx, 10, 9, 4, 2, '#b0d8f0')
        this.pxRect(ctx, 11, 8, 2, 1, '#b0d8f0')
        tex.refresh()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BUILDING SPRITES — Pallet Town style (FRLG accurate)
    // ═══════════════════════════════════════════════════════════════════════

    private generateBuildingSprites() {
        this.generateLab()
        this.generateHouseRed()
        this.generateHouseBlue()
    }

    private generateLab() {
        const GW = 72, GH = 48
        const [ctx, tex] = this.makeCanvas('building_lab', GW * PX, GH * PX)

        // Main body
        this.pxRect(ctx, 0, 8, GW, GH - 8, '#e0d8c8')

        // Roof
        this.pxRect(ctx, 0, 0, GW, 10, '#587888')
        this.pxRect(ctx, 2, 0, GW - 4, 2, '#506878')
        this.pxRect(ctx, 10, 0, GW - 20, 1, '#486068')
        this.pxRect(ctx, 0, 9, GW, 1, '#688898')
        for (let x = 0; x < GW; x += 4) {
            this.px(ctx, x, 4, '#506878')
            this.px(ctx, x + 2, 6, '#506878')
        }

        // Left window
        this.pxRect(ctx, 10, 14, 18, 14, '#384048')
        this.pxRect(ctx, 12, 16, 6, 10, '#58c8e8')
        this.pxRect(ctx, 20, 16, 6, 10, '#58c8e8')
        this.px(ctx, 12, 16, '#98e0f0')
        this.px(ctx, 13, 16, '#98e0f0')

        // Right window
        this.pxRect(ctx, 44, 14, 18, 14, '#384048')
        this.pxRect(ctx, 46, 16, 6, 10, '#58c8e8')
        this.pxRect(ctx, 54, 16, 6, 10, '#58c8e8')
        this.px(ctx, 46, 16, '#98e0f0')
        this.px(ctx, 47, 16, '#98e0f0')

        // Door
        this.pxRect(ctx, 30, 33, 12, 15, '#684020')
        this.pxRect(ctx, 31, 34, 10, 13, '#885830')
        this.pxRect(ctx, 32, 35, 8, 5, '#a07040')
        this.pxRect(ctx, 32, 42, 8, 4, '#a07040')
        this.px(ctx, 39, 40, '#e0c040')
        this.pxRect(ctx, 29, 32, 14, 1, '#584020')

        // Sign plate
        this.pxRect(ctx, 28, 10, 16, 3, '#506060')
        this.pxRect(ctx, 29, 11, 14, 1, '#688888')

        // Foundation
        this.pxRect(ctx, 0, GH - 1, GW, 1, '#b0a890')

        tex.refresh()
    }

    private generateHouseRed() {
        const GW = 60, GH = 45
        const [ctx, tex] = this.makeCanvas('building_house_red', GW * PX, GH * PX)

        this.pxRect(ctx, 0, 10, GW, GH - 10, '#e8d8c0')

        // Red roof
        this.pxRect(ctx, 0, 0, GW, 12, '#c84040')
        this.pxRect(ctx, 2, 0, GW - 4, 2, '#a83030')
        for (let x = 0; x < GW; x += 3) {
            this.px(ctx, x, 3, '#b83838')
            this.px(ctx, x + 1, 6, '#b83838')
            this.px(ctx, x + 2, 9, '#b83838')
        }
        this.pxRect(ctx, 0, 11, GW, 1, '#d85050')

        // Windows
        this.pxRect(ctx, 6, 16, 14, 12, '#384048')
        this.pxRect(ctx, 8, 18, 4, 8, '#58c8e8')
        this.pxRect(ctx, 14, 18, 4, 8, '#58c8e8')
        this.px(ctx, 8, 18, '#98e0f0')

        this.pxRect(ctx, 40, 16, 14, 12, '#384048')
        this.pxRect(ctx, 42, 18, 4, 8, '#58c8e8')
        this.pxRect(ctx, 48, 18, 4, 8, '#58c8e8')
        this.px(ctx, 42, 18, '#98e0f0')

        // Door
        this.pxRect(ctx, 24, 32, 12, 13, '#684020')
        this.pxRect(ctx, 25, 33, 10, 11, '#885830')
        this.pxRect(ctx, 26, 34, 8, 4, '#a07040')
        this.pxRect(ctx, 26, 40, 8, 3, '#a07040')
        this.px(ctx, 33, 38, '#e0c040')
        this.pxRect(ctx, 23, 31, 14, 1, '#584020')
        this.pxRect(ctx, 22, GH - 1, 16, 1, '#c8b898')

        // Mailbox
        this.pxRect(ctx, 3, GH - 6, 3, 5, '#786048')
        this.pxRect(ctx, 2, GH - 7, 5, 2, '#c84040')

        tex.refresh()
    }

    private generateHouseBlue() {
        const GW = 60, GH = 45
        const [ctx, tex] = this.makeCanvas('building_house_blue', GW * PX, GH * PX)

        this.pxRect(ctx, 0, 10, GW, GH - 10, '#e0d8c8')

        // Blue roof
        this.pxRect(ctx, 0, 0, GW, 12, '#3858a8')
        this.pxRect(ctx, 2, 0, GW - 4, 2, '#284890')
        for (let x = 0; x < GW; x += 3) {
            this.px(ctx, x, 3, '#3050a0')
            this.px(ctx, x + 1, 6, '#3050a0')
            this.px(ctx, x + 2, 9, '#3050a0')
        }
        this.pxRect(ctx, 0, 11, GW, 1, '#4868b8')

        // Windows
        this.pxRect(ctx, 6, 16, 14, 12, '#384048')
        this.pxRect(ctx, 8, 18, 4, 8, '#58c8e8')
        this.pxRect(ctx, 14, 18, 4, 8, '#58c8e8')
        this.px(ctx, 8, 18, '#98e0f0')

        this.pxRect(ctx, 40, 16, 14, 12, '#384048')
        this.pxRect(ctx, 42, 18, 4, 8, '#58c8e8')
        this.pxRect(ctx, 48, 18, 4, 8, '#58c8e8')
        this.px(ctx, 42, 18, '#98e0f0')

        // Door
        this.pxRect(ctx, 24, 32, 12, 13, '#684020')
        this.pxRect(ctx, 25, 33, 10, 11, '#885830')
        this.pxRect(ctx, 26, 34, 8, 4, '#a07040')
        this.pxRect(ctx, 26, 40, 8, 3, '#a07040')
        this.px(ctx, 33, 38, '#e0c040')
        this.pxRect(ctx, 23, 31, 14, 1, '#584020')
        this.pxRect(ctx, 22, GH - 1, 16, 1, '#c8b898')

        tex.refresh()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // OBJECT SPRITES — FRLG style trees, bushes, signs etc.
    // ═══════════════════════════════════════════════════════════════════════

    private generateObjectSprites() {
        this.generateTree()
        this.generateBush()
        this.generateSign()
        this.generateFlower()
        this.generateFence()
        this.generateLampPost()
    }

    /** FRLG Pallet Town tree — round canopy, visible trunk */
    private generateTree() {
        const GW = 20, GH = 28
        const [ctx, tex] = this.makeCanvas('obj_tree', GW * PX, GH * PX)

        // Trunk
        this.pxRect(ctx, 8, 18, 4, 8, '#886040')
        this.pxRect(ctx, 9, 18, 2, 8, '#a07050')
        // Root flare
        this.pxRect(ctx, 7, 25, 6, 2, '#785030')

        // Canopy - FRLG round treetop shape
        // Dark outline/shadow layer
        this.pxRect(ctx, 5, 0, 10, 1, '#185810')
        this.pxRect(ctx, 3, 1, 14, 1, '#185810')
        this.pxRect(ctx, 2, 2, 16, 1, '#185810')
        this.pxRect(ctx, 1, 3, 18, 14, '#185810')
        this.pxRect(ctx, 2, 17, 16, 1, '#185810')
        this.pxRect(ctx, 4, 18, 4, 1, '#185810')
        this.pxRect(ctx, 12, 18, 4, 1, '#185810')

        // Main green fill
        this.pxRect(ctx, 5, 1, 10, 1, '#38a028')
        this.pxRect(ctx, 3, 2, 14, 1, '#38a028')
        this.pxRect(ctx, 2, 3, 16, 14, '#38a028')
        this.pxRect(ctx, 3, 17, 14, 1, '#38a028')

        // Highlight clusters (lighter green patches like FRLG)
        this.pxRect(ctx, 5, 2, 4, 3, '#58b838')
        this.pxRect(ctx, 11, 4, 5, 3, '#58b838')
        this.pxRect(ctx, 3, 7, 3, 3, '#58b838')
        this.pxRect(ctx, 8, 9, 4, 3, '#58b838')
        this.pxRect(ctx, 13, 11, 3, 3, '#58b838')
        this.pxRect(ctx, 5, 13, 4, 3, '#58b838')
        this.pxRect(ctx, 11, 15, 3, 2, '#58b838')

        // Deep shadow areas
        this.pxRect(ctx, 2, 12, 3, 4, '#287818')
        this.pxRect(ctx, 8, 5, 3, 2, '#287818')
        this.pxRect(ctx, 14, 8, 3, 2, '#287818')

        // Brightest spots (top-left light source)
        this.px(ctx, 6, 2, '#68c848')
        this.px(ctx, 7, 3, '#68c848')
        this.px(ctx, 4, 8, '#68c848')

        // Grass shadow under tree
        this.pxRect(ctx, 5, 26, 10, 2, '#489020')

        tex.refresh()
    }

    /** FRLG cuttable bush — small round hedge */
    private generateBush() {
        const GW = 12, GH = 10
        const [ctx, tex] = this.makeCanvas('obj_bush', GW * PX, GH * PX)

        // Dark outline
        this.pxRect(ctx, 3, 0, 6, 1, '#185810')
        this.pxRect(ctx, 1, 1, 10, 1, '#185810')
        this.pxRect(ctx, 0, 2, 12, 6, '#185810')
        this.pxRect(ctx, 1, 8, 10, 1, '#185810')
        this.pxRect(ctx, 3, 9, 6, 1, '#185810')

        // Main fill
        this.pxRect(ctx, 3, 1, 6, 1, '#38a028')
        this.pxRect(ctx, 1, 2, 10, 6, '#38a028')
        this.pxRect(ctx, 2, 8, 8, 1, '#38a028')

        // Highlights
        this.pxRect(ctx, 3, 2, 3, 2, '#58b838')
        this.pxRect(ctx, 7, 4, 2, 2, '#58b838')
        this.pxRect(ctx, 2, 5, 2, 2, '#58b838')

        // Shadow
        this.pxRect(ctx, 6, 6, 3, 2, '#287818')

        tex.refresh()
    }

    /** FRLG wooden sign */
    private generateSign() {
        const GW = 12, GH = 16
        const [ctx, tex] = this.makeCanvas('obj_sign', GW * PX, GH * PX)
        // Post
        this.pxRect(ctx, 4, 10, 4, 6, '#886040')
        this.pxRect(ctx, 5, 10, 2, 6, '#a07850')
        // Sign board
        this.pxRect(ctx, 0, 1, 12, 9, '#886040')
        this.pxRect(ctx, 1, 2, 10, 7, '#c8a870')
        this.pxRect(ctx, 1, 2, 10, 1, '#d8b880')
        this.pxRect(ctx, 1, 8, 10, 1, '#b09060')
        // Text lines
        this.pxRect(ctx, 2, 3, 8, 1, '#785830')
        this.pxRect(ctx, 3, 5, 6, 1, '#785830')
        this.pxRect(ctx, 2, 7, 7, 1, '#785830')
        tex.refresh()
    }

    private generateFlower() {
        // Red flower (FRLG style)
        {
            const [ctx, tex] = this.makeCanvas('obj_flower_red', 6 * PX, 6 * PX)
            this.px(ctx, 2, 3, '#38a028')
            this.px(ctx, 2, 4, '#38a028')
            this.px(ctx, 3, 4, '#38a028')
            this.px(ctx, 1, 4, '#38a028')
            this.px(ctx, 2, 1, '#e83030')
            this.px(ctx, 1, 2, '#e83030')
            this.px(ctx, 3, 2, '#e83030')
            this.px(ctx, 2, 2, '#f8e038')
            this.px(ctx, 2, 0, '#f84040')
            tex.refresh()
        }
        // Yellow variant
        {
            const [ctx, tex] = this.makeCanvas('obj_flower_yellow', 6 * PX, 6 * PX)
            this.px(ctx, 2, 3, '#38a028')
            this.px(ctx, 2, 4, '#38a028')
            this.px(ctx, 3, 4, '#38a028')
            this.px(ctx, 1, 4, '#38a028')
            this.px(ctx, 2, 1, '#f8d030')
            this.px(ctx, 1, 2, '#f8d030')
            this.px(ctx, 3, 2, '#f8d030')
            this.px(ctx, 2, 2, '#f87830')
            this.px(ctx, 2, 0, '#f8e048')
            tex.refresh()
        }
    }

    private generateFence() {
        const GW = 16, GH = 10
        const [ctx, tex] = this.makeCanvas('obj_fence', GW * PX, GH * PX)
        // White picket fence
        this.pxRect(ctx, 1, 0, 3, GH, '#e8e0d0')
        this.pxRect(ctx, 7, 0, 3, GH, '#e8e0d0')
        this.pxRect(ctx, 13, 0, 3, GH, '#e8e0d0')
        this.pxRect(ctx, 2, 0, 1, 1, '#f0e8d8')
        this.pxRect(ctx, 8, 0, 1, 1, '#f0e8d8')
        this.pxRect(ctx, 14, 0, 1, 1, '#f0e8d8')
        this.pxRect(ctx, 0, 3, GW, 2, '#d8d0c0')
        this.pxRect(ctx, 0, 7, GW, 2, '#d8d0c0')
        tex.refresh()
    }

    private generateLampPost() {
        const GW = 8, GH = 20
        const [ctx, tex] = this.makeCanvas('obj_lamp', GW * PX, GH * PX)
        this.pxRect(ctx, 3, 5, 2, 11, '#484848')
        this.pxRect(ctx, 4, 5, 1, 11, '#585858')
        this.pxRect(ctx, 2, 16, 4, 4, '#383838')
        this.pxRect(ctx, 1, 18, 6, 2, '#383838')
        this.pxRect(ctx, 1, 1, 6, 4, '#585858')
        this.pxRect(ctx, 2, 2, 4, 2, '#f8f080')
        this.pxRect(ctx, 1, 0, 6, 1, '#484848')
        tex.refresh()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FURNITURE — FRLG interior style
    // ═══════════════════════════════════════════════════════════════════════

    private generateFurnitureSprites() {
        this.generateBed()
        this.generateDesk()
        this.generateBookshelf()
        this.generateTV()
        this.generateTable()
        this.generateChair()
        this.generatePlant()
        this.generateCouch()
        this.generateTrophy()
        this.generateLabTable()
        this.generateLabShelf()
        this.generateComputer()
        this.generateStairs()
        this.generateDoorMat()
    }

    /** FRLG-style bed — blue blanket with pillow */
    private generateBed() {
        const GW = 20, GH = 30
        const [ctx, tex] = this.makeCanvas('furn_bed', GW * PX, GH * PX)
        // Frame
        this.pxRect(ctx, 0, 0, GW, GH, '#886040')
        this.pxRect(ctx, 1, 1, GW - 2, GH - 2, '#a87850')
        // Headboard
        this.pxRect(ctx, 0, 0, GW, 4, '#785030')
        this.pxRect(ctx, 1, 1, GW - 2, 2, '#886040')
        // Pillow
        this.pxRect(ctx, 2, 4, GW - 4, 5, '#f8f8f0')
        this.pxRect(ctx, 3, 5, GW - 6, 3, '#f0f0e8')
        this.pxRect(ctx, 4, 6, 3, 1, '#e8e8e0')
        // Blue blanket
        this.pxRect(ctx, 1, 9, GW - 2, GH - 11, '#3868b0')
        this.pxRect(ctx, 1, 9, GW - 2, 2, '#4878c0')
        // Blanket quilting
        this.pxRect(ctx, 4, 13, 5, 4, '#4878c0')
        this.pxRect(ctx, 11, 19, 5, 4, '#4878c0')
        this.pxRect(ctx, 3, 23, 6, 3, '#4878c0')
        tex.refresh()
    }

    /** Desk with drawers */
    private generateDesk() {
        const GW = 30, GH = 15
        const [ctx, tex] = this.makeCanvas('furn_desk', GW * PX, GH * PX)
        // Desktop surface
        this.pxRect(ctx, 0, 0, GW, 3, '#886040')
        this.pxRect(ctx, 1, 0, GW - 2, 2, '#a87850')
        // Front panel
        this.pxRect(ctx, 0, 3, GW, 12, '#785030')
        this.pxRect(ctx, 1, 4, GW - 2, 10, '#886040')
        // Drawers
        this.pxRect(ctx, 2, 5, 12, 5, '#a87850')
        this.pxRect(ctx, 3, 6, 10, 3, '#b88860')
        this.px(ctx, 8, 7, '#e0c040')
        this.pxRect(ctx, 16, 5, 12, 5, '#a87850')
        this.pxRect(ctx, 17, 6, 10, 3, '#b88860')
        this.px(ctx, 22, 7, '#e0c040')
        tex.refresh()
    }

    /** Bookshelf — FRLG colorful books */
    private generateBookshelf() {
        const GW = 22, GH = 20
        const [ctx, tex] = this.makeCanvas('furn_bookshelf', GW * PX, GH * PX)
        this.pxRect(ctx, 0, 0, GW, GH, '#685028')
        this.pxRect(ctx, 1, 1, GW - 2, GH - 2, '#886840')
        this.pxRect(ctx, 0, 10, GW, 1, '#685028')
        const row1 = ['#d83030','#3050c0','#30a040','#d0a020','#9030a0']
        row1.forEach((c, i) => this.pxRect(ctx, 2 + i * 4, 1, 3, 9, c))
        const row2 = ['#2088b0','#c06020','#508030','#8030a0','#d04050']
        row2.forEach((c, i) => this.pxRect(ctx, 2 + i * 4, 11, 3, 8, c))
        tex.refresh()
    }

    /** TV — FRLG CRT-style */
    private generateTV() {
        const GW = 24, GH = 18
        const [ctx, tex] = this.makeCanvas('furn_tv', GW * PX, GH * PX)
        this.pxRect(ctx, 0, 0, GW, 13, '#383840')
        this.pxRect(ctx, 1, 1, GW - 2, 11, '#484850')
        this.pxRect(ctx, 3, 2, GW - 6, 9, '#2880c0')
        this.pxRect(ctx, 4, 3, GW - 8, 7, '#38a0d8')
        this.pxRect(ctx, 5, 3, 3, 2, '#68c0e8')
        this.pxRect(ctx, 7, 0, 1, 2, '#585858')
        this.pxRect(ctx, GW - 8, 0, 1, 2, '#585858')
        this.pxRect(ctx, 8, 13, 8, 2, '#383840')
        this.pxRect(ctx, 6, 15, 12, 3, '#484850')
        this.px(ctx, GW - 4, 11, '#40e040')
        tex.refresh()
    }

    /** Table with tablecloth */
    private generateTable() {
        const GW = 40, GH = 20
        const [ctx, tex] = this.makeCanvas('furn_table', GW * PX, GH * PX)
        this.pxRect(ctx, 0, 0, GW, 4, '#886040')
        this.pxRect(ctx, 1, 0, GW - 2, 3, '#a87850')
        this.pxRect(ctx, 4, 0, GW - 8, 3, '#f8f8f0')
        this.pxRect(ctx, 5, 1, GW - 10, 1, '#f0f0e8')
        this.pxRect(ctx, 2, 4, 3, 16, '#785030')
        this.pxRect(ctx, GW - 5, 4, 3, 16, '#785030')
        this.pxRect(ctx, 5, 12, GW - 10, 2, '#785030')
        tex.refresh()
    }

    private generateChair() {
        const GW = 10, GH = 12
        const [ctx, tex] = this.makeCanvas('furn_chair', GW * PX, GH * PX)
        this.pxRect(ctx, 1, 0, GW - 2, 5, '#886040')
        this.pxRect(ctx, 2, 1, GW - 4, 3, '#a87850')
        this.pxRect(ctx, 0, 4, GW, 4, '#886040')
        this.pxRect(ctx, 1, 5, GW - 2, 2, '#a87850')
        this.pxRect(ctx, 1, 8, 2, 4, '#785030')
        this.pxRect(ctx, GW - 3, 8, 2, 4, '#785030')
        tex.refresh()
    }

    /** Potted plant */
    private generatePlant() {
        const GW = 10, GH = 16
        const [ctx, tex] = this.makeCanvas('furn_plant', GW * PX, GH * PX)
        this.pxRect(ctx, 3, 10, 4, 6, '#b06030')
        this.pxRect(ctx, 2, 10, 6, 2, '#c07040')
        this.pxRect(ctx, 3, 9, 4, 2, '#604020')
        this.pxRect(ctx, 4, 4, 2, 6, '#38a028')
        this.pxRect(ctx, 2, 1, 3, 4, '#38a028')
        this.pxRect(ctx, 6, 0, 3, 3, '#38a028')
        this.pxRect(ctx, 3, 0, 4, 2, '#48b038')
        this.px(ctx, 4, 1, '#68c858')
        this.px(ctx, 7, 0, '#68c858')
        tex.refresh()
    }

    /** Couch / sofa */
    private generateCouch() {
        const GW = 40, GH = 18
        const [ctx, tex] = this.makeCanvas('furn_couch', GW * PX, GH * PX)
        this.pxRect(ctx, 0, 0, GW, 8, '#4060a0')
        this.pxRect(ctx, 1, 1, GW - 2, 6, '#5070b0')
        this.pxRect(ctx, 2, 8, GW - 4, 6, '#5070b0')
        this.pxRect(ctx, 0, 0, 4, GH, '#3050a0')
        this.pxRect(ctx, 1, 1, 2, GH - 2, '#4060a0')
        this.pxRect(ctx, GW - 4, 0, 4, GH, '#3050a0')
        this.pxRect(ctx, GW - 3, 1, 2, GH - 2, '#4060a0')
        this.pxRect(ctx, 14, 8, 1, 6, '#4060a0')
        this.pxRect(ctx, 25, 8, 1, 6, '#4060a0')
        this.pxRect(ctx, 6, 10, 6, 2, '#6080c0')
        this.pxRect(ctx, 17, 10, 6, 2, '#6080c0')
        this.pxRect(ctx, 28, 10, 6, 2, '#6080c0')
        this.pxRect(ctx, 2, GH - 2, 3, 2, '#383840')
        this.pxRect(ctx, GW - 5, GH - 2, 3, 2, '#383840')
        tex.refresh()
    }

    /** Trophy on shelf */
    private generateTrophy() {
        const GW = 14, GH = 20
        const [ctx, tex] = this.makeCanvas('furn_trophy', GW * PX, GH * PX)
        this.pxRect(ctx, 0, 14, GW, 6, '#a89878')
        this.pxRect(ctx, 0, 14, GW, 1, '#b8a888')
        this.pxRect(ctx, 4, 1, 6, 5, '#f8d030')
        this.pxRect(ctx, 5, 2, 4, 3, '#f8e058')
        this.pxRect(ctx, 3, 1, 8, 1, '#e0b828')
        this.pxRect(ctx, 2, 2, 2, 3, '#e0b828')
        this.pxRect(ctx, 10, 2, 2, 3, '#e0b828')
        this.pxRect(ctx, 6, 6, 2, 4, '#d8a820')
        this.pxRect(ctx, 4, 10, 6, 4, '#d8a820')
        this.pxRect(ctx, 3, 10, 8, 1, '#e0b828')
        this.pxRect(ctx, 5, 12, 4, 1, '#f0c838')
        tex.refresh()
    }

    /** Lab table — long metal surface */
    private generateLabTable() {
        const GW = 110, GH = 8
        const [ctx, tex] = this.makeCanvas('furn_lab_table', GW * PX, GH * PX)
        this.pxRect(ctx, 0, 0, GW, 2, '#a0a090')
        this.pxRect(ctx, 0, 0, GW, 1, '#b0b0a0')
        this.pxRect(ctx, 0, 2, GW, 6, '#d0c8b0')
        this.pxRect(ctx, 0, 2, GW, 1, '#c0b8a0')
        for (let x = 10; x < GW; x += 30) {
            this.px(ctx, x, 1, '#808070')
        }
        tex.refresh()
    }

    /** Lab shelf with beakers */
    private generateLabShelf() {
        const GW = 30, GH = 20
        const [ctx, tex] = this.makeCanvas('furn_lab_shelf', GW * PX, GH * PX)
        this.pxRect(ctx, 0, 0, GW, GH, '#886840')
        this.pxRect(ctx, 1, 1, GW - 2, GH - 2, '#a08860')
        this.pxRect(ctx, 0, 10, GW, 1, '#886840')
        this.pxRect(ctx, 3, 2, 4, 7, '#80e8a0')
        this.pxRect(ctx, 4, 1, 2, 1, '#80e8a0')
        this.pxRect(ctx, 10, 3, 3, 6, '#f8f070')
        this.pxRect(ctx, 11, 2, 1, 1, '#f8f070')
        this.pxRect(ctx, 17, 2, 5, 7, '#70b8f0')
        this.pxRect(ctx, 19, 1, 1, 1, '#70b8f0')
        this.pxRect(ctx, 24, 4, 4, 5, '#f87070')
        this.pxRect(ctx, 2, 12, 3, 7, '#c83030')
        this.pxRect(ctx, 6, 12, 3, 7, '#3050c0')
        this.pxRect(ctx, 10, 12, 3, 7, '#30a040')
        this.pxRect(ctx, 14, 12, 3, 7, '#c0a030')
        this.pxRect(ctx, 18, 12, 5, 7, '#8030a0')
        this.pxRect(ctx, 24, 13, 4, 6, '#c06020')
        tex.refresh()
    }

    /** FRLG-style PC/computer */
    private generateComputer() {
        const GW = 20, GH = 14
        const [ctx, tex] = this.makeCanvas('furn_computer', GW * PX, GH * PX)
        this.pxRect(ctx, 2, 0, 16, 8, '#383840')
        this.pxRect(ctx, 3, 1, 14, 6, '#2880c0')
        this.pxRect(ctx, 4, 2, 8, 1, '#f8f8f8')
        this.pxRect(ctx, 5, 4, 10, 1, '#90d0f0')
        this.pxRect(ctx, 4, 2, 2, 1, '#58c8e8')
        this.pxRect(ctx, 8, 8, 4, 1, '#484850')
        this.pxRect(ctx, 6, 9, 8, 2, '#484850')
        this.pxRect(ctx, 3, 11, 14, 3, '#585860')
        this.pxRect(ctx, 4, 11, 12, 2, '#686870')
        this.px(ctx, 15, 6, '#40e040')
        tex.refresh()
    }

    /** Staircase */
    private generateStairs() {
        const GW = 15, GH = 18
        const [ctx, tex] = this.makeCanvas('furn_stairs', GW * PX, GH * PX)
        for (let i = 0; i < 6; i++) {
            const y = i * 3
            const w = GW - i * 2
            const x = i
            this.pxRect(ctx, x, y, w, 3, '#c8a868')
            this.pxRect(ctx, x, y, w, 1, '#d8b878')
            this.pxRect(ctx, x, y + 2, w, 1, '#b09058')
        }
        for (let i = 0; i < 6; i++) {
            this.px(ctx, i, i * 3, '#886040')
            this.px(ctx, i, i * 3 + 1, '#886040')
        }
        tex.refresh()
    }

    /** Door mat */
    private generateDoorMat() {
        const GW = 12, GH = 6
        const [ctx, tex] = this.makeCanvas('obj_doormat', GW * PX, GH * PX)
        this.pxRect(ctx, 0, 0, GW, GH, '#886040')
        this.pxRect(ctx, 1, 1, GW - 2, GH - 2, '#a07848')
        this.pxRect(ctx, 3, 2, 6, 1, '#785030')
        this.pxRect(ctx, 4, 3, 4, 1, '#785030')
        tex.refresh()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CAVE ENTRANCE — Rocky archway with mysterious glow
    // ═══════════════════════════════════════════════════════════════════════

    private generateCaveEntrance() {
        const GW = 28, GH = 40
        const [ctx, tex] = this.makeCanvas('obj_cave', GW * PX, GH * PX)

        // Rocky frame (outer)
        this.pxRect(ctx, 0, 0, GW, 4, '#686060')
        this.pxRect(ctx, 0, 0, GW, GH, '#585050')

        // Main rock body
        this.pxRect(ctx, 1, 1, GW - 2, GH - 2, '#686060')

        // Dark interior
        this.pxRect(ctx, 5, 4, 18, 28, '#101018')
        this.pxRect(ctx, 4, 6, 20, 24, '#101018')
        this.pxRect(ctx, 3, 8, 22, 22, '#080810')

        // Archway top curve
        this.pxRect(ctx, 6, 3, 16, 2, '#181820')
        this.pxRect(ctx, 5, 5, 18, 2, '#101018')

        // Rocky texture on frame
        this.px(ctx, 2, 3, '#787070')
        this.px(ctx, 24, 5, '#787070')
        this.px(ctx, 1, 12, '#787070')
        this.px(ctx, 26, 18, '#787070')
        this.px(ctx, 2, 25, '#787070')
        this.px(ctx, 25, 28, '#787070')

        // Dark rock shadows
        this.px(ctx, 3, 6, '#484040')
        this.px(ctx, 24, 10, '#484040')
        this.px(ctx, 2, 20, '#484040')
        this.px(ctx, 25, 22, '#484040')

        // Moss on top
        this.pxRect(ctx, 2, 0, 4, 2, '#306030')
        this.pxRect(ctx, 8, 0, 3, 1, '#408040')
        this.pxRect(ctx, 18, 0, 5, 2, '#306030')
        this.pxRect(ctx, 24, 0, 3, 1, '#408040')

        // Green glow at center
        this.pxRect(ctx, 10, 20, 8, 6, '#20a060')
        this.pxRect(ctx, 11, 19, 6, 8, '#40c080')
        this.pxRect(ctx, 12, 21, 4, 4, '#60e0a0')
        this.px(ctx, 13, 22, '#80f0c0')
        this.px(ctx, 14, 23, '#80f0c0')

        // Stalactites
        this.pxRect(ctx, 8, 4, 2, 4, '#585050')
        this.pxRect(ctx, 14, 3, 1, 3, '#585050')
        this.pxRect(ctx, 20, 4, 2, 5, '#585050')

        // Ground edge
        this.pxRect(ctx, 0, GH - 4, GW, 4, '#484040')
        this.pxRect(ctx, 0, GH - 4, GW, 1, '#585050')

        tex.refresh()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // POKÉBALLS — Iconic design with proper shading
    // ═══════════════════════════════════════════════════════════════════════

    private generatePokeballs() {
        const types: Array<{ key: string; top: string; topH: string; topD: string }> = [
            { key: 'obj_pokeball_fire',  top: '#e83030', topH: '#f85050', topD: '#c02020' },
            { key: 'obj_pokeball_water', top: '#2868d8', topH: '#4888f0', topD: '#1848a0' },
            { key: 'obj_pokeball_grass', top: '#30a040', topH: '#50c060', topD: '#208030' },
        ]

        for (const { key, top, topH, topD } of types) {
            const GW = 16, GH = 16
            const [ctx, tex] = this.makeCanvas(key, GW * PX, GH * PX)

            const O = '#181818'
            // Top outline
            this.pxRect(ctx, 5, 0, 6, 1, O)
            this.pxRect(ctx, 3, 1, 2, 1, O)
            this.pxRect(ctx, 11, 1, 2, 1, O)
            this.pxRect(ctx, 2, 2, 1, 1, O)
            this.pxRect(ctx, 13, 2, 1, 1, O)
            this.pxRect(ctx, 1, 3, 1, 4, O)
            this.pxRect(ctx, 14, 3, 1, 4, O)

            // Top fill
            this.pxRect(ctx, 5, 1, 6, 1, top)
            this.pxRect(ctx, 3, 2, 10, 1, top)
            this.pxRect(ctx, 2, 3, 12, 4, top)

            // Top highlight
            this.pxRect(ctx, 4, 2, 2, 1, topH)
            this.pxRect(ctx, 3, 3, 2, 2, topH)

            // Top shadow
            this.pxRect(ctx, 11, 4, 2, 2, topD)

            // Center band
            this.pxRect(ctx, 1, 7, 14, 2, O)
            this.pxRect(ctx, 0, 7, 1, 2, O)
            this.pxRect(ctx, 15, 7, 1, 2, O)

            // Center button
            this.pxRect(ctx, 6, 6, 4, 4, '#f8f8f8')
            this.pxRect(ctx, 7, 7, 2, 2, O)

            // Bottom half
            this.pxRect(ctx, 1, 9, 14, 4, '#f8f8f0')
            this.pxRect(ctx, 2, 13, 12, 1, '#f8f8f0')
            this.pxRect(ctx, 4, 14, 8, 1, '#f8f8f0')

            // Bottom outline
            this.pxRect(ctx, 0, 9, 1, 4, O)
            this.pxRect(ctx, 15, 9, 1, 4, O)
            this.pxRect(ctx, 1, 13, 1, 1, O)
            this.pxRect(ctx, 14, 13, 1, 1, O)
            this.pxRect(ctx, 2, 14, 2, 1, O)
            this.pxRect(ctx, 12, 14, 2, 1, O)
            this.pxRect(ctx, 4, 15, 8, 1, O)

            // Bottom shadow
            this.pxRect(ctx, 10, 10, 3, 2, '#e0e0d8')

            tex.refresh()
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MISC — Door, route sign, lab computer
    // ═══════════════════════════════════════════════════════════════════════

    private generateMiscSprites() {
        // Interior door
        {
            const GW = 12, GH = 12
            const [ctx, tex] = this.makeCanvas('obj_door', GW * PX, GH * PX)
            this.pxRect(ctx, 0, 0, GW, GH, '#684020')
            this.pxRect(ctx, 1, 1, GW - 2, GH - 2, '#885830')
            this.pxRect(ctx, 2, 2, 3, 3, '#a07040')
            this.pxRect(ctx, 7, 2, 3, 3, '#a07040')
            this.pxRect(ctx, 2, 7, 3, 3, '#a07040')
            this.pxRect(ctx, 7, 7, 3, 3, '#a07040')
            this.px(ctx, 9, 6, '#e0c040')
            this.pxRect(ctx, 0, GH - 1, GW, 1, '#c8b898')
            tex.refresh()
        }

        // Route sign
        {
            const [ctx, tex] = this.makeCanvas('obj_route_sign', 24 * PX, 10 * PX)
            this.pxRect(ctx, 0, 0, 24, 10, '#18181880')
            this.pxRect(ctx, 1, 1, 22, 8, '#101010')
            this.pxRect(ctx, 3, 3, 8, 2, '#f8f8f8')
            this.pxRect(ctx, 13, 3, 8, 2, '#f8f8f8')
            tex.refresh()
        }

        // Lab computer monitor (wall-mounted)
        {
            const [ctx, tex] = this.makeCanvas('furn_lab_computer', 20 * PX, 12 * PX)
            this.pxRect(ctx, 0, 0, 20, 12, '#383840')
            this.pxRect(ctx, 1, 1, 18, 10, '#2880c0')
            this.pxRect(ctx, 2, 2, 8, 1, '#90d0f0')
            this.pxRect(ctx, 3, 4, 12, 1, '#f8f8f8')
            this.pxRect(ctx, 2, 6, 6, 1, '#90d0f0')
            this.pxRect(ctx, 4, 8, 10, 1, '#f8f8f8')
            this.px(ctx, 15, 3, '#f8f8f8')
            this.px(ctx, 16, 5, '#f8f8f8')
            this.px(ctx, 15, 7, '#f8f8f8')
            this.px(ctx, 17, 9, '#40e040')
            tex.refresh()
        }
    }

    /** Nurse Joy — pink hair, white dress with red cross, FRLG style (16×24) */
    private generateNurseSprite() {
        const W = 16, H = 24
        const [ctx, tex] = this.makeCanvas('npc_nurse', W * PX, H * PX)
        const P: Record<string, string> = {
            'P': '#f080a0', 'p': '#d06080', // pink hair
            'S': '#f8b878', 's': '#e89858', // skin
            'W': '#f8f8f8', 'w': '#d8d8d8', // white dress
            'R': '#d83830', // red cross
            'K': '#181818', // outline
            'E': '#282828', // eyes
        }
        const grid = [
            '......PPPP......',
            '.....PPPPPP.....',
            '....PPPPPPPP....',
            '....PPPppPPP....',
            '....SSSSSSSS....',
            '....SSEESSES....',
            '....SSSSSSSS....',
            '....sSSSSSss....',
            '.....SSSSSS.....',
            '....WWWWWWWW....',
            '...WWWWWWWWWW...',
            '...WWWRWWWWWW...',
            '...WWRRRWWWWW...',
            '...WWWRWWWWWW...',
            '...WWWWWWWWWW...',
            '...WWWWWWWWWW...',
            '...WwWWWWWwWW...',
            '...wwWWWWwwWW...',
            '....WWWWWWWW....',
            '....WWWWWWWW....',
            '....WW..WWWW....',
            '....SS..SSSS....',
            '....WW..WWWW....',
            '....WW..WWWW....',
        ]
        this.drawGrid(ctx, grid, P)
        tex.refresh()
    }

    /** Shopkeeper — green apron, friendly face, FRLG style (16×24) */
    private generateShopkeeperSprite() {
        const W = 16, H = 24
        const [ctx, tex] = this.makeCanvas('npc_shopkeeper', W * PX, H * PX)
        const P: Record<string, string> = {
            'H': '#402808', 'h': '#583818', // brown hair
            'S': '#f8b878', 's': '#e89858', // skin
            'G': '#38a028', 'g': '#287818', // green apron
            'W': '#f8f8f8', 'w': '#d8d8d8', // white shirt
            'B': '#3058a8', 'b': '#204080', // blue pants
            'K': '#181818',
            'E': '#282828',
        }
        const grid = [
            '......HHHH......',
            '.....HHHHHH.....',
            '....HHHHHHHH....',
            '....HHHhhHHH....',
            '....SSSSSSSS....',
            '....SSEESSES....',
            '....SSSSSSSS....',
            '....sSSSSSss....',
            '.....SSSSSS.....',
            '....WWWWWWWW....',
            '...GGGGGGGGGG...',
            '...GGGGGGGGGG...',
            '...GGGGGGGGGG...',
            '...GGGgGGGGGG...',
            '...GGGGGGGGGG...',
            '...GGggGGggGG...',
            '...GgGGGGGGgG...',
            '...ggGGGGGGgg...',
            '....BBBBBBBB....',
            '....BBBBBBBB....',
            '....BB..BBBB....',
            '....SS..SSSS....',
            '....KK..KKKK....',
            '....KK..KKKK....',
        ]
        this.drawGrid(ctx, grid, P)
        tex.refresh()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ROUTE & CITY SPRITES — Tiles and buildings for Route 1 / Viridian City
    // ═══════════════════════════════════════════════════════════════════════

    private generateRouteSprites() {
        // ── Tall grass tile (Route 1 style) ────────────────────────
        {
            const GW = 16, GH = 16
            const [ctx, tex] = this.makeCanvas('tile_tall_grass', GW * PX, GH * PX)
            this.pxRect(ctx, 0, 0, GW, GH, '#389028')
            // Grass blade tips (staggered V shapes like FRLG)
            for (let x = 1; x < GW; x += 3) {
                this.pxRect(ctx, x, 0, 1, 4, '#287018')
                this.px(ctx, x + 1, 2, '#48b038')
            }
            for (let x = 2; x < GW; x += 4) {
                this.pxRect(ctx, x, 6, 1, 3, '#287018')
                this.px(ctx, x + 1, 8, '#48b038')
            }
            this.pxRect(ctx, 0, 10, 4, 3, '#307820')
            this.pxRect(ctx, 8, 12, 5, 3, '#307820')
            this.px(ctx, 5, 1, '#58c048')
            this.px(ctx, 12, 5, '#58c048')
            this.px(ctx, 3, 9, '#58c048')
            tex.refresh()
        }

        // ── Cave floor tile (dark rocky) ───────────────────────────
        {
            const GW = 16, GH = 16
            const [ctx, tex] = this.makeCanvas('tile_cave_floor', GW * PX, GH * PX)
            this.pxRect(ctx, 0, 0, GW, GH, '#383040')
            this.pxRect(ctx, 2, 3, 3, 2, '#403848')
            this.pxRect(ctx, 9, 1, 4, 2, '#403848')
            this.pxRect(ctx, 1, 10, 3, 3, '#403848')
            this.pxRect(ctx, 11, 8, 3, 3, '#403848')
            this.pxRect(ctx, 6, 12, 4, 2, '#403848')
            this.px(ctx, 5, 5, '#282028')
            this.px(ctx, 6, 6, '#282028')
            this.px(ctx, 12, 4, '#282028')
            this.px(ctx, 3, 13, '#282028')
            this.px(ctx, 7, 2, '#484050')
            this.px(ctx, 14, 11, '#484050')
            tex.refresh()
        }

        // ── Cave wall tile ─────────────────────────────────────────
        {
            const GW = 16, GH = 16
            const [ctx, tex] = this.makeCanvas('tile_cave_wall', GW * PX, GH * PX)
            this.pxRect(ctx, 0, 0, GW, GH, '#484048')
            this.pxRect(ctx, 0, 0, GW, 2, '#585058')
            this.pxRect(ctx, 1, 3, 6, 4, '#504850')
            this.pxRect(ctx, 9, 2, 5, 5, '#504850')
            this.pxRect(ctx, 3, 8, 4, 3, '#504850')
            this.pxRect(ctx, 10, 9, 5, 4, '#504850')
            this.pxRect(ctx, 0, 14, GW, 2, '#383038')
            this.px(ctx, 7, 5, '#383038')
            this.px(ctx, 2, 11, '#383038')
            this.px(ctx, 3, 3, '#585860')
            this.px(ctx, 12, 4, '#585860')
            this.px(ctx, 6, 10, '#585860')
            tex.refresh()
        }

        // ── Glowing crystal ────────────────────────────────────────
        {
            const GW = 8, GH = 12
            const [ctx, tex] = this.makeCanvas('obj_crystal', GW * PX, GH * PX)
            this.pxRect(ctx, 3, 0, 2, 1, '#40c0e0')
            this.pxRect(ctx, 2, 1, 4, 2, '#40c0e0')
            this.pxRect(ctx, 1, 3, 6, 4, '#30a0c0')
            this.pxRect(ctx, 2, 7, 4, 3, '#2080a0')
            this.pxRect(ctx, 3, 10, 2, 2, '#186880')
            this.px(ctx, 3, 2, '#80e0f8')
            this.px(ctx, 2, 4, '#60d0f0')
            this.px(ctx, 4, 5, '#80e0f8')
            this.pxRect(ctx, 1, 11, 6, 1, '#383040')
            tex.refresh()
        }

        // ── Pokémon Center (FRLG-style red roof, white P logo) ─────
        {
            const GW = 72, GH = 48
            const [ctx, tex] = this.makeCanvas('building_pokecenter', GW * PX, GH * PX)

            // Walls
            this.pxRect(ctx, 0, 18, GW, 30, '#f0e0c8')
            this.pxRect(ctx, 1, 19, GW - 2, 28, '#e8d8c0')
            // Pillar columns
            this.pxRect(ctx, 1, 18, 4, 30, '#d8c8b0')
            this.pxRect(ctx, GW - 5, 18, 4, 30, '#d8c8b0')
            // Roof — main red
            this.pxRect(ctx, 0, 0, GW, 20, '#d83830')
            // Roof highlight
            this.pxRect(ctx, 0, 0, GW, 3, '#f04840')
            this.pxRect(ctx, 2, 3, GW - 4, 2, '#e04038')
            // Roof eave/shadow
            this.pxRect(ctx, 0, 18, GW, 2, '#b82820')
            // P logo circle (white circle with P)
            this.pxRect(ctx, 29, 3, 14, 14, '#d83830') // clear area
            // White circle
            this.pxRect(ctx, 32, 3, 8, 1, '#f8f8f8')
            this.pxRect(ctx, 31, 4, 10, 1, '#f8f8f8')
            this.pxRect(ctx, 30, 5, 12, 10, '#f8f8f8')
            this.pxRect(ctx, 31, 15, 10, 1, '#f8f8f8')
            this.pxRect(ctx, 32, 16, 8, 1, '#f8f8f8')
            // P letter (red on white)
            this.pxRect(ctx, 33, 6, 2, 8, '#d83830')
            this.pxRect(ctx, 35, 6, 4, 2, '#d83830')
            this.pxRect(ctx, 37, 8, 2, 2, '#d83830')
            this.pxRect(ctx, 35, 10, 3, 2, '#d83830')
            // Door (centered, with glass panel)
            this.pxRect(ctx, 29, 32, 14, 16, '#684020')
            this.pxRect(ctx, 30, 33, 12, 14, '#885830')
            this.pxRect(ctx, 31, 34, 4, 8, '#80c8e8')
            this.pxRect(ctx, 37, 34, 4, 8, '#80c8e8')
            // Doormat
            this.pxRect(ctx, 30, 46, 12, 2, '#c09060')
            // Windows — framed with sills
            this.pxRect(ctx, 7, 24, 16, 14, '#404848')
            this.pxRect(ctx, 8, 25, 14, 12, '#80c8e8')
            this.pxRect(ctx, 9, 26, 12, 10, '#a0d8f0')
            this.pxRect(ctx, 15, 25, 1, 12, '#505858')
            this.pxRect(ctx, 8, 31, 14, 1, '#505858')
            this.pxRect(ctx, 7, 38, 16, 1, '#c8b898')
            this.pxRect(ctx, 49, 24, 16, 14, '#404848')
            this.pxRect(ctx, 50, 25, 14, 12, '#80c8e8')
            this.pxRect(ctx, 51, 26, 12, 10, '#a0d8f0')
            this.pxRect(ctx, 57, 25, 1, 12, '#505858')
            this.pxRect(ctx, 50, 31, 14, 1, '#505858')
            this.pxRect(ctx, 49, 38, 16, 1, '#c8b898')
            // Window reflections
            this.pxRect(ctx, 10, 27, 3, 2, '#c0e8f8')
            this.pxRect(ctx, 52, 27, 3, 2, '#c0e8f8')
            // Foundation
            this.pxRect(ctx, 0, GH - 2, GW, 2, '#a09880')
            tex.refresh()
        }

        // ── Poké Mart (FRLG-style blue roof, MART text) ───────────
        {
            const GW = 60, GH = 45
            const [ctx, tex] = this.makeCanvas('building_pokemart', GW * PX, GH * PX)

            // Walls
            this.pxRect(ctx, 0, 16, GW, 29, '#e0d8d0')
            this.pxRect(ctx, 1, 17, GW - 2, 27, '#d8d0c8')
            // Pillar columns
            this.pxRect(ctx, 1, 16, 4, 29, '#c8c0b8')
            this.pxRect(ctx, GW - 5, 16, 4, 29, '#c8c0b8')
            // Roof — main blue
            this.pxRect(ctx, 0, 0, GW, 18, '#2868b8')
            // Roof highlight
            this.pxRect(ctx, 0, 0, GW, 3, '#3878d0')
            this.pxRect(ctx, 2, 3, GW - 4, 2, '#3070c8')
            // Roof eave
            this.pxRect(ctx, 0, 16, GW, 2, '#1848a0')
            // MART sign (white rectangle with text area)
            this.pxRect(ctx, 14, 5, 32, 8, '#f8f8f8')
            this.pxRect(ctx, 15, 6, 30, 6, '#e8e8e0')
            // Small color bars on sign (FRLG detail)
            this.pxRect(ctx, 16, 7, 6, 1, '#d83830')
            this.pxRect(ctx, 24, 7, 6, 1, '#3878d0')
            this.pxRect(ctx, 33, 7, 6, 1, '#38a028')
            this.pxRect(ctx, 18, 9, 24, 1, '#888880')
            // Door
            this.pxRect(ctx, 24, 28, 12, 17, '#684020')
            this.pxRect(ctx, 25, 29, 10, 15, '#885830')
            this.pxRect(ctx, 26, 30, 3, 8, '#80c8e8')
            this.pxRect(ctx, 31, 30, 3, 8, '#80c8e8')
            // Doormat
            this.pxRect(ctx, 25, 43, 10, 2, '#c09060')
            // Windows — framed
            this.pxRect(ctx, 6, 22, 12, 12, '#404848')
            this.pxRect(ctx, 7, 23, 10, 10, '#80c8e8')
            this.pxRect(ctx, 8, 24, 8, 8, '#a0d8f0')
            this.pxRect(ctx, 12, 23, 1, 10, '#505858')
            this.pxRect(ctx, 6, 34, 12, 1, '#c8b898')
            this.pxRect(ctx, 42, 22, 12, 12, '#404848')
            this.pxRect(ctx, 43, 23, 10, 10, '#80c8e8')
            this.pxRect(ctx, 44, 24, 8, 8, '#a0d8f0')
            this.pxRect(ctx, 48, 23, 1, 10, '#505858')
            this.pxRect(ctx, 42, 34, 12, 1, '#c8b898')
            // Window reflections
            this.pxRect(ctx, 9, 25, 2, 2, '#c0e8f8')
            this.pxRect(ctx, 45, 25, 2, 2, '#c0e8f8')
            // Foundation
            this.pxRect(ctx, 0, GH - 2, GW, 2, '#a09880')
            tex.refresh()
        }

        // ── PokéCenter interior floor (pink/white tile) ───────────
        {
            const S = 16
            const [ctx, tex] = this.makeCanvas('tile_floor_pokecenter', S * PX, S * PX)
            this.pxRect(ctx, 0, 0, S, S, '#f8e8e0')
            this.pxRect(ctx, 0, 0, S, 1, '#e0c8c0')
            this.pxRect(ctx, 0, 0, 1, S, '#e0c8c0')
            this.pxRect(ctx, S - 1, 0, 1, S, '#d8c0b8')
            this.pxRect(ctx, 0, S - 1, S, 1, '#d8c0b8')
            // Cross pattern
            this.pxRect(ctx, 7, 0, 2, S, '#f0d0c8')
            this.pxRect(ctx, 0, 7, S, 2, '#f0d0c8')
            tex.refresh()
        }

        // ── PokéMart interior floor (blue/white tile) ─────────────
        {
            const S = 16
            const [ctx, tex] = this.makeCanvas('tile_floor_pokemart', S * PX, S * PX)
            this.pxRect(ctx, 0, 0, S, S, '#e0e8f0')
            this.pxRect(ctx, 0, 0, S, 1, '#c0c8d8')
            this.pxRect(ctx, 0, 0, 1, S, '#c0c8d8')
            this.pxRect(ctx, S - 1, 0, 1, S, '#b8c0d0')
            this.pxRect(ctx, 0, S - 1, S, 1, '#b8c0d0')
            this.pxRect(ctx, 7, 0, 2, S, '#c8d0e0')
            this.pxRect(ctx, 0, 7, S, 2, '#c8d0e0')
            tex.refresh()
        }

        // ── Healing machine ───────────────────────────────────────
        {
            const GW = 24, GH = 20
            const [ctx, tex] = this.makeCanvas('furn_heal_machine', GW * PX, GH * PX)
            // Base
            this.pxRect(ctx, 2, 10, 20, 10, '#e0d8d0')
            this.pxRect(ctx, 3, 11, 18, 8, '#d8d0c8')
            this.pxRect(ctx, 2, 18, 20, 2, '#c0b8b0')
            // Top unit
            this.pxRect(ctx, 4, 2, 16, 10, '#d83830')
            this.pxRect(ctx, 5, 3, 14, 8, '#e04038')
            // Pokéball slots (3)
            this.pxRect(ctx, 6, 12, 4, 4, '#505050')
            this.pxRect(ctx, 7, 13, 2, 2, '#f8f8f8')
            this.pxRect(ctx, 12, 12, 4, 4, '#505050')
            this.pxRect(ctx, 13, 13, 2, 2, '#f8f8f8')
            // Screen
            this.pxRect(ctx, 7, 4, 10, 5, '#30c060')
            this.pxRect(ctx, 8, 5, 8, 3, '#50e080')
            // Light
            this.px(ctx, 18, 4, '#f8e040')
            tex.refresh()
        }

        // ── Shop counter ──────────────────────────────────────────
        {
            const GW = 48, GH = 16
            const [ctx, tex] = this.makeCanvas('furn_shop_counter', GW * PX, GH * PX)
            this.pxRect(ctx, 0, 0, GW, GH, '#885830')
            this.pxRect(ctx, 1, 1, GW - 2, GH - 2, '#a07040')
            this.pxRect(ctx, 0, 0, GW, 2, '#b08050')
            this.pxRect(ctx, 0, GH - 2, GW, 2, '#785028')
            // Glass display section
            this.pxRect(ctx, 4, 3, 12, 8, '#80c8e8')
            this.pxRect(ctx, 5, 4, 10, 6, '#a0d8f0')
            // Register
            this.pxRect(ctx, 32, 2, 10, 10, '#404040')
            this.pxRect(ctx, 33, 3, 8, 6, '#50c850')
            this.pxRect(ctx, 33, 10, 8, 2, '#606060')
            tex.refresh()
        }

        // ── Shop shelf (items) ────────────────────────────────────
        {
            const GW = 20, GH = 24
            const [ctx, tex] = this.makeCanvas('furn_shop_shelf', GW * PX, GH * PX)
            // Shelf frame
            this.pxRect(ctx, 0, 0, GW, GH, '#885830')
            this.pxRect(ctx, 1, 1, GW - 2, GH - 2, '#a07040')
            // Shelf dividers
            this.pxRect(ctx, 1, 8, GW - 2, 1, '#785028')
            this.pxRect(ctx, 1, 16, GW - 2, 1, '#785028')
            // Items (colored boxes on shelves)
            // Top shelf — potions
            this.pxRect(ctx, 3, 2, 4, 5, '#d040d0')
            this.pxRect(ctx, 9, 2, 4, 5, '#d040d0')
            this.pxRect(ctx, 15, 3, 3, 4, '#f8c030')
            // Mid shelf — Pokéballs
            this.pxRect(ctx, 3, 10, 4, 5, '#d83830')
            this.pxRect(ctx, 4, 12, 2, 1, '#f8f8f8')
            this.pxRect(ctx, 9, 10, 4, 5, '#d83830')
            this.pxRect(ctx, 10, 12, 2, 1, '#f8f8f8')
            this.pxRect(ctx, 15, 10, 3, 5, '#3868c0')
            // Bottom shelf — misc
            this.pxRect(ctx, 3, 18, 5, 4, '#38a028')
            this.pxRect(ctx, 10, 18, 4, 4, '#f0c030')
            this.pxRect(ctx, 15, 18, 3, 4, '#e04838')
            tex.refresh()
        }

        // ── Nurse NPC ─────────────────────────────────────────────
        this.generateNurseSprite()

        // ── Shopkeeper NPC ────────────────────────────────────────
        this.generateShopkeeperSprite()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CREATURE SPRITES — All 5 species, front + back + overworld (16×16)
    // FRLG-style pixel art at PX=2 scale
    // ═══════════════════════════════════════════════════════════════════════

    private generateCreatureSprites() {
        this.generateFlameling()
        this.generateAquafin()
        this.generateVerdling()
        this.generateVoltpup()
        this.generateStonebear()
        this.generateSnekob()
        this.generateSmogon()
        this.generateMeowthCreature()
        this.generateKads()
    }

    /** Flameling — Fire lizard (orange/red, flame tail) */
    private generateFlameling() {
        // ── Front sprite (24×24) ──
        {
            const [ctx, tex] = this.makeCanvas('creature_flameling_front', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'O': '#f08030', 'o': '#c86020', 'R': '#e04030',
                'r': '#b82820', 'Y': '#f8d830', 'y': '#d0a820', 'W': '#f8f8f8',
                'E': '#282828', 'C': '#f8e870',
            }
            this.drawGrid(ctx, [
                '........................',
                '........................',
                '.........KKKK...........',
                '........KOOOoK..........',
                '.......KOOOOOoK.........',
                '.......KOEOOEOoK........',
                '.......KOOOOOOOK........',
                '........KOOOOK..........',
                '.......KOOOOOOOK........',
                '......KOOOOOOOoK........',
                '.....KOOOOOOOOOK........',
                '....KOOOOOOOOOoK........',
                '....KOOOoOOoOOOK........',
                '....KOOOOOOOOoK.........',
                '.....KOOOOOOoK.....KK...',
                '.....KOoKKKoOK....KRYK..',
                '....KOoK..KoOK...KRYYK..',
                '....KoK....KOKK..KRRYK..',
                '....KK......KOKKKRYYK...',
                '.............KKKKRYK....',
                '..............KKKYK.....',
                '...............KKK......',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        // ── Back sprite (24×24) ──
        {
            const [ctx, tex] = this.makeCanvas('creature_flameling_back', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'O': '#f08030', 'o': '#c86020', 'R': '#e04030',
                'Y': '#f8d830', 'r': '#b82820',
            }
            this.drawGrid(ctx, [
                '........................',
                '........................',
                '.........KKKK...........',
                '........KooooK..........',
                '.......KoooooooK........',
                '.......KoooooooK........',
                '.......KoooooooK........',
                '........KooooK..........',
                '.......KooooooooK.......',
                '......KOOOOOOOOoK.......',
                '.....KOOOOOOOOOOOK......',
                '....KOOOOOOOOOOoK.......',
                '....KOOOoOOoOOOK........',
                '....KOOOOOOOOoK.........',
                '.....KOOOOOOoK.....KK...',
                '.....KOoKKKoOK....KRYK..',
                '....KOoK..KoOK...KRYYK..',
                '....KoK....KOKK..KRRYK..',
                '....KK......KOKKKRYYK...',
                '.............KKKKRYK....',
                '..............KKKYK.....',
                '...............KKK......',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        // ── Overworld sprite (16×16) ──
        {
            const [ctx, tex] = this.makeCanvas('creature_flameling_ow', 16 * PX, 16 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'O': '#f08030', 'o': '#c86020', 'R': '#e04030',
                'Y': '#f8d830', 'E': '#282828',
            }
            this.drawGrid(ctx, [
                '......KKK.......',
                '.....KOOOK......',
                '....KOEOEOK.....',
                '....KOOOOOK.....',
                '.....KOOOOK.....',
                '....KOOOOOK.....',
                '...KOOOOOOK.....',
                '...KOOoOOOK.....',
                '...KOOOOOK..KK..',
                '....KoKKoK.KRYK.',
                '...KoK..KOKRYYK.',
                '...KK....KKRYK..',
                '..........KYK...',
                '..........KK....',
                '................',
                '................',
            ], P)
            tex.refresh()
        }
    }

    /** Aquafin — Water fish/turtle (blue, fins, shell) */
    private generateAquafin() {
        {
            const [ctx, tex] = this.makeCanvas('creature_aquafin_front', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'B': '#3078d0', 'b': '#2058a0', 'L': '#58a8f0',
                'l': '#4088d0', 'W': '#f8f8f8', 'E': '#282828', 'T': '#d0c088',
                't': '#b0a070',
            }
            this.drawGrid(ctx, [
                '........................',
                '........................',
                '..........KKKK..........',
                '.........KBBBBK.........',
                '........KBLBBBLK........',
                '........KBEBBELK........',
                '........KBBBBBLK........',
                '.........KBBBBK.........',
                '........KBBBBBBK........',
                '.......KBBBBBBBbK.......',
                '......KBBBBBBBBBbK......',
                '.....KBBBBBBBBBBbK......',
                '....KBBTTTTTTBBBbK.....',
                '....KBTTTTTTTTBBbK.....',
                '....KBBTTTTTTBBbK......',
                '....KBBBBBBBBBbK.......',
                '.....KBBBBBBBbK........',
                '.....KBbKKKBbK.........',
                '....KBbK..KBbK.........',
                '....KbK....KbK.........',
                '....KK......KK.........',
                '........................',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        {
            const [ctx, tex] = this.makeCanvas('creature_aquafin_back', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'B': '#3078d0', 'b': '#2058a0', 'L': '#58a8f0',
                'T': '#d0c088', 't': '#b0a070',
            }
            this.drawGrid(ctx, [
                '........................',
                '........................',
                '..........KKKK..........',
                '.........KbbbbK.........',
                '........KbbbbbbbK.......',
                '........KbbbbbbbK.......',
                '........KbbbbbbbK.......',
                '.........KbbbbK.........',
                '........KBBBBBBbK.......',
                '.......KBBBBBBBBbK......',
                '......KBBBBBBBBBBbK.....',
                '.....KBBBBBBBBBBbK......',
                '....KBBTTTTTTBBBbK.....',
                '....KBTTTTTTTTBBbK.....',
                '....KBBTTTTTTBBbK......',
                '....KBBBBBBBBBbK.......',
                '.....KBBBBBBBbK........',
                '.....KBbKKKBbK.........',
                '....KBbK..KBbK.........',
                '....KbK....KbK.........',
                '....KK......KK.........',
                '........................',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        {
            const [ctx, tex] = this.makeCanvas('creature_aquafin_ow', 16 * PX, 16 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'B': '#3078d0', 'b': '#2058a0', 'L': '#58a8f0',
                'E': '#282828', 'T': '#d0c088',
            }
            this.drawGrid(ctx, [
                '.......KKK......',
                '......KBBBK.....',
                '.....KBEBEBK....',
                '.....KBBBBLK....',
                '......KBBBBK....',
                '.....KBBBBBbK...',
                '....KBBTTTBBbK..',
                '....KBTTTTBBbK..',
                '....KBBBBBBbK...',
                '.....KBbKBbK....',
                '....KbK..KbK....',
                '....KK....KK....',
                '................',
                '................',
                '................',
                '................',
            ], P)
            tex.refresh()
        }
    }

    /** Verdling — Grass bulb creature (green, leaf on head, seed body) */
    private generateVerdling() {
        {
            const [ctx, tex] = this.makeCanvas('creature_verdling_front', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'G': '#38a028', 'g': '#287818', 'L': '#58c848',
                'l': '#48b038', 'D': '#68d058', 'E': '#282828', 'S': '#c8e888',
                'B': '#90c860',
            }
            this.drawGrid(ctx, [
                '........................',
                '..........KK............',
                '.........KLLK...........',
                '........KLLLLK..........',
                '.......KLLLLLDK.........',
                '........KLLDK...........',
                '.........KKK............',
                '........KGGGK...........',
                '.......KGGGGGK..........',
                '......KGGGGGGgK.........',
                '.....KGEGGGEGGgK........',
                '.....KGGGGGGGGgK........',
                '.....KGGGGGGGGgK........',
                '......KGGGGGGgK.........',
                '.....KGGGGGGGgK.........',
                '....KGGBBBBGGGgK........',
                '....KGBSSSSBGGgK........',
                '....KGGBBBBGGgK.........',
                '.....KGGGGGGgK.........',
                '.....KGgKKKGgK.........',
                '....KGgK..KGgK.........',
                '....KgK....KgK.........',
                '....KK......KK.........',
                '........................',
            ], P)
            tex.refresh()
        }
        {
            const [ctx, tex] = this.makeCanvas('creature_verdling_back', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'G': '#38a028', 'g': '#287818', 'L': '#58c848',
                'D': '#68d058', 'B': '#90c860', 'S': '#c8e888',
            }
            this.drawGrid(ctx, [
                '........................',
                '..........KK............',
                '.........KLLK...........',
                '........KLLLLK..........',
                '.......KLLLLLDK.........',
                '........KLLDK...........',
                '.........KKK............',
                '........KggggK..........',
                '.......KgggggggK........',
                '......KggggggggK........',
                '.....KggggggggggK.......',
                '.....KgggggggggggK......',
                '.....KGGGGGGGGGgK......',
                '......KGGGGGGGgK.......',
                '.....KGGBBBBGGGgK......',
                '....KGGBSSSSBGGgK......',
                '....KGGGBBBBGGgK.......',
                '.....KGGGGGGGgK........',
                '.....KGgKKKGgK.........',
                '....KGgK..KGgK.........',
                '....KgK....KgK.........',
                '....KK......KK.........',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        {
            const [ctx, tex] = this.makeCanvas('creature_verdling_ow', 16 * PX, 16 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'G': '#38a028', 'g': '#287818', 'L': '#58c848',
                'E': '#282828', 'B': '#90c860',
            }
            this.drawGrid(ctx, [
                '.......KK.......',
                '......KLLK......',
                '.....KLLLK......',
                '......KLK.......',
                '......KGGK......',
                '.....KGGGGgK....',
                '....KGEGGEGgK...',
                '....KGGGGGGgK...',
                '.....KGGGGgK....',
                '....KGBBBGgK....',
                '....KGGGGgK.....',
                '.....KgKKgK.....',
                '....KgK.KgK.....',
                '....KK...KK.....',
                '................',
                '................',
            ], P)
            tex.refresh()
        }
    }

    /** Voltpup — Electric puppy (yellow, zigzag tail, spark cheeks) */
    private generateVoltpup() {
        {
            const [ctx, tex] = this.makeCanvas('creature_voltpup_front', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'Y': '#f8d830', 'y': '#d0a820', 'W': '#f8f8f8',
                'E': '#282828', 'R': '#e04030', 'B': '#383838', 'L': '#f8e870',
                'Z': '#f8e040',
            }
            this.drawGrid(ctx, [
                '........................',
                '...KK...........KK.....',
                '..KYYK.........KYYK....',
                '..KYYYK.......KYYYK....',
                '..KYYYKKKKKKKKYYYK.....',
                '...KYYYYYYYYYYYY K.....',
                '...KYEYYYRRYEYYK.......',
                '...KYYYYYRRYYYRYK......',
                '....KYYYYYYYYY K.......',
                '....KYYYYYYYYY K.......',
                '...KYYYYYYYYYYYY K.....',
                '..KYYYYYYYYYYYYY K.....',
                '..KYYYYYYYYYYYYYY K....',
                '..KYYYYYYYYYYYYYK.....',
                '...KYYYYYYYYYYY K......',
                '...KYYKK.KKYY K........',
                '..KYYK....KYYK.........',
                '..KYK......KYK.........',
                '..KK........KK.........',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        {
            const [ctx, tex] = this.makeCanvas('creature_voltpup_back', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'Y': '#f8d830', 'y': '#d0a820', 'Z': '#f8e040',
            }
            this.drawGrid(ctx, [
                '........................',
                '...KK...........KK.....',
                '..KyyK.........KyyK....',
                '..KyyyK.......KyyyK....',
                '..KyyyKKKKKKKKyyyK.....',
                '...KyyyyyyyyyyyyK......',
                '...KyyyyyyyyyyyyK......',
                '...KyyyyyyyyyyyyK......',
                '....KyyyyyyyyyyK.......',
                '....KyyyyyyyyyyK.......',
                '...KyyyyyyyyyyyyK......',
                '..KYYYYYYYYYYYYYyK.....',
                '..KYYYYYYYYYYYYYyK.....',
                '..KYYYYYYYYYYYYyK......',
                '...KYYYYYYYYYYyK.......',
                '...KYyKK.KKYyK.........',
                '..KYyK....KYyK.........',
                '..KYK......KYK.........',
                '..KK........KK.........',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        {
            const [ctx, tex] = this.makeCanvas('creature_voltpup_ow', 16 * PX, 16 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'Y': '#f8d830', 'y': '#d0a820', 'E': '#282828',
                'R': '#e04030',
            }
            this.drawGrid(ctx, [
                '..KK.......KK...',
                '.KYYK.....KYYK..',
                '.KYYKKKKKKKYYK..',
                '..KYYYYYYYYYK...',
                '..KEYYYRREYYK...',
                '..KYYYYYYYYYYK..',
                '.KYYYYYYYYYYK...',
                '.KYYYYYYYYYK....',
                '..KYYKK.KYYK....',
                '.KYYK...KYYK....',
                '.KYK.....KYK...',
                '.KK.......KK...',
                '................',
                '................',
                '................',
                '................',
            ], P)
            tex.refresh()
        }
    }

    /** Stonebear — Normal/Ground bear (brown/gray, rocky) */
    private generateStonebear() {
        {
            const [ctx, tex] = this.makeCanvas('creature_stonebear_front', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'B': '#906840', 'b': '#705030', 'G': '#a08060',
                'g': '#887050', 'W': '#f8f8f8', 'E': '#282828', 'N': '#584028',
                'R': '#b09070', 'T': '#787068',
            }
            this.drawGrid(ctx, [
                '........................',
                '....KKK........KKK.....',
                '...KBBBK......KBBBK....',
                '...KBBBBKKKKKKKBBBK....',
                '..KBBGGBBBBBBBBGGBbK...',
                '..KBBBBBBBBBBBBBBBbK...',
                '..KBBEBBBBBBBBEBBK.....',
                '..KBBBBBBNBBBBBBbK.....',
                '...KBBBBBBBBBBBbK......',
                '..KBBBBBBBBBBBBBbK.....',
                '..KBBBBBBBBBBBBBBbK....',
                '.KBBRRBBBBBBRRBBBbK....',
                '.KBBRRBBBBBBRRBBBbK....',
                '.KBBBBBBBBBBBBBBBbK....',
                '.KBBBBBBBBBBBBBBbK.....',
                '..KBBBBBBBBBBBBbK......',
                '..KBBbKKK.KKBBbK.......',
                '.KBBbK.....KBBbK.......',
                '.KBbK.......KBbK.......',
                '.KTK.........KTK.......',
                '.KK...........KK.......',
                '........................',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        {
            const [ctx, tex] = this.makeCanvas('creature_stonebear_back', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'B': '#906840', 'b': '#705030', 'G': '#a08060',
                'R': '#b09070', 'T': '#787068',
            }
            this.drawGrid(ctx, [
                '........................',
                '....KKK........KKK.....',
                '...KbbbK......KbbbK....',
                '...KbbbbKKKKKKKbbbK....',
                '..KbbGGbbbbbbbbGGbbK...',
                '..KbbbbbbbbbbbbbbbbK...',
                '..KbbbbbbbbbbbbbbbbK...',
                '..KbbbbbbbbbbbbbbbbK...',
                '...KbbbbbbbbbbbbbbK....',
                '..KBBBBBBBBBBBBBBBbK...',
                '..KBBBBBBBBBBBBBBBBbK..',
                '.KBBRRBBBBBBRRBBBBbK...',
                '.KBBRRBBBBBBRRBBBBbK...',
                '.KBBBBBBBBBBBBBBBBbK...',
                '.KBBBBBBBBBBBBBBBbK....',
                '..KBBBBBBBBBBBBBbK.....',
                '..KBBbKKK.KKBBbK.......',
                '.KBBbK.....KBBbK.......',
                '.KBbK.......KBbK.......',
                '.KTK.........KTK.......',
                '.KK...........KK.......',
                '........................',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        {
            const [ctx, tex] = this.makeCanvas('creature_stonebear_ow', 16 * PX, 16 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'B': '#906840', 'b': '#705030', 'G': '#a08060',
                'E': '#282828', 'N': '#584028', 'T': '#787068',
            }
            this.drawGrid(ctx, [
                '..KKK......KKK..',
                '.KBBBK....KBBBK.',
                '.KBBBBKKKKBBBBK.',
                'KBBGBBBBBBGBBbK.',
                'KBBEBBBBBBEBBK..',
                'KBBBBBNBBBBBbK..',
                '.KBBBBBBBBBBbK..',
                'KBBBBBBBBBBBBbK.',
                'KBBBBBBBBBBBBbK.',
                '.KBBBBBBBBBBbK..',
                '.KBbKKK.KBbK....',
                'KBbK.....KBbK...',
                'KTK.......KTK...',
                'KK.........KK...',
                '................',
                '................',
            ], P)
            tex.refresh()
        }
    }

    /** Snekob — Poison snake (purple/lavender, coiled body) — Jessie's Pokémon */
    private generateSnekob() {
        // ── Front sprite (24×24) ──
        {
            const [ctx, tex] = this.makeCanvas('creature_snekob_front', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'P': '#9050c0', 'p': '#703898',
                'Y': '#f8d830', 'y': '#d0a820', 'W': '#f8f8f8',
                'E': '#282828', 'L': '#c880e0', 'T': '#e04848',
            }
            this.drawGrid(ctx, [
                '........................',
                '........................',
                '.........KKK............',
                '........KPPPK...........',
                '.......KPPPPPK..........',
                '.......KPEPPEPK.........',
                '.......KPPPPPPPK........',
                '........KPTPK...........',
                '.........KPK............',
                '..........KPK...........',
                '...........KPPK.........',
                '............KPPK........',
                '...........KPPPPK.......',
                '..........KPPPPPPK......',
                '.........KPPPPPPPK......',
                '........KPPPPPPPPK......',
                '.......KPPLPPPPLPK......',
                '......KPPPPPPPPPK.......',
                '.....KPPPPPPPPPK........',
                '....KPPPPPPPPK..........',
                '...KPPPPPPPK............',
                '....KKKKKK..............',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        // ── Back sprite (24×24) ──
        {
            const [ctx, tex] = this.makeCanvas('creature_snekob_back', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'P': '#9050c0', 'p': '#703898',
                'L': '#c880e0', 'Y': '#f8d830',
            }
            this.drawGrid(ctx, [
                '........................',
                '........................',
                '.........KKK............',
                '........KpppK...........',
                '.......KpppppK..........',
                '.......KpppppK..........',
                '.......KpppppK..........',
                '........KppK............',
                '.........KpK............',
                '..........KpK...........',
                '...........KPPK.........',
                '............KPPK........',
                '...........KPPPPK.......',
                '..........KPPPPPPK......',
                '.........KPPPPPPPK......',
                '........KPPPPPPPPK......',
                '.......KPPLPPPPLPK......',
                '......KPPPPPPPPPK.......',
                '.....KPPPPPPPPPK........',
                '....KPPPPPPPPK..........',
                '...KPPPPPPPK............',
                '....KKKKKK..............',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
    }

    /** Smogon — Poison gas ball (purple/gray, crater-like markings) — James's Pokémon */
    private generateSmogon() {
        // ── Front sprite (24×24) ──
        {
            const [ctx, tex] = this.makeCanvas('creature_smogon_front', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'G': '#806890', 'g': '#605070',
                'D': '#504060', 'W': '#f8f8f8', 'E': '#282828',
                'C': '#a888b8', 'S': '#d0c0d8', 'X': '#e04848',
            }
            this.drawGrid(ctx, [
                '........................',
                '........................',
                '........................',
                '........KKKKKKK.........',
                '.......KGGGGGGGK........',
                '......KGGGGGGGGGGK......',
                '.....KGGGDGGDGGGGGK.....',
                '....KGGGGDGGDGGGGGGK....',
                '....KGGEWGGWEGGGGGK.....',
                '....KGGGGXGGGGGGGK......',
                '.....KGGGGGGGGGGK.......',
                '....KGGGGDGGGGGGK.......',
                '...KGGGGGDGGGGGGK.......',
                '..KGGGGGGGGGGGGGK.......',
                '..KCCGGGGGGGCCGGK.......',
                '...KCCCGGGCCCGK.........',
                '....KKCCCCCKK...........',
                '......KKKKK.............',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
        // ── Back sprite (24×24) ──
        {
            const [ctx, tex] = this.makeCanvas('creature_smogon_back', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'G': '#806890', 'g': '#605070',
                'D': '#504060', 'C': '#a888b8',
            }
            this.drawGrid(ctx, [
                '........................',
                '........................',
                '........................',
                '........KKKKKKK.........',
                '.......KgggggggK........',
                '......KggggggggggK......',
                '.....KgggDggDgggggK.....',
                '....KggggDggDggggggK....',
                '....KggggggggggggggK....',
                '....KggggggggggggggK....',
                '.....KGGGGGGGGGGGGK.....',
                '....KGGGGDGGGGGGGK......',
                '...KGGGGGDGGGGGGGK......',
                '..KGGGGGGGGGGGGGGK......',
                '..KCCGGGGGGGGCCGK.......',
                '...KCCCGGGGCCCGK........',
                '....KKCCCCCKK...........',
                '......KKKKK.............',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
    }

    /** KADS — Legendary Dragon creature (Dialga-style: armored quadruped, dark steel-blue, cyan diamond markings) */
    private generateKads() {
        // ── Front sprite (24×24) — facing viewer, head up, four legs, chest diamond ──
        {
            const [ctx, tex] = this.makeCanvas('creature_kads_front', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#101020',   // outline
                'B': '#2a3a5c',   // dark steel-blue body
                'b': '#3a4e78',   // mid steel-blue
                'C': '#60c8e8',   // cyan diamond / markings
                'c': '#48a8d0',   // darker cyan accent
                'S': '#8090a8',   // silver/light steel
                's': '#607080',   // mid-steel highlight
                'W': '#d0e8f8',   // white highlight / eye
                'E': '#c03030',   // red eye
                'D': '#50d0f0',   // bright diamond on chest
                'G': '#384868',   // dark shadow steel
                'F': '#c0d0e0',   // fin/wing membrane light
                'f': '#90a0b8',   // fin/wing membrane mid
            }
            this.drawGrid(ctx, [
                '......K..K..K..K........',
                '.....KBK.KB.BK.KBK.....',
                '......KBKBBBBKBK........',
                '.....KBBBBBBBBBK........',
                '.....KBcBBBBcBBK........',
                '......KBBBBBBK..........',
                '......KBWEBWEK..........',
                '.......KBBBBK...........',
                '......KsBBBBsK..........',
                '.....KBBBBBBBBK.........',
                '....KFBBBBBBBBFK........',
                '...KFFbBBDBBbFFK........',
                '...KFK.KBDDBK.KFK......',
                '........KBBK............',
                '.......KBBBBK...........',
                '......KBBccBBK..........',
                '.....KBBcKKcBBK.........',
                '....KBBK....KBBK........',
                '...KBGK......KGBK......',
                '...KBK........KBK......',
                '..KBGK........KGBK.....',
                '..KcK..........KcK.....',
                '..KK............KK.....',
                '........................',
            ], P)
            tex.refresh()
        }
        // ── Back sprite (24×24) — viewed from behind, tail visible, spinal crests ──
        {
            const [ctx, tex] = this.makeCanvas('creature_kads_back', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#101020',
                'B': '#2a3a5c',
                'b': '#3a4e78',
                'C': '#60c8e8',
                'c': '#48a8d0',
                'S': '#8090a8',
                's': '#607080',
                'G': '#384868',
                'F': '#c0d0e0',
                'f': '#90a0b8',
            }
            this.drawGrid(ctx, [
                '......K..K..K..K........',
                '.....KBK.KB.BK.KBK.....',
                '......KBKBBBBKBK........',
                '.....KBBBBBBBBBK........',
                '......KBBBBBBBK.........',
                '......KBcBBcBK..........',
                '.......KBBBBK...........',
                '......KsBBBBsK..........',
                '.....KBBBcBBBBK.........',
                '....KFBBBcBBBBFK........',
                '...KFFbBBcBBbFFK........',
                '...KFK.KBBBbK.KFK......',
                '........KBBK............',
                '.......KBBBBK...........',
                '......KBBccBBK..........',
                '.....KBBcKKcBBK.........',
                '....KBBK....KBBK........',
                '...KBGK......KGBK......',
                '...KBK........KBK......',
                '..KBGK........KGBK.....',
                '..KcK..........KcK.....',
                '..KK............KK.....',
                '...KcccK................',
                '....KKK.................',
            ], P)
            tex.refresh()
        }
    }

    /** KADS NPC — overworld sprite for cave altar (Dialga-style, 16×24 grid) */
    private generateKadsNPC() {
        const [ctx, tex] = this.makeCanvas('npc_kads', 16 * PX, 24 * PX)
        const P: Record<string, string> = {
            'K': '#101020',
            'B': '#2a3a5c',
            'b': '#3a4e78',
            'C': '#60c8e8',
            'c': '#48a8d0',
            'S': '#8090a8',
            'E': '#c03030',
            'D': '#50d0f0',
            'G': '#384868',
            'F': '#c0d0e0',
            'W': '#d0e8f8',
        }
        this.drawGrid(ctx, [
            '....K.K.K.K.....',
            '...KBKBBBKBK....',
            '....KBBBBBK.....',
            '....KBBBBBK.....',
            '....KBEBEK......',
            '.....KBBK.......',
            '....KSBBS K.....',
            '...KBBBBBBK.....',
            '..KFBBDBBFK.....',
            '..KFK KDBK KFK..',
            '.....KBBK.......',
            '....KBBBBK......',
            '...KBBccBBK.....',
            '..KBBK..KBBK...',
            '.KBGK....KGBK..',
            '.KcK......KcK..',
        ], P)
        tex.refresh()
    }

    /** Meowth — cream cat with coin on forehead (battle sprites) */
    private generateMeowthCreature() {
        // ── Front sprite (24×24) ──
        {
            const [ctx, tex] = this.makeCanvas('creature_meowth_front', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'C': '#f8e8b8', 'c': '#d8c898',
                'Y': '#f8d830', 'y': '#d0a820', 'W': '#f8f8f8',
                'E': '#282828', 'P': '#e89080', 'M': '#d05048',
                'B': '#c8a878', 'T': '#f0d8a0',
            }
            this.drawGrid(ctx, [
                '........................',
                '..KK..........KK........',
                '.KCCK........KCCK.......',
                '.KCCCK......KCCCK.......',
                '..KCCCK....KCCCK........',
                '..KCCCCKKKKCCCCK........',
                '..KCCCCCCCCCCCCCK.......',
                '..KCCCYYYCCCCCCCK.......',
                '..KCCCYYYYCCCCCK........',
                '..KCCECCCECCCCCK........',
                '..KCCCCCWCCCCCCK........',
                '...KCPMMPCKCCCK.........',
                '...KKCCCKKCCCCK.........',
                '....KCCCKKCCK...........',
                '...KCCCCCCCCCK..........',
                '..KCCCCCCCCCCCCK........',
                '..KCCCCCCCCCCCCCK.......',
                '..KBCCCCCCCCCCBK........',
                '...KCCCCCCCCCCCK........',
                '....KCCCCCCCCK..........',
                '...KCCK....KCCK.........',
                '...KCCK....KCCK.........',
                '....KK......KK.........',
                '........................',
            ], P)
            tex.refresh()
        }
        // ── Back sprite (24×24) ──
        {
            const [ctx, tex] = this.makeCanvas('creature_meowth_back', 24 * PX, 24 * PX)
            const P: Record<string, string> = {
                'K': '#181818', 'C': '#f8e8b8', 'c': '#d8c898',
                'B': '#c8a878', 'T': '#f0d8a0', 'Y': '#f8d830',
            }
            this.drawGrid(ctx, [
                '........................',
                '..KK..........KK........',
                '.KccK........KccK.......',
                '.KcccK......KcccK.......',
                '..KcccK....KcccK........',
                '..KccccKKKKccccK........',
                '..KccccccccccccK........',
                '..KccccYYccccccK........',
                '..KccccccccccccK........',
                '..KccccccccccccK........',
                '...KccccccccccK.........',
                '....KccccccccK..........',
                '...KCCCCCCCCCCCK........',
                '..KCCCCCCCCCCCCK........',
                '..KCCCCCCCCCCCCCK.......',
                '..KBCCCCCCCCCBK.........',
                '...KCCCCCCCCCCK.........',
                '....KCCCCCCCCCK.........',
                '...KCCK....KCCK.........',
                '...KCCK....KCCK.........',
                '....KK......KK.........',
                '........................',
                '........................',
                '........................',
            ], P)
            tex.refresh()
        }
    }
}
