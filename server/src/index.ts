import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import authRouter from './routes/auth'
import { registerBattleNamespace } from './namespaces/battle'

const app = express()
const httpServer = http.createServer(app)

const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
        credentials: true,
    },
})

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }))
app.use(express.json())

// ─── REST Routes ──────────────────────────────────────────────────────────────
app.use('/auth', authRouter)

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Socket.io Namespaces ─────────────────────────────────────────────────────
registerBattleNamespace(io)

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001)
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
})

export { io }
