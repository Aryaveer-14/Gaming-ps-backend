import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import authRouter    from './routes/auth'
import storyRouter   from './routes/story'
import starterRouter from './routes/starter'
import { registerBattleNamespace }    from './namespaces/battle'
import { registerOverworldNamespace } from './namespaces/overworld'

const app = express()
const httpServer = http.createServer(app)

// Allow both Vite ports (5173 and 5174) since Vite auto-increments
const ALLOWED_ORIGINS = [
    process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
]

const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
})

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
        cb(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
}))
app.use(express.json())

// ─── REST Routes ──────────────────────────────────────────────────────────────
app.use('/auth',    authRouter)
app.use('/story',   storyRouter)
app.use('/starter', starterRouter)

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Socket.io Namespaces ─────────────────────────────────────────────────────
registerOverworldNamespace(io)
registerBattleNamespace(io)

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001)
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
    console.log(`📡 Namespaces: /overworld, /battle`)
})

export { io }
