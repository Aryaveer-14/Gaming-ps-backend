import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import authRouter    from './routes/auth'
import storyRouter   from './routes/story'
import starterRoutes    from './routes/starter'
import inventoryRoutes  from './routes/inventory'
import partyRoutes      from './routes/party'
import { registerBattleNamespace }    from './namespaces/battle'
import { registerOverworldNamespace } from './namespaces/overworld'

const app = express()
const httpServer = http.createServer(app)

// Allow LAN + localhost origins for multiplayer testing
const ALLOWED_ORIGINS = [
    process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
]

const io = new Server(httpServer, {
    cors: {
        origin: (_origin, cb) => cb(null, true),
        credentials: true,
    },
})

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: (_origin, cb) => cb(null, true),
    credentials: true,
}))
app.use(express.json())

// ─── REST Routes ──────────────────────────────────────────────────────────────
app.use('/auth',    authRouter)
app.use('/story',   storyRouter)
app.use('/starter', starterRoutes)
app.use('/inventory', inventoryRoutes)
app.use('/party', partyRoutes)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Socket.io Namespaces ─────────────────────────────────────────────────────
registerOverworldNamespace(io)
registerBattleNamespace(io)

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001)
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT} (LAN accessible)`)
    console.log(`📡 Namespaces: /overworld, /battle`)
})

export { io }
